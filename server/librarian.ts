"use server";

import { db } from "@/db/drizzle";
import { librarianMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { retrieveContext } from "./rag";
import { resolveMany, isEntityType, type EntityType } from "./registry/entity-registry";

/**
 * บรรณารักษ์ — ถาม-ตอบเกี่ยวกับนิยายด้วย Graph RAG
 * --------------------------------------------------
 * manual / opt-in: ผู้ใช้พิมพ์คำถามเอง → retrieveContext (vector + graph)
 * → LLM ตอบจาก "บริบทที่ให้เท่านั้น" (กัน hallucination เพราะนี่คือ canon ของผู้เขียน)
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const TYPHOON_API_URL = "https://api.opentyphoon.ai/v1/chat/completions";
const TYPHOON_API_KEY = process.env.TYPHOON_API_KEY || "";

const SYSTEM_PROMPT = `คุณคือ "บรรณารักษ์" ผู้ช่วยตอบคำถามเกี่ยวกับนิยายเรื่องนี้
กฎการตอบ:
- ตอบจาก "บริบทอ้างอิง" ที่ให้มาเท่านั้น ห้ามแต่ง/เดาข้อมูลที่ไม่มีในบริบท
- ถ้าบริบทไม่มีคำตอบ ให้บอกตรงๆ ว่า "ไม่พบข้อมูลนี้ในคลังข้อมูล (อาจต้อง Vector Sync เนื้อหาล่าสุดก่อน)"
- ตอบเป็นภาษาไทย กระชับ ตรงคำถาม
- อ้างชื่อ entity (ตัวละคร/สถานที่/lore ฯลฯ) ที่ใช้ตอบเมื่อเหมาะสม`;

async function callLLM(
    provider: "groq" | "typhoon",
    question: string,
    contextString: string,
): Promise<string | null> {
    const url = provider === "groq" ? GROQ_API_URL : TYPHOON_API_URL;
    const key = provider === "groq" ? GROQ_API_KEY : TYPHOON_API_KEY;
    const model =
        provider === "groq"
            ? "meta-llama/llama-4-scout-17b-16e-instruct"
            : "typhoon-v2.5-30b-a3b-instruct";

    if (!key) return null;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: `=== บริบทอ้างอิง ===\n${contextString}\n\n=== คำถาม ===\n${question}`,
                    },
                ],
                temperature: 0.3, // ต่ำ → ยึดบริบท ไม่ฟุ้ง
                max_tokens: 1024,
            }),
        });
        if (!res.ok) {
            console.error(`[librarian] ${provider} API error:`, await res.text());
            return null;
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() ?? null;
    } catch (e) {
        console.error(`[librarian] ${provider} fetch error:`, e);
        return null;
    }
}

export interface LibrarianSource {
    type: string;
    id: string;
    title: string;
    via: "search" | "graph";
    href: string | null;
    content?: string;  // ข้อความบริบทที่ดึงมา (search hit) — โชว์ "ตอบจาก canon จริง"
    relation?: string; // ถ้ามาจาก graph: เชื่อมโยงผ่าน relation อะไร
}

export interface AskLibrarianResult {
    success: boolean;
    answer?: string;
    sources?: LibrarianSource[];
    error?: string;
}

/** บันทึก user + assistant message ลงเธรด (best-effort — ไม่ให้ DB ล้มกระทบคำตอบ) */
async function persistTurn(
    novelId: string,
    question: string,
    answer: string,
    sources: LibrarianSource[],
) {
    try {
        await db.insert(librarianMessages).values([
            { novelId, role: "user", content: question },
            { novelId, role: "assistant", content: answer, sources },
        ]);
    } catch (e) {
        console.error("[librarian] persistTurn error:", e);
    }
}

export async function askLibrarian(
    novelId: string,
    question: string,
): Promise<AskLibrarianResult> {
    const q = question.trim();
    if (!q) {
        return { success: false, error: "กรุณาพิมพ์คำถาม" };
    }

    // 1. Graph RAG retrieval (vector + 1-hop graph)
    const { items, contextString } = await retrieveContext(novelId, q);

    if (!contextString) {
        const answer =
            "ไม่พบข้อมูลที่เกี่ยวข้องในคลังข้อมูล — ลองกด Vector Sync เพื่อให้บรรณารักษ์เห็นเนื้อหาล่าสุดก่อนนะครับ";
        await persistTurn(novelId, q, answer, []);
        return { success: true, answer, sources: [] };
    }

    // 2. ถาม LLM (Groq หลัก, Typhoon สำรอง)
    let answer = await callLLM("groq", q, contextString);
    if (!answer) answer = await callLLM("typhoon", q, contextString);
    if (!answer) {
        // LLM ล้มทั้งคู่ → ไม่บันทึก เพื่อให้ผู้ใช้ retry ได้สะอาด
        return { success: false, error: "บรรณารักษ์ไม่ว่างชั่วคราว ลองใหม่อีกครั้ง" };
    }

    // 3. resolve source + บันทึกเธรด
    const sources = await buildSources(items);
    await persistTurn(novelId, q, answer, sources);

    return { success: true, answer, sources };
}

type RetrievedItems = Awaited<ReturnType<typeof retrieveContext>>["items"];

/** แปลง retrieval items → LibrarianSource (resolve href ผ่าน registry) */
async function buildSources(items: RetrievedItems): Promise<LibrarianSource[]> {
    const pointers = items
        .filter((it) => isEntityType(it.type))
        .map((it) => ({ type: it.type as EntityType, id: it.id }));
    const resolved = await resolveMany(pointers);
    return items.map((it) => ({
        type: it.type,
        id: it.id,
        title: it.title,
        via: it.via,
        href: resolved.get(`${it.type}:${it.id}`)?.href ?? null,
        content: it.content,
        relation: it.relation,
    }));
}

/**
 * ดึงเฉพาะ sources (retrieval อย่างเดียว ไม่เรียก LLM) — ให้กราฟไฮไลต์ทันทีก่อน LLM ตอบ
 * ponytail: retrieveContext รันซ้ำกับใน askLibrarian (1 vector query) — รับได้เพราะ librarian เป็น manual/ความถี่ต่ำ
 */
export async function retrieveLibrarianSources(
    novelId: string,
    question: string,
): Promise<{ sources: LibrarianSource[] }> {
    const q = question.trim();
    if (!q) return { sources: [] };
    try {
        const { items } = await retrieveContext(novelId, q);
        return { sources: await buildSources(items) };
    } catch (e) {
        console.error("[librarian] retrieveLibrarianSources error:", e);
        return { sources: [] };
    }
}

/** ดึงประวัติสนทนาทั้งเธรดของนิยาย (เรียงเก่า → ใหม่) */
export async function getLibrarianThread(novelId: string) {
    try {
        const rows = await db
            .select()
            .from(librarianMessages)
            .where(eq(librarianMessages.novelId, novelId))
            .orderBy(asc(librarianMessages.createdAt));
        return { success: true as const, data: rows };
    } catch (e) {
        console.error("[librarian] getLibrarianThread error:", e);
        return { success: false as const, error: "โหลดประวัติไม่สำเร็จ" };
    }
}

/** ล้างเธรดสนทนา (กันคำตอบ AI ที่ผิดค้างถาวร — ผู้ใช้กดเอง) */
export async function clearLibrarianThread(novelId: string) {
    try {
        await db.delete(librarianMessages).where(eq(librarianMessages.novelId, novelId));
        return { success: true as const };
    } catch (e) {
        console.error("[librarian] clearLibrarianThread error:", e);
        return { success: false as const, error: "ล้างประวัติไม่สำเร็จ" };
    }
}

"use server";

import { db } from "@/db/drizzle";
import { librarianMessages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { retrieveContext } from "./rag";
import { resolveMany, isEntityType, type EntityType } from "./registry/entity-registry";
import { callAi, assertAiAllowed, AiControlError } from "@/lib/ai-gateway";

/**
 * บรรณารักษ์ — ถาม-ตอบเกี่ยวกับนิยายด้วย Graph RAG
 * --------------------------------------------------
 * manual / opt-in: ผู้ใช้พิมพ์คำถามเอง → retrieveContext (vector + graph)
 * → LLM ตอบจาก "บริบทที่ให้เท่านั้น" (กัน hallucination เพราะนี่คือ canon ของผู้เขียน)
 *
 * LLM เรียกผ่าน AI Gateway (flag/quota/fallback/log จัดการที่ gateway — Groq หลัก Typhoon สำรอง)
 */

const SYSTEM_PROMPT = `คุณคือ "บรรณารักษ์" ผู้ช่วยตอบคำถามเกี่ยวกับนิยายเรื่องนี้
กฎการตอบ:
- ตอบจาก "บริบทอ้างอิง" ที่ให้มาเท่านั้น ห้ามแต่ง/เดาข้อมูลที่ไม่มีในบริบท
- ถ้าบริบทไม่มีคำตอบ ให้บอกตรงๆ ว่า "ไม่พบข้อมูลนี้ในคลังข้อมูล (อาจต้อง Vector Sync เนื้อหาล่าสุดก่อน)"
- ตอบเป็นภาษาไทย กระชับ ตรงคำถาม
- อ้างชื่อ entity (ตัวละคร/สถานที่/lore ฯลฯ) ที่ใช้ตอบเมื่อเหมาะสม`;

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
    try {
        await assertAiAllowed("librarian");
    } catch (e) {
        const message = e instanceof AiControlError ? e.message : "ไม่ได้รับอนุญาตให้ใช้ AI";
        return { success: false, error: message };
    }

    const q = question.trim();
    if (!q) {
        return { success: false, error: "กรุณาพิมพ์คำถาม" };
    }

    // 1. Graph RAG retrieval (vector + 1-hop graph) — อาจโดน gate ถ้า admin ปิด graph-rag-search
    let retrieval: Awaited<ReturnType<typeof retrieveContext>>;
    try {
        retrieval = await retrieveContext(novelId, q);
    } catch (e) {
        const message = e instanceof AiControlError ? e.message : "ดึงบริบทจากคลังไม่สำเร็จ";
        return { success: false, error: message };
    }
    const { items, contextString } = retrieval;

    if (!contextString) {
        const answer =
            "ไม่พบข้อมูลที่เกี่ยวข้องในคลังข้อมูล — ลองกด Vector Sync เพื่อให้บรรณารักษ์เห็นเนื้อหาล่าสุดก่อนนะครับ";
        await persistTurn(novelId, q, answer, []);
        return { success: true, answer, sources: [] };
    }

    // 2. ถาม LLM ผ่าน gateway (Groq หลัก, Typhoon สำรอง — fallback เดินให้เอง)
    let answer: string | null = null;
    try {
        const res = await callAi({
            feature: "librarian",
            system: SYSTEM_PROMPT,
            prompt: `=== บริบทอ้างอิง ===\n${contextString}\n\n=== คำถาม ===\n${q}`,
            novelId,
        });
        answer = res.text;
    } catch (e) {
        if (e instanceof AiControlError && e.reason !== "all-failed") {
            return { success: false, error: e.message };
        }
        // all-failed → เดินเข้าเงื่อนไขด้านล่าง (คำตอบ friendly เดิม)
    }

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
        // retrieval ยิง embedding query ที่ /search ด้วย — ผ่าน gate เดียวกับ vector search
        await assertAiAllowed("graph-rag-search");
    } catch {
        return { sources: [] };
    }
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

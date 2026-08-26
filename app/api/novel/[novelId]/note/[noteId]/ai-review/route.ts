import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { db } from "@/db/drizzle";
import { chapterReaderResponse, notes } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { retrieveContext } from "@/server/rag";
import { getReadingOrder, notesBefore } from "@/server/reading-order";
import { callAi, assertAiAllowed, AiControlError } from "@/lib/ai-gateway";

/**
 * ผู้อ่านจำลองรายตอน
 *
 * เดิมเป็น persona 5 ตัวที่เรียก LLM 5 ครั้ง ต่างกันแค่น้ำเสียง ได้ input เดียวกัน
 * และคืนร้อยแก้วที่เอาไปแก้งานไม่ได้ ตอนนี้เหลือการเรียกครั้งเดียวที่คืน "คะแนน
 * การตอบสนองของผู้อ่าน" ซึ่งเทียบข้ามตอนได้
 *
 * ข้อจำกัดที่เป็นหัวใจของฟีเจอร์: ผู้อ่านต้องเห็นเฉพาะตอนก่อนหน้า คนที่รู้ตอนจบแล้ว
 * ประเมินความลุ้นไม่ได้ตามนิยาม — ตัวกรองอยู่ที่ allowedNoteIds ของ retrieveContext
 *
 * LLM เรียกผ่าน AI Gateway (Groq หลัก Typhoon สำรอง — fallback เดินให้เอง)
 */

/**
 * ขึ้นเวอร์ชันทุกครั้งที่แก้ rubric หรือ SYSTEM_PROMPT
 * คะแนนเทียบกันได้เฉพาะภายในเวอร์ชันเดียวกัน กราฟข้ามตอนต้องกรองด้วยค่านี้
 */
const PROMPT_VERSION = "v1";

/** ทั้งบทโดยประมาณ — เดิมตัดที่ 3,000 ซึ่งเป็นแค่ครึ่งบท คนอ่านครึ่งบทตัดสินความลุ้นไม่ได้ */
const MAX_CHARS = 12_000;

const SYSTEM_PROMPT = `คุณคือผู้อ่านนิยายคนหนึ่งที่กำลังอ่านมาถึงตอนนี้พอดี
คุณ "ยังไม่รู้" ว่าเรื่องจะดำเนินต่อไปอย่างไร ห้ามเดาหรือสมมติเหตุการณ์ในตอนถัดไป
ให้ตอบจากสิ่งที่อ่านมาถึงตรงนี้เท่านั้น

ตอบกลับเป็น JSON object เดียวตามโครงนี้เท่านั้น (ห้ามมีข้อความอื่นนอก JSON)
ใส่เหตุผลก่อนคะแนนเสมอ — ให้ตัดสินจากหลักฐานที่เขียนไว้ ไม่ใช่ความรู้สึกรวม ๆ

{
  "suspense_reason": "เหตุผลสั้น 1 ประโยค",
  "suspense": 1-5,
  "curiosity_reason": "เหตุผลสั้น 1 ประโยค",
  "curiosity": 1-5,
  "surprise_reason": "เหตุผลสั้น 1 ประโยค",
  "surprise": 1-5,
  "motivation_reason": "เหตุผลสั้น 1 ประโยค",
  "motivation_clarity": "clear" | "muddy" | "unclear",
  "causality_reason": "เหตุผลสั้น 1 ประโยค",
  "causality": "clear" | "muddy" | "unclear",
  "stakes_reason": "เหตุผลสั้น 1 ประโยค",
  "stakes": "clear" | "muddy" | "unclear"
}

เกณฑ์คะแนน — ใช้ตามนี้เคร่งครัด อย่าให้คะแนนกลาง ๆ เพื่อความปลอดภัย

ความลุ้น (suspense) = กลัวว่าจะเกิดเรื่องร้ายกับคนที่เราแคร์
  1 = ไม่มีอะไรให้กลัว ไม่รู้ว่าอะไรกำลังจะเสียไป
  2 = มีภัยอยู่ห่าง ๆ แต่ยังไม่กระทบใครที่เรารู้จัก
  3 = มีภัยชัดเจน แต่ไม่รู้ว่าจะเสียอะไรถ้าล้มเหลว
  4 = รู้ว่าจะเสียอะไร และภัยใกล้เข้ามา
  5 = ภัยกำลังเกิดตรงหน้า และเดิมพันสูงจนวางไม่ลง

ความสงสัย (curiosity) = อยากรู้คำตอบของสิ่งที่ยังไม่เฉลย
  1 = ไม่มีอะไรค้างคาใจ
  2 = มีจุดคลุมเครือ แต่ไม่ได้อยากรู้เป็นพิเศษ
  3 = มีคำถามชัด 1 ข้อที่อยากรู้
  4 = มีหลายคำถามค้าง และตอนนี้เพิ่งเพิ่มคำถามใหม่
  5 = อยากรู้จนต้องอ่านต่อทันที

ความประหลาดใจ (surprise) = สิ่งที่เกิดขึ้นขัดกับที่คาดไว้
  1 = เดาได้ทั้งหมดตั้งแต่ต้นตอน
  2 = เป็นไปตามคาด มีรายละเอียดเล็กน้อยที่ไม่คิดว่าจะเจอ
  3 = มีจุดพลิกเล็ก ๆ หนึ่งจุด
  4 = มีเรื่องที่ไม่คาดคิด และเมื่อมองย้อนกลับไปมีการปูทางไว้
  5 = พลิกความเข้าใจเดิมทั้งหมด แต่ยังสมเหตุสมผล

แรงจูงใจ/เหตุ-ผล/เดิมพัน ให้ "clear" เมื่อเข้าใจได้จากตัวบท
"muddy" เมื่อพอเดาได้แต่ไม่ชัด "unclear" เมื่ออ่านแล้วงง`;

/** ข้อความที่ผู้อ่านเห็นแทนรีวิว เมื่อรอบนั้นล้ม — บอกสาเหตุจริงจะได้รู้ว่าควรลองใหม่หรือรอ */
function failureMessage(detail: string | null): string {
    const d = detail ?? "";
    if (/429|rate.?limit/i.test(d)) return "⏳ เรียก AI ถี่เกินไป (rate limit) — รอสักครู่แล้วกดใหม่อีกครั้ง";
    if (/\b(401|403)\b/.test(d)) return "🔑 คีย์ AI ใช้ไม่ได้หรือถูกปิดสิทธิ์ — ตรวจสอบการตั้งค่า";
    if (/\b404\b/.test(d)) return "🧩 โมเดล AI ที่ตั้งไว้ไม่มีแล้ว — ต้องแก้ที่โค้ด";
    if (/\b5\d\d\b/.test(d)) return "🛠️ ผู้ให้บริการ AI ขัดข้องชั่วคราว — ลองใหม่ภายหลัง";
    return "⚠️ ตอบกลับจาก AI อ่านไม่ได้ — ลองกดใหม่อีกครั้ง";
}

async function askReader(
    novelId: string,
    text: string,
    contextString: string,
): Promise<{ data: Record<string, unknown> | null; model: string | null; errorDetail: string | null }> {
    const userContent = contextString
        ? `=== สิ่งที่คุณอ่านมาก่อนหน้านี้ ===\n${contextString}\n\n=== ตอนที่กำลังอ่าน ===\n${text}`
        : `=== ตอนที่กำลังอ่าน (ยังไม่มีตอนก่อนหน้า) ===\n${text}`;

    try {
        const res = await callAi({
            feature: "reader-review",
            system: SYSTEM_PROMPT,
            prompt: userContent,
            // 0 เพราะนี่คือการให้คะแนน ไม่ใช่การเขียน — ความสุ่มทำให้กราฟข้ามตอนอ่านไม่ได้
            temperature: 0,
            maxTokens: 2048,
            // ตอนนี้สัญญาคือ object เดียว จึงใช้โหมดนี้ได้ (ตอนที่ prompt ขอ array ใช้ไม่ได้)
            extraBody: { response_format: { type: "json_object" } },
            novelId,
        });

        const raw = res.text;
        const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
        try {
            return { data: JSON.parse(clean), model: res.model, errorDetail: null };
        } catch {
            const m = clean.match(/\{[\s\S]*\}/);
            if (m) {
                try { return { data: JSON.parse(m[0]), model: res.model, errorDetail: null }; } catch { /* ตกไป null */ }
            }
            console.error(`[Reader] แกะ JSON ไม่ได้จาก ${res.provider}:`, clean.slice(0, 200));
            return { data: null, model: res.model, errorDetail: "unparseable JSON" };
        }
    } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error("Reader gateway error:", detail);
        if (e instanceof AiControlError && e.reason !== "all-failed") throw e; // disabled/quota/guest → ส่งต่อ
        return { data: null, model: null, errorDetail: detail };
    }
}

const SCALES = ["clear", "muddy", "unclear"] as const;

function score(v: unknown): number | null {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n)) return null;
    return Math.min(5, Math.max(1, Math.round(n)));
}

function scale(v: unknown): string | null {
    return typeof v === "string" && (SCALES as readonly string[]).includes(v) ? v : null;
}

function reason(v: unknown): string {
    return typeof v === "string" && v.trim() ? v.trim() : "—";
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ novelId: string; noteId: string }> },
) {
    try {
        const { novelId, noteId } = await params;
        const denied = await guardNovel(novelId);
        if (denied) return denied;

        const [row] = await db.select().from(chapterReaderResponse)
            .where(eq(chapterReaderResponse.noteId, noteId)).limit(1);
        return NextResponse.json({ success: true, response: row ?? null });
    } catch (e) {
        console.error("GET reader response error:", e);
        return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
    }
}

export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ novelId: string; noteId: string }> },
) {
    try {
        const { novelId, noteId } = await params;
        const denied = await guardNovel(novelId);
        if (denied) return denied;

        const note = await db.query.notes.findFirst({
            where: and(eq(notes.id, noteId), isNull(notes.deletedAt)),
        });
        if (!note) return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });

        const plainText = ((note.content as { text?: string })?.text ?? "")
            .replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        if (plainText.length < 50) {
            return NextResponse.json({ success: false, error: "เนื้อหาสั้นเกินไป" }, { status: 400 });
        }

        // เกินโควตาให้เอาหัวและท้าย — ตัดแต่หัวอย่างเดียวจะไม่เห็นจุดจบตอน
        // ซึ่งเป็นจุดที่ตัดสินความลุ้นและความสงสัยมากที่สุด
        const truncated = plainText.length > MAX_CHARS;
        const text = truncated
            ? `${plainText.slice(0, Math.floor(MAX_CHARS * 0.6))}\n\n[…ตัดช่วงกลางออก…]\n\n${plainText.slice(-Math.floor(MAX_CHARS * 0.4))}`
            : plainText;

        // ── บริบท: เฉพาะตอนก่อนหน้าเท่านั้น ──
        const order = await getReadingOrder(novelId);
        const before = notesBefore(order, noteId);
        const allowedNoteIds = new Set(before);
        const contextPosition = before.length;

        let contextString = "";
        if (allowedNoteIds.size > 0) {
            try {
                const q = `${note.title || ""} ${plainText.slice(0, 500)}`.trim();
                const { items } = await retrieveContext(novelId, q, { allowedNoteIds });
                contextString = items
                    .map((it) => `[ตอนก่อนหน้า] ${it.title}: ${it.content ?? ""}`)
                    .join("\n");
            } catch (e) {
                console.error("[Reader] ดึงบริบทไม่สำเร็จ:", e);
            }
        }

        // ── เรียกครั้งเดียวผ่าน gateway (Groq → Typhoon fallback ในตัว) ──
        const result = await askReader(novelId, text, contextString);
        const usedModel = result.model;

        if (!result.data) {
            return NextResponse.json({ success: false, message: failureMessage(result.errorDetail) }, { status: 502 });
        }

        const d = result.data;
        const suspense = score(d.suspense);
        const curiosity = score(d.curiosity);
        const surprise = score(d.surprise);

        // ขาดคะแนนใดคะแนนหนึ่ง = ไม่บันทึกเลย แถวที่ครบครึ่งเดียวจะทำให้กราฟข้ามตอนเสียถาวร
        if (suspense === null || curiosity === null || surprise === null) {
            console.error("[Reader] คะแนนไม่ครบ:", JSON.stringify(d).slice(0, 200));
            return NextResponse.json({ success: false, message: failureMessage(null) }, { status: 502 });
        }

        const values = {
            noteId, novelId,
            suspense, suspenseReason: reason(d.suspense_reason),
            curiosity, curiosityReason: reason(d.curiosity_reason),
            surprise, surpriseReason: reason(d.surprise_reason),
            motivationClarity: scale(d.motivation_clarity), motivationReason: reason(d.motivation_reason),
            causality: scale(d.causality), causalityReason: reason(d.causality_reason),
            stakes: scale(d.stakes), stakesReason: reason(d.stakes_reason),
            raw: d,
            model: usedModel ?? "unknown",
            promptVersion: PROMPT_VERSION,
            contextPosition,
            truncated,
        };

        const [saved] = await db.insert(chapterReaderResponse).values(values)
            .onConflictDoUpdate({
                target: chapterReaderResponse.noteId,
                set: { ...values, createdAt: new Date() },
            })
            .returning();

        return NextResponse.json({ success: true, response: saved });
    } catch (e) {
        console.error("POST reader response error:", e);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}

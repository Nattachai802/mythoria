/**
 * AI ช่วยคิดจังหวะ (pacing) ทั้งบท — ให้คะแนน pacing 1-10 ทุกฉากใหญ่ + การ์ดไอเดียในบทเดียวกัน
 * ยิงครั้งเดียวทั้งบท (เห็นบริบทรวม ไม่ตัดสินทีละจุดแยกกัน) ผลลัพธ์ไม่ persist ลง DB — แค่เอาไปวาด
 * เป็นเส้นปะเทียบกับค่าที่คนตั้งเองใน PacingLine
 *
 * pure logic — ไม่เรียก LLM ไม่แตะ DB เหมือน lib/plot-recap.ts
 * เนื้อบริบทไม่ได้ประกอบเอง แต่รับมาจากประตูกลาง getPlotContext (server/plot-context.ts)
 */

import { PACING_MIN, PACING_MAX } from "./scene-dramatic";

export interface PacingAiSuggestPrompt {
    system: string;
    user: string;
}

// additionalProperties: false ทุกชั้น — groq/OpenAI-compatible ส่งด้วย strict: true
// (ดู lib/ai-gateway.ts) ซึ่งบังคับข้อนี้ ไม่ใส่แล้ว provider ตีกลับหรือปล่อยผ่านแบบไม่บังคับ schema
export const PACING_AI_SUGGEST_SCHEMA = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    pacing: { type: "integer", minimum: PACING_MIN, maximum: PACING_MAX },
                    reason: { type: "string" },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["id", "pacing", "reason", "confidence"],
                additionalProperties: false,
            },
        },
    },
    required: ["items"],
    additionalProperties: false,
} as const;

/** contextText = ผลจาก getPlotContext (scope ฉาก level "recap" — digest ฉากเดียว + สรุปฉากถ้ามี) */
export function buildPacingAiSuggestPrompt(contextText: string): PacingAiSuggestPrompt {
    return {
        system: `คุณช่วยนักเขียนประเมิน "จังหวะการเล่า" (pacing) ของฉากหนึ่งและการ์ดไอเดีย (ฉากย่อย) ในฉากนั้น เป็นตัวเลข ${PACING_MIN}-${PACING_MAX}:
เลขต่ำ (${PACING_MIN}-3) = ควรเล่าเร็ว/ผ่อน/สรุปสั้น, เลขกลาง (4-7) = จังหวะคงที่, เลขสูง (8-${PACING_MAX}) = ควรเล่าเด่น/ลงรายละเอียดเต็มที่ (เช่น climax)

ให้คะแนนทั้งตัวฉากเอง และการ์ดย่อยทุกใบในฉาก โดยดูจังหวะภายในฉาก (ไต่ขึ้น/ผ่อนลง/ค้างไว้)
ประกอบกับตำแหน่งของฉากในบทที่บอกไว้ในหัวเอกสาร — ฉากท้ายบทที่ค้างคาควรได้คะแนนสูงกว่าฉากปูพื้นต้นบท

ตัดสินจากเนื้อฉากล้วน ๆ — เอกสารนี้จงใจไม่บอกค่าจังหวะที่นักเขียนตั้งไว้ เพราะต้องการความเห็นอิสระ
ไปเทียบกับของเขาทีหลัง ถ้าเดาว่าเขาตั้งเลขอะไรแล้วตอบตามนั้น ฟีเจอร์นี้จะไร้ประโยชน์ทันที

แต่ละจุดตอบ 3 อย่าง:
- pacing: ตัวเลข ${PACING_MIN}-${PACING_MAX}
- reason: เหตุผลสั้น ๆ ประโยคเดียว ไม่เกิน 15 คำ อ้างสิ่งที่เห็นในเนื้อฉากจริง ห้ามพูดลอย ๆ แบบ "เหมาะสมดี"
- confidence: ความมั่นใจ 0.0-1.0 (ข้อมูลน้อย/ก้ำกึ่ง ให้เลขต่ำตามจริง ห้ามใส่ 0.9 ทุกจุด)

ตอบเป็น JSON ตาม schema เท่านั้น ต้องมีครบทุก id ที่ให้มา ห้ามข้าม ห้ามเติม id ใหม่ที่ไม่มีในรายการ`,
        user: contextText,
    };
}

/** คำแนะนำต่อหนึ่งจุด (ฉากใหญ่ หรือการ์ดไอเดียหนึ่งใบ) */
export interface PacingSuggestion {
    pacing: number;
    /** เหตุผลสั้น ๆ — "" ถ้าโมเดลไม่ตอบมา (ไม่ทิ้งทั้งแถวเพราะขาดเหตุผล) */
    reason: string;
    /** 0.0-1.0 · null = โมเดลไม่ได้ให้มา (คนละความหมายกับ 0 = มั่นใจต่ำมาก) */
    confidence: number | null;
}

const clamp = (n: number) => Math.min(PACING_MAX, Math.max(PACING_MIN, Math.round(n)));

/** เลขที่โมเดลตอบมาเป็น string ("7") ก็รับ — ไม่ใช่ทุก provider เคารพ type ใน schema */
function toPacing(v: unknown): number | null {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
    return Number.isFinite(n) ? clamp(n) : null;
}

/** ดึงก้อน JSON ตัวแรกที่ parse ผ่าน — เผื่อโมเดลห่อ ```json หรือพ่นคำอธิบายนำหน้า */
function extractJson(raw: string): unknown {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
        return JSON.parse(text);
    } catch { /* ลองหาก้อนในข้อความต่อ */ }
    for (const re of [/\[[\s\S]*\]/, /\{[\s\S]*\}/]) {
        const m = text.match(re);
        if (!m) continue;
        try {
            return JSON.parse(m[0]);
        } catch { /* ลองรูปถัดไป */ }
    }
    return null;
}

/** ความมั่นใจ: รับทั้ง 0-1 และ 0-100 (โมเดลชอบตอบเป็นเปอร์เซ็นต์) — เทียบวิธีเดียวกับ
 * server/character-state-extractor.ts ที่ normalize ค่า >1 เป็นเปอร์เซ็นต์ */
function toConfidence(v: unknown): number | null {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim().replace("%", "")) : NaN;
    if (!Number.isFinite(n)) return null;
    const unit = n > 1 ? n / 100 : n;
    return Math.min(1, Math.max(0, unit));
}

const toReason = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 300) : "");

/**
 * รับได้หลายรูปที่โมเดลชอบตอบ (schema ไม่ได้บังคับได้ทุก provider — typhoon เป็น fallback ที่หลุดบ่อย):
 *   {"items":[{"id":"x","pacing":7,...}]} · [{"id":"x","pacing":7}] · {"x":7} · {"scores":[...]}
 * reason/confidence ขาดได้ (ได้ "" / null) แต่ขาด pacing เมื่อไหร่ = ทิ้งแถวนั้น
 * คืน null เมื่อหาคู่ id→pacing ไม่ได้เลย
 */
export function parsePacingAiSuggestResponse(raw: string): Map<string, PacingSuggestion> | null {
    const parsed = extractJson(raw);
    if (!parsed || typeof parsed !== "object") return null;

    // หา array ของ {id, pacing} — อยู่ที่ items หรือ key อื่นที่โมเดลตั้งเองก็ได้
    let list: unknown[] | null = Array.isArray(parsed) ? parsed : null;
    if (!list) {
        for (const v of Object.values(parsed as Record<string, unknown>)) {
            if (Array.isArray(v) && v.some(it => it && typeof it === "object" && "id" in (it as object))) {
                list = v;
                break;
            }
        }
    }

    const map = new Map<string, PacingSuggestion>();
    if (list) {
        for (const it of list) {
            if (!it || typeof it !== "object") continue;
            const row = it as Record<string, unknown>;
            const pacing = toPacing(row.pacing ?? row.value ?? row.score);
            if (typeof row.id !== "string" || pacing === null) continue;
            map.set(row.id, {
                pacing,
                reason: toReason(row.reason ?? row.why ?? row.note),
                confidence: toConfidence(row.confidence ?? row.conf),
            });
        }
    } else {
        // รูป map ตรง ๆ: {"<id>": 7} — ไม่มีที่ให้ใส่เหตุผล/ความมั่นใจ
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            const pacing = toPacing(v);
            if (pacing !== null) map.set(k, { pacing, reason: "", confidence: null });
        }
    }
    return map.size > 0 ? map : null;
}

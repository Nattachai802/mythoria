/**
 * ชั้น AI ของ Beat Coach — ใช้เมื่อผู้ใช้ยังไม่ได้กรอกจังหวะมากพอให้กฎตัดสิน (ดู lib/beat-coach.ts)
 *
 * ยิงครั้งเดียวได้สองอย่าง: เดาจังหวะของการ์ดที่ยังไม่มีค่า + ข้อสังเกตว่าจังหวะถัดไปควรเป็นแบบไหน
 * ผลไม่ persist ลง DB และไม่เขียนทับค่าที่ผู้ใช้ตั้งเอง — ผู้เรียกเป็นคน merge
 *
 * pure logic — เรียก LLM ที่ server/beat-coach.ts
 */

import { PACING_MIN, PACING_MAX } from "./scene-dramatic";
import { SCENE_TYPE_VALUES } from "./scene-type-suggest";
import { PACING_JEV_LEVELS, jevScoreToPacing } from "./pacing-ai-suggest";
import type { JevAnswer, JevQuestion } from "./ai-features";

export const COACH_STATES = ["ok", "dragging", "overheated", "flat"] as const;
export type CoachState = (typeof COACH_STATES)[number];

export interface CoachAdvice {
    state: CoachState;
    /** ข้อสังเกตว่าตอนนี้จังหวะเป็นยังไง */
    text: string;
    /** ประเภทฉากที่เสนอสำหรับจังหวะถัดไป (Unified Scene Framework) */
    suggestedType: string;
    /** จังหวะถัดไปควรเป็นแบบไหน — เป็นข้อเสนอ ไม่ใช่เนื้อหาสำเร็จรูป */
    suggestedNext: string;
}

export interface BeatCoachAiResult {
    /** จังหวะที่ AI เดาให้ ต่อ id ของการ์ด */
    beats: Map<string, number>;
    advice: CoachAdvice | null;
}

export const BEAT_COACH_SCHEMA = {
    type: "object",
    properties: {
        beats: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    id: { type: "string" },
                    pacing: { type: "integer", minimum: PACING_MIN, maximum: PACING_MAX },
                },
                required: ["id", "pacing"],
                additionalProperties: false,
            },
        },
        advice: {
            type: "object",
            properties: {
                state: { type: "string", enum: [...COACH_STATES] },
                text: { type: "string" },
                suggestedType: { type: "string", enum: [...SCENE_TYPE_VALUES] },
                suggestedNext: { type: "string" },
            },
            required: ["state", "text", "suggestedType", "suggestedNext"],
            additionalProperties: false,
        },
    },
    required: ["beats", "advice"],
    additionalProperties: false,
} as const;

export function buildBeatCoachPrompt(contextText: string): { system: string; user: string } {
    return {
        system: `คุณเป็นผู้ช่วยนักเขียนดูจังหวะการเล่าในฉากหนึ่ง หน้าที่คือ "ตั้งข้อสังเกต" ไม่ใช่เขียนเรื่องแทน

ตอบสองช่อง ชื่อช่องต้องเป็น "beats" กับ "advice" เท่านั้น ห้ามตั้งชื่อเอง

beats — ให้คะแนนจังหวะการเล่าของการ์ดทุกใบในฉาก เป็น array ของ {"id", "pacing"} โดย pacing เป็นตัวเลข ${PACING_MIN}-${PACING_MAX}
เลขต่ำ (${PACING_MIN}-3) = ควรเล่าเร็ว/ผ่อน/สรุปสั้น, กลาง (4-7) = คงที่, สูง (8-${PACING_MAX}) = ควรเล่าเด่น ลงรายละเอียดเต็มที่
การ์ดใบไหนที่เอกสารบอก "จังหวะที่ตั้งไว้" มาแล้ว ให้ใช้ค่านั้นตามเดิม ห้ามเปลี่ยน — ตอบเฉพาะใบที่ยังไม่มีค่า

advice — สรุปภาพรวมจังหวะของฉากนี้ แล้วเสนอว่า "จังหวะถัดไป" ควรเป็นแบบไหน
- state: ok (ปกติดี) / dragging (เอื่อยยาว) / overheated (เร่งค้างจนล้า) / flat (แบน ไม่มีสูงต่ำ)
- text: ข้อสังเกตหนึ่งประโยค อ้างสิ่งที่เห็นในฉากจริง ห้ามพูดลอย ๆ
- suggestedType: ประเภทฉากที่ควรเป็นถัดไป — setup (ปูพื้น) / action (รุกฆาต) / reaction (รับแรงกระแทก) / climax (แตกหัก) / resolution (คลี่คลาย)
- suggestedNext: ควรเกิดอะไรในเชิงจังหวะ หนึ่งประโยค — บอกทิศทาง ไม่ใช่เขียนเนื้อเรื่องให้

ห้ามแต่งเหตุการณ์หรือชื่อตัวละครใหม่ที่ไม่มีในเอกสาร ตอบเป็น JSON ตาม schema เท่านั้น ภาษาไทย`,
        user: contextText,
    };
}

// ─── โหมด Jev ───────────────────────────────────────────────────────────

/**
 * Jev ตอบได้เฉพาะส่วนที่เป็น "เลือกจากตัวเลือกที่รู้ล่วงหน้า": beats (Score), state และ
 * suggestedType (Choice) — ส่วน text/suggestedNext เป็นประโยคไทยที่ต้องแต่งใหม่ Jev ทำไม่ได้
 *
 * จึงคาย advice.text/suggestedNext เป็น "" แล้วปล่อยให้ผู้เรียกตัดสินใจว่าจะยิง LLM ต่อ
 * เพื่อเขียนข้อความบนตัวเลขที่ได้ไหม — ดู server/beat-coach.ts
 */
export function buildBeatCoachJev(
    contextText: string,
    cards: { id: string; title: string }[],
): { state: unknown; questions: Record<string, JevQuestion>; toJson: (a: Record<string, JevAnswer>) => string } {
    const state = { ฉาก: contextText };

    const questions: Record<string, JevQuestion> = {
        __state: {
            type: "choice",
            instructions: "ภาพรวมจังหวะของฉากนี้เป็นแบบไหน",
            criteria: {
                ok: "ขึ้นลงมีจังหวะดี ไม่มีปัญหาที่ต้องเตือน",
                dragging: "เอื่อยยาว หลายจังหวะติดกันผ่อนจนเรื่องไม่เดิน",
                overheated: "เร่งค้างจนล้า ไม่มีช่วงให้ผู้อ่านพัก",
                flat: "แบน ทุกจังหวะแรงเท่ากันหมด ไม่มีสูงต่ำ",
            },
        },
        __next: {
            type: "choice",
            instructions: "จังหวะถัดไปหลังจบฉากนี้ ควรเป็นฉากประเภทไหนตาม Unified Scene Framework",
            criteria: {
                setup: "ปูพื้น/ให้ข้อมูล ไม่มีการพลิกของคุณค่า",
                action: "รุกฆาต ตัวละครมีเป้าหมายแล้วเจออุปสรรค",
                reaction: "รับแรงกระแทกจากเหตุการณ์ก่อนหน้า แล้วตัดสินใจใหม่",
                climax: "แตกหัก บททดสอบสูงสุด คุณค่าพลิก",
                resolution: "คลี่คลาย สมดุลใหม่หลังพายุ",
            },
        },
    };
    for (const c of cards) {
        questions[c.id] = {
            type: "score",
            instructions: `การ์ด id "${c.id}" ("${c.title}") ควรถูกเล่าด้วยจังหวะแบบไหน`,
            criteria: [...PACING_JEV_LEVELS],
        };
    }

    const toJson = (answers: Record<string, JevAnswer>): string => {
        const beats = cards.flatMap(c => {
            const a = answers[c.id];
            return a && a.type === "score" && Number.isFinite(a.score)
                ? [{ id: c.id, pacing: jevScoreToPacing(a.score) }]
                : [];
        });
        const st = answers.__state;
        const nx = answers.__next;
        const advice = st && st.type === "choice"
            ? {
                state: (COACH_STATES as readonly string[]).includes(st.choice) ? st.choice : "ok",
                text: "", // Jev ไม่เขียนข้อความ — ผู้เรียกเติมเองถ้าต้องการ
                suggestedType: nx && nx.type === "choice" ? nx.choice : "",
                suggestedNext: "",
            }
            : null;
        return JSON.stringify({ beats, advice });
    };

    return { state, questions, toJson };
}

const clamp = (n: number) => Math.min(PACING_MAX, Math.max(PACING_MIN, Math.round(n)));

function toPacing(v: unknown): number | null {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
    return Number.isFinite(n) ? clamp(n) : null;
}

/** ทนรูปผลลัพธ์หลายแบบเหมือน lib/pacing-ai-suggest.ts — provider สำรองไม่เคารพ schema เสมอไป */
export function parseBeatCoachResponse(raw: string): BeatCoachAiResult | null {
    let parsed: any;
    try {
        const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
        try {
            parsed = JSON.parse(text);
        } catch {
            const m = text.match(/\{[\s\S]*\}/);
            if (!m) return null;
            parsed = JSON.parse(m[0]);
        }
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object") return null;

    // หา array ของ {id,...} จากค่าใด ๆ ไม่ยึดชื่อ key — typhoon เคยตอบ "work1"/"work2" ตามหัวข้อ
    // "งานที่ 1/2" ที่เคยเขียนไว้ใน prompt (ยืนยันจาก raw_response ใน ai_usage_log) prompt แก้แล้ว
    // แต่ provider สำรองยังตั้งชื่อเองได้อยู่ดี · วิธีเดียวกับ lib/pacing-ai-suggest.ts
    const pickList = (o: Record<string, unknown>): unknown[] =>
        (Object.values(o).find(v =>
            Array.isArray(v) && v.some(it => it && typeof it === "object" && "id" in (it as object))
        ) as unknown[]) ?? [];

    const beats = new Map<string, number>();
    const list = Array.isArray(parsed.beats) ? parsed.beats
        : Array.isArray(parsed.items) ? parsed.items
            : pickList(parsed);
    for (const it of list) {
        if (!it || typeof it !== "object" || typeof it.id !== "string") continue;
        const p = toPacing(it.pacing ?? it.value ?? it.score);
        if (p !== null) beats.set(it.id, p);
    }
    // รูป map: {"<id>": 7} หรือ {"<id>": {pacing: 7}}
    if (beats.size === 0 && parsed.beats && typeof parsed.beats === "object" && !Array.isArray(parsed.beats)) {
        for (const [k, v] of Object.entries(parsed.beats as Record<string, unknown>)) {
            const p = toPacing(v && typeof v === "object" ? (v as any).pacing : v);
            if (p !== null) beats.set(k, p);
        }
    }

    // เช่นเดียวกับ beats — ยอมรับ object ที่หน้าตาเป็น advice แม้ชื่อ key จะไม่ใช่ "advice"
    const looksLikeAdvice = (v: unknown) =>
        !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as Record<string, unknown>).text === "string";
    const a = looksLikeAdvice(parsed.advice) ? parsed.advice : Object.values(parsed).find(looksLikeAdvice);
    const advice: CoachAdvice | null = a && typeof a === "object" && typeof a.text === "string"
        ? {
            state: (COACH_STATES as readonly string[]).includes(a.state) ? a.state : "ok",
            text: String(a.text).trim().slice(0, 300),
            suggestedType: (SCENE_TYPE_VALUES as readonly string[]).includes(a.suggestedType) ? a.suggestedType : "",
            suggestedNext: typeof a.suggestedNext === "string" ? a.suggestedNext.trim().slice(0, 300) : "",
        }
        : null;

    if (beats.size === 0 && !advice) return null;
    return { beats, advice };
}

/**
 * รอบที่สองของโหมด Jev — ให้ LLM เขียนข้อความบน "ข้อสรุปที่ Jev ตัดสินไปแล้ว"
 *
 * แยกสองรอบเพราะสองงานนี้คนละชนิด: จัดหมวด (เลือกจากตัวเลือกตายตัว) กับ เขียนประโยคไทย
 * LLM รอบนี้ห้ามเปลี่ยนข้อสรุป มีหน้าที่อธิบายอย่างเดียว จึงไม่ต้องบังคับ schema ให้ยุ่ง
 */
export function buildCoachTextPrompt(
    contextText: string,
    state: CoachState,
    suggestedType: string,
): { system: string; user: string } {
    const stateLabel: Record<CoachState, string> = {
        ok: "จังหวะโดยรวมปกติดี",
        dragging: "จังหวะเอื่อยยาว",
        overheated: "จังหวะเร่งค้างจนล้า",
        flat: "จังหวะแบน ไม่มีสูงต่ำ",
    };
    return {
        system: `ข้อสรุปเรื่องจังหวะของฉากนี้ถูกตัดสินมาแล้วว่า "${stateLabel[state]}" และจังหวะถัดไปควรเป็นฉากประเภท "${suggestedType}"

หน้าที่ของคุณคือเขียนข้อความอธิบายข้อสรุปนั้น ห้ามเปลี่ยนข้อสรุป ห้ามเสนอข้อสรุปอื่น
ตอบเป็น JSON: {"text": "...", "suggestedNext": "..."}
- text: ข้อสังเกตหนึ่งประโยค อ้างสิ่งที่เห็นในฉากจริง ห้ามพูดลอย ๆ
- suggestedNext: จังหวะถัดไปควรเกิดอะไร หนึ่งประโยค บอกทิศทาง ไม่ใช่เขียนเนื้อเรื่องให้
ห้ามแต่งเหตุการณ์หรือชื่อตัวละครใหม่ที่ไม่มีในเอกสาร ภาษาไทย`,
        user: contextText,
    };
}

export const COACH_TEXT_SCHEMA = {
    type: "object",
    properties: { text: { type: "string" }, suggestedNext: { type: "string" } },
    required: ["text", "suggestedNext"],
    additionalProperties: false,
} as const;

/** อ่านผลรอบที่สอง — ขาดได้ ไม่ทิ้งตัวเลขที่ Jev ให้มาแล้วเพราะข้อความเขียนไม่ออก */
export function parseCoachText(raw: string): { text: string; suggestedNext: string } | null {
    try {
        const m = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").match(/\{[\s\S]*\}/);
        if (!m) return null;
        const p = JSON.parse(m[0]);
        if (typeof p.text !== "string") return null;
        return {
            text: p.text.trim().slice(0, 300),
            suggestedNext: typeof p.suggestedNext === "string" ? p.suggestedNext.trim().slice(0, 300) : "",
        };
    } catch {
        return null;
    }
}

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

งานที่ 1 — ให้คะแนนจังหวะการเล่าของการ์ดทุกใบในฉาก เป็นตัวเลข ${PACING_MIN}-${PACING_MAX}
เลขต่ำ (${PACING_MIN}-3) = ควรเล่าเร็ว/ผ่อน/สรุปสั้น, กลาง (4-7) = คงที่, สูง (8-${PACING_MAX}) = ควรเล่าเด่น ลงรายละเอียดเต็มที่
การ์ดใบไหนที่เอกสารบอก "จังหวะที่ตั้งไว้" มาแล้ว ให้ใช้ค่านั้นตามเดิม ห้ามเปลี่ยน — ตอบเฉพาะใบที่ยังไม่มีค่า

งานที่ 2 — สรุปภาพรวมจังหวะของฉากนี้ แล้วเสนอว่า "จังหวะถัดไป" ควรเป็นแบบไหน
- state: ok (ปกติดี) / dragging (เอื่อยยาว) / overheated (เร่งค้างจนล้า) / flat (แบน ไม่มีสูงต่ำ)
- text: ข้อสังเกตหนึ่งประโยค อ้างสิ่งที่เห็นในฉากจริง ห้ามพูดลอย ๆ
- suggestedType: ประเภทฉากที่ควรเป็นถัดไป — setup (ปูพื้น) / action (รุกฆาต) / reaction (รับแรงกระแทก) / climax (แตกหัก) / resolution (คลี่คลาย)
- suggestedNext: ควรเกิดอะไรในเชิงจังหวะ หนึ่งประโยค — บอกทิศทาง ไม่ใช่เขียนเนื้อเรื่องให้

ห้ามแต่งเหตุการณ์หรือชื่อตัวละครใหม่ที่ไม่มีในเอกสาร ตอบเป็น JSON ตาม schema เท่านั้น ภาษาไทย`,
        user: contextText,
    };
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

    const beats = new Map<string, number>();
    const list = Array.isArray(parsed.beats) ? parsed.beats : Array.isArray(parsed.items) ? parsed.items : [];
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

    const a = parsed.advice;
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

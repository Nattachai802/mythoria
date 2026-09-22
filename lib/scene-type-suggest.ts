/**
 * Scene type suggest — เดา sceneType (Unified Scene Framework: Swain + McKee + Syd Field)
 * และ field1/field2/outcome จากโครงฉากที่มีอยู่ ให้ SceneDramaticPanel prefill ฟอร์ม
 *
 * pure logic — ไม่เรียก LLM ไม่มี side effect เหมือน lib/plot-recap.ts การเรียก LLM ทำใน
 * server/scene-type-suggest.ts ผลลัพธ์ไม่ persist ลง DB (แค่คำแนะนำชั่วคราว คนต้องกดบันทึกเอง)
 */


import { PACING_JEV_LEVELS, jevScoreToPacing } from "./pacing-ai-suggest";
import type { JevAnswer, JevQuestion } from "./ai-features";

export const SCENE_TYPE_VALUES = ["setup", "action", "reaction", "climax", "resolution"] as const;
export type SuggestedSceneType = (typeof SCENE_TYPE_VALUES)[number];

export interface SceneTypeSuggestPrompt {
    system: string;
    user: string;
}

export interface SceneTypeSuggestResponse {
    sceneType: SuggestedSceneType;
    field1: string;
    field2: string;
    outcome?: "success" | "failure" | "ongoing" | "unknown";
    pacing?: number; // 1 (ผ่อน/เร็ว) – 10 (เร่ง/ลงรายละเอียด) — คนละมิติจาก outcome
}

export const SCENE_TYPE_SUGGEST_SCHEMA = {
    type: "object",
    properties: {
        sceneType: { type: "string", enum: [...SCENE_TYPE_VALUES] },
        field1: { type: "string" },
        field2: { type: "string" },
        outcome: { type: "string", enum: ["success", "failure", "ongoing", "unknown"] },
        pacing: { type: "integer", minimum: 1, maximum: 10 },
    },
    required: ["sceneType", "field1", "field2", "pacing"],
} as const;

/** contextText = ผลจาก getPlotContext (level "full" — markdown ทั้งฉาก) */
export function buildSceneTypeSuggestPrompt(contextText: string): SceneTypeSuggestPrompt {
    return {
        system: `คุณช่วยนักเขียนจัดหมวดฉากตาม "Unified Scene Framework" (รวมทฤษฎี Dwight V. Swain, Robert McKee, Syd Field) มี 5 ประเภท:

- setup: ฉากปูพื้น/ให้ข้อมูล — field1=Hook (จุดดึงดูด), field2=Context (บริบท/สถานะเดิม) — ไม่มี value shift
- action: ฉากรุกฆาต/เผชิญอุปสรรค — field1=Goal (เป้าหมาย), field2=Conflict (อุปสรรค) — มักจบด้วย outcome="failure" (Disaster)
- reaction: ฉากรับแรงกระแทก/เตรียมการ — field1=Reaction (ปฏิกิริยา), field2=Dilemma+การตัดสินใจใหม่
- climax: ฉากแตกหัก/พลิกผัน — field1=Ultimate Test (บททดสอบสูงสุด), field2=Value Turn (คุณค่าที่พลิกผัน) — ต้องมี outcome ชัดเจน
- resolution: ฉากคลี่คลาย/สรุปผล — field1=Aftermath (ผลลัพธ์หลังพายุ), field2=New Normal (สมดุลใหม่)

อ่านโครงฉากที่ให้มา (เอกสารกระดานพล็อตรายฉาก) แล้วเดาว่าฉากนี้เป็นประเภทไหน พร้อมเติมค่า field1/field2
ที่เหมาะกับประเภทนั้น ถ้าฉากมี goal/conflict/outcome เดิมอยู่แล้วให้ใช้เป็นฐาน ไม่ต้องแต่งเรื่องใหม่

เดา "pacing" (จังหวะการเล่า) เป็นตัวเลข 1-10 ด้วย — คนละมิติจาก outcome (ทิศสถานการณ์):
เลขต่ำ (1-3) = ฉากควรเล่าเร็ว/ผ่อน/สรุปสั้น, เลขกลาง (4-7) = จังหวะคงที่, เลขสูง (8-10) = ควรเล่าเด่น
ลงรายละเอียดเต็มที่ (เช่นฉาก climax มักได้เลขสูง, ฉาก setup/transition มักได้เลขต่ำ)

ตอบสั้น กระชับ ภาษาไทย ห้ามใส่ markdown/bullet ตอบเป็น JSON ตาม schema ที่กำหนดเท่านั้น`,
        user: contextText,
    };
}

// ─── โหมด Jev ───────────────────────────────────────────────────────────

/**
 * Jev ตัดสินได้ 3 อย่าง: sceneType, outcome (Choice) และ pacing (Score)
 *
 * ส่วน field1/field2 เป็นข้อความไทยที่ต้องแต่งใหม่ — Jev ไม่ generate text จึงคายเป็น ""
 * ผู้เรียกต้องยิง LLM รอบสองเติมเอง ดู server/scene-type-suggest.ts
 * (parseSceneTypeSuggestResponse บังคับให้ field เป็น string ซึ่ง "" ก็ผ่าน จึงไม่ทิ้งทั้งผล)
 */
export function buildSceneTypeJev(
    contextText: string,
): { state: unknown; questions: Record<string, JevQuestion>; toJson: (a: Record<string, JevAnswer>) => string } {
    const state = { ฉาก: contextText };

    const questions: Record<string, JevQuestion> = {
        sceneType: {
            type: "choice",
            instructions: "ฉากนี้เป็นประเภทไหนตาม Unified Scene Framework (Swain + McKee + Syd Field)",
            criteria: {
                setup: "ปูพื้น/ให้ข้อมูล บอกบริบทหรือสถานะเดิม ไม่มีการพลิกของคุณค่า",
                action: "ตัวละครมีเป้าหมายชัดแล้วลงมือ เจออุปสรรคขวาง มักจบด้วยความล้มเหลว",
                reaction: "รับแรงกระแทกจากเหตุการณ์ก่อนหน้า ตกอยู่ในภาวะกลืนไม่เข้าคายไม่ออก แล้วตัดสินใจใหม่",
                climax: "บททดสอบสูงสุด จุดแตกหักที่คุณค่าพลิกไปอีกทาง ผลลัพธ์ชัดเจน",
                resolution: "คลี่คลายหลังพายุ สรุปผลที่ตามมา ตั้งสมดุลใหม่",
            },
        },
        outcome: {
            type: "choice",
            instructions: "สถานการณ์ของตัวละครเมื่อจบฉากนี้เป็นอย่างไร",
            criteria: {
                success: "ได้สิ่งที่ต้องการ สถานการณ์ดีขึ้น",
                failure: "ไม่ได้สิ่งที่ต้องการ สถานการณ์แย่ลง",
                ongoing: "ยังไม่จบ ค้างคาไว้ต่อฉากหน้า",
                unknown: "ฉากไม่ได้บอกไว้ ตัดสินไม่ได้จากข้อมูลที่มี",
            },
        },
        pacing: {
            type: "score",
            instructions: "ฉากนี้ควรถูกเล่าด้วยจังหวะแบบไหน",
            criteria: [...PACING_JEV_LEVELS],
        },
    };

    const toJson = (answers: Record<string, JevAnswer>): string => {
        const st = answers.sceneType;
        const oc = answers.outcome;
        const pc = answers.pacing;
        return JSON.stringify({
            sceneType: st && st.type === "choice" ? st.choice : "",
            field1: "", // ผู้เรียกเติมด้วย LLM รอบสอง
            field2: "",
            outcome: oc && oc.type === "choice" ? oc.choice : undefined,
            pacing: pc && pc.type === "score" && Number.isFinite(pc.score) ? jevScoreToPacing(pc.score) : undefined,
        });
    };

    return { state, questions, toJson };
}

export function parseSceneTypeSuggestResponse(raw: string): SceneTypeSuggestResponse | null {
    try {
        const match = raw.trim().match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.sceneType !== "string" || !SCENE_TYPE_VALUES.includes(parsed.sceneType)) return null;
        if (typeof parsed.field1 !== "string" || typeof parsed.field2 !== "string") return null;
        const outcome = typeof parsed.outcome === "string" && ["success", "failure", "ongoing", "unknown"].includes(parsed.outcome)
            ? parsed.outcome
            : undefined;
        const pacing = typeof parsed.pacing === "number" && Number.isFinite(parsed.pacing)
            ? Math.min(10, Math.max(1, Math.round(parsed.pacing)))
            : undefined;
        return { sceneType: parsed.sceneType, field1: parsed.field1, field2: parsed.field2, outcome, pacing };
    } catch {
        return null;
    }
}

/** ป้ายชื่อของ field1/field2 ต่อประเภทฉาก — ใช้ทั้งใน prompt รอบสองและใน UI ได้ */
export const SCENE_TYPE_FIELD_LABELS: Record<SuggestedSceneType, { field1: string; field2: string }> = {
    setup: { field1: "Hook (จุดดึงดูด)", field2: "Context (บริบท/สถานะเดิม)" },
    action: { field1: "Goal (เป้าหมาย)", field2: "Conflict (อุปสรรค)" },
    reaction: { field1: "Reaction (ปฏิกิริยา)", field2: "Dilemma + การตัดสินใจใหม่" },
    climax: { field1: "Ultimate Test (บททดสอบสูงสุด)", field2: "Value Turn (คุณค่าที่พลิกผัน)" },
    resolution: { field1: "Aftermath (ผลลัพธ์หลังพายุ)", field2: "New Normal (สมดุลใหม่)" },
};

/**
 * รอบที่สองของโหมด Jev — เติม field1/field2 บนประเภทฉากที่ Jev ตัดสินไปแล้ว
 * LLM ห้ามเปลี่ยนประเภท มีหน้าที่เขียนสองช่องนั้นให้ตรงกับประเภทที่ล็อกไว้เท่านั้น
 */
export function buildSceneTypeFieldsPrompt(
    contextText: string,
    sceneType: SuggestedSceneType,
): SceneTypeSuggestPrompt {
    const l = SCENE_TYPE_FIELD_LABELS[sceneType];
    return {
        system: `ฉากนี้ถูกจัดประเภทมาแล้วว่าเป็น "${sceneType}" ห้ามเปลี่ยนประเภท ห้ามเสนอประเภทอื่น

หน้าที่ของคุณคือเติมสองช่องนี้ให้ตรงกับประเภทดังกล่าว โดยอ่านจากโครงฉากที่ให้มา:
- field1 = ${l.field1}
- field2 = ${l.field2}

ถ้าฉากมี goal/conflict/outcome เดิมอยู่แล้วให้ใช้เป็นฐาน ไม่ต้องแต่งเรื่องใหม่
ตอบสั้น กระชับ ภาษาไทย ห้ามใส่ markdown/bullet ตอบเป็น JSON: {"field1": "...", "field2": "..."}`,
        user: contextText,
    };
}

export const SCENE_TYPE_FIELDS_SCHEMA = {
    type: "object",
    properties: { field1: { type: "string" }, field2: { type: "string" } },
    required: ["field1", "field2"],
    additionalProperties: false,
} as const;

/** อ่านผลรอบสอง — ขาดได้ ไม่ทิ้งประเภท/pacing ที่ Jev ตัดสินมาแล้ว */
export function parseSceneTypeFields(raw: string): { field1: string; field2: string } | null {
    try {
        const m = raw.trim().match(/\{[\s\S]*\}/);
        if (!m) return null;
        const p = JSON.parse(m[0]);
        if (typeof p.field1 !== "string" || typeof p.field2 !== "string") return null;
        return { field1: p.field1.trim(), field2: p.field2.trim() };
    } catch {
        return null;
    }
}

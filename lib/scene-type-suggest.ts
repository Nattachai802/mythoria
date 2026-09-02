/**
 * Scene type suggest — เดา sceneType (Unified Scene Framework: Swain + McKee + Syd Field)
 * และ field1/field2/outcome จากโครงฉากที่มีอยู่ ให้ SceneDramaticPanel prefill ฟอร์ม
 *
 * pure logic — ไม่เรียก LLM ไม่มี side effect เหมือน lib/plot-recap.ts การเรียก LLM ทำใน
 * server/scene-type-suggest.ts ผลลัพธ์ไม่ persist ลง DB (แค่คำแนะนำชั่วคราว คนต้องกดบันทึกเอง)
 */

import type { SceneFormat } from "./story-format";
import { renderSceneMarkdown } from "./story-format";

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

export function buildSceneTypeSuggestPrompt(format: SceneFormat): SceneTypeSuggestPrompt {
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
        user: renderSceneMarkdown(format),
    };
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

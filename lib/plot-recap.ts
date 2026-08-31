/**
 * Plot Recap — สรุปเนื้อหาจากโครงสร้างบนกระดานพล็อต (คนละอันกับ chapter-summary/note-summary
 * ที่สรุปจากร้อยแก้วที่เขียนแล้ว) สองระดับ: รายฉาก และรายบท (สังเคราะห์จากสรุปฉาก)
 *
 * pure logic — ไม่เรียก LLM ไม่มี side effect เหมือน lib/echo-score.ts
 * การเรียก LLM ทำใน server/plot-recap.ts
 */

import { createHash } from "crypto";
import { renderSceneMarkdown, type SceneFormat } from "./story-format";

// v2: สรุปฉากตอบเป็น JSON (recap + causality) แทนข้อความล้วน — อ่าน context เดียวกัน (ทั้งฉาก)
// ได้ผลตรวจความสมเหตุผลของเหตุ-ผลมาพร้อมกันโดยไม่ต้องยิงคอลเพิ่ม (causeKind/causeNote เป็นฟิลด์
// ระดับฉาก ไม่ใช่ระดับการ์ด — renderSceneMarkdown() ใส่ไว้ใน frontmatter อยู่แล้วถ้ามีการตั้งค่า)
export const RECAP_PROMPT_VERSION = "2";

export interface RecapPrompt {
    system: string;
    user: string;
}

/** ผลสรุปของฉากหนึ่ง — ใช้เป็น input ของ buildChapterRecapPrompt (เฉพาะ recap ไม่รวม causality) */
export interface SceneRecapEntry {
    title: string;
    recap: string;
}

export type CausalityVerdict = "supported" | "unsupported" | "unclear" | "not_stated";

export interface SceneRecapResponse {
    recap: string;
    causality: {
        verdict: CausalityVerdict;
        note: string;
    };
}

/** บังคับรูปแบบที่ API (Gemini responseJsonSchema / OpenAI-compatible response_format) */
export const SCENE_RECAP_SCHEMA = {
    type: "object",
    properties: {
        recap: { type: "string" },
        causality: {
            type: "object",
            properties: {
                verdict: { type: "string", enum: ["supported", "unsupported", "unclear", "not_stated"] },
                note: { type: "string" },
            },
            required: ["verdict", "note"],
        },
    },
    required: ["recap", "causality"],
} as const;

/** แปลง LLM output เป็น SceneRecapResponse — regex ดึง JSON ก่อน parse เหมือน echo-score */
export function parseSceneRecapResponse(raw: string): SceneRecapResponse | null {
    try {
        const trimmed = raw.trim();
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.recap !== "string" || typeof parsed.causality?.verdict !== "string") return null;
        return {
            recap: parsed.recap,
            causality: {
                verdict: parsed.causality.verdict,
                note: typeof parsed.causality.note === "string" ? parsed.causality.note : "",
            },
        };
    } catch {
        return null;
    }
}

/**
 * สรุปฉากเดียว — ใช้ renderSceneMarkdown() ตรง ๆ เป็น user content
 * (ออกแบบมาให้ LLM อ่านอยู่แล้ว มี alias/รหัสการ์ด/ตารางปมครบ ไม่ต้องปั้นใหม่ — ถ้าฉากตั้ง
 * causeKind/causeNote ไว้ frontmatter จะมีบรรทัด "ต่อจากฉากก่อน: ..." ให้โมเดลเห็นด้วยในตัว)
 */
export function buildSceneRecapPrompt(format: SceneFormat): RecapPrompt {
    return {
        system: `คุณเป็นผู้ช่วยสรุปโครงเรื่องให้นักเขียนอ่านเร็ว ๆ ทำ 2 งานพร้อมกันจากเอกสารเดียวกัน:

งานที่ 1 — สรุปฉาก (recap):
- ย่อหน้าเดียว 3-5 ประโยคภาษาไทย
- เน้นเหตุการณ์หลัก ใครทำอะไร ปมเรื่องไหนถูกแตะ (หว่าน/ย้ำ/เฉลย)
- อ้างชื่อตัวละครด้วยชื่อจริง ไม่ใช่ตัวย่อ @A ที่เห็นในเอกสาร (ตัวย่อมีไว้ประหยัด token เท่านั้น)
- ห้ามใส่หัวข้อ bullet, markdown, หรือรหัสการ์ด [C01] ในคำตอบ — เป็นข้อความเล่าเรื่องล้วน ๆ

งานที่ 2 — ตรวจความสมเหตุผล (causality):
- ถ้า frontmatter มีบรรทัด "ต่อจากฉากก่อน: ดังนั้น/แต่ว่า ..." ให้เช็คว่าเนื้อฉากที่เหลือ
  แสดงความเชื่อมโยงนั้นจริงไหม ไม่ใช่แค่ป้ายกำกับลอย ๆ
  - "supported" = เนื้อฉากแสดงความเชื่อมโยงชัดเจน
  - "unsupported" = อ้างไว้แต่เนื้อฉากไม่ได้แสดงความเชื่อมโยงนั้นเลย
  - "unclear" = ก้ำกึ่ง ตีความได้ทั้งสองทาง
- ถ้าฉากนี้ไม่มีบรรทัด "ต่อจากฉากก่อน" เลย ให้ตอบ verdict = "not_stated" และ note ว่างเปล่า
  (ไม่ต้องเดาเอง ไม่ใช่ทุกฉากต้องมีความเชื่อมโยงชัดเจนกับฉากก่อน)
- note อธิบายสั้น ๆ 1 ประโยคว่าทำไมถึงตัดสินแบบนั้น

ตอบเป็น JSON ตาม schema ที่กำหนดเท่านั้น`,
        user: renderSceneMarkdown(format),
    };
}

/**
 * สรุปทั้งบท — สังเคราะห์จากสรุปฉากที่มีอยู่แล้ว (ไม่ใช่ raw beats)
 * ผู้เรียก (server/plot-recap.ts) รับผิดชอบหาสรุปฉากมาให้ครบ — ฉากไหนยังไม่เคยสรุป
 * ให้ fallback ไปเรียก buildSceneRecapPrompt สรุปสดก่อน ไม่ใช่หน้าที่ของฟังก์ชันนี้
 */
export function buildChapterRecapPrompt(scenes: SceneRecapEntry[]): RecapPrompt {
    const body = scenes
        .map((s, i) => `[ฉากที่ ${i + 1}] ${s.title}\n${s.recap}`)
        .join("\n\n");

    return {
        system: `คุณเป็นผู้ช่วยสรุปโครงเรื่องให้นักเขียนอ่านเร็ว ๆ ระดับทั้งบท

ได้รับสรุปย่อยของแต่ละฉากในบทนี้มาแล้ว (เรียงตามลำดับการเล่า)

กติกา:
- สังเคราะห์เป็นภาพรวมเดียวของทั้งบท ไม่ใช่แปะสรุปฉากต่อกันเฉย ๆ
- ย่อหน้าเดียว 4-6 ประโยคภาษาไทย เน้นเส้นเรื่องหลักและจุดเปลี่ยนสำคัญของบท
- ห้ามใส่หัวข้อ bullet, markdown, หรืออ้างเลขฉากในคำตอบ — เป็นข้อความเล่าเรื่องล้วน ๆ
- ตอบเฉพาะย่อหน้าสรุป ไม่มีคำนำหรือคำลงท้าย`,
        user: body,
    };
}

/** SHA-256 สั้น 12 char — เทียบว่า input เปลี่ยนไปไหมก่อนเรียก LLM ซ้ำ (เหมือน hashEchoInput) */
export function hashRecapInput(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

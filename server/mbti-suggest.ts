'use server';

// ช่วยหา MBTI — อ่านภาพรวม + จิตใจ (มิติตัวละคร/แรงจูงใจเชิงลึก) ที่ผู้เขียนเขียน ให้ AI ตอบคำถามสถานการณ์พร้อมหลักฐาน
// ไม่เขียน DB — ผลอยู่ใน state ของหน้าจอ ผู้เขียนกด "ใช้" แล้วค่อยบันทึกผ่าน updateCharacterSection

import { db } from "@/db/drizzle";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callAi, logParseFailure, AiControlError } from "@/lib/ai-gateway";
import { requireNovelAccess, authErrorMessage } from "@/lib/authz";
import { MBTI_AI_SCHEMA, buildMbtiPrompt, verifyAnswers, type AiAnswer } from "@/lib/mbti-suggest";
import type { CharacterMotive } from "@/lib/character-profile";

const MIN_TEXT = 80;      // สั้นกว่านี้ไม่มีอะไรให้ AI อ่าน → ให้ผู้เขียนตอบเองทั้งหมด (ไม่เสีย token)
const MAX_FIELD = 3000;

export type MbtiSuggestResult =
    | { success: true; answers: Record<string, AiAnswer>; usedAi: boolean; notice?: string }
    | { success: false; error: string };

export async function suggestMbti(characterId: string): Promise<MbtiSuggestResult> {
    try {
        const [c] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
        if (!c) return { success: false, error: "ไม่พบตัวละคร" };
        await requireNovelAccess(c.novelId);

        const m = (c.motive ?? {}) as CharacterMotive;
        const parts: [string, string | null | undefined][] = [
            ["สรุป", c.description], ["บุคลิกภาพ", c.personality], ["ปูมหลัง", c.backstory],
            ["เป้าหมาย", c.goals], ["แรงจูงใจ", c.motivation], ["ความขัดแย้ง", c.conflict],
            ["จุดแข็ง", c.strengths], ["จุดอ่อน", c.weaknesses],
            ["วิธีที่ใช้ไปให้ถึง", m.strategy], ["ความเชื่อผิดๆ", m.lie], ["คุณค่าที่ยึดถือ", m.value],
            ["จุดกดดัน", m.pressurePoint], ["บาดแผลในอดีต", m.wound],
        ];
        const source = parts
            .filter(([, v]) => v && v.trim())
            .map(([k, v]) => `[${k}]\n${v!.trim().slice(0, MAX_FIELD)}`)
            .join("\n\n");

        const empty = verifyAnswers(null, "");
        if (source.replace(/\[[^\]]+\]/g, "").trim().length < MIN_TEXT) {
            return { success: true, answers: empty, usedAi: false, notice: "ยังมีข้อมูลตัวละครน้อย — ตอบคำถามเองได้เลย" };
        }

        try {
            const p = buildMbtiPrompt(c.name, source);
            const resp = await callAi({ feature: "mbti-suggest", novelId: c.novelId, system: p.system, prompt: p.prompt, responseSchema: MBTI_AI_SCHEMA });
            let raw: unknown;
            try {
                const t = resp.text.trim();
                raw = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
            } catch {
                await logParseFailure(resp.logId, resp.text);
                return { success: true, answers: empty, usedAi: false, notice: "AI ตอบกลับผิดรูปแบบ — ตอบคำถามเองได้เลย" };
            }
            return { success: true, answers: verifyAnswers(raw, source), usedAi: true };
        } catch (error) {
            // AI ล่ม/โควตาเต็ม — ฟีเจอร์ยังใช้ได้ในโหมดตอบเอง
            const msg = error instanceof AiControlError ? error.message : "AI ใช้งานไม่ได้ตอนนี้";
            console.error("[MbtiSuggest] AI error:", error);
            return { success: true, answers: empty, usedAi: false, notice: `${msg} — ตอบคำถามเองได้เลย` };
        }
    } catch (error) {
        return { success: false, error: authErrorMessage(error, "ช่วยหา MBTI ไม่สำเร็จ") };
    }
}

"use server";

import { requireNovelAccess } from "@/lib/authz";
import { callAi, assertAiAllowed, AiControlError, logParseFailure } from "@/lib/ai-gateway";
import {
    buildPacingAiSuggestPrompt,
    parsePacingAiSuggestResponse,
    PACING_AI_SUGGEST_SCHEMA,
    type PacingSuggestion,
} from "@/lib/pacing-ai-suggest";
import { getPlotContext } from "./plot-context";

type SuggestResult =
    | { success: true; data: Record<string, PacingSuggestion> }
    | { success: false; error: string };

/** AI ให้คะแนน pacing ของฉากเดียว (ฉากใหญ่ + การ์ดไอเดียในฉากนั้น) — ไม่ persist ลง DB
 * ผลลัพธ์ใช้แสดงเป็นเส้นปะเทียบกับค่าที่คนตั้งเองใน PacingLine เท่านั้น
 * ยิงทีละฉากตามที่ผู้ใช้เปิดดูอยู่ ไม่ใช่ทั้งบทรวดเดียว (บริบทตำแหน่งฉากในบทแนบไปใน digest ให้แล้ว) */
export async function suggestScenePacing(sceneId: string, novelId: string, chapterTitle?: string): Promise<SuggestResult> {
    try {
        await assertAiAllowed("pacing-ai-suggest");
        await requireNovelAccess(novelId);

        const ctx = await getPlotContext({
            consumer: "pacing-ai-suggest",
            novelId,
            subjectId: sceneId,
            subjectTitle: chapterTitle,
        });
        if (ctx.sceneCount === 0) return { success: false, error: "ไม่พบฉากนี้" };

        const prompt = buildPacingAiSuggestPrompt(ctx.text);
        const resp = await callAi({
            feature: "pacing-ai-suggest",
            system: prompt.system,
            prompt: prompt.user,
            responseSchema: PACING_AI_SUGGEST_SCHEMA,
            novelId,
        });
        const parsed = parsePacingAiSuggestResponse(resp.text);
        if (!parsed) {
            // เก็บคำตอบดิบไว้ในแถวเดิมของ ai_usage_log — console หายเมื่อปิด dev server
            await logParseFailure(resp.logId, resp.text);
            return { success: false, error: "แนะนำไม่สำเร็จ (รูปแบบผลลัพธ์ผิดพลาด)" };
        }

        return { success: true, data: Object.fromEntries(parsed) };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[PacingAiSuggest] error:", err);
        return { success: false, error: "แนะนำไม่สำเร็จ" };
    }
}

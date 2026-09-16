"use server";

import { requireNovelAccess } from "@/lib/authz";
import { callAi, assertAiAllowed, AiControlError, logParseFailure } from "@/lib/ai-gateway";
import {
    buildBeatCoachPrompt,
    parseBeatCoachResponse,
    BEAT_COACH_SCHEMA,
    type CoachAdvice,
} from "@/lib/beat-coach-ai";
import { getPlotContext } from "./plot-context";

type CoachResult =
    | { success: true; beats: Record<string, number>; advice: CoachAdvice | null }
    | { success: false; error: string };

/** AI อ่านจังหวะของฉากที่ผู้ใช้ยังกรอกไม่ครบ — เดาค่าที่ขาด + เสนอว่าจังหวะถัดไปควรเป็นแบบไหน
 *  ไม่ persist ลง DB · ผู้เรียกต้อง merge เอง โดยให้ค่าที่ผู้ใช้ตั้งเองชนะเสมอ */
export async function coachScenePacing(sceneId: string, novelId: string): Promise<CoachResult> {
    try {
        await assertAiAllowed("beat-coach");
        await requireNovelAccess(novelId);

        const ctx = await getPlotContext({ consumer: "beat-coach", novelId, subjectId: sceneId });
        if (ctx.sceneCount === 0) return { success: false, error: "ไม่พบฉากนี้" };

        const prompt = buildBeatCoachPrompt(ctx.text);
        const resp = await callAi({
            feature: "beat-coach",
            system: prompt.system,
            prompt: prompt.user,
            responseSchema: BEAT_COACH_SCHEMA,
            novelId,
        });

        const parsed = parseBeatCoachResponse(resp.text);
        if (!parsed) {
            await logParseFailure(resp.logId, resp.text);
            return { success: false, error: "อ่านจังหวะไม่สำเร็จ (รูปแบบผลลัพธ์ผิดพลาด)" };
        }

        return { success: true, beats: Object.fromEntries(parsed.beats), advice: parsed.advice };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[BeatCoach] error:", err);
        return { success: false, error: "อ่านจังหวะไม่สำเร็จ" };
    }
}

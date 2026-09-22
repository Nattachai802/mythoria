"use server";

import { requireNovelAccess } from "@/lib/authz";
import { callAi, assertAiAllowed, AiControlError, logParseFailure } from "@/lib/ai-gateway";
import {
    buildBeatCoachPrompt,
    parseBeatCoachResponse,
    buildBeatCoachJev,
    buildCoachTextPrompt,
    parseCoachText,
    BEAT_COACH_SCHEMA,
    COACH_TEXT_SCHEMA,
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
        // ctx.format มีเฉพาะ scope "scene" ซึ่งเป็น scope ของฟีเจอร์นี้ (ดู lib/plot-context.ts)
        const cards = (ctx.format?.beats ?? [])
            .filter(b => !b.isBoardNote)
            .map(b => ({ id: b.id, title: b.title }));
        const resp = await callAi({
            feature: "beat-coach",
            system: prompt.system,
            prompt: prompt.user,
            responseSchema: BEAT_COACH_SCHEMA,
            novelId,
            jev: cards.length ? buildBeatCoachJev(ctx.text, cards) : undefined,
        });

        const parsed = parseBeatCoachResponse(resp.text);
        if (!parsed) {
            await logParseFailure(resp.logId, resp.text);
            return { success: false, error: "อ่านจังหวะไม่สำเร็จ (รูปแบบผลลัพธ์ผิดพลาด)" };
        }

        // รอบที่สอง เฉพาะตอนที่รอบแรกตอบมาจาก Jev (ข้อความว่างเสมอ เพราะ Jev ไม่เขียนข้อความ)
        // ตัวเลขกับข้อสรุปมาแล้ว รอบนี้แค่หาคำอธิบายมาแปะ — ล้มได้ ไม่ทิ้งผลรอบแรก
        const advice = parsed.advice && !parsed.advice.text
            ? await addCoachText(ctx.text, parsed.advice, novelId)
            : parsed.advice;

        return { success: true, beats: Object.fromEntries(parsed.beats), advice };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[BeatCoach] error:", err);
        return { success: false, error: "อ่านจังหวะไม่สำเร็จ" };
    }
}

/**
 * เติมข้อความอธิบายบนข้อสรุปที่ Jev ตัดสินไว้แล้ว — LLM ห้ามเปลี่ยนข้อสรุป เขียนอย่างเดียว
 *
 * ไม่ส่ง payload jev มาด้วย callAi จึงเดิน chain LLM ปกติ แม้ฟีเจอร์จะตั้งโหมด jev ไว้
 * ยิงต่อเนื่องหลังรอบแรกจบแล้ว จึงไม่ชนกับ hasActiveRun (แถว active ถูกลบใน finally ของรอบแรก)
 */
async function addCoachText(contextText: string, advice: CoachAdvice, novelId: string): Promise<CoachAdvice> {
    try {
        const p = buildCoachTextPrompt(contextText, advice.state, advice.suggestedType);
        const resp = await callAi({
            feature: "beat-coach",
            system: p.system,
            prompt: p.user,
            responseSchema: COACH_TEXT_SCHEMA,
            novelId,
        });
        const t = parseCoachText(resp.text);
        return t ? { ...advice, text: t.text, suggestedNext: t.suggestedNext } : advice;
    } catch (err) {
        // โควตาหมด/ล้มกลางทาง — คืนข้อสรุปเปล่า ๆ ดีกว่าทิ้งจังหวะที่ได้มาแล้วทั้งฉาก
        console.error("[BeatCoach] addCoachText:", err);
        return advice;
    }
}

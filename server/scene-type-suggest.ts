"use server";

import { requireNovelAccess } from "@/lib/authz";
import { callAi, assertAiAllowed, AiControlError } from "@/lib/ai-gateway";
import {
    buildSceneTypeSuggestPrompt,
    parseSceneTypeSuggestResponse,
    SCENE_TYPE_SUGGEST_SCHEMA,
    type SceneTypeSuggestResponse,
} from "@/lib/scene-type-suggest";
import { getPlotContext } from "./plot-context";

type SuggestResult =
    | { success: true; data: SceneTypeSuggestResponse }
    | { success: false; error: string };

/** เดา sceneType+field1/field2/outcome จากโครงฉากที่มีอยู่ — ไม่ persist ลง DB
 * เป็นแค่คำแนะนำชั่วคราวให้ SceneDramaticPanel prefill ฟอร์ม คนต้องกด "บันทึกโครงฉาก" เองถึงมีผลจริง */
export async function suggestSceneType(sceneId: string, novelId: string): Promise<SuggestResult> {
    try {
        await assertAiAllowed("scene-type-suggest");
        await requireNovelAccess(novelId);

        const ctx = await getPlotContext({ consumer: "scene-type-suggest", novelId, subjectId: sceneId });
        if (ctx.sceneCount === 0) return { success: false, error: "ไม่พบฉากนี้" };

        const prompt = buildSceneTypeSuggestPrompt(ctx.text);
        const resp = await callAi({
            feature: "scene-type-suggest",
            system: prompt.system,
            prompt: prompt.user,
            responseSchema: SCENE_TYPE_SUGGEST_SCHEMA,
            novelId,
        });
        const parsed = parseSceneTypeSuggestResponse(resp.text);
        if (!parsed) return { success: false, error: "แนะนำไม่สำเร็จ (รูปแบบผลลัพธ์ผิดพลาด)" };

        return { success: true, data: parsed };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[SceneTypeSuggest] error:", err);
        return { success: false, error: "แนะนำไม่สำเร็จ" };
    }
}

"use server";

import { requireNovelAccess } from "@/lib/authz";
import { callAi, assertAiAllowed, AiControlError, logParseFailure } from "@/lib/ai-gateway";
import {
    buildSceneTypeSuggestPrompt,
    parseSceneTypeSuggestResponse,
    buildSceneTypeJev,
    buildSceneTypeFieldsPrompt,
    parseSceneTypeFields,
    SCENE_TYPE_SUGGEST_SCHEMA,
    SCENE_TYPE_FIELDS_SCHEMA,
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
            jev: buildSceneTypeJev(ctx.text),
        });
        const parsed = parseSceneTypeSuggestResponse(resp.text);
        if (!parsed) {
            await logParseFailure(resp.logId, resp.text);
            return { success: false, error: "แนะนำไม่สำเร็จ (รูปแบบผลลัพธ์ผิดพลาด)" };
        }

        // รอบสอง เฉพาะตอนที่รอบแรกมาจาก Jev (field ว่างเสมอ เพราะ Jev ไม่เขียนข้อความ)
        const data = !parsed.field1 && !parsed.field2
            ? await addSceneTypeFields(ctx.text, parsed, novelId)
            : parsed;

        return { success: true, data };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[SceneTypeSuggest] error:", err);
        return { success: false, error: "แนะนำไม่สำเร็จ" };
    }
}

/** เติม field1/field2 บนประเภทฉากที่ Jev ล็อกไว้แล้ว — ล้มได้ ไม่ทิ้งประเภท/pacing ที่ได้มา */
async function addSceneTypeFields(
    contextText: string,
    base: SceneTypeSuggestResponse,
    novelId: string,
): Promise<SceneTypeSuggestResponse> {
    try {
        const p = buildSceneTypeFieldsPrompt(contextText, base.sceneType);
        const resp = await callAi({
            feature: "scene-type-suggest",
            system: p.system,
            prompt: p.user,
            responseSchema: SCENE_TYPE_FIELDS_SCHEMA,
            novelId,
        });
        const f = parseSceneTypeFields(resp.text);
        return f ? { ...base, ...f } : base;
    } catch (err) {
        console.error("[SceneTypeSuggest] addSceneTypeFields:", err);
        return base;
    }
}

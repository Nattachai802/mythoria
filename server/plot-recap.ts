"use server";

import { db } from "@/db/drizzle";
import { timelineEvents, plotRecaps, plotFindings } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireNovelAccess } from "@/lib/authz";
import {
    RECAP_PROMPT_VERSION,
    SCENE_RECAP_SCHEMA,
    buildSceneRecapPrompt,
    buildChapterRecapPrompt,
    parseSceneRecapResponse,
    hashRecapInput,
    type SceneRecapEntry,
    type CausalityVerdict,
} from "@/lib/plot-recap";
import { callAi, assertAiAllowed, AiControlError } from "@/lib/ai-gateway";
import { buildSceneFormatForEvent } from "./plot-analysis";

type RecapResult =
    | { success: true; recap: string; title?: string; skipped: boolean; causality?: CausalityVerdict; causalityNote?: string }
    | { success: false; error: string };

/** อ่านธง causality ที่แคชไว้ (checkId="causality" ใน plot_findings — คนละตารางกับ plot_recaps
 * เพราะนี่คือ "ธงที่ยืนยันได้" ไม่ใช่ข้อความสรุปเฉย ๆ) */
async function getCausalityFinding(novelId: string, sceneId: string): Promise<{ verdict: CausalityVerdict; note: string } | null> {
    const [row] = await db
        .select({ evidence: plotFindings.evidence })
        .from(plotFindings)
        .where(and(
            eq(plotFindings.novelId, novelId),
            eq(plotFindings.checkId, "causality"),
            eq(plotFindings.subjectRef, sceneId),
        ))
        .limit(1);
    if (!row) return null;
    const ev = row.evidence as { verdict: CausalityVerdict; note: string };
    return { verdict: ev.verdict, note: ev.note };
}

/** บันทึกผลตรวจ causality — "not_stated" (ฉากไม่มี causeKind) ลบธงเก่าทิ้งแทนที่จะเก็บไว้ */
async function saveCausalityFinding(novelId: string, sceneId: string, causality: { verdict: CausalityVerdict; note: string }) {
    if (causality.verdict === "not_stated") {
        await db.delete(plotFindings).where(and(
            eq(plotFindings.novelId, novelId),
            eq(plotFindings.checkId, "causality"),
            eq(plotFindings.subjectRef, sceneId),
        ));
        return;
    }
    await db.insert(plotFindings)
        .values({
            novelId, sceneId, checkId: "causality", subjectRef: sceneId,
            evidence: causality, formatVersion: RECAP_PROMPT_VERSION,
        })
        .onConflictDoUpdate({
            target: [plotFindings.novelId, plotFindings.checkId, plotFindings.subjectRef],
            set: { evidence: causality, formatVersion: RECAP_PROMPT_VERSION, updatedAt: sql`now()` },
        });
}

/** อ่านสรุปที่แคชไว้เฉย ๆ (ไม่เรียก AI) — ใช้ SSR โหลดค่าเริ่มต้นให้ panel เหมือน getEchoFindings */
async function getCachedRecap(novelId: string, scope: "scene" | "chapter", subjectId: string): Promise<string | null> {
    await requireNovelAccess(novelId);
    const [row] = await db
        .select({ content: plotRecaps.content })
        .from(plotRecaps)
        .where(and(
            eq(plotRecaps.novelId, novelId),
            eq(plotRecaps.scope, scope),
            eq(plotRecaps.subjectId, subjectId),
        ))
        .limit(1);
    return row?.content ?? null;
}

export async function getSceneRecap(novelId: string, sceneId: string): Promise<
    { recap: string; causality?: CausalityVerdict; causalityNote?: string } | null
> {
    const recap = await getCachedRecap(novelId, "scene", sceneId);
    if (recap === null) return null;
    const causality = await getCausalityFinding(novelId, sceneId);
    return { recap, causality: causality?.verdict, causalityNote: causality?.note };
}

export async function getChapterRecap(novelId: string, chapterId: string): Promise<string | null> {
    return getCachedRecap(novelId, "chapter", chapterId);
}

/**
 * สรุปฉากเดียว — pattern เดียวกับ runEchoScore (hash เทียบก่อนยิงซ้ำ, upsert plot_recaps)
 * ต่างกันตรงไม่มี guess/judge สองรอบ เพราะเป็นงานสรุปข้อเท็จจริง ไม่ใช่วัดความคาดเดาได้
 */
export async function runSceneRecap(novelId: string, sceneId: string): Promise<RecapResult> {
    try {
        await assertAiAllowed("plot-scene-recap");
        await requireNovelAccess(novelId);

        const format = await buildSceneFormatForEvent(novelId, sceneId);
        if (!format) return { success: false, error: "ไม่พบฉากนี้" };

        const prompt = buildSceneRecapPrompt(format);
        const inputHash = hashRecapInput(prompt.user);

        const [existing] = await db
            .select()
            .from(plotRecaps)
            .where(and(
                eq(plotRecaps.novelId, novelId),
                eq(plotRecaps.scope, "scene"),
                eq(plotRecaps.subjectId, sceneId),
            ))
            .limit(1);

        if (existing?.inputHash === inputHash) {
            const cached = await getCausalityFinding(novelId, sceneId);
            return {
                success: true, recap: existing.content, title: format.scene.title, skipped: true,
                causality: cached?.verdict, causalityNote: cached?.note,
            };
        }

        const resp = await callAi({
            feature: "plot-scene-recap",
            system: prompt.system,
            prompt: prompt.user,
            responseSchema: SCENE_RECAP_SCHEMA,
            novelId,
        });
        const parsed = parseSceneRecapResponse(resp.text);
        if (!parsed) return { success: false, error: "สรุปฉากไม่สำเร็จ (รูปแบบผลลัพธ์ผิดพลาด)" };

        const content = parsed.recap.trim();

        await db.insert(plotRecaps)
            .values({
                novelId, scope: "scene", subjectId: sceneId, content,
                model: resp.model, promptVersion: RECAP_PROMPT_VERSION, inputHash,
            })
            .onConflictDoUpdate({
                target: [plotRecaps.novelId, plotRecaps.scope, plotRecaps.subjectId],
                set: { content, model: resp.model, promptVersion: RECAP_PROMPT_VERSION, inputHash },
            });

        await saveCausalityFinding(novelId, sceneId, parsed.causality);

        return {
            success: true, recap: content, title: format.scene.title, skipped: false,
            causality: parsed.causality.verdict, causalityNote: parsed.causality.note,
        };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[PlotRecap] scene recap error:", err);
        return { success: false, error: "สรุปฉากไม่สำเร็จ" };
    }
}

/** ดึงสรุปฉากที่แคชไว้ ถ้ายังไม่มีให้สร้างสด (ผ่าน runSceneRecap เอง — hash-check ในตัวอยู่แล้ว) */
async function getOrCreateSceneRecap(novelId: string, sceneId: string): Promise<SceneRecapEntry | null> {
    const result = await runSceneRecap(novelId, sceneId);
    if (!result.success) return null;
    return { title: result.title ?? "", recap: result.recap };
}

/**
 * สรุปทั้งบท — สังเคราะห์จากสรุปฉากทุกฉากในบท (สร้างสดให้ฉากที่ยังไม่เคยสรุป)
 * ฉากไหนสรุปไม่สำเร็จ ข้ามฉากนั้นไป ไม่ทำให้ทั้งบทพัง
 */
export async function runChapterRecap(novelId: string, chapterId: string): Promise<RecapResult> {
    try {
        await assertAiAllowed("plot-chapter-recap");
        await requireNovelAccess(novelId);

        const events = await db.query.timelineEvents.findMany({
            where: and(
                eq(timelineEvents.relatedChapterId, chapterId),
                eq(timelineEvents.novelId, novelId),
            ),
            columns: { id: true, title: true },
            orderBy: (e, { asc }) => [asc(e.orderIndex)],
        });

        if (events.length === 0) return { success: false, error: "บทนี้ยังไม่มีฉาก" };

        const sceneEntries: SceneRecapEntry[] = [];
        for (const ev of events) {
            const entry = await getOrCreateSceneRecap(novelId, ev.id);
            if (entry) sceneEntries.push(entry);
        }

        if (sceneEntries.length === 0) return { success: false, error: "สรุปฉากไม่สำเร็จสักฉากในบทนี้" };

        const prompt = buildChapterRecapPrompt(sceneEntries);
        const inputHash = hashRecapInput(prompt.user);

        const [existing] = await db
            .select()
            .from(plotRecaps)
            .where(and(
                eq(plotRecaps.novelId, novelId),
                eq(plotRecaps.scope, "chapter"),
                eq(plotRecaps.subjectId, chapterId),
            ))
            .limit(1);

        if (existing?.inputHash === inputHash) {
            return { success: true, recap: existing.content, skipped: true };
        }

        const resp = await callAi({
            feature: "plot-chapter-recap",
            system: prompt.system,
            prompt: prompt.user,
            novelId,
        });
        const content = resp.text.trim();

        await db.insert(plotRecaps)
            .values({
                novelId, scope: "chapter", subjectId: chapterId, content,
                model: resp.model, promptVersion: RECAP_PROMPT_VERSION, inputHash,
            })
            .onConflictDoUpdate({
                target: [plotRecaps.novelId, plotRecaps.scope, plotRecaps.subjectId],
                set: { content, model: resp.model, promptVersion: RECAP_PROMPT_VERSION, inputHash },
            });

        return { success: true, recap: content, skipped: false };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("[PlotRecap] chapter recap error:", err);
        return { success: false, error: "สรุปบทไม่สำเร็จ" };
    }
}

"use server";

import { db } from "@/db/drizzle";
import { chapters, plotRecaps, timelineEvents } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { renderSceneMarkdown } from "@/lib/story-format";
import {
    PLOT_CONTEXT_CONSUMERS,
    renderChapterDigest,
    renderSceneDigestDoc,
    type DigestScene,
    type PlotContextResult,
} from "@/lib/plot-context";
import { buildSceneFormatForEvent } from "./plot-analysis";
import { getChapterOverview } from "./chapter-overview";

/**
 * ประตูเดียวสำหรับดึง "บริบทกระดานพล็อต" ไปป้อน LLM — คู่ขนานกับ callAi ใน lib/ai-gateway.ts
 * (ที่นั่นคุมว่ายิงโมเดลไหน ที่นี่คุมว่าป้อนเนื้ออะไรเข้าไป)
 *
 * ฟีเจอร์ใหม่ที่อยากอ่านการ์ดไอเดีย: ประกาศหนึ่งแถวใน PLOT_CONTEXT_CONSUMERS แล้วเรียกตัวนี้
 * ห้ามไปประกอบ query เอง — ไม่งั้นได้ reader ซ้ำอีกตัวเหมือนที่เคยเกิดกับ pacing-ai-suggest
 *
 * หมายเหตุ authz: ตัวนี้ไม่เช็คสิทธิ์เอง (เหมือน callAi) ผู้เรียกต้อง requireNovelAccess
 * มาก่อนเสมอ — แยกกันไว้กัน query สิทธิ์ซ้ำสองรอบในทุกฟีเจอร์
 */
export async function getPlotContext(params: {
    /** key เดียวกับใน PLOT_CONTEXT_CONSUMERS (= key ใน AI_FEATURES) */
    consumer: string;
    novelId: string;
    /** sceneId หรือ chapterId แล้วแต่ scope ที่ประกาศไว้ */
    subjectId: string;
    /** ชื่อบท/ฉาก ถ้าผู้เรียกมีติดมืออยู่แล้ว — กัน query ซ้ำ */
    subjectTitle?: string;
}): Promise<PlotContextResult> {
    const { consumer, novelId, subjectId, subjectTitle } = params;
    const cfg = PLOT_CONTEXT_CONSUMERS[consumer];
    if (!cfg) {
        throw new Error(`[PlotContext] ไม่รู้จัก consumer "${consumer}" — ประกาศใน lib/plot-context.ts ก่อน`);
    }
    const base = { level: cfg.level, scope: cfg.scope };
    const digestOpts = { hideUserPacing: cfg.hideUserPacing };

    // ── ระดับฉากเดียว ──
    if (cfg.scope === "scene") {
        if (cfg.level === "full") {
            const format = await buildSceneFormatForEvent(novelId, subjectId);
            if (!format) return { ...base, text: "", format: null, sceneCount: 0 };
            return { ...base, text: renderSceneMarkdown(format), format, sceneCount: 1 };
        }

        // digest/recap ระดับฉาก: ต้องใช้ pacing/sceneType ของทั้งฉากและการ์ดไอเดีย ซึ่ง SceneFormat
        // ไม่มี (การ์ดไอเดียเก็บค่าพวกนี้ในตาราง ideas คนละที่กับ canvasData)
        //
        // ponytail: ยืม loader ของทั้งบทมาแล้วหยิบฉากเดียว — โหลดเกินจริงระดับ DB (ทั้งบท)
        // แต่ token ที่ส่ง LLM เหลือฉากเดียวตามต้องการ ถ้าวันไหน DB กลายเป็นคอขวด
        // ค่อยเขียน loader เฉพาะฉาก (query timelineEvent + join ideas ตาม referenceId)
        const [ev] = await db
            .select({ chapterId: timelineEvents.relatedChapterId })
            .from(timelineEvents)
            .where(and(eq(timelineEvents.id, subjectId), eq(timelineEvents.novelId, novelId)))
            .limit(1);
        if (!ev?.chapterId) return { ...base, text: "", format: null, sceneCount: 0 };

        const chapterOverview = await getChapterOverview(ev.chapterId);
        if (!chapterOverview.success || !chapterOverview.events?.length) {
            return { ...base, text: "", format: null, sceneCount: 0 };
        }
        const all = chapterOverview.events;
        const at = all.findIndex((e: any) => e.id === subjectId);
        if (at < 0) return { ...base, text: "", format: null, sceneCount: 0 };

        const recap = cfg.level === "recap" ? await readSceneRecaps(novelId, [subjectId]) : new Map<string, string>();
        const scene = toDigestScene(all[at], recap);
        const title = subjectTitle ?? (await readChapterTitle(ev.chapterId));
        return {
            ...base,
            text: renderSceneDigestDoc(title, scene, { index: at + 1, total: all.length }, digestOpts),
            format: null,
            sceneCount: 1,
        };
    }

    // ── ระดับทั้งบท ──
    // ไม่วน buildSceneFormatForEvent ทีละฉาก เพราะตัวนั้น query threads/beats ทั้งนิยายใหม่ทุกครั้ง
    // (N ฉาก = N รอบ) — getChapterOverview ดึงทั้งบท + join ideas ครบในไม่กี่ query
    const overview = await getChapterOverview(subjectId);
    if (!overview.success || !overview.events?.length) {
        return { ...base, text: "", format: null, sceneCount: 0 };
    }
    const events = overview.events;

    const recapBySceneId = cfg.level === "recap"
        ? await readSceneRecaps(novelId, events.map((e: any) => e.id))
        : new Map<string, string>();

    const scenes = events.map((e: any) => toDigestScene(e, recapBySceneId));
    const title = subjectTitle ?? (await readChapterTitle(subjectId));

    return { ...base, text: renderChapterDigest(title, scenes, digestOpts), format: null, sceneCount: scenes.length };
}

/** แถวจาก getChapterOverview → รูปที่ renderer กิน (ที่เดียว กัน mapping เพี้ยนระหว่าง scope) */
function toDigestScene(e: any, recapBySceneId: Map<string, string>): DigestScene {
    return {
        id: e.id,
        title: e.title,
        sceneType: e.sceneType,
        sceneTone: e.sceneTone,
        pacing: e.pacing,
        goal: e.sceneGoal,
        conflict: e.sceneConflict,
        outcome: e.sceneOutcome,
        recap: recapBySceneId.get(e.id) ?? null,
        beats: (e.subBeats ?? []).map((b: any) => ({
            id: b.id,
            title: b.title,
            sceneType: b.sceneType,
            pacing: b.pacing,
            content: b.content,
        })),
    };
}

/** อ่านสรุปฉากที่เคยเขียนไว้ — อ่านอย่างเดียว ไม่ยิง AI ใหม่
 * ฉากที่ยังไม่เคยกดสรุปก็แค่ไม่มีบรรทัดสรุป ไม่ต้องมี fallback path แยก */
async function readSceneRecaps(novelId: string, sceneIds: string[]): Promise<Map<string, string>> {
    if (sceneIds.length === 0) return new Map();
    const rows = await db
        .select({ subjectId: plotRecaps.subjectId, content: plotRecaps.content })
        .from(plotRecaps)
        .where(and(
            eq(plotRecaps.novelId, novelId),
            eq(plotRecaps.scope, "scene"),
            inArray(plotRecaps.subjectId, sceneIds),
        ));
    return new Map(rows.map(r => [r.subjectId, r.content]));
}

async function readChapterTitle(chapterId: string): Promise<string> {
    const [row] = await db.select({ title: chapters.title }).from(chapters).where(eq(chapters.id, chapterId)).limit(1);
    return row?.title ?? "";
}

"use server";

import { db } from "@/db/drizzle";
import {
    timelineEvents, chapters, plotThreads, plotThreadBeats, plotThreadPoints, plotThreadLinks, plotFindings,
} from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
import { requireNovelAccess } from "@/lib/authz";
import { callAi, assertAiAllowed, AiControlError } from "@/lib/ai-gateway";
import { buildGuessPrompt, buildJudgePrompt, parseGuessResponse, parseJudgeResponse, ECHO_GUESS_SCHEMA, ECHO_JUDGE_SCHEMA } from "@/lib/echo-score";
import { buildCardSequence, parseCanvasItems, threadJourney, type JourneyThreadInput } from "@/lib/thread-journey";
import {
    buildFairnessDossier, buildChecklistPrompt, parseChecklist, classifyPayoff, hashFairnessInput,
    FAIRNESS_CHECKLIST_SCHEMA, FAIRNESS_K, FAIRNESS_PROMPT_VERSION,
    type DossierCard, type FairnessEvidence,
} from "@/lib/thread-fairness-ai";

const FEATURE = "thread-fairness";
const CHECK_ID = "thread_fairness";

export type FairnessResult =
    | { success: true; evidence: FairnessEvidence; analyzedAt: string; stale: boolean }
    | { success: false; error: string };

/** โหลดปมทั้งนิยาย + ลำดับการ์ด แล้วประกอบแฟ้มของปมเป้าหมาย */
async function loadDossier(novelId: string, threadId: string) {
    const threads = await db.select().from(plotThreads).where(eq(plotThreads.novelId, novelId));
    const target = threads.find(t => t.id === threadId);
    if (!target) return { error: "ไม่พบปมในนิยายนี้" as const };

    const ids = threads.map(t => t.id);
    const [beats, points, links, events, chs] = await Promise.all([
        db.select().from(plotThreadBeats).where(inArray(plotThreadBeats.threadId, ids)),
        db.select().from(plotThreadPoints).where(eq(plotThreadPoints.threadId, threadId))
            .orderBy(asc(plotThreadPoints.orderIndex), asc(plotThreadPoints.createdAt)),
        db.select().from(plotThreadLinks).where(inArray(plotThreadLinks.fromThreadId, ids)),
        db.select({
            id: timelineEvents.id, title: timelineEvents.title, orderIndex: timelineEvents.orderIndex,
            relatedChapterId: timelineEvents.relatedChapterId, canvasData: timelineEvents.canvasData,
        }).from(timelineEvents).where(eq(timelineEvents.novelId, novelId)),
        db.select({ id: chapters.id, title: chapters.title, orderIndex: chapters.orderIndex })
            .from(chapters).where(eq(chapters.novelId, novelId)),
    ]);

    const asInput = (t: typeof threads[number]): JourneyThreadInput => ({
        id: t.id, title: t.title, parentThreadId: t.parentThreadId,
        beats: beats.filter(b => b.threadId === t.id)
            .map(b => ({ id: b.id, eventId: b.eventId, canvasItemId: b.canvasItemId, role: b.role, pointId: b.pointId, tension: b.tension })),
        points: t.id === threadId ? points.map(p => ({ id: p.id, text: p.text, status: p.status })) : [],
        links: links.filter(l => l.fromThreadId === t.id).map(l => ({ toThreadId: l.toThreadId, kind: l.kind })),
    });
    const all = threads.map(asInput);
    const journey = threadJourney(all.find(t => t.id === threadId)!, all, buildCardSequence(events, chs));

    // การ์ด id → ชื่อ/เนื้อ (เฉพาะฉากที่ปมนี้แตะ)
    const touched = new Set(journey.stops.map(s => s.beat.eventId));
    const cardById = new Map<string, DossierCard>();
    for (const ev of events) {
        if (!touched.has(ev.id)) continue;
        for (const it of parseCanvasItems(ev.canvasData).items) {
            cardById.set(it.id, { title: (it.title as string) || "(การ์ดไม่มีชื่อ)", content: (it.content as string) ?? null });
        }
    }
    const dossier = buildFairnessDossier(
        { title: target.title, summary: target.summary, points: points.map(p => ({ id: p.id, text: p.text, status: p.status })) },
        journey,
        s => (s.beat.canvasItemId ? cardById.get(s.beat.canvasItemId) ?? null : null),
    );
    if (!dossier) return { error: "ปมนี้ยังไม่มีการ์ดเฉลย — ผูกการ์ดเฉลยก่อนถึงจะตรวจได้" as const };
    return { dossier, noSummary: !target.summary?.trim() };
}

async function readSaved(novelId: string, threadId: string) {
    const [row] = await db
        .select({ evidence: plotFindings.evidence, updatedAt: plotFindings.updatedAt })
        .from(plotFindings)
        .where(and(eq(plotFindings.novelId, novelId), eq(plotFindings.checkId, CHECK_ID), eq(plotFindings.subjectRef, threadId)))
        .limit(1);
    return row ? { evidence: row.evidence as FairnessEvidence, updatedAt: row.updatedAt } : null;
}

/** ผลที่เคยตรวจไว้ + การ์ดเปลี่ยนไปแล้วหรือยัง — null = ยังไม่เคยตรวจ (ไม่เรียก AI) */
export async function getThreadFairness(novelId: string, threadId: string): Promise<FairnessResult | null> {
    try {
        await requireNovelAccess(novelId);
        const saved = await readSaved(novelId, threadId);
        if (!saved) return null;
        const loaded = await loadDossier(novelId, threadId);
        const stale = "error" in loaded || hashFairnessInput(loaded.dossier) !== saved.evidence.inputHash;
        return { success: true, evidence: saved.evidence, analyzedAt: saved.updatedAt.toISOString(), stale };
    } catch (err) {
        console.error("getThreadFairness error:", err);
        return null;
    }
}

/**
 * ตรวจการเฉลยของปม — เรียก AI 3 ครั้งต่อกัน: ทาย K ข้อ (call เดียว) → ตัดสิน → เช็คลิสต์
 * input ไม่เปลี่ยนและไม่ force = คืนผลเดิม ไม่เรียก AI
 */
export async function runThreadFairness(novelId: string, threadId: string, force = false): Promise<FairnessResult> {
    try {
        try {
            await assertAiAllowed(FEATURE);
        } catch (e) {
            return { success: false, error: e instanceof AiControlError ? e.message : "ใช้ AI ไม่ได้" };
        }
        await requireNovelAccess(novelId);

        const loaded = await loadDossier(novelId, threadId);
        if ("error" in loaded) return { success: false, error: loaded.error! };
        const { dossier, noSummary } = loaded;
        const inputHash = hashFairnessInput(dossier);

        const saved = await readSaved(novelId, threadId);
        if (!force && saved?.evidence.inputHash === inputHash) {
            return { success: true, evidence: saved.evidence, analyzedAt: saved.updatedAt.toISOString(), stale: false };
        }

        // ── 1. ทาย K ข้อใน call เดียว (temp สูง) ──
        const gp = buildGuessPrompt(dossier.prefixText, FAIRNESS_K);
        const guessResp = await callAi({
            feature: FEATURE, system: gp.system, prompt: gp.user,
            responseSchema: ECHO_GUESS_SCHEMA, temperature: 1.0, maxTokens: 400, novelId,
        });
        const guesses = (parseGuessResponse(guessResp.text) ?? []).slice(0, FAIRNESS_K);
        if (guesses.length === 0) return { success: false, error: "AI ทายต่อไม่สำเร็จ ลองใหม่อีกครั้ง" };

        // ── 2. ตัดสิน → 3. เช็คลิสต์ (ทีละตัว) ──
        // ห้าม Promise.all: gateway กันยิงซ้อนต่อ feature (ai_active_runs) ตัวที่สองจะโดน "busy"
        const jp = buildJudgePrompt(dossier.prefixText, dossier.payoffText, guesses);
        const judgeResp = await callAi({ feature: FEATURE, system: jp.system, prompt: jp.user, responseSchema: ECHO_JUDGE_SCHEMA, temperature: 0, maxTokens: 400, novelId });
        const cp = buildChecklistPrompt(dossier.checklistText, guesses);
        const checkResp = await callAi({ feature: FEATURE, system: cp.system, prompt: cp.user, responseSchema: FAIRNESS_CHECKLIST_SCHEMA, temperature: 0.2, maxTokens: 400, novelId });
        const judged = parseJudgeResponse(judgeResp.text);
        const checklist = parseChecklist(checkResp.text);
        if (!judged || !checklist) return { success: false, error: "AI ตอบผิดรูปแบบ ลองใหม่อีกครั้ง" };

        // index นอกช่วงทิ้ง กันโมเดลอ้างคำทายที่ไม่มี
        const matched = judged.matched.filter(m => m.index >= 0 && m.index < guesses.length);
        const hits = new Set(matched.map(m => m.index)).size;

        const evidence: FairnessEvidence = {
            hits, k: guesses.length, guesses, matched, checklist,
            label: classifyPayoff(hits, guesses.length, checklist),
            models: { guess: guessResp.model, judge: judgeResp.model, checklist: checkResp.model },
            promptVersion: FAIRNESS_PROMPT_VERSION,
            inputHash,
            usedStops: dossier.usedStops,
            droppedStops: dossier.droppedStops,
            payoffIsThin: dossier.payoffIsThin,
            noSummary,
        };

        const now = new Date();
        try {
            await db.insert(plotFindings)
                .values({ novelId, sceneId: null, checkId: CHECK_ID, subjectRef: threadId, evidence, formatVersion: FAIRNESS_PROMPT_VERSION })
                .onConflictDoUpdate({
                    target: [plotFindings.novelId, plotFindings.checkId, plotFindings.subjectRef],
                    set: { evidence, formatVersion: FAIRNESS_PROMPT_VERSION, updatedAt: now },
                });
        } catch (err) {
            // บันทึกล้มไม่ทิ้งผลที่จ่าย token ไปแล้ว
            console.error("[ThreadFairness] save:", err);
        }
        return { success: true, evidence, analyzedAt: now.toISOString(), stale: false };
    } catch (err) {
        if (err instanceof AiControlError) return { success: false, error: err.message };
        console.error("runThreadFairness error:", err);
        return { success: false, error: "ตรวจการเฉลยไม่สำเร็จ" };
    }
}

"use server";

import { db } from "@/db/drizzle";
import {
    timelineEvents,
    plotThreads,
    plotThreadBeats,
    sceneElementDetails,
    plotFindings,
    plotRecaps,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireNovelAccess } from "@/lib/authz";
import { buildSceneFormat, type SceneFormat, type SceneFormatInput } from "@/lib/story-format";
import {
    analyzePlot,
    type PlotAnalysisReport,
    type CoverageInput,
} from "@/lib/plot-analysis";
import {
    ECHO_PROMPT_VERSION,
    ECHO_K,
    ECHO_MODEL,
    ECHO_GUESS_SCHEMA,
    ECHO_JUDGE_SCHEMA,
    buildPrefixText,
    buildCardText,
    hashEchoInput,
    buildGuessPrompt,
    buildJudgePrompt,
    filterEchoTargets,
    parseGuessResponse,
    parseJudgeResponse,
    type EchoEvidence,
    type EchoFinding,
} from "@/lib/echo-score";
import { callAi, assertAiAllowed, AiControlError } from "@/lib/ai-gateway";

// ─── Shared helpers ─────────────────────────────────────────────────────

/** ดึง canvasData ของ event หนึ่งแล้วแยก items / lanes */
function parseCanvasData(canvasData: unknown): {
    items: any[];
    lanes: Array<{ id: string; name: string }>;
} {
    const raw: any[] = Array.isArray(canvasData) ? (canvasData as any[]) : [];
    const laneItems = raw.filter((it: any) => it.type === "lane");
    const lanes: Array<{ id: string; name: string }> = laneItems
        .map((l: any) => ({ id: l.id, name: l.name || "เลน" }))
        .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const items = raw.filter(
        (it: any) => it.type !== "lane" && it.type !== "group" && it.type !== "chapter",
    );
    return { items, lanes };
}

/**
 * ดึง event หนึ่ง + threads/beats + sceneElementDetails ทั้งหมดที่ต้องใช้ → buildSceneFormat
 * แยกออกมาจาก runEchoScore เพื่อให้ server/plot-recap.ts เรียกใช้ซ้ำได้ (สรุปฉากต้องการ
 * SceneFormat ตัวเดียวกันเป๊ะ ไม่ใช่คำนวณใหม่คนละแบบ) — null = ไม่พบฉากนี้ในนิยายนี้
 */
export async function buildSceneFormatForEvent(novelId: string, sceneId: string): Promise<SceneFormat | null> {
    const event = await db.query.timelineEvents.findFirst({
        where: and(
            eq(timelineEvents.id, sceneId),
            eq(timelineEvents.novelId, novelId),
        ),
        columns: {
            id: true,
            title: true,
            sceneGoal: true,
            sceneConflict: true,
            sceneOutcome: true,
            causeKind: true,
            causeNote: true,
            description: true,
            canvasData: true,
        },
    });

    if (!event) return null;

    const allThreads = await db.query.plotThreads.findMany({
        where: eq(plotThreads.novelId, novelId),
    });
    const allBeats = allThreads.length > 0
        ? await db.query.plotThreadBeats.findMany({
            where: inArray(plotThreadBeats.threadId, allThreads.map(t => t.id)),
        })
        : [];

    const threadsForFormat: SceneFormatInput["threads"] = allThreads.map(t => ({
        id: t.id, title: t.title, status: t.status, color: t.color,
        beats: allBeats.filter(b => b.threadId === t.id).map(b => ({
            id: b.id, eventId: b.eventId, canvasItemId: b.canvasItemId, role: b.role,
        })),
    }));

    const details = await db.query.sceneElementDetails.findMany({
        where: eq(sceneElementDetails.sceneId, sceneId),
        columns: { canvasItemId: true, action: true, goal: true, outcome: true },
    });
    const elementDetails = new Map<string, { action?: string | null; goal?: string | null; outcome?: string | null }>();
    for (const d of details) {
        if (d.canvasItemId) elementDetails.set(d.canvasItemId, { action: d.action, goal: d.goal, outcome: d.outcome });
    }

    const { items, lanes } = parseCanvasData(event.canvasData);
    return buildSceneFormat({
        event: {
            id: event.id, title: event.title, sceneGoal: event.sceneGoal,
            sceneConflict: event.sceneConflict, sceneOutcome: event.sceneOutcome,
            causeKind: event.causeKind, causeNote: event.causeNote, description: event.description,
        },
        items, lanes, threads: threadsForFormat,
        eventId: event.id, elementDetails, ideaNotes: [],
    });
}

// ─── getPlotAnalysis ───────────────────────────────────────────────────────

/**
 * ดึงข้อมูลทั้งนิยาย → ประกอบ SceneFormat → วิเคราะห์ → merge verdicts
 * ไม่แคช — Phase 1 เป็นเลขคณิตล้วน ไม่มีต้นทุนพิเศษ
 */
export async function getPlotAnalysis(novelId: string): Promise<
    | { success: true; report: PlotAnalysisReport; verdicts: Record<string, string | null> }
    | { success: false; error: string }
> {
    try {
        await requireNovelAccess(novelId);

        // ── 1. ดึงทุกฉากพร้อม canvasData ─────────────────────────────────
        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.novelId, novelId),
            columns: {
                id: true,
                title: true,
                sceneGoal: true,
                sceneConflict: true,
                sceneOutcome: true,
                causeKind: true,
                causeNote: true,
                description: true,
                storyTimeIndex: true,
                storyDuration: true,
                povCharacterId: true,
                canvasData: true,
            },
            orderBy: (e, { asc }) => [asc(e.orderIndex)],
        });

        if (events.length === 0) {
            const empty = analyzePlot([], { scenes: [], threads: [] });
            return { success: true, report: empty, verdicts: {} };
        }

        // ── 2. ดึง threads + beats ทั้งนิยาย ──────────────────────────────
        const allThreads = await db.query.plotThreads.findMany({
            where: eq(plotThreads.novelId, novelId),
        });

        const allBeats = allThreads.length > 0
            ? await db.query.plotThreadBeats.findMany({
                where: inArray(plotThreadBeats.threadId, allThreads.map(t => t.id)),
            })
            : [];

        const threadsForFormat: SceneFormatInput["threads"] = allThreads.map(t => ({
            id: t.id,
            title: t.title,
            status: t.status,
            color: t.color,
            beats: allBeats
                .filter(b => b.threadId === t.id)
                .map(b => ({
                    id: b.id,
                    eventId: b.eventId,
                    canvasItemId: b.canvasItemId,
                    role: b.role,
                })),
        }));

        // ── 3. ดึง sceneElementDetails ทุกฉาก ────────────────────────────
        const allDetails = events.length > 0
            ? await db.query.sceneElementDetails.findMany({
                where: inArray(sceneElementDetails.sceneId, events.map(e => e.id)),
                columns: {
                    sceneId: true,
                    canvasItemId: true,
                    action: true,
                    goal: true,
                    outcome: true,
                },
            })
            : [];

        const detailsByScene = new Map<string, Map<string, { action?: string | null; goal?: string | null; outcome?: string | null }>>();
        for (const d of allDetails) {
            if (!d.canvasItemId) continue;
            if (!detailsByScene.has(d.sceneId)) detailsByScene.set(d.sceneId, new Map());
            detailsByScene.get(d.sceneId)!.set(d.canvasItemId, {
                action: d.action, goal: d.goal, outcome: d.outcome,
            });
        }

        // ── 4. ประกอบ SceneFormat ทีละฉาก ────────────────────────────────
        const scenes = events.map(event => {
            const { items, lanes } = parseCanvasData(event.canvasData);
            const elementDetails = detailsByScene.get(event.id) ?? new Map();
            const input: SceneFormatInput = {
                event: {
                    id: event.id,
                    title: event.title,
                    sceneGoal: event.sceneGoal,
                    sceneConflict: event.sceneConflict,
                    sceneOutcome: event.sceneOutcome,
                    causeKind: event.causeKind,
                    causeNote: event.causeNote,
                    description: event.description,
                },
                items, lanes, threads: threadsForFormat,
                eventId: event.id, elementDetails, ideaNotes: [],
            };
            return buildSceneFormat(input);
        });

        // ── 5. ประกอบ CoverageInput ───────────────────────────────────────
        const coverageInput: CoverageInput = {
            scenes: events.map(event => {
                const { items } = parseCanvasData(event.canvasData);
                const cardCount = items.filter((it: any) => it.type !== "sticky-note").length;
                const keyMomentCount = items.filter(
                    (it: any) => it.keyMomentLabel && it.keyMomentLabel !== "",
                ).length;
                return {
                    id: event.id,
                    hasSceneGoal: !!event.sceneGoal,
                    hasStoryTimeIndex: event.storyTimeIndex != null,
                    hasStoryDuration: event.storyDuration != null,
                    hasPovCharacterId: !!event.povCharacterId,
                    keyMomentCount,
                    cardCount,
                };
            }),
            threads: allThreads.map(t => ({
                id: t.id,
                boundBeatCount: allBeats.filter(
                    b => b.threadId === t.id && b.canvasItemId != null,
                ).length,
            })),
        };

        // ── 6. วิเคราะห์ ──────────────────────────────────────────────────
        const report = analyzePlot(scenes, coverageInput);

        // ── 7. ดึง verdicts ที่เคย save ไว้ ──────────────────────────────
        const savedFindings = await db
            .select({ checkId: plotFindings.checkId, subjectRef: plotFindings.subjectRef, verdict: plotFindings.verdict })
            .from(plotFindings)
            .where(eq(plotFindings.novelId, novelId));

        const verdicts: Record<string, string | null> = {};
        for (const f of savedFindings) {
            verdicts[`${f.checkId}:${f.subjectRef}`] = f.verdict;
        }

        return { success: true, report, verdicts };
    } catch (error) {
        console.error("getPlotAnalysis error:", error);
        return { success: false, error: "วิเคราะห์พล็อตไม่สำเร็จ" };
    }
}

// ─── setPlotFindingVerdict ────────────────────────────────────────────────

export async function setPlotFindingVerdict(
    novelId: string,
    checkId: string,
    subjectRef: string,
    verdict: "real" | "not_real" | "irrelevant" | null,
    evidence: Record<string, unknown> = {},
    formatVersion: string = "1",
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireNovelAccess(novelId);

        if (verdict === null) {
            await db.delete(plotFindings).where(
                and(
                    eq(plotFindings.novelId, novelId),
                    eq(plotFindings.checkId, checkId),
                    eq(plotFindings.subjectRef, subjectRef),
                ),
            );
        } else {
            await db
                .insert(plotFindings)
                .values({ novelId, checkId, subjectRef, verdict, evidence, formatVersion })
                .onConflictDoUpdate({
                    target: [plotFindings.novelId, plotFindings.checkId, plotFindings.subjectRef],
                    set: { verdict, evidence, formatVersion, updatedAt: new Date() },
                });
        }

        return { success: true };
    } catch (error) {
        console.error("setPlotFindingVerdict error:", error);
        return { success: false, error: "บันทึก verdict ไม่สำเร็จ" };
    }
}

// ─── runEchoScore ─────────────────────────────────────────────────────────

/**
 * คำนวณ Echo Score ของฉากหนึ่ง — เรียก LLM (Gemini 2.5 Flash) K+1 ครั้งต่อการ์ด
 *
 * กระบวนการ:
 * 1. ดึง canvasData → buildSceneFormat → ได้ beats
 * 2. filter เฉพาะ beat ที่ตรวจได้ (ไม่ใช่ board note, มี title, ไม่ใช่ beat แรก)
 * 3. ต่อการ์ดแต่ละใบ:
 *    a. คำนวณ inputHash เทียบกับ DB — ถ้าตรง: ข้าม
 *    b. เรียก LLM สุ่ม K เดา
 *    c. เรียก LLM ตัดสินว่าตรงกี่ครั้ง
 *    d. upsert plot_findings (checkId="echo")
 */
/** รายชื่อการ์ดที่ตรวจ Echo Score ได้ในฉากนี้ — ไม่เรียก AI ใช้สำหรับแสดงความคืบหน้าตอนตรวจทีละใบ */
export async function listEchoTargets(
    novelId: string,
    sceneId: string,
): Promise<
    | { success: true; targets: { id: string; code: string; title: string }[] }
    | { success: false; error: string }
> {
    try {
        await requireNovelAccess(novelId);
        const sceneFormat = await buildSceneFormatForEvent(novelId, sceneId);
        if (!sceneFormat) return { success: false, error: "ไม่พบฉากนี้" };
        const targets = filterEchoTargets(sceneFormat.beats);
        return { success: true, targets: targets.map(t => ({ id: t.id, code: t.code, title: t.title })) };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "เกิดข้อผิดพลาด" };
    }
}

/**
 * สรุปฉากก่อนหน้าทั้งเรื่อง (เท่าที่มีอยู่แล้วใน plot_recaps) — ไม่เรียก AI ไม่สร้างสรุปใหม่
 * ให้ guesser เห็นภาพรวมทั้งเรื่อง ไม่ใช่แค่ฉากนี้ (lib/echo-score.ts ECHO_PROMPT_VERSION v3)
 *
 * ไม่เรียกผ่าน getSceneRecap (server/plot-recap.ts) เพราะไฟล์นั้น import buildSceneFormatForEvent
 * จากไฟล์นี้อยู่แล้ว — import กลับจะเกิด circular dependency ระหว่างสอง server action module
 * จึง query ตรงเองแทน (สั้นพอที่ไม่คุ้มรื้อ boundary)
 */
async function getPriorScenesContext(
    novelId: string,
    sceneId: string,
): Promise<{ contextText: string; covered: number; total: number }> {
    const events = await db.query.timelineEvents.findMany({
        where: eq(timelineEvents.novelId, novelId),
        columns: { id: true, title: true, orderIndex: true },
        orderBy: (e, { asc }) => [asc(e.orderIndex)],
    });
    const current = events.find(e => e.id === sceneId);
    if (!current) return { contextText: "", covered: 0, total: 0 };

    const priorEvents = events.filter(e => e.orderIndex < current.orderIndex);
    if (priorEvents.length === 0) return { contextText: "", covered: 0, total: 0 };

    const recaps = await db
        .select({ subjectId: plotRecaps.subjectId, content: plotRecaps.content })
        .from(plotRecaps)
        .where(and(
            eq(plotRecaps.novelId, novelId),
            eq(plotRecaps.scope, "scene"),
            inArray(plotRecaps.subjectId, priorEvents.map(e => e.id)),
        ));
    const recapById = new Map(recaps.map(r => [r.subjectId, r.content]));

    const covered = priorEvents.filter(e => recapById.has(e.id)).length;
    const contextText = priorEvents
        .map((e, i) => {
            const recap = recapById.get(e.id);
            return recap ? `[ฉากที่ ${i + 1}] ${e.title}\n${recap}` : null;
        })
        .filter((s): s is string => !!s)
        .join("\n\n");

    return { contextText, covered, total: priorEvents.length };
}

export async function runEchoScore(
    novelId: string,
    sceneId: string,
    cardIds?: string[],
): Promise<
    | { success: true; findings: EchoFinding[]; skipped: number }
    | { success: false; error: string }
> {
    try {
        try {
            await assertAiAllowed("echo-score");
        } catch (e) {
            return { success: false, error: e instanceof AiControlError ? e.message : "ใช้ AI ไม่ได้" };
        }
        await requireNovelAccess(novelId);

        const sceneFormat = await buildSceneFormatForEvent(novelId, sceneId);
        if (!sceneFormat) return { success: false, error: "ไม่พบฉากนี้" };

        const beats = sceneFormat.beats;
        const allTargets = filterEchoTargets(beats);
        const targets = cardIds ? allTargets.filter(b => cardIds.includes(b.id)) : allTargets;

        if (targets.length === 0) {
            return { success: true, findings: [], skipped: 0 };
        }

        // สรุปฉากก่อนหน้าทั้งเรื่อง — เหมือนกันทุกการ์ดในฉากนี้ ดึงครั้งเดียวพอ
        const priorScenes = await getPriorScenesContext(novelId, sceneId);
        const priorCoverage = priorScenes.total > 0
            ? { covered: priorScenes.covered, total: priorScenes.total }
            : undefined;

        // ── 5. ดึง echo findings เดิม (สำหรับ hash check) ─────────────────
        const existing = await db
            .select({
                subjectRef: plotFindings.subjectRef,
                evidence: plotFindings.evidence,
            })
            .from(plotFindings)
            .where(
                and(
                    eq(plotFindings.novelId, novelId),
                    eq(plotFindings.checkId, "echo"),
                    eq(plotFindings.sceneId, sceneId),
                ),
            );

        const existingByRef = new Map<string, { inputHash?: string }>(
            existing.map(e => [
                e.subjectRef,
                { inputHash: (e.evidence as any)?.inputHash },
            ]),
        );

        // ── 6. วนทีละการ์ด ────────────────────────────────────────────────
        const findings: EchoFinding[] = [];
        let skipped = 0;

        for (const beat of targets) {
            const prefixText = buildPrefixText(beats, beat);
            const cardText = buildCardText(beat);
            const inputHash = hashEchoInput(prefixText, cardText, priorScenes.contextText);

            // ข้ามถ้า hash เดิม — ไม่จ่ายค่า LLM ซ้ำ
            const old = existingByRef.get(beat.code);
            if (old?.inputHash === inputHash) {
                skipped++;
                // ดึงผลเก่ามาใส่ findings
                const oldRow = existing.find(e => e.subjectRef === beat.code);
                if (oldRow) {
                    let oldEvidence = oldRow.evidence as EchoEvidence;
                    // แถวเก่ากว่า v1.5.1 ไม่มี cast mapping — hash ตรงแปลว่า legend (และ cast ที่ใช้สร้าง legend) เหมือนเดิมทุกตัว
                    // แปะ mapping ปัจจุบันเข้าไปได้เลยอย่างปลอดภัย พร้อม backfill ลง DB กันต้องมาเติมซ้ำทุกครั้ง
                    if (!oldEvidence.cast) {
                        oldEvidence = {
                            ...oldEvidence,
                            cast: sceneFormat.cast
                                .filter((c): c is typeof c & { alias: string } => !!c.alias)
                                .map(c => ({ alias: c.alias, name: c.name })),
                        };
                        await db
                            .update(plotFindings)
                            .set({ evidence: oldEvidence })
                            .where(and(
                                eq(plotFindings.novelId, novelId),
                                eq(plotFindings.checkId, "echo"),
                                eq(plotFindings.subjectRef, beat.code),
                            ));
                    }
                    findings.push({
                        cardCode: beat.code,
                        cardId: beat.id,
                        cardTitle: beat.title,
                        beatIndex: beat.beatIndex,
                        hasIncomingLink: beat.links.some(l => l.kind === "leads_to"),
                        evidence: oldEvidence,
                    });
                }
                continue;
            }

            // ── 6a. สุ่ม K เดา (ผ่าน AI Gateway — temp สูงให้เดาเอียง) ────
            // usedModel ตามผลจริงจาก callAi (มี fallback chain — gemini ล้มแล้วร่วง typhoon ได้)
            // ห้าม hardcode ค่าคงที่ ไม่งั้น evidence จะโกหกว่าใช้ gemini ทั้งที่ตอบมาจาก provider สำรอง
            let usedModel: string = ECHO_MODEL;
            let guesses: string[] = [];
            try {
                const guessPrompt = buildGuessPrompt(prefixText, ECHO_K, priorScenes.contextText);
                const guessResp = await callAi({
                    feature: "echo-score",
                    system: guessPrompt.system,
                    prompt: guessPrompt.user,
                    responseSchema: ECHO_GUESS_SCHEMA,
                    temperature: 1.0,
                    maxTokens: 512,
                    novelId,
                });
                usedModel = guessResp.model;
                guesses = parseGuessResponse(guessResp.text) ?? [];
            } catch (err) {
                if (err instanceof AiControlError) {
                    return { success: false, error: err.message };
                }
                console.error(`[EchoScore] guess error card ${beat.code}:`, err);
                continue;
            }

            if (guesses.length === 0) {
                console.warn(`[EchoScore] no guesses for card ${beat.code}`);
                continue;
            }

            // ── 6b. ตัดสินว่าตรงกี่ครั้ง (temp 0 เข้มงวด) ──────────────────
            let hitCount = 0;
            let matched: { index: number; reason: string }[] = [];
            try {
                const judgePrompt = buildJudgePrompt(prefixText, cardText, guesses);
                const judgeResp = await callAi({
                    feature: "echo-score",
                    system: judgePrompt.system,
                    prompt: judgePrompt.user,
                    responseSchema: ECHO_JUDGE_SCHEMA,
                    temperature: 0.0,
                    maxTokens: 512, // เผื่อ reason ต่อข้อที่ตรง (เดิม 128 พอแค่ตอนตอบแค่ index เปล่าๆ)
                    novelId,
                });
                usedModel = judgeResp.model; // ตัวตัดสินสุดท้าย — ใช้เป็น model ที่บันทึกถ้าสำเร็จ
                const parsed = parseJudgeResponse(judgeResp.text);
                if (parsed) {
                    hitCount = parsed.hits;
                    matched = parsed.matched;
                }
            } catch (err) {
                console.error(`[EchoScore] judge error card ${beat.code}:`, err);
            }

            // ── 6c. upsert plot_findings ───────────────────────────────────
            // เก็บ meta การ์ดลง evidence ด้วย — หน้า analysis tab จะได้โชว์ผลเก่า
            // โดยไม่ต้อง buildSceneFormat ใหม่ทุกครั้ง (แถวเก่าที่ไม่มี meta → fallback subjectRef)
            const evidence: EchoEvidence = {
                hitCount,
                guesses,
                matched,
                model: usedModel,
                promptVersion: ECHO_PROMPT_VERSION,
                k: ECHO_K,
                inputHash,
                cardId: beat.id,
                cardTitle: beat.title,
                beatIndex: beat.beatIndex,
                hasIncomingLink: beat.links.some(l => l.kind === "leads_to"),
                cast: sceneFormat.cast
                    .filter((c): c is typeof c & { alias: string } => !!c.alias)
                    .map(c => ({ alias: c.alias, name: c.name })),
                priorContextCoverage: priorCoverage,
            };

            await db
                .insert(plotFindings)
                .values({
                    novelId,
                    sceneId,
                    checkId: "echo",
                    subjectRef: beat.code,
                    evidence,
                    formatVersion: ECHO_PROMPT_VERSION,
                })
                .onConflictDoUpdate({
                    target: [plotFindings.novelId, plotFindings.checkId, plotFindings.subjectRef],
                    set: { evidence, formatVersion: ECHO_PROMPT_VERSION, updatedAt: new Date() },
                });

            findings.push({
                cardCode: beat.code,
                cardId: beat.id,
                cardTitle: beat.title,
                beatIndex: beat.beatIndex,
                hasIncomingLink: beat.links.some(l => l.kind === "leads_to"),
                evidence,
            });
        }

        return { success: true, findings, skipped };
    } catch (error) {
        console.error("runEchoScore error:", error);
        return { success: false, error: "คำนวณ Echo Score ไม่สำเร็จ" };
    }
}

// ─── Echo Findings loaders ───────────────────────────────────────────────

/** แปลงแถว plot_findings (checkId="echo") → EchoFinding · meta ที่ไม่เคยเก็บในแถวเก่า fallback จาก subjectRef */
function echoRowToFinding(subjectRef: string, raw: unknown): EchoFinding {
    const ev = (raw ?? {}) as EchoEvidence;
    return {
        cardCode: subjectRef,
        cardId: ev.cardId ?? subjectRef,
        cardTitle: ev.cardTitle ?? subjectRef,
        beatIndex: ev.beatIndex ?? 0,
        hasIncomingLink: ev.hasIncomingLink ?? false,
        evidence: ev,
    };
}

/** ดึง echo findings ที่บันทึกไว้แล้วสำหรับฉากหนึ่ง */
export async function getEchoFindings(
    novelId: string,
    sceneId: string,
): Promise<
    | { success: true; findings: EchoFinding[] }
    | { success: false; error: string }
> {
    try {
        await requireNovelAccess(novelId);

        const rows = await db
            .select({
                subjectRef: plotFindings.subjectRef,
                evidence: plotFindings.evidence,
            })
            .from(plotFindings)
            .where(
                and(
                    eq(plotFindings.novelId, novelId),
                    eq(plotFindings.checkId, "echo"),
                    eq(plotFindings.sceneId, sceneId),
                ),
            );

        return { success: true, findings: rows.map(r => echoRowToFinding(r.subjectRef, r.evidence)) };
    } catch (error) {
        console.error("getEchoFindings error:", error);
        return { success: false, error: "โหลด Echo Findings ไม่สำเร็จ" };
    }
}

/**
 * ดึง echo findings ทุกฉากของนิยาย จัดกลุ่มตาม sceneId — ใช้บนแท็บ analysis
 * (ผลลัพธ์อ่านอย่างเดียว ไม่ buildSceneFormat — title/beatIndex เดิมพันกับ meta ที่เก็บไว้)
 */
export async function getAllEchoFindings(
    novelId: string,
): Promise<Record<string, EchoFinding[]>> {
    const byScene: Record<string, EchoFinding[]> = {};
    try {
        await requireNovelAccess(novelId);

        const rows = await db
            .select({
                sceneId: plotFindings.sceneId,
                subjectRef: plotFindings.subjectRef,
                evidence: plotFindings.evidence,
            })
            .from(plotFindings)
            .where(
                and(
                    eq(plotFindings.novelId, novelId),
                    eq(plotFindings.checkId, "echo"),
                ),
            );

        for (const r of rows) {
            if (!r.sceneId) continue;
            (byScene[r.sceneId] ??= []).push(echoRowToFinding(r.subjectRef, r.evidence));
        }
    } catch (error) {
        console.error("getAllEchoFindings error:", error);
    }
    return byScene;
}

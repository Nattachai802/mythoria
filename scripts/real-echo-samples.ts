/**
 * ดึงตัวอย่าง prefix/card จริงจาก DB มาป้อนสคริปต์ทดลอง Echo Score
 * (compare-thai-formats.ts / compare-echo-models.ts) แทนข้อความจำลอง
 *
 * คัดลอก query logic จาก buildSceneFormatForEvent (server/plot-analysis.ts) มาที่นี่แทนการ
 * import ตรง — ไฟล์นั้น import lib/ai-gateway ที่ประกาศ "server-only" รันนอก Next ไม่ได้
 */
import { db } from "../db/drizzle";
import { timelineEvents, plotThreads, plotThreadBeats, sceneElementDetails } from "../db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { buildSceneFormat, type SceneFormatInput } from "../lib/story-format";
import { buildPrefixText, buildCardText } from "../lib/echo-score";

function parseCanvasData(canvasData: unknown) {
    const raw: any[] = Array.isArray(canvasData) ? (canvasData as any[]) : [];
    const laneItems = raw.filter((it: any) => it.type === "lane");
    const lanes = laneItems
        .map((l: any) => ({ id: l.id, name: l.name || "เลน" }))
        .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    const items = raw.filter((it: any) => it.type !== "lane" && it.type !== "group" && it.type !== "chapter");
    return { items, lanes };
}

async function buildSceneFormatForEvent(novelId: string, sceneId: string) {
    const event = await db.query.timelineEvents.findFirst({
        where: and(eq(timelineEvents.id, sceneId), eq(timelineEvents.novelId, novelId)),
        columns: {
            id: true, title: true, sceneGoal: true, sceneConflict: true, sceneOutcome: true,
            causeKind: true, causeNote: true, description: true, canvasData: true,
        },
    });
    if (!event) return null;

    const allThreads = await db.query.plotThreads.findMany({ where: eq(plotThreads.novelId, novelId) });
    const allBeats = allThreads.length > 0
        ? await db.query.plotThreadBeats.findMany({ where: inArray(plotThreadBeats.threadId, allThreads.map(t => t.id)) })
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
    for (const d of details) if (d.canvasItemId) elementDetails.set(d.canvasItemId, { action: d.action, goal: d.goal, outcome: d.outcome });

    const { items, lanes } = parseCanvasData(event.canvasData);
    return buildSceneFormat({
        event: {
            id: event.id, title: event.title, sceneGoal: event.sceneGoal, sceneConflict: event.sceneConflict,
            sceneOutcome: event.sceneOutcome, causeKind: event.causeKind, causeNote: event.causeNote, description: event.description,
        },
        items, lanes, threads: threadsForFormat, eventId: event.id, elementDetails, ideaNotes: [],
    });
}

export interface RealCase {
    name: string;
    prefixText: string;
    cardText: string;
}

/**
 * คืนตัวอย่างจริง — ทุก beat ในทุกฉากที่มี prefix ก่อนหน้าไม่ว่าง เป็น target แยกกันหมด
 * (ไม่ใช่แค่การ์ดท้ายสุดของฉาก — ฉากนึงมีหลักสิบ beat ก็ทดสอบได้หลักสิบ case)
 * limit ควบคุมจำนวน case รวมทั้งหมด ไม่ใช่จำนวนฉาก
 */
export async function getRealCases(limit = 50): Promise<RealCase[]> {
    const rows = await db.execute(sql`
        select te.id as scene_id, te.novel_id, te.title as scene_title, count(b.id) as beat_count
        from timeline_events te
        join plot_thread_beats b on b.event_id = te.id
        group by te.id, te.novel_id, te.title
        having count(b.id) >= 2
        order by beat_count desc
    `);

    const cases: RealCase[] = [];
    for (const row of rows.rows as any[]) {
        if (cases.length >= limit) break;
        const sceneFormat = await buildSceneFormatForEvent(row.novel_id, row.scene_id);
        if (!sceneFormat || sceneFormat.beats.length < 2) continue;
        for (const target of sceneFormat.beats) {
            if (cases.length >= limit) break;
            if (target.isBoardNote) continue;
            const prefixText = buildPrefixText(sceneFormat.beats, target);
            const cardText = buildCardText(target);
            if (!prefixText || !cardText) continue;
            cases.push({ name: `จริง: ${row.scene_title} [${target.code}]`, prefixText, cardText });
        }
    }
    return cases;
}

export interface RealBeatSet {
    name: string;
    beats: { code: string; title: string; content: string; who: string[] }[];
}

/** คืนชุด beats ดิบ (ไม่ผ่าน buildPrefixText) ให้ compare-thai-formats.ts จัด format เองได้หลายแบบ */
export async function getRealBeatSets(limit = 3): Promise<RealBeatSet[]> {
    const rows = await db.execute(sql`
        select te.id as scene_id, te.novel_id, te.title as scene_title, count(b.id) as beat_count
        from timeline_events te
        join plot_thread_beats b on b.event_id = te.id
        group by te.id, te.novel_id, te.title
        having count(b.id) >= 2
        order by beat_count desc
        limit ${limit}
    `);

    const sets: RealBeatSet[] = [];
    for (const row of rows.rows as any[]) {
        const sceneFormat = await buildSceneFormatForEvent(row.novel_id, row.scene_id);
        if (!sceneFormat || sceneFormat.beats.length < 2) continue;
        sets.push({
            name: `จริง: ${row.scene_title}`,
            beats: sceneFormat.beats.map(b => ({
                code: b.code,
                title: b.title,
                content: b.content ?? "",
                who: b.participants.map(p => p.name),
            })),
        });
    }
    return sets;
}

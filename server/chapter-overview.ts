"use server"

import { db } from "@/db/drizzle";
import { timelineEvents, sceneElementDetails, ideas } from "@/db/schema"
import { eq, asc, inArray } from "drizzle-orm"

export async function getChapterOverview(chapterId: string) {
    try {
        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.relatedChapterId, chapterId),
            orderBy: [asc(timelineEvents.orderIndex)],
        })

        // Fetch scene element details (notes) for all events in one query
        const eventIds = events.map(e => e.id);
        let allDetails: any[] = [];
        if (eventIds.length > 0) {
            allDetails = await db.query.sceneElementDetails.findMany({
                where: inArray(sceneElementDetails.sceneId, eventIds),
            });
        }

        // การ์ดไอเดีย (ฉากย่อย) ในแต่ละฉาก อยู่ใน canvasData (JSONB) — เก็บ referenceId ไว้
        // ค่า pacing/sceneType จริงอยู่ที่ ideas table ไม่ได้ฝังใน canvasData เลยต้อง join เพิ่ม
        // (pattern เดียวกับ sceneElementDetails ด้านบน — query ครั้งเดียวรวมทุกฉาก)
        const ideaRefsByEvent = new Map<string, { referenceId: string; beatIndex: number }[]>();
        const allReferenceIds = new Set<string>();
        for (const event of events) {
            const canvasItems: any[] = Array.isArray(event.canvasData) ? (event.canvasData as any[]) : [];
            const refs = canvasItems
                .filter(it => it?.type === "idea" && it?.referenceId)
                .map(it => ({ referenceId: it.referenceId as string, beatIndex: it.beatIndex ?? 0 }));
            ideaRefsByEvent.set(event.id, refs);
            refs.forEach(r => allReferenceIds.add(r.referenceId));
        }

        // content/sceneGoal/sceneConflict/sceneOutcome เพิ่มมาไว้ให้ AI pacing suggest ใช้ตัดสิน (ดู lib/pacing-ai-suggest.ts)
        type IdeaBrief = { id: string; title: string; pacing: number | null; sceneType: string | null; content: string | null; sceneGoal: string | null; sceneConflict: string | null; sceneOutcome: string | null };
        let ideaById = new Map<string, IdeaBrief>();
        if (allReferenceIds.size > 0) {
            const ideaRows = await db.query.ideas.findMany({
                where: inArray(ideas.id, Array.from(allReferenceIds)),
                columns: { id: true, title: true, pacing: true, sceneType: true, content: true, sceneGoal: true, sceneConflict: true, sceneOutcome: true },
            });
            ideaById = new Map(ideaRows.map(i => [i.id, i]));
        }

        // Attach details + sub-beats (การ์ดไอเดีย เรียงตาม beatIndex) ให้แต่ละ event
        const eventsWithDetails = events.map(event => ({
            ...event,
            elementDetails: allDetails.filter(d => d.sceneId === event.id),
            subBeats: (ideaRefsByEvent.get(event.id) ?? [])
                .map(r => {
                    const idea = ideaById.get(r.referenceId);
                    return idea ? { ...idea, beatIndex: r.beatIndex } : null;
                })
                .filter((b): b is IdeaBrief & { beatIndex: number } => b !== null)
                .sort((a, b) => a.beatIndex - b.beatIndex),
        }));

        return { success: true, events: eventsWithDetails }
    } catch (error) {
        console.error("Error fetching chapter overview:", error)
        return { success: false, error: "Failed to fetch chapter overview" }
    }
}

"use server"

import { db } from "@/db/drizzle";
import { timelineEvents, InsertTimelineEvent } from "@/db/schema"
import { eq, and, asc, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireNovelAccess } from "@/lib/authz"



export async function getTimeLineEvents(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const events = await db.query.timelineEvents.findMany({
            where: (eq(timelineEvents.novelId, novelId)),
            orderBy: [asc(timelineEvents.orderIndex)],
            with: {
                elementDetails: true
            }
        })
        return { success: true, events }
    } catch (err) {
        console.error("Error fetching timeline events:", err)
        return { success: false, error: "Failed to fetch timeline events" }
    }
}

export async function createTimelineEvent(data: InsertTimelineEvent) {
    try {
        await requireNovelAccess(data.novelId);
        const existingEvents = await db.query.timelineEvents.findMany({
            where: and(
                eq(timelineEvents.novelId, data.novelId),
                data.relatedChapterId ?
                    eq(timelineEvents.relatedChapterId, data.relatedChapterId)
                    : undefined
            ),
        })

        const nextOrderIndex = existingEvents.length > 0
            ? Math.max(...existingEvents.map(e => e.orderIndex)) + 1 : 0

        const [newEvent] = await db.insert(timelineEvents).values({
            ...data,
            orderIndex: nextOrderIndex,
        }).returning()

        revalidatePath(`/dashboard/project/${data.novelId}`)
        return { success: true, event: newEvent }
    } catch (err) {
        console.error("Error creating timeline event:", err)
        return { success: false, error: "Failed to create timeline event" }
    }
}

export async function updateTimelineEvent(
    id: string,
    data: Partial<InsertTimelineEvent>
) {
    try {
        const [owner] = await db.select({ novelId: timelineEvents.novelId }).from(timelineEvents).where(eq(timelineEvents.id, id)).limit(1)
        if (!owner) return { success: false, error: "Event not found" }
        await requireNovelAccess(owner.novelId)

        // กัน novelId/id ไม่ให้แก้ผ่าน data — ล็อก event ให้อยู่นิยายเดิมเสมอ
        const { novelId: _n, id: _i, ...safe } = data
        const [updatedEvent] = await db
            .update(timelineEvents)
            .set({ ...safe, updatedAt: new Date() })
            .where(eq(timelineEvents.id, id))
            .returning()

        if (updatedEvent) {
            revalidatePath(`/dashboard/project/${updatedEvent.novelId}`)
            return { success: true, event: updatedEvent }
        }
        return { success: false, error: "Event not found" }
    } catch (error) {
        console.error("Error updating timeline event:", error)
        return { success: false, error: "Failed to update timeline event" }
    }
}

export async function deleteTimelineEvent(id: string) {
    try {
        const [owner] = await db.select({ novelId: timelineEvents.novelId }).from(timelineEvents).where(eq(timelineEvents.id, id)).limit(1)
        if (!owner) return { success: false, error: "Event not found" }
        await requireNovelAccess(owner.novelId)

        const [deletedEvent] = await db
            .delete(timelineEvents)
            .where(eq(timelineEvents.id, id))
            .returning()

        if (deletedEvent) {
            revalidatePath(`/dashboard/project/${deletedEvent.novelId}`)
            return { success: true }
        }
        return { success: false, error: "Event not found" }
    } catch (error) {
        console.error("Error deleting timeline event:", error)
        return { success: false, error: "Failed to delete timeline event" }
    }
}

export async function reorderTimelineEvents(
    items: { id: string; orderIndex: number; relatedChapterId: string | null }[]
) {
    try {
        // verify เจ้าของของทุก event ก่อน reorder (ไม่มี novelId ส่งมา)
        const ids = items.map((i) => i.id)
        const rows: { novelId: string }[] = ids.length
            ? await db.select({ novelId: timelineEvents.novelId }).from(timelineEvents).where(inArray(timelineEvents.id, ids))
            : []
        for (const nid of new Set<string>(rows.map((r) => r.novelId))) {
            await requireNovelAccess(nid)
        }

        await Promise.all(
            items.map((item) =>
                db
                    .update(timelineEvents)
                    .set({
                        orderIndex: item.orderIndex,
                        relatedChapterId: item.relatedChapterId,
                        updatedAt: new Date(),
                    })
                    .where(eq(timelineEvents.id, item.id))
            )
        )
        return { success: true }
    } catch (error) {
        console.error("Error reordering timeline events:", error)
        return { success: false, error: "Failed to reorder events" }
    }
}
export async function getTimelineEventById(id: string) {
    try {
        const event = await db.query.timelineEvents.findFirst({
            where: eq(timelineEvents.id, id),
            with: {
                elementDetails: true
            }
        });
        if (!event) return { success: false, error: "Event not found" };
        await requireNovelAccess(event.novelId);

        return { success: true, event };
    } catch (error) {
        console.error("Error fetching timeline event:", error);
        return { success: false, error: "Failed to fetch event" };
    }
}

// รวบรวม dummy ที่เคยสร้างไว้ ทุกฉากของนิยาย จัดกลุ่มตามฉาก — ไว้ reuse ข้ามฉาก (เลือกฉาก → เลือก dummy)
export type SceneDummies = { sceneId: string; sceneTitle: string; dummies: { title: string; type: string }[] }
export async function getNovelDummyParticipants(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.novelId, novelId),
            columns: { id: true, title: true, canvasData: true },
            orderBy: [asc(timelineEvents.orderIndex)],
        });
        const scenes: SceneDummies[] = [];
        for (const ev of events) {
            const items = (ev.canvasData as any[]) || [];
            const seen = new Map<string, { title: string; type: string }>();
            for (const it of items) {
                for (const ch of (it?.children || [])) {
                    if ((ch?.type === "dummy_character" || ch?.type === "dummy_faction") && ch?.title) {
                        const key = `${ch.type}::${ch.title}`;
                        if (!seen.has(key)) seen.set(key, { title: ch.title, type: ch.type });
                    }
                }
            }
            if (seen.size > 0) scenes.push({ sceneId: ev.id, sceneTitle: ev.title || "(ไม่มีชื่อ)", dummies: Array.from(seen.values()) });
        }
        return { success: true, data: scenes };
    } catch (error) {
        console.error("getNovelDummyParticipants error:", error);
        return { success: false, data: [] as SceneDummies[] };
    }
}

export async function updateTimelineCanvas(id: string, canvasData: any) {
    try {
        const [owner] = await db.select({ novelId: timelineEvents.novelId }).from(timelineEvents).where(eq(timelineEvents.id, id)).limit(1);
        if (!owner) return { success: false, error: "Event not found" };
        await requireNovelAccess(owner.novelId);

        await db
            .update(timelineEvents)
            .set({
                canvasData,
                updatedAt: new Date()
            })
            .where(eq(timelineEvents.id, id));

        return { success: true };
    } catch (error) {
        console.error("Error updating canvas:", error);
        return { success: false, error: "Failed to update canvas" };
    }
}
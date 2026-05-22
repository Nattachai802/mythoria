"use server"

import { db } from "@/db/drizzle";
import { timelineEvents, InsertTimelineEvent } from "@/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"



export async function getTimeLineEvents(novelId: string) {
    try {
        const events = await db.query.timelineEvents.findMany({
            where: (eq(timelineEvents.novelId, novelId)),
            orderBy: [asc(timelineEvents.orderIndex)],
        })
        return { success: true, events }
    } catch (err) {
        console.error("Error fetching timeline events:", err)
        return { success: false, error: "Failed to fetch timeline events" }
    }
}

export async function createTimelineEvent(data: InsertTimelineEvent) {
    try {
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
        const [updatedEvent] = await db
            .update(timelineEvents)
            .set({ ...data, updatedAt: new Date() })
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
        });

        return { success: true, event };
    } catch (error) {
        console.error("Error fetching timeline event:", error);
        return { success: false, error: "Failed to fetch event" };
    }
}

export async function updateTimelineCanvas(id: string, canvasData: any) {
    try {
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
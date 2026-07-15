"use client"

// Restore ฝั่งเดียวใช้ร่วมกันทั้ง toast action และ widget "กู้คืนล่าสุด" — กันโค้ด restore ซ้ำต่อจุดลบ
import { createArc } from "@/server/story-arcs"
import { createThread, addBeat } from "@/server/plot-threads"
import { createTimelineEvent } from "@/server/timeline"
import type { PlotUndoEntry } from "@/hooks/use-plot-undo-stack"

export async function restorePlotUndoEntry(
    novelId: string,
    entry: PlotUndoEntry
): Promise<{ success: boolean; sceneId?: string; error?: string }> {
    switch (entry.kind) {
        case "arc": {
            const res = await createArc({
                novelId,
                title: entry.payload.title,
                color: entry.payload.color ?? undefined,
                startChapterId: entry.payload.startChapterId ?? undefined,
                endChapterId: entry.payload.endChapterId ?? undefined,
            })
            return { success: res.success, error: res.error }
        }
        case "thread": {
            const created = await createThread({
                novelId,
                title: entry.payload.title,
                type: entry.payload.type,
                importance: entry.payload.importance,
                note: entry.payload.note ?? undefined,
                color: entry.payload.color ?? undefined,
            })
            if (!created.success || !created.data) return { success: false, error: created.error }
            for (const b of entry.payload.beats) {
                await addBeat({ threadId: created.data.id, eventId: b.eventId, role: b.role, novelId, note: b.note ?? undefined })
            }
            return { success: true }
        }
        case "beat": {
            const res = await addBeat({
                threadId: entry.payload.threadId,
                eventId: entry.payload.eventId,
                role: entry.payload.role,
                novelId,
                note: entry.payload.note ?? undefined,
            })
            return { success: res.success, error: res.error }
        }
        case "scene": {
            const res = await createTimelineEvent({
                novelId,
                title: entry.payload.title,
                description: entry.payload.description,
                eventDate: entry.payload.eventDate,
                relatedChapterId: entry.payload.relatedChapterId,
                relatedCharacterIds: entry.payload.relatedCharacterIds,
                relatedLocationIds: entry.payload.relatedLocationIds,
                eventType: entry.payload.eventType,
                canvasData: entry.payload.canvasData,
            } as any)
            return { success: res.success, sceneId: res.event?.id, error: res.error }
        }
    }
}

"use server"

import { db } from "@/db/drizzle"
import { plotThreads, plotThreadBeats } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export interface ThreadBeat {
    id: string
    eventId: string
    role: string
    note: string | null
    orderIndex: number | null
}

export interface ThreadWithBeats {
    id: string
    novelId: string
    title: string
    type: string
    status: string
    importance: string
    color: string | null
    note: string | null
    beats: ThreadBeat[]
}

const plotPath = (novelId: string) => `/dashboard/project/${novelId}/plot`

export async function getThreadsByNovelId(novelId: string): Promise<{ success: boolean; data: ThreadWithBeats[] }> {
    try {
        const threads = await db
            .select()
            .from(plotThreads)
            .where(eq(plotThreads.novelId, novelId))

        if (threads.length === 0) return { success: true, data: [] }

        const beats = await db
            .select()
            .from(plotThreadBeats)
            .where(inArray(plotThreadBeats.threadId, threads.map((t: typeof threads[number]) => t.id)))

        const data: ThreadWithBeats[] = threads.map((t: typeof threads[number]) => ({
            id: t.id,
            novelId: t.novelId,
            title: t.title,
            type: t.type,
            status: t.status,
            importance: t.importance,
            color: t.color,
            note: t.note,
            beats: beats
                .filter((b: typeof beats[number]) => b.threadId === t.id)
                .map((b: typeof beats[number]) => ({ id: b.id, eventId: b.eventId, role: b.role, note: b.note, orderIndex: b.orderIndex })),
        }))

        return { success: true, data }
    } catch (error) {
        console.error("getThreadsByNovelId error:", error)
        return { success: false, data: [] }
    }
}

export async function createThread(data: {
    novelId: string
    title: string
    type?: string
    importance?: string
    note?: string
    color?: string
}) {
    try {
        const [thread] = await db
            .insert(plotThreads)
            .values({
                novelId: data.novelId,
                title: data.title,
                type: data.type || "foreshadow",
                importance: data.importance || "minor",
                note: data.note,
                color: data.color,
            })
            .returning()
        revalidatePath(plotPath(data.novelId))
        return { success: true, data: thread }
    } catch (error) {
        console.error("createThread error:", error)
        return { success: false, error: "สร้างปมไม่สำเร็จ" }
    }
}

export async function updateThread(
    id: string,
    novelId: string,
    patch: Partial<{ title: string; type: string; status: string; importance: string; note: string; color: string }>
) {
    try {
        const [thread] = await db
            .update(plotThreads)
            .set(patch)
            .where(eq(plotThreads.id, id))
            .returning()
        revalidatePath(plotPath(novelId))
        return { success: true, data: thread }
    } catch (error) {
        console.error("updateThread error:", error)
        return { success: false, error: "อัปเดตปมไม่สำเร็จ" }
    }
}

export async function deleteThread(id: string, novelId: string) {
    try {
        await db.delete(plotThreads).where(eq(plotThreads.id, id))
        revalidatePath(plotPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deleteThread error:", error)
        return { success: false, error: "ลบปมไม่สำเร็จ" }
    }
}

export async function addBeat(data: {
    threadId: string
    eventId: string
    role: string
    novelId: string
    note?: string
}) {
    try {
        const [beat] = await db
            .insert(plotThreadBeats)
            .values({
                threadId: data.threadId,
                eventId: data.eventId,
                role: data.role,
                note: data.note,
            })
            .returning()

        // auto-advance status: เพิ่ม payoff → paid, มี beat แรก → developing
        if (data.role === "payoff") {
            await db.update(plotThreads).set({ status: "paid" }).where(eq(plotThreads.id, data.threadId))
        }
        revalidatePath(plotPath(data.novelId))
        return { success: true, data: beat }
    } catch (error) {
        console.error("addBeat error:", error)
        return { success: false, error: "เพิ่มจุดผูกปมไม่สำเร็จ" }
    }
}

export async function deleteBeat(id: string, novelId: string) {
    try {
        await db.delete(plotThreadBeats).where(eq(plotThreadBeats.id, id))
        revalidatePath(plotPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deleteBeat error:", error)
        return { success: false, error: "ลบจุดผูกปมไม่สำเร็จ" }
    }
}

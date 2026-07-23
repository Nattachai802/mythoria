"use server"

import { db } from "@/db/drizzle"
import { storyArcs } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import type { StoryArc } from "@/db/schema"
import { requireNovelAccess } from "@/lib/authz"

const plotPath = (novelId: string) => `/dashboard/project/${novelId}/plot`

export async function getArcsByNovelId(novelId: string): Promise<{ success: boolean; data: StoryArc[] }> {
    try {
        await requireNovelAccess(novelId)
        const arcs = await db
            .select()
            .from(storyArcs)
            .where(eq(storyArcs.novelId, novelId))
            .orderBy(storyArcs.orderIndex)
        return { success: true, data: arcs }
    } catch (error) {
        console.error("getArcsByNovelId error:", error)
        return { success: false, data: [] }
    }
}

export async function createArc(data: {
    novelId: string
    title: string
    color?: string
    startChapterId?: string
    endChapterId?: string
}) {
    try {
        await requireNovelAccess(data.novelId)
        const existing = await db.select().from(storyArcs).where(eq(storyArcs.novelId, data.novelId))
        const [arc] = await db
            .insert(storyArcs)
            .values({
                novelId: data.novelId,
                title: data.title,
                color: data.color ?? "#6366f1",
                startChapterId: data.startChapterId ?? null,
                endChapterId: data.endChapterId ?? null,
                orderIndex: existing.length,
            })
            .returning()
        revalidatePath(plotPath(data.novelId))
        return { success: true, data: arc }
    } catch (error) {
        console.error("createArc error:", error)
        return { success: false, error: "สร้าง arc ไม่สำเร็จ" }
    }
}

export async function updateArc(
    id: string,
    novelId: string,
    patch: Partial<{ title: string; color: string; startChapterId: string | null; endChapterId: string | null }>
) {
    try {
        await requireNovelAccess(novelId)
        const [arc] = await db
            .update(storyArcs)
            .set(patch)
            .where(and(eq(storyArcs.id, id), eq(storyArcs.novelId, novelId)))
            .returning()
        revalidatePath(plotPath(novelId))
        return { success: true, data: arc }
    } catch (error) {
        console.error("updateArc error:", error)
        return { success: false, error: "อัปเดต arc ไม่สำเร็จ" }
    }
}

export async function deleteArc(id: string, novelId: string) {
    try {
        await requireNovelAccess(novelId)
        await db.delete(storyArcs).where(and(eq(storyArcs.id, id), eq(storyArcs.novelId, novelId)))
        revalidatePath(plotPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deleteArc error:", error)
        return { success: false, error: "ลบ arc ไม่สำเร็จ" }
    }
}

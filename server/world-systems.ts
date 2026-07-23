"use server"

import { db } from "@/db/drizzle"
import { worldSystems } from "@/db/schema"
import type { WorldSystem, WorldSystemEntry } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireNovelAccess } from "@/lib/authz"

const wbPath = (novelId: string) => `/dashboard/project/${novelId}/worldbuilding`

export async function getWorldSystemsByNovelId(novelId: string): Promise<{ success: boolean; data: WorldSystem[] }> {
    try {
        await requireNovelAccess(novelId)
        const rows = await db
            .select()
            .from(worldSystems)
            .where(eq(worldSystems.novelId, novelId))
            .orderBy(worldSystems.orderIndex)
        return { success: true, data: rows }
    } catch (error) {
        console.error("getWorldSystemsByNovelId error:", error)
        return { success: false, data: [] }
    }
}

export async function createWorldSystem(data: {
    novelId: string
    name: string
    category?: string
    description?: string
    ordered?: boolean
    attrKeys?: string[]
    entries?: WorldSystemEntry[]
}) {
    try {
        await requireNovelAccess(data.novelId)
        const existing = await db.select().from(worldSystems).where(eq(worldSystems.novelId, data.novelId))
        const [row] = await db
            .insert(worldSystems)
            .values({
                novelId: data.novelId,
                name: data.name,
                category: data.category ?? "taxonomy",
                description: data.description,
                ordered: data.ordered ?? false,
                attrKeys: data.attrKeys ?? [],
                entries: data.entries ?? [],
                orderIndex: existing.length,
            })
            .returning()
        revalidatePath(wbPath(data.novelId))
        return { success: true, data: row }
    } catch (error) {
        console.error("createWorldSystem error:", error)
        return { success: false, error: "สร้างระบบไม่สำเร็จ" }
    }
}

export async function updateWorldSystem(
    id: string,
    novelId: string,
    patch: Partial<{
        name: string
        category: string
        description: string
        ordered: boolean
        attrKeys: string[]
        entries: WorldSystemEntry[]
    }>
) {
    try {
        await requireNovelAccess(novelId)
        const [row] = await db
            .update(worldSystems)
            .set(patch)
            .where(and(eq(worldSystems.id, id), eq(worldSystems.novelId, novelId)))
            .returning()
        revalidatePath(wbPath(novelId))
        return { success: true, data: row }
    } catch (error) {
        console.error("updateWorldSystem error:", error)
        return { success: false, error: "อัปเดตระบบไม่สำเร็จ" }
    }
}

export async function deleteWorldSystem(id: string, novelId: string) {
    try {
        await requireNovelAccess(novelId)
        await db.delete(worldSystems).where(and(eq(worldSystems.id, id), eq(worldSystems.novelId, novelId)))
        revalidatePath(wbPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deleteWorldSystem error:", error)
        return { success: false, error: "ลบระบบไม่สำเร็จ" }
    }
}

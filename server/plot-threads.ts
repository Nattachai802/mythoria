"use server"

import { db } from "@/db/drizzle"
import { plotThreads, plotThreadBeats, plotThreadPoints, plotThreadLinks } from "@/db/schema"
import { eq, and, inArray, asc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireNovelAccess } from "@/lib/authz"

export interface ThreadBeat {
    id: string
    eventId: string
    canvasItemId: string | null
    role: string
    note: string | null
    pointId: string | null
    tension: number | null
    orderIndex: number | null
}

export interface ThreadPoint {
    id: string
    text: string
    status: string
    orderIndex: number | null
}

export interface ThreadLink {
    id: string
    fromThreadId: string
    toThreadId: string
    kind: string
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
    summary: string | null
    parentThreadId: string | null
    beats: ThreadBeat[]
    points: ThreadPoint[]
    /** ลิงก์ที่ปมนี้เป็นต้นทาง (from) */
    links: ThreadLink[]
}

const plotPath = (novelId: string) => `/dashboard/project/${novelId}/plot`

export async function getThreadsByNovelId(novelId: string): Promise<{ success: boolean; data: ThreadWithBeats[] }> {
    try {
        await requireNovelAccess(novelId)
        const threads = await db
            .select()
            .from(plotThreads)
            .where(eq(plotThreads.novelId, novelId))

        if (threads.length === 0) return { success: true, data: [] }

        const ids = threads.map((t: typeof threads[number]) => t.id)
        const [beats, points, links] = await Promise.all([
            db.select().from(plotThreadBeats).where(inArray(plotThreadBeats.threadId, ids)),
            db.select().from(plotThreadPoints).where(inArray(plotThreadPoints.threadId, ids)).orderBy(asc(plotThreadPoints.orderIndex), asc(plotThreadPoints.createdAt)),
            db.select().from(plotThreadLinks).where(inArray(plotThreadLinks.fromThreadId, ids)),
        ])

        const data: ThreadWithBeats[] = threads.map((t: typeof threads[number]) => ({
            id: t.id,
            novelId: t.novelId,
            title: t.title,
            type: t.type,
            status: t.status,
            importance: t.importance,
            color: t.color,
            note: t.note,
            summary: t.summary,
            parentThreadId: t.parentThreadId,
            beats: beats
                .filter((b: typeof beats[number]) => b.threadId === t.id)
                .map((b: typeof beats[number]) => ({ id: b.id, eventId: b.eventId, canvasItemId: b.canvasItemId, role: b.role, note: b.note, pointId: b.pointId, tension: b.tension, orderIndex: b.orderIndex })),
            points: points
                .filter((p: typeof points[number]) => p.threadId === t.id)
                .map((p: typeof points[number]) => ({ id: p.id, text: p.text, status: p.status, orderIndex: p.orderIndex })),
            links: links
                .filter((l: typeof links[number]) => l.fromThreadId === t.id)
                .map((l: typeof links[number]) => ({ id: l.id, fromThreadId: l.fromThreadId, toThreadId: l.toThreadId, kind: l.kind })),
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
    summary?: string
    parentThreadId?: string | null
}) {
    try {
        await requireNovelAccess(data.novelId)
        if (data.parentThreadId && !(await ownThreads([data.parentThreadId], data.novelId))) {
            return { success: false, error: "ไม่พบปมแม่ในนิยายนี้" }
        }
        const [thread] = await db
            .insert(plotThreads)
            .values({
                novelId: data.novelId,
                title: data.title,
                type: data.type || "foreshadow",
                importance: data.importance || "minor",
                note: data.note,
                color: data.color,
                summary: data.summary,
                parentThreadId: data.parentThreadId ?? null,
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
    patch: Partial<{ title: string; type: string; status: string; importance: string; note: string; color: string; summary: string; parentThreadId: string | null }>
) {
    try {
        await requireNovelAccess(novelId)
        if (patch.parentThreadId) {
            if (!(await ownThreads([patch.parentThreadId], novelId))) return { success: false, error: "ไม่พบปมแม่ในนิยายนี้" }
            if (await wouldCycle(id, patch.parentThreadId, novelId)) return { success: false, error: "ตั้งปมแม่แบบนี้จะวนกลับมาที่ตัวเอง" }
        }
        const [thread] = await db
            .update(plotThreads)
            .set(patch)
            .where(and(eq(plotThreads.id, id), eq(plotThreads.novelId, novelId)))
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
        await requireNovelAccess(novelId)
        await db.delete(plotThreads).where(and(eq(plotThreads.id, id), eq(plotThreads.novelId, novelId)))
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
    canvasItemId?: string | null
}) {
    try {
        await requireNovelAccess(data.novelId)
        // ยืนยันว่า thread เป็นของ novel นี้จริง กันแนบ beat ข้าม novel
        const [thread] = await db.select({ id: plotThreads.id }).from(plotThreads)
            .where(and(eq(plotThreads.id, data.threadId), eq(plotThreads.novelId, data.novelId))).limit(1)
        if (!thread) return { success: false, error: "ไม่พบปมในนิยายนี้" }

        const [beat] = await db
            .insert(plotThreadBeats)
            .values({
                threadId: data.threadId,
                eventId: data.eventId,
                canvasItemId: data.canvasItemId ?? null,
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
        await requireNovelAccess(novelId)
        // ยืนยัน beat สังกัด thread ของ novel นี้ (beat ไม่มี novelId ตรง ๆ)
        const [owned] = await db.select({ id: plotThreadBeats.id })
            .from(plotThreadBeats)
            .innerJoin(plotThreads, eq(plotThreads.id, plotThreadBeats.threadId))
            .where(and(eq(plotThreadBeats.id, id), eq(plotThreads.novelId, novelId))).limit(1)
        if (!owned) return { success: false, error: "ไม่พบจุดผูกปมในนิยายนี้" }

        await db.delete(plotThreadBeats).where(eq(plotThreadBeats.id, id))
        revalidatePath(plotPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deleteBeat error:", error)
        return { success: false, error: "ลบจุดผูกปมไม่สำเร็จ" }
    }
}

// ── helpers ──

/** ทุก id ต้องเป็นปมของนิยายนี้ */
async function ownThreads(ids: string[], novelId: string) {
    const rows = await db.select({ id: plotThreads.id }).from(plotThreads)
        .where(and(inArray(plotThreads.id, ids), eq(plotThreads.novelId, novelId)))
    return rows.length === new Set(ids).size
}

/** ตั้ง parent ให้ id แล้วจะวนไหม — ไล่ขึ้นจาก parent ใหม่ ถ้าเจอ id = วน */
async function wouldCycle(id: string, parentId: string, novelId: string) {
    if (id === parentId) return true
    const rows = await db.select({ id: plotThreads.id, parent: plotThreads.parentThreadId })
        .from(plotThreads).where(eq(plotThreads.novelId, novelId))
    const parentOf = new Map(rows.map((r: typeof rows[number]) => [r.id, r.parent]))
    let cur: string | null | undefined = parentId
    for (let i = 0; cur && i < rows.length; i++) {
        if (cur === id) return true
        cur = parentOf.get(cur)
    }
    return false
}

/** หา thread ที่ point สังกัด และยืนยันว่าอยู่ในนิยายนี้ */
async function pointThread(pointId: string, novelId: string) {
    const [row] = await db.select({ threadId: plotThreadPoints.threadId })
        .from(plotThreadPoints)
        .innerJoin(plotThreads, eq(plotThreads.id, plotThreadPoints.threadId))
        .where(and(eq(plotThreadPoints.id, pointId), eq(plotThreads.novelId, novelId))).limit(1)
    return row?.threadId ?? null
}

// ── ประเด็น ──

export async function addPoint(data: { threadId: string; novelId: string; text: string }) {
    try {
        await requireNovelAccess(data.novelId)
        const text = data.text.trim()
        if (!text) return { success: false, error: "ประเด็นว่างไม่ได้" }
        if (!(await ownThreads([data.threadId], data.novelId))) return { success: false, error: "ไม่พบปมในนิยายนี้" }
        const existing = await db.select({ id: plotThreadPoints.id }).from(plotThreadPoints)
            .where(eq(plotThreadPoints.threadId, data.threadId))
        const [point] = await db.insert(plotThreadPoints)
            .values({ threadId: data.threadId, text, orderIndex: existing.length })
            .returning()
        revalidatePath(plotPath(data.novelId))
        return { success: true, data: point }
    } catch (error) {
        console.error("addPoint error:", error)
        return { success: false, error: "เพิ่มประเด็นไม่สำเร็จ" }
    }
}

export async function updatePoint(
    id: string,
    novelId: string,
    patch: Partial<{ text: string; status: "open" | "resolved"; orderIndex: number }>
) {
    try {
        await requireNovelAccess(novelId)
        if (!(await pointThread(id, novelId))) return { success: false, error: "ไม่พบประเด็นในนิยายนี้" }
        if (patch.text !== undefined && !patch.text.trim()) return { success: false, error: "ประเด็นว่างไม่ได้" }
        const [point] = await db.update(plotThreadPoints)
            .set(patch.text !== undefined ? { ...patch, text: patch.text.trim() } : patch)
            .where(eq(plotThreadPoints.id, id)).returning()
        revalidatePath(plotPath(novelId))
        return { success: true, data: point }
    } catch (error) {
        console.error("updatePoint error:", error)
        return { success: false, error: "อัปเดตประเด็นไม่สำเร็จ" }
    }
}

export async function deletePoint(id: string, novelId: string) {
    try {
        await requireNovelAccess(novelId)
        if (!(await pointThread(id, novelId))) return { success: false, error: "ไม่พบประเด็นในนิยายนี้" }
        // beat ที่ชี้มาจะกลายเป็น pointId = null (FK set null)
        await db.delete(plotThreadPoints).where(eq(plotThreadPoints.id, id))
        revalidatePath(plotPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deletePoint error:", error)
        return { success: false, error: "ลบประเด็นไม่สำเร็จ" }
    }
}

// ── beat: ประเด็น + ความตึง ──

export async function updateBeat(
    id: string,
    novelId: string,
    patch: Partial<{ pointId: string | null; tension: number | null; role: string; note: string }>
) {
    try {
        await requireNovelAccess(novelId)
        const [owned] = await db.select({ threadId: plotThreadBeats.threadId })
            .from(plotThreadBeats)
            .innerJoin(plotThreads, eq(plotThreads.id, plotThreadBeats.threadId))
            .where(and(eq(plotThreadBeats.id, id), eq(plotThreads.novelId, novelId))).limit(1)
        if (!owned) return { success: false, error: "ไม่พบจุดผูกปมในนิยายนี้" }
        if (patch.tension != null && (!Number.isInteger(patch.tension) || patch.tension < 1 || patch.tension > 5)) {
            return { success: false, error: "ความตึงต้องเป็น 1-5" }
        }
        // ประเด็นต้องเป็นของปมเดียวกับ beat
        if (patch.pointId && (await pointThread(patch.pointId, novelId)) !== owned.threadId) {
            return { success: false, error: "ประเด็นนี้ไม่ได้อยู่ในปมเดียวกัน" }
        }
        const [beat] = await db.update(plotThreadBeats).set(patch).where(eq(plotThreadBeats.id, id)).returning()
        revalidatePath(plotPath(novelId))
        return { success: true, data: beat }
    } catch (error) {
        console.error("updateBeat error:", error)
        return { success: false, error: "อัปเดตจุดผูกปมไม่สำเร็จ" }
    }
}

// ── ความสัมพันธ์ระหว่างปม ──

export async function addLink(data: { novelId: string; fromThreadId: string; toThreadId: string; kind: "before" | "misdirects" }) {
    try {
        await requireNovelAccess(data.novelId)
        if (data.fromThreadId === data.toThreadId) return { success: false, error: "ผูกปมกับตัวเองไม่ได้" }
        if (data.kind !== "before" && data.kind !== "misdirects") return { success: false, error: "ชนิดความสัมพันธ์ไม่ถูกต้อง" }
        if (!(await ownThreads([data.fromThreadId, data.toThreadId], data.novelId))) return { success: false, error: "ไม่พบปมในนิยายนี้" }
        const [link] = await db.insert(plotThreadLinks)
            .values({ fromThreadId: data.fromThreadId, toThreadId: data.toThreadId, kind: data.kind })
            .onConflictDoNothing()
            .returning()
        revalidatePath(plotPath(data.novelId))
        return { success: true, data: link ?? null }
    } catch (error) {
        console.error("addLink error:", error)
        return { success: false, error: "เพิ่มความสัมพันธ์ไม่สำเร็จ" }
    }
}

export async function deleteLink(id: string, novelId: string) {
    try {
        await requireNovelAccess(novelId)
        const [owned] = await db.select({ id: plotThreadLinks.id })
            .from(plotThreadLinks)
            .innerJoin(plotThreads, eq(plotThreads.id, plotThreadLinks.fromThreadId))
            .where(and(eq(plotThreadLinks.id, id), eq(plotThreads.novelId, novelId))).limit(1)
        if (!owned) return { success: false, error: "ไม่พบความสัมพันธ์ในนิยายนี้" }
        await db.delete(plotThreadLinks).where(eq(plotThreadLinks.id, id))
        revalidatePath(plotPath(novelId))
        return { success: true }
    } catch (error) {
        console.error("deleteLink error:", error)
        return { success: false, error: "ลบความสัมพันธ์ไม่สำเร็จ" }
    }
}

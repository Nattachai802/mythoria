"use server"

import { db } from "@/db/drizzle";
import { timelineEvents, sceneElementDetails, InsertTimelineEvent } from "@/db/schema"
import { eq, and, asc, desc, lt, inArray, count } from "drizzle-orm"
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

/** กี่ฉากก่อนหน้าที่ถือว่า "ใกล้ตัว" — ตัวละครในฉากติดกันมีโอกาสโผล่ต่อสูงสุด */
const NEARBY_SCENE_WINDOW = 2;

export type NearbyParticipants = {
    /** ตัวจริงที่อยู่ใน N ฉากก่อนหน้า — เรียงจากฉากใกล้สุดก่อน */
    recentIds: string[];
    /** ชื่อ dummy ที่อยู่ใน N ฉากก่อนหน้า — เรียงจากฉากใกล้สุดก่อน */
    recentDummyTitles: string[];
    /** ตัวจริงที่ใช้บ่อยทั้งเล่ม เรียงมาก→น้อย (ใช้เติมท้ายเมื่อฉากก่อนหน้ามีไม่พอ) */
    frequentIds: string[];
};

const EMPTY_NEARBY: NearbyParticipants = { recentIds: [], recentDummyTitles: [], frequentIds: [] };

/**
 * ผู้เข้าร่วมที่ควรเสนอให้กดเร็ว — สองชั้น: ฉากก่อนหน้าใกล้ ๆ มาก่อน แล้วค่อยความถี่ทั้งเล่ม
 *
 * ตัวจริงนับจาก scene_element_details (แถวเกิดตอน "ผูกผู้เข้าร่วมเข้าการ์ด" จริง = สัญญาณการใช้งาน
 * ส่วน canvasData มีของค้างจากการลาก/ลบที่ไม่ได้ล้าง) — แต่ dummy นับจากตารางนั้นไม่ได้เพราะ
 * elementId ของมันเป็น uuid ใหม่ทุกครั้งที่กดเพิ่ม ต้องอ่านชื่อจาก canvasData แทน
 */
export async function getNearbyParticipants(novelId: string, sceneId: string) {
    try {
        await requireNovelAccess(novelId);

        const current = await db.query.timelineEvents.findFirst({
            where: and(eq(timelineEvents.id, sceneId), eq(timelineEvents.novelId, novelId)),
            columns: { orderIndex: true },
        });

        // ฉากก่อนหน้า N ฉาก เรียงจากใกล้สุดก่อน — ฉากแรกของเรื่องจะไม่มีเลย ปล่อยว่างได้
        const prevScenes = current
            ? await db.query.timelineEvents.findMany({
                where: and(
                    eq(timelineEvents.novelId, novelId),
                    lt(timelineEvents.orderIndex, current.orderIndex),
                ),
                columns: { id: true, canvasData: true },
                orderBy: [desc(timelineEvents.orderIndex)],
                limit: NEARBY_SCENE_WINDOW,
            })
            : [];

        const recentIds: string[] = [];
        const recentDummyTitles: string[] = [];
        if (prevScenes.length > 0) {
            const details = await db
                .select({ sceneId: sceneElementDetails.sceneId, elementId: sceneElementDetails.elementId })
                .from(sceneElementDetails)
                .where(and(
                    eq(sceneElementDetails.novelId, novelId),
                    inArray(sceneElementDetails.sceneId, prevScenes.map(s => s.id)),
                    inArray(sceneElementDetails.elementType, ["character", "faction"]),
                ));

            // วนตามลำดับฉาก (ใกล้สุดก่อน) เพื่อให้ผลลัพธ์เรียงตามความใกล้ ไม่ใช่ลำดับที่ DB คืนมา
            for (const scene of prevScenes) {
                for (const d of details) {
                    if (d.sceneId === scene.id && !recentIds.includes(d.elementId)) recentIds.push(d.elementId);
                }
                for (const item of ((scene.canvasData as any[]) || [])) {
                    for (const ch of (item?.children || [])) {
                        const isDummy = ch?.type === "dummy_character" || ch?.type === "dummy_faction";
                        if (isDummy && ch.title && !recentDummyTitles.includes(ch.title)) recentDummyTitles.push(ch.title);
                    }
                }
            }
        }

        const frequent = await db
            .select({ elementId: sceneElementDetails.elementId, uses: count() })
            .from(sceneElementDetails)
            .where(and(
                eq(sceneElementDetails.novelId, novelId),
                inArray(sceneElementDetails.elementType, ["character", "faction"]),
            ))
            .groupBy(sceneElementDetails.elementId)
            .orderBy(desc(count()))
            .limit(30);

        return {
            success: true,
            data: { recentIds, recentDummyTitles, frequentIds: frequent.map(f => f.elementId) },
        };
    } catch (error) {
        console.error("getNearbyParticipants error:", error);
        return { success: false, data: EMPTY_NEARBY };
    }
}

export type BoardChapter = {
    id: string
    name: string
    startBeat: number
    endBeat: number
    sceneId: string
    sceneTitle: string
    sceneOrder: number
}

/**
 * "ตอน" ที่แบ่งไว้บนกระดานพล็อตทุกบอร์ดของนิยายนี้
 *
 * ตอนไม่ได้อยู่ในตารางของตัวเอง — เก็บเป็น node ชนิด "chapter" ปนอยู่ใน timeline_events.canvasData
 * เรียงตามลำดับฉาก แล้วตามจังหวะเริ่มในฉากนั้น = ลำดับเรื่องจริง ตัวท้ายสุดคือตอนล่าสุด
 */
export async function getNovelBoardChapters(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.novelId, novelId),
            columns: { id: true, title: true, canvasData: true, orderIndex: true },
            orderBy: [asc(timelineEvents.orderIndex)],
        });

        const chapters: BoardChapter[] = [];
        for (const ev of events) {
            const nodes = ((ev.canvasData as any[]) || []).filter(n => n?.type === "chapter");
            nodes.sort((a, b) => (a.startBeat ?? 0) - (b.startBeat ?? 0));
            for (const n of nodes) {
                chapters.push({
                    id: n.id,
                    name: n.name || "ตอน",
                    startBeat: n.startBeat ?? 0,
                    endBeat: n.endBeat ?? n.startBeat ?? 0,
                    sceneId: ev.id,
                    sceneTitle: ev.title || "(ไม่มีชื่อ)",
                    sceneOrder: ev.orderIndex ?? 0,
                });
            }
        }
        return { success: true, data: chapters };
    } catch (error) {
        console.error("getNovelBoardChapters error:", error);
        return { success: false, data: [] as BoardChapter[] };
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

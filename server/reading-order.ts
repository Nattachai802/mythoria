import "server-only";

import { db } from "@/db/drizzle";
import { chapters, notes } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

/**
 * ลำดับการอ่านของนิยาย — จุดเดียวในระบบที่ตอบว่า "ตอนไหนมาก่อนตอนไหน"
 *
 * ลำดับเป็นสองชั้น: chapters.orderIndex แล้วค่อย notes.orderIndex
 * ทุกฟีเจอร์ที่ต้องรู้ลำดับ (baseline ของรายงานรายตอน, การกันไม่ให้ผู้อ่านจำลอง
 * เห็นตอนอนาคต, แกน x ของกราฟ) ต้องเรียกผ่านที่นี่ ไม่ใช่คำนวณเอง — เพื่อให้
 * วันที่กติกาเปลี่ยน แก้ที่เดียว
 *
 * ตอนที่ไม่ผูกบท (linkedToChapterId เป็น null) ถือว่า "ไม่มีตำแหน่ง" และถูกตัดออก
 * ทั้งหมด ไม่ใช่เดาด้วย createdAt — โน้ตวางแผนที่ไม่ใช่เนื้อเรื่องจะแทรกเข้ามาปน
 * และทำให้ทั้ง baseline และการกันสปอยล์ผิดโดยไม่มีใครรู้
 */

export type ReadingOrderEntry = {
    noteId: string;
    chapterId: string;
    chapterOrder: number;
    orderIndex: number;
    /** ตำแหน่งในลำดับการอ่าน เริ่มที่ 0 นับต่อเนื่องข้ามบท */
    position: number;
};

export type ReadingOrder = {
    ordered: ReadingOrderEntry[];
    positionOf: Map<string, number>;
    /** noteId ที่ไม่ผูกบท — ไม่มีตำแหน่ง */
    unpositioned: Set<string>;
};

export async function getReadingOrder(novelId: string): Promise<ReadingOrder> {
    const rows = await db
        .select({
            noteId: notes.id,
            chapterId: notes.linkedToChapterId,
            chapterOrder: chapters.orderIndex,
            orderIndex: notes.orderIndex,
        })
        .from(notes)
        .leftJoin(chapters, eq(notes.linkedToChapterId, chapters.id))
        .where(and(eq(notes.novelId, novelId), isNull(notes.deletedAt)))
        .orderBy(asc(chapters.orderIndex), asc(notes.orderIndex));

    const ordered: ReadingOrderEntry[] = [];
    const positionOf = new Map<string, number>();
    const unpositioned = new Set<string>();

    for (const r of rows) {
        if (!r.chapterId || r.chapterOrder === null) {
            unpositioned.add(r.noteId);
            continue;
        }
        positionOf.set(r.noteId, ordered.length);
        ordered.push({
            noteId: r.noteId,
            chapterId: r.chapterId,
            chapterOrder: r.chapterOrder,
            orderIndex: r.orderIndex,
            position: ordered.length,
        });
    }

    return { ordered, positionOf, unpositioned };
}

/** noteId ของทุกตอนที่อยู่ "ก่อน" ตอนนี้ในลำดับการอ่าน */
export function notesBefore(order: ReadingOrder, noteId: string): string[] {
    const pos = order.positionOf.get(noteId);
    if (pos === undefined) return [];
    return order.ordered.slice(0, pos).map((e) => e.noteId);
}

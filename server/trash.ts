"use server";

import { db } from "@/db/drizzle";
import { novels, chapters, notes } from "@/db/schema";
import { eq, and, isNull, isNotNull, desc, lt } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-config";
import { requireNovelAccess, requireUser, authErrorMessage } from "@/lib/authz";
import { TRASH_RETENTION_DAYS, daysLeft, type TrashEntry } from "@/lib/trash";

/**
 * ถังขยะแบบ Google Drive — ลบแล้วยังกู้คืนได้ 7 วัน
 *
 * ทุกที่ที่อ่าน novels/chapters/notes ต้องกรอง `isNull(deletedAt)` เสมอ
 * ไม่งั้นของที่ลบแล้วจะโผล่กลับมาหลอนในหน้านั้น
 */
/** ของในถังขยะของ user คนนี้ — novel ของตัวเอง + chapter/note ในนิยายที่ยังไม่ถูกลบ */
export const listTrash = async (): Promise<{ success: boolean; items?: TrashEntry[]; message?: string }> => {
    try {
        const userId = await requireUser();
        const now = Date.now();

        const deletedNovels = await db
            .select({ id: novels.id, title: novels.title, deletedAt: novels.deletedAt })
            .from(novels)
            .where(and(eq(novels.userId, userId), isNotNull(novels.deletedAt)))
            .orderBy(desc(novels.deletedAt));

        // chapter/note ที่ลบเดี่ยว ๆ — ไม่รวมของในนิยายที่ถูกลบทั้งเล่ม (กู้นิยายก็ได้คืนมาทั้งก้อนอยู่แล้ว)
        const deletedChapters = await db
            .select({ id: chapters.id, title: chapters.title, novelId: chapters.novelId, deletedAt: chapters.deletedAt })
            .from(chapters)
            .innerJoin(novels, eq(chapters.novelId, novels.id))
            .where(and(eq(novels.userId, userId), isNull(novels.deletedAt), isNotNull(chapters.deletedAt)))
            .orderBy(desc(chapters.deletedAt));

        const deletedNotes = await db
            .select({ id: notes.id, title: notes.title, novelId: notes.novelId, deletedAt: notes.deletedAt })
            .from(notes)
            .innerJoin(novels, eq(notes.novelId, novels.id))
            .where(and(eq(novels.userId, userId), isNull(novels.deletedAt), isNotNull(notes.deletedAt)))
            .orderBy(desc(notes.deletedAt));

        const items: TrashEntry[] = [
            ...deletedNovels.map(n => ({ kind: "novel" as const, id: n.id, title: n.title, novelId: n.id, deletedAt: n.deletedAt!, daysLeft: daysLeft(n.deletedAt!, now) })),
            ...deletedChapters.map(c => ({ kind: "chapter" as const, id: c.id, title: c.title, novelId: c.novelId, deletedAt: c.deletedAt!, daysLeft: daysLeft(c.deletedAt!, now) })),
            ...deletedNotes.map(n => ({ kind: "note" as const, id: n.id, title: n.title, novelId: n.novelId, deletedAt: n.deletedAt!, daysLeft: daysLeft(n.deletedAt!, now) })),
        ].sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

        return { success: true, items };
    } catch (error) {
        console.error("List trash error:", error);
        return { success: false, message: authErrorMessage(error, "Failed to load trash") };
    }
};

/** เจ้าของ novel ที่ item นี้สังกัด — ใช้เช็คสิทธิ์ก่อนกู้/ลบถาวร (ต้องหาแบบไม่กรอง deletedAt เพราะของในถังคือของที่ลบแล้ว) */
async function novelIdOf(kind: TrashEntry["kind"], id: string): Promise<string | null> {
    if (kind === "novel") return id;
    const table = kind === "chapter" ? chapters : notes;
    const [row] = await db.select({ novelId: table.novelId }).from(table).where(eq(table.id, id)).limit(1);
    return row?.novelId ?? null;
}

export const restoreFromTrash = async (kind: TrashEntry["kind"], id: string) => {
    try {
        const novelId = await novelIdOf(kind, id);
        if (!novelId) return { success: false, message: "Not found" };
        await requireNovelAccess(novelId);

        const table = kind === "novel" ? novels : kind === "chapter" ? chapters : notes;
        await db.update(table).set({ deletedAt: null }).where(eq(table.id, id));

        revalidateTag(CACHE_TAGS.novel(novelId), "default");
        revalidateTag(CACHE_TAGS.notes(novelId), "default");
        revalidateTag(CACHE_TAGS.chapters(novelId), "default");
        return { success: true, message: "กู้คืนแล้ว" };
    } catch (error) {
        console.error("Restore error:", error);
        return { success: false, message: authErrorMessage(error, "Failed to restore") };
    }
};

/** ลบถาวร — ตรงนี้ลบจริง กู้ไม่ได้ (FK cascade จะพาลูก ๆ ไปด้วยตามที่สคีมากำหนดไว้แล้ว) */
export const purgeFromTrash = async (kind: TrashEntry["kind"], id: string) => {
    try {
        const novelId = await novelIdOf(kind, id);
        if (!novelId) return { success: false, message: "Not found" };
        await requireNovelAccess(novelId);

        const table = kind === "novel" ? novels : kind === "chapter" ? chapters : notes;
        // ต้องอยู่ในถังขยะอยู่แล้วเท่านั้น — กัน bug ที่ไหนก็ตามเรียกฟังก์ชันนี้กับของที่ยังใช้งานอยู่
        await db.delete(table).where(and(eq(table.id, id), isNotNull(table.deletedAt)));

        revalidateTag(CACHE_TAGS.novel(novelId), "default");
        revalidateTag(CACHE_TAGS.notes(novelId), "default");
        revalidateTag(CACHE_TAGS.chapters(novelId), "default");
        return { success: true, message: "ลบถาวรแล้ว" };
    } catch (error) {
        console.error("Purge error:", error);
        return { success: false, message: authErrorMessage(error, "Failed to delete permanently") };
    }
};

/**
 * ล้างของที่อยู่ในถังเกิน 7 วัน — เรียกตอนเปิดหน้าถังขยะ
 * ponytail: ไม่ตั้ง cron เพราะยังไม่มีที่รัน (Vercel/VPS ยังไม่ deploy) ข้อความไม่กินที่ ค้างไว้ไม่เสียหาย
 * ถ้าอยากให้ตรงเวลาเป๊ะค่อยย้ายไป cron job แล้วเรียกฟังก์ชันนี้ตัวเดิม
 */
export const purgeExpiredTrash = async () => {
    await requireUser(); // ไฟล์นี้เป็น "use server" — ทุก export คือ endpoint ที่ client เรียกได้
    const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 86400_000);
    for (const table of [notes, chapters, novels]) {
        await db.delete(table).where(and(isNotNull(table.deletedAt), lt(table.deletedAt, cutoff)));
    }
};

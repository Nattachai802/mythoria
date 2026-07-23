'use server';

import { db } from "@/db/drizzle";
import { noteVersions, notes } from "@/db/schema";
import { eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireNovelAccess } from "@/lib/authz";

const MAX_VERSIONS = 3;

// ============================================
// CREATE VERSION
// ============================================

/**
 * สร้าง version ใหม่สำหรับ note
 * ถ้ามีเกิน 3 versions จะลบ version เก่าสุดออก
 */
export async function createNoteVersion(
    noteId: string,
    title: string,
    content: any,
    wordCount: number,
    saveType: "manual" | "auto"
) {
    try {
        // ยืนยันเจ้าของ note ก่อน (noteId → notes.novelId)
        const [note] = await db.select({ novelId: notes.novelId }).from(notes).where(eq(notes.id, noteId)).limit(1);
        if (!note) return { success: false, error: "Note not found" };
        await requireNovelAccess(note.novelId);

        // 1. หา version number ล่าสุด
        const existingVersions = await db
            .select({ versionNumber: noteVersions.versionNumber })
            .from(noteVersions)
            .where(eq(noteVersions.noteId, noteId))
            .orderBy(desc(noteVersions.versionNumber))
            .limit(1);

        const nextVersionNumber = existingVersions.length > 0
            ? existingVersions[0].versionNumber + 1
            : 1;

        // 2. สร้าง version ใหม่
        await db.insert(noteVersions).values({
            noteId,
            title,
            content,
            wordCount,
            versionNumber: nextVersionNumber,
            saveType,
        });

        // 3. ลบ versions เก่าถ้าเกิน MAX_VERSIONS
        const allVersions = await db
            .select({ id: noteVersions.id, versionNumber: noteVersions.versionNumber })
            .from(noteVersions)
            .where(eq(noteVersions.noteId, noteId))
            .orderBy(desc(noteVersions.versionNumber));

        if (allVersions.length > MAX_VERSIONS) {
            const versionsToDelete = allVersions.slice(MAX_VERSIONS);
            for (const v of versionsToDelete) {
                await db.delete(noteVersions).where(eq(noteVersions.id, v.id));
            }
        }

        return { success: true, versionNumber: nextVersionNumber };
    } catch (error) {
        console.error("Failed to create version:", error);
        return { success: false, error: "Failed to create version" };
    }
}

// ============================================
// GET VERSIONS
// ============================================

/**
 * ดึง versions ทั้งหมดของ note (เรียงจากใหม่ไปเก่า)
 */
export async function getNoteVersions(noteId: string) {
    try {
        const [note] = await db.select({ novelId: notes.novelId }).from(notes).where(eq(notes.id, noteId)).limit(1);
        if (!note) return { success: false, versions: [], error: "Note not found" };
        await requireNovelAccess(note.novelId);

        const versions = await db
            .select()
            .from(noteVersions)
            .where(eq(noteVersions.noteId, noteId))
            .orderBy(desc(noteVersions.createdAt));

        return { success: true, versions };
    } catch (error) {
        console.error("Failed to get versions:", error);
        return { success: false, versions: [], error: "Failed to get versions" };
    }
}

// ============================================
// RESTORE VERSION
// ============================================

/**
 * กู้คืน note จาก version เก่า
 * จะสร้าง version ใหม่ก่อน restore เพื่อเก็บ state ปัจจุบัน
 */
export async function restoreNoteVersion(versionId: string, novelId: string) {
    try {
        // 1. ดึง version ที่ต้องการ restore
        const [version] = await db
            .select()
            .from(noteVersions)
            .where(eq(noteVersions.id, versionId));

        if (!version) {
            return { success: false, error: "Version not found" };
        }

        // 2. ดึง note ปัจจุบัน
        const [currentNote] = await db
            .select()
            .from(notes)
            .where(eq(notes.id, version.noteId));

        if (!currentNote) {
            return { success: false, error: "Note not found" };
        }
        // เช็คสิทธิ์จาก novelId จริงของ note ไม่ใช่ค่าที่ client ส่งมา
        await requireNovelAccess(currentNote.novelId);

        // 3. สร้าง version ใหม่จาก state ปัจจุบัน (ก่อน restore)
        const contentText = (currentNote.content as any)?.text || "";
        const currentWordCount = contentText.replace(/<[^>]*>/g, ' ').trim().split(/\s+/).length;

        await createNoteVersion(
            currentNote.id,
            currentNote.title,
            currentNote.content,
            currentWordCount,
            "manual"
        );

        // 4. Update note ด้วย content จาก version เก่า
        await db
            .update(notes)
            .set({
                title: version.title,
                content: version.content,
            })
            .where(eq(notes.id, version.noteId));

        revalidatePath(`/dashboard/project/${novelId}/note/${version.noteId}`);

        return { success: true, restoredVersion: version.versionNumber };
    } catch (error) {
        console.error("Failed to restore version:", error);
        return { success: false, error: "Failed to restore version" };
    }
}

// ============================================
// GET VERSIONS FOR COMPARE
// ============================================

/**
 * ดึง 2 versions สำหรับเปรียบเทียบ
 */
export async function getVersionsForCompare(version1Id: string, version2Id: string) {
    try {
        const [v1] = await db
            .select()
            .from(noteVersions)
            .where(eq(noteVersions.id, version1Id));

        const [v2] = await db
            .select()
            .from(noteVersions)
            .where(eq(noteVersions.id, version2Id));

        if (!v1 || !v2) {
            return { success: false, error: "One or both versions not found" };
        }

        // เช็คสิทธิ์ผ่าน note เจ้าของของแต่ละ version
        for (const noteId of new Set([v1.noteId, v2.noteId])) {
            const [note] = await db.select({ novelId: notes.novelId }).from(notes).where(eq(notes.id, noteId)).limit(1);
            if (!note) return { success: false, error: "Note not found" };
            await requireNovelAccess(note.novelId);
        }

        return {
            success: true,
            version1: v1,
            version2: v2,
        };
    } catch (error) {
        console.error("Failed to get versions for compare:", error);
        return { success: false, error: "Failed to get versions" };
    }
}

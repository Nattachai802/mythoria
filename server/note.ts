"use server";

import { db } from "@/db/drizzle";
import { notes, InsertNote } from "@/db/schema";
import { eq, desc, and, or, like, gt, lt, ne, asc } from "drizzle-orm";
import { syncChapterCharactersFromNotes } from "./analysis-helper";
import { recalculateNovelWordCountFromNotes } from "./word-count";
import { queueNoteForStateExtraction } from "./character-state-extractor";
import { revalidateTag, revalidatePath, unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_DURATION } from "@/lib/cache-config";
import { NoteStatus } from "@/lib/note-constants";

export const createNote = async (data: InsertNote) => {
    try {
        const [newNote] = await db.insert(notes).values(data).returning();

        // Clear cache (Next.js 16 requires 2 args: tag, profile)
        revalidateTag(CACHE_TAGS.notes(newNote.novelId), "default");
        revalidateTag(CACHE_TAGS.novel(newNote.novelId), "default");

        // Trigger auto-analysis if linked to a chapter
        if (newNote.linkedToChapterId) {
            syncChapterCharactersFromNotes(newNote.linkedToChapterId, newNote.novelId)
                .catch(err => console.error("Background sync failed:", err));
        }

        // Recalculate novel word count in background
        recalculateNovelWordCountFromNotes(newNote.novelId)
            .catch(err => console.error("Word count recalculation failed:", err));

        // Queue for character state extraction
        queueNoteForStateExtraction(newNote.id, newNote.novelId)
            .catch(err => console.error("Failed to queue state extraction:", err));

        return { success: true, message: "Note created successfully", note: newNote };
    } catch (error) {
        console.error("Create note error:", error);
        return { success: false, message: "Failed to create note" };
    }
};

// Internal function
const _getNotes = async (novelId: string, type?: string) => {
    try {
        const conditions = [eq(notes.novelId, novelId)];
        if (type && type !== "all") {
            conditions.push(eq(notes.type, type));
        }

        const allNotes = await db.query.notes.findMany({
            where: and(...conditions),
            orderBy: [desc(notes.createdAt)],
            with: {
                linkedChapter: true,
                linkedCharacter: true,
                linkedLocation: true,
            }
        });
        return { success: true as const, notes: allNotes };
    } catch (error) {
        console.error("Get notes error:", error);
        return { success: false as const, message: "Failed to get notes" };
    }
};

// Cached version - getNotes with 30s cache (shorter because notes change more frequently)
export const getNotes = async (novelId: string, type?: string) => {
    const cachedFn = unstable_cache(
        () => _getNotes(novelId, type),
        [`notes-${novelId}-${type || 'all'}`],
        {
            revalidate: 30, // 30 seconds for notes
            tags: [CACHE_TAGS.notes(novelId)]
        }
    );
    return cachedFn();
};

export const getNote = async (noteId: string) => {
    try {
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, noteId),
            with: {
                linkedChapter: true,
                linkedCharacter: true,
                linkedLocation: true
            }
        });

        if (!note) {
            return { success: false, message: "Note not found" };
        }

        return { success: true, note };
    } catch (error) {
        console.error("Get note error:", error);
        return { success: false, message: "Failed to get note" };
    }
};

export const searchNotes = async (novelId: string, query: string) => {
    try {
        const searchResults = await db.query.notes.findMany({
            where: and(
                eq(notes.novelId, novelId),
                or(
                    like(notes.title, `%${query}%`),
                )
            ),
            orderBy: [desc(notes.createdAt)],
        });

        return { success: true, notes: searchResults };
    } catch (error) {
        console.error("Search notes error:", error);
        return { success: false, message: "Failed to search notes" };
    }
};

export const updateNote = async (noteId: string, data: Partial<InsertNote>) => {
    try {
        const [updatedNote] = await db.update(notes)
            .set({
                ...data,
                updatedAt: new Date() // อัปเดตเวลาแก้ไขเสมอ
            })
            .where(eq(notes.id, noteId))
            .returning();

        // Clear cache
        revalidateTag(CACHE_TAGS.notes(updatedNote.novelId), "default");
        // Trigger auto-analysis if linked to a chapter
        if (updatedNote.linkedToChapterId) {
            // Run in background (fire and forget) to not block UI
            syncChapterCharactersFromNotes(updatedNote.linkedToChapterId, updatedNote.novelId)
                .catch(err => console.error("Background sync failed:", err));
        }

        // Recalculate novel word count in background (only if content was updated)
        if (data.content !== undefined) {
            recalculateNovelWordCountFromNotes(updatedNote.novelId)
                .catch(err => console.error("Word count recalculation failed:", err));

            // Queue for character state extraction
            queueNoteForStateExtraction(updatedNote.id, updatedNote.novelId)
                .catch(err => console.error("Failed to queue state extraction:", err));
        }

        return { success: true, message: "Note updated successfully", note: updatedNote };
    } catch (error) {
        console.error("Update note error:", error);
        return { success: false, message: "Failed to update note" };
    }
};

export const deleteNote = async (noteId: string) => {
    try {
        // Get note first to know novelId
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, noteId),
        });

        if (!note) {
            return { success: false, message: "Note not found" };
        }

        const novelId = note.novelId;

        // Delete the note
        await db.delete(notes).where(eq(notes.id, noteId));

        // Clear cache
        revalidateTag(CACHE_TAGS.notes(novelId), "default");
        revalidateTag(CACHE_TAGS.novel(novelId), "default");

        // Recalculate novel word count after deletion
        recalculateNovelWordCountFromNotes(novelId)
            .catch(err => console.error("Word count recalculation failed:", err));

        return { success: true, message: "Note deleted successfully" };
    } catch (error) {
        console.error("Delete note error:", error);
        return { success: false, message: "Failed to delete note" };
    }
};

export const updateNoteStatus = async (noteId: string, status: NoteStatus) => {
    try {
        const [updatedNote] = await db.update(notes)
            .set({
                status,
                updatedAt: new Date()
            })
            .where(eq(notes.id, noteId))
            .returning();

        return { success: true, message: "Status updated successfully", note: updatedNote };
    } catch (error) {
        console.error("Update note status error:", error);
        return { success: false, message: "Failed to update status" };
    }
};

/**
 * ค้นหา note ถัดไปใน chapter เดียวกัน (เรียงตาม createdAt)
 * ถ้าไม่มี → สร้างใหม่แล้ว return URL ให้ client navigate เอง
 *
 * หมายเหตุ:
 * - ไม่เรียก createNote() เพื่อหลีก queueNoteForStateExtraction ที่ช้า (background AI jobs)
 * - return redirectUrl แทนการใช้ redirect() เพื่อให้ client ทำ SPA navigation ที่เร็วกว่า
 */
export const getOrCreateNextNote = async (
    currentNoteId: string,
    novelId: string,
    linkedToChapterId: string | null
): Promise<{ success: boolean; message?: string; redirectUrl?: string }> => {
    console.log("[getOrCreateNextNote] Called with:", { currentNoteId, novelId, linkedToChapterId });
    try {
        // 1. ดึง note ปัจจุบันเพื่อเอา createdAt
        const currentNote = await db.query.notes.findFirst({
            where: eq(notes.id, currentNoteId),
            columns: { id: true, createdAt: true },
        });

        if (!currentNote) {
            console.log("[getOrCreateNextNote] Current note not found!");
            return { success: false, message: "Note not found" };
        }
        console.log("[getOrCreateNextNote] Current note createdAt:", currentNote.createdAt);

        // 2. ถ้า note ผูกกับ chapter → หา note ถัดไปใน chapter เดียวกันที่สร้างทีหลัง
        if (linkedToChapterId) {
            console.log("[getOrCreateNextNote] Looking for next note in chapter:", linkedToChapterId);
            const nextNote = await db.query.notes.findFirst({
                where: and(
                    eq(notes.novelId, novelId),
                    eq(notes.linkedToChapterId, linkedToChapterId),
                    gt(notes.createdAt, currentNote.createdAt),
                    ne(notes.id, currentNoteId) // ป้องกัน timestamp precision ทำให้เจอ note ตัวเอง
                ),
                orderBy: [asc(notes.createdAt)],
                columns: { id: true },
            });

            if (nextNote) {
                const url = `/dashboard/project/${novelId}/note/${nextNote.id}`;
                console.log("[getOrCreateNextNote] Found next note, redirecting to:", url);
                return {
                    success: true,
                    redirectUrl: url,
                };
            }
            console.log("[getOrCreateNextNote] No next note found in chapter, creating new one...");
        }

        // 3. ไม่มีตอนถัดไป → INSERT โดยตรง (ไม่เรียก createNote เพื่อหลีก background jobs ที่ช้า)
        const [newNote] = await db.insert(notes).values({
            title: "ตอนใหม่",
            content: { text: "" },
            novelId,
            type: "general",
            ...(linkedToChapterId ? { linkedToChapterId } : {}),
        } as InsertNote).returning({ id: notes.id });

        if (!newNote) {
            console.log("[getOrCreateNextNote] Failed to create new note!");
            return { success: false, message: "Failed to create next note" };
        }

        // Revalidate cache ให้ notes list อัปเดต
        revalidateTag(CACHE_TAGS.notes(novelId), "default");

        const url = `/dashboard/project/${novelId}/note/${newNote.id}`;
        console.log("[getOrCreateNextNote] Created new note, redirecting to:", url);
        return {
            success: true,
            redirectUrl: url,
        };
    } catch (error) {
        console.error("getOrCreateNextNote error:", error);
        return { success: false, message: "Failed to navigate to next note" };
    }
};

/**
 * ค้นหา note ก่อนหน้าใน chapter เดียวกัน (เรียงตาม createdAt)
 * ถ้าไม่มี → return error (ไม่สร้างใหม่เหมือน next)
 */
export const getPreviousNote = async (
    currentNoteId: string,
    novelId: string,
    linkedToChapterId: string | null
): Promise<{ success: boolean; message?: string; redirectUrl?: string }> => {
    try {
        const currentNote = await db.query.notes.findFirst({
            where: eq(notes.id, currentNoteId),
            columns: { id: true, createdAt: true },
        });

        if (!currentNote) {
            return { success: false, message: "Note not found" };
        }

        if (linkedToChapterId) {
            const prevNote = await db.query.notes.findFirst({
                where: and(
                    eq(notes.novelId, novelId),
                    eq(notes.linkedToChapterId, linkedToChapterId),
                    lt(notes.createdAt, currentNote.createdAt),
                    ne(notes.id, currentNoteId)
                ),
                orderBy: [desc(notes.createdAt)],
                columns: { id: true },
            });

            if (prevNote) {
                return {
                    success: true,
                    redirectUrl: `/dashboard/project/${novelId}/note/${prevNote.id}`,
                };
            }
        }

        return { success: false, message: "ไม่มีตอนก่อนหน้า" };
    } catch (error) {
        console.error("getPreviousNote error:", error);
        return { success: false, message: "Failed to navigate to previous note" };
    }
};
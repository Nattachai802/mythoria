"use server";

import { db } from "@/db/drizzle";
import { notes, InsertNote } from "@/db/schema";
import { eq, desc, and, or, like } from "drizzle-orm";
import { syncChapterCharactersFromNotes } from "./analysis-helper";
import { recalculateNovelWordCountFromNotes } from "./word-count";
import { queueNoteForStateExtraction } from "./character-state-extractor";
import { revalidateTag, unstable_cache } from "next/cache";
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
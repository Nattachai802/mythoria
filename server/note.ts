"use server";

import { db } from "@/db/drizzle";
import { notes, InsertNote } from "@/db/schema";
import { eq, desc, and, or, like } from "drizzle-orm";
import { syncChapterCharactersFromNotes } from "./analysis-helper";
import { recalculateNovelWordCountFromNotes } from "./word-count";
import { queueNoteForStateExtraction } from "./character-state-extractor";

export const createNote = async (data: InsertNote) => {
    try {
        const [newNote] = await db.insert(notes).values(data).returning();

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

export const getNotes = async (novelId: string, type?: string) => {
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
        return { success: true, notes: allNotes };
    } catch (error) {
        console.error("Get notes error:", error);
        return { success: false, message: "Failed to get notes" };
    }
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

        // Recalculate novel word count after deletion
        recalculateNovelWordCountFromNotes(novelId)
            .catch(err => console.error("Word count recalculation failed:", err));

        return { success: true, message: "Note deleted successfully" };
    } catch (error) {
        console.error("Delete note error:", error);
        return { success: false, message: "Failed to delete note" };
    }
};
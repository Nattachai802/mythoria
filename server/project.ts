"use server";

import { db } from "@/db/drizzle";
import { InsertNote, notes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const getNotesByNovelId = async (novelId: string) => {
    try {
        const notesList = await db.query.notes.findMany({
            where: eq(notes.novelId, novelId),
            orderBy: [desc(notes.updatedAt)]
        });
        return { success: true, notes: notesList };
    } catch {
        return { success: false, message: "Failed to get notes" };
    }
};

export const createNote = async (values: InsertNote) => {
    try {
        await db.insert(notes).values(values);
        return { success: true, message: "Note created successfully" };
    } catch {
        return { success: false, message: "Failed to create note" };
    }
};

export const getNoteById = async (id: string) => {
    try {
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, id),
            with: {
                novel: true,
                linkedChapter: true,
                linkedCharacter: true,
                linkedLocation: true
            }
        });

        return { success: true, note };
    } catch {
        return { success: false, message: "Failed to get note" };
    }
};


export const updateNote = async (id: string, values: Partial<InsertNote>) => {
    try {
        await db.update(notes).set(values).where(eq(notes.id, id));
        return { success: true, message: "Note updated successfully" };
    } catch {
        return { success: false, message: "Failed to update note" };
    }
};

export const deleteNote = async (id: string) => {
    try {
        await db.delete(notes).where(eq(notes.id, id));
        return { success: true, message: "Note deleted successfully" };
    } catch {
        return { success: false, message: "Failed to delete note" };
    }
};
"use server";

import { db } from "@/db/drizzle";
import { notes, noteStylometry } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getNovelStylometry(novelId: string) {
    try {
        const data = await db
            .select({
                id: noteStylometry.id,
                noteId: noteStylometry.noteId,
                novelId: noteStylometry.novelId,
                pacingAndMood: noteStylometry.pacingAndMood,
                authorNarrationStyle: noteStylometry.authorNarrationStyle,
                characterDialogueVibes: noteStylometry.characterDialogueVibes,
                lexicalRichness: noteStylometry.lexicalRichness,
                chapterAnatomy: noteStylometry.chapterAnatomy,
                createdAt: noteStylometry.createdAt,
                // Join data from notes instead of chapters
                chapterTitle: notes.title,
                // fallback order
                createdAtNote: notes.createdAt,
            })
            .from(noteStylometry)
            .innerJoin(notes, eq(noteStylometry.noteId, notes.id))
            .where(eq(noteStylometry.novelId, novelId))
            .orderBy(asc(notes.createdAt));
            
        return { success: true, data };
    } catch (error: any) {
        console.error("Failed to fetch novel stylometry:", error);
        return { success: false, error: error.message };
    }
}

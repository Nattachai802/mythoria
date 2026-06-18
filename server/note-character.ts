"use server";

import { db } from "@/db/drizzle";
import { noteCharacters, notes, InsertNoteCharacter } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { syncChapterCharactersFromNotes } from "./analysis-helper";
import { addReference, removeReferenceEdge } from "./references";

// ponytail: dual-write to Context Fabric references (L1). Same pattern for the
// other MIGRATE junctions — copy these 3 calls when each gets touched.
const noteCharEdge = (noteId: string, characterId: string) =>
    ({ from: { type: "note", id: noteId }, to: { type: "character", id: characterId }, relation: "features" } as const);

// Add character to note's cast deck
export async function addCharacterToNote(noteId: string, characterId: string, role?: string) {
    try {
        // Check if already exists
        const existing = await db.query.noteCharacters.findFirst({
            where: and(
                eq(noteCharacters.noteId, noteId),
                eq(noteCharacters.characterId, characterId)
            )
        });

        if (existing) {
            return { success: false, message: "Character already added to this note" };
        }

        const [newNoteCharacter] = await db.insert(noteCharacters).values({
            noteId,
            characterId,
            role,
        }).returning();

        // Trigger sync for chapter if note is linked to a chapter
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, noteId)
        });

        if (note) {
            await addReference({ novelId: note.novelId, ...noteCharEdge(noteId, characterId), meta: role ? { role } : null });
        }

        if (note?.linkedToChapterId) {
            syncChapterCharactersFromNotes(note.linkedToChapterId, note.novelId)
                .catch(err => console.error("Background sync failed:", err));
        }

        return { success: true, noteCharacter: newNoteCharacter };
    } catch (error) {
        console.error("Add character to note error:", error);
        return { success: false, message: "Failed to add character" };
    }
}

// Remove character from note's cast deck
export async function removeCharacterFromNote(noteId: string, characterId: string) {
    try {
        await db.delete(noteCharacters).where(
            and(
                eq(noteCharacters.noteId, noteId),
                eq(noteCharacters.characterId, characterId)
            )
        );

        await removeReferenceEdge(noteCharEdge(noteId, characterId));

        // Trigger sync for chapter if note is linked to a chapter
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, noteId)
        });

        if (note?.linkedToChapterId) {
            syncChapterCharactersFromNotes(note.linkedToChapterId, note.novelId)
                .catch(err => console.error("Background sync failed:", err));
        }

        return { success: true, message: "Character removed from note" };
    } catch (error) {
        console.error("Remove character from note error:", error);
        return { success: false, message: "Failed to remove character" };
    }
}

// Get all characters in a note's cast deck
export async function getNoteCharacters(noteId: string) {
    try {
        const characters = await db.query.noteCharacters.findMany({
            where: eq(noteCharacters.noteId, noteId),
            with: {
                character: true
            }
        });

        return { success: true, characters };
    } catch (error) {
        console.error("Get note characters error:", error);
        return { success: false, message: "Failed to get characters" };
    }
}

// Update role of a character in note
export async function updateNoteCharacterRole(noteId: string, characterId: string, role: string) {
    try {
        const [updated] = await db.update(noteCharacters)
            .set({ role })
            .where(
                and(
                    eq(noteCharacters.noteId, noteId),
                    eq(noteCharacters.characterId, characterId)
                )
            )
            .returning();

        const note = await db.query.notes.findFirst({ where: eq(notes.id, noteId) });
        if (note) await addReference({ novelId: note.novelId, ...noteCharEdge(noteId, characterId), meta: { role } });

        return { success: true, noteCharacter: updated };
    } catch (error) {
        console.error("Update note character role error:", error);
        return { success: false, message: "Failed to update role" };
    }
}

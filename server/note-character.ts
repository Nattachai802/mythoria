"use server";

import { db } from "@/db/drizzle";
import { noteCharacters, notes, InsertNoteCharacter } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { syncChapterCharactersFromNotes } from "./analysis-helper";
import { addReference, removeReferenceEdge } from "./references";
import { requireNovelAccess } from "@/lib/authz";

// เช็คสิทธิ์เจ้าของผ่าน noteId (junction ไม่มี novelId ตรง ๆ) — คืน note ถ้าผ่าน, null ถ้าไม่พบ
async function noteAccessOrNull(noteId: string) {
    const note = await db.query.notes.findFirst({ where: and(eq(notes.id, noteId), isNull(notes.deletedAt)) });
    if (!note) return null;
    await requireNovelAccess(note.novelId);
    return note;
}

// ponytail: dual-write to Context Fabric references (L1). Same pattern for the
// other MIGRATE junctions — copy these 3 calls when each gets touched.
const noteCharEdge = (noteId: string, characterId: string) =>
    ({ from: { type: "note", id: noteId }, to: { type: "character", id: characterId }, relation: "features" } as const);

// Add character to note's cast deck
export async function addCharacterToNote(noteId: string, characterId: string, role?: string) {
    try {
        const note = await noteAccessOrNull(noteId);
        if (!note) return { success: false, message: "Note not found" };

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

        {
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
        const note = await noteAccessOrNull(noteId);
        if (!note) return { success: false, message: "Note not found" };

        await db.delete(noteCharacters).where(
            and(
                eq(noteCharacters.noteId, noteId),
                eq(noteCharacters.characterId, characterId)
            )
        );

        await removeReferenceEdge(noteCharEdge(noteId, characterId));

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
        if (!(await noteAccessOrNull(noteId))) return { success: false, message: "Note not found" };
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
        const note = await noteAccessOrNull(noteId);
        if (!note) return { success: false, message: "Note not found" };

        const [updated] = await db.update(noteCharacters)
            .set({ role })
            .where(
                and(
                    eq(noteCharacters.noteId, noteId),
                    eq(noteCharacters.characterId, characterId)
                )
            )
            .returning();

        await addReference({ novelId: note.novelId, ...noteCharEdge(noteId, characterId), meta: { role } });

        return { success: true, noteCharacter: updated };
    } catch (error) {
        console.error("Update note character role error:", error);
        return { success: false, message: "Failed to update role" };
    }
}

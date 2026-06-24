'use server';

import { db } from "@/db/drizzle";
import { chapterCharacters } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { addReference, removeReferenceEdge } from "./references"; // Context Fabric dual-write (P4)

// Get all characters that appear in a specific chapter
export async function getCharactersInChapter(chapterId: string) {
    try {
        const results = await db.query.chapterCharacters.findMany({
            where: (cc, { eq }) => eq(cc.chapterId, chapterId),
            with: {
                character: true
            }
        });
        return { success: true, data: results };
    } catch (error) {
        console.error("Error fetching characters in chapter:", error);
        return { success: false, error: "Failed to fetch characters" };
    }
}

// Add a character to a chapter
export async function addCharacterToChapter(data: {
    chapterId: string;
    characterId: string;
    role?: string;
    notes?: string;
    novelId: string; // Needed for revalidation
}) {
    try {
        // Check if already exists
        const existing = await db.query.chapterCharacters.findFirst({
            where: (cc, { eq, and }) => and(
                eq(cc.chapterId, data.chapterId),
                eq(cc.characterId, data.characterId)
            )
        });

        if (existing) {
            return { success: false, error: "Character is already in this chapter" };
        }

        await db.insert(chapterCharacters).values({
            chapterId: data.chapterId,
            characterId: data.characterId,
            role: data.role,
            notes: data.notes
        });

        await addReference({
            novelId: data.novelId,
            from: { type: "chapter", id: data.chapterId },
            to: { type: "character", id: data.characterId },
            relation: "features",
            meta: data.role ? { role: data.role } : null,
        });

        revalidatePath(`/dashboard/project/${data.novelId}/chapters/${data.chapterId}`);
        return { success: true };
    } catch (error) {
        console.error("Error adding character to chapter:", error);
        return { success: false, error: "Failed to add character" };
    }
}

// Remove a character from a chapter
export async function removeCharacterFromChapter(id: string, novelId: string, chapterId: string) {
    try {
        // ดึง characterId ก่อนลบ เพื่อลบ reference edge ให้ตรง
        const [row] = await db
            .select({ characterId: chapterCharacters.characterId, chapterId: chapterCharacters.chapterId })
            .from(chapterCharacters)
            .where(eq(chapterCharacters.id, id))
            .limit(1);
        await db.delete(chapterCharacters).where(eq(chapterCharacters.id, id));
        if (row) {
            await removeReferenceEdge({
                from: { type: "chapter", id: row.chapterId },
                to: { type: "character", id: row.characterId },
                relation: "features",
            });
        }
        revalidatePath(`/dashboard/project/${novelId}/chapters/${chapterId}`);
        return { success: true };
    } catch (error) {
        console.error("Error removing character from chapter:", error);
        return { success: false, error: "Failed to remove character" };
    }
}

// Update character details in a chapter (e.g. role, notes)
export async function updateCharacterInChapter(id: string, data: { role?: string, notes?: string }, novelId: string, chapterId: string) {
    try {
        await db.update(chapterCharacters)
            .set(data)
            .where(eq(chapterCharacters.id, id));

        revalidatePath(`/dashboard/project/${novelId}/chapters/${chapterId}`);
        return { success: true };
    } catch (error) {
        console.error("Error updating character in chapter:", error);
        return { success: false, error: "Failed to update character" };
    }
}

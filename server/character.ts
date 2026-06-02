'use server';

import { db } from "@/db/drizzle";
import { characters, characterRelationships, relationshipHistory, chapters } from "@/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * แยก public_id ออกจาก Cloudinary URL
 * เช่น https://res.cloudinary.com/xxx/image/upload/v123/mythoria/characters/abc.png
 * → mythoria/characters/abc
 */
function extractCloudinaryPublicId(url: string): string | null {
    try {
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

async function deleteCloudinaryImage(url: string): Promise<void> {
    const publicId = extractCloudinaryPublicId(url);
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`[Cloudinary] Deleted: ${publicId}`);
    } catch (err) {
        // ไม่ throw — การลบรูปเก่าล้มเหลวไม่ควรหยุดการ save
        console.error(`[Cloudinary] Failed to delete ${publicId}:`, err);
    }
}

export async function createCharacter(data: {
    name: string;
    role: string;
    novelId: string;
    description?: string;
    appearance?: string;
    personality?: string;
    backstory?: string;
    image?: string;
    age?: string;
    gender?: string;
    species?: string;
    goals?: string;
    motivation?: string;
    conflict?: string;
    strengths?: string;
    weaknesses?: string;
    aliases?: string[];
}) {
    try {
        const [newCharacter] = await db
            .insert(characters)
            .values(data)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/characters`);

        return { success: true, data: newCharacter };
    } catch (error) {
        console.error("Error creating character:", error);
        return { success: false, error: "Failed to create character" };
    }
}


export async function getCharactersByNovelId(novelId: string) {
    try {
        const allCharacters = await db
            .select()
            .from(characters)
            .where(eq(characters.novelId, novelId))
            .orderBy(characters.createdAt);

        return { success: true, data: allCharacters };
    } catch (error) {
        console.error("Error fetching characters:", error);
        return { success: false, error: "Failed to fetch characters" };
    }
}


export async function getCharacterById(characterId: string) {
    try {
        const [character] = await db
            .select()
            .from(characters)
            .where(eq(characters.id, characterId))
            .limit(1);

        if (!character) {
            return { success: false, error: "Character not found" };
        }

        return { success: true, data: character };
    } catch (error) {
        console.error("Error fetching character:", error);
        return { success: false, error: "Failed to fetch character" };
    }
}


export async function updateCharacter(
    characterId: string,
    data: Partial<{
        name: string;
        role: string;
        description: string;
        appearance: string;
        personality: string;
        backstory: string;
        image: string;
        age: string;
        gender: string;
        species: string;
        goals: string;
        motivation: string;
        conflict: string;
        strengths: string;
        weaknesses: string;
        aliases: string[];
    }>
) {
    try {
        // ถ้ามีการเปลี่ยนรูป ดึงรูปเก่าออกมาก่อน update
        let oldImageUrl: string | null = null;
        if (data.image !== undefined) {
            const [existing] = await db
                .select({ image: characters.image })
                .from(characters)
                .where(eq(characters.id, characterId))
                .limit(1);
            // เก็บรูปเก่าเฉพาะเมื่อมีรูปเก่าและรูปใหม่ต่างออกไป
            if (existing?.image && existing.image !== data.image) {
                oldImageUrl = existing.image;
            }
        }

        const [updatedCharacter] = await db
            .update(characters)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(characters.id, characterId))
            .returning();

        if (!updatedCharacter) {
            return { success: false, error: "Character not found" };
        }

        // ลบรูปเก่าจาก Cloudinary หลัง DB update สำเร็จแล้ว
        if (oldImageUrl) {
            await deleteCloudinaryImage(oldImageUrl);
        }

        revalidatePath(`/dashboard/project/${updatedCharacter.novelId}/characters`);

        return { success: true, data: updatedCharacter };
    } catch (error) {
        console.error("Error updating character:", error);
        return { success: false, error: "Failed to update character" };
    }
}


export async function deleteCharacter(characterId: string) {
    try {
        const [deletedCharacter] = await db
            .delete(characters)
            .where(eq(characters.id, characterId))
            .returning();

        if (!deletedCharacter) {
            return { success: false, error: "Character not found" };
        }

        revalidatePath(`/dashboard/project/${deletedCharacter.novelId}/characters`);

        return { success: true, data: deletedCharacter };
    } catch (error) {
        console.error("Error deleting character:", error);
        return { success: false, error: "Failed to delete character" };
    }
}


export async function createCharacterRelationship(data: {
    novelId: string;
    sourceCharacterId: string;
    targetCharacterId: string;
    type: string;
    description?: string;
    opinionLevel?: number;
    sentiment?: string;
}) {
    try {
        const [newRelationship] = await db
            .insert(characterRelationships)
            .values({
                ...data,
                opinionLevel: data.opinionLevel ?? 50,
                sentiment: data.sentiment ?? "neutral",
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/characters`);

        return { success: true, data: newRelationship };
    } catch (error) {
        console.error("Error creating relationship:", error);
        return { success: false, error: "Failed to create relationship" };
    }
}

export async function updateCharacterRelationship(
    relationshipId: string,
    data: Partial<{
        type: string;
        description: string;
        opinionLevel: number;
        sentiment: string;
    }>
) {
    try {
        const [updated] = await db
            .update(characterRelationships)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(characterRelationships.id, relationshipId))
            .returning();

        if (!updated) {
            return { success: false, error: "Relationship not found" };
        }

        revalidatePath(`/dashboard/project/${updated.novelId}/characters`);

        return { success: true, data: updated };
    } catch (error) {
        console.error("Error updating relationship:", error);
        return { success: false, error: "Failed to update relationship" };
    }
}

export async function getCharacterRelationships(characterId: string) {
    try {
        const relationships = await db.query.characterRelationships.findMany({
            where: (relationships, { eq, or }) => or(
                eq(relationships.sourceCharacterId, characterId),
                eq(relationships.targetCharacterId, characterId)
            ),
            with: {
                sourceCharacter: true,
                targetCharacter: true,
            }
        });

        // Transform data for easier frontend consumption
        const formattedRelationships = relationships.map((rel) => {
            const isSource = rel.sourceCharacterId === characterId;
            // The "other" character in the relationship
            const otherCharacter = isSource ? rel.targetCharacter : rel.sourceCharacter;

            return {
                id: rel.id,
                relationshipType: rel.type,
                description: rel.description,
                opinionLevel: rel.opinionLevel ?? 50,
                sentiment: rel.sentiment ?? "neutral",
                // Information about the related character
                character: {
                    id: otherCharacter.id,
                    name: otherCharacter.name,
                    role: otherCharacter.role,
                    image: otherCharacter.image,
                },
                // Metadata
                isSource, // schema: source -> target. If true, this character "views" the other as [type]
            };
        });

        return { success: true, data: formattedRelationships };
    } catch (error) {
        console.error("Error fetching relationships:", error);
        return { success: false, error: "Failed to fetch relationships" };
    }
}

export async function deleteCharacterRelationship(relationshipId: string) {
    try {
        const [deleted] = await db
            .delete(characterRelationships)
            .where(eq(characterRelationships.id, relationshipId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Relationship not found" };
        }

        revalidatePath(`/dashboard/project/${deleted.novelId}/characters`);

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting relationship:", error);
        return { success: false, error: "Failed to delete relationship" };
    }
}

export async function getAllCharacterRelationships(novelId: string) {
    try {
        const relationships = await db.query.characterRelationships.findMany({
            where: (relationships, { eq }) => eq(relationships.novelId, novelId),
            with: {
                sourceCharacter: true,
                targetCharacter: true,
            }
        });

        return { success: true, data: relationships };
    } catch (error) {
        console.error("Error fetching all relationships:", error);
        return { success: false, error: "Failed to fetch relationships" };
    }
}

// ============================================
// RELATIONSHIP HISTORY FUNCTIONS
// ============================================

export async function addRelationshipHistoryEntry(data: {
    relationshipId: string;
    novelId: string;
    chapterId?: string;
    opinionLevel: number;
    sentiment?: string;
    reason?: string;
}) {
    try {
        const [entry] = await db
            .insert(relationshipHistory)
            .values(data)
            .returning();

        return { success: true, data: entry };
    } catch (error) {
        console.error("Error adding relationship history:", error);
        return { success: false, error: "Failed to add history entry" };
    }
}

export async function getRelationshipHistory(relationshipId: string) {
    try {
        const history = await db.query.relationshipHistory.findMany({
            where: eq(relationshipHistory.relationshipId, relationshipId),
            with: {
                chapter: true,
            },
            orderBy: [asc(relationshipHistory.createdAt)],
        });

        return { success: true, data: history };
    } catch (error) {
        console.error("Error fetching relationship history:", error);
        return { success: false, error: "Failed to fetch history" };
    }
}

// Auto-record history when opinion level changes significantly
export async function recordOpinionChange(
    relationshipId: string,
    novelId: string,
    newOpinionLevel: number,
    chapterId?: string,
    reason?: string
) {
    try {
        // Get the last history entry to compare
        const lastEntry = await db.query.relationshipHistory.findFirst({
            where: eq(relationshipHistory.relationshipId, relationshipId),
            orderBy: [desc(relationshipHistory.createdAt)],
        });

        // Only record if:
        // 1. No previous entry exists, OR
        // 2. Opinion changed by at least 10 points, OR
        // 3. A reason was provided (explicit user action)
        const shouldRecord = !lastEntry ||
            Math.abs((lastEntry.opinionLevel || 50) - newOpinionLevel) >= 10 ||
            (reason && reason.trim().length > 0);

        if (!shouldRecord) {
            return { success: true, data: null, message: "Change too small to record" };
        }

        const sentiment = newOpinionLevel >= 60 ? "positive" :
            newOpinionLevel >= 40 ? "neutral" : "negative";

        const [entry] = await db
            .insert(relationshipHistory)
            .values({
                relationshipId,
                novelId,
                chapterId: chapterId || null,
                opinionLevel: newOpinionLevel,
                sentiment,
                reason: reason || null,
            })
            .returning();

        return { success: true, data: entry };
    } catch (error) {
        console.error("Error recording opinion change:", error);
        return { success: false, error: "Failed to record change" };
    }
}

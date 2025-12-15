'use server';

import { db } from "@/db/drizzle";
import { characters, characterRelationships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
        const [updatedCharacter] = await db
            .update(characters)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(characters.id, characterId))
            .returning();

        if (!updatedCharacter) {
            return { success: false, error: "Character not found" };
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
}) {
    try {
        const [newRelationship] = await db
            .insert(characterRelationships)
            .values(data)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/characters`);

        return { success: true, data: newRelationship };
    } catch (error) {
        console.error("Error creating relationship:", error);
        return { success: false, error: "Failed to create relationship" };
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

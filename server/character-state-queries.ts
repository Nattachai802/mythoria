"use server";

import { db } from "@/db/drizzle";
import { characterStates, InsertCharacterState } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface CharacterStateWithCharacter {
    id: string;
    noteId: string;
    characterId: string;
    novelId: string;
    locationId: string | null;
    locationName: string | null;
    locationCoordinates: string | null;
    inContactWith: unknown;
    health: number | null;
    energy: string | null;
    status: string | null;
    specificInjuries: unknown;
    mood: string | null;
    moodIntensity: number | null;
    currentObjective: string | null;
    equipment: unknown;
    abilitiesUsed: unknown;
    cooldowns: unknown;
    relationshipsDynamic: unknown;
    notes: string | null;
    aiConfidence: number | null;
    rawExtraction: unknown;
    isManuallyEdited: boolean | null;
    extractedAt: Date;
    character?: {
        id: string;
        name: string;
        image: string | null;
        role: string;
    } | null;
}

export async function getCharacterStatesForNote(noteId: string): Promise<{
    success: boolean;
    states: CharacterStateWithCharacter[];
    error?: string;
}> {
    try {
        const states = await db.query.characterStates.findMany({
            where: eq(characterStates.noteId, noteId),
            with: {
                character: true,
            },
        });

        return {
            success: true,
            states: states as CharacterStateWithCharacter[],
        };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching states:", error);
        return {
            success: false,
            states: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function getCharacterStatesForNovel(novelId: string): Promise<{
    success: boolean;
    states: CharacterStateWithCharacter[];
    error?: string;
}> {
    try {
        const states = await db.query.characterStates.findMany({
            where: eq(characterStates.novelId, novelId),
            with: {
                character: true,
                note: true,
            },
        });

        return {
            success: true,
            states: states as CharacterStateWithCharacter[],
        };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching states:", error);
        return {
            success: false,
            states: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function updateCharacterState(
    stateId: string,
    data: Partial<InsertCharacterState>
): Promise<{ success: boolean; error?: string }> {
    try {
        await db
            .update(characterStates)
            .set(data)
            .where(eq(characterStates.id, stateId));

        return { success: true };
    } catch (error) {
        console.error("[CharacterStateQueries] Error updating state:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

export async function deleteCharacterState(
    stateId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await db.delete(characterStates).where(eq(characterStates.id, stateId));
        return { success: true };
    } catch (error) {
        console.error("[CharacterStateQueries] Error deleting state:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// ============================================
// Location Character Tracking
// ============================================

export interface CharacterAtLocation {
    characterId: string;
    characterName: string;
    characterImage: string | null;
    characterRole: string;
    noteId: string;
    noteTitle: string;
    status: string | null;
    mood: string | null;
    extractedAt: Date;
}

/**
 * Get all characters that have been seen at a specific location
 */
export async function getCharactersAtLocation(locationId: string): Promise<{
    success: boolean;
    characters: CharacterAtLocation[];
    error?: string;
}> {
    try {
        const states = await db.query.characterStates.findMany({
            where: eq(characterStates.locationId, locationId),
            with: {
                character: true,
                note: true,
            },
            orderBy: (characterStates, { desc }) => [desc(characterStates.extractedAt)],
        });

        // Group by character, keep most recent state
        const characterMap = new Map<string, CharacterAtLocation>();

        for (const state of states) {
            if (!characterMap.has(state.characterId)) {
                characterMap.set(state.characterId, {
                    characterId: state.characterId,
                    characterName: state.character?.name || "Unknown",
                    characterImage: state.character?.image || null,
                    characterRole: state.character?.role || "",
                    noteId: state.noteId,
                    noteTitle: (state as any).note?.title || "",
                    status: state.status,
                    mood: state.mood,
                    extractedAt: state.extractedAt,
                });
            }
        }

        return {
            success: true,
            characters: Array.from(characterMap.values()),
        };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching characters at location:", error);
        return {
            success: false,
            characters: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// ============================================
// Character Journey Tracking
// ============================================

export interface CharacterJourneyPoint {
    noteId: string;
    noteTitle: string;
    locationId: string | null;
    locationName: string | null;
    status: string | null;
    mood: string | null;
    health: number | null;
    extractedAt: Date;
}

/**
 * Get the journey of a character through locations (timeline of where they've been)
 */
export async function getCharacterJourney(characterId: string): Promise<{
    success: boolean;
    journey: CharacterJourneyPoint[];
    error?: string;
}> {
    try {
        const states = await db.query.characterStates.findMany({
            where: eq(characterStates.characterId, characterId),
            with: {
                note: true,
            },
            orderBy: (characterStates, { asc }) => [asc(characterStates.extractedAt)],
        });

        const journey: CharacterJourneyPoint[] = states.map((state) => ({
            noteId: state.noteId,
            noteTitle: (state as any).note?.title || "",
            locationId: state.locationId,
            locationName: state.locationName,
            status: state.status,
            mood: state.mood,
            health: state.health,
            extractedAt: state.extractedAt,
        }));

        return {
            success: true,
            journey,
        };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching character journey:", error);
        return {
            success: false,
            journey: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Get the current (most recent) location of a character
 */
export async function getCharacterCurrentLocation(characterId: string): Promise<{
    success: boolean;
    location: { id: string | null; name: string | null } | null;
    noteId: string | null;
    error?: string;
}> {
    try {
        const latestState = await db.query.characterStates.findFirst({
            where: eq(characterStates.characterId, characterId),
            orderBy: (characterStates, { desc }) => [desc(characterStates.extractedAt)],
        });

        if (!latestState) {
            return { success: true, location: null, noteId: null };
        }

        return {
            success: true,
            location: {
                id: latestState.locationId,
                name: latestState.locationName,
            },
            noteId: latestState.noteId,
        };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching current location:", error);
        return {
            success: false,
            location: null,
            noteId: null,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

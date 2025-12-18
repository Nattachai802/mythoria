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

// ============================================
// Chapter-Based State Aggregation (Method B)
// ============================================

export interface CharacterStateAtChapter {
    characterId: string;
    characterName: string;
    characterImage: string | null;
    chapterId: string;
    chapterTitle: string;
    chapterOrderIndex: number;
    // Aggregated state data
    locationName: string | null;
    status: string | null;
    mood: string | null;
    health: number | null;
    equipment: unknown;
    notes: string | null;
    // Meta
    stateCount: number; // How many states contributed
    latestStateId: string | null;
}

/**
 * Get character state at a specific chapter by aggregating states from notes linked to that chapter
 */
export async function getCharacterStateAtChapter(
    characterId: string,
    chapterId: string
): Promise<{
    success: boolean;
    state: CharacterStateAtChapter | null;
    error?: string;
}> {
    try {
        // Get chapter info first
        const chapter = await db.query.chapters.findFirst({
            where: (chapters, { eq }) => eq(chapters.id, chapterId),
        });

        if (!chapter) {
            return { success: false, state: null, error: "Chapter not found" };
        }

        // Get all notes linked to this chapter
        const notesInChapter = await db.query.notes.findMany({
            where: (notes, { eq }) => eq(notes.linkedToChapterId, chapterId),
        });

        if (notesInChapter.length === 0) {
            return { success: true, state: null };
        }

        const noteIds = notesInChapter.map((n) => n.id);

        // Get character states from those notes
        const states = await db.query.characterStates.findMany({
            where: (cs, { eq, and, inArray }) =>
                and(
                    eq(cs.characterId, characterId),
                    inArray(cs.noteId, noteIds)
                ),
            with: {
                character: true,
            },
            orderBy: (cs, { desc }) => [desc(cs.extractedAt)],
        });

        if (states.length === 0) {
            return { success: true, state: null };
        }

        // Use the most recent state as the primary
        const latestState = states[0];

        const aggregatedState: CharacterStateAtChapter = {
            characterId,
            characterName: latestState.character?.name || "Unknown",
            characterImage: latestState.character?.image || null,
            chapterId,
            chapterTitle: chapter.title,
            chapterOrderIndex: chapter.orderIndex,
            locationName: latestState.locationName,
            status: latestState.status,
            mood: latestState.mood,
            health: latestState.health,
            equipment: latestState.equipment,
            notes: latestState.notes,
            stateCount: states.length,
            latestStateId: latestState.id,
        };

        return { success: true, state: aggregatedState };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching state at chapter:", error);
        return {
            success: false,
            state: null,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Get character states across all chapters for timeline visualization
 */
export async function getCharacterStateTimeline(
    characterId: string,
    novelId: string
): Promise<{
    success: boolean;
    timeline: CharacterStateAtChapter[];
    error?: string;
}> {
    try {
        // Get all chapters for this novel, ordered
        const chapters = await db.query.chapters.findMany({
            where: (ch, { eq }) => eq(ch.novelId, novelId),
            orderBy: (ch, { asc }) => [asc(ch.orderIndex)],
        });

        if (chapters.length === 0) {
            return { success: true, timeline: [] };
        }

        // For each chapter, get the character's state
        const timeline: CharacterStateAtChapter[] = [];

        for (const chapter of chapters) {
            const result = await getCharacterStateAtChapter(characterId, chapter.id);
            if (result.success && result.state) {
                timeline.push(result.state);
            }
        }

        return { success: true, timeline };
    } catch (error) {
        console.error("[CharacterStateQueries] Error fetching state timeline:", error);
        return {
            success: false,
            timeline: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Compare character states between two chapters
 */
export async function compareCharacterStates(
    characterId: string,
    chapterIdFrom: string,
    chapterIdTo: string
): Promise<{
    success: boolean;
    comparison: {
        from: CharacterStateAtChapter | null;
        to: CharacterStateAtChapter | null;
        differences: string[];
    } | null;
    error?: string;
}> {
    try {
        const [fromResult, toResult] = await Promise.all([
            getCharacterStateAtChapter(characterId, chapterIdFrom),
            getCharacterStateAtChapter(characterId, chapterIdTo),
        ]);

        const from = fromResult.state;
        const to = toResult.state;

        const differences: string[] = [];

        if (from && to) {
            if (from.locationName !== to.locationName) {
                differences.push(`ตำแหน่ง: ${from.locationName || "ไม่ระบุ"} → ${to.locationName || "ไม่ระบุ"}`);
            }
            if (from.status !== to.status) {
                differences.push(`สถานะ: ${from.status || "ไม่ระบุ"} → ${to.status || "ไม่ระบุ"}`);
            }
            if (from.mood !== to.mood) {
                differences.push(`อารมณ์: ${from.mood || "ไม่ระบุ"} → ${to.mood || "ไม่ระบุ"}`);
            }
            if (from.health !== to.health) {
                differences.push(`สุขภาพ: ${from.health ?? "?"}% → ${to.health ?? "?"}%`);
            }
        }

        return {
            success: true,
            comparison: { from, to, differences },
        };
    } catch (error) {
        console.error("[CharacterStateQueries] Error comparing states:", error);
        return {
            success: false,
            comparison: null,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

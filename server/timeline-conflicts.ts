"use server";

import { db } from "@/db/drizzle";
import { characterStates, locationConnections, notes } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";

// ============================================
// Types
// ============================================

export interface TimelineConflict {
    type: "travel_time" | "simultaneous_locations";
    characterId: string;
    characterName: string;
    fromLocation: {
        id: string | null;
        name: string | null;
        noteId: string;
        noteTitle: string;
    };
    toLocation: {
        id: string | null;
        name: string | null;
        noteId: string;
        noteTitle: string;
    };
    requiredTime: number | null; // เวลาที่ต้องใช้เดินทาง
    requiredTimeUnit: string | null;
    travelMethod: string | null;
    message: string;
    severity: "warning" | "error";
}

// ============================================
// Travel Time Query
// ============================================

/**
 * Get travel time between two locations
 */
async function getTravelTimeBetween(
    sourceLocationId: string,
    targetLocationId: string,
    novelId: string
): Promise<{
    travelTime: number | null;
    travelTimeUnit: string | null;
    travelMethod: string | null;
} | null> {
    // Try direct connection
    const directConnection = await db.query.locationConnections.findFirst({
        where: and(
            eq(locationConnections.novelId, novelId),
            or(
                and(
                    eq(locationConnections.sourceLocationId, sourceLocationId),
                    eq(locationConnections.targetLocationId, targetLocationId)
                ),
                and(
                    eq(locationConnections.sourceLocationId, targetLocationId),
                    eq(locationConnections.targetLocationId, sourceLocationId),
                    eq(locationConnections.isBidirectional, true)
                )
            )
        ),
    });

    if (directConnection) {
        return {
            travelTime: directConnection.travelTime,
            travelTimeUnit: directConnection.travelTimeUnit,
            travelMethod: directConnection.travelMethod,
        };
    }

    return null;
}

// ============================================
// Conflict Detection
// ============================================

/**
 * Detect timeline conflicts for a novel based on character states
 * Checks if characters can realistically travel between locations
 */
export async function detectTimelineConflicts(novelId: string): Promise<{
    success: boolean;
    conflicts: TimelineConflict[];
    error?: string;
}> {
    try {
        // Get all character states with their notes, ordered by extraction time
        const states = await db.query.characterStates.findMany({
            where: eq(characterStates.novelId, novelId),
            with: {
                character: true,
                note: true,
            },
            orderBy: (characterStates, { asc }) => [asc(characterStates.extractedAt)],
        });

        if (states.length === 0) {
            return { success: true, conflicts: [] };
        }

        // Group states by character
        const statesByCharacter = new Map<string, typeof states>();
        for (const state of states) {
            const existing = statesByCharacter.get(state.characterId) || [];
            existing.push(state);
            statesByCharacter.set(state.characterId, existing);
        }

        const conflicts: TimelineConflict[] = [];

        // Check each character's journey for conflicts
        for (const [characterId, charStates] of statesByCharacter) {
            if (charStates.length < 2) continue;

            // Sort by extraction time
            const sortedStates = [...charStates].sort(
                (a, b) => new Date(a.extractedAt).getTime() - new Date(b.extractedAt).getTime()
            );

            // Check consecutive location changes
            for (let i = 0; i < sortedStates.length - 1; i++) {
                const current = sortedStates[i];
                const next = sortedStates[i + 1];

                // Skip if same location or no location info
                if (!current.locationId || !next.locationId) continue;
                if (current.locationId === next.locationId) continue;

                // Get travel time between these locations
                const travelInfo = await getTravelTimeBetween(
                    current.locationId,
                    next.locationId,
                    novelId
                );

                // If we have travel time info and it's > 0, check for conflict
                if (travelInfo && travelInfo.travelTime && travelInfo.travelTime > 0) {
                    // For now, we flag as a potential conflict when there's no gap
                    // In the future, could compare with actual timeline events

                    const timeLabel = formatTravelTime(
                        travelInfo.travelTime,
                        travelInfo.travelTimeUnit || "hours"
                    );

                    conflicts.push({
                        type: "travel_time",
                        characterId,
                        characterName: current.character?.name || "Unknown",
                        fromLocation: {
                            id: current.locationId,
                            name: current.locationName,
                            noteId: current.noteId,
                            noteTitle: (current as any).note?.title || "",
                        },
                        toLocation: {
                            id: next.locationId,
                            name: next.locationName,
                            noteId: next.noteId,
                            noteTitle: (next as any).note?.title || "",
                        },
                        requiredTime: travelInfo.travelTime,
                        requiredTimeUnit: travelInfo.travelTimeUnit,
                        travelMethod: travelInfo.travelMethod,
                        message: `${current.character?.name} ต้องใช้เวลา ${timeLabel} เดินทางจาก "${current.locationName}" ไป "${next.locationName}"`,
                        severity: "warning",
                    });
                }
            }
        }

        return { success: true, conflicts };
    } catch (error) {
        console.error("[ConflictDetection] Error:", error);
        return {
            success: false,
            conflicts: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Detect conflicts for a specific character
 */
export async function detectCharacterConflicts(
    characterId: string,
    novelId: string
): Promise<{
    success: boolean;
    conflicts: TimelineConflict[];
    error?: string;
}> {
    try {
        const states = await db.query.characterStates.findMany({
            where: and(
                eq(characterStates.novelId, novelId),
                eq(characterStates.characterId, characterId)
            ),
            with: {
                character: true,
                note: true,
            },
            orderBy: (characterStates, { asc }) => [asc(characterStates.extractedAt)],
        });

        if (states.length < 2) {
            return { success: true, conflicts: [] };
        }

        const conflicts: TimelineConflict[] = [];
        const sortedStates = [...states].sort(
            (a, b) => new Date(a.extractedAt).getTime() - new Date(b.extractedAt).getTime()
        );

        for (let i = 0; i < sortedStates.length - 1; i++) {
            const current = sortedStates[i];
            const next = sortedStates[i + 1];

            if (!current.locationId || !next.locationId) continue;
            if (current.locationId === next.locationId) continue;

            const travelInfo = await getTravelTimeBetween(
                current.locationId,
                next.locationId,
                novelId
            );

            if (travelInfo && travelInfo.travelTime && travelInfo.travelTime > 0) {
                const timeLabel = formatTravelTime(
                    travelInfo.travelTime,
                    travelInfo.travelTimeUnit || "hours"
                );

                conflicts.push({
                    type: "travel_time",
                    characterId,
                    characterName: current.character?.name || "Unknown",
                    fromLocation: {
                        id: current.locationId,
                        name: current.locationName,
                        noteId: current.noteId,
                        noteTitle: (current as any).note?.title || "",
                    },
                    toLocation: {
                        id: next.locationId,
                        name: next.locationName,
                        noteId: next.noteId,
                        noteTitle: (next as any).note?.title || "",
                    },
                    requiredTime: travelInfo.travelTime,
                    requiredTimeUnit: travelInfo.travelTimeUnit,
                    travelMethod: travelInfo.travelMethod,
                    message: `ใช้เวลา ${timeLabel} (${getMethodLabel(travelInfo.travelMethod)})`,
                    severity: "warning",
                });
            }
        }

        return { success: true, conflicts };
    } catch (error) {
        console.error("[ConflictDetection] Error:", error);
        return {
            success: false,
            conflicts: [],
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// ============================================
// Helpers
// ============================================

function formatTravelTime(time: number, unit: string): string {
    const unitLabels: Record<string, string> = {
        hours: "ชั่วโมง",
        days: "วัน",
        weeks: "สัปดาห์",
    };
    return `${time} ${unitLabels[unit] || unit}`;
}

function getMethodLabel(method: string | null): string {
    const methodLabels: Record<string, string> = {
        walk: "เดินเท้า",
        horse: "ขี่ม้า",
        carriage: "รถม้า",
        boat: "เรือ",
        teleport: "เทเลพอร์ต",
        custom: "อื่นๆ",
    };
    return methodLabels[method || "walk"] || method || "เดินเท้า";
}

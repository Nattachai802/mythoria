"use server";

import { db } from "@/db/drizzle";
import {
    stateExtractionQueue,
    characterStates,
    notes,
    characters,
    InsertCharacterState,
} from "@/db/schema";
import { eq, and, inArray, asc, sql, notInArray } from "drizzle-orm";
import {
    extractCharacterStatesWithVoting,
    matchLocationId,
    ExtractedCharacterState,
} from "./character-state-ai";
import { addReferences, type AddReferenceInput } from "./references";

// ============================================
// Exponential Backoff
// ============================================

function getBackoffDelay(retryCount: number): number {
    // Base: 2s, Max: 60s
    const baseDelay = 2000;
    const maxDelay = 60000;
    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Queue Management
// ============================================

export async function queueNoteForStateExtraction(
    noteId: string,
    novelId: string
): Promise<void> {
    try {
        // Check if already in queue (pending, processing, or already failed max retries)
        const existing = await db.query.stateExtractionQueue.findFirst({
            where: and(
                eq(stateExtractionQueue.noteId, noteId),
                inArray(stateExtractionQueue.status, ["pending", "processing", "failed"])
            ),
        });

        if (existing) {
            console.log(`[Queue] Note ${noteId} already in queue (${existing.status}), skipping`);
            return;
        }

        // Add to queue
        await db.insert(stateExtractionQueue).values({
            noteId,
            novelId,
            status: "pending",
        });

        console.log(`[Queue] Queued note ${noteId} for state extraction`);

        // Trigger processing (fire and forget)
        processStateExtractionQueue().catch((err) =>
            console.error("[Queue] Background processing error:", err)
        );
    } catch (error) {
        console.error("[Queue] Error queuing note:", error);
    }
}

export async function getQueueStatus(noteId: string): Promise<{
    status: "pending" | "processing" | "completed" | "failed" | "none";
    error?: string;
}> {
    try {
        const item = await db.query.stateExtractionQueue.findFirst({
            where: eq(stateExtractionQueue.noteId, noteId),
            orderBy: [asc(stateExtractionQueue.createdAt)],
        });

        if (!item) {
            return { status: "none" };
        }

        return {
            status: item.status as "pending" | "processing" | "completed" | "failed",
            error: item.error || undefined,
        };
    } catch (error) {
        console.error("[Queue] Error getting status:", error);
        return { status: "none" };
    }
}

// ============================================
// Processing Logic
// ============================================

// Lock to prevent concurrent processing
let isProcessing = false;

export async function processStateExtractionQueue(): Promise<void> {
    if (isProcessing) {
        console.log("[Processor] Already processing, skipping");
        return;
    }

    isProcessing = true;
    console.log("[Processor] Starting queue processing...");

    try {
        while (true) {
            // Fetch up to 2 pending items
            const pendingItems = await db
                .select()
                .from(stateExtractionQueue)
                .where(eq(stateExtractionQueue.status, "pending"))
                .orderBy(asc(stateExtractionQueue.createdAt))
                .limit(2);

            if (pendingItems.length === 0) {
                console.log("[Processor] No pending items, stopping");
                break;
            }

            console.log(`[Processor] Processing ${pendingItems.length} items`);

            // Process each item
            for (const item of pendingItems) {
                await processQueueItem(item);
            }

            // Apply backoff delay based on max retry count in this batch
            const maxRetry = Math.max(...pendingItems.map((i) => i.retryCount));
            const backoffDelay = getBackoffDelay(maxRetry);
            console.log(`[Processor] Waiting ${backoffDelay}ms before next batch`);
            await delay(backoffDelay);
        }
    } catch (error) {
        console.error("[Processor] Error:", error);
    } finally {
        isProcessing = false;
    }
}

async function processQueueItem(item: {
    id: string;
    noteId: string;
    novelId: string;
    retryCount: number;
}): Promise<void> {
    console.log(`[Processor] Processing note ${item.noteId}`);

    try {
        // Mark as processing
        await db
            .update(stateExtractionQueue)
            .set({ status: "processing" })
            .where(eq(stateExtractionQueue.id, item.id));

        // Get note content
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, item.noteId),
        });

        if (!note) {
            throw new Error("Note not found");
        }

        // Extract plain text from content
        const content = note.content as any;
        let plainText = "";
        if (typeof content === "string") {
            plainText = content;
        } else if (content?.text) {
            // Quill editor format: { text: "<p>HTML content</p>" }
            plainText = content.text
                .replace(/<[^>]*>/g, " ")   // strip HTML tags
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/\s+/g, " ")
                .trim();
        } else if (content?.content) {
            // TipTap JSON format (fallback)
            plainText = extractPlainTextFromTipTap(content);
        } else if (content) {
            plainText = JSON.stringify(content);
        }

        if (!plainText || plainText.length < 10) {
            console.log(`[Processor] Note ${item.noteId} has no meaningful content (${plainText.length} chars), skipping`);
            await db
                .update(stateExtractionQueue)
                .set({ status: "completed", processedAt: new Date() })
                .where(eq(stateExtractionQueue.id, item.id));
            return;
        }

        // Call AI voting service
        const result = await extractCharacterStatesWithVoting(plainText, item.novelId);

        if (!result.success) {
            throw new Error(result.error || "Extraction failed");
        }

        // Get novel characters for matching
        const novelCharacters = await db.query.characters.findMany({
            where: eq(characters.novelId, item.novelId),
        });

        // Save states to database
        await saveExtractedStates(
            item.noteId,
            item.novelId,
            result.states,
            result.confidence,
            novelCharacters
        );

        // Mark as completed
        await db
            .update(stateExtractionQueue)
            .set({ status: "completed", processedAt: new Date() })
            .where(eq(stateExtractionQueue.id, item.id));

        console.log(`[Processor] Completed note ${item.noteId}`);
    } catch (error) {
        console.error(`[Processor] Error processing note ${item.noteId}:`, error);

        // Increment retry count and mark as pending or failed
        const newRetryCount = item.retryCount + 1;
        const maxRetries = 3;

        if (newRetryCount >= maxRetries) {
            await db
                .update(stateExtractionQueue)
                .set({
                    status: "failed",
                    error: error instanceof Error ? error.message : "Unknown error",
                    retryCount: newRetryCount,
                })
                .where(eq(stateExtractionQueue.id, item.id));
        } else {
            await db
                .update(stateExtractionQueue)
                .set({
                    status: "pending",
                    retryCount: newRetryCount,
                })
                .where(eq(stateExtractionQueue.id, item.id));
        }
    }
}

// ============================================
// Helper Functions
// ============================================

function extractPlainTextFromTipTap(content: any): string {
    const texts: string[] = [];

    function traverse(node: any) {
        if (node.type === "text" && node.text) {
            texts.push(node.text);
        }
        if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) {
                traverse(child);
            }
        }
    }

    traverse(content);
    return texts.join(" ");
}

async function saveExtractedStates(
    noteId: string,
    novelId: string,
    states: ExtractedCharacterState[],
    confidence: number,
    novelCharacters: { id: string; name: string; aliases: unknown }[]
): Promise<void> {
    // Delete existing states for this note (only non-manually-edited ones)
    await db
        .delete(characterStates)
        .where(
            and(
                eq(characterStates.noteId, noteId),
                eq(characterStates.isManuallyEdited, false)
            )
        );

    // Get all manually edited character IDs for this note (these should NOT be overwritten)
    const manuallyEditedStates = await db.query.characterStates.findMany({
        where: and(
            eq(characterStates.noteId, noteId),
            eq(characterStates.isManuallyEdited, true)
        ),
        columns: { characterId: true },
    });
    const manuallyEditedCharacterIds = new Set(manuallyEditedStates.map((s) => s.characterId));

    // Create a name -> id map (including aliases)
    const nameToId = new Map<string, string>();
    for (const char of novelCharacters) {
        // Add main name
        nameToId.set(char.name.toLowerCase(), char.id);

        // Add aliases if they exist
        if (char.aliases) {
            let aliasArray: string[] = [];
            if (Array.isArray(char.aliases)) {
                aliasArray = char.aliases.filter((a): a is string => typeof a === "string");
            } else if (typeof char.aliases === "string") {
                aliasArray = [char.aliases];
            }
            for (const alias of aliasArray) {
                nameToId.set(alias.toLowerCase(), char.id);
            }
        }
    }

    // Track processed character IDs to avoid duplicates (safety layer)
    // Start with manually edited ones so we don't overwrite them
    const processedCharacterIds = new Set<string>(manuallyEditedCharacterIds);

    // Context Fabric: AI-detected refs to emit after the loop (note→features→character, →set_in→location)
    const aiConf = Math.round(confidence <= 1 ? confidence * 100 : confidence);
    const aiRefs: AddReferenceInput[] = [];

    // Insert new states
    let insertedCount = 0;
    for (const state of states) {
        const characterId = nameToId.get(state.name.toLowerCase());
        if (!characterId) {
            console.log(`[SaveStates] Character "${state.name}" not found in novel, skipping`);
            continue;
        }

        // Skip if already processed this character (deduplication)
        if (processedCharacterIds.has(characterId)) {
            console.log(`[SaveStates] Skipping duplicate state for character "${state.name}" (ID: ${characterId})`);
            continue;
        }
        processedCharacterIds.add(characterId);

        // Match location ID
        const locationId = await matchLocationId(state.location?.place || "", novelId);

        const insertData: InsertCharacterState = {
            noteId,
            characterId,
            novelId,
            // Location
            locationId,
            locationName: state.location?.place || null,
            locationCoordinates: state.location?.coordinates || null,
            inContactWith: state.location?.in_contact_with || [],
            // Vitals
            health: state.vitals?.health ?? null,
            energy: state.vitals?.energy || null,
            status: state.vitals?.status || null,
            specificInjuries: state.vitals?.specific_injuries || [],
            // Mental
            mood: state.mental_state?.mood || null,
            moodIntensity: state.mental_state?.mood_intensity ?? null,
            currentObjective: state.mental_state?.current_objective || null,
            // Equipment
            equipment: state.abilities_and_equipment?.equipment || [],
            abilitiesUsed: state.abilities_and_equipment?.abilities_used || [],
            cooldowns: state.abilities_and_equipment?.cooldowns || [],
            // Relationships
            relationshipsDynamic: state.relationships || [],
            // Meta
            notes: state.notes || null,
            aiConfidence: confidence,
            rawExtraction: state as any,
            isManuallyEdited: false,
        };

        await db.insert(characterStates).values(insertData);
        insertedCount++;

        // ponytail: AI won't clobber a user cast-deck edge (onConflictDoNothing keeps createdBy='user')
        aiRefs.push({
            novelId, from: { type: "note", id: noteId }, to: { type: "character", id: characterId },
            relation: "features", createdBy: "ai", confidence: aiConf,
        });
        if (locationId) aiRefs.push({
            novelId, from: { type: "note", id: noteId }, to: { type: "location", id: locationId },
            relation: "set_in", createdBy: "ai", confidence: aiConf,
        });
    }

    if (aiRefs.length) await addReferences(aiRefs);

    console.log(`[SaveStates] Saved ${insertedCount} states for note ${noteId} (${states.length - insertedCount} duplicates skipped)`);
}

// ============================================
// Manual Reprocess
// ============================================

export async function reprocessNoteStates(noteId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        // Get note to find novelId
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, noteId),
        });

        if (!note) {
            return { success: false, error: "Note not found" };
        }

        // Queue for extraction
        await queueNoteForStateExtraction(noteId, note.novelId);

        return { success: true };
    } catch (error) {
        console.error("[Reprocess] Error:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
}

// ============================================
// Auto-Process Unprocessed Notes
// ============================================

/**
 * Scan for notes that don't have any character states and queue them for processing.
 * This is useful for processing old notes that were created before the extraction system.
 * @param novelId - Optional: limit to a specific novel
 * @param limit - Maximum number of notes to queue at once (default: 10)
 */
export async function scanAndQueueUnprocessedNotes(
    novelId?: string,
    limit: number = 10
): Promise<{
    success: boolean;
    queued: number;
    total: number;
    error?: string;
}> {
    try {
        console.log("[AutoProcess] Scanning for unprocessed notes...");

        // Find notes that have no character states and are not currently in queue
        // Step 1: Get note IDs that already have character states
        const notesWithStates = await db
            .selectDistinct({ noteId: characterStates.noteId })
            .from(characterStates);

        const processedNoteIds = notesWithStates.map((n) => n.noteId);

        // Step 2: Get note IDs currently in queue (pending or processing)
        const notesInQueue = await db
            .select({ noteId: stateExtractionQueue.noteId })
            .from(stateExtractionQueue)
            .where(inArray(stateExtractionQueue.status, ["pending", "processing"]));

        const queuedNoteIds = notesInQueue.map((n) => n.noteId);

        // Step 3: Combine exclusion list
        const excludeNoteIds = [...new Set([...processedNoteIds, ...queuedNoteIds])];

        // Step 4: Find notes that need processing
        let query = db.select().from(notes);

        if (novelId) {
            if (excludeNoteIds.length > 0) {
                query = query.where(
                    and(
                        eq(notes.novelId, novelId),
                        notInArray(notes.id, excludeNoteIds)
                    )
                ) as typeof query;
            } else {
                query = query.where(eq(notes.novelId, novelId)) as typeof query;
            }
        } else if (excludeNoteIds.length > 0) {
            query = query.where(notInArray(notes.id, excludeNoteIds)) as typeof query;
        }

        const unprocessedNotes = await query.limit(limit);

        console.log(`[AutoProcess] Found ${unprocessedNotes.length} unprocessed notes`);

        // Queue each note for processing
        let queuedCount = 0;
        for (const note of unprocessedNotes) {
            try {
                await queueNoteForStateExtraction(note.id, note.novelId);
                queuedCount++;
            } catch (err) {
                console.error(`[AutoProcess] Failed to queue note ${note.id}:`, err);
            }
        }

        console.log(`[AutoProcess] Queued ${queuedCount} notes for processing`);

        return {
            success: true,
            queued: queuedCount,
            total: unprocessedNotes.length,
        };
    } catch (error) {
        console.error("[AutoProcess] Error:", error);
        return {
            success: false,
            queued: 0,
            total: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

/**
 * Get statistics about character state processing
 */
export async function getProcessingStats(novelId?: string): Promise<{
    totalNotes: number;
    notesWithStates: number;
    notesInQueue: number;
    unprocessedNotes: number;
}> {
    try {
        // Total notes
        const totalNotesQuery = novelId
            ? db.select({ count: sql<number>`count(*)` }).from(notes).where(eq(notes.novelId, novelId))
            : db.select({ count: sql<number>`count(*)` }).from(notes);
        const [{ count: totalNotes }] = await totalNotesQuery;

        // Notes with states
        const notesWithStatesQuery = novelId
            ? db.selectDistinct({ noteId: characterStates.noteId })
                .from(characterStates)
                .where(eq(characterStates.novelId, novelId))
            : db.selectDistinct({ noteId: characterStates.noteId }).from(characterStates);
        const notesWithStates = (await notesWithStatesQuery).length;

        // Notes in queue
        const notesInQueueQuery = novelId
            ? db.select({ noteId: stateExtractionQueue.noteId })
                .from(stateExtractionQueue)
                .where(
                    and(
                        eq(stateExtractionQueue.novelId, novelId),
                        inArray(stateExtractionQueue.status, ["pending", "processing"])
                    )
                )
            : db.select({ noteId: stateExtractionQueue.noteId })
                .from(stateExtractionQueue)
                .where(inArray(stateExtractionQueue.status, ["pending", "processing"]));
        const notesInQueue = (await notesInQueueQuery).length;

        return {
            totalNotes: Number(totalNotes),
            notesWithStates,
            notesInQueue,
            unprocessedNotes: Number(totalNotes) - notesWithStates - notesInQueue,
        };
    } catch (error) {
        console.error("[Stats] Error:", error);
        return {
            totalNotes: 0,
            notesWithStates: 0,
            notesInQueue: 0,
            unprocessedNotes: 0,
        };
    }
}

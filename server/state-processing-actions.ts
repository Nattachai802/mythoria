"use server";

/**
 * Server actions for triggering character state processing
 */

import {
    scanAndQueueUnprocessedNotes,
    getProcessingStats,
} from "./character-state-extractor";

/**
 * Trigger processing of unprocessed notes for a novel
 */
export async function triggerBatchProcessing(novelId?: string, limit: number = 10) {
    return scanAndQueueUnprocessedNotes(novelId, limit);
}

/**
 * Get processing statistics for a novel
 */
export async function getNovelProcessingStats(novelId?: string) {
    return getProcessingStats(novelId);
}

"use server";

import { db } from "@/db/drizzle";
import { notes, chapters } from "@/db/schema";
import { eq, ne, and } from "drizzle-orm";

const DEFAULT_MIN_WORDS = 2000;

/**
 * Calculate word count from HTML content
 */
function calculateWordCount(htmlContent: string | null | undefined): number {
    if (!htmlContent) return 0;

    const text = htmlContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();

    if (!text) return 0;

    // Use Intl.Segmenter for Thai text if available (server-side)
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
        try {
            const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
            let count = 0;
            for (const segment of segmenter.segment(text)) {
                if (segment.isWordLike) count++;
            }
            return count;
        } catch (e) { }
    }

    return text.replace(/\s+/g, ' ').trim().split(' ').length;
}

export interface WordCountStatus {
    currentWords: number;
    targetWords: number;
    averageWords: number;
    hasEnoughWords: boolean;
    percentComplete: number;
    message: string;
}

/**
 * Check if the current note/chapter has sufficient words
 * compared to the average of other chapters in the same novel.
 * 
 * If no other chapters exist, the minimum is DEFAULT_MIN_WORDS (2000).
 * 
 * @param novelId - The novel's ID
 * @param currentChapterId - The current chapter's ID (to exclude from average)
 * @param currentWordCount - The current word count to check
 */
export async function checkWordCountSufficiency(
    novelId: string,
    currentChapterId: string | null,
    currentWordCount: number
): Promise<WordCountStatus> {
    try {
        // Get all notes linked to chapters in this novel (excluding current chapter)
        const conditions = [eq(notes.novelId, novelId)];

        // Get all chapters except the current one
        let otherChapterIds: string[] = [];

        if (currentChapterId) {
            const otherChapters = await db.query.chapters.findMany({
                where: and(
                    eq(chapters.novelId, novelId),
                    ne(chapters.id, currentChapterId)
                ),
                columns: { id: true }
            });
            otherChapterIds = otherChapters.map(c => c.id);
        } else {
            const allChapters = await db.query.chapters.findMany({
                where: eq(chapters.novelId, novelId),
                columns: { id: true }
            });
            otherChapterIds = allChapters.map(c => c.id);
        }

        // Calculate word counts per chapter
        const chapterWordCounts: Map<string, number> = new Map();

        if (otherChapterIds.length > 0) {
            // Get all notes for other chapters
            const otherNotes = await db.query.notes.findMany({
                where: eq(notes.novelId, novelId),
            });

            // Group notes by chapter and calculate word count
            for (const note of otherNotes) {
                if (note.linkedToChapterId && otherChapterIds.includes(note.linkedToChapterId)) {
                    const content = note.content as { text?: string } | null;
                    const wordCount = calculateWordCount(content?.text);

                    const existing = chapterWordCounts.get(note.linkedToChapterId) || 0;
                    chapterWordCounts.set(note.linkedToChapterId, existing + wordCount);
                }
            }
        }

        // Calculate average
        let averageWords = DEFAULT_MIN_WORDS;
        let targetWords = DEFAULT_MIN_WORDS;

        if (chapterWordCounts.size > 0) {
            const totalWords = Array.from(chapterWordCounts.values()).reduce((a, b) => a + b, 0);
            averageWords = Math.round(totalWords / chapterWordCounts.size);
            targetWords = averageWords;
        }

        // Determine status
        const hasEnoughWords = currentWordCount >= targetWords;
        const percentComplete = Math.min(100, Math.round((currentWordCount / targetWords) * 100));

        // Generate message
        let message: string;
        if (hasEnoughWords) {
            message = `เขียนครบแล้ว! (${currentWordCount.toLocaleString()}/${targetWords.toLocaleString()} คำ)`;
        } else {
            const remaining = targetWords - currentWordCount;
            message = `เหลืออีก ${remaining.toLocaleString()} คำ (${percentComplete}%)`;
        }

        return {
            currentWords: currentWordCount,
            targetWords,
            averageWords,
            hasEnoughWords,
            percentComplete,
            message,
        };

    } catch (error) {
        console.error("Error checking word count sufficiency:", error);
        return {
            currentWords: currentWordCount,
            targetWords: DEFAULT_MIN_WORDS,
            averageWords: DEFAULT_MIN_WORDS,
            hasEnoughWords: currentWordCount >= DEFAULT_MIN_WORDS,
            percentComplete: Math.min(100, Math.round((currentWordCount / DEFAULT_MIN_WORDS) * 100)),
            message: "ไม่สามารถคำนวณได้",
        };
    }
}

/**
 * Get the average word count for chapters in a novel
 */
export async function getNovelAverageWordCount(novelId: string): Promise<{
    average: number;
    total: number;
    chapterCount: number;
}> {
    try {
        const allNotes = await db.query.notes.findMany({
            where: eq(notes.novelId, novelId),
        });

        const allChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            columns: { id: true }
        });

        const chapterIds = new Set(allChapters.map(c => c.id));
        const chapterWordCounts: Map<string, number> = new Map();

        for (const note of allNotes) {
            if (note.linkedToChapterId && chapterIds.has(note.linkedToChapterId)) {
                const content = note.content as { text?: string } | null;
                const wordCount = calculateWordCount(content?.text);

                const existing = chapterWordCounts.get(note.linkedToChapterId) || 0;
                chapterWordCounts.set(note.linkedToChapterId, existing + wordCount);
            }
        }

        const total = Array.from(chapterWordCounts.values()).reduce((a, b) => a + b, 0);
        const chapterCount = chapterWordCounts.size;
        const average = chapterCount > 0 ? Math.round(total / chapterCount) : DEFAULT_MIN_WORDS;

        return { average, total, chapterCount };

    } catch (error) {
        console.error("Error getting novel average word count:", error);
        return { average: DEFAULT_MIN_WORDS, total: 0, chapterCount: 0 };
    }
}

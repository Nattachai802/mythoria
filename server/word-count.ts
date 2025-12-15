"use server";

import { db } from "@/db/drizzle";
import { notes, novels } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Count words in text, supporting Thai language using server-side logic
 */
function countWords(htmlContent: string): number {
    if (!htmlContent) return 0;

    const text = htmlContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

    if (!text) return 0;

    // Server-side: use Intl.Segmenter for Thai text if available
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
        try {
            const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
            let count = 0;
            for (const segment of segmenter.segment(text)) {
                if (segment.isWordLike) {
                    count++;
                }
            }
            return count;
        } catch (e) {
            // Fallback below
        }
    }

    // Fallback: Split by whitespace
    return text.split(' ').filter(w => w.length > 0).length;
}

/**
 * Recalculate and update the total word count for a novel
 * by summing word counts from all Notes in the novel
 */
export async function recalculateNovelWordCountFromNotes(novelId: string) {
    try {
        // Get all notes for this novel
        const allNotes = await db
            .select({ content: notes.content })
            .from(notes)
            .where(eq(notes.novelId, novelId));

        // Calculate total word count from all notes
        let totalWordCount = 0;
        for (const note of allNotes) {
            const content = note.content as { text?: string } | null;
            if (content?.text) {
                totalWordCount += countWords(content.text);
            }
        }

        // Update novel word count
        await db
            .update(novels)
            .set({ wordCount: totalWordCount, updatedAt: new Date() })
            .where(eq(novels.id, novelId));

        console.log(`[WordCount] Novel ${novelId}: ${totalWordCount} words (from ${allNotes.length} notes)`);
        return { success: true, totalWordCount };
    } catch (error) {
        console.error("Recalculate word count error:", error);
        return { success: false, message: "Failed to recalculate word count" };
    }
}

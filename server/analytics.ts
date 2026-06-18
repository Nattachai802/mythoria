"use server";

import { db } from "@/db/drizzle";
import { notes, novels, chapters } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_DURATION } from "@/lib/cache-config";

// Get word count from content
function getWordCount(content: any): number {
    if (!content?.text) return 0;
    const text = content.text
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
}

// Internal function - actual database query for writing activity
async function _getWritingActivity(novelId: string, days: number = 90) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const allNotes = await db.query.notes.findMany({
            where: and(
                eq(notes.novelId, novelId),
                gte(notes.updatedAt, startDate)
            ),
            columns: {
                id: true,
                content: true,
                createdAt: true,
                updatedAt: true,
            },
            orderBy: [desc(notes.updatedAt)],
        });

        // Group by date
        const activityMap = new Map<string, { count: number; words: number }>();

        for (const note of allNotes) {
            const date = note.updatedAt.toISOString().split('T')[0];
            const words = getWordCount(note.content);

            const existing = activityMap.get(date) || { count: 0, words: 0 };
            activityMap.set(date, {
                count: existing.count + 1,
                words: existing.words + words,
            });
        }

        // Generate all days in range (fill missing days with 0)
        const activity: { date: string; count: number; words: number }[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const data = activityMap.get(dateStr) || { count: 0, words: 0 };
            activity.push({
                date: dateStr,
                count: data.words, // Use words as count for visualization
                words: data.words,
            });
        }

        return { success: true as const, activity };
    } catch (error) {
        console.error("Get writing activity error:", error);
        return { success: false as const, activity: [] };
    }
}

// Cached version - Get writing activity for the past N days
export async function getWritingActivity(novelId: string, days: number = 90) {
    const cachedFn = unstable_cache(
        () => _getWritingActivity(novelId, days),
        [`writing-activity-${novelId}-${days}`],
        {
            revalidate: CACHE_DURATION.medium, // 60 seconds
            tags: [CACHE_TAGS.analytics(novelId), CACHE_TAGS.notes(novelId)]
        }
    );
    return cachedFn();
}

// Get words per day for the past N days
export async function getWordsPerDay(novelId: string, days: number = 7) {
    try {
        const result: { date: string; words: number }[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const dayNotes = await db.query.notes.findMany({
                where: and(
                    eq(notes.novelId, novelId),
                    gte(notes.updatedAt, startOfDay),
                    lte(notes.updatedAt, endOfDay)
                ),
                columns: {
                    content: true,
                },
            });

            const totalWords = dayNotes.reduce((sum, note) => sum + getWordCount(note.content), 0);
            result.push({ date: dateStr, words: totalWords });
        }

        return { success: true, data: result };
    } catch (error) {
        console.error("Get words per day error:", error);
        return { success: false, data: [] };
    }
}

// Internal function - actual database query for writing streak
async function _getWritingStreak(novelId: string) {
    try {
        // Get all notes ordered by date
        const allNotes = await db.query.notes.findMany({
            where: eq(notes.novelId, novelId),
            columns: {
                updatedAt: true,
            },
            orderBy: [desc(notes.updatedAt)],
        });

        if (allNotes.length === 0) {
            return { success: true as const, currentStreak: 0, bestStreak: 0, lastWrittenDate: null };
        }

        // Get unique dates
        const uniqueDates = new Set<string>();
        for (const note of allNotes) {
            uniqueDates.add(note.updatedAt.toISOString().split('T')[0]);
        }

        const sortedDates = Array.from(uniqueDates).sort().reverse();

        // Calculate current streak
        let currentStreak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Check if wrote today or yesterday
        if (sortedDates[0] === today || sortedDates[0] === yesterday) {
            currentStreak = 1;
            let checkDate = new Date(sortedDates[0]);

            for (let i = 1; i < sortedDates.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1);
                const expectedDate = checkDate.toISOString().split('T')[0];

                if (sortedDates[i] === expectedDate) {
                    currentStreak++;
                } else {
                    break;
                }
            }
        }

        // Calculate best streak
        let bestStreak = 0;
        let tempStreak = 1;

        for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(sortedDates[i - 1]);
            const currDate = new Date(sortedDates[i]);
            const diffDays = (prevDate.getTime() - currDate.getTime()) / 86400000;

            if (diffDays === 1) {
                tempStreak++;
            } else {
                bestStreak = Math.max(bestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        bestStreak = Math.max(bestStreak, tempStreak, currentStreak);

        return {
            success: true as const,
            currentStreak,
            bestStreak,
            lastWrittenDate: sortedDates[0],
        };
    } catch (error) {
        console.error("Get writing streak error:", error);
        return { success: false as const, currentStreak: 0, bestStreak: 0, lastWrittenDate: null };
    }
}

// Cached version - Calculate writing streak
export async function getWritingStreak(novelId: string) {
    const cachedFn = unstable_cache(
        () => _getWritingStreak(novelId),
        [`writing-streak-${novelId}`],
        {
            revalidate: CACHE_DURATION.medium, // 60 seconds
            tags: [CACHE_TAGS.analytics(novelId), CACHE_TAGS.notes(novelId)]
        }
    );
    return cachedFn();
}

// Internal function - actual database query for analytics summary
async function _getAnalyticsSummary(novelId: string) {
    try {
        const novel = await db.query.novels.findFirst({
            where: eq(novels.id, novelId),
            columns: {
                wordCount: true,
                targetWordCount: true,
                title: true,
                targetDeadline: true,
                dailyTargetMode: true,
                dailyTargetWordCount: true,
            },
        });

        const allNotes = await db.query.notes.findMany({
            where: eq(notes.novelId, novelId),
            columns: {
                content: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const allChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            columns: {
                id: true,
                status: true,
            },
        });

        // Calculate stats
        // Use createdAt (not updatedAt) to count words in newly-created notes.
        // updatedAt is bumped by background AI processes (summaries, plot hole checks, etc.)
        // causing word counts to be inflated even when the user hasn't written anything.
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 86400000);
        const monthAgo = new Date(Date.now() - 30 * 86400000);

        let todayWords = 0;
        let weekWords = 0;
        let monthWords = 0;

        for (const note of allNotes) {
            const words = getWordCount(note.content);
            const noteDate = note.createdAt.toISOString().split('T')[0];

            if (noteDate === today) {
                todayWords += words;
            }
            if (note.createdAt >= weekAgo) {
                weekWords += words;
            }
            if (note.createdAt >= monthAgo) {
                monthWords += words;
            }
        }

        // === Dynamic Goal & Deadline Pacing Engine ===
        const totalWords = novel?.wordCount || 0;
        const targetWords = novel?.targetWordCount || null;
        const deadline = novel?.targetDeadline || null;
        const dailyMode = novel?.dailyTargetMode || 'dynamic';
        const staticDailyTarget = novel?.dailyTargetWordCount || 1000;

        let todayGoal = staticDailyTarget; // default fallback
        let daysRemaining: number | null = null;
        let goalStatus: 'on_track' | 'behind' | 'no_target' = 'no_target';

        if (deadline) {
            const now = new Date();
            const deadlineDate = new Date(deadline);
            // Start of today
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const deadlineStart = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
            const msPerDay = 86400000;
            daysRemaining = Math.max(0, Math.ceil((deadlineStart.getTime() - todayStart.getTime()) / msPerDay));

            if (dailyMode === 'dynamic' && targetWords && targetWords > 0) {
                const wordsLeft = Math.max(0, targetWords - totalWords);
                if (daysRemaining > 0) {
                    todayGoal = Math.ceil(wordsLeft / daysRemaining);
                } else {
                    todayGoal = wordsLeft; // deadline today or passed
                }
            } else {
                todayGoal = staticDailyTarget;
            }

            // Status: on_track if today's words >= todayGoal, else behind
            goalStatus = todayWords >= todayGoal ? 'on_track' : 'behind';
        } else if (targetWords && targetWords > 0) {
            // No deadline but has target — use static daily target
            todayGoal = staticDailyTarget;
            goalStatus = todayWords >= todayGoal ? 'on_track' : 'behind';
        }

        return {
            success: true as const,
            summary: {
                totalWords: novel?.wordCount || 0,
                targetWords: novel?.targetWordCount || 100000,
                totalNotes: allNotes.length,
                totalChapters: allChapters.length,
                publishedChapters: allChapters.filter(c => c.status === 'published').length,
                todayWords,
                weekWords,
                monthWords,
                avgWordsPerDay: Math.round(weekWords / 7),
                // Goal & Deadline
                todayGoal,
                daysRemaining,
                goalStatus,
                targetDeadline: novel?.targetDeadline ?? null,
                dailyTargetMode: novel?.dailyTargetMode ?? 'dynamic',
                dailyTargetWordCount: novel?.dailyTargetWordCount ?? 1000,
            },
        };
    } catch (error) {
        console.error("Get analytics summary error:", error);
        return { success: false as const, summary: null };
    }
}

// Cached version - Get analytics summary
export async function getAnalyticsSummary(novelId: string) {
    const cachedFn = unstable_cache(
        () => _getAnalyticsSummary(novelId),
        [`analytics-summary-${novelId}`],
        {
            revalidate: CACHE_DURATION.medium, // 60 seconds
            tags: [CACHE_TAGS.analytics(novelId), CACHE_TAGS.notes(novelId), CACHE_TAGS.novel(novelId)]
        }
    );
    return cachedFn();
}


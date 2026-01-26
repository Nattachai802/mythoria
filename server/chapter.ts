"use server";

import { db } from "@/db/drizzle";
import { chapters, novels } from "@/db/schema";
import { eq, desc, and, or, like, asc, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-config";

export const createChapter = async (novelId: string, title: string) => {
    try {
        const lastChapter = await db.query.chapters.findFirst({
            where: eq(chapters.novelId, novelId),
            orderBy: [desc(chapters.orderIndex)],
        });
        const newOrderIndex = (lastChapter?.orderIndex || 0) + 1;
        const [chapter] = await db.insert(chapters).values({
            title: title,
            novelId: novelId,
            orderIndex: newOrderIndex,
            content: {},
            status: "draft"
        }).returning();

        // Invalidate cache to show new chapter in UI immediately
        revalidateTag(CACHE_TAGS.chapters(novelId));
        revalidateTag(CACHE_TAGS.novel(novelId));

        return { success: true, message: "Chapter created successfully", chapter };
    } catch (error) {
        console.error("Create chapter error:", error);
        return { success: false, message: "Failed to create chapter" };
    }
};

export const getChapter = async (chapterId: string) => {
    try {
        const chapter = await db.query.chapters.findFirst({
            where: eq(chapters.id, chapterId),
        });

        if (!chapter) {
            return { success: false, message: "Chapter not found" };
        }
        return { success: true, chapter };
    } catch (error) {
        console.error("Get chapter error:", error);
        return { success: false, message: "Failed to get chapter" };
    }
}

export const getChapters = async (novelId: string) => {
    try {
        const allChapters = await db.query.chapters.findMany({
            where: eq(chapters.novelId, novelId),
            orderBy: [asc(chapters.orderIndex)],
        });

        return { success: true, chapters: allChapters };
    } catch (error) {
        console.error("Get chapters error:", error);
        return { success: false, message: "Failed to get chapters" };
    }
};

/**
 * Recalculate and update the total word count for a novel
 * by summing all chapter word counts
 */
export const recalculateNovelWordCount = async (novelId: string) => {
    try {
        // Get sum of all chapter word counts
        const result = await db
            .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
            .from(chapters)
            .where(eq(chapters.novelId, novelId));

        const totalWordCount = Number(result[0]?.total) || 0;

        // Update novel word count
        await db
            .update(novels)
            .set({ wordCount: totalWordCount, updatedAt: new Date() })
            .where(eq(novels.id, novelId));

        console.log(`[WordCount] Novel ${novelId}: ${totalWordCount} words`);
        return { success: true, totalWordCount };
    } catch (error) {
        console.error("Recalculate word count error:", error);
        return { success: false, message: "Failed to recalculate word count" };
    }
};

export const updateChapter = async (
    chapterId: string,
    data: {
        title?: string;
        content?: any;
        status?: "draft" | "published";
        summary?: string;
        wordCount?: number;
    }
) => {
    try {
        const [updatedChapter] = await db.update(chapters)
            .set({
                ...data,
                updatedAt: new Date(),
                ...(data.status === "published" ? { publishedAt: new Date() } : {}) // ถ้าเปลี่ยนเป็น published ให้ใส่วันที่
            })
            .where(eq(chapters.id, chapterId))
            .returning();

        // Recalculate novel word count if chapter word count was updated
        if (data.wordCount !== undefined && updatedChapter) {
            await recalculateNovelWordCount(updatedChapter.novelId);
        }

        return { success: true, message: "Chapter updated successfully", chapter: updatedChapter };
    } catch (error) {
        console.error("Update chapter error:", error);
        return { success: false, message: "Failed to update chapter" };
    }
};

export const deleteChapter = async (chapterId: string) => {
    try {
        // Get the chapter first to know novelId
        const chapter = await db.query.chapters.findFirst({
            where: eq(chapters.id, chapterId),
        });

        if (!chapter) {
            return { success: false, message: "Chapter not found" };
        }

        const novelId = chapter.novelId;

        // Delete the chapter
        await db.delete(chapters).where(eq(chapters.id, chapterId));

        // Recalculate novel word count after deletion
        await recalculateNovelWordCount(novelId);

        return { success: true, message: "Chapter deleted successfully" };
    } catch (error) {
        console.error("Delete chapter error:", error);
        return { success: false, message: "Failed to delete chapter" };
    }
};

"use server";

import { db } from "@/db/drizzle";
import { novels, InsertNovel } from "@/db/schema";
import { eq, desc, and, or, like } from "drizzle-orm";

// ====================================
// CREATE - สร้าง Novel ใหม่
// ====================================
export const createNovel = async (values: InsertNovel) => {
    try {
        const [novel] = await db.insert(novels).values(values).returning();
        return { success: true, message: "Novel created successfully", novel };
    } catch (error) {
        console.error("Create novel error:", error);
        return { success: false, message: "Failed to create novel" };
    }
};

// ====================================
// READ - ดึงข้อมูล Novel
// ====================================

// ดึง novels ทั้งหมดของ user
export const getNovelsByUserId = async (userId: string) => {
    try {
        const novelsList = await db.query.novels.findMany({
            where: eq(novels.userId, userId),
            orderBy: [desc(novels.updatedAt)],
            with: {
                chapters: {
                    orderBy: (chapters, { asc }) => [asc(chapters.orderIndex)]
                }
            }
        });
        return { success: true, novels: novelsList };
    } catch (error) {
        console.error("Get novels error:", error);
        return { success: false, message: "Failed to get novels" };
    }
};

// ดึง novel ตาม id พร้อมข้อมูลเต็ม
export const getNovelById = async (id: string) => {
    try {
        const novel = await db.query.novels.findFirst({
            where: eq(novels.id, id),
            with: {
                user: true,
                chapters: {
                    orderBy: (chapters, { asc }) => [asc(chapters.orderIndex)]
                },
                characters: {
                    orderBy: (characters, { desc }) => [desc(characters.createdAt)]
                },
                locations: {
                    orderBy: (locations, { desc }) => [desc(locations.createdAt)]
                },
                timelineEvents: {
                    orderBy: (timelineEvents, { asc }) => [asc(timelineEvents.orderIndex)]
                },
                notes: {
                    orderBy: (notes, { desc }) => [desc(notes.updatedAt)]
                },
                tags: {
                    orderBy: (tags, { desc }) => [desc(tags.createdAt)]
                }
            }
        });

        if (!novel) {
            return { success: false, message: "Novel not found" };
        }

        return { success: true, novel };
    } catch (error) {
        console.error("Get novel error:", error);
        return { success: false, message: "Failed to get novel" };
    }
};

// ดึง novel แบบง่าย (ไม่มี relations)
export const getNovelByIdSimple = async (id: string) => {
    try {
        const novel = await db.query.novels.findFirst({
            where: eq(novels.id, id)
        });

        if (!novel) {
            return { success: false, message: "Novel not found" };
        }

        return { success: true, novel };
    } catch (error) {
        console.error("Get novel error:", error);
        return { success: false, message: "Failed to get novel" };
    }
};

// ค้นหา novels ตาม title หรือ description
export const searchNovels = async (userId: string, searchTerm: string) => {
    try {
        const novelsList = await db.query.novels.findMany({
            where: and(
                eq(novels.userId, userId),
                or(
                    like(novels.title, `%${searchTerm}%`),
                    like(novels.description, `%${searchTerm}%`)
                )
            ),
            orderBy: [desc(novels.updatedAt)]
        });
        return { success: true, novels: novelsList };
    } catch (error) {
        console.error("Search novels error:", error);
        return { success: false, message: "Failed to search novels" };
    }
};

// ดึง novels ตาม status
export const getNovelsByStatus = async (userId: string, status: string) => {
    try {
        const novelsList = await db.query.novels.findMany({
            where: and(
                eq(novels.userId, userId),
                eq(novels.status, status)
            ),
            orderBy: [desc(novels.updatedAt)]
        });
        return { success: true, novels: novelsList };
    } catch (error) {
        console.error("Get novels by status error:", error);
        return { success: false, message: "Failed to get novels" };
    }
};

// ดึง novels ตาม genre
export const getNovelsByGenre = async (userId: string, genre: string) => {
    try {
        const novelsList = await db.query.novels.findMany({
            where: and(
                eq(novels.userId, userId),
                eq(novels.genre, genre)
            ),
            orderBy: [desc(novels.updatedAt)]
        });
        return { success: true, novels: novelsList };
    } catch (error) {
        console.error("Get novels by genre error:", error);
        return { success: false, message: "Failed to get novels" };
    }
};

// ====================================
// UPDATE - แก้ไข Novel
// ====================================
export const updateNovel = async (id: string, values: Partial<InsertNovel>) => {
    try {
        const [updatedNovel] = await db
            .update(novels)
            .set({ ...values, updatedAt: new Date() })
            .where(eq(novels.id, id))
            .returning();

        if (!updatedNovel) {
            return { success: false, message: "Novel not found" };
        }

        return { success: true, message: "Novel updated successfully", novel: updatedNovel };
    } catch (error) {
        console.error("Update novel error:", error);
        return { success: false, message: "Failed to update novel" };
    }
};

// อัพเดท word count (เรียกเมื่อมีการเปลี่ยนแปลง chapters)
export const updateNovelWordCount = async (novelId: string, totalWordCount: number) => {
    try {
        await db
            .update(novels)
            .set({ wordCount: totalWordCount, updatedAt: new Date() })
            .where(eq(novels.id, novelId));

        return { success: true, message: "Word count updated successfully" };
    } catch (error) {
        console.error("Update word count error:", error);
        return { success: false, message: "Failed to update word count" };
    }
};

// เปลี่ยน status
export const updateNovelStatus = async (id: string, status: string) => {
    try {
        const [updatedNovel] = await db
            .update(novels)
            .set({ status, updatedAt: new Date() })
            .where(eq(novels.id, id))
            .returning();

        if (!updatedNovel) {
            return { success: false, message: "Novel not found" };
        }

        return { success: true, message: "Status updated successfully", novel: updatedNovel };
    } catch (error) {
        console.error("Update status error:", error);
        return { success: false, message: "Failed to update status" };
    }
};

// เปลี่ยน visibility
export const updateNovelVisibility = async (id: string, visibility: string) => {
    try {
        const [updatedNovel] = await db
            .update(novels)
            .set({ visibility, updatedAt: new Date() })
            .where(eq(novels.id, id))
            .returning();

        if (!updatedNovel) {
            return { success: false, message: "Novel not found" };
        }

        return { success: true, message: "Visibility updated successfully", novel: updatedNovel };
    } catch (error) {
        console.error("Update visibility error:", error);
        return { success: false, message: "Failed to update visibility" };
    }
};

// ====================================
// DELETE - ลบ Novel
// ====================================
export const deleteNovel = async (id: string) => {
    try {
        const [deletedNovel] = await db
            .delete(novels)
            .where(eq(novels.id, id))
            .returning();

        if (!deletedNovel) {
            return { success: false, message: "Novel not found" };
        }

        return { success: true, message: "Novel deleted successfully" };
    } catch (error) {
        console.error("Delete novel error:", error);
        return { success: false, message: "Failed to delete novel" };
    }
};

// ====================================
// STATISTICS - สถิติ
// ====================================

// ดึงสถิติของ novel
export const getNovelStats = async (id: string) => {
    try {
        const novel = await db.query.novels.findFirst({
            where: eq(novels.id, id),
            with: {
                chapters: true,
                characters: true,
                locations: true,
                notes: true
            }
        });

        if (!novel) {
            return { success: false, message: "Novel not found" };
        }

        const stats = {
            totalChapters: novel.chapters.length,
            totalCharacters: novel.characters.length,
            totalLocations: novel.locations.length,
            totalNotes: novel.notes.length,
            totalWords: novel.wordCount,
            targetWords: novel.targetWordCount,
            progress: novel.targetWordCount
                ? Math.round((novel.wordCount / novel.targetWordCount) * 100)
                : 0,
            publishedChapters: novel.chapters.filter(ch => ch.status === "published").length,
            draftChapters: novel.chapters.filter(ch => ch.status === "draft").length
        };

        return { success: true, stats };
    } catch (error) {
        console.error("Get novel stats error:", error);
        return { success: false, message: "Failed to get novel statistics" };
    }
};



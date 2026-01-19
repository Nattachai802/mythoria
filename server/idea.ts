'use server';

import { db } from "@/db/drizzle";
import { ideas, ideaConnections, Idea } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_DURATION } from "@/lib/cache-config";

export async function createIdea(data: {
    title: string;
    content?: string;
    summary?: string;
    novelId: string;
    category?: string;
    tags?: string[];
    linkedChapterId?: string;
    linkedCharacterIds?: string[];
    canvasX?: number;
    canvasY?: number;
    color?: string;
}) {
    try {
        const [newIdea] = await db
            .insert(ideas)
            .values({
                title: data.title,
                content: data.content,
                summary: data.summary,
                novelId: data.novelId,
                category: data.category || "general",
                tags: data.tags,
                linkedChapterId: data.linkedChapterId,
                linkedCharacterIds: data.linkedCharacterIds,
                canvasX: data.canvasX,
                canvasY: data.canvasY,
                color: data.color,
            })
            .returning();

        // Clear cache (Next.js 16 requires 2 args)
        revalidateTag(CACHE_TAGS.ideas(data.novelId), "default");
        revalidatePath(`/dashboard/project/${data.novelId}/idea`);

        return { success: true, data: newIdea };
    } catch (error) {
        console.error("Error creating idea:", error);
        return { success: false, error: "Failed to create idea" };
    }
}

/**
 * Create idea without revalidation - for use during render (Discord sync)
 * This avoids the "revalidateTag during render" error
 */
export async function createIdeaWithoutRevalidate(data: {
    title: string;
    content?: string;
    summary?: string;
    novelId: string;
    category?: string;
    tags?: string[];
    linkedChapterId?: string;
    linkedCharacterIds?: string[];
    canvasX?: number;
    canvasY?: number;
    color?: string;
}) {
    try {
        const [newIdea] = await db
            .insert(ideas)
            .values({
                title: data.title,
                content: data.content,
                summary: data.summary,
                novelId: data.novelId,
                category: data.category || "general",
                tags: data.tags,
                linkedChapterId: data.linkedChapterId,
                linkedCharacterIds: data.linkedCharacterIds,
                canvasX: data.canvasX,
                canvasY: data.canvasY,
                color: data.color,
            })
            .returning();

        // No revalidation here - will be refreshed on next page load
        return { success: true, data: newIdea };
    } catch (error) {
        console.error("Error creating idea:", error);
        return { success: false, error: "Failed to create idea" };
    }
}

export async function getIdeasByNovelId(novelId: string) {
    try {
        const allIdeas = await db
            .select()
            .from(ideas)
            .where(eq(ideas.novelId, novelId))
            .orderBy(ideas.createdAt);

        return { success: true, data: allIdeas };
    } catch (error) {
        console.error("Error fetching ideas:", error);
        return { success: false, error: "Failed to fetch ideas" };
    }
}

// Internal count function
const _getIdeasCount = async (novelId: string) => {
    try {
        const result = await db
            .select({ id: ideas.id })
            .from(ideas)
            .where(eq(ideas.novelId, novelId));

        return { success: true as const, count: result.length };
    } catch (error) {
        console.error("Error counting ideas:", error);
        return { success: false as const, count: 0 };
    }
};

// Cached version - Fast count-only query with 60s cache
export async function getIdeasCount(novelId: string) {
    const cachedFn = unstable_cache(
        () => _getIdeasCount(novelId),
        [`ideas-count-${novelId}`],
        {
            revalidate: 60,
            tags: [CACHE_TAGS.ideas(novelId)]
        }
    );
    return cachedFn();
}

export async function getIdeaById(ideaId: string) {
    try {
        const [idea] = await db
            .select()
            .from(ideas)
            .where(eq(ideas.id, ideaId))
            .limit(1);

        if (!idea) {
            return { success: false, error: "Idea not found" };
        }

        return { success: true, data: idea };
    } catch (error) {
        console.error("Error fetching idea:", error);
        return { success: false, error: "Failed to fetch idea" };
    }
}

export async function updateIdea(
    ideaId: string,
    data: Partial<{
        title: string;
        content: string;
        summary: string;
        category: string;
        tags: string[];
        linkedChapterId: string | null;
        linkedCharacterIds: string[];
        canvasX: number;
        canvasY: number;
        color: string;
        isArchived: boolean;
        connectedIdeaIds: string[];
    }>
) {
    try {
        const [updatedIdea] = await db
            .update(ideas)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(ideas.id, ideaId))
            .returning();

        if (!updatedIdea) {
            return { success: false, error: "Idea not found" };
        }

        revalidatePath(`/dashboard/project/${updatedIdea.novelId}/idea`);

        return { success: true, data: updatedIdea };
    } catch (error) {
        console.error("Error updating idea:", error);
        return { success: false, error: "Failed to update idea" };
    }
}

export async function deleteIdea(ideaId: string) {
    try {
        const [deletedIdea] = await db
            .delete(ideas)
            .where(eq(ideas.id, ideaId))
            .returning();

        if (!deletedIdea) {
            return { success: false, error: "Idea not found" };
        }

        revalidatePath(`/dashboard/project/${deletedIdea.novelId}/idea`);

        return { success: true, data: deletedIdea };
    } catch (error) {
        console.error("Error deleting idea:", error);
        return { success: false, error: "Failed to delete idea" };
    }
}

export async function deleteAllIdeas(novelId: string) {
    try {
        const deletedIdeas = await db
            .delete(ideas)
            .where(eq(ideas.novelId, novelId))
            .returning();

        revalidateTag(CACHE_TAGS.ideas(novelId), "default");
        revalidatePath(`/dashboard/project/${novelId}/idea`);

        return {
            success: true,
            count: deletedIdeas.length,
            message: `Deleted ${deletedIdeas.length} ideas`
        };
    } catch (error) {
        console.error("Error deleting all ideas:", error);
        return { success: false, error: "Failed to delete ideas" };
    }
}

// Batch update canvas positions (for playground drag & drop)
export async function updateIdeaPositions(
    updates: Array<{ id: string; canvasX: number; canvasY: number }>
) {
    try {
        const results = await Promise.all(
            updates.map(({ id, canvasX, canvasY }) =>
                db
                    .update(ideas)
                    .set({ canvasX, canvasY, updatedAt: new Date() })
                    .where(eq(ideas.id, id))
                    .returning()
            )
        );

        return { success: true, data: results.flat() };
    } catch (error) {
        console.error("Error updating idea positions:", error);
        return { success: false, error: "Failed to update positions" };
    }
}

// ============================================
// IDEA CONNECTIONS
// ============================================

export async function createIdeaConnection(data: {
    sourceIdeaId: string;
    targetIdeaId: string;
    novelId: string;
    label?: string;
}) {
    try {
        const [connection] = await db
            .insert(ideaConnections)
            .values(data)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/idea`);

        return { success: true, data: connection };
    } catch (error) {
        console.error("Error creating idea connection:", error);
        return { success: false, error: "Failed to create connection" };
    }
}

export async function getIdeaConnectionsByNovelId(novelId: string) {
    try {
        const connections = await db
            .select()
            .from(ideaConnections)
            .where(eq(ideaConnections.novelId, novelId));

        return { success: true, data: connections };
    } catch (error) {
        console.error("Error fetching idea connections:", error);
        return { success: false, error: "Failed to fetch connections" };
    }
}

export async function deleteIdeaConnection(connectionId: string) {
    try {
        const [deleted] = await db
            .delete(ideaConnections)
            .where(eq(ideaConnections.id, connectionId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Connection not found" };
        }

        revalidatePath(`/dashboard/project/${deleted.novelId}/idea`);

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting idea connection:", error);
        return { success: false, error: "Failed to delete connection" };
    }
}
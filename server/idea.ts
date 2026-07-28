'use server';

import { db } from "@/db/drizzle";
import { ideas, ideaConnections, Idea } from "@/db/schema";
import { eq, and, inArray, ilike } from "drizzle-orm";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_DURATION } from "@/lib/cache-config";
import { addReference, removeReferenceEdge } from "./references"; // Context Fabric dual-write (P4)
import { requireNovelAccess } from "@/lib/authz";

const ideaRelation = (t?: string): "derived_from" | "linked_to" => (t === "ancestor" ? "derived_from" : "linked_to");

// คืนแถวเต็ม ไม่ใช่แค่ id/title — createIdea ใช้ผลนี้เป็น data ตอนเจอชื่อซ้ำ
// ถ้า select แคบกว่านี้ ผู้เรียกที่อ่าน field อื่น (เช่น content บนกระดาน playground)
// จะได้ undefined เงียบๆ ทั้งที่ไอเดียนั้นมีเนื้อหาอยู่จริง
async function findIdeaByTitle(novelId: string, title: string) {
    const [existing] = await db
        .select()
        .from(ideas)
        .where(and(eq(ideas.novelId, novelId), ilike(ideas.title, title.trim())))
        .limit(1);
    return existing ?? null;
}

export async function createIdea(data: {
    title: string;
    content?: string;
    summary?: string;
    novelId: string;
    category?: string;
    tags?: string[];
    linkedChapterId?: string;
    linkedCharacterIds?: string[];
    linkedPowerIds?: string[];
    linkedLoreIds?: string[];
    linkedLocationIds?: string[];
    linkedEntityIds?: string[];
    canvasX?: number;
    canvasY?: number;
    color?: string;
    isUsed?: boolean;
}) {
    try {
        await requireNovelAccess(data.novelId);
        const duplicate = await findIdeaByTitle(data.novelId, data.title);
        if (duplicate) {
            return { success: true, data: duplicate, isDuplicate: true };
        }

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
                linkedPowerIds: data.linkedPowerIds,
                linkedLoreIds: data.linkedLoreIds,
                linkedEntityIds: data.linkedEntityIds,
                canvasX: data.canvasX,
                canvasY: data.canvasY,
                color: data.color,
                isUsed: data.isUsed ?? (data.canvasX !== undefined && data.canvasY !== undefined),
            })
            .returning();

        revalidateTag(CACHE_TAGS.ideas(data.novelId), "default");
        revalidatePath(`/dashboard/project/${data.novelId}/idea`);

        return { success: true, data: newIdea, isDuplicate: false };
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
    linkedPowerIds?: string[];
    linkedLoreIds?: string[];
    linkedLocationIds?: string[];
    linkedEntityIds?: string[];
    canvasX?: number;
    canvasY?: number;
    color?: string;
    isUsed?: boolean;
}) {
    try {
        await requireNovelAccess(data.novelId);
        const duplicate = await findIdeaByTitle(data.novelId, data.title);
        if (duplicate) {
            return { success: true, data: duplicate, isDuplicate: true };
        }

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
                linkedPowerIds: data.linkedPowerIds,
                linkedLoreIds: data.linkedLoreIds,
                linkedLocationIds: data.linkedLocationIds,
                linkedEntityIds: data.linkedEntityIds,
                canvasX: data.canvasX,
                canvasY: data.canvasY,
                color: data.color,
                isUsed: data.isUsed ?? (data.canvasX !== undefined && data.canvasY !== undefined),
            })
            .returning();

        return { success: true, data: newIdea, isDuplicate: false };
    } catch (error) {
        console.error("Error creating idea:", error);
        return { success: false, error: "Failed to create idea" };
    }
}

export async function getIdeasByNovelId(novelId: string, includeDetected: boolean = false) {
    try {
        await requireNovelAccess(novelId);
        const allIdeas = await db
            .select()
            .from(ideas)
            .where(
                includeDetected
                    ? eq(ideas.novelId, novelId)
                    : and(eq(ideas.novelId, novelId), eq(ideas.isDetected, false))
            )
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
            .where(and(eq(ideas.novelId, novelId), eq(ideas.isDetected, false)));

        return { success: true as const, count: result.length };
    } catch (error) {
        console.error("Error counting ideas:", error);
        return { success: false as const, count: 0 };
    }
};

// Cached version - Fast count-only query with 60s cache
export async function getIdeasCount(novelId: string) {
    // เช็คสิทธิ์นอก unstable_cache เสมอ — ถ้าเช็คในนั้น cache hit จะข้ามการเช็คไป
    await requireNovelAccess(novelId);
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
        await requireNovelAccess(idea.novelId);

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
        linkedPowerIds: string[];
        linkedLoreIds: string[];
        linkedLocationIds: string[];
        linkedEntityIds: string[];
        canvasX: number;
        canvasY: number;
        color: string;
        isUsed: boolean; // Can manually override
        isArchived: boolean;
        isDetected: boolean;
        connectedIdeaIds: string[];
    }>
) {
    try {
        const [existing] = await db
            .select({ novelId: ideas.novelId })
            .from(ideas)
            .where(eq(ideas.id, ideaId))
            .limit(1);
        if (!existing) {
            return { success: false, error: "Idea not found" };
        }
        await requireNovelAccess(existing.novelId);

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
        const [existing] = await db
            .select({ novelId: ideas.novelId })
            .from(ideas)
            .where(eq(ideas.id, ideaId))
            .limit(1);
        if (!existing) {
            return { success: false, error: "Idea not found" };
        }
        await requireNovelAccess(existing.novelId);

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
        await requireNovelAccess(novelId);
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

// Bulk accept detected ideas (set isDetected = false)
export async function acceptMultipleIdeas(ideaIds: string[], novelId: string) {
    try {
        if (!ideaIds || ideaIds.length === 0) {
            return { success: false, error: "No ideas selected" };
        }
        await requireNovelAccess(novelId);
        const accepted = await db
            .update(ideas)
            .set({ isDetected: false, updatedAt: new Date() })
            .where(
                and(
                    eq(ideas.novelId, novelId),
                    inArray(ideas.id, ideaIds)
                )
            )
            .returning();

        revalidateTag(CACHE_TAGS.ideas(novelId), "default");
        revalidatePath(`/dashboard/project/${novelId}/idea`);

        return {
            success: true,
            count: accepted.length,
            message: `Accepted ${accepted.length} ideas`
        };
    } catch (error) {
        console.error("Error accepting multiple ideas:", error);
        return { success: false, error: "Failed to accept ideas" };
    }
}

export async function deleteMultipleIdeas(ideaIds: string[], novelId: string) {
    try {
        if (!ideaIds || ideaIds.length === 0) {
            return { success: false, error: "No ideas selected" };
        }
        await requireNovelAccess(novelId);
        const deletedIdeas = await db
            .delete(ideas)
            .where(
                and(
                    eq(ideas.novelId, novelId),
                    inArray(ideas.id, ideaIds)
                )
            )
            .returning();

        revalidateTag(CACHE_TAGS.ideas(novelId), "default");
        revalidatePath(`/dashboard/project/${novelId}/idea`);

        return {
            success: true,
            count: deletedIdeas.length,
            message: `Deleted ${deletedIdeas.length} ideas`
        };
    } catch (error) {
        console.error("Error deleting multiple ideas:", error);
        return { success: false, error: "Failed to delete ideas" };
    }
}


// Batch update canvas positions (for playground drag & drop)
export async function updateIdeaPositions(
    updates: Array<{ id: string; canvasX: number; canvasY: number }>
) {
    try {
        // verify เจ้าของของ novel ที่ ideas เหล่านี้สังกัด (ไม่มี novelId ส่งมาตรง ๆ)
        const ids = updates.map((u) => u.id);
        const rows: { novelId: string }[] = ids.length
            ? await db.select({ novelId: ideas.novelId }).from(ideas).where(inArray(ideas.id, ids))
            : [];
        for (const nid of new Set<string>(rows.map((r) => r.novelId))) {
            await requireNovelAccess(nid);
        }

        const results = await Promise.all(
            updates.map(({ id, canvasX, canvasY }) =>
                db
                    .update(ideas)
                    .set({
                        canvasX,
                        canvasY,
                        isUsed: true, // Auto-set to true when placing on canvas
                        updatedAt: new Date()
                    })
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
    connectionType?: string; // "related" | "ancestor"
    label?: string;
}) {
    try {
        await requireNovelAccess(data.novelId);
        const [connection] = await db
            .insert(ideaConnections)
            .values({
                sourceIdeaId: data.sourceIdeaId,
                targetIdeaId: data.targetIdeaId,
                novelId: data.novelId,
                connectionType: data.connectionType || "related",
                label: data.label,
            })
            .returning();

        await addReference({
            novelId: data.novelId,
            from: { type: "idea", id: data.sourceIdeaId },
            to: { type: "idea", id: data.targetIdeaId },
            relation: ideaRelation(data.connectionType),
            meta: data.label ? { label: data.label } : null,
        });

        revalidatePath(`/dashboard/project/${data.novelId}/idea`);

        return { success: true, data: connection };
    } catch (error) {
        console.error("Error creating idea connection:", error);
        return { success: false, error: "Failed to create connection" };
    }
}

export async function getIdeaConnectionsByNovelId(novelId: string) {
    try {
        await requireNovelAccess(novelId);
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

// Get ancestor ideas for a specific idea (ideas that motivated/caused this idea)
// "ไอเดียนี้เกิดจากอะไร?"
export async function getAncestorIdeas(ideaId: string) {
    try {
        const [owner] = await db.select({ novelId: ideas.novelId }).from(ideas).where(eq(ideas.id, ideaId)).limit(1);
        if (!owner) return { success: false, error: "Idea not found" };
        await requireNovelAccess(owner.novelId);
        const connections = await db
            .select({
                connectionId: ideaConnections.id,
                ancestorIdeaId: ideaConnections.targetIdeaId,
                label: ideaConnections.label,
                createdAt: ideaConnections.createdAt,
            })
            .from(ideaConnections)
            .where(
                and(
                    eq(ideaConnections.sourceIdeaId, ideaId),
                    eq(ideaConnections.connectionType, "ancestor")
                )
            );

        // Fetch full ancestor idea details
        if (connections.length === 0) {
            return { success: true, data: [] };
        }

        const ancestorIds = connections.map(c => c.ancestorIdeaId);
        const ancestorIdeas = await db
            .select()
            .from(ideas)
            .where(inArray(ideas.id, ancestorIds));

        // Merge connection data with idea data
        const result = connections.map(conn => {
            const idea = ancestorIdeas.find(i => i.id === conn.ancestorIdeaId);
            return {
                connectionId: conn.connectionId,
                label: conn.label,
                idea: idea || null,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("Error fetching ancestor ideas:", error);
        return { success: false, error: "Failed to fetch ancestor ideas" };
    }
}

// Get descendant ideas for a specific idea (ideas caused by this idea)
// "ไอเดียนี้ส่งผลให้เกิดอะไรบ้าง?"
export async function getDescendantIdeas(ideaId: string) {
    try {
        const [owner] = await db.select({ novelId: ideas.novelId }).from(ideas).where(eq(ideas.id, ideaId)).limit(1);
        if (!owner) return { success: false, error: "Idea not found" };
        await requireNovelAccess(owner.novelId);
        const connections = await db
            .select({
                connectionId: ideaConnections.id,
                descendantIdeaId: ideaConnections.sourceIdeaId,
                label: ideaConnections.label,
                createdAt: ideaConnections.createdAt,
            })
            .from(ideaConnections)
            .where(
                and(
                    eq(ideaConnections.targetIdeaId, ideaId),
                    eq(ideaConnections.connectionType, "ancestor")
                )
            );

        if (connections.length === 0) {
            return { success: true, data: [] };
        }

        const descendantIds = connections.map(c => c.descendantIdeaId);
        const descendantIdeas = await db
            .select()
            .from(ideas)
            .where(inArray(ideas.id, descendantIds));

        const result = connections.map(conn => {
            const idea = descendantIdeas.find(i => i.id === conn.descendantIdeaId);
            return {
                connectionId: conn.connectionId,
                label: conn.label,
                idea: idea || null,
            };
        });

        return { success: true, data: result };
    } catch (error) {
        console.error("Error fetching descendant ideas:", error);
        return { success: false, error: "Failed to fetch descendant ideas" };
    }
}

// Get all ancestor-type connections for a novel (for canvas visualization)
export async function getAncestorConnectionsByNovelId(novelId: string) {
    try {
        await requireNovelAccess(novelId);
        const connections = await db
            .select()
            .from(ideaConnections)
            .where(
                and(
                    eq(ideaConnections.novelId, novelId),
                    eq(ideaConnections.connectionType, "ancestor")
                )
            );

        return { success: true, data: connections };
    } catch (error) {
        console.error("Error fetching ancestor connections:", error);
        return { success: false, error: "Failed to fetch ancestor connections" };
    }
}

export async function deleteIdeaConnection(connectionId: string) {
    try {
        const [existing] = await db
            .select({ novelId: ideaConnections.novelId })
            .from(ideaConnections)
            .where(eq(ideaConnections.id, connectionId))
            .limit(1);
        if (!existing) {
            return { success: false, error: "Connection not found" };
        }
        await requireNovelAccess(existing.novelId);

        const [deleted] = await db
            .delete(ideaConnections)
            .where(eq(ideaConnections.id, connectionId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Connection not found" };
        }

        await removeReferenceEdge({
            from: { type: "idea", id: deleted.sourceIdeaId },
            to: { type: "idea", id: deleted.targetIdeaId },
            relation: ideaRelation(deleted.connectionType),
        });

        revalidatePath(`/dashboard/project/${deleted.novelId}/idea`);

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting idea connection:", error);
        return { success: false, error: "Failed to delete connection" };
    }
}
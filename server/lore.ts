'use server';

import { db } from "@/db/drizzle";
import { loreEntries } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createLoreEntry(data: {
    title: string;
    content?: string;
    type?: string;
    eraId?: string | null; // Era-based timeline
    orderInEra?: number; // Order within era
    novelId: string;
    scope?: string; // "world" | "location"
    locationId?: string | null;
    parentLoreId?: string | null; // for sub-lore
    groupId?: string | null; // for lore grouping
    orderIndex?: number;
    relatedCharacterIds?: string[];
    relatedLocationIds?: string[];
    relatedItemIds?: string[];
    icon?: string;
    color?: string;
    importance?: number;
}) {
    try {
        // Get max orderIndex if not provided
        let orderIndex = data.orderIndex;
        if (orderIndex === undefined) {
            const existingEntries = await db.query.loreEntries.findMany({
                where: eq(loreEntries.novelId, data.novelId),
            });
            orderIndex = existingEntries.length;
        }

        const [newEntry] = await db
            .insert(loreEntries)
            .values({
                ...data,
                orderIndex,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/worldbuilding`);

        return { success: true, data: newEntry };
    } catch (error) {
        console.error("Error creating lore entry:", error);
        return { success: false, error: "Failed to create lore entry" };
    }
}

export async function getLoreEntriesByNovelId(novelId: string) {
    try {
        const allEntries = await db.query.loreEntries.findMany({
            where: eq(loreEntries.novelId, novelId),
            orderBy: [asc(loreEntries.orderIndex)],
            with: {
                location: true,
                era: true,
                parentLore: true,
                childLores: true,
                group: true,
            },
        });

        return { success: true, data: allEntries };
    } catch (error) {
        console.error("Error fetching lore entries:", error);
        return { success: false, error: "Failed to fetch lore entries" };
    }
}

export async function getLoreEntryById(loreId: string) {
    try {
        const entry = await db.query.loreEntries.findFirst({
            where: eq(loreEntries.id, loreId),
        });

        if (!entry) {
            return { success: false, error: "Lore entry not found" };
        }

        return { success: true, data: entry };
    } catch (error) {
        console.error("Error fetching lore entry:", error);
        return { success: false, error: "Failed to fetch lore entry" };
    }
}

export async function updateLoreEntry(
    loreId: string,
    data: Partial<{
        title: string;
        content: string;
        type: string;
        eraId: string | null;
        orderInEra: number;
        scope: string;
        locationId: string | null;
        parentLoreId: string | null;
        groupId: string | null;
        orderIndex: number;
        relatedCharacterIds: string[];
        relatedLocationIds: string[];
        relatedItemIds: string[];
        icon: string;
        color: string;
        importance: number;
    }>
) {
    try {
        const [updatedEntry] = await db
            .update(loreEntries)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(loreEntries.id, loreId))
            .returning();

        if (!updatedEntry) {
            return { success: false, error: "Lore entry not found" };
        }

        revalidatePath(`/dashboard/project/${updatedEntry.novelId}/worldbuilding`);

        return { success: true, data: updatedEntry };
    } catch (error) {
        console.error("Error updating lore entry:", error);
        return { success: false, error: "Failed to update lore entry" };
    }
}

export async function deleteLoreEntry(loreId: string) {
    try {
        const [deletedEntry] = await db
            .delete(loreEntries)
            .where(eq(loreEntries.id, loreId))
            .returning();

        if (!deletedEntry) {
            return { success: false, error: "Lore entry not found" };
        }

        revalidatePath(`/dashboard/project/${deletedEntry.novelId}/worldbuilding`);

        return { success: true, data: deletedEntry };
    } catch (error) {
        console.error("Error deleting lore entry:", error);
        return { success: false, error: "Failed to delete lore entry" };
    }
}

// Reorder lore entries (for horizontal timeline drag-drop)
export async function reorderLoreEntries(novelId: string, orderedIds: string[]) {
    try {
        // Update each entry with new orderIndex
        const updates = orderedIds.map((id, index) =>
            db
                .update(loreEntries)
                .set({ orderIndex: index, updatedAt: new Date() })
                .where(eq(loreEntries.id, id))
        );

        await Promise.all(updates);

        revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);

        return { success: true };
    } catch (error) {
        console.error("Error reordering lore entries:", error);
        return { success: false, error: "Failed to reorder lore entries" };
    }
}

// Get lore by type
export async function getLoreByType(novelId: string, type: string) {
    try {
        const entries = await db.query.loreEntries.findMany({
            where: eq(loreEntries.novelId, novelId),
            orderBy: [asc(loreEntries.orderIndex)],
        });

        const filtered = entries.filter((e) => e.type === type);

        return { success: true, data: filtered };
    } catch (error) {
        console.error("Error fetching lore by type:", error);
        return { success: false, error: "Failed to fetch lore entries" };
    }
}

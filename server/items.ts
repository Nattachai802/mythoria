'use server';

import { db } from "@/db/drizzle";
import { items, characters, locations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createItem(data: {
    name: string;
    description?: string;
    type?: string;
    rarity?: string;
    novelId: string;
    currentOwnerId?: string;
    locationId?: string;
    properties?: Record<string, unknown>;
    lore?: string;
    image?: string;
    icon?: string;
}) {
    try {
        const [newItem] = await db
            .insert(items)
            .values({
                ...data,
                currentOwnerId: data.currentOwnerId || null,
                locationId: data.locationId || null,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/worldbuilding`);

        return { success: true, data: newItem };
    } catch (error) {
        console.error("Error creating item:", error);
        return { success: false, error: "Failed to create item" };
    }
}

export async function getItemsByNovelId(novelId: string) {
    try {
        const allItems = await db.query.items.findMany({
            where: eq(items.novelId, novelId),
            with: {
                owner: true,
                location: true,
            },
            orderBy: (items, { desc }) => [desc(items.createdAt)],
        });

        return { success: true, data: allItems };
    } catch (error) {
        console.error("Error fetching items:", error);
        return { success: false, error: "Failed to fetch items" };
    }
}

export async function getItemById(itemId: string) {
    try {
        const item = await db.query.items.findFirst({
            where: eq(items.id, itemId),
            with: {
                owner: true,
                location: true,
            },
        });

        if (!item) {
            return { success: false, error: "Item not found" };
        }

        return { success: true, data: item };
    } catch (error) {
        console.error("Error fetching item:", error);
        return { success: false, error: "Failed to fetch item" };
    }
}

export async function updateItem(
    itemId: string,
    data: Partial<{
        name: string;
        description: string;
        type: string;
        rarity: string;
        currentOwnerId: string | null;
        locationId: string | null;
        properties: Record<string, unknown>;
        lore: string;
        image: string;
        icon: string;
    }>
) {
    try {
        const [updatedItem] = await db
            .update(items)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(items.id, itemId))
            .returning();

        if (!updatedItem) {
            return { success: false, error: "Item not found" };
        }

        revalidatePath(`/dashboard/project/${updatedItem.novelId}/worldbuilding`);

        return { success: true, data: updatedItem };
    } catch (error) {
        console.error("Error updating item:", error);
        return { success: false, error: "Failed to update item" };
    }
}

export async function deleteItem(itemId: string) {
    try {
        const [deletedItem] = await db
            .delete(items)
            .where(eq(items.id, itemId))
            .returning();

        if (!deletedItem) {
            return { success: false, error: "Item not found" };
        }

        revalidatePath(`/dashboard/project/${deletedItem.novelId}/worldbuilding`);

        return { success: true, data: deletedItem };
    } catch (error) {
        console.error("Error deleting item:", error);
        return { success: false, error: "Failed to delete item" };
    }
}

// Transfer item ownership
export async function transferItemOwner(itemId: string, newOwnerId: string | null) {
    try {
        const [updatedItem] = await db
            .update(items)
            .set({
                currentOwnerId: newOwnerId,
                updatedAt: new Date(),
            })
            .where(eq(items.id, itemId))
            .returning();

        if (!updatedItem) {
            return { success: false, error: "Item not found" };
        }

        revalidatePath(`/dashboard/project/${updatedItem.novelId}/worldbuilding`);

        return { success: true, data: updatedItem };
    } catch (error) {
        console.error("Error transferring item:", error);
        return { success: false, error: "Failed to transfer item" };
    }
}

// Get items by character (owner)
export async function getItemsByCharacter(characterId: string) {
    try {
        const characterItems = await db.query.items.findMany({
            where: eq(items.currentOwnerId, characterId),
            with: {
                location: true,
            },
        });

        return { success: true, data: characterItems };
    } catch (error) {
        console.error("Error fetching character items:", error);
        return { success: false, error: "Failed to fetch character items" };
    }
}

// Get items at location
export async function getItemsByLocation(locationId: string) {
    try {
        const locationItems = await db.query.items.findMany({
            where: eq(items.locationId, locationId),
            with: {
                owner: true,
            },
        });

        return { success: true, data: locationItems };
    } catch (error) {
        console.error("Error fetching location items:", error);
        return { success: false, error: "Failed to fetch location items" };
    }
}

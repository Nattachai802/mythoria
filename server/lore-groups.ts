'use server';

import { db } from "@/db/drizzle";
import { loreGroups } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createLoreGroup(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    novelId: string;
}) {
    try {
        // Get max orderIndex
        const existingGroups = await db.query.loreGroups.findMany({
            where: eq(loreGroups.novelId, data.novelId),
        });
        const orderIndex = existingGroups.length;

        const [newGroup] = await db
            .insert(loreGroups)
            .values({
                ...data,
                orderIndex,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/worldbuilding`);

        return { success: true, data: newGroup };
    } catch (error) {
        console.error("Error creating lore group:", error);
        return { success: false, error: "Failed to create lore group" };
    }
}

export async function getLoreGroupsByNovelId(novelId: string) {
    try {
        const groups = await db.query.loreGroups.findMany({
            where: eq(loreGroups.novelId, novelId),
            orderBy: [asc(loreGroups.orderIndex)],
            with: {
                loreEntries: true,
            },
        });

        return { success: true, data: groups };
    } catch (error) {
        console.error("Error fetching lore groups:", error);
        return { success: false, error: "Failed to fetch lore groups" };
    }
}

export async function updateLoreGroup(
    groupId: string,
    data: Partial<{
        name: string;
        description: string;
        color: string;
        icon: string;
        orderIndex: number;
    }>
) {
    try {
        const [updatedGroup] = await db
            .update(loreGroups)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(loreGroups.id, groupId))
            .returning();

        if (!updatedGroup) {
            return { success: false, error: "Lore group not found" };
        }

        revalidatePath(`/dashboard/project/${updatedGroup.novelId}/worldbuilding`);

        return { success: true, data: updatedGroup };
    } catch (error) {
        console.error("Error updating lore group:", error);
        return { success: false, error: "Failed to update lore group" };
    }
}

export async function deleteLoreGroup(groupId: string) {
    try {
        const [deletedGroup] = await db
            .delete(loreGroups)
            .where(eq(loreGroups.id, groupId))
            .returning();

        if (!deletedGroup) {
            return { success: false, error: "Lore group not found" };
        }

        revalidatePath(`/dashboard/project/${deletedGroup.novelId}/worldbuilding`);

        return { success: true, data: deletedGroup };
    } catch (error) {
        console.error("Error deleting lore group:", error);
        return { success: false, error: "Failed to delete lore group" };
    }
}

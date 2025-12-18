'use server';

import { db } from "@/db/drizzle";
import { eras, loreEntries } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createEra(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    novelId: string;
}) {
    try {
        // Get max orderIndex
        const existingEras = await db.query.eras.findMany({
            where: eq(eras.novelId, data.novelId),
        });
        const orderIndex = existingEras.length;

        const [newEra] = await db
            .insert(eras)
            .values({
                ...data,
                orderIndex,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/worldbuilding`);

        return { success: true, data: newEra };
    } catch (error) {
        console.error("Error creating era:", error);
        return { success: false, error: "Failed to create era" };
    }
}

export async function getErasByNovelId(novelId: string) {
    try {
        const allEras = await db.query.eras.findMany({
            where: eq(eras.novelId, novelId),
            orderBy: [asc(eras.orderIndex)],
            with: {
                loreEntries: {
                    orderBy: [asc(loreEntries.orderInEra)],
                    with: {
                        location: true,
                        parentLore: true,
                        childLores: true,
                        group: true,
                    },
                },
            },
        });

        return { success: true, data: allEras };
    } catch (error) {
        console.error("Error fetching eras:", error);
        return { success: false, error: "Failed to fetch eras" };
    }
}

export async function getEraById(eraId: string) {
    try {
        const era = await db.query.eras.findFirst({
            where: eq(eras.id, eraId),
            with: {
                loreEntries: {
                    orderBy: [asc(loreEntries.orderInEra)],
                },
            },
        });

        if (!era) {
            return { success: false, error: "Era not found" };
        }

        return { success: true, data: era };
    } catch (error) {
        console.error("Error fetching era:", error);
        return { success: false, error: "Failed to fetch era" };
    }
}

export async function updateEra(
    eraId: string,
    data: Partial<{
        name: string;
        description: string;
        color: string;
        icon: string;
        orderIndex: number;
    }>
) {
    try {
        const [updatedEra] = await db
            .update(eras)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(eras.id, eraId))
            .returning();

        if (!updatedEra) {
            return { success: false, error: "Era not found" };
        }

        revalidatePath(`/dashboard/project/${updatedEra.novelId}/worldbuilding`);

        return { success: true, data: updatedEra };
    } catch (error) {
        console.error("Error updating era:", error);
        return { success: false, error: "Failed to update era" };
    }
}

export async function deleteEra(eraId: string) {
    try {
        const [deletedEra] = await db
            .delete(eras)
            .where(eq(eras.id, eraId))
            .returning();

        if (!deletedEra) {
            return { success: false, error: "Era not found" };
        }

        revalidatePath(`/dashboard/project/${deletedEra.novelId}/worldbuilding`);

        return { success: true, data: deletedEra };
    } catch (error) {
        console.error("Error deleting era:", error);
        return { success: false, error: "Failed to delete era" };
    }
}

// Reorder eras
export async function reorderEras(novelId: string, orderedIds: string[]) {
    try {
        const updates = orderedIds.map((id, index) =>
            db
                .update(eras)
                .set({ orderIndex: index, updatedAt: new Date() })
                .where(eq(eras.id, id))
        );

        await Promise.all(updates);

        revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);

        return { success: true };
    } catch (error) {
        console.error("Error reordering eras:", error);
        return { success: false, error: "Failed to reorder eras" };
    }
}

// Migrate old text-based era to new Era records
export async function migrateTextEras(novelId: string) {
    try {
        // Get all lore entries with text era but no eraId
        const loresWithTextEra = await db.query.loreEntries.findMany({
            where: and(
                eq(loreEntries.novelId, novelId),
                // We'll filter in JS for now since drizzle doesn't have isNotNull easily
            ),
        });

        const loresNeedingMigration = loresWithTextEra.filter(
            (lore) => lore.era && !lore.eraId
        );

        if (loresNeedingMigration.length === 0) {
            return { success: true, migrated: 0, message: "No lores need migration" };
        }

        // Get unique era names
        const uniqueEraNames = [...new Set(loresNeedingMigration.map((l) => l.era!))];

        // Create Era records for each unique name
        const eraMap: Record<string, string> = {};

        // Get existing eras first
        const existingEras = await db.query.eras.findMany({
            where: eq(eras.novelId, novelId),
        });

        let orderIndex = existingEras.length;

        for (const eraName of uniqueEraNames) {
            // Check if era already exists
            const existing = existingEras.find(e => e.name === eraName);
            if (existing) {
                eraMap[eraName] = existing.id;
            } else {
                // Create new era
                const [newEra] = await db
                    .insert(eras)
                    .values({
                        name: eraName,
                        novelId,
                        orderIndex: orderIndex++,
                    })
                    .returning();
                eraMap[eraName] = newEra.id;
            }
        }

        // Update lore entries with eraId
        for (const lore of loresNeedingMigration) {
            if (lore.era && eraMap[lore.era]) {
                await db
                    .update(loreEntries)
                    .set({ eraId: eraMap[lore.era] })
                    .where(eq(loreEntries.id, lore.id));
            }
        }

        revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);

        return {
            success: true,
            migrated: loresNeedingMigration.length,
            erasCreated: uniqueEraNames.length,
            message: `Migrated ${loresNeedingMigration.length} lore entries to ${uniqueEraNames.length} eras`,
        };
    } catch (error) {
        console.error("Error migrating eras:", error);
        return { success: false, error: "Failed to migrate eras" };
    }
}

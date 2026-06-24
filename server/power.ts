'use server';

import { db } from "@/db/drizzle";
import { powers, powerLevels, powerCombinations, Power, PowerLevel, PowerCombination } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { addReference, removeReferenceEdge } from "./references"; // Context Fabric dual-write (P4)

// ============================================
// POWER CRUD
// ============================================

export async function createPower(data: {
    name: string;
    description?: string;
    type?: string;
    rarity?: string;
    maxLevel?: number;
    icon?: string;
    color?: string;
    limitations?: string[];
    novelId: string;
}) {
    try {
        const [newPower] = await db
            .insert(powers)
            .values({
                name: data.name,
                description: data.description,
                type: data.type || "special",
                rarity: data.rarity || "common",
                maxLevel: data.maxLevel || 10,
                icon: data.icon,
                color: data.color,
                limitations: data.limitations,
                novelId: data.novelId,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/powers`);

        return { success: true, data: newPower };
    } catch (error) {
        console.error("Error creating power:", error);
        return { success: false, error: "Failed to create power" };
    }
}

export async function getPowersByNovelId(novelId: string) {
    try {
        const allPowers = await db.query.powers.findMany({
            where: eq(powers.novelId, novelId),
            with: {
                levels: true,
            },
            orderBy: powers.createdAt,
        });

        return { success: true, data: allPowers };
    } catch (error) {
        console.error("Error fetching powers:", error);
        return { success: false, error: "Failed to fetch powers" };
    }
}

export async function getPowerById(powerId: string) {
    try {
        const power = await db.query.powers.findFirst({
            where: eq(powers.id, powerId),
            with: {
                levels: {
                    orderBy: (levels, { asc }) => [asc(levels.level)],
                },
            },
        });

        if (!power) {
            return { success: false, error: "Power not found" };
        }

        return { success: true, data: power };
    } catch (error) {
        console.error("Error fetching power:", error);
        return { success: false, error: "Failed to fetch power" };
    }
}

export async function updatePower(
    powerId: string,
    data: Partial<{
        name: string;
        description: string;
        type: string;
        rarity: string;
        maxLevel: number;
        icon: string;
        color: string;
        limitations: string[];
    }>
) {
    try {
        const [updatedPower] = await db
            .update(powers)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(powers.id, powerId))
            .returning();

        if (!updatedPower) {
            return { success: false, error: "Power not found" };
        }

        revalidatePath(`/dashboard/project/${updatedPower.novelId}/powers`);

        return { success: true, data: updatedPower };
    } catch (error) {
        console.error("Error updating power:", error);
        return { success: false, error: "Failed to update power" };
    }
}

export async function deletePower(powerId: string) {
    try {
        const [deletedPower] = await db
            .delete(powers)
            .where(eq(powers.id, powerId))
            .returning();

        if (!deletedPower) {
            return { success: false, error: "Power not found" };
        }

        revalidatePath(`/dashboard/project/${deletedPower.novelId}/powers`);

        return { success: true, data: deletedPower };
    } catch (error) {
        console.error("Error deleting power:", error);
        return { success: false, error: "Failed to delete power" };
    }
}

// ============================================
// POWER LEVEL CRUD
// ============================================

export async function addPowerLevel(data: {
    powerId: string;
    level: number;
    name?: string;
    description?: string;
    pros?: string[];
    cons?: string[];
    changes?: string[];
    powerBoost?: number;
    cooldown?: number;
    manaCost?: number;
}) {
    try {
        const [newLevel] = await db
            .insert(powerLevels)
            .values({
                powerId: data.powerId,
                level: data.level,
                name: data.name,
                description: data.description,
                pros: data.pros,
                cons: data.cons,
                changes: data.changes,
                powerBoost: data.powerBoost,
                cooldown: data.cooldown,
                manaCost: data.manaCost,
            })
            .returning();

        return { success: true, data: newLevel };
    } catch (error) {
        console.error("Error adding power level:", error);
        return { success: false, error: "Failed to add power level" };
    }
}

export async function updatePowerLevel(
    levelId: string,
    data: Partial<{
        name: string;
        description: string;
        pros: string[];
        cons: string[];
        changes: string[];
        powerBoost: number;
        cooldown: number;
        manaCost: number;
    }>
) {
    try {
        const [updatedLevel] = await db
            .update(powerLevels)
            .set(data)
            .where(eq(powerLevels.id, levelId))
            .returning();

        if (!updatedLevel) {
            return { success: false, error: "Power level not found" };
        }

        return { success: true, data: updatedLevel };
    } catch (error) {
        console.error("Error updating power level:", error);
        return { success: false, error: "Failed to update power level" };
    }
}

export async function deletePowerLevel(levelId: string) {
    try {
        const [deletedLevel] = await db
            .delete(powerLevels)
            .where(eq(powerLevels.id, levelId))
            .returning();

        if (!deletedLevel) {
            return { success: false, error: "Power level not found" };
        }

        return { success: true, data: deletedLevel };
    } catch (error) {
        console.error("Error deleting power level:", error);
        return { success: false, error: "Failed to delete power level" };
    }
}

// ============================================
// POWER COMBINATIONS
// ============================================

export async function createPowerCombination(data: {
    novelId: string;
    sourcePowerIds: string[];
    resultPowerId: string;
    requiredLevels?: Record<string, number>;
    description?: string;
}) {
    try {
        const [combination] = await db
            .insert(powerCombinations)
            .values({
                novelId: data.novelId,
                sourcePowerIds: data.sourcePowerIds,
                resultPowerId: data.resultPowerId,
                requiredLevels: data.requiredLevels,
                description: data.description,
            })
            .returning();

        // dual-write: แต่ละพลังต้นทาง --combines_into--> พลังผลลัพธ์
        for (const sourceId of data.sourcePowerIds) {
            await addReference({
                novelId: data.novelId,
                from: { type: "power", id: sourceId },
                to: { type: "power", id: data.resultPowerId },
                relation: "combines_into",
                meta: { requiredLevels: data.requiredLevels },
            });
        }

        revalidatePath(`/dashboard/project/${data.novelId}/powers`);

        return { success: true, data: combination };
    } catch (error) {
        console.error("Error creating power combination:", error);
        return { success: false, error: "Failed to create power combination" };
    }
}

export async function getPowerCombinationsByNovelId(novelId: string) {
    try {
        const combinations = await db.query.powerCombinations.findMany({
            where: eq(powerCombinations.novelId, novelId),
            with: {
                resultPower: true,
            },
        });

        return { success: true, data: combinations };
    } catch (error) {
        console.error("Error fetching power combinations:", error);
        return { success: false, error: "Failed to fetch power combinations" };
    }
}

export async function deletePowerCombination(combinationId: string) {
    try {
        const [deleted] = await db
            .delete(powerCombinations)
            .where(eq(powerCombinations.id, combinationId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Power combination not found" };
        }

        for (const sourceId of (deleted.sourcePowerIds as string[] | null) ?? []) {
            await removeReferenceEdge({
                from: { type: "power", id: sourceId },
                to: { type: "power", id: deleted.resultPowerId },
                relation: "combines_into",
            });
        }

        revalidatePath(`/dashboard/project/${deleted.novelId}/powers`);

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting power combination:", error);
        return { success: false, error: "Failed to delete power combination" };
    }
}

'use server';

import { db } from "@/db/drizzle";
import { characterPowers, powers, powerLevels, characters, CharacterPower } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { addReference, removeReferenceEdge } from "./references"; // Context Fabric dual-write (P4)
import { requireNovelAccess } from "@/lib/authz";

// ============================================
// CHARACTER POWER CRUD
// ============================================

export async function assignPowerToCharacter(data: {
    characterId: string;
    powerId: string;
    currentLevel?: number;
    acquiredAt?: string;
    acquiredMethod?: string;
    notes?: string;
    startChapterId?: string;
    endChapterId?: string;
}) {
    try {
        // เช็คสิทธิ์ผ่าน novel เจ้าของของ power
        const [pwOwner] = await db.select({ novelId: powers.novelId }).from(powers).where(eq(powers.id, data.powerId)).limit(1);
        if (!pwOwner) return { success: false, error: "Power not found" };
        await requireNovelAccess(pwOwner.novelId);

        // Check if character already has this power
        const existing = await db
            .select()
            .from(characterPowers)
            .where(
                and(
                    eq(characterPowers.characterId, data.characterId),
                    eq(characterPowers.powerId, data.powerId)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return { success: false, error: "Character already has this power" };
        }

        const [newCharacterPower] = await db
            .insert(characterPowers)
            .values({
                characterId: data.characterId,
                powerId: data.powerId,
                currentLevel: data.currentLevel || 1,
                acquiredAt: data.acquiredAt,
                acquiredMethod: data.acquiredMethod,
                notes: data.notes,
                startChapterId: data.startChapterId,
                endChapterId: data.endChapterId,
            })
            .returning();

        // dual-write: character --wields--> power (novelId มาจากตาราง powers)
        const [pw] = await db.select({ novelId: powers.novelId }).from(powers).where(eq(powers.id, data.powerId)).limit(1);
        if (pw) {
            await addReference({
                novelId: pw.novelId,
                from: { type: "character", id: data.characterId },
                to: { type: "power", id: data.powerId },
                relation: "wields",
                meta: { currentLevel: data.currentLevel ?? 1, acquiredMethod: data.acquiredMethod },
            });
        }

        return { success: true, data: newCharacterPower };
    } catch (error) {
        console.error("Error assigning power to character:", error);
        return { success: false, error: "Failed to assign power" };
    }
}

export async function removePowerFromCharacter(characterPowerId: string) {
    try {
        const [owner] = await db
            .select({ novelId: powers.novelId })
            .from(characterPowers)
            .innerJoin(powers, eq(powers.id, characterPowers.powerId))
            .where(eq(characterPowers.id, characterPowerId))
            .limit(1);
        if (!owner) {
            return { success: false, error: "Character power not found" };
        }
        await requireNovelAccess(owner.novelId);

        const [deleted] = await db
            .delete(characterPowers)
            .where(eq(characterPowers.id, characterPowerId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Character power not found" };
        }

        await removeReferenceEdge({
            from: { type: "character", id: deleted.characterId },
            to: { type: "power", id: deleted.powerId },
            relation: "wields",
        });

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error removing power from character:", error);
        return { success: false, error: "Failed to remove power" };
    }
}

export async function updateCharacterPower(
    characterPowerId: string,
    data: Partial<{
        currentLevel: number;
        acquiredAt: string;
        acquiredMethod: string;
        notes: string;
        startChapterId: string | null;
        endChapterId: string | null;
    }>
) {
    try {
        const [owner] = await db
            .select({ novelId: powers.novelId })
            .from(characterPowers)
            .innerJoin(powers, eq(powers.id, characterPowers.powerId))
            .where(eq(characterPowers.id, characterPowerId))
            .limit(1);
        if (!owner) {
            return { success: false, error: "Character power not found" };
        }
        await requireNovelAccess(owner.novelId);

        const [updated] = await db
            .update(characterPowers)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(characterPowers.id, characterPowerId))
            .returning();

        if (!updated) {
            return { success: false, error: "Character power not found" };
        }

        return { success: true, data: updated };
    } catch (error) {
        console.error("Error updating character power:", error);
        return { success: false, error: "Failed to update character power" };
    }
}

export async function getCharacterPowers(characterId: string) {
    try {
        const [owner] = await db.select({ novelId: characters.novelId }).from(characters).where(eq(characters.id, characterId)).limit(1);
        if (!owner) return { success: false, error: "Character not found" };
        await requireNovelAccess(owner.novelId);

        const charPowers = await db.query.characterPowers.findMany({
            where: eq(characterPowers.characterId, characterId),
            with: {
                power: {
                    with: {
                        levels: {
                            orderBy: (levels, { asc }) => [asc(levels.level)],
                        },
                    },
                },
            },
        });

        return { success: true, data: charPowers };
    } catch (error) {
        console.error("Error fetching character powers:", error);
        return { success: false, error: "Failed to fetch character powers" };
    }
}

// ============================================
// POWER COMBINATION CHECK
// ============================================

export async function checkPossibleCombinations(characterId: string, novelId: string) {
    try {
        await requireNovelAccess(novelId);
        // Get character's current powers with levels
        const charPowers = await db.query.characterPowers.findMany({
            where: eq(characterPowers.characterId, characterId),
        });

        if (charPowers.length < 2) {
            return { success: true, data: [] };
        }

        // Get all combinations for this novel
        const { powerCombinations } = await import("@/db/schema");
        const combinations = await db.query.powerCombinations.findMany({
            where: eq(powerCombinations.novelId, novelId),
            with: {
                resultPower: true,
            },
        });

        // Check which combinations are possible
        const possibleCombinations = combinations.filter(combo => {
            const sourcePowerIds = combo.sourcePowerIds as string[];
            const requiredLevels = combo.requiredLevels as Record<string, number> | null;

            // Check if character has all source powers
            const hasAllPowers = sourcePowerIds.every(powerId =>
                charPowers.some(cp => cp.powerId === powerId)
            );

            if (!hasAllPowers) return false;

            // Check level requirements
            if (requiredLevels) {
                return Object.entries(requiredLevels).every(([powerId, requiredLevel]) => {
                    const charPower = charPowers.find(cp => cp.powerId === powerId);
                    return charPower && (charPower.currentLevel || 1) >= requiredLevel;
                });
            }

            return true;
        });

        return { success: true, data: possibleCombinations };
    } catch (error) {
        console.error("Error checking possible combinations:", error);
        return { success: false, error: "Failed to check combinations" };
    }
}

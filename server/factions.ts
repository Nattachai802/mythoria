'use server';

import { db } from "@/db/drizzle";
import { factions, characterFactions, Faction } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// --- Factions CRUD ---

export async function createFaction(data: {
    name: string;
    description?: string;
    type?: string;
    color?: string;
    novelId: string;
}) {
    try {
        const [newFaction] = await db
            .insert(factions)
            .values(data)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/relationships`);
        return { success: true, data: newFaction };
    } catch (error) {
        console.error("Error creating faction:", error);
        return { success: false, error: "Failed to create faction" };
    }
}

export async function getFactionsByNovelId(novelId: string) {
    try {
        const allFactions = await db
            .select()
            .from(factions)
            .where(eq(factions.novelId, novelId));
        return { success: true, data: allFactions };
    } catch (error) {
        console.error("Error fetching factions:", error);
        return { success: false, error: "Failed to fetch factions" };
    }
}

export async function updateFaction(factionId: string, data: Partial<Faction>) {
    try {
        const [updatedFaction] = await db
            .update(factions)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(factions.id, factionId))
            .returning();

        revalidatePath(`/dashboard/project/${updatedFaction.novelId}/relationships`);
        return { success: true, data: updatedFaction };
    } catch (error) {
        console.error("Error updating faction:", error);
        return { success: false, error: "Failed to update faction" };
    }
}

export async function deleteFaction(factionId: string) {
    try {
        const [deletedFaction] = await db
            .delete(factions)
            .where(eq(factions.id, factionId))
            .returning();

        if (deletedFaction) {
            revalidatePath(`/dashboard/project/${deletedFaction.novelId}/relationships`);
        }

        return { success: true, data: deletedFaction };
    } catch (error) {
        console.error("Error deleting faction:", error);
        return { success: false, error: "Failed to delete faction" };
    }
}

// --- Character Faction Membership ---

export async function addCharacterToFaction(data: {
    factionId: string;
    characterId: string;
    role?: string;
    startChapterId?: string;
    endChapterId?: string;
    novelId: string; // Needed for revalidation
    currentChapterId?: string; // Optional context
}) {
    try {
        const [membership] = await db
            .insert(characterFactions)
            .values({
                factionId: data.factionId,
                characterId: data.characterId,
                role: data.role,
                startChapterId: data.startChapterId,
                endChapterId: data.endChapterId,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/relationships`);
        return { success: true, data: membership };
    } catch (error) {
        console.error("Error adding character to faction:", error);
        return { success: false, error: "Failed to add character to faction" };
    }
}

export async function getCharacterFactions(characterId: string) {
    try {
        const memberships = await db.query.characterFactions.findMany({
            where: (cf, { eq }) => eq(cf.characterId, characterId),
            with: {
                faction: true,
            }
        });
        return { success: true, data: memberships };
    } catch (error) {
        console.error("Error fetching character factions:", error);
        return { success: false, error: "Failed to fetch character factions" };
    }
}

// Fetch all faction data for the relationship board (including members)
export async function getAllFactionsWithMembers(novelId: string) {
    try {
        const result = await db.query.factions.findMany({
            where: (f, { eq }) => eq(f.novelId, novelId),
            with: {
                members: {
                    with: {
                        character: true,
                    }
                }
            }
        });
        return { success: true, data: result };
    } catch (error) {
        console.error("Error fetching factions with members:", error);
        return { success: false, error: "Failed to fetch factions data" };
    }
}

export async function removeCharacterFromFaction(membershipId: string, novelId: string) {
    try {
        const [deleted] = await db
            .delete(characterFactions)
            .where(eq(characterFactions.id, membershipId))
            .returning();

        if (deleted) {
            revalidatePath(`/dashboard/project/${novelId}/relationships`);
        }

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error removing character from faction:", error);
        return { success: false, error: "Failed to remove character from faction" };
    }
}

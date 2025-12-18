'use server';

import { db } from "@/db/drizzle";
import { characterLifeEvents } from "@/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";


export async function createLifeEvent(data: {
    characterId: string;
    novelId: string;
    chapterId?: string;
    title: string;
    description?: string;
    eventType: string;
    impact?: string;
    importance?: number;
    changedTraits?: string[];
}) {
    try {
        const [event] = await db
            .insert(characterLifeEvents)
            .values({
                ...data,
                chapterId: data.chapterId || null,
                impact: data.impact || 'neutral',
                importance: data.importance || 5,
                changedTraits: data.changedTraits || null,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/characters/${data.characterId}`);

        return { success: true, data: event };
    } catch (error) {
        console.error("Error creating life event:", error);
        return { success: false, error: "Failed to create life event" };
    }
}

export async function getCharacterLifeEvents(characterId: string) {
    try {
        const events = await db.query.characterLifeEvents.findMany({
            where: eq(characterLifeEvents.characterId, characterId),
            with: {
                chapter: true,
            },
            orderBy: [desc(characterLifeEvents.importance), desc(characterLifeEvents.createdAt)],
        });

        return { success: true, data: events };
    } catch (error) {
        console.error("Error fetching life events:", error);
        return { success: false, error: "Failed to fetch life events" };
    }
}

export async function getLifeEventsForNovel(novelId: string, characterId?: string) {
    try {
        const events = await db.query.characterLifeEvents.findMany({
            where: characterId
                ? and(
                    eq(characterLifeEvents.novelId, novelId),
                    eq(characterLifeEvents.characterId, characterId)
                )
                : eq(characterLifeEvents.novelId, novelId),
            with: {
                chapter: true,
                character: true,
            },
            orderBy: [asc(characterLifeEvents.createdAt)],
        });

        return { success: true, data: events };
    } catch (error) {
        console.error("Error fetching life events for novel:", error);
        return { success: false, error: "Failed to fetch life events" };
    }
}

export async function updateLifeEvent(
    eventId: string,
    data: Partial<{
        title: string;
        description: string;
        eventType: string;
        impact: string;
        importance: number;
        chapterId: string | null;
        changedTraits: string[];
    }>
) {
    try {
        const [updated] = await db
            .update(characterLifeEvents)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(characterLifeEvents.id, eventId))
            .returning();

        if (!updated) {
            return { success: false, error: "Life event not found" };
        }

        revalidatePath(`/dashboard/project/${updated.novelId}/characters/${updated.characterId}`);

        return { success: true, data: updated };
    } catch (error) {
        console.error("Error updating life event:", error);
        return { success: false, error: "Failed to update life event" };
    }
}

export async function deleteLifeEvent(eventId: string) {
    try {
        const [deleted] = await db
            .delete(characterLifeEvents)
            .where(eq(characterLifeEvents.id, eventId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Life event not found" };
        }

        revalidatePath(`/dashboard/project/${deleted.novelId}/characters/${deleted.characterId}`);

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting life event:", error);
        return { success: false, error: "Failed to delete life event" };
    }
}

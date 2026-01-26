"use server"

import { db } from "@/db/drizzle";
import { sceneElementDetails, InsertSceneElementDetails, SceneElementDetails } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Get all element details for a scene
 */
export async function getSceneElementDetails(sceneId: string) {
    try {
        const details = await db.query.sceneElementDetails.findMany({
            where: eq(sceneElementDetails.sceneId, sceneId),
        });
        return { success: true, data: details };
    } catch (error) {
        console.error("Error fetching scene element details:", error);
        return { success: false, error: "Failed to fetch scene element details" };
    }
}

/**
 * Get element details by specific element (character/location) in a scene
 */
export async function getElementDetail(
    sceneId: string,
    elementType: "character" | "location",
    elementId: string,
    canvasItemId?: string
) {
    try {
        const conditions = [
            eq(sceneElementDetails.sceneId, sceneId),
            eq(sceneElementDetails.elementType, elementType),
            eq(sceneElementDetails.elementId, elementId),
        ];

        if (canvasItemId) {
            conditions.push(eq(sceneElementDetails.canvasItemId, canvasItemId));
        }

        const detail = await db.query.sceneElementDetails.findFirst({
            where: and(...conditions),
        });
        return { success: true, data: detail };
    } catch (error) {
        console.error("Error fetching element detail:", error);
        return { success: false, error: "Failed to fetch element detail" };
    }
}

/**
 * Create or update element detail (upsert)
 * Set forceCreate=true to always create new record (for one-to-many like idea_note)
 */
export async function upsertSceneElementDetail(data: {
    id?: string;
    sceneId: string;
    elementType: "character" | "location" | "idea_note";
    elementId: string;
    canvasItemId?: string;
    action?: string;
    how?: string;
    goal?: string;
    outcome?: string;
    notes?: string;
    novelId: string;
    forceCreate?: boolean;
}) {
    try {
        // If we have an id, update the existing record
        if (data.id) {
            const [updated] = await db
                .update(sceneElementDetails)
                .set({
                    action: data.action,
                    how: data.how,
                    goal: data.goal,
                    outcome: data.outcome,
                    notes: data.notes,
                    updatedAt: new Date(),
                })
                .where(eq(sceneElementDetails.id, data.id))
                .returning();

            revalidatePath(`/dashboard/project/${data.novelId}/plot/${data.sceneId}`);
            return { success: true, data: updated };
        }

        // If forceCreate is true (for idea_note), skip existing check and create new
        if (data.forceCreate) {
            const insertData: InsertSceneElementDetails = {
                sceneId: data.sceneId,
                elementType: data.elementType,
                elementId: data.elementId,
                canvasItemId: data.canvasItemId || null,
                action: data.action || null,
                how: data.how || null,
                goal: data.goal || null,
                outcome: data.outcome || null,
                notes: data.notes || null,
                novelId: data.novelId,
            };

            const [created] = await db
                .insert(sceneElementDetails)
                .values(insertData)
                .returning();

            revalidatePath(`/dashboard/project/${data.novelId}/plot/${data.sceneId}`);
            return { success: true, data: created };
        }

        // Otherwise, check if record exists by unique combination (for character/location)
        const existing = await db.query.sceneElementDetails.findFirst({
            where: and(
                eq(sceneElementDetails.sceneId, data.sceneId),
                eq(sceneElementDetails.elementType, data.elementType),
                eq(sceneElementDetails.elementId, data.elementId),
                data.canvasItemId
                    ? eq(sceneElementDetails.canvasItemId, data.canvasItemId)
                    : undefined
            ),
        });

        if (existing) {
            // Update existing
            const [updated] = await db
                .update(sceneElementDetails)
                .set({
                    action: data.action,
                    how: data.how,
                    goal: data.goal,
                    outcome: data.outcome,
                    notes: data.notes,
                    updatedAt: new Date(),
                })
                .where(eq(sceneElementDetails.id, existing.id))
                .returning();

            revalidatePath(`/dashboard/project/${data.novelId}/plot/${data.sceneId}`);
            return { success: true, data: updated };
        }

        // Create new
        const insertData: InsertSceneElementDetails = {
            sceneId: data.sceneId,
            elementType: data.elementType,
            elementId: data.elementId,
            canvasItemId: data.canvasItemId || null,
            action: data.action || null,
            how: data.how || null,
            goal: data.goal || null,
            outcome: data.outcome || null,
            notes: data.notes || null,
            novelId: data.novelId,
        };

        const [created] = await db
            .insert(sceneElementDetails)
            .values(insertData)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/plot/${data.sceneId}`);
        return { success: true, data: created };
    } catch (error) {
        console.error("Error upserting scene element detail:", error);
        return { success: false, error: "Failed to save element detail" };
    }
}

/**
 * Delete element detail
 */
export async function deleteSceneElementDetail(id: string, novelId: string, sceneId: string) {
    try {
        await db.delete(sceneElementDetails).where(eq(sceneElementDetails.id, id));
        revalidatePath(`/dashboard/project/${novelId}/plot/${sceneId}`);
        return { success: true };
    } catch (error) {
        console.error("Error deleting scene element detail:", error);
        return { success: false, error: "Failed to delete element detail" };
    }
}

/**
 * Get all scene appearances for a character/location across a novel
 * Useful for showing "what did this character do in all scenes?"
 */
export async function getElementSceneHistory(
    novelId: string,
    elementType: "character" | "location",
    elementId: string
) {
    try {
        const history = await db.query.sceneElementDetails.findMany({
            where: and(
                eq(sceneElementDetails.novelId, novelId),
                eq(sceneElementDetails.elementType, elementType),
                eq(sceneElementDetails.elementId, elementId)
            ),
            with: {
                scene: true,
            },
        });
        return { success: true, data: history };
    } catch (error) {
        console.error("Error fetching element scene history:", error);
        return { success: false, error: "Failed to fetch element scene history" };
    }
}

/**
 * Batch upsert multiple element details (for saving canvas state)
 */
export async function batchUpsertSceneElementDetails(
    sceneId: string,
    novelId: string,
    details: Array<{
        id?: string;
        elementType: "character" | "location";
        elementId: string;
        canvasItemId?: string;
        action?: string;
        how?: string;
        goal?: string;
        outcome?: string;
        notes?: string;
    }>
) {
    try {
        const results = await Promise.all(
            details.map(detail =>
                upsertSceneElementDetail({
                    ...detail,
                    sceneId,
                    novelId,
                })
            )
        );

        const failed = results.filter(r => !r.success);
        if (failed.length > 0) {
            console.warn(`${failed.length} element details failed to save`);
        }

        return {
            success: true,
            savedCount: results.filter(r => r.success).length,
            failedCount: failed.length
        };
    } catch (error) {
        console.error("Error batch upserting scene element details:", error);
        return { success: false, error: "Failed to batch save element details" };
    }
}

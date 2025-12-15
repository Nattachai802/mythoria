'use server';

import { db } from "@/db/drizzle";
import { locationConnections, locations } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createLocationConnection(data: {
    sourceLocationId: string;
    targetLocationId: string;
    connectionType: string;
    customLabel?: string;
    isBidirectional: boolean;
    novelId: string;
}) {
    try {
        // Check if connection already exists
        const existing = await db.query.locationConnections.findFirst({
            where: or(
                and(
                    eq(locationConnections.sourceLocationId, data.sourceLocationId),
                    eq(locationConnections.targetLocationId, data.targetLocationId)
                ),
                and(
                    eq(locationConnections.sourceLocationId, data.targetLocationId),
                    eq(locationConnections.targetLocationId, data.sourceLocationId)
                )
            )
        });

        if (existing) {
            return { success: false, error: "Connection already exists" };
        }

        const [newConnection] = await db
            .insert(locationConnections)
            .values({
                ...data,
                customLabel: data.connectionType === 'custom' ? data.customLabel : null,
            })
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/locations`);

        return { success: true, data: newConnection };
    } catch (error) {
        console.error("Error creating location connection:", error);
        return { success: false, error: "Failed to create connection" };
    }
}

export async function getLocationConnections(novelId: string) {
    try {
        const connections = await db.query.locationConnections.findMany({
            where: eq(locationConnections.novelId, novelId),
            with: {
                sourceLocation: true,
                targetLocation: true,
            },
        });

        return { success: true, data: connections };
    } catch (error) {
        console.error("Error fetching location connections:", error);
        return { success: false, error: "Failed to fetch connections" };
    }
}

export async function deleteLocationConnection(connectionId: string, novelId: string) {
    try {
        const [deleted] = await db
            .delete(locationConnections)
            .where(eq(locationConnections.id, connectionId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Connection not found" };
        }

        revalidatePath(`/dashboard/project/${novelId}/locations`);

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting location connection:", error);
        return { success: false, error: "Failed to delete connection" };
    }
}

export async function updateLocationConnection(
    connectionId: string,
    data: Partial<{
        connectionType: string;
        customLabel: string;
        isBidirectional: boolean;
        travelTime: number | null;
        travelTimeUnit: string;
        travelMethod: string;
        travelNotes: string | null;
    }>,
    novelId: string
) {
    try {
        const [updated] = await db
            .update(locationConnections)
            .set(data)
            .where(eq(locationConnections.id, connectionId))
            .returning();

        if (!updated) {
            return { success: false, error: "Connection not found" };
        }

        revalidatePath(`/dashboard/project/${novelId}/locations`);

        return { success: true, data: updated };
    } catch (error) {
        console.error("Error updating location connection:", error);
        return { success: false, error: "Failed to update connection" };
    }
}

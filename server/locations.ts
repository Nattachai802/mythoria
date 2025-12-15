'use server';

import { db } from "@/db/drizzle";
import { locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createLocation(data: {
    name: string;
    type?: string;
    novelId: string;
    description?: string;
    image?: string;
    parentLocationId?: string;
}) {
    try {
        // Convert empty string to null for parentLocationId
        const locationData = {
            ...data,
            parentLocationId: data.parentLocationId && data.parentLocationId.trim() !== ''
                ? data.parentLocationId
                : null,
        };

        const [newLocation] = await db
            .insert(locations)
            .values(locationData)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/locations`);

        return { success: true, data: newLocation };
    } catch (error) {
        console.error("Error creating location:", error);
        return { success: false, error: "Failed to create location" };
    }
}

export async function getLocationsByNovelId(novelId: string) {
    try {
        const allLocations = await db.query.locations.findMany({
            where: eq(locations.novelId, novelId),
            with: {
                parentLocation: true,
                childLocations: true,
            },
        });

        return { success: true, data: allLocations };
    } catch (error) {
        console.error("Error fetching locations:", error);
        return { success: false, error: "Failed to fetch locations" };
    }
}

export async function getLocationById(locationId: string) {
    try {
        const location = await db.query.locations.findFirst({
            where: eq(locations.id, locationId),
            with: {
                parentLocation: true,
                childLocations: true,
            }
        });

        if (!location) {
            return { success: false, error: "Location not found" };
        }

        return { success: true, data: location };
    } catch (error) {
        console.error("Error fetching location:", error);
        return { success: false, error: "Failed to fetch location" };
    }
}

export async function updateLocation(
    locationId: string,
    data: Partial<{
        name: string;
        type: string;
        description: string;
        image: string;
        parentLocationId: string;
    }>
) {
    try {
        const [updatedLocation] = await db
            .update(locations)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(locations.id, locationId))
            .returning();

        if (!updatedLocation) {
            return { success: false, error: "Location not found" };
        }

        revalidatePath(`/dashboard/project/${updatedLocation.novelId}/locations`);

        return { success: true, data: updatedLocation };
    } catch (error) {
        console.error("Error updating location:", error);
        return { success: false, error: "Failed to update location" };
    }
}

export async function deleteLocation(locationId: string) {
    try {
        const [deletedLocation] = await db
            .delete(locations)
            .where(eq(locations.id, locationId))
            .returning();

        if (!deletedLocation) {
            return { success: false, error: "Location not found" };
        }

        revalidatePath(`/dashboard/project/${deletedLocation.novelId}/locations`);

        return { success: true, data: deletedLocation };
    } catch (error) {
        console.error("Error deleting location:", error);
        return { success: false, error: "Failed to delete location" };
    }
}

// Get breadcrumb path for a location
export async function getLocationPath(locationId: string) {
    try {
        const path: any[] = [];
        let currentId: string | null = locationId;

        while (currentId && path.length < 4) { // Max 3 levels + current
            const location: any = await db.query.locations.findFirst({
                where: eq(locations.id, currentId),
            });

            if (!location) break;

            path.unshift(location);
            currentId = location.parentLocationId;
        }

        return { success: true, data: path };
    } catch (error) {
        console.error("Error fetching location path:", error);
        return { success: false, error: "Failed to fetch location path" };
    }
}

// Validate location depth (max 3 levels: 0, 1, 2)
export async function validateLocationDepth(parentLocationId: string | null): Promise<{ valid: boolean; depth: number; error?: string }> {
    if (!parentLocationId) {
        return { valid: true, depth: 0 }; // Root level
    }

    try {
        let depth = 1;
        let currentId: string | null = parentLocationId;

        while (currentId && depth < 4) {
            const location: any = await db.query.locations.findFirst({
                where: eq(locations.id, currentId),
            });

            if (!location) break;

            currentId = location.parentLocationId;
            if (currentId) depth++;
        }

        if (depth >= 3) {
            return {
                valid: false,
                depth,
                error: "Maximum nesting depth (3 levels) reached. Cannot add sub-location here."
            };
        }

        return { valid: true, depth };
    } catch (error) {
        console.error("Error validating location depth:", error);
        return { valid: false, depth: -1, error: "Failed to validate depth" };
    }
}
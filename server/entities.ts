'use server';

import { db } from "@/db/drizzle";
import { entities, locationEntities, locations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createEntity(data: {
    name: string;
    description?: string;
    type?: string;
    threatLevel?: string;
    novelId: string;
    appearance?: string;
    abilities?: string[];
    weaknesses?: string[];
    habitat?: string;
    image?: string;
    icon?: string;
    color?: string;
}) {
    try {
        const [newEntity] = await db
            .insert(entities)
            .values(data)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/worldbuilding`);

        return { success: true, data: newEntity };
    } catch (error) {
        console.error("Error creating entity:", error);
        return { success: false, error: "Failed to create entity" };
    }
}

export async function getEntitiesByNovelId(novelId: string) {
    try {
        const allEntities = await db.query.entities.findMany({
            where: eq(entities.novelId, novelId),
            with: {
                locations: {
                    with: {
                        location: true,
                    },
                },
            },
            orderBy: (entities, { asc }) => [asc(entities.name)],
        });

        return { success: true, data: allEntities };
    } catch (error) {
        console.error("Error fetching entities:", error);
        return { success: false, error: "Failed to fetch entities" };
    }
}

export async function getEntityById(entityId: string) {
    try {
        const entity = await db.query.entities.findFirst({
            where: eq(entities.id, entityId),
            with: {
                locations: {
                    with: {
                        location: true,
                    },
                },
            },
        });

        if (!entity) {
            return { success: false, error: "Entity not found" };
        }

        return { success: true, data: entity };
    } catch (error) {
        console.error("Error fetching entity:", error);
        return { success: false, error: "Failed to fetch entity" };
    }
}

export async function updateEntity(
    entityId: string,
    data: Partial<{
        name: string;
        description: string;
        type: string;
        threatLevel: string;
        appearance: string;
        abilities: string[];
        weaknesses: string[];
        habitat: string;
        image: string;
        icon: string;
        color: string;
    }>
) {
    try {
        const [updatedEntity] = await db
            .update(entities)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(entities.id, entityId))
            .returning();

        if (!updatedEntity) {
            return { success: false, error: "Entity not found" };
        }

        revalidatePath(`/dashboard/project/${updatedEntity.novelId}/worldbuilding`);

        return { success: true, data: updatedEntity };
    } catch (error) {
        console.error("Error updating entity:", error);
        return { success: false, error: "Failed to update entity" };
    }
}

export async function deleteEntity(entityId: string) {
    try {
        const [deletedEntity] = await db
            .delete(entities)
            .where(eq(entities.id, entityId))
            .returning();

        if (!deletedEntity) {
            return { success: false, error: "Entity not found" };
        }

        revalidatePath(`/dashboard/project/${deletedEntity.novelId}/worldbuilding`);

        return { success: true, data: deletedEntity };
    } catch (error) {
        console.error("Error deleting entity:", error);
        return { success: false, error: "Failed to delete entity" };
    }
}

// Assign entity to location
export async function assignEntityToLocation(data: {
    entityId: string;
    locationId: string;
    population?: string;
    notes?: string;
}) {
    try {
        // Check if already assigned
        const existing = await db.query.locationEntities.findFirst({
            where: and(
                eq(locationEntities.entityId, data.entityId),
                eq(locationEntities.locationId, data.locationId)
            ),
        });

        if (existing) {
            // Update existing
            const [updated] = await db
                .update(locationEntities)
                .set({
                    population: data.population || existing.population,
                    notes: data.notes || existing.notes,
                })
                .where(eq(locationEntities.id, existing.id))
                .returning();

            return { success: true, data: updated };
        }

        // Create new assignment
        const [newAssignment] = await db
            .insert(locationEntities)
            .values(data)
            .returning();

        return { success: true, data: newAssignment };
    } catch (error) {
        console.error("Error assigning entity to location:", error);
        return { success: false, error: "Failed to assign entity to location" };
    }
}

// Remove entity from location
export async function removeEntityFromLocation(locationEntityId: string) {
    try {
        const [deleted] = await db
            .delete(locationEntities)
            .where(eq(locationEntities.id, locationEntityId))
            .returning();

        if (!deleted) {
            return { success: false, error: "Assignment not found" };
        }

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error removing entity from location:", error);
        return { success: false, error: "Failed to remove entity from location" };
    }
}

// Get entities at a specific location
export async function getEntitiesByLocation(locationId: string) {
    try {
        const assignments = await db.query.locationEntities.findMany({
            where: eq(locationEntities.locationId, locationId),
            with: {
                entity: true,
            },
        });

        return { success: true, data: assignments };
    } catch (error) {
        console.error("Error fetching entities at location:", error);
        return { success: false, error: "Failed to fetch entities" };
    }
}

// Get locations where entity lives
export async function getLocationsByEntity(entityId: string) {
    try {
        const assignments = await db.query.locationEntities.findMany({
            where: eq(locationEntities.entityId, entityId),
            with: {
                location: true,
            },
        });

        return { success: true, data: assignments };
    } catch (error) {
        console.error("Error fetching entity locations:", error);
        return { success: false, error: "Failed to fetch locations" };
    }
}

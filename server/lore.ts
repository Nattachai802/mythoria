'use server';

import { db } from "@/db/drizzle";
import { loreEntries, eras } from "@/db/schema";
import { eq, asc, lt, gt, and, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ============================================
// HELPER FUNCTIONS FOR ERA AUTO-DETECTION
// ============================================

/**
 * Detect era from previous entry (inherit from neighbor)
 * ถ้า lore ใหม่ไม่ได้กำหนด era → ดู lore ก่อนหน้ามี era อะไร → ใช้ era นั้น
 */
async function detectEraFromPreviousEntry(novelId: string, orderIndex: number): Promise<string | null> {
    if (orderIndex === 0) {
        // First entry - get first era if exists
        const firstEra = await db.query.eras.findFirst({
            where: eq(eras.novelId, novelId),
            orderBy: [asc(eras.orderIndex)],
        });
        return firstEra?.id || null;
    }

    // Find the previous entry that has an era
    const allEntries = await db.query.loreEntries.findMany({
        where: eq(loreEntries.novelId, novelId),
        orderBy: [asc(loreEntries.orderIndex)],
    });

    // Look backwards from current position
    for (let i = orderIndex - 1; i >= 0; i--) {
        const entry = allEntries.find(e => (e.orderIndex ?? 0) === i);
        if (entry?.eraId) {
            return entry.eraId;
        }
    }

    // No previous entry with era found - get first era
    const firstEra = await db.query.eras.findFirst({
        where: eq(eras.novelId, novelId),
        orderBy: [asc(eras.orderIndex)],
    });
    return firstEra?.id || null;
}

/**
 * Apply era auto-fill logic
 * เมื่อ user กำหนด era ให้ entry → fill backward และ forward
 */
async function applyEraAutoFill(loreId: string, eraId: string, novelId: string): Promise<void> {
    console.log(`[ERA AUTO-FILL] Starting for loreId: ${loreId}, eraId: ${eraId}`);

    // Get all eras ordered by orderIndex
    const allEras = await db.query.eras.findMany({
        where: eq(eras.novelId, novelId),
        orderBy: [asc(eras.orderIndex)],
    });

    console.log(`[ERA AUTO-FILL] Found ${allEras.length} eras`);

    if (allEras.length === 0) return;

    // Find the selected era and next era
    const selectedEraIndex = allEras.findIndex(e => e.id === eraId);
    if (selectedEraIndex === -1) return;

    const selectedEra = allEras[selectedEraIndex];
    const nextEra = allEras[selectedEraIndex + 1] || null;

    // Get all lore entries ordered by orderIndex
    const allEntries = await db.query.loreEntries.findMany({
        where: eq(loreEntries.novelId, novelId),
        orderBy: [asc(loreEntries.orderIndex)],
    });

    // Find the target entry
    const targetEntry = allEntries.find(e => e.id === loreId);
    if (!targetEntry) return;

    const targetOrderIndex = targetEntry.orderIndex ?? 0;

    // Collect entries to update
    const updates: { id: string; eraId: string }[] = [];

    // BACKWARD FILL: entries at or before target → get selected era
    for (const entry of allEntries) {
        const entryOrder = entry.orderIndex ?? 0;

        if (entryOrder <= targetOrderIndex) {
            if (entry.eraId) {
                const entryEraIndex = allEras.findIndex(e => e.id === entry.eraId);
                if (entryEraIndex < selectedEraIndex && entryEraIndex !== -1) {
                    continue; // Don't change entries with earlier eras
                }
            }

            if (entry.eraId !== selectedEra.id) {
                updates.push({ id: entry.id, eraId: selectedEra.id });
            }
        }
    }

    // FORWARD FILL: entries after target → get next era
    if (nextEra) {
        for (const entry of allEntries) {
            const entryOrder = entry.orderIndex ?? 0;

            if (entryOrder > targetOrderIndex) {
                if (entry.eraId) {
                    const entryEraIndex = allEras.findIndex(e => e.id === entry.eraId);
                    if (entryEraIndex >= selectedEraIndex + 1 && entryEraIndex !== -1) {
                        break; // Stop at boundary of later era
                    }
                }

                if (entry.eraId !== nextEra.id) {
                    updates.push({ id: entry.id, eraId: nextEra.id });
                }
            }
        }
    }

    // Execute updates
    console.log(`[ERA AUTO-FILL] Will update ${updates.length} entries`);

    if (updates.length > 0) {
        await Promise.all(
            updates.map(update =>
                db.update(loreEntries)
                    .set({ eraId: update.eraId, updatedAt: new Date() })
                    .where(eq(loreEntries.id, update.id))
            )
        );
        console.log(`[ERA AUTO-FILL] Successfully updated ${updates.length} entries`);
    }
}

// ============================================
// MAIN LORE FUNCTIONS
// ============================================


export async function createLoreEntry(data: {
    title: string;
    content?: string;
    type?: string;
    eraId?: string | null; // Era-based timeline
    orderInEra?: number; // Order within era
    novelId: string;
    scope?: string; // "world" | "location"
    locationId?: string | null;
    parentLoreId?: string | null; // for sub-lore
    groupId?: string | null; // for lore grouping
    orderIndex?: number;
    relatedCharacterIds?: string[];
    relatedLocationIds?: string[];
    relatedItemIds?: string[];
    icon?: string;
    color?: string;
    importance?: number;
}) {
    try {
        // Get max orderIndex if not provided
        let orderIndex = data.orderIndex;
        if (orderIndex === undefined) {
            const existingEntries = await db.query.loreEntries.findMany({
                where: eq(loreEntries.novelId, data.novelId),
            });
            orderIndex = existingEntries.length;
        }

        // AUTO-DETECT ERA: ถ้าไม่ได้กำหนด eraId → inherit จาก lore ก่อนหน้า
        let finalEraId = data.eraId;
        if (!finalEraId) {
            finalEraId = await detectEraFromPreviousEntry(data.novelId, orderIndex);
        }

        const [newEntry] = await db
            .insert(loreEntries)
            .values({
                ...data,
                eraId: finalEraId,
                orderIndex,
            })
            .returning();

        // AUTO-FILL: ถ้ากำหนด era มา → apply auto-fill logic
        console.log(`[CREATE LORE] data.eraId = ${data.eraId}, finalEraId = ${finalEraId}`);
        if (data.eraId) {
            console.log(`[CREATE LORE] Calling applyEraAutoFill...`);
            await applyEraAutoFill(newEntry.id, data.eraId, data.novelId);
        }

        revalidatePath(`/dashboard/project/${data.novelId}/worldbuilding`);

        return { success: true, data: newEntry };
    } catch (error) {
        console.error("Error creating lore entry:", error);
        return { success: false, error: "Failed to create lore entry" };
    }
}

export async function getLoreEntriesByNovelId(novelId: string) {
    try {
        const allEntries = await db.query.loreEntries.findMany({
            where: eq(loreEntries.novelId, novelId),
            orderBy: [asc(loreEntries.orderIndex)],
            with: {
                location: true,
                era: true,
                parentLore: true,
                childLores: true,
                group: true,
            },
        });

        return { success: true, data: allEntries };
    } catch (error) {
        console.error("Error fetching lore entries:", error);
        return { success: false, error: "Failed to fetch lore entries" };
    }
}

export async function getLoreEntryById(loreId: string) {
    try {
        const entry = await db.query.loreEntries.findFirst({
            where: eq(loreEntries.id, loreId),
        });

        if (!entry) {
            return { success: false, error: "Lore entry not found" };
        }

        return { success: true, data: entry };
    } catch (error) {
        console.error("Error fetching lore entry:", error);
        return { success: false, error: "Failed to fetch lore entry" };
    }
}

export async function updateLoreEntry(
    loreId: string,
    data: Partial<{
        title: string;
        content: string;
        type: string;
        eraId: string | null;
        orderInEra: number;
        scope: string;
        locationId: string | null;
        parentLoreId: string | null;
        groupId: string | null;
        orderIndex: number;
        relatedCharacterIds: string[];
        relatedLocationIds: string[];
        relatedItemIds: string[];
        icon: string;
        color: string;
        importance: number;
    }>
) {
    try {
        // Get old entry to check if eraId changed
        const oldEntry = await db.query.loreEntries.findFirst({
            where: eq(loreEntries.id, loreId),
        });

        const [updatedEntry] = await db
            .update(loreEntries)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(loreEntries.id, loreId))
            .returning();

        if (!updatedEntry) {
            return { success: false, error: "Lore entry not found" };
        }

        // AUTO-FILL: ถ้า eraId เปลี่ยน → apply auto-fill logic
        if (data.eraId !== undefined && data.eraId !== oldEntry?.eraId && data.eraId) {
            await applyEraAutoFill(loreId, data.eraId, updatedEntry.novelId);
        }

        revalidatePath(`/dashboard/project/${updatedEntry.novelId}/worldbuilding`);

        return { success: true, data: updatedEntry };
    } catch (error) {
        console.error("Error updating lore entry:", error);
        return { success: false, error: "Failed to update lore entry" };
    }
}

export async function deleteLoreEntry(loreId: string) {
    try {
        const [deletedEntry] = await db
            .delete(loreEntries)
            .where(eq(loreEntries.id, loreId))
            .returning();

        if (!deletedEntry) {
            return { success: false, error: "Lore entry not found" };
        }

        revalidatePath(`/dashboard/project/${deletedEntry.novelId}/worldbuilding`);

        return { success: true, data: deletedEntry };
    } catch (error) {
        console.error("Error deleting lore entry:", error);
        return { success: false, error: "Failed to delete lore entry" };
    }
}

// Reorder lore entries (for horizontal timeline drag-drop)
export async function reorderLoreEntries(novelId: string, orderedIds: string[]) {
    try {
        // Update each entry with new orderIndex
        const updates = orderedIds.map((id, index) =>
            db
                .update(loreEntries)
                .set({ orderIndex: index, updatedAt: new Date() })
                .where(eq(loreEntries.id, id))
        );

        await Promise.all(updates);

        revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);

        return { success: true };
    } catch (error) {
        console.error("Error reordering lore entries:", error);
        return { success: false, error: "Failed to reorder lore entries" };
    }
}

// Get lore by type
export async function getLoreByType(novelId: string, type: string) {
    try {
        const entries = await db.query.loreEntries.findMany({
            where: eq(loreEntries.novelId, novelId),
            orderBy: [asc(loreEntries.orderIndex)],
        });

        const filtered = entries.filter((e) => e.type === type);

        return { success: true, data: filtered };
    } catch (error) {
        console.error("Error fetching lore by type:", error);
        return { success: false, error: "Failed to fetch lore entries" };
    }
}

/**
 * Set Era for a Lore Entry with Auto-Fill
 * 
 * Logic:
 * 1. เมื่อ user กำหนด Era ให้ entry ที่ orderIndex = X
 * 2. Backward: entries ที่ orderIndex < X และยังไม่มี era (หรือมี era เดียวกันหรือก่อนหน้า) → รับ era นี้
 * 3. Forward: entries ที่ orderIndex > X → รับ era ถัดไป (จนกว่าจะเจอ entry ที่มี era กำหนดไว้แล้ว)
 * 
 * ตัวอย่าง:
 * Eras: [A, B, C] (orderIndex: 0, 1, 2)
 * Entries: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
 * 
 * User sets entry[3] = Era A
 * → entries [1, 2, 3] = Era A (backward fill)
 * → entries [4-10] = Era B (forward fill to next era)
 * 
 * User then sets entry[7] = Era C
 * → entries [7-10] = Era C (forward fill)
 * → entries [4, 5, 6] stay at Era B
 */
export async function setLoreEraWithAutoFill(
    loreId: string,
    eraId: string,
    novelId: string
) {
    try {
        // 1. Get all eras ordered by orderIndex
        const allEras = await db.query.eras.findMany({
            where: eq(eras.novelId, novelId),
            orderBy: [asc(eras.orderIndex)],
        });

        if (allEras.length === 0) {
            return { success: false, error: "No eras found" };
        }

        // Find the selected era and next era
        const selectedEraIndex = allEras.findIndex(e => e.id === eraId);
        if (selectedEraIndex === -1) {
            return { success: false, error: "Era not found" };
        }

        const selectedEra = allEras[selectedEraIndex];
        const nextEra = allEras[selectedEraIndex + 1] || null;

        // 2. Get all lore entries ordered by orderIndex
        const allEntries = await db.query.loreEntries.findMany({
            where: eq(loreEntries.novelId, novelId),
            orderBy: [asc(loreEntries.orderIndex)],
        });

        // Find the target entry
        const targetEntry = allEntries.find(e => e.id === loreId);
        if (!targetEntry) {
            return { success: false, error: "Lore entry not found" };
        }

        const targetOrderIndex = targetEntry.orderIndex ?? 0;

        // 3. Collect entries to update
        const updates: { id: string; eraId: string }[] = [];

        // 3a. BACKWARD FILL: entries at or before target → get selected era
        // Only fill entries that don't have an era, or have an era that's >= selected era
        for (const entry of allEntries) {
            const entryOrder = entry.orderIndex ?? 0;

            if (entryOrder <= targetOrderIndex) {
                // Check if this entry has a manually set era that's BEFORE the selected era
                if (entry.eraId) {
                    const entryEraIndex = allEras.findIndex(e => e.id === entry.eraId);
                    // If entry's era is before selected era, don't change it
                    if (entryEraIndex < selectedEraIndex && entryEraIndex !== -1) {
                        continue;
                    }
                }

                // Fill with selected era
                if (entry.eraId !== selectedEra.id) {
                    updates.push({ id: entry.id, eraId: selectedEra.id });
                }
            }
        }

        // 3b. FORWARD FILL: entries after target → get next era (unless they have a later era set)
        if (nextEra) {
            for (const entry of allEntries) {
                const entryOrder = entry.orderIndex ?? 0;

                if (entryOrder > targetOrderIndex) {
                    // Check if this entry has a manually set era that's AFTER the next era
                    if (entry.eraId) {
                        const entryEraIndex = allEras.findIndex(e => e.id === entry.eraId);
                        // If entry's era is at or after next era, don't change it (respect manual setting)
                        if (entryEraIndex >= selectedEraIndex + 1 && entryEraIndex !== -1) {
                            // This entry marks the boundary of a later era, stop forward fill here
                            break;
                        }
                    }

                    // Fill with next era
                    if (entry.eraId !== nextEra.id) {
                        updates.push({ id: entry.id, eraId: nextEra.id });
                    }
                }
            }
        }

        // 4. Execute updates
        if (updates.length > 0) {
            await Promise.all(
                updates.map(update =>
                    db.update(loreEntries)
                        .set({ eraId: update.eraId, updatedAt: new Date() })
                        .where(eq(loreEntries.id, update.id))
                )
            );
        }

        revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);

        return {
            success: true,
            updatedCount: updates.length,
            message: `Updated ${updates.length} lore entries`
        };
    } catch (error) {
        console.error("Error setting lore era with auto-fill:", error);
        return { success: false, error: "Failed to set era" };
    }
}

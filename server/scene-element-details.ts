"use server"

import { db } from "@/db/drizzle";
import { sceneElementDetails, timelineEvents, InsertSceneElementDetails, SceneElementDetails } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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
    elementType: "character" | "location" | "faction" | "dummy_character" | "dummy_faction" | "idea_note",
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
    elementType: "character" | "location" | "faction" | "dummy_character" | "dummy_faction" | "idea_note";
    elementId: string;
    canvasItemId?: string;
    action?: string;
    how?: string;
    goal?: string;
    outcome?: string;
    role?: string;
    notes?: string;
    noteKind?: string;
    noteOrder?: number;
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
                    role: data.role,
                    notes: data.notes,
                    noteKind: data.noteKind,
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
                role: data.role || null,
                notes: data.notes || null,
                noteKind: data.noteKind || null,
                noteOrder: data.noteOrder ?? 0,
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
                    role: data.role,
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
            role: data.role || null,
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
 * Promote dummy → ตัวจริง: ย้าย detail rows ของ dummy (elementId = child.id) ไปเป็นตัวละคร/ฝ่ายจริง
 * dummyElementIds = child.id ของทุก instance ในฉาก (client รวบรวมจาก canvasData)
 * ponytail: ไม่ merge กับ detail ของตัวจริงที่อาจมีอยู่แล้วในการ์ดเดียวกัน — เคสหายาก, เว้นไว้
 */
export async function promoteDummy(data: {
    sceneId: string;
    novelId: string;
    fromType: "dummy_character" | "dummy_faction";
    toType: "character" | "faction";
    dummyElementIds: string[];
    realId: string;
}) {
    try {
        if (data.dummyElementIds.length > 0) {
            await db
                .update(sceneElementDetails)
                .set({ elementType: data.toType, elementId: data.realId, updatedAt: new Date() })
                .where(and(
                    eq(sceneElementDetails.sceneId, data.sceneId),
                    eq(sceneElementDetails.elementType, data.fromType),
                    inArray(sceneElementDetails.elementId, data.dummyElementIds),
                ));
        }
        revalidatePath(`/dashboard/project/${data.novelId}/plot/${data.sceneId}`);
        return { success: true };
    } catch (error) {
        console.error("promoteDummy error:", error);
        return { success: false, error: "แปลง dummy เป็นตัวจริงไม่สำเร็จ" };
    }
}

/**
 * Promote dummy → ตัวจริง "ทุกฉาก" ของนิยาย: แก้ canvasData + migrate detail ทุกฉากที่มี dummy ชื่อ+ชนิดเดียวกัน
 * excludeSceneId = ฉากที่ client จัดการเอง (กันเขียนทับฉากที่กำลังแก้อยู่)
 */
export async function promoteDummyAllScenes(data: {
    novelId: string;
    excludeSceneId?: string;
    dummyTitle: string;
    fromType: "dummy_character" | "dummy_faction";
    toType: "character" | "faction";
    realId: string;
    realName: string;
}) {
    try {
        const events = await db.query.timelineEvents.findMany({
            where: eq(timelineEvents.novelId, data.novelId),
            columns: { id: true, canvasData: true },
        });
        let scenesAffected = 0;
        for (const ev of events) {
            if (data.excludeSceneId && ev.id === data.excludeSceneId) continue;
            const canvas = (ev.canvasData as any[]) || [];
            const dummyIds: string[] = [];
            let changed = false;
            const newCanvas = canvas.map((node: any) => {
                if (!node?.children || !Array.isArray(node.children)) return node;
                let nodeChanged = false;
                const children = node.children.map((ch: any) => {
                    if (ch?.type === data.fromType && ch?.title === data.dummyTitle) {
                        dummyIds.push(ch.id);
                        nodeChanged = true;
                        return { ...ch, type: data.toType, referenceId: data.realId, title: data.realName };
                    }
                    return ch;
                });
                if (nodeChanged) { changed = true; return { ...node, children }; }
                return node;
            });
            if (!changed) continue;
            await db.update(timelineEvents)
                .set({ canvasData: newCanvas, updatedAt: new Date() })
                .where(eq(timelineEvents.id, ev.id));
            if (dummyIds.length > 0) {
                await db.update(sceneElementDetails)
                    .set({ elementType: data.toType, elementId: data.realId, updatedAt: new Date() })
                    .where(and(
                        eq(sceneElementDetails.sceneId, ev.id),
                        eq(sceneElementDetails.elementType, data.fromType),
                        inArray(sceneElementDetails.elementId, dummyIds),
                    ));
            }
            scenesAffected++;
            revalidatePath(`/dashboard/project/${data.novelId}/plot/${ev.id}`);
        }
        return { success: true, scenesAffected };
    } catch (error) {
        console.error("promoteDummyAllScenes error:", error);
        return { success: false, error: "แปลง dummy ข้ามฉากไม่สำเร็จ", scenesAffected: 0 };
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
    elementType: "character" | "location" | "faction",
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

/**
 * Get all idea_notes for a list of idea IDs across ALL scenes in a novel.
 * Returns a Map<ideaId, string[]> of notes text.
 */
export async function getIdeaNotesForIdeas(novelId: string, ideaIds: string[]) {
    try {
        if (ideaIds.length === 0) return { success: true, data: new Map<string, string[]>() };

        const notes = await db.query.sceneElementDetails.findMany({
            where: and(
                eq(sceneElementDetails.novelId, novelId),
                eq(sceneElementDetails.elementType, "idea_note"),
                inArray(sceneElementDetails.elementId, ideaIds),
            ),
        });

        const noteMap = new Map<string, string[]>();
        for (const note of notes) {
            if (!note.notes) continue;
            const existing = noteMap.get(note.elementId) || [];
            existing.push(note.notes);
            noteMap.set(note.elementId, existing);
        }

        return { success: true, data: noteMap };
    } catch (error) {
        console.error("Error fetching idea notes for ideas:", error);
        return { success: false, error: "Failed to fetch idea notes" };
    }
}

/**
 * Persist new note_order values after drag-reordering idea_notes within a card.
 */
export async function reorderIdeaNotes(novelId: string, sceneId: string, orderedNoteIds: string[]) {
    try {
        await Promise.all(
            orderedNoteIds.map((id, index) =>
                db.update(sceneElementDetails)
                    .set({ noteOrder: index, updatedAt: new Date() })
                    .where(eq(sceneElementDetails.id, id))
            )
        );
        revalidatePath(`/dashboard/project/${novelId}/plot/${sceneId}`);
        return { success: true };
    } catch (error) {
        console.error("Error reordering idea notes:", error);
        return { success: false, error: "Failed to reorder notes" };
    }
}

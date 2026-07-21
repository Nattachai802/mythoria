'use server';

import { db } from "@/db/drizzle";
import { factions, characterFactions, factionRelationships, characters, factionStatusPresets, Faction, FactionStatusPreset } from "@/db/schema";
import { eq, and, or, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { requireNovelAccess, authErrorMessage } from "@/lib/authz";
import { addReference, removeReferenceEdge } from "./references"; // Context Fabric dual-write (P4)

// --- Factions CRUD ---

export async function createFaction(data: {
    name: string;
    description?: string;
    type?: string;
    color?: string;
    parentFactionId?: string | null;
    status?: string;
    alignment?: string;
    goal?: string;
    element?: string;
    leaderId?: string | null;
    icon?: string;
    importance?: number;
    orderIndex?: number;
    novelId: string;
}) {
    try {
        await requireNovelAccess(data.novelId);

        const [newFaction] = await db
            .insert(factions)
            .values(data)
            .returning();

        revalidatePath(`/dashboard/project/${data.novelId}/relationships`);
        return { success: true, data: newFaction };
    } catch (error) {
        console.error("Error creating faction:", error);
        return { success: false, error: authErrorMessage(error, "Failed to create faction") };
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
        // factionId มาจาก client เชื่อตรง ๆ ไม่ได้ — ต้องหา novelId เจ้าของจริงก่อน แล้วเช็คสิทธิ์
        const [existing] = await db.select({ novelId: factions.novelId }).from(factions).where(eq(factions.id, factionId)).limit(1);
        if (!existing) return { success: false, error: "Faction not found" };
        await requireNovelAccess(existing.novelId);

        // ห้าม client ย้ายฝ่ายข้ามไปนิยายอื่นผ่าน payload (novelId ไม่ควรแก้ได้จากช่องทางนี้)
        const { novelId: _ignored, ...safeData } = data as Partial<Faction> & { novelId?: string };

        const [updatedFaction] = await db
            .update(factions)
            .set({ ...safeData, updatedAt: new Date() })
            .where(eq(factions.id, factionId))
            .returning();

        revalidatePath(`/dashboard/project/${updatedFaction.novelId}/relationships`);
        return { success: true, data: updatedFaction };
    } catch (error) {
        console.error("Error updating faction:", error);
        return { success: false, error: authErrorMessage(error, "Failed to update faction") };
    }
}

export async function deleteFaction(factionId: string) {
    try {
        const [existing] = await db.select({ novelId: factions.novelId }).from(factions).where(eq(factions.id, factionId)).limit(1);
        if (!existing) return { success: false, error: "Faction not found" };
        await requireNovelAccess(existing.novelId);

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
        return { success: false, error: authErrorMessage(error, "Failed to delete faction") };
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

        await addReference({
            novelId: data.novelId,
            from: { type: "character", id: data.characterId },
            to: { type: "faction", id: data.factionId },
            relation: "member_of",
            meta: { role: data.role, startChapterId: data.startChapterId, endChapterId: data.endChapterId },
        });

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
            await removeReferenceEdge({
                from: { type: "character", id: deleted.characterId },
                to: { type: "faction", id: deleted.factionId },
                relation: "member_of",
            });
            revalidatePath(`/dashboard/project/${novelId}/relationships`);
        }

        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error removing character from faction:", error);
        return { success: false, error: "Failed to remove character from faction" };
    }
}

/**
 * ผูก parentFactionId / leaderId อัตโนมัติจาก "ชื่อ" — ใช้โดย Story Bible import (Phase ผูกความสัมพันธ์)
 * สร้าง entity ทั้งหมดก่อน แล้วค่อยเรียกอันนี้ทีเดียวเพื่อ resolve ชื่อ→id (chicken-egg: parent อาจถูกสร้างทีหลัง)
 * exact-match ตามชื่อในนิยายเดียวกัน; ไม่เจอ/กำกวม = ข้ามเงียบๆ แล้วรายงานใน unresolved
 */
export async function autoLinkFactions(
    novelId: string,
    links: { name: string; parentName?: string; leaderName?: string }[],
) {
    try {
        const allFactions = await db.select().from(factions).where(eq(factions.novelId, novelId));
        const allChars = await db.select().from(characters).where(eq(characters.novelId, novelId));

        // ชื่อซ้ำ = ข้าม (กำกวม resolve ไม่ได้) — เก็บเฉพาะชื่อที่ unique. get() คืน id (string)
        const factionByName = uniqueByName(allFactions.map((f: Faction) => ({ id: f.id, name: f.name })));
        const charByName = uniqueByName(allChars.map((c: typeof characters.$inferSelect) => ({ id: c.id, name: c.name })));

        let linked = 0;
        const unresolved: string[] = [];

        for (const l of links) {
            const targetId = factionByName.get(l.name.trim());
            if (!targetId) { unresolved.push(l.name); continue; }

            const patch: Partial<Faction> = {};
            if (l.parentName) {
                const parentId = factionByName.get(l.parentName.trim());
                if (parentId && parentId !== targetId) patch.parentFactionId = parentId;
                else if (!parentId) unresolved.push(`${l.name} → parent "${l.parentName}"`);
            }
            if (l.leaderName) {
                const leaderId = charByName.get(l.leaderName.trim());
                if (leaderId) patch.leaderId = leaderId;
                else unresolved.push(`${l.name} → leader "${l.leaderName}"`);
            }
            if (Object.keys(patch).length > 0) {
                await db.update(factions).set(patch).where(eq(factions.id, targetId));
                linked++;
            }
        }

        revalidatePath(`/dashboard/project/${novelId}/factions`);
        return { success: true, linked, unresolved };
    } catch (error) {
        console.error("Error auto-linking factions:", error);
        return { success: false, error: "Failed to auto-link factions" };
    }
}

/** map ชื่อ→id เฉพาะชื่อที่ไม่ซ้ำ (ชื่อซ้ำถูกตัดออกเพราะ resolve ไม่ได้) */
function uniqueByName(rows: { id: string; name: string }[]): Map<string, string> {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.name, (counts.get(r.name) ?? 0) + 1);
    const m = new Map<string, string>();
    for (const r of rows) if (counts.get(r.name) === 1) m.set(r.name, r.id);
    return m;
}

// --- Faction ↔ Faction Relationships ---

export async function createFactionRelationship(data: {
    novelId: string;
    sourceFactionId: string;
    targetFactionId: string;
    type: string;
    description?: string;
}) {
    try {
        const [row] = await db.insert(factionRelationships).values(data).returning();
        // Context Fabric edge (faction→faction)
        await addReference({
            novelId: data.novelId,
            from: { type: "faction", id: data.sourceFactionId },
            to: { type: "faction", id: data.targetFactionId },
            relation: "related_to", // ชนิดจริง (ally/enemy/…) เก็บใน factionRelationships.type
            meta: { factionRelType: data.type },
        });
        revalidatePath(`/dashboard/project/${data.novelId}/factions`);
        return { success: true, data: row };
    } catch (error) {
        console.error("Error creating faction relationship:", error);
        return { success: false, error: "Failed to create faction relationship" };
    }
}

export async function getFactionRelationships(novelId: string) {
    try {
        const rows = await db.query.factionRelationships.findMany({
            where: (fr, { eq }) => eq(fr.novelId, novelId),
            with: { sourceFaction: true, targetFaction: true },
        });
        return { success: true, data: rows };
    } catch (error) {
        console.error("Error fetching faction relationships:", error);
        return { success: false, error: "Failed to fetch faction relationships" };
    }
}

export async function deleteFactionRelationship(relId: string, novelId: string) {
    try {
        const [deleted] = await db
            .delete(factionRelationships)
            .where(eq(factionRelationships.id, relId))
            .returning();
        if (deleted) {
            await removeReferenceEdge({
                from: { type: "faction", id: deleted.sourceFactionId },
                to: { type: "faction", id: deleted.targetFactionId },
                relation: "related_to",
            });
            revalidatePath(`/dashboard/project/${novelId}/factions`);
        }
        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting faction relationship:", error);
        return { success: false, error: "Failed to delete faction relationship" };
    }
}

// --- Faction Status Presets ---

/** ดึง presets ทั้ง global (novelId IS NULL) + novel-specific รวมกัน เรียงตาม orderIndex */
export async function getFactionStatusPresets(novelId: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        const rows = await db
            .select()
            .from(factionStatusPresets)
            .where(
                and(
                    eq(factionStatusPresets.userId, session.user.id),
                    or(
                        isNull(factionStatusPresets.novelId),
                        eq(factionStatusPresets.novelId, novelId),
                    ),
                ),
            )
            .orderBy(factionStatusPresets.orderIndex);

        return { success: true, data: rows };
    } catch (error) {
        console.error("Error fetching faction status presets:", error);
        return { success: false, error: "Failed to fetch presets" };
    }
}

/** สร้าง preset ใหม่ — novelId=null → global, มีค่า → novel-specific */
export async function createFactionStatusPreset(data: {
    key: string;
    label: string;
    color: string;
    novelId: string | null; // null = global
    orderIndex?: number;
}) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        const [row] = await db
            .insert(factionStatusPresets)
            .values({
                key: data.key.trim().toLowerCase().replace(/\s+/g, "_"),
                label: data.label.trim(),
                color: data.color,
                novelId: data.novelId,
                userId: session.user.id,
                orderIndex: data.orderIndex ?? 99,
            })
            .returning();

        if (data.novelId) revalidatePath(`/dashboard/project/${data.novelId}/factions`);
        return { success: true, data: row };
    } catch (error) {
        console.error("Error creating faction status preset:", error);
        return { success: false, error: "Failed to create preset" };
    }
}

/** แก้ไข preset */
export async function updateFactionStatusPreset(
    presetId: string,
    data: Partial<Pick<FactionStatusPreset, "key" | "label" | "color" | "orderIndex">>,
    novelId?: string,
) {
    try {
        const [row] = await db
            .update(factionStatusPresets)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(factionStatusPresets.id, presetId))
            .returning();

        if (novelId) revalidatePath(`/dashboard/project/${novelId}/factions`);
        return { success: true, data: row };
    } catch (error) {
        console.error("Error updating faction status preset:", error);
        return { success: false, error: "Failed to update preset" };
    }
}

/** ลบ preset */
export async function deleteFactionStatusPreset(presetId: string, novelId?: string) {
    try {
        const [deleted] = await db
            .delete(factionStatusPresets)
            .where(eq(factionStatusPresets.id, presetId))
            .returning();

        if (novelId) revalidatePath(`/dashboard/project/${novelId}/factions`);
        return { success: true, data: deleted };
    } catch (error) {
        console.error("Error deleting faction status preset:", error);
        return { success: false, error: "Failed to delete preset" };
    }
}

"use server";

import { db } from "@/db/drizzle";
import { characters, characterRelationships, references } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveMany, type EntityType } from "./registry/entity-registry";

export interface GraphNode {
    id: string;
    name: string;
    img?: string | null;
    role: string;
    group: string; // Faction or Role group
    val: number; // Size/Importance
}

export interface GraphLink {
    source: string;
    target: string;
    type: string;
    description?: string | null;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export async function getCharacterNetwork(novelId: string): Promise<{ success: boolean; data?: GraphData; error?: string }> {
    try {
        // 1. Fetch all characters in the novel
        const chars = await db.query.characters.findMany({
            where: eq(characters.novelId, novelId),
        });

        if (chars.length === 0) {
            return { success: true, data: { nodes: [], links: [] } };
        }

        // 2. Fetch relationships filtered by novelId directly at DB level
        const novelRels = await db.query.characterRelationships.findMany({
            where: eq(characterRelationships.novelId, novelId),
        });

        // 3. Transform to Graph Format
        const nodes: GraphNode[] = chars.map(c => ({
            id: c.id,
            name: c.name,
            img: c.image,
            role: c.role,
            group: c.role, // Use role as group for coloring by default
            val: c.role === 'protagonist' ? 5 : c.role === 'antagonist' ? 4 : c.role === 'supporting' ? 3 : 2
        }));

        const links: GraphLink[] = novelRels.map(r => ({
            source: r.sourceCharacterId,
            target: r.targetCharacterId,
            type: r.type,
            description: r.description
        }));

        return {
            success: true,
            data: { nodes, links }
        };

    } catch (error) {
        console.error("Error fetching character network:", error);
        return { success: false, error: "Failed to load network data" };
    }
}

// ============================================
// Context Fabric — whole-world graph from the reference layer (L3)
// ทุก entity type เป็น node, ทุก reference เป็น edge — ไม่ใช่แค่ตัวละคร
// ============================================
export interface WorldGraphNode {
    id: string;        // `${type}:${id}` (unique ข้าม type)
    entityId: string;
    type: EntityType;
    label: string;
    href: string;
    icon?: string;
    val: number;       // degree (จำนวน edge ที่ต่อ)
}

export interface WorldGraphLink {
    source: string;    // `${type}:${id}`
    target: string;
    relation: string;
    createdBy: string;
}

export interface WorldGraphData {
    nodes: WorldGraphNode[];
    links: WorldGraphLink[];
}

export async function getNovelGraph(
    novelId: string,
    opts?: { relations?: string[]; createdBy?: string[] },
): Promise<{ success: boolean; data?: WorldGraphData; error?: string }> {
    try {
        const rows = await db.query.references.findMany({
            where: eq(references.novelId, novelId),
        });

        const filtered = rows.filter((r) =>
            (!opts?.relations || opts.relations.includes(r.relation)) &&
            (!opts?.createdBy || opts.createdBy.includes(r.createdBy)),
        );

        if (filtered.length === 0) {
            return { success: true, data: { nodes: [], links: [] } };
        }

        // resolve ทุก entity ที่ปรากฏ (สองฝั่งของ edge) ทีเดียวผ่าน registry
        const pointers = new Map<string, { type: EntityType; id: string }>();
        const degree = new Map<string, number>();
        const bump = (key: string) => degree.set(key, (degree.get(key) ?? 0) + 1);

        for (const r of filtered) {
            const fromKey = `${r.fromType}:${r.fromId}`;
            const toKey = `${r.toType}:${r.toId}`;
            pointers.set(fromKey, { type: r.fromType as EntityType, id: r.fromId });
            pointers.set(toKey, { type: r.toType as EntityType, id: r.toId });
            bump(fromKey);
            bump(toKey);
        }

        const resolved = await resolveMany([...pointers.values()]);

        const nodes: WorldGraphNode[] = [];
        for (const [key, ptr] of pointers) {
            const ref = resolved.get(key);
            if (!ref) continue; // entity ถูกลบไปแล้ว แต่ edge ค้าง → ข้าม
            nodes.push({
                id: key,
                entityId: ref.id,
                type: ref.type,
                label: ref.title,
                href: ref.href,
                icon: ref.icon,
                val: degree.get(key) ?? 1,
            });
        }

        const liveKeys = new Set(nodes.map((n) => n.id));
        const links: WorldGraphLink[] = filtered
            .map((r) => ({
                source: `${r.fromType}:${r.fromId}`,
                target: `${r.toType}:${r.toId}`,
                relation: r.relation,
                createdBy: r.createdBy,
            }))
            .filter((l) => liveKeys.has(l.source) && liveKeys.has(l.target));

        return { success: true, data: { nodes, links } };
    } catch (error) {
        console.error("Error building novel graph:", error);
        return { success: false, error: "Failed to load novel graph" };
    }
}

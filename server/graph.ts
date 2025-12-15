"use server";

import { db } from "@/db/drizzle";
import { characters, characterRelationships } from "@/db/schema";
import { eq, or } from "drizzle-orm";

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

        // 2. Fetch all relationships
        // Note: We need relationships where BOTH characters are in this novel (usually handled by DB constraints, but good to be safe)
        const charIds = chars.map(c => c.id);

        // Fetch relationships for these characters
        // Note: Drizzle doesn't support 'inArray' well with query builder on some versions, simpler to fetch all for novel if linked, 
        // but since relationships table doesn't have novelId, we iterate or fetch all related.
        // For efficiency, let's fetch all relationships involving any of these characters.

        // Optimized approach: Fetch all relationships where characterId is in our list
        // Since we don't have a direct 'novelId' on relationships, we rely on the characters.

        const rels = await db.select().from(characterRelationships)
            .where(
                or(
                    // We can't easily use "inArray" here without importing it.
                    // Let's rely on the client-side filtering or a join if performance is key.
                    // For now, let's fetch all relationships and filter in JS (assuming < 1000 rels per novel usually)
                    // A better way is to select relationships where characterId IN (select id from characters where novelId = ...)
                    // but let's stick to simple logic for now.
                )
            );

        // actually, let's just use raw query or simpler logic: 
        // Iterate chars and get relationships? No, N+1 problem.
        // CORRECT WAY:
        const allRelsRaw = await db.query.characterRelationships.findMany();

        // Filter relationships that belong to this novel (both source and target must exist in our chars list)
        const validCharIds = new Set(chars.map(c => c.id));
        const novelRels = allRelsRaw.filter(r =>
            validCharIds.has(r.sourceCharacterId) && validCharIds.has(r.targetCharacterId)
        );

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

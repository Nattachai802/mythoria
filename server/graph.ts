"use server";

import { db } from "@/db/drizzle";
import { characters, characterRelationships } from "@/db/schema";
import { eq } from "drizzle-orm";

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

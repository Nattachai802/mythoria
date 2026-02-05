// scripts/run-migration.ts
// Run with: npx tsx scripts/run-migration.ts

import { db } from "../db/drizzle";
import { ideas, timelineEvents } from "../db/schema";
import { eq, inArray } from "drizzle-orm";

interface CanvasItem {
    id: string;
    type: string;
    referenceId?: string;
    title?: string;
    x: number;
    y: number;
}

async function runMigration() {
    console.log("🔄 Starting migration: Update isUsed for ideas on Playground canvas...\n");

    try {
        // 1. Get all timeline events with canvasData
        const events = await db
            .select({
                id: timelineEvents.id,
                title: timelineEvents.title,
                canvasData: timelineEvents.canvasData
            })
            .from(timelineEvents);

        console.log(`📊 Found ${events.length} timeline events\n`);

        // 2. Extract all idea referenceIds from canvasData
        const usedIdeaIds = new Set<string>();

        for (const event of events) {
            if (!event.canvasData) continue;

            const canvasItems = event.canvasData as CanvasItem[];
            if (!Array.isArray(canvasItems)) continue;

            for (const item of canvasItems) {
                if (item.type === 'idea' && item.referenceId) {
                    usedIdeaIds.add(item.referenceId);
                    console.log(`  📌 Found idea "${item.title || item.referenceId}" in "${event.title}"`);
                }
            }
        }

        console.log(`\n📋 Total unique ideas on canvas: ${usedIdeaIds.size}\n`);

        if (usedIdeaIds.size === 0) {
            console.log("✅ No ideas found on any canvas. Nothing to update.");
            process.exit(0);
        }

        // 3. Update all these ideas to isUsed = true
        const ideaIdsArray = Array.from(usedIdeaIds);

        const result = await db
            .update(ideas)
            .set({ isUsed: true })
            .where(inArray(ideas.id, ideaIdsArray))
            .returning({ id: ideas.id, title: ideas.title });

        console.log(`✅ Updated ${result.length} ideas to isUsed=true:\n`);

        result.forEach(idea => {
            console.log(`  ✓ ${idea.title}`);
        });

        process.exit(0);
    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

runMigration();

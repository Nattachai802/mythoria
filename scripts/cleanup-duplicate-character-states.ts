/**
 * Cleanup script to remove duplicate character states
 * Keeps one state per character per note (the one with lowest health or first created)
 * 
 * Usage: npx tsx scripts/cleanup-duplicate-character-states.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be deleted without actually deleting
 */

import { db } from "../db/drizzle";
import { characterStates } from "../db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

interface DuplicateGroup {
    noteId: string;
    characterId: string;
    count: number;
    ids: string[];
    healths: (number | null)[];
    isManuallyEdited: boolean[];
}

async function findDuplicates(): Promise<DuplicateGroup[]> {
    // Find all note-character combinations with more than 1 state
    const duplicates = await db.execute(sql`
        SELECT 
            note_id as "noteId",
            character_id as "characterId",
            COUNT(*) as count,
            ARRAY_AGG(id ORDER BY extracted_at ASC) as ids,
            ARRAY_AGG(health ORDER BY extracted_at ASC) as healths,
            ARRAY_AGG(is_manually_edited ORDER BY extracted_at ASC) as "isManuallyEdited"
        FROM character_states
        GROUP BY note_id, character_id
        HAVING COUNT(*) > 1
    `);

    return duplicates.rows as unknown as DuplicateGroup[];
}

async function mergeAndCleanDuplicates(duplicates: DuplicateGroup[], dryRun: boolean) {
    console.log(`\nFound ${duplicates.length} note-character combinations with duplicates`);

    let totalDeleted = 0;
    let totalKept = 0;

    for (const dup of duplicates) {
        const ids = dup.ids;
        const healths = dup.healths;
        const isManuallyEdited = dup.isManuallyEdited || [];

        // Strategy:
        // 1. FIRST priority: Keep manually edited ones
        // 2. SECOND priority: Keep the one with lowest health (worst case scenario)
        // 3. If all equal, keep the first one (oldest)
        let keepIndex = 0;

        // Check if any are manually edited
        const manualIndex = isManuallyEdited.findIndex((m) => m === true);
        if (manualIndex !== -1) {
            keepIndex = manualIndex;
            console.log(`  ⭐ Found manually edited entry at index ${manualIndex}`);
        } else {
            // No manual edit, use health-based selection
            let lowestHealth = healths[0] ?? 100;
            for (let i = 1; i < healths.length; i++) {
                const health = healths[i] ?? 100;
                if (health < lowestHealth) {
                    lowestHealth = health;
                    keepIndex = i;
                }
            }
        }

        const keepId = ids[keepIndex];
        const deleteIds = ids.filter((_, i) => i !== keepIndex);

        console.log(`\n[${dup.noteId.slice(0, 8)}...] Character ${dup.characterId.slice(0, 8)}...`);
        console.log(`  Duplicates: ${ids.length}`);
        console.log(`  Healths: ${healths.join(", ")}`);
        console.log(`  Manual: ${isManuallyEdited.join(", ")}`);
        console.log(`  Keeping: ${keepId.slice(0, 8)}... (health: ${healths[keepIndex] ?? "null"}, manual: ${isManuallyEdited[keepIndex]})`);
        console.log(`  Deleting: ${deleteIds.length} entries`);

        if (!dryRun) {
            await db.delete(characterStates)
                .where(inArray(characterStates.id, deleteIds));
            totalDeleted += deleteIds.length;
        } else {
            console.log(`  [DRY RUN] Would delete ${deleteIds.length} entries`);
            totalDeleted += deleteIds.length;
        }
        totalKept++;
    }

    return { totalDeleted, totalKept };
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes("--dry-run");

    console.log("=".repeat(60));
    console.log("Character States Duplicate Cleanup");
    console.log("=".repeat(60));

    if (dryRun) {
        console.log("\n⚠️  DRY RUN MODE - No changes will be made\n");
    }

    // Get total count first
    const totalStates = await db.select({ count: sql<number>`count(*)` })
        .from(characterStates);
    console.log(`Total character states in database: ${totalStates[0].count}`);

    // Find duplicates
    console.log("\nSearching for duplicates...");
    const duplicates = await findDuplicates();

    if (duplicates.length === 0) {
        console.log("\n✅ No duplicates found! Database is clean.");
        process.exit(0);
    }

    // Calculate total duplicates
    const totalDuplicateEntries = duplicates.reduce((sum, d) => sum + Number(d.count), 0);
    const entriesToDelete = totalDuplicateEntries - duplicates.length;

    console.log(`\n📊 Summary:`);
    console.log(`   Affected note-character pairs: ${duplicates.length}`);
    console.log(`   Total entries involved: ${totalDuplicateEntries}`);
    console.log(`   Entries to delete: ${entriesToDelete}`);
    console.log(`   Entries to keep: ${duplicates.length}`);

    // Clean up
    const result = await mergeAndCleanDuplicates(duplicates, dryRun);

    console.log("\n" + "=".repeat(60));
    if (dryRun) {
        console.log(`DRY RUN COMPLETE`);
        console.log(`Would delete: ${result.totalDeleted} duplicate entries`);
        console.log(`Would keep: ${result.totalKept} entries`);
        console.log("\nRun without --dry-run to actually delete duplicates.");
    } else {
        console.log(`✅ CLEANUP COMPLETE`);
        console.log(`Deleted: ${result.totalDeleted} duplicate entries`);
        console.log(`Kept: ${result.totalKept} entries`);
    }
    console.log("=".repeat(60));

    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

/**
 * Script to process all unprocessed notes for character state extraction
 * Usage: npx tsx scripts/process-unprocessed-notes.ts [novelId] [limit]
 * 
 * Examples:
 *   npx tsx scripts/process-unprocessed-notes.ts                   # Process 10 notes from any novel
 *   npx tsx scripts/process-unprocessed-notes.ts novel123          # Process 10 notes from novel123
 *   npx tsx scripts/process-unprocessed-notes.ts novel123 50       # Process 50 notes from novel123
 *   npx tsx scripts/process-unprocessed-notes.ts --all             # Process ALL unprocessed notes (be careful!)
 */

import { db } from "../db/drizzle";
import { notes, characterStates, stateExtractionQueue } from "../db/schema";
import { eq, and, inArray, notInArray, sql } from "drizzle-orm";
import { queueNoteForStateExtraction, processStateExtractionQueue } from "../server/character-state-extractor";

async function getStats(novelId?: string) {
    // Total notes
    const totalNotesQuery = novelId
        ? db.select({ count: sql<number>`count(*)` }).from(notes).where(eq(notes.novelId, novelId))
        : db.select({ count: sql<number>`count(*)` }).from(notes);
    const [{ count: totalNotes }] = await totalNotesQuery;

    // Notes with states
    const notesWithStatesQuery = novelId
        ? db.selectDistinct({ noteId: characterStates.noteId })
            .from(characterStates)
            .where(eq(characterStates.novelId, novelId))
        : db.selectDistinct({ noteId: characterStates.noteId }).from(characterStates);
    const notesWithStates = (await notesWithStatesQuery).length;

    // Notes in queue
    const notesInQueueQuery = novelId
        ? db.select({ noteId: stateExtractionQueue.noteId })
            .from(stateExtractionQueue)
            .where(
                and(
                    eq(stateExtractionQueue.novelId, novelId),
                    inArray(stateExtractionQueue.status, ["pending", "processing"])
                )
            )
        : db.select({ noteId: stateExtractionQueue.noteId })
            .from(stateExtractionQueue)
            .where(inArray(stateExtractionQueue.status, ["pending", "processing"]));
    const notesInQueue = (await notesInQueueQuery).length;

    return {
        totalNotes: Number(totalNotes),
        notesWithStates,
        notesInQueue,
        unprocessedNotes: Number(totalNotes) - notesWithStates - notesInQueue,
    };
}

async function findUnprocessedNotes(novelId?: string, limit?: number) {
    // Get note IDs that already have character states
    const notesWithStates = await db
        .selectDistinct({ noteId: characterStates.noteId })
        .from(characterStates);
    const processedNoteIds = notesWithStates.map((n) => n.noteId);

    // Get note IDs currently in queue
    const notesInQueue = await db
        .select({ noteId: stateExtractionQueue.noteId })
        .from(stateExtractionQueue)
        .where(inArray(stateExtractionQueue.status, ["pending", "processing"]));
    const queuedNoteIds = notesInQueue.map((n) => n.noteId);

    const excludeNoteIds = [...new Set([...processedNoteIds, ...queuedNoteIds])];

    // Find unprocessed notes
    let query = db.select().from(notes);

    if (novelId) {
        if (excludeNoteIds.length > 0) {
            query = query.where(
                and(
                    eq(notes.novelId, novelId),
                    notInArray(notes.id, excludeNoteIds)
                )
            ) as typeof query;
        } else {
            query = query.where(eq(notes.novelId, novelId)) as typeof query;
        }
    } else if (excludeNoteIds.length > 0) {
        query = query.where(notInArray(notes.id, excludeNoteIds)) as typeof query;
    }

    if (limit) {
        return query.limit(limit);
    }
    return query;
}

async function main() {
    const args = process.argv.slice(2);
    const isProcessAll = args.includes("--all");
    const novelId = args.find(arg => arg !== "--all" && !arg.match(/^\d+$/));
    const limitArg = args.find(arg => arg.match(/^\d+$/));
    const limit = isProcessAll ? undefined : (limitArg ? parseInt(limitArg, 10) : 10);

    console.log("=".repeat(60));
    console.log("Character State Extraction - Batch Processor");
    console.log("=".repeat(60));

    // Show current stats
    const stats = await getStats(novelId);
    console.log("\n📊 Current Statistics:");
    console.log(`   Total Notes: ${stats.totalNotes}`);
    console.log(`   Notes with States: ${stats.notesWithStates}`);
    console.log(`   Notes in Queue: ${stats.notesInQueue}`);
    console.log(`   Unprocessed Notes: ${stats.unprocessedNotes}`);

    if (stats.unprocessedNotes === 0) {
        console.log("\n✅ All notes are already processed or in queue!");
        process.exit(0);
    }

    // Find and queue unprocessed notes
    console.log(`\n🔍 Finding unprocessed notes${novelId ? ` for novel ${novelId}` : ""}...`);
    console.log(`   Limit: ${limit ?? "ALL"}`);

    const unprocessedNotes = await findUnprocessedNotes(novelId, limit);
    console.log(`   Found: ${unprocessedNotes.length} notes to process`);

    if (unprocessedNotes.length === 0) {
        console.log("\n✅ No notes to process!");
        process.exit(0);
    }

    // Queue notes
    console.log("\n📥 Queuing notes for processing...");
    let queuedCount = 0;
    for (const note of unprocessedNotes) {
        try {
            await queueNoteForStateExtraction(note.id, note.novelId);
            queuedCount++;
            if (queuedCount % 10 === 0) {
                console.log(`   Queued ${queuedCount}/${unprocessedNotes.length}...`);
            }
        } catch (err) {
            console.error(`   ❌ Failed to queue note ${note.id}:`, err);
        }
    }
    console.log(`   ✅ Queued ${queuedCount} notes`);

    // Start processing
    console.log("\n⚙️  Starting processing queue...");
    console.log("   (This may take a while due to API rate limits)");
    console.log("   Press Ctrl+C to stop (queued items will be processed on next run)\n");

    await processStateExtractionQueue();

    // Show final stats
    const finalStats = await getStats(novelId);
    console.log("\n" + "=".repeat(60));
    console.log("📊 Final Statistics:");
    console.log(`   Total Notes: ${finalStats.totalNotes}`);
    console.log(`   Notes with States: ${finalStats.notesWithStates}`);
    console.log(`   Notes in Queue: ${finalStats.notesInQueue}`);
    console.log(`   Unprocessed Notes: ${finalStats.unprocessedNotes}`);
    console.log("=".repeat(60));

    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});

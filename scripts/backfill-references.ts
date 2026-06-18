/**
 * Context Fabric — Backfill junction tables → references layer (L1)
 *
 * คัดลอก/มิเรอร์ความสัมพันธ์ที่มีอยู่เดิมเข้า references โดยติดป้าย createdBy='migration'
 * Idempotent: รันซ้ำได้ (addReferences ใช้ onConflictDoNothing)
 * ไม่ลบ/แก้ junction เดิมแม้แต่นิดเดียว — additive ล้วน
 *
 * Usage:
 *   npx tsx scripts/backfill-references.ts            # ลงจริง
 *   npx tsx scripts/backfill-references.ts --dry-run  # นับอย่างเดียว ไม่เขียน
 *
 * docs/context-fabric-plan.md
 */

import { db } from "../db/drizzle";
import {
  notes,
  chapters,
  characters,
  locations,
  plotThreads,
  noteCharacters,
  chapterCharacters,
  characterFactions,
  locationEntities,
  ideaConnections,
  plotThreadBeats,
  sceneElementDetails,
  timelineEvents,
  characterRelationships,
  characterPowers,
  locationConnections,
  powerCombinations,
} from "../db/schema";
import { addReferences, type AddReferenceInput } from "../server/references";

const DRY = process.argv.includes("--dry-run");

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> | undefined {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? (out as Partial<T>) : undefined;
}

// สร้าง map id -> novelId สำหรับ junction ที่ไม่มี novelId ของตัวเอง
async function novelIdMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: table.id, novelId: table.novelId })
    .from(table);
  return new Map(rows.map((r: { id: string; novelId: string }) => [r.id, r.novelId]));
}

async function main() {
  console.log(`\n=== Backfill references ${DRY ? "(DRY RUN)" : "(LIVE)"} ===\n`);

  const inputs: AddReferenceInput[] = [];
  const summary: Record<string, number> = {};
  const add = (label: string, input: AddReferenceInput) => {
    inputs.push(input);
    summary[label] = (summary[label] ?? 0) + 1;
  };

  // โหลด map novelId ของ parent ที่จำเป็น
  const [noteNovel, chapterNovel, charNovel, locNovel, threadNovel] =
    await Promise.all([
      novelIdMap(notes),
      novelIdMap(chapters),
      novelIdMap(characters),
      novelIdMap(locations),
      novelIdMap(plotThreads),
    ]);

  // 1) noteCharacters → note --(features)--> character
  for (const r of await db.select().from(noteCharacters)) {
    const novelId = noteNovel.get(r.noteId);
    if (!novelId) continue;
    add("noteCharacters → features", {
      novelId,
      from: { type: "note", id: r.noteId },
      to: { type: "character", id: r.characterId },
      relation: "features",
      meta: clean({ role: r.role }),
      createdBy: "migration",
    });
  }

  // 2) chapterCharacters → chapter --(features)--> character
  for (const r of await db.select().from(chapterCharacters)) {
    const novelId = chapterNovel.get(r.chapterId);
    if (!novelId) continue;
    add("chapterCharacters → features", {
      novelId,
      from: { type: "chapter", id: r.chapterId },
      to: { type: "character", id: r.characterId },
      relation: "features",
      meta: clean({ role: r.role, frequency: r.frequency }),
      createdBy: "migration",
    });
  }

  // 3) characterFactions → character --(member_of)--> faction
  for (const r of await db.select().from(characterFactions)) {
    const novelId = charNovel.get(r.characterId);
    if (!novelId) continue;
    add("characterFactions → member_of", {
      novelId,
      from: { type: "character", id: r.characterId },
      to: { type: "faction", id: r.factionId },
      relation: "member_of",
      meta: clean({
        role: r.role,
        startChapterId: r.startChapterId,
        endChapterId: r.endChapterId,
      }),
      createdBy: "migration",
    });
  }

  // 4) locationEntities → entity --(inhabits)--> location
  for (const r of await db.select().from(locationEntities)) {
    const novelId = locNovel.get(r.locationId);
    if (!novelId) continue;
    add("locationEntities → inhabits", {
      novelId,
      from: { type: "entity", id: r.entityId },
      to: { type: "location", id: r.locationId },
      relation: "inhabits",
      meta: clean({ population: r.population }),
      createdBy: "migration",
    });
  }

  // 5) ideaConnections → idea --(linked_to|derived_from)--> idea
  for (const r of await db.select().from(ideaConnections)) {
    add("ideaConnections → linked_to/derived_from", {
      novelId: r.novelId,
      from: { type: "idea", id: r.sourceIdeaId },
      to: { type: "idea", id: r.targetIdeaId },
      relation: r.connectionType === "ancestor" ? "derived_from" : "linked_to",
      meta: clean({ label: r.label }),
      createdBy: "migration",
    });
  }

  // 6) plotThreadBeats → plotThread --(advances)--> timelineEvent
  for (const r of await db.select().from(plotThreadBeats)) {
    const novelId = threadNovel.get(r.threadId);
    if (!novelId) continue;
    add("plotThreadBeats → advances", {
      novelId,
      from: { type: "plotThread", id: r.threadId },
      to: { type: "timelineEvent", id: r.eventId },
      relation: "advances",
      meta: clean({ role: r.role, orderIndex: r.orderIndex, note: r.note }),
      createdBy: "migration",
    });
  }

  // 7) sceneElementDetails → timelineEvent --(features|set_in)--> character|location
  for (const r of await db.select().from(sceneElementDetails)) {
    const isChar = r.elementType === "character";
    add("sceneElementDetails → features/set_in", {
      novelId: r.novelId,
      from: { type: "timelineEvent", id: r.sceneId },
      to: { type: isChar ? "character" : "location", id: r.elementId },
      relation: isChar ? "features" : "set_in",
      meta: clean({
        action: r.action,
        how: r.how,
        goal: r.goal,
        outcome: r.outcome,
      }),
      createdBy: "migration",
    });
  }

  // 8) timelineEvents.relatedCharacterIds / relatedLocationIds (jsonb arrays)
  for (const r of await db.select().from(timelineEvents)) {
    const chars = (r.relatedCharacterIds as string[] | null) ?? [];
    const locs = (r.relatedLocationIds as string[] | null) ?? [];
    for (const cid of chars) {
      if (!cid) continue;
      add("timelineEvents.characters → features", {
        novelId: r.novelId,
        from: { type: "timelineEvent", id: r.id },
        to: { type: "character", id: cid },
        relation: "features",
        createdBy: "migration",
      });
    }
    for (const lid of locs) {
      if (!lid) continue;
      add("timelineEvents.locations → set_in", {
        novelId: r.novelId,
        from: { type: "timelineEvent", id: r.id },
        to: { type: "location", id: lid },
        relation: "set_in",
        createdBy: "migration",
      });
    }
  }

  // --- MIRROR: rich tables (ตารางเดิมยังเป็น source of truth) ---

  // 9) characterRelationships → character --(related_to)--> character
  for (const r of await db.select().from(characterRelationships)) {
    add("characterRelationships → related_to [mirror]", {
      novelId: r.novelId,
      from: { type: "character", id: r.sourceCharacterId },
      to: { type: "character", id: r.targetCharacterId },
      relation: "related_to",
      meta: clean({
        type: r.type,
        opinionLevel: r.opinionLevel,
        sentiment: r.sentiment,
      }),
      createdBy: "migration",
    });
  }

  // 10) characterPowers → character --(wields)--> power
  for (const r of await db.select().from(characterPowers)) {
    const novelId = charNovel.get(r.characterId);
    if (!novelId) continue;
    add("characterPowers → wields [mirror]", {
      novelId,
      from: { type: "character", id: r.characterId },
      to: { type: "power", id: r.powerId },
      relation: "wields",
      meta: clean({
        currentLevel: r.currentLevel,
        acquiredMethod: r.acquiredMethod,
      }),
      createdBy: "migration",
    });
  }

  // 11) locationConnections → location --(connects_to)--> location
  for (const r of await db.select().from(locationConnections)) {
    add("locationConnections → connects_to [mirror]", {
      novelId: r.novelId,
      from: { type: "location", id: r.sourceLocationId },
      to: { type: "location", id: r.targetLocationId },
      relation: "connects_to",
      meta: clean({
        travelTime: r.travelTime,
        travelMethod: r.travelMethod,
        isBidirectional: r.isBidirectional,
      }),
      createdBy: "migration",
    });
  }

  // 12) powerCombinations → power --(combines_into)--> power (result)
  for (const r of await db.select().from(powerCombinations)) {
    const sources = (r.sourcePowerIds as string[] | null) ?? [];
    for (const sid of sources) {
      if (!sid) continue;
      add("powerCombinations → combines_into [mirror]", {
        novelId: r.novelId,
        from: { type: "power", id: sid },
        to: { type: "power", id: r.resultPowerId },
        relation: "combines_into",
        meta: clean({ requiredLevels: r.requiredLevels }),
        createdBy: "migration",
      });
    }
  }

  // --- รายงาน ---
  console.log("จะ backfill ตามแหล่ง:");
  for (const [label, count] of Object.entries(summary).sort()) {
    console.log(`  ${count.toString().padStart(5)}  ${label}`);
  }
  console.log(`  ${"-----"}`);
  console.log(`  ${inputs.length.toString().padStart(5)}  รวม edges\n`);

  if (DRY) {
    console.log("DRY RUN — ไม่เขียนอะไรลง DB");
    return;
  }

  // เขียนเป็น batch กัน payload ใหญ่เกิน
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < inputs.length; i += BATCH) {
    const chunk = inputs.slice(i, i + BATCH);
    const res = await addReferences(chunk);
    if (res.success) inserted += res.inserted ?? 0;
    else console.error("batch error:", res.error);
  }
  console.log(`เขียนสำเร็จ (insert ใหม่): ${inserted} / ส่งไป ${inputs.length}`);
  console.log(`(ส่วนต่าง = edge ที่มีอยู่แล้ว ถูกข้ามด้วย onConflictDoNothing)\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

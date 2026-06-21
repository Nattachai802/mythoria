import { db } from "@/db/drizzle";
import { eq, inArray } from "drizzle-orm";
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
} from "@/db/schema";
import type { AddReferenceInput } from "./references";

/**
 * สร้าง edge list ที่ derive จาก junction/JSON-array/rich tables ของ "นิยายเดียว"
 * = ตัวเดียวกับ scripts/backfill-references.ts แต่ scope ตาม novelId
 * ใช้โดย rebuildNovelReferences() (rebuild ตอน Vector Sync)
 *
 * junction = source of truth · references = ดัชนีที่ derive (createdBy='migration')
 */

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> | undefined {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v !== null && v !== undefined) out[k] = v;
    }
    return Object.keys(out).length ? (out as Partial<T>) : undefined;
}

export async function buildDerivedReferences(novelId: string): Promise<AddReferenceInput[]> {
    const inputs: AddReferenceInput[] = [];

    // parent id ของนิยายนี้ (สำหรับ junction ที่ไม่มี novelId ของตัวเอง)
    const [charRows, noteRows, chapterRows, locRows, threadRows] = await Promise.all([
        db.select({ id: characters.id }).from(characters).where(eq(characters.novelId, novelId)),
        db.select({ id: notes.id }).from(notes).where(eq(notes.novelId, novelId)),
        db.select({ id: chapters.id }).from(chapters).where(eq(chapters.novelId, novelId)),
        db.select({ id: locations.id }).from(locations).where(eq(locations.novelId, novelId)),
        db.select({ id: plotThreads.id }).from(plotThreads).where(eq(plotThreads.novelId, novelId)),
    ]);
    const idOf = (r: { id: string }) => r.id;
    const charIds = charRows.map(idOf);
    const noteIds = noteRows.map(idOf);
    const chapterIds = chapterRows.map(idOf);
    const locIds = locRows.map(idOf);
    const threadIds = threadRows.map(idOf);

    // ---- MIGRATE: junction บางๆ (scope ผ่าน parent id) ----

    // 1) noteCharacters → note --features--> character
    if (noteIds.length) {
        for (const r of await db.select().from(noteCharacters).where(inArray(noteCharacters.noteId, noteIds))) {
            inputs.push({
                novelId,
                from: { type: "note", id: r.noteId },
                to: { type: "character", id: r.characterId },
                relation: "features",
                meta: clean({ role: r.role }),
                createdBy: "migration",
            });
        }
    }

    // 2) chapterCharacters → chapter --features--> character
    if (chapterIds.length) {
        for (const r of await db.select().from(chapterCharacters).where(inArray(chapterCharacters.chapterId, chapterIds))) {
            inputs.push({
                novelId,
                from: { type: "chapter", id: r.chapterId },
                to: { type: "character", id: r.characterId },
                relation: "features",
                meta: clean({ role: r.role, frequency: r.frequency }),
                createdBy: "migration",
            });
        }
    }

    // 3) characterFactions → character --member_of--> faction
    if (charIds.length) {
        for (const r of await db.select().from(characterFactions).where(inArray(characterFactions.characterId, charIds))) {
            inputs.push({
                novelId,
                from: { type: "character", id: r.characterId },
                to: { type: "faction", id: r.factionId },
                relation: "member_of",
                meta: clean({ role: r.role, startChapterId: r.startChapterId, endChapterId: r.endChapterId }),
                createdBy: "migration",
            });
        }
    }

    // 4) locationEntities → entity --inhabits--> location
    if (locIds.length) {
        for (const r of await db.select().from(locationEntities).where(inArray(locationEntities.locationId, locIds))) {
            inputs.push({
                novelId,
                from: { type: "entity", id: r.entityId },
                to: { type: "location", id: r.locationId },
                relation: "inhabits",
                meta: clean({ population: r.population }),
                createdBy: "migration",
            });
        }
    }

    // 5) ideaConnections → idea --linked_to|derived_from--> idea (มี novelId)
    for (const r of await db.select().from(ideaConnections).where(eq(ideaConnections.novelId, novelId))) {
        inputs.push({
            novelId,
            from: { type: "idea", id: r.sourceIdeaId },
            to: { type: "idea", id: r.targetIdeaId },
            relation: r.connectionType === "ancestor" ? "derived_from" : "linked_to",
            meta: clean({ label: r.label }),
            createdBy: "migration",
        });
    }

    // 6) plotThreadBeats → plotThread --advances--> timelineEvent
    if (threadIds.length) {
        for (const r of await db.select().from(plotThreadBeats).where(inArray(plotThreadBeats.threadId, threadIds))) {
            inputs.push({
                novelId,
                from: { type: "plotThread", id: r.threadId },
                to: { type: "timelineEvent", id: r.eventId },
                relation: "advances",
                meta: clean({ role: r.role, orderIndex: r.orderIndex, note: r.note }),
                createdBy: "migration",
            });
        }
    }

    // 7) sceneElementDetails → timelineEvent --features|set_in--> character|location (มี novelId)
    for (const r of await db.select().from(sceneElementDetails).where(eq(sceneElementDetails.novelId, novelId))) {
        const isChar = r.elementType === "character";
        inputs.push({
            novelId,
            from: { type: "timelineEvent", id: r.sceneId },
            to: { type: isChar ? "character" : "location", id: r.elementId },
            relation: isChar ? "features" : "set_in",
            meta: clean({ action: r.action, how: r.how, goal: r.goal, outcome: r.outcome }),
            createdBy: "migration",
        });
    }

    // 8) timelineEvents.relatedCharacterIds / relatedLocationIds (jsonb arrays, มี novelId)
    for (const r of await db.select().from(timelineEvents).where(eq(timelineEvents.novelId, novelId))) {
        for (const cid of ((r.relatedCharacterIds as string[] | null) ?? [])) {
            if (!cid) continue;
            inputs.push({
                novelId,
                from: { type: "timelineEvent", id: r.id },
                to: { type: "character", id: cid },
                relation: "features",
                createdBy: "migration",
            });
        }
        for (const lid of ((r.relatedLocationIds as string[] | null) ?? [])) {
            if (!lid) continue;
            inputs.push({
                novelId,
                from: { type: "timelineEvent", id: r.id },
                to: { type: "location", id: lid },
                relation: "set_in",
                createdBy: "migration",
            });
        }
    }

    // ---- MIRROR: rich tables (เจ้าของยังเป็นตารางเดิม, มี novelId) ----

    // 9) characterRelationships → character --related_to--> character
    for (const r of await db.select().from(characterRelationships).where(eq(characterRelationships.novelId, novelId))) {
        inputs.push({
            novelId,
            from: { type: "character", id: r.sourceCharacterId },
            to: { type: "character", id: r.targetCharacterId },
            relation: "related_to",
            meta: clean({ type: r.type, opinionLevel: r.opinionLevel, sentiment: r.sentiment }),
            createdBy: "migration",
        });
    }

    // 10) characterPowers → character --wields--> power (scope ผ่าน characterId)
    if (charIds.length) {
        for (const r of await db.select().from(characterPowers).where(inArray(characterPowers.characterId, charIds))) {
            inputs.push({
                novelId,
                from: { type: "character", id: r.characterId },
                to: { type: "power", id: r.powerId },
                relation: "wields",
                meta: clean({ currentLevel: r.currentLevel, acquiredMethod: r.acquiredMethod }),
                createdBy: "migration",
            });
        }
    }

    // 11) locationConnections → location --connects_to--> location (มี novelId)
    for (const r of await db.select().from(locationConnections).where(eq(locationConnections.novelId, novelId))) {
        inputs.push({
            novelId,
            from: { type: "location", id: r.sourceLocationId },
            to: { type: "location", id: r.targetLocationId },
            relation: "connects_to",
            meta: clean({ travelTime: r.travelTime, travelMethod: r.travelMethod, isBidirectional: r.isBidirectional }),
            createdBy: "migration",
        });
    }

    // 12) powerCombinations → power --combines_into--> power (result) (มี novelId)
    for (const r of await db.select().from(powerCombinations).where(eq(powerCombinations.novelId, novelId))) {
        for (const sid of ((r.sourcePowerIds as string[] | null) ?? [])) {
            if (!sid) continue;
            inputs.push({
                novelId,
                from: { type: "power", id: sid },
                to: { type: "power", id: r.resultPowerId },
                relation: "combines_into",
                meta: clean({ requiredLevels: r.requiredLevels }),
                createdBy: "migration",
            });
        }
    }

    return inputs;
}

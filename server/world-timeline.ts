"use server"

import { db } from "@/db/drizzle"
import {
    chapters, eras, timelineEvents, loreEntries, loreGroups, characters, locations,
    factions, powers, characterLifeEvents, characterFactions, characterPowers,
} from "@/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { requireNovelAccess } from "@/lib/authz"
import type { WorldTimelineInput, TlAnchored } from "@/lib/world-timeline"

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

/**
 * ข้อมูลดิบของหน้าเส้นเวลา (เฟส 1 อ่านอย่างเดียว) — แปลงเป็นแกนด้วย buildWorldTimeline() ใน lib/world-timeline.ts
 * ทุก query scope ด้วย novelId · ตารางที่ไม่มี novelId (character_factions/powers) scope ผ่าน characters
 */
export async function getWorldTimelineInput(novelId: string): Promise<WorldTimelineInput> {
    await requireNovelAccess(novelId)

    const [
        chapterRows, eraRows, sceneRows, loreRows, groupRows, characterRows, locationRows,
        factionRows, powerRows, lifeRows, factionLinkRows, powerLinkRows,
    ] = await Promise.all([
        db.select({ id: chapters.id, title: chapters.title, orderIndex: chapters.orderIndex })
            .from(chapters).where(and(eq(chapters.novelId, novelId), isNull(chapters.deletedAt))).orderBy(asc(chapters.orderIndex)),
        db.select({ id: eras.id, name: eras.name, color: eras.color, orderIndex: eras.orderIndex })
            .from(eras).where(eq(eras.novelId, novelId)),
        db.select({
            id: timelineEvents.id, title: timelineEvents.title, chapterId: timelineEvents.relatedChapterId,
            orderIndex: timelineEvents.orderIndex, storyTimeIndex: timelineEvents.storyTimeIndex,
            storyDate: timelineEvents.storyDate, eraId: timelineEvents.eraId, eventType: timelineEvents.eventType,
            characterIds: timelineEvents.relatedCharacterIds, locationIds: timelineEvents.relatedLocationIds,
            povCharacterId: timelineEvents.povCharacterId,
        }).from(timelineEvents).where(eq(timelineEvents.novelId, novelId)),
        db.select({
            id: loreEntries.id, title: loreEntries.title, eraId: loreEntries.eraId, orderInEra: loreEntries.orderInEra,
            groupId: loreEntries.groupId, locationId: loreEntries.locationId,
        }).from(loreEntries).where(eq(loreEntries.novelId, novelId)),
        db.select({ id: loreGroups.id, name: loreGroups.name }).from(loreGroups).where(eq(loreGroups.novelId, novelId)),
        db.select({ id: characters.id, name: characters.name }).from(characters).where(eq(characters.novelId, novelId)),
        db.select({ id: locations.id, name: locations.name }).from(locations).where(eq(locations.novelId, novelId)),
        db.select({ id: factions.id, name: factions.name }).from(factions).where(eq(factions.novelId, novelId)),
        db.select({ id: powers.id, name: powers.name }).from(powers).where(eq(powers.novelId, novelId)),
        db.select({
            id: characterLifeEvents.id, title: characterLifeEvents.title,
            chapterId: characterLifeEvents.chapterId, characterId: characterLifeEvents.characterId,
        }).from(characterLifeEvents).where(eq(characterLifeEvents.novelId, novelId)),
        db.select({
            id: characterFactions.id, factionId: characterFactions.factionId,
            chapterId: characterFactions.startChapterId, characterName: characters.name, role: characterFactions.role,
        }).from(characterFactions)
            .innerJoin(characters, eq(characterFactions.characterId, characters.id))
            .where(eq(characters.novelId, novelId)),
        db.select({
            id: characterPowers.id, powerId: characterPowers.powerId,
            chapterId: characterPowers.startChapterId, characterName: characters.name,
        }).from(characterPowers)
            .innerJoin(characters, eq(characterPowers.characterId, characters.id))
            .where(eq(characters.novelId, novelId)),
    ])

    const anchored: TlAnchored[] = [
        ...lifeRows.map((r): TlAnchored => ({
            id: r.id, kind: "life", title: r.title, chapterId: r.chapterId, subLaneId: r.characterId,
        })),
        ...factionLinkRows.map((r): TlAnchored => ({
            id: r.id, kind: "faction", chapterId: r.chapterId, subLaneId: r.factionId,
            title: r.role ? `${r.characterName} เข้าร่วม (${r.role})` : `${r.characterName} เข้าร่วม`,
        })),
        ...powerLinkRows.map((r): TlAnchored => ({
            id: r.id, kind: "power", chapterId: r.chapterId, subLaneId: r.powerId, title: `${r.characterName} ได้พลัง`,
        })),
    ]

    return {
        chapters: chapterRows,
        eras: eraRows,
        scenes: sceneRows.map((s) => ({ ...s, characterIds: ids(s.characterIds), locationIds: ids(s.locationIds) })),
        lore: loreRows,
        anchored,
        characters: characterRows,
        locations: locationRows,
        factions: factionRows,
        powers: powerRows,
        loreGroups: groupRows,
    }
}

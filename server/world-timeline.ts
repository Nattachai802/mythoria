"use server"

import { db } from "@/db/drizzle"
import {
    novels, chapters, eras, timelineEvents, locationConnections, loreEntries, loreGroups, characters, locations,
    factions, powers, characterLifeEvents, characterFactions, characterPowers, sceneElementDetails,
} from "@/db/schema"
import { and, asc, eq, inArray, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { STORY_DATE_MIN, STORY_DATE_MAX } from "@/lib/story-date"
import { requireNovelAccess } from "@/lib/authz"
import { createLoreEntry } from "@/server/lore"
import { getConsistencyIssues, type ConsistencyIssue } from "@/server/consistency-guardian"
import { detectTimelineConflicts, type TimelineConflict } from "@/server/timeline-conflicts"
import { buildTravelMap } from "@/lib/travel-map"
import { checkWorldConsistency, travelToDays, RULE_LABEL, type CsAppearance, type Finding } from "@/lib/world-consistency"
import type { WorldTimelineInput, TlAnchored, TlPrecision } from "@/lib/world-timeline"
import {
    normalizeCalendar, dayOf, fromDay, eraForYear, sceneDay, TIME_PRECISIONS,
    type WorldCalendar, type EraYear, type TimePrecision,
} from "@/lib/world-calendar"

export interface WorldTimelineData {
    input: WorldTimelineInput
    calendar: WorldCalendar
    eraYears: EraYear[]
}

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

/**
 * ข้อมูลดิบของหน้าเส้นเวลา (เฟส 1 อ่านอย่างเดียว) — แปลงเป็นแกนด้วย buildWorldTimeline() ใน lib/world-timeline.ts
 * ทุก query scope ด้วย novelId · ตารางที่ไม่มี novelId (character_factions/powers) scope ผ่าน characters
 */
export async function getWorldTimelineData(novelId: string): Promise<WorldTimelineData> {
    await requireNovelAccess(novelId)

    const [
        [novelRow],
        chapterRows, eraRows, sceneRows, loreRows, groupRows, characterRows, locationRows,
        factionRows, powerRows, lifeRows, factionLinkRows, powerLinkRows,
    ] = await Promise.all([
        db.select({ worldCalendar: novels.worldCalendar }).from(novels).where(eq(novels.id, novelId)),
        db.select({ id: chapters.id, title: chapters.title, orderIndex: chapters.orderIndex })
            .from(chapters).where(and(eq(chapters.novelId, novelId), isNull(chapters.deletedAt))).orderBy(asc(chapters.orderIndex)),
        db.select({ id: eras.id, name: eras.name, color: eras.color, orderIndex: eras.orderIndex, startYear: eras.startYear })
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
            worldTime: loreEntries.worldTime, worldTimePrecision: loreEntries.worldTimePrecision,
            relatedCharacterIds: loreEntries.relatedCharacterIds, relatedLocationIds: loreEntries.relatedLocationIds,
            sceneIds: loreEntries.sceneIds,
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

    const calendar = normalizeCalendar(novelRow?.worldCalendar)
    const eraYears: EraYear[] = eraRows.map((e) => ({ id: e.id, name: e.name, startYear: e.startYear }))
    // ไม่ได้ผูกยุคไว้แต่มีเวลา → อนุมานยุคจากปี (ยุคที่ startYear ครอบปีนั้น)
    const eraFromDay = (day: number | null) => (day == null ? null : eraForYear(eraYears, fromDay(calendar, day).year)?.id ?? null)
    const precisionOf = (p: string | null): TlPrecision => ((TIME_PRECISIONS as readonly string[]).includes(p ?? "") ? (p as TlPrecision) : "year")

    const input: WorldTimelineInput = {
        chapters: chapterRows,
        eras: eraRows,
        scenes: sceneRows.map((s) => {
            const day = sceneDay(calendar, s.storyDate)
            return { ...s, day, eraId: s.eraId ?? eraFromDay(day), characterIds: ids(s.characterIds), locationIds: ids(s.locationIds) }
        }),
        lore: loreRows.map((l) => ({
            id: l.id, title: l.title, orderInEra: l.orderInEra, groupId: l.groupId, locationId: l.locationId,
            day: l.worldTime, precision: l.worldTime != null ? precisionOf(l.worldTimePrecision) : null,
            eraId: l.eraId ?? eraFromDay(l.worldTime),
            characterIds: ids(l.relatedCharacterIds), locationIds: ids(l.relatedLocationIds), sceneIds: ids(l.sceneIds),
        })),
        anchored,
        characters: characterRows,
        locations: locationRows,
        factions: factionRows,
        powers: powerRows,
        loreGroups: groupRows,
    }
    return { input, calendar, eraYears }
}

const revalidateTimeline = (novelId: string) => revalidatePath(`/dashboard/project/${novelId}/timeline`)

/** บันทึกปฏิทิน + ปีเริ่มของแต่ละยุค ในคราวเดียว (หน้าตั้งค่าปฏิทินแก้ทั้งสองอย่างพร้อมกัน) */
export async function saveWorldCalendar(
    novelId: string,
    calendar: WorldCalendar,
    eraStartYears: Record<string, number | null>,
): Promise<{ success: boolean; error?: string }> {
    try {
        await requireNovelAccess(novelId)
        const clean = normalizeCalendar(calendar)
        const owned = new Set(
            (await db.select({ id: eras.id }).from(eras).where(eq(eras.novelId, novelId))).map((e) => e.id),
        )
        await db.update(novels).set({ worldCalendar: clean }).where(eq(novels.id, novelId))
        for (const [eraId, year] of Object.entries(eraStartYears)) {
            if (!owned.has(eraId)) continue // id ยุคของนิยายอื่น — ข้าม ห้ามเขียนข้ามนิยาย
            const startYear = year == null || !Number.isFinite(year) ? null : Math.trunc(year)
            await db.update(eras).set({ startYear }).where(eq(eras.id, eraId))
        }
        revalidateTimeline(novelId)
        return { success: true }
    } catch (e) {
        console.error("[world-timeline] saveWorldCalendar:", e)
        return { success: false, error: "บันทึกปฏิทินไม่สำเร็จ" }
    }
}

export interface LoreTimeInput {
    /** ปีสัมบูรณ์ */
    year: number
    month?: number
    day?: number
    precision: TimePrecision
    /** ปีสิ้นสุด (เหตุการณ์เป็นช่วง) */
    endYear?: number | null
}

/** ตั้ง/ล้างเวลาในโลกของ lore · null = ล้าง (กลับไปใช้ยุค + ลำดับในยุคเหมือนเดิม) */
export async function setLoreWorldTime(loreId: string, time: LoreTimeInput | null): Promise<{ success: boolean; error?: string }> {
    try {
        const [row] = await db.select({ novelId: loreEntries.novelId }).from(loreEntries).where(eq(loreEntries.id, loreId))
        if (!row) return { success: false, error: "ไม่พบ lore นี้" }
        await requireNovelAccess(row.novelId)

        if (!time) {
            await db.update(loreEntries)
                .set({ worldTime: null, worldTimeEnd: null, worldTimePrecision: null })
                .where(eq(loreEntries.id, loreId))
        } else {
            if (!Number.isFinite(time.year)) return { success: false, error: "ปีไม่ถูกต้อง" }
            const precision: TimePrecision = (TIME_PRECISIONS as readonly string[]).includes(time.precision) ? time.precision : "year"
            const [novelRow] = await db.select({ worldCalendar: novels.worldCalendar }).from(novels).where(eq(novels.id, row.novelId))
            const cal = normalizeCalendar(novelRow?.worldCalendar)
            const start = dayOf(cal, time.year, precision === "year" ? 1 : time.month ?? 1, precision === "day" ? time.day ?? 1 : 1)
            const end = time.endYear != null && Number.isFinite(time.endYear) && time.endYear >= time.year
                ? dayOf(cal, time.endYear, 1, 1)
                : null
            await db.update(loreEntries)
                .set({ worldTime: start, worldTimeEnd: end, worldTimePrecision: precision })
                .where(eq(loreEntries.id, loreId))
        }
        revalidateTimeline(row.novelId)
        return { success: true }
    } catch (e) {
        console.error("[world-timeline] setLoreWorldTime:", e)
        return { success: false, error: "บันทึกเวลาไม่สำเร็จ" }
    }
}

/** ช่องปลายทางของการลาก: ยุค + เลขวัน (null = ช่องที่ไม่มีเวลาจริง ย้ายได้แค่ยุค) */
export interface DropTarget { eraId: string | null; day: number | null }

/** ลาก lore ลงช่อง: ได้ยุคของช่อง · ช่องมีเวลา = รับเวลานั้น ช่องไม่มีเวลา = ล้างเวลา (ไปเรียงตามลำดับในยุค) */
export async function moveLoreOnTimeline(loreId: string, target: DropTarget): Promise<{ success: boolean; error?: string }> {
    try {
        const [row] = await db.select({ novelId: loreEntries.novelId, precision: loreEntries.worldTimePrecision })
            .from(loreEntries).where(eq(loreEntries.id, loreId))
        if (!row) return { success: false, error: "ไม่พบ lore นี้" }
        await requireNovelAccess(row.novelId)
        if (target.eraId) {
            const [era] = await db.select({ id: eras.id }).from(eras).where(and(eq(eras.id, target.eraId), eq(eras.novelId, row.novelId)))
            if (!era) return { success: false, error: "ไม่พบยุคนี้" }
        }
        await db.update(loreEntries).set(
            target.day == null
                ? { eraId: target.eraId, worldTime: null, worldTimeEnd: null, worldTimePrecision: null }
                : { eraId: target.eraId, worldTime: Math.trunc(target.day), worldTimeEnd: null, worldTimePrecision: row.precision ?? "year" },
        ).where(eq(loreEntries.id, loreId))
        revalidateTimeline(row.novelId)
        return { success: true }
    } catch (e) {
        console.error("[world-timeline] moveLoreOnTimeline:", e)
        return { success: false, error: "ย้าย lore ไม่สำเร็จ" }
    }
}

/**
 * ลากฉากลงช่อง: ได้ยุคของช่อง · ช่องมีเวลาและผูก Day 1 ไว้แล้ว = แปลงเป็น story_date
 * ช่องไม่มีเวลา = เปลี่ยนแค่ยุค (ไม่ล้าง story_date/storyTimeIndex ของเดิม เพราะกระดานพล็อตใช้อยู่)
 */
export async function moveSceneOnTimeline(sceneId: string, target: DropTarget): Promise<{ success: boolean; error?: string }> {
    try {
        const [row] = await db.select({ novelId: timelineEvents.novelId }).from(timelineEvents).where(eq(timelineEvents.id, sceneId))
        if (!row) return { success: false, error: "ไม่พบฉากนี้" }
        await requireNovelAccess(row.novelId)
        if (target.eraId) {
            const [era] = await db.select({ id: eras.id }).from(eras).where(and(eq(eras.id, target.eraId), eq(eras.novelId, row.novelId)))
            if (!era) return { success: false, error: "ไม่พบยุคนี้" }
        }
        let storyDate: number | undefined
        if (target.day != null) {
            const [novelRow] = await db.select({ worldCalendar: novels.worldCalendar }).from(novels).where(eq(novels.id, row.novelId))
            const cal = normalizeCalendar(novelRow?.worldCalendar)
            if (!cal.anchor) return { success: false, error: "ยังไม่ได้ผูก Day 1 ของฉากกับปฏิทินโลก ตั้งได้ที่ปุ่ม \"ปฏิทินโลก\"" }
            storyDate = Math.trunc(target.day) - dayOf(cal, cal.anchor.year, cal.anchor.month, cal.anchor.day) + 1
            // กระดานพล็อตแสดง story_date เป็นวันที่จริงด้วย Intl ซึ่งรับได้แค่ ±100 ปี (lib/story-date.ts)
            if (storyDate < STORY_DATE_MIN || storyDate > STORY_DATE_MAX) {
                return { success: false, error: "ฉากห่างจาก Day 1 เกิน 100 ปี ย้ายไปช่องนั้นไม่ได้" }
            }
        }
        await db.update(timelineEvents)
            .set({ eraId: target.eraId, ...(storyDate !== undefined ? { storyDate } : {}), updatedAt: new Date() })
            .where(eq(timelineEvents.id, sceneId))
        revalidateTimeline(row.novelId)
        revalidatePath(`/dashboard/project/${row.novelId}/plot`)
        return { success: true }
    } catch (e) {
        console.error("[world-timeline] moveSceneOnTimeline:", e)
        return { success: false, error: "ย้ายฉากไม่สำเร็จ" }
    }
}

/** สร้างเหตุการณ์ในโลก (เก็บเป็น lore ชนิด event) แล้ววางลงช่องที่เลือกถ้ามี */
export async function createWorldEvent(
    novelId: string,
    title: string,
    target: DropTarget | null,
): Promise<{ success: boolean; error?: string }> {
    const name = title.trim()
    if (!name) return { success: false, error: "ตั้งชื่อเหตุการณ์ก่อน" }
    await requireNovelAccess(novelId)
    const res = await createLoreEntry({ novelId, title: name.slice(0, 200), type: "event", eraId: target?.eraId ?? null })
    if (!res.success || !res.data) return { success: false, error: "สร้างเหตุการณ์ไม่สำเร็จ" }
    if (target) return moveLoreOnTimeline(res.data.id, target)
    revalidateTimeline(novelId)
    return { success: true }
}

/**
 * storyline ของเหตุการณ์: ใครเกี่ยวข้อง เกิดที่ไหน และฉากไหนเล่าให้เห็น (ว่าง = นอกจอ)
 * กรอง id ที่ไม่ใช่ของนิยายนี้ทิ้ง — ห้ามผูกข้ามนิยาย
 */
export async function setLoreStoryline(
    loreId: string,
    links: { characterIds: string[]; locationIds: string[]; sceneIds: string[] },
): Promise<{ success: boolean; error?: string }> {
    try {
        const [row] = await db.select({ novelId: loreEntries.novelId }).from(loreEntries).where(eq(loreEntries.id, loreId))
        if (!row) return { success: false, error: "ไม่พบ lore นี้" }
        await requireNovelAccess(row.novelId)
        const [chars, locs, scenes] = await Promise.all([
            db.select({ id: characters.id }).from(characters).where(eq(characters.novelId, row.novelId)),
            db.select({ id: locations.id }).from(locations).where(eq(locations.novelId, row.novelId)),
            db.select({ id: timelineEvents.id }).from(timelineEvents).where(eq(timelineEvents.novelId, row.novelId)),
        ])
        const keep = (want: string[], have: { id: string }[]) => {
            const ok = new Set(have.map((h) => h.id))
            return [...new Set(want)].filter((id) => ok.has(id))
        }
        await db.update(loreEntries).set({
            relatedCharacterIds: keep(links.characterIds, chars),
            relatedLocationIds: keep(links.locationIds, locs),
            sceneIds: keep(links.sceneIds, scenes),
        }).where(eq(loreEntries.id, loreId))
        revalidateTimeline(row.novelId)
        return { success: true }
    } catch (e) {
        console.error("[world-timeline] setLoreStoryline:", e)
        return { success: false, error: "บันทึกผู้เกี่ยวข้องไม่สำเร็จ" }
    }
}

export interface TreatmentReport {
    findings: Finding[]
    /** ตัวตรวจไหนรันไม่สำเร็จ — แสดงให้ผู้ใช้รู้ ไม่ปล่อยให้คิดว่าไม่มีปัญหา */
    failed: string[]
}

/**
 * Treatment: รวมผลตรวจความสมเหตุสมผลทุกตัวไว้ที่เดียว (กดตรวจเอง ไม่ใช้ AI)
 * - กฎบนแกนเวลาโลก (lib/world-consistency.ts)
 * - Consistency Guardian เดิม (ตายแล้วยังปรากฏ ระดับบท)
 * - timeline conflicts เดิม (เดินทางไม่ทัน จากสถานะตัวละครในตอน)
 */
export async function getTreatmentReport(novelId: string): Promise<TreatmentReport> {
    await requireNovelAccess(novelId)
    const failed: string[] = []

    const [data, loreEraRows, connRows, guardian, conflicts, elementRows, grantRows] = await Promise.all([
        getWorldTimelineData(novelId),
        db.select({ id: loreEntries.id, eraId: loreEntries.eraId }).from(loreEntries).where(eq(loreEntries.novelId, novelId)),
        db.select({
            sourceLocationId: locationConnections.sourceLocationId, targetLocationId: locationConnections.targetLocationId,
            isBidirectional: locationConnections.isBidirectional, travelTime: locationConnections.travelTime,
            travelTimeUnit: locationConnections.travelTimeUnit, travelMethod: locationConnections.travelMethod,
        }).from(locationConnections)
            .innerJoin(locations, eq(locationConnections.sourceLocationId, locations.id))
            .where(eq(locations.novelId, novelId)),
        getConsistencyIssues(novelId).catch(() => ({ success: false, issues: [] as ConsistencyIssue[] })),
        detectTimelineConflicts(novelId).catch(() => ({ success: false, conflicts: [] as TimelineConflict[] })),
        db.select({ sceneId: sceneElementDetails.sceneId, type: sceneElementDetails.elementType, id: sceneElementDetails.elementId })
            .from(sceneElementDetails)
            .where(and(eq(sceneElementDetails.novelId, novelId), inArray(sceneElementDetails.elementType, ["power", "character"]))),
        db.select({ characterId: characterPowers.characterId, powerId: characterPowers.powerId, chapterId: characterPowers.startChapterId })
            .from(characterPowers)
            .innerJoin(characters, eq(characterPowers.characterId, characters.id))
            .where(eq(characters.novelId, novelId)),
    ])
    const { input, calendar, eraYears } = data

    const sceneRef = (id: string, title: string) => ({ kind: "scene" as const, id, title })
    const loreRef = (id: string, title: string) => ({ kind: "lore" as const, id, title })

    const appearances: CsAppearance[] = []
    for (const s of input.scenes) {
        if (s.day == null) continue
        for (const cid of new Set([...s.characterIds, ...(s.povCharacterId ? [s.povCharacterId] : [])])) {
            appearances.push({ characterId: cid, day: s.day, locationIds: s.locationIds, ref: sceneRef(s.id, s.title) })
        }
    }
    for (const l of input.lore) {
        if (l.day == null || l.precision !== "day") continue // รู้แค่ปี/เดือน = เทียบวันกับใครไม่ได้
        const locIds = [...new Set([...(l.locationId ? [l.locationId] : []), ...l.locationIds])]
        for (const cid of new Set(l.characterIds)) {
            appearances.push({ characterId: cid, day: l.day, locationIds: locIds, ref: loreRef(l.id, l.title) })
        }
    }

    const sceneById = new Map(input.scenes.map((s) => [s.id, s]))
    const sceneLinks = input.lore.flatMap((l) => l.sceneIds.flatMap((sid) => {
        const s = sceneById.get(sid)
        return s ? [{ scene: sceneRef(s.id, s.title), sceneDay: s.day, lore: loreRef(l.id, l.title), loreDay: l.day }] : []
    }))

    const explicitEra = new Map(loreEraRows.map((r) => [r.id, r.eraId]))
    const eraName = (id: string | null | undefined) => {
        const e = id ? eraYears.find((x) => x.id === id) : undefined
        return e ? { id: e.id, name: e.name } : null
    }
    const loreEras = input.lore.filter((l) => l.day != null).map((l) => ({
        lore: loreRef(l.id, l.title),
        setEra: eraName(explicitEra.get(l.id)),
        timeEra: eraName(eraForYear(eraYears, fromDay(calendar, l.day!).year)?.id),
    }))

    const travelDays: Record<string, number> = {}
    for (const [key, info] of buildTravelMap(connRows)) {
        const days = travelToDays(info.travelTime, info.travelTimeUnit)
        if (days != null) travelDays[key.replace(">", "|")] = days
    }

    // ใช้พลังก่อนได้มา — เทียบด้วยลำดับบท (ฉากที่ไม่ผูกบท / พลังที่ไม่ระบุบทที่ได้ = ข้าม)
    const chapterOrder = new Map(input.chapters.map((c) => [c.id, c.orderIndex]))
    const powerGrants = grantRows.flatMap((g) => {
        const o = g.chapterId ? chapterOrder.get(g.chapterId) : undefined
        return o == null ? [] : [{ characterId: g.characterId, powerId: g.powerId, chapterOrder: o }]
    })
    const elementsByScene = new Map<string, { powers: Set<string>; chars: Set<string> }>()
    for (const r of elementRows) {
        const e = elementsByScene.get(r.sceneId) ?? { powers: new Set<string>(), chars: new Set<string>() }
        ;(r.type === "power" ? e.powers : e.chars).add(r.id)
        elementsByScene.set(r.sceneId, e)
    }
    const scenePowers = input.scenes.flatMap((s) => {
        const e = elementsByScene.get(s.id)
        const o = s.chapterId ? chapterOrder.get(s.chapterId) : undefined
        if (!e?.powers.size || o == null) return []
        const chars = new Set([...s.characterIds, ...e.chars, ...(s.povCharacterId ? [s.povCharacterId] : [])])
        return [{ scene: sceneRef(s.id, s.title), chapterOrder: o, characterIds: [...chars], powerIds: [...e.powers] }]
    })

    const findings = checkWorldConsistency({
        characters: input.characters, locations: input.locations, appearances, sceneLinks, loreEras, travelDays,
        powerGrants, scenePowers, powers: input.powers,
    })

    if (guardian.success) {
        for (const i of guardian.issues) {
            findings.push({
                id: `guardian:${i.id}`, rule: "dead-reappears", severity: i.severity, message: i.message,
                refs: [
                    { kind: "character", id: i.characterId, title: i.characterName },
                    { kind: "chapter", id: i.appearChapter.id, title: i.appearChapter.title },
                ],
            })
        }
    } else failed.push(RULE_LABEL["dead-reappears"])

    if (conflicts.success) {
        conflicts.conflicts.forEach((c, n) => findings.push({
            id: `states:${c.characterId}:${n}`, rule: "travel-states", severity: c.severity, message: c.message,
            refs: [{ kind: "character", id: c.characterId, title: c.characterName }],
        }))
    } else failed.push(RULE_LABEL["travel-states"])

    findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1))
    return { findings, failed }
}

/**
 * เส้นเวลาโลก — จัดของจากทุกหมวดลงแกนเดียว (pure ไม่แตะ DB ไม่แตะ React)
 * ------------------------------------------------------------------------
 * แผนเต็มอยู่ที่ docs/treatment-timeline-plan.md
 *
 * แกนเป็น "ช่องตามลำดับ" (ไม่ใช่สเกลเวลา) แต่ละช่องพกเวลาจริงติดไปด้วยถ้ามี:
 *   ยุค (ตาม eras.orderIndex) → ในยุค:
 *     1. lore ที่ยังไม่มีเวลา (ตาม orderInEra)
 *     2. ของที่มีเวลาจริง (lore + ฉาก) เรียงตามเลขวัน
 *     3. ฉากที่ยังไม่มีเวลาจริง (ตาม storyTimeIndex → storyDate → ลำดับเล่า)
 *   → ท้ายสุดของที่ไม่ระบุยุค
 * ponytail: ของที่ไม่มีเวลาไม่รู้ว่าเกิดก่อนหรือหลังของที่มีเวลา เลยวาง lore ไว้หัวยุค ฉากไว้ท้ายยุค
 * เลขวัน/ยุคที่อนุมานจากเวลา คำนวณมาจากฝั่ง server (lib/world-calendar.ts) ไฟล์นี้ไม่ import อะไรเลย
 * (ตัวรัน check resolve relative import แบบไม่ใส่นามสกุลไม่ได้ ดู task.md 9e)
 *
 * ของที่ผูกกับ "บท" (life event, เข้ากลุ่ม, ได้พลัง) ไม่มีเวลาในโลก
 * วางที่ช่องของฉากแรกในบทนั้นแล้วติด approx — บทที่ยังไม่มีฉากบนแกน = ไปถาดยังไม่ระบุเวลา
 */

export type LaneKind = "plot" | "lore" | "characters" | "factions" | "powers" | "locations" | "items";
export type ItemKind = "scene" | "lore" | "appear" | "event" | "life" | "faction" | "power";

export interface TlChapter { id: string; title: string; orderIndex: number }
export interface TlEra { id: string; name: string; color: string | null; orderIndex: number | null }
export type TlPrecision = "year" | "month" | "day";
export interface TlNamed { id: string; name: string }

export interface TlScene {
    id: string;
    title: string;
    chapterId: string | null;
    orderIndex: number;
    storyTimeIndex: number | null;
    storyDate: number | null;
    eraId: string | null;
    /** เลขวันในโลก (มีเมื่อผูก anchor ของปฏิทินและตั้ง storyDate) */
    day: number | null;
    eventType: string | null;
    characterIds: string[];
    locationIds: string[];
    povCharacterId: string | null;
}

export interface TlLore {
    id: string;
    title: string;
    eraId: string | null;
    orderInEra: number | null;
    day: number | null;
    precision: TlPrecision | null;
    groupId: string | null;
    locationId: string | null;
    /** ผู้เกี่ยวข้อง (lore.related_character_ids) — โผล่เป็นเหตุการณ์ในเลนตัวละคร */
    characterIds: string[];
    /** สถานที่เพิ่มเติม (lore.related_location_ids) นอกจาก locationId */
    locationIds: string[];
    /** ฉากที่เล่าเหตุการณ์นี้ — ว่าง = เกิดนอกจอ */
    sceneIds: string[];
}

/** ของที่ผูกกับบท — life event / เข้ากลุ่ม / ได้พลัง */
export interface TlAnchored {
    id: string;
    kind: "life" | "faction" | "power";
    title: string;
    chapterId: string | null;
    /** id ของเลนย่อย: ตัวละคร (life) / กลุ่ม (faction) / พลัง (power) */
    subLaneId: string;
}

export interface WorldTimelineInput {
    chapters: TlChapter[];
    eras: TlEra[];
    scenes: TlScene[];
    lore: TlLore[];
    anchored: TlAnchored[];
    characters: TlNamed[];
    locations: TlNamed[];
    factions: TlNamed[];
    powers: TlNamed[];
    loreGroups: TlNamed[];
}

export interface TlColumn {
    eraId: string | null;
    /** เลขวันในโลก — มีเมื่อของในช่องมีเวลาจริง · UI แปลงเป็นป้ายด้วยปฏิทิน */
    day: number | null;
    precision: TlPrecision | null;
    /** ช่องฉากที่มีแค่ storyDate (ยังไม่ผูก anchor) — UI แสดงเป็น Day N */
    storyDate: number | null;
}

export interface TlSegment { eraId: string | null; name: string; color: string | null; start: number; end: number }

export interface TlItem {
    id: string;
    kind: ItemKind;
    title: string;
    col: number;
    /** ตำแหน่งประมาณ (อนุมานจากบท ไม่ใช่เวลาจริง) */
    approx?: boolean;
    /** ฉากที่ถูกเล่าหลังฉากที่เกิดทีหลังมัน */
    flashback?: boolean;
    /** เหตุการณ์ที่ไม่มีฉากไหนเล่า (เกิดนอกจอ) */
    offscreen?: boolean;
    /** id ของต้นทาง (ฉาก/lore) เผื่อ UI ทำลิงก์ */
    sourceId: string;
}

export interface TlSubLane { id: string; label: string; items: TlItem[] }
export interface TlLane { kind: LaneKind; label: string; subLanes: TlSubLane[]; emptyText: string }
export interface TlUnplaced { id: string; kind: ItemKind; title: string; reason: string }

export interface WorldTimeline {
    columns: TlColumn[];
    segments: TlSegment[];
    lanes: TlLane[];
    unplaced: TlUnplaced[];
}

export const NO_ERA_LABEL = "ไม่ระบุยุค";

const LANE_LABEL: Record<LaneKind, string> = {
    plot: "โครงเรื่อง",
    lore: "Lore",
    characters: "ตัวละคร",
    factions: "กลุ่มอำนาจ",
    powers: "ระบบพลัง",
    locations: "สถานที่",
    items: "ไอเทม",
};

const LANE_EMPTY: Record<LaneKind, string> = {
    plot: "ยังไม่มีฉากที่ระบุเวลาหรือยุค",
    lore: "ยังไม่มี lore ที่ผูกกับยุค",
    characters: "ยังไม่มีตัวละครในฉากหรือเหตุการณ์ชีวิตที่ผูกกับบท",
    factions: "ยังไม่มีการเข้ากลุ่มที่ผูกกับบท",
    powers: "ยังไม่มีการได้พลังที่ผูกกับบท",
    locations: "ยังไม่มีฉากหรือ lore ที่ผูกกับสถานที่",
    items: "ไอเทมยังไม่มีข้อมูลเวลา",
};

const INF = Number.POSITIVE_INFINITY;

/** ลำดับเล่า: บทตาม orderIndex → ฉากในบทตาม orderIndex → ฉากไม่ผูกบทต่อท้าย (เหมือน chrono sheet) */
export function narrativeOrder(scenes: TlScene[], chapters: TlChapter[]): Map<string, number> {
    const m = new Map<string, number>();
    let n = 1;
    for (const ch of [...chapters].sort((a, b) => a.orderIndex - b.orderIndex)) {
        scenes
            .filter((s) => s.chapterId === ch.id)
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .forEach((s) => m.set(s.id, n++));
    }
    scenes
        .filter((s) => !m.has(s.id))
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .forEach((s) => m.set(s.id, n++));
    return m;
}

export function buildWorldTimeline(input: WorldTimelineInput): WorldTimeline {
    const columns: TlColumn[] = [];
    const segments: TlSegment[] = [];
    const unplaced: TlUnplaced[] = [];
    const sceneCol = new Map<string, number>();
    const loreCol = new Map<string, number>();
    const narr = narrativeOrder(input.scenes, input.chapters);

    const knownEra = new Set(input.eras.map((e) => e.id));
    const eraOf = (id: string | null) => (id && knownEra.has(id) ? id : null);

    const isPlaced = (s: TlScene) => s.storyTimeIndex != null || s.storyDate != null || s.day != null || eraOf(s.eraId) != null;
    const sceneKey = (s: TlScene): [number, number, number] =>
        [s.storyTimeIndex ?? INF, s.storyDate ?? INF, narr.get(s.id) ?? INF];
    const byKey = (a: TlScene, b: TlScene) => {
        const ka = sceneKey(a), kb = sceneKey(b);
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    };

    type Slot = { lore: TlLore } | { scene: TlScene };
    const pushSegment = (eraId: string | null, name: string, color: string | null, lore: TlLore[], scenes: TlScene[]) => {
        if (lore.length === 0 && scenes.length === 0) return;
        const timed: Slot[] = [
            ...lore.filter((l) => l.day != null).map((l) => ({ lore: l })),
            ...scenes.filter((s) => s.day != null).map((s) => ({ scene: s })),
        ].sort((a, b) => {
            const da = "lore" in a ? a.lore.day! : a.scene.day!;
            const db = "lore" in b ? b.lore.day! : b.scene.day!;
            if (da !== db) return da - db;
            if ("lore" in a !== "lore" in b) return "lore" in a ? -1 : 1; // วันเดียวกัน: lore ก่อน
            return "scene" in a && "scene" in b ? byKey(a.scene, b.scene) : 0;
        });
        const slots: Slot[] = [
            ...lore.filter((l) => l.day == null).sort((a, b) => (a.orderInEra ?? 0) - (b.orderInEra ?? 0)).map((l) => ({ lore: l })),
            ...timed,
            ...scenes.filter((s) => s.day == null).sort(byKey).map((s) => ({ scene: s })),
        ];
        const start = columns.length;
        for (const slot of slots) {
            if ("lore" in slot) {
                loreCol.set(slot.lore.id, columns.length);
                columns.push({ eraId, day: slot.lore.day, precision: slot.lore.day != null ? slot.lore.precision ?? "year" : null, storyDate: null });
            } else {
                sceneCol.set(slot.scene.id, columns.length);
                columns.push({ eraId, day: slot.scene.day, precision: slot.scene.day != null ? "day" : null, storyDate: slot.scene.storyDate });
            }
        }
        segments.push({ eraId, name, color, start, end: columns.length - 1 });
    };

    for (const era of [...input.eras].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))) {
        const lore = input.lore.filter((l) => l.eraId === era.id);
        const scenes = input.scenes.filter((s) => isPlaced(s) && eraOf(s.eraId) === era.id);
        pushSegment(era.id, era.name, era.color, lore, scenes);
    }
    pushSegment(
        null, NO_ERA_LABEL, null,
        input.lore.filter((l) => eraOf(l.eraId) == null && l.day != null),
        input.scenes.filter((s) => isPlaced(s) && eraOf(s.eraId) == null),
    );

    // flashback: มีฉากที่อยู่หลังบนแกนแต่ถูกเล่าก่อน → ฉากนี้คือการเล่าย้อน
    const flashback = new Set<string>();
    const placedScenes = input.scenes.filter((s) => sceneCol.has(s.id)).sort((a, b) => sceneCol.get(a.id)! - sceneCol.get(b.id)!);
    let minLater = INF;
    for (let i = placedScenes.length - 1; i >= 0; i--) {
        const s = placedScenes[i];
        const n = narr.get(s.id) ?? INF;
        if (n > minLater || s.eventType === "flashback") flashback.add(s.id);
        minLater = Math.min(minLater, n);
    }

    for (const s of input.scenes) {
        if (!sceneCol.has(s.id)) unplaced.push({ id: s.id, kind: "scene", title: s.title, reason: "ยังไม่ระบุเวลาหรือยุค" });
    }
    for (const l of input.lore) {
        if (!loreCol.has(l.id)) unplaced.push({ id: l.id, kind: "lore", title: l.title, reason: "ยังไม่ระบุเวลาหรือยุค" });
    }

    // ช่องแรกของแต่ละบท — ใช้วางของที่ผูกกับบท
    const chapterCol = new Map<string, number>();
    for (const s of input.scenes) {
        const c = sceneCol.get(s.id);
        if (c == null || !s.chapterId) continue;
        const prev = chapterCol.get(s.chapterId);
        if (prev == null || c < prev) chapterCol.set(s.chapterId, c);
    }
    // บทที่ไม่มีฉากบนแกน: ยืมช่องของบทถัดไปที่มีฉาก (ไม่มีก็บทก่อนหน้า) — ยังติด approx อยู่
    const chapterSorted = [...input.chapters].sort((a, b) => a.orderIndex - b.orderIndex);
    const colForChapter = (id: string): number | undefined => {
        if (chapterCol.has(id)) return chapterCol.get(id);
        const i = chapterSorted.findIndex((c) => c.id === id);
        if (i < 0) return undefined;
        for (let j = i + 1; j < chapterSorted.length; j++) if (chapterCol.has(chapterSorted[j].id)) return chapterCol.get(chapterSorted[j].id);
        for (let j = i - 1; j >= 0; j--) if (chapterCol.has(chapterSorted[j].id)) return chapterCol.get(chapterSorted[j].id);
        return undefined;
    };

    // ── เลน ──
    const sub = new Map<LaneKind, Map<string, TlSubLane>>();
    const add = (kind: LaneKind, subId: string, label: string, item: TlItem) => {
        let lane = sub.get(kind);
        if (!lane) sub.set(kind, (lane = new Map()));
        let sl = lane.get(subId);
        if (!sl) lane.set(subId, (sl = { id: subId, label, items: [] }));
        sl.items.push(item);
    };
    const name = (list: TlNamed[], id: string, fallback: string) => list.find((x) => x.id === id)?.name ?? fallback;
    const chapterTitle = (id: string | null) => (id ? name(input.chapters.map((c) => ({ id: c.id, name: c.title })), id, "บทที่ถูกลบ") : "ไม่ผูกบท");

    for (const s of input.scenes) {
        const col = sceneCol.get(s.id);
        if (col == null) continue;
        add("plot", s.chapterId ?? "_none", chapterTitle(s.chapterId), {
            id: `scene:${s.id}`, kind: "scene", title: s.title, col, flashback: flashback.has(s.id), sourceId: s.id,
        });
        const cast = new Set([...s.characterIds, ...(s.povCharacterId ? [s.povCharacterId] : [])]);
        for (const cid of cast) {
            if (!input.characters.some((c) => c.id === cid)) continue;
            add("characters", cid, name(input.characters, cid, ""), {
                id: `appear:${s.id}:${cid}`, kind: "appear", title: s.title, col, sourceId: s.id,
            });
        }
        for (const lid of new Set(s.locationIds)) {
            if (!input.locations.some((l) => l.id === lid)) continue;
            add("locations", lid, name(input.locations, lid, ""), {
                id: `appear:${s.id}:${lid}`, kind: "appear", title: s.title, col, sourceId: s.id,
            });
        }
    }

    for (const l of input.lore) {
        const col = loreCol.get(l.id);
        if (col == null) continue;
        const gid = l.groupId && input.loreGroups.some((g) => g.id === l.groupId) ? l.groupId : "_none";
        add("lore", gid, gid === "_none" ? "ไม่มีกลุ่ม" : name(input.loreGroups, gid, ""), {
            id: `lore:${l.id}`, kind: "lore", title: l.title, col, sourceId: l.id,
        });
        const offscreen = l.sceneIds.length === 0;
        for (const lid of new Set([...(l.locationId ? [l.locationId] : []), ...l.locationIds])) {
            if (!input.locations.some((x) => x.id === lid)) continue;
            add("locations", lid, name(input.locations, lid, ""), {
                id: `lore:${l.id}:loc:${lid}`, kind: "event", title: l.title, col, offscreen, sourceId: l.id,
            });
        }
        // storyline: เหตุการณ์ที่ตัวละครเกี่ยวข้อง ● ถ้ามีฉากเล่า ○ ถ้าเกิดนอกจอ
        for (const cid of new Set(l.characterIds)) {
            if (!input.characters.some((c) => c.id === cid)) continue;
            add("characters", cid, name(input.characters, cid, ""), {
                id: `lore:${l.id}:char:${cid}`, kind: "event", title: l.title, col, offscreen, sourceId: l.id,
            });
        }
    }

    const anchoredLane = { life: "characters", faction: "factions", power: "powers" } as const;
    const anchoredNames = { life: input.characters, faction: input.factions, power: input.powers };
    for (const a of input.anchored) {
        const col = a.chapterId ? colForChapter(a.chapterId) : undefined;
        if (col == null) {
            unplaced.push({
                id: a.id, kind: a.kind, title: a.title,
                reason: a.chapterId ? "บทนี้ยังไม่มีฉากบนเส้นเวลา" : "ยังไม่ผูกกับบท",
            });
            continue;
        }
        add(anchoredLane[a.kind], a.subLaneId, name(anchoredNames[a.kind], a.subLaneId, ""), {
            id: `${a.kind}:${a.id}`, kind: a.kind, title: a.title, col, approx: true, sourceId: a.id,
        });
    }

    const order: LaneKind[] = ["plot", "lore", "characters", "factions", "powers", "locations", "items"];
    const lanes: TlLane[] = order.map((kind) => {
        const subs = [...(sub.get(kind)?.values() ?? [])];
        for (const sl of subs) sl.items.sort((a, b) => a.col - b.col);
        if (kind === "plot") {
            // เรียงบทตามลำดับเล่า ไม่ใช่ตามตำแหน่งบนแกน — คนเขียนหาบทจากเลขบท
            const ord = new Map(input.chapters.map((c) => [c.id, c.orderIndex]));
            subs.sort((a, b) => (ord.get(a.id) ?? INF) - (ord.get(b.id) ?? INF));
        } else {
            subs.sort((a, b) => a.items[0].col - b.items[0].col || a.label.localeCompare(b.label, "th"));
        }
        return { kind, label: LANE_LABEL[kind], subLanes: subs, emptyText: LANE_EMPTY[kind] };
    });

    return { columns, segments, lanes, unplaced };
}

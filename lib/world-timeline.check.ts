// Run: node --experimental-strip-types lib/world-timeline.check.ts
import { buildWorldTimeline, type TlScene, type WorldTimelineInput } from "./world-timeline.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const scene = (id: string, p: Partial<TlScene>): TlScene => ({
    id, title: id, chapterId: null, orderIndex: 0, storyTimeIndex: null, storyDate: null,
    eraId: null, day: null, eventType: null, characterIds: [], locationIds: [], povCharacterId: null, ...p,
});

const input: WorldTimelineInput = {
    chapters: [{ id: "ch1", title: "บท 1", orderIndex: 0 }, { id: "ch2", title: "บท 2", orderIndex: 1 }, { id: "ch3", title: "บท 3", orderIndex: 2 }],
    eras: [{ id: "fire", name: "ยุคเพลิง", color: null, orderIndex: 1 }, { id: "old", name: "ยุคแรก", color: null, orderIndex: 0 }],
    scenes: [
        // บท 1 เล่าก่อน แต่เกิดหลังบท 2 → บท 2 คือ flashback
        scene("s1", { chapterId: "ch1", storyTimeIndex: 2, eraId: "fire", characterIds: ["alin"], locationIds: ["castle"] }),
        scene("s2", { chapterId: "ch2", storyTimeIndex: 1, eraId: "fire", povCharacterId: "alin" }),
        scene("s3", { chapterId: "ch3", storyDate: 5 }),           // ไม่มียุค → ช่วงไม่ระบุยุคท้ายสุด
        scene("s4", { chapterId: "ch3", orderIndex: 1 }),         // ไม่มีเวลาเลย → ถาด
    ],
    lore: [
        { id: "war", title: "สงคราม", eraId: "fire", orderInEra: 0, day: null, precision: null, groupId: "g1", locationId: "castle", characterIds: [], locationIds: [], sceneIds: [] },
        { id: "birth", title: "กำเนิดเวทย์", eraId: "old", orderInEra: 0, day: null, precision: null, groupId: null, locationId: null, characterIds: [], locationIds: [], sceneIds: [] },
        { id: "myth", title: "ตำนานลอย", eraId: null, orderInEra: 0, day: null, precision: null, groupId: null, locationId: null, characterIds: [], locationIds: [], sceneIds: [] },
    ],
    anchored: [
        { id: "le1", kind: "life", title: "ตาบอด", chapterId: "ch2", subLaneId: "alin" },
        { id: "fj1", kind: "faction", title: "อลินเข้ากลุ่ม", chapterId: null, subLaneId: "shadow" },
        { id: "pw1", kind: "power", title: "ได้ไฟ", chapterId: "ch3", subLaneId: "fireP" },
    ],
    characters: [{ id: "alin", name: "อลิน" }],
    locations: [{ id: "castle", name: "ปราสาท" }],
    factions: [{ id: "shadow", name: "กลุ่มเงา" }],
    powers: [{ id: "fireP", name: "ไฟ" }],
    loreGroups: [{ id: "g1", name: "สงคราม" }],
};

const t = buildWorldTimeline(input);
const lane = (k: string) => t.lanes.find((l) => l.kind === k)!;
const colOf = (k: string, id: string) => lane(k).subLanes.flatMap((s) => s.items).find((i) => i.id === id)?.col;

assert(t.segments.map((s) => s.name).join(",") === "ยุคแรก,ยุคเพลิง,ไม่ระบุยุค", "ยุคเรียงตาม orderIndex แล้วต่อด้วยช่วงไม่ระบุยุค");
assert(colOf("lore", "lore:birth") === 0, "lore ยุคแรกอยู่ช่องแรก");
assert(colOf("lore", "lore:war")! < colOf("plot", "scene:s2")!, "ในยุคเดียวกัน lore มาก่อนฉาก");
assert(colOf("plot", "scene:s2")! < colOf("plot", "scene:s1")!, "ฉากเรียงตาม storyTimeIndex ไม่ใช่ลำดับเล่า");
assert(colOf("plot", "scene:s3")! > colOf("plot", "scene:s1")!, "ฉากไม่มียุคไปท้ายแกน");

const items = lane("plot").subLanes.flatMap((s) => s.items);
assert(items.find((i) => i.id === "scene:s2")!.flashback === true, "บท 2 เกิดก่อนแต่เล่าทีหลัง = flashback");
assert(!items.find((i) => i.id === "scene:s1")!.flashback, "บท 1 ไม่ใช่ flashback");
assert(lane("plot").subLanes.map((s) => s.label).join(",") === "บท 1,บท 2,บท 3", "เลนย่อยโครงเรื่องเรียงตามบท");

const alin = lane("characters").subLanes.find((s) => s.id === "alin")!;
assert(alin.items.filter((i) => i.kind === "appear").length === 2, "อลินปรากฏ 2 ฉาก (cast + POV)");
const life = alin.items.find((i) => i.kind === "life")!;
assert(life.col === colOf("plot", "scene:s2") && life.approx === true, "life event วางที่ฉากแรกของบท + ติด approx");
assert(colOf("powers", "power:pw1") === colOf("plot", "scene:s3"), "ได้พลังวางที่ฉากแรกของบท 3");
assert(colOf("locations", "lore:war:loc:castle") === colOf("lore", "lore:war"), "lore ระดับสถานที่โผล่ในเลนสถานที่");

const unplaced = new Set(t.unplaced.map((u) => u.id));
assert(unplaced.has("s4") && unplaced.has("myth") && unplaced.has("fj1"), "ของที่ไม่มีเวลา/ยุค/บท ไปถาด");
assert(lane("items").subLanes.length === 0 && lane("items").emptyText.length > 0, "หมวดว่างยังอยู่พร้อมข้อความ");

const empty = buildWorldTimeline({ ...input, eras: [], scenes: [], lore: [], anchored: [] });
assert(empty.columns.length === 0 && empty.lanes.length === 7, "นิยายว่าง: ไม่มีช่อง แต่ยังมีครบ 7 หมวด");

// ── เฟส 2: เวลาจริง ──
const timed = buildWorldTimeline({
    ...input,
    scenes: [
        scene("a", { chapterId: "ch1", eraId: "fire", day: 500 }),
        scene("b", { chapterId: "ch2", eraId: "fire", day: 100 }),
        scene("c", { chapterId: "ch3", eraId: "fire", storyTimeIndex: 1 }),   // ไม่มีเวลาจริง → ท้ายยุค
    ],
    lore: [
        { id: "mid", title: "กลางเรื่อง", eraId: "fire", orderInEra: 0, day: 300, precision: "year", groupId: null, locationId: null, characterIds: [], locationIds: [], sceneIds: [] },
        { id: "head", title: "ไม่มีเวลา", eraId: "fire", orderInEra: 0, day: null, precision: null, groupId: null, locationId: null, characterIds: [], locationIds: [], sceneIds: [] },
        { id: "same", title: "วันเดียวกับ b", eraId: "fire", orderInEra: 0, day: 100, precision: "day", groupId: null, locationId: null, characterIds: [], locationIds: [], sceneIds: [] },
    ],
    anchored: [],
});
const order = timed.lanes.flatMap((l) => l.kind === "plot" || l.kind === "lore" ? l.subLanes.flatMap((s) => s.items) : [])
    .sort((x, y) => x.col - y.col).map((i) => i.sourceId).join(",");
assert(order === "head,same,b,mid,a,c", "ในยุค: lore ไม่มีเวลา → ของมีเวลาเรียงตามวัน (วันเดียวกัน lore ก่อน) → ฉากไม่มีเวลา");
const tb = timed.lanes[0].subLanes.flatMap((s) => s.items).find((i) => i.sourceId === "b")!;
assert(timed.columns[tb.col].day === 100 && timed.columns[tb.col].precision === "day", "ช่องพกเลขวัน + ความละเอียด");
const tm = timed.lanes[1].subLanes.flatMap((s) => s.items).find((i) => i.sourceId === "mid")!;
assert(timed.columns[tm.col].precision === "year", "ช่อง lore ใช้ความละเอียดของ lore");
const flash = timed.lanes[0].subLanes.flatMap((s) => s.items).find((i) => i.sourceId === "b")!;
assert(flash.flashback === true, "บท 2 เกิดวัน 100 ก่อนบท 1 (วัน 500) = เล่าย้อน");

const loose = buildWorldTimeline({ ...input, scenes: [], anchored: [],
    lore: [{ id: "free", title: "มีเวลาแต่ไม่มียุค", eraId: null, orderInEra: 0, day: 5, precision: "year", groupId: null, locationId: null, characterIds: [], locationIds: [], sceneIds: [] }] });
assert(loose.segments.length === 1 && loose.segments[0].name === "ไม่ระบุยุค" && loose.unplaced.length === 0, "lore มีเวลาแต่ไม่มียุค ขึ้นแกนในช่วงไม่ระบุยุค");

// ── เฟส 3: storyline ──
const story = buildWorldTimeline({ ...input, anchored: [],
    lore: [
        { id: "off", title: "ลอบสังหาร", eraId: "fire", orderInEra: 0, day: 10, precision: "day", groupId: null, locationId: null, characterIds: ["alin"], locationIds: ["castle"], sceneIds: [] },
        { id: "on", title: "พิธีราชาภิเษก", eraId: "fire", orderInEra: 0, day: 20, precision: "day", groupId: null, locationId: null, characterIds: ["alin", "ghost"], locationIds: [], sceneIds: ["s1"] },
    ] });
const alinItems = story.lanes.find((l) => l.kind === "characters")!.subLanes.find((s) => s.id === "alin")!.items.filter((i) => i.kind === "event");
assert(alinItems.length === 2, "เหตุการณ์ที่ตัวละครเกี่ยวข้องขึ้นเลนตัวละคร (ตัดคนที่ไม่มีในนิยาย)");
assert(alinItems.find((i) => i.sourceId === "off")!.offscreen === true && !alinItems.find((i) => i.sourceId === "on")!.offscreen, "ไม่มีฉากเล่า = นอกจอ");
assert(story.lanes.find((l) => l.kind === "locations")!.subLanes[0].items.some((i) => i.sourceId === "off"), "สถานที่เพิ่มเติมของเหตุการณ์ขึ้นเลนสถานที่");

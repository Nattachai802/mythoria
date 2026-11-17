// Run: node --experimental-strip-types lib/world-consistency.check.ts
import { checkWorldConsistency, travelToDays, type ConsistencyInput, type CsAppearance } from "./world-consistency.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const app = (id: string, characterId: string, day: number, locationIds: string[]): CsAppearance =>
    ({ characterId, day, locationIds, ref: { kind: "scene", id, title: id } });

const base: ConsistencyInput = {
    characters: [{ id: "alin", name: "อลิน" }, { id: "ken", name: "เคน" }],
    locations: [{ id: "A", name: "เมืองหลวง" }, { id: "B", name: "ป้อมเหนือ" }],
    appearances: [],
    sceneLinks: [],
    loreEras: [],
    travelDays: { "A|B": 3 },
};
const rules = (i: Partial<ConsistencyInput>) => checkWorldConsistency({ ...base, ...i }).map((f) => f.rule);

assert(rules({ appearances: [app("s1", "alin", 10, ["A"]), app("s2", "alin", 10, ["B"])] }).join() === "two-places", "วันเดียวกันสองสถานที่ = error");
assert(rules({ appearances: [app("s1", "alin", 10, ["A"]), app("s2", "alin", 10, ["A", "B"])] }).length === 0, "สถานที่ทับกันบางแห่ง = ไม่เตือน");
assert(rules({ appearances: [app("s1", "alin", 10, ["A"]), app("s2", "alin", 10, [])] }).length === 0, "ไม่ระบุสถานที่ = ไม่เตือน");
assert(rules({ appearances: [app("s1", "alin", 10, ["A"]), app("s2", "ken", 10, ["B"])] }).length === 0, "คนละคน = ไม่เตือน");

assert(rules({ appearances: [app("s1", "alin", 10, ["A"]), app("s2", "alin", 11, ["B"])] }).join() === "travel-too-fast", "1 วันแต่ทางต้องใช้ 3 วัน = เตือน");
assert(rules({ appearances: [app("s1", "alin", 10, ["A"]), app("s2", "alin", 13, ["B"])] }).length === 0, "3 วันพอดี = ไม่เตือน");
assert(rules({ appearances: [app("s1", "alin", 10, ["B"]), app("s2", "alin", 11, ["A"])] }).length === 0, "ทิศที่ไม่มีเส้นเชื่อม = ไม่เดา");

const link = (sceneDay: number | null, loreDay: number | null) => ({
    scene: { kind: "scene" as const, id: "s", title: "ฉาก" }, sceneDay, lore: { kind: "lore" as const, id: "l", title: "พิธี" }, loreDay,
});
assert(rules({ sceneLinks: [link(5, 9)] }).join() === "shown-before-happens", "ฉากวัน 5 เล่าเหตุการณ์วัน 9 = เตือน");
assert(rules({ sceneLinks: [link(9, 5), link(null, 9), link(5, null)] }).length === 0, "ย้อนเล่า/ไม่มีวัน = ไม่เตือน");

const era = (a: string, b: string | null) => ({ lore: { kind: "lore" as const, id: "x", title: "x" }, setEra: { id: a, name: a }, timeEra: b ? { id: b, name: b } : null });
assert(rules({ loreEras: [era("fire", "old")] }).join() === "era-mismatch", "ยุคที่ผูกไม่ตรงกับปี = เตือน");
assert(rules({ loreEras: [era("fire", "fire"), era("fire", null)] }).length === 0, "ยุคตรงหรือไม่รู้ยุคจากปี = ไม่เตือน");

const mixed = checkWorldConsistency({ ...base, sceneLinks: [link(5, 9)], appearances: [app("s1", "alin", 10, ["A"]), app("s2", "alin", 10, ["B"])] });
assert(mixed[0].severity === "error", "error เรียงก่อน warning");

assert(travelToDays(48, "hours") === 2 && travelToDays(2, "weeks") === 14 && travelToDays(3, null) === 0.125, "แปลงหน่วยเดินทางเป็นวัน");
assert(travelToDays(null, "days") === null && travelToDays(3, "ปี") === null, "ไม่มีค่า/หน่วยแปลก = ไม่ใช้");

const sp = (order: number, chars: string[]) => ({ scene: { kind: "scene" as const, id: "s", title: "ฉาก" }, chapterOrder: order, characterIds: chars, powerIds: ["fire"] });
const grants = [{ characterId: "alin", powerId: "fire", chapterOrder: 5 }];
assert(rules({ powerGrants: grants, scenePowers: [sp(2, ["alin"])] }).join() === "power-before-acquired", "ได้พลังบท 5 แต่ฉากบท 2 มีพลัง = เตือน");
assert(rules({ powerGrants: grants, scenePowers: [sp(5, ["alin"]), sp(2, ["ken"])] }).length === 0, "บทเดียวกัน/ไม่มีผู้ถือในฉาก = ไม่เตือน");
assert(rules({ powerGrants: [...grants, { characterId: "ken", powerId: "fire", chapterOrder: 1 }], scenePowers: [sp(2, ["alin", "ken"])] }).length === 0, "มีผู้ถือที่ได้มาแล้วในฉาก = ไม่เตือน");

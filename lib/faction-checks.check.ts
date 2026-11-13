import assert from "node:assert/strict";
import { activeIn, findFactionIssues, statusAt, findDefections } from "./faction-checks.ts";

const order = new Map([["c1", 1], ["c5", 5], ["c10", 10], ["c12", 12], ["c20", 20]]);
const m = (characterId: string, factionId: string, s: string | null, e: string | null) => ({ characterId, factionId, startChapterId: s, endChapterId: e });

// activeIn: เปิดปลาย / ช่วงปิด / ทุกบท
assert.equal(activeIn(m("a", "F", null, null), order, 7), true);
assert.equal(activeIn(m("a", "F", "c10", null), order, 7), false);
assert.equal(activeIn(m("a", "F", "c1", "c5"), order, 5), true);
assert.equal(activeIn(m("a", "F", "c1", "c5"), order, null), true);

const issues = findFactionIssues({
    factions: [{ id: "R", name: "หลวง", leaderId: "lead" }, { id: "B", name: "กบฏ" }, { id: "E", name: "ว่าง" }],
    memberships: [
        m("phop", "R", "c1", "c12"), m("phop", "B", "c10", null),  // ทับ 10–12 กับศัตรู
        m("aru", "R", "c1", "c5"), m("aru", "B", "c10", null),     // ไม่ทับ
        m("x", "B", "c20", "c5"),                                  // กลับด้าน
    ],
    rels: [{ sourceFactionId: "B", targetFactionId: "R", type: "enemy" }],
    chapterOrder: order,
});
const kinds = issues.map((i) => i.kind).sort();
assert.deepEqual(kinds, ["empty", "enemy-overlap", "leader-not-member", "reversed-range"]);
const ov = issues.find((i) => i.kind === "enemy-overlap");
assert.ok(ov && ov.kind === "enemy-overlap" && ov.characterId === "phop" && ov.from === 10 && ov.to === 12);

// ศัตรูเฉพาะช่วง: เป็นศัตรูตั้งแต่บท 15 → ภพ (ทับ 10–12) ไม่เตือน
const late = findFactionIssues({
    factions: [{ id: "R", name: "หลวง" }, { id: "B", name: "กบฏ" }],
    memberships: [m("phop", "R", "c1", "c12"), m("phop", "B", "c10", null)],
    rels: [{ sourceFactionId: "B", targetFactionId: "R", type: "enemy", startChapterId: "c20", endChapterId: null }],
    chapterOrder: order,
});
assert.equal(late.filter((i) => i.kind === "enemy-overlap").length, 0);

// ความสัมพันธ์คู่เดียวกันทับกันคนละชนิด
const conflict = findFactionIssues({
    factions: [], memberships: [], chapterOrder: order,
    rels: [
        { sourceFactionId: "A", targetFactionId: "B", type: "ally", startChapterId: null, endChapterId: "c12" },
        { sourceFactionId: "B", targetFactionId: "A", type: "enemy", startChapterId: "c10", endChapterId: null },
        { sourceFactionId: "A", targetFactionId: "B", type: "rival", startChapterId: "c20", endChapterId: null }, // ไม่ทับ ally แต่ทับ enemy
    ],
});
assert.equal(conflict.filter((i) => i.kind === "rel-conflict").length, 2);

// statusAt: จุดล่าสุดที่ไม่เกินบท
const fac = { status: "active", statusTimeline: [{ chapterId: "c12", status: "declining" }, { chapterId: "c20", status: "disbanded" }] };
assert.equal(statusAt(fac, order, null), "active");
assert.equal(statusAt(fac, order, 5), "active");
assert.equal(statusAt(fac, order, 12), "declining");
assert.equal(statusAt(fac, order, 25), "disbanded");

// findDefections: จบบท 10 → เริ่มบท 10/11
const d = findDefections([m("phop", "R", "c1", "c10"), m("phop", "B", "c10", null), m("aru", "R", "c1", "c5"), m("aru", "B", "c12", null)], order);
assert.deepEqual(d.map((x) => [x.characterId, x.fromFactionId, x.toFactionId, x.atOrder]), [["phop", "R", "B", 10]]);
console.log("faction-checks.check ok");

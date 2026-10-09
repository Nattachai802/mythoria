import assert from "node:assert/strict";
import { DEFAULT_JOIN_KINDS, normalizeJoinKinds, readJoins, joinNodes, setJoin, hasCauseInto, joinStats, isJoinNodeType } from "./beat-joins.ts";

const K = DEFAULT_JOIN_KINDS;
// normalize: ชื่อ/ธงที่ตั้งไว้คงอยู่ · สีที่ไม่รู้จักถูกทิ้ง · สีที่ขาดถูกเติมจากค่าเริ่มต้น
const nk = normalizeJoinKinds([{ key: "flow", name: "ไหลต่อ", cause: true }, { key: "zzz", name: "x" }]);
assert.equal(nk.length, K.length);
assert.equal(nk.find((k) => k.key === "flow")!.name, "ไหลต่อ");
assert.equal(nk.find((k) => k.key === "flow")!.cause, true);
assert.equal(nk.find((k) => k.key === "cause")!.cause, true); // ไม่มีในที่บันทึก → ค่าเริ่มต้น
assert.equal(normalizeJoinKinds(undefined).length, K.length);
assert.equal(normalizeJoinKinds([{ key: "cut", name: "  " }]).find((k) => k.key === "cut")!.name, "ตัดฉาก"); // ชื่อว่างใช้ค่าเริ่มต้น

// setJoin: ตั้ง → แก้ → ล้าง (ไม่มีทั้งสีและข้อความ = ลบโหนด)
let j = setJoin([], 2, { kind: "cause" });
assert.deepEqual(j, [{ fromBeat: 2, kind: "cause" }]);
j = setJoin(j, 0, { kind: "flow", label: "ต่อทันที" });
assert.deepEqual(j.map((x) => x.fromBeat), [0, 2]); // เรียงตามจังหวะ
j = setJoin(j, 2, { kind: null });
assert.deepEqual(j.map((x) => x.fromBeat), [0]);
j = setJoin(j, 0, { kind: null, label: "" });
assert.deepEqual(j, []);

// เขียน/อ่านผ่าน canvasData ทั้งก้อน ไม่ปนกับการ์ด
const nodes = joinNodes([{ fromBeat: 1, kind: "cut", label: "ตัดไปเมืองอื่น" }, { fromBeat: 3, kind: null }], K);
assert.equal(nodes.filter((n) => n.type === "beatJoin").length, 1); // รอยต่อว่างไม่ถูกบันทึก
const back = readJoins([{ id: "c1", type: "idea" }, ...nodes]);
assert.deepEqual(back.joins, [{ fromBeat: 1, kind: "cut", label: "ตัดไปเมืองอื่น" }]);
assert.equal(back.hasJoinNodes, true);
assert.equal(readJoins([{ id: "c1", type: "idea" }]).hasJoinNodes, false); // ฉากเก่าไม่มีโหนด
assert.equal(readJoins(null).joins.length, 0);
assert.equal(isJoinNodeType("beatJoin") && isJoinNodeType("joinLegend") && !isJoinNodeType("idea"), true);

// hasCauseInto: รอยต่อก่อนหน้าต้องเป็นสีที่ติ๊กเหตุ-ผล
const jj = [{ fromBeat: 0, kind: "cause" }, { fromBeat: 1, kind: "flow" }];
assert.equal(hasCauseInto(jj, K, 0), false); // จังหวะแรกไม่มีเหตุนำ
assert.equal(hasCauseInto(jj, K, 1), true);
assert.equal(hasCauseInto(jj, K, 2), false); // ต่อเนื่อง ไม่ใช่เหตุ-ผล
assert.equal(hasCauseInto(jj, K, 3), false); // ไม่ได้ตั้ง

// joinStats: นับรอยต่อที่ยังไม่ตั้ง + ช่วง "แล้วก็…" ติดกันยาวสุด
assert.deepEqual(joinStats([], K, 0), { boundaries: 0, unset: 0, longestNonCauseRun: 0 });
assert.deepEqual(joinStats([], K, 1), { boundaries: 0, unset: 0, longestNonCauseRun: 0 });
assert.deepEqual(joinStats([], K, 4), { boundaries: 3, unset: 3, longestNonCauseRun: 3 });
const s = joinStats([{ fromBeat: 0, kind: "cause" }, { fromBeat: 1, kind: "flow" }, { fromBeat: 3, kind: "cut" }], K, 6);
assert.deepEqual(s, { boundaries: 5, unset: 2, longestNonCauseRun: 4 }); // รอยต่อ 0 = เหตุ-ผล · 1–4 ไม่ใช่ (flow, ไม่ตั้ง, cut, ไม่ตั้ง) · ไม่ตั้ง = รอยต่อ 2 กับ 4
const kk = K.map((k) => (k.key === "flow" ? { ...k, cause: true } : k));
assert.equal(joinStats([{ fromBeat: 0, kind: "cause" }, { fromBeat: 1, kind: "flow" }], kk, 3).longestNonCauseRun, 0); // ติ๊กสีอื่นเป็นเหตุ-ผลได้
console.log("beat-joins.check ok");

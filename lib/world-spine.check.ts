// Run: node --experimental-strip-types lib/world-spine.check.ts
import { layoutSpine, spineDropAt, type SpineOptions } from "./world-spine.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const o: SpineOptions = { base: 100, cardW: 120, breakDays: 3650, clusterMax: 3 };
const cols = [{ day: 0 }, { day: 1 }, { day: 300 }, { day: 100000 }, { day: null }];
const L = layoutSpine(cols, [], o);

assert(L.colX.every((x, i) => i === 0 || x > L.colX[i - 1]), "ช่องเรียงซ้ายไปขวา");
assert(L.colX[2] - L.colX[1] > L.colX[1] - L.colX[0], "ห่างหลายวัน = ห่างบนจอมากกว่า");
assert(L.colX[2] - L.colX[1] <= 300, "ห่างไม่เกิน 3 เท่าของ base");
assert(L.breaks.length === 1 && L.breaks[0].days === 99700, "ช่วงยาวเกินเกณฑ์ = รอยตัด ⫽");
assert(L.colX[4] - L.colX[3] === 100, "ไม่รู้เวลา = ระยะพื้นฐาน");
assert(L.bounds[0][0] === 0 && L.bounds[4][1] === L.width, "ขอบช่องครอบทั้งเส้น");

const near = layoutSpine([{ day: 0 }, { day: 1 }], [
    { id: "a", col: 0, side: "up" }, { id: "b", col: 1, side: "up" }, { id: "c", col: 1, side: "down" },
], o);
const lv = (id: string) => near.items.find((i) => i.id === id)!.level;
assert(lv("a") !== lv("b"), "การ์ดข้างเดียวกันที่ใกล้กันขึ้นคนละระดับ");
assert(lv("c") === 0, "อีกข้างไม่ชนกัน ใช้ระดับแรก");

const many = [1, 2, 3, 4, 5].map((n) => ({ id: `m${n}`, col: 0, side: "down" as const }));
const packed = layoutSpine([{ day: 0 }], many, o);
assert(packed.items.length === 2 && packed.clusters[0]?.hidden === 3, "เกิน 3 ใบ = โชว์ 2 + กลุ่ม +3");
const open = layoutSpine([{ day: 0 }], many, { ...o, expanded: new Set(["0:down"]) });
assert(open.items.length === 5 && open.clusters.length === 0, "กางกลุ่มแล้วโชว์ครบ");

const two = layoutSpine([{ day: 0 }, { day: 10 }], [], o);
const mid = (two.colX[0] + two.colX[1]) / 2;
assert(spineDropAt(two, two.colX[0])?.mode === "on" && spineDropAt(two, two.colX[0])?.col === 0, "วางตรงช่อง = on");
const before = spineDropAt(two, mid);
assert(before?.col === 1 && before.mode === "before", "วางกลางระหว่างช่อง = แทรกก่อนช่องขวา");
assert(spineDropAt(two, two.width + 50)?.col === 1, "เลยขอบขวา = ช่องสุดท้าย");

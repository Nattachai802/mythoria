// Run: node --experimental-strip-types lib/world-calendar.check.ts
import {
    DEFAULT_CALENDAR, normalizeCalendar, dayOf, fromDay, eraForYear, formatWorldTime, sceneDay, gapLabel, yearLength,
    type WorldCalendar,
} from "./world-calendar.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const cal: WorldCalendar = { months: [{ name: "เพลิง", days: 10 }, { name: "น้ำแข็ง", days: 20 }], anchor: { year: 342, month: 2, day: 5 } };
assert(yearLength(cal) === 30, "ความยาวปี = ผลรวมวันของทุกเดือน");
assert(dayOf(cal, 1, 1, 1) === 0, "ปี 1 วันแรก = day 0");
assert(dayOf(cal, 1, 2, 1) === 10, "เดือนที่ 2 เริ่มหลังเดือนแรก 10 วัน");

for (const [y, m, d] of [[1, 1, 1], [342, 2, 20], [-5, 1, 3], [0, 2, 1]]) {
    const back = fromDay(cal, dayOf(cal, y, m, d));
    assert(back.year === y && back.month === m && back.day === d, `แปลงไปกลับได้ตรง ปี ${y} เดือน ${m} วัน ${d}`);
}
assert(dayOf(cal, 3, 9, 99) === dayOf(cal, 3, 2, 20), "เดือน/วันเกินช่วงถูกบีบไว้ปลายเดือนสุดท้าย");

const eras = [{ id: "old", name: "ยุคแรก", startYear: -1000 }, { id: "fire", name: "ยุคเพลิง", startYear: 1 }, { id: "x", name: "ยังไม่ตั้ง", startYear: null }];
assert(eraForYear(eras, 342)?.id === "fire" && eraForYear(eras, -3)?.id === "old" && eraForYear(eras, -2000) === null, "หายุคจากปี (ยุคไม่ตั้งปีไม่นับ)");
assert(formatWorldTime(cal, eras, dayOf(cal, 342, 2, 5), "day") === "5 น้ำแข็ง ปี 342 ยุคเพลิง", "ป้ายระดับวัน");
assert(formatWorldTime(cal, eras, dayOf(cal, -991, 1, 1), "year") === "ปี 10 ยุคแรก", "ป้ายระดับปีนับตามยุค");

assert(sceneDay(cal, 1) === dayOf(cal, 342, 2, 5) && sceneDay(cal, 3) === dayOf(cal, 342, 2, 7), "story_date 1 = วัน anchor");
assert(sceneDay({ ...cal, anchor: null }, 3) === null && sceneDay(cal, null) === null, "ไม่มี anchor หรือไม่มีวันที่ = ไม่มีเวลาจริง");

assert(gapLabel(cal, 0, 15) === null, "ห่างไม่ถึงปีไม่แสดงป้าย");
assert(gapLabel(cal, 0, 30 * 300) === "≈ 300 ปี", "ป้ายช่วงว่าง 300 ปี");

const broken = normalizeCalendar({ months: [{ name: "", days: 0 }, "x"], anchor: { year: 1, month: 99, day: 99 } });
assert(broken.months.length === 1 && broken.months[0].days === 1 && broken.anchor!.month === 1, "ค่าพังถูกซ่อมให้ใช้ได้");
assert(normalizeCalendar(null) === DEFAULT_CALENDAR && normalizeCalendar({ months: [] }).months.length === 12, "ไม่มีค่า = ปฏิทินเริ่มต้น 12 เดือน");

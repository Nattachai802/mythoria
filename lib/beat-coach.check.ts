/** ตรวจกฎของ beat coach — รันด้วย `npm run check` */
import assert from "node:assert";
import { analyzeBeats, collapseByBeat, MISSING_THRESHOLD } from "./beat-coach.ts";

const st = (p: (number | null)[]) => analyzeBeats(p).state;

// ── เกณฑ์ข้อมูลขาด ──
assert.equal(st([null, null, null]), "no-data", "ไม่มีค่าเลย");
assert.equal(st([5, null, null, null, null]), "insufficient", "ขาด 80% = ยังสรุปไม่ได้");
// ขอบเขต: ตกลงกันว่า "มากกว่า 40%" ถึงเตือน — ที่ 40% พอดีจึงยังไม่เตือน
assert.equal(st([5, 6, 7, null, null]), "ok", "ขาด 40% พอดี ยังไม่เตือน");
assert.equal(st([5, 6, null, null, null]), "insufficient", "ขาด 60% เตือน");
assert.equal(analyzeBeats([5, 6, 7, 8, null]).missingRatio, 0.2, "คิดสัดส่วนจากจำนวนจังหวะทั้งหมด");
assert.equal(st([5, 6, 7, 8, null]), "ok", "ขาด 20% ยังอ่านได้");

// ปุ่ม AI ต้องขึ้นเฉพาะตอนข้อมูลไม่พอ ไม่ใช่ตอนเจอปัญหาจังหวะ
assert.equal(analyzeBeats([null, null]).needsAi, true, "ไม่มีข้อมูล = ชวนใช้ AI");
assert.equal(analyzeBeats([2, 2, 2]).needsAi, false, "ข้อมูลครบแล้วไม่ต้องชวน แม้จะเอื่อย");

// ── กฎจังหวะ ──
assert.equal(st([7, 5, 3, 2, 3]), "dragging", "3 จังหวะท้ายต่ำ = เอื่อย");
assert.equal(st([2, 3, 3, 9, 5]), "ok", "ต่ำตอนต้นแต่ท้ายไม่ต่ำ ไม่ใช่เอื่อย");
assert.equal(st([9, 9, 8, 10, 4]), "overheated", "เร่งติด 4 จังหวะ แม้จะไม่ได้อยู่ท้าย");
assert.equal(st([5, 5, 6, 5]), "flat", "ต่างกัน < 2 = แบน");
assert.equal(st([2, 9, 4, 7]), "ok", "ขึ้นลงชัด ไม่เตือน");
assert.equal(st([6]), "too-short", "จังหวะเดียวดูแนวโน้มไม่ได้");

// เอื่อยต้องมาก่อนแบน — ทั้งคู่เข้าเงื่อนไข แต่ "ท้ายเอื่อย" ให้ข้อมูลที่ทำต่อได้มากกว่า
assert.equal(st([2, 2, 2]), "dragging", "ทั้งเอื่อยและแบน ต้องรายงานว่าเอื่อย");

// ข้อความต้องมีของจริง ไม่ใช่ประโยคลอย
const drag = analyzeBeats([8, 3, 2, 1]);
assert(drag.text.includes("3") && drag.suggestion.length > 10, "เอื่อยต้องบอกตัวเลขและข้อเสนอ");
assert.equal(analyzeBeats([2, 9, 4, 7]).suggestion, "", "สถานะ ok ไม่ต้องเสนออะไร");

// ── ยุบเลน ──
const collapsed = collapseByBeat([
    { beatIndex: 0, pacing: 3 },
    { beatIndex: 0, pacing: 8 }, // เลนขนาน จังหวะเดียวกัน
    { beatIndex: 1, pacing: 5 },
]);
assert.deepEqual(collapsed, [8, 5], "จังหวะเดียวกันต้องยุบเป็นค่าเดียว ใช้ค่าสูงสุด");

const withNull = collapseByBeat([
    { beatIndex: 1, pacing: null },
    { beatIndex: 0, pacing: null },
    { beatIndex: 0, pacing: 4 },
]);
assert.deepEqual(withNull, [4, null], "เรียงตาม beatIndex และ null คงอยู่ถ้าไม่มีใครในจังหวะนั้นตั้งค่า");

assert(MISSING_THRESHOLD === 0.4, "เกณฑ์ที่ตกลงกันไว้คือ 40%");

console.log("✅ beat-coach ผ่านทั้งหมด");

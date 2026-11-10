import assert from "node:assert/strict";
import { ENN_QUESTIONS, verifyEnnAnswers, scoreEnneagram } from "./enneagram-suggest.ts";

// 6 ข้อ · ทุกข้อมีครบ 9 type ไม่ซ้ำ
assert.equal(ENN_QUESTIONS.length, 6);
for (const q of ENN_QUESTIONS) assert.deepEqual(q.options.map((o) => o.type).sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], q.id);

const src = "เขากลัวที่สุดว่าจะถูกควบคุม และไม่ยอมก้มหัวให้ใคร";
const v = verifyEnnAnswers({ answers: [
    { id: "EN-1", choice: "8", quote: "กลัวที่สุดว่าจะถูกควบคุม" },   // จริง — เก็บ quote
    { id: "EN-2", choice: "8", quote: "รักอิสระมาก" },               // แต่งขึ้น — เก็บตัวเลือก ล้าง quote
    { id: "EN-3", choice: "0", quote: "" },                          // นอกช่วง — ไม่นับ
] }, src);
assert.deepEqual([v["EN-1"].choice, v["EN-1"].quote], ["8", "กลัวที่สุดว่าจะถูกควบคุม"]);
assert.deepEqual([v["EN-2"].choice, v["EN-2"].quote], ["8", ""]);
assert.equal(v["EN-3"].choice, null);
assert.equal(Object.keys(v).length, 6);

// ตัดสิน: ≥3 เสียงและนำชัด
assert.equal(scoreEnneagram({ "EN-1": "8", "EN-2": "8", "EN-3": "8", "EN-4": "5", "EN-5": "1", "EN-6": "2" }).type, 8);
// 3:3 เสมอ = ยังไม่ชัด แต่ top มีทั้งคู่
const tie = scoreEnneagram({ "EN-1": "4", "EN-2": "4", "EN-3": "4", "EN-4": "5", "EN-5": "5", "EN-6": "5" });
assert.equal(tie.type, null);
assert.deepEqual(tie.top, [4, 5]);
// 2 เสียงสูงสุด = ยังไม่ชัด
assert.equal(scoreEnneagram({ "EN-1": "1", "EN-2": "1", "EN-3": "2", "EN-4": "3" }).type, null);
console.log("enneagram-suggest.check ok");

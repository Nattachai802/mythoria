import assert from "node:assert/strict";
import { MBTI_QUESTIONS, verifyAnswers, scoreAxes, toSliders } from "./mbti-suggest.ts";

// ชุดคำถาม: 12 ข้อ แกนละ 3 · ทุกข้อสองตัวเลือกเป็นคนละขั้วของแกนเดียวกัน
assert.equal(MBTI_QUESTIONS.length, 12);
for (const ax of ["EI", "SN", "TF", "JP"]) assert.equal(MBTI_QUESTIONS.filter((q) => q.axis === ax).length, 3);
for (const q of MBTI_QUESTIONS) {
    assert.notEqual(q.a.letter, q.b.letter, q.id);
    assert.ok(q.axis.includes(q.a.letter) && q.axis.includes(q.b.letter), q.id);
}

const src = "เขาเป็นคนเงียบ ชอบอยู่คนเดียวหลังเลิกงาน และวางแผนทุกอย่างล่วงหน้าเสมอ";
const v = verifyAnswers({ answers: [
    { id: "EI-1", choice: "b", quote: "ชอบอยู่คนเดียวหลังเลิกงาน" },     // อยู่ในต้นฉบับ — ผ่าน
    { id: "JP-1", choice: "a", quote: "วางแผน ทุกอย่าง ล่วงหน้า" },      // เว้นวรรคต่างได้ — ผ่าน
    { id: "TF-1", choice: "a", quote: "เป็นคนพูดตรงมาก" },             // แต่งขึ้นเอง — ไม่ผ่าน
    { id: "SN-1", choice: "a", quote: "เขา" },                         // สั้นเกินพิสูจน์ — ไม่ผ่าน
    { id: "XX-9", choice: "a", quote: "ชอบอยู่คนเดียว" },               // ไม่มีข้อนี้ — ทิ้ง
] }, src);
assert.equal(v["EI-1"].choice, "b");
assert.equal(v["JP-1"].choice, "a");
assert.deepEqual([v["TF-1"].choice, v["TF-1"].quote], ["a", ""]);  // หลักฐานแต่งขึ้น: เก็บตัวเลือก ล้าง quote
assert.deepEqual([v["SN-1"].choice, v["SN-1"].quote], ["a", ""]);  // quote สั้นเกิน: เก็บตัวเลือก ล้าง quote
assert.equal(v["EI-1"].quote, "ชอบอยู่คนเดียวหลังเลิกงาน");
assert.equal(Object.keys(v).length, 12);
assert.equal(v["EI-2"].choice, null);                                   // ข้อที่ AI ไม่ได้ตอบเลย = null
assert.equal(verifyAnswers("garbage", src)["EI-1"].choice, null);      // ตอบผิดรูปแบบ — ไม่พัง

// เสียงข้างมาก 2 ใน 3 · EI-2 ข้อ a = I (สลับขั้ว)
const axes = scoreAxes({ "EI-1": "b", "EI-2": "a", "EI-3": "a", "SN-1": "a", "TF-1": "a" });
const ei = axes.find((a) => a.axis === "EI")!;
assert.deepEqual([ei.letter, ei.left, ei.right], ["I", 1, 2]);
assert.equal(axes.find((a) => a.axis === "SN")!.letter, null);          // ตอบข้อเดียว ยังไม่พอ
const s = toSliders(scoreAxes({ "JP-1": "a", "JP-2": "b", "JP-3": "a", "EI-1": "b", "EI-2": "a", "EI-3": "a" }));
assert.deepEqual(s, { EI: 65, JP: 15 });                                 // 2:1 = 65 · 3:0 = 15 · แกนอื่นไม่เขียน
console.log("mbti-suggest.check ok");

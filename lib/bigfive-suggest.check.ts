import assert from "node:assert/strict";
import { B5_QUESTIONS, scoreBigFive, checkCoherence } from "./bigfive-suggest.ts";
import { verifyAnswers } from "./mbti-suggest.ts";

// 15 ข้อ ด้านละ 3 · ทุกข้อมีขั้วสูง 1 ต่ำ 1
assert.equal(B5_QUESTIONS.length, 15);
for (const t of "OCEAN") assert.equal(B5_QUESTIONS.filter((q) => q.trait === t).length, 3, t);
for (const q of B5_QUESTIONS) assert.notEqual(q.a.pole, q.b.pole, q.id);

// คะแนน: E-2 ข้อ a = ขั้วต่ำ (สลับ) · 3 ข้อขั้วสูง = 5 · 1 ข้อ = 2 · ไม่ครบ = null
const s = scoreBigFive({ "E-1": "a", "E-2": "b", "E-3": "a", "A-1": "a", "A-2": "a", "A-3": "a", "N-1": "a", "C-1": "a", "C-2": "a", "C-3": "b" });
const lv = Object.fromEntries(s.map((x) => [x.trait, x.level]));
assert.deepEqual(lv, { O: null, C: 2, E: 5, A: 2, N: null }); // C: C-1 สูง, C-2 a=ต่ำ, C-3 b=ต่ำ → 1 ข้อ = 2

// verifyAnswers ใช้กับชุด Big Five ได้ — id นอกชุดถูกทิ้ง
const v = verifyAnswers({ answers: [{ id: "E-1", choice: "a", quote: "พูดเก่งมาก" }, { id: "EI-1", choice: "a", quote: "" }] }, "เป็นคนพูดเก่งมาก", B5_QUESTIONS);
assert.equal(Object.keys(v).length, 15);
assert.deepEqual([v["E-1"].choice, v["E-1"].quote], ["a", "พูดเก่งมาก"]);

// ความสอดประสาน: E (สไลเดอร์ 20) + Extraversion 5 = ไปด้วยกัน · F (80) + Agreeableness 1 = ขัด (เตือนเบา)
const notes = checkCoherence({ EI: 20, TF: 80, SN: 50, JP: 10 }, { E: 5, A: 1, O: 5, C: 3 });
assert.deepEqual(notes.map((n) => [n.axis, n.kind, n.strong]), [["EI", "match", true], ["TF", "conflict", false]]);
// SN ก้ำกึ่ง (50) และ C กลาง (3) ถูกข้าม · ค่าไม่ครบ = ไม่ตรวจ
assert.equal(checkCoherence({}, { E: 5 }).length, 0);
console.log("bigfive-suggest.check ok");

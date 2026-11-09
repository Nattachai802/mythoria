import assert from "node:assert/strict";
import { emptyPaths, planAutofill, aiQuote } from "./character-autofill.ts";

const profile = { body: { hair: "ดำ", marks: "แผลที่แก้ม" }, identity: {} };

const empty = emptyPaths(profile);
assert.ok(!empty.includes("body.hair"));
assert.ok(empty.includes("body.eyes") && empty.includes("identity.ageAtStart"));

const plan = planAutofill(profile, [
    { path: "body.hair", value: "เงิน", quote: "q" },                         // มีค่าแล้ว — ห้ามทับ
    { path: "body.eyes", value: "สีแดง", quote: "ดวงตาสีแดงฉาน" },
    { path: "body.heightCm", value: "182 ซม.", quote: "สูงร้อยแปดสิบสอง" },   // แปลงเป็นตัวเลข
    { path: "identity.ageAtStart", value: "ไม่ทราบ", quote: "q" },            // ไม่ใช่ตัวเลข — ทิ้ง
    { path: "speech.selfPronoun", value: "ข้า", quote: "" },                  // ไม่มีอ้างอิง — ทิ้ง
    { path: "mbti", value: "INTJ", quote: "q" },                             // ไม่อยู่ในรายการ — ทิ้ง
]);

assert.equal(plan.count, 2);
// กลุ่ม body ต้องเก็บค่าเดิม (hair, marks) — server merge ตื้น
assert.deepEqual(plan.patch.body, { hair: "ดำ", marks: "แผลที่แก้ม", eyes: "สีแดง", heightCm: 182 });
assert.equal(plan.patch.identity, undefined);

// จุดทอง: แสดงเมื่อค่ายังเป็นของ AI · ผู้ใช้แก้แล้วหาย
const after = { ...profile, body: plan.patch.body, _ai: plan.patch._ai };
assert.equal(aiQuote(after, "body.eyes"), "ดวงตาสีแดงฉาน");
assert.equal(aiQuote({ ...after, body: { ...(after.body as object), eyes: "ฟ้า" } }, "body.eyes"), undefined);
assert.equal(aiQuote(after, "body.hair"), undefined);

assert.equal(planAutofill(profile, []).count, 0);
assert.equal(planAutofill(profile, []).patch._ai, undefined); // ไม่มีอะไรเติม = ไม่เขียน
console.log("character-autofill.check ok");

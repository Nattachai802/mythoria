/**
 * ตรวจ adapter ของโหมด Jev ที่เหลือ — รันด้วย `npm run check`
 * (ของ echo-score อยู่ใน lib/echo-score.check.ts แยกไฟล์เพราะมีเกณฑ์ตัดของตัวเอง)
 *
 * ไฟล์นี้รันผ่าน esbuild ไม่ใช่ node --experimental-strip-types ตรง ๆ เหมือน check ตัวอื่น
 * เพราะโมดูลที่ต้องโหลด (pacing-ai-suggest → scene-dramatic) import แบบไม่ใส่นามสกุล ซึ่ง node
 * resolve ไม่ได้ · esbuild ติดมากับ dependency อยู่แล้ว ไม่ได้เพิ่มตัวใหม่ แต่เป็น transitive
 * ถ้าวันหนึ่ง `npm run check` ฟ้องว่าไม่รู้จัก esbuild ให้ประกาศมันใน devDependencies ตรง ๆ
 *
 * กฎเดียวที่ต้องถือให้ได้ทุกตัว: toJson() ต้องคายรูปที่ parser ตัวเดิมของฟีเจอร์กินได้
 * ถ้าข้อไหนพัง = โหมด jev กับโหมด traditional กลายเป็นคนละสายโค้ดโดยไม่มีใครรู้
 */
import assert from "node:assert";
import { buildPacingJev, parsePacingAiSuggestResponse, jevScoreToPacing } from "./pacing-ai-suggest.ts";
import { buildBeatCoachJev, parseBeatCoachResponse, buildBeatCoachPrompt } from "./beat-coach-ai.ts";
import { buildSceneTypeJev, parseSceneTypeSuggestResponse } from "./scene-type-suggest.ts";
import { PACING_MIN, PACING_MAX } from "./scene-dramatic.ts";
import type { JevAnswer } from "./ai-features.ts";

const score = (s: number, conf = 0.8): JevAnswer => ({
    type: "score",
    score: s,
    legend: { "0": "ผ่อน", "1": "คงที่", "2": "เด่น" },
    probabilities: { "0": 0, "1": 1 - conf, "2": conf },
    confidence: conf,
});
const choice = (c: string): JevAnswer => ({ type: "choice", choice: c, probabilities: { [c]: 1 }, confidence: 0.9 });

// ── สเกล: Score 0..2 → pacing 1..10 ──
assert.equal(jevScoreToPacing(0), PACING_MIN, "ระดับต่ำสุด = จังหวะต่ำสุด");
assert.equal(jevScoreToPacing(2), PACING_MAX, "ระดับสูงสุด = จังหวะสูงสุด");
assert.equal(jevScoreToPacing(1), 6, "กึ่งกลางอยู่กลางสเกล (ปัดขึ้นจาก 5.5)");
assert.ok(jevScoreToPacing(-5) === PACING_MIN && jevScoreToPacing(99) === PACING_MAX, "ค่าเกินขอบต้องถูกบีบ");

// ── pacing-ai-suggest ──
const targets = [
    { id: "scene-1", title: "ฉากใหญ่", isScene: true },
    { id: "card-a", title: "การ์ด ก" },
    { id: "card-b", title: "การ์ด ข" },
];
const pac = buildPacingJev("เนื้อฉาก", targets);
assert.deepEqual(Object.keys(pac.questions), ["scene-1", "card-a", "card-b"], "id ต้องเป็น key ของคำถามตรง ๆ");
assert.equal(pac.questions["scene-1"].type, "score");
assert.ok(
    pac.questions["scene-1"].instructions !== pac.questions["card-a"].instructions,
    "ฉากใหญ่กับการ์ดต้องถามคนละแบบ",
);

const pacParsed = parsePacingAiSuggestResponse(pac.toJson({
    "scene-1": score(2, 0.95),
    "card-a": score(0, 0.42),
    "card-b": score(1),
}));
assert.ok(pacParsed, "ผล Jev ต้องผ่าน parser เดิมของ pacing");
assert.equal(pacParsed.size, 3, "ครบทุก id");
assert.equal(pacParsed.get("scene-1")!.pacing, PACING_MAX);
assert.equal(pacParsed.get("card-a")!.confidence, 0.42, "confidence ต้องเป็นค่าจริงจากโมเดล ไม่ใช่ค่าคงที่");
assert.ok(pacParsed.get("card-a")!.reason.length > 0, "เหตุผลต้องมี (ใช้ชื่อระดับที่ได้น้ำหนักสูงสุด)");

// คำตอบหาย = ทิ้งเฉพาะแถวนั้น ไม่ใช่ทิ้งทั้งฉาก
const pacPartial = parsePacingAiSuggestResponse(pac.toJson({ "card-b": score(1) }));
assert.equal(pacPartial?.size, 1, "ขาดบาง id ต้องยังคืนที่เหลือได้");

// ── beat-coach ──
const cards = [{ id: "c1", title: "ลับดาบ" }, { id: "c2", title: "ปะทะ" }];
const coach = buildBeatCoachJev("เนื้อฉาก", cards);
assert.ok("__state" in coach.questions && "__next" in coach.questions, "ต้องถามภาพรวม + จังหวะถัดไป");
assert.equal(Object.keys(coach.questions).length, cards.length + 2);

const coachParsed = parseBeatCoachResponse(coach.toJson({
    c1: score(0), c2: score(2),
    __state: choice("dragging"),
    __next: choice("climax"),
}));
assert.ok(coachParsed, "ผล Jev ต้องผ่าน parser เดิมของ beat-coach");
assert.equal(coachParsed.beats.get("c1"), PACING_MIN);
assert.equal(coachParsed.beats.get("c2"), PACING_MAX);
assert.equal(coachParsed.advice?.state, "dragging");
assert.equal(coachParsed.advice?.suggestedType, "climax");
// Jev ไม่เขียนข้อความ — ค่าว่างนี้คือสัญญาณให้ server ยิง LLM รอบสองมาเติม
assert.equal(coachParsed.advice?.text, "", "ข้อความต้องว่าง ไม่ใช่ประโยคที่แต่งขึ้นเอง");

// ค่าที่ไม่อยู่ในชุดตัวเลือกต้องไม่หลุดออกไป
const coachBad = parseBeatCoachResponse(coach.toJson({
    c1: score(1), __state: choice("ระเบิด"), __next: choice("ไม่มีจริง"),
}));
assert.equal(coachBad?.advice?.state, "ok", "state แปลกต้องกลับไปค่าปลอดภัย");
assert.equal(coachBad?.advice?.suggestedType, "", "ประเภทฉากที่ไม่รู้จักต้องถูกตัดทิ้ง");

// ── beat-coach: คำตอบจริงจาก typhoon ที่เคยทำให้ parse พัง ──
// ตั้งชื่อ key เองเป็น work1/work2 ตามหัวข้อ "งานที่ 1/2" ใน prompt และใช้ score แทน pacing
// ข้อมูลครบทุกค่า แต่ parser เดิมคืน null ทิ้งทั้งก้อน (ai_usage_log status=parse_error)
const typhoonRaw = JSON.stringify({
    work1: [
        { id: "40c0fc0a-e971-447f-badd-0bf754b60f49", score: 6 },
        { id: "d1be85a1-f193-44a4-96a0-5917efa6a648", score: 5 },
        { id: "0c49d1da-c5eb-477e-86ac-6fb59c34f5bc", score: 9 },
    ],
    work2: {
        state: "flat",
        text: "ฉากนี้มีการเล่าที่ราบเรียบ ไม่มีจังหวะขึ้นลงชัดเจน",
        suggestedType: "reaction",
        suggestedNext: "ต้องการจังหวะที่มีการหยุดนิ่งเพื่อสะท้อนความรู้สึกหลังเหตุการณ์",
    },
});

const typhoon = parseBeatCoachResponse(typhoonRaw);
assert.ok(typhoon, "key ชื่อแปลกต้องไม่ทำให้ทิ้งทั้งก้อน");
assert.equal(typhoon.beats.size, 3, "ต้องได้การ์ดครบ แม้ array จะชื่อ work1");
assert.equal(typhoon.beats.get("0c49d1da-c5eb-477e-86ac-6fb59c34f5bc"), 9, "อ่าน score เป็น pacing ได้");
assert.equal(typhoon.advice?.state, "flat", "advice ที่ชื่อ work2 ต้องถูกหยิบมา");
assert.equal(typhoon.advice?.suggestedType, "reaction");

// prompt ต้องไม่พูดถึง "งานที่ 1/2" อีก — ต้นตอที่โมเดลเอาไปตั้งเป็นชื่อ key
const coachPrompt = buildBeatCoachPrompt("เนื้อฉาก").system;
assert.ok(!coachPrompt.includes("งานที่ 1"), "prompt ต้องเรียกช่องด้วยชื่อ field จริง ไม่ใช่เลขงาน");
assert.ok(coachPrompt.includes("beats") && coachPrompt.includes("advice"), "prompt ต้องระบุชื่อช่องตรง ๆ");

// ── scene-type-suggest ──
const st = buildSceneTypeJev("เนื้อฉาก");
assert.deepEqual(Object.keys(st.questions).sort(), ["outcome", "pacing", "sceneType"]);

const stParsed = parseSceneTypeSuggestResponse(st.toJson({
    sceneType: choice("climax"),
    outcome: choice("failure"),
    pacing: score(2),
}));
assert.ok(stParsed, "ผล Jev ต้องผ่าน parser เดิมของ scene-type");
assert.equal(stParsed.sceneType, "climax");
assert.equal(stParsed.outcome, "failure");
assert.equal(stParsed.pacing, PACING_MAX);
assert.equal(stParsed.field1, "", "field ต้องว่างไว้ให้ LLM รอบสองเติม");

// ประเภทฉากอ่านไม่ได้ = ทิ้งทั้งผล (ไม่มีอะไรให้ prefill ต่อได้อยู่ดี)
assert.equal(parseSceneTypeSuggestResponse(st.toJson({ pacing: score(1) })), null, "ไม่มีประเภทฉาก = null");

console.log("jev adapters (pacing / beat-coach / scene-type) — ผ่านทั้งหมด");

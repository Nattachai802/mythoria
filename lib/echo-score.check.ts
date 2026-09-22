/**
 * ตรวจว่าโหมด Jev กับโหมด LLM ให้ผลรูปเดียวกันจริง — รันด้วย `npm run check`
 *
 * หัวใจของการรวมสองโหมด: buildJudgeJev().toJson() ต้องคาย JSON ที่ parseJudgeResponse
 * ตัวเดิม (ตัวที่ LLM ใช้อยู่) กินได้ ถ้าข้อนี้พัง = โค้ดแตกเป็นสองสายโดยไม่รู้ตัว
 */
import assert from "node:assert";
import {
    buildJudgeJev,
    parseJudgeResponse,
    ECHO_JUDGE_MATCH_MIN,
    ECHO_JUDGE_SPECIFIC_MIN,
} from "./echo-score.ts";
import type { JevAnswer } from "./ai-features.ts";

const guesses = [
    "อาจารย์ทรยศแล้วเกี่ยวข้องกับการตายของพ่อแม่", // ตรง + เจาะจง
    "อริยาฆ่าอาจารย์ตาย",                            // ขัดกับผลลัพธ์จริง
    "มีความขัดแย้งภายในสำนัก",                        // จริงแต่กว้างเกิน
];

const jev = buildJudgeJev("บริบทก่อนหน้า", "เหตุการณ์จริง", guesses);

// ── คำถาม: ต้องมี 2 ข้อต่อคำเดาหนึ่งข้อ และเป็นอิสระต่อกัน ──
assert.equal(Object.keys(jev.questions).length, guesses.length * 2, "คำเดาละ 2 คำถาม (ขัดแย้ง + เจาะจง)");
assert.equal(jev.questions.m0.type, "noul", "คำถามความสอดคล้องเป็น Noul");
assert.equal(jev.questions.s0.type, "noul", "คำถามความเจาะจงเป็น Noul");
assert.ok(jev.questions.m0.instructions.includes(guesses[0]), "คำเดาต้องอยู่ในตัวคำถาม");
assert.notEqual(jev.questions.m0.instructions, jev.questions.s0.instructions, "สองมิติต้องถามคนละอย่าง");

// state ถูกส่งครั้งเดียวสำหรับทุกคำถาม — เป็นเหตุผลที่ยิงรวมทั้งการ์ดในคอลเดียวได้
assert.deepEqual(jev.state, { บริบทก่อนหน้า: "บริบทก่อนหน้า", เหตุการณ์จริง: "เหตุการณ์จริง" });

const noul = (n: number): JevAnswer => ({ type: "noul", noul: n });

// ── toJson → parseJudgeResponse: ต้องวิ่งผ่านท่อเดิมได้ ──
const parsed = parseJudgeResponse(jev.toJson({
    m0: noul(0.85), s0: noul(0.78),  // ผ่านทั้งคู่ → นับ
    m1: noul(0.17), s1: noul(0.64),  // ขัดแย้ง → ตก
    m2: noul(0.75), s2: noul(0.20),  // กว้างเกิน → ตก
}));

assert.ok(parsed, "ผลจาก Jev ต้อง parse ผ่าน parser ตัวเดียวกับ LLM");
assert.equal(parsed.hits, 1, "ตรงจริงข้อเดียว");
assert.deepEqual(parsed.matched.map(m => m.index), [0], "index ต้องอ้างตำแหน่งใน guesses เดิม");
assert.equal(parsed.judgeScores?.length, 3, "คะแนนดิบต้องเก็บครบทุกคำเดา ไม่ใช่เฉพาะข้อที่ผ่าน");
assert.deepEqual(parsed.judgeScores?.[1], { match: 0.17, specific: 0.64 }, "คะแนนดิบของข้อที่ตกต้องไม่หาย");

// ── สองมิติต้องตัดสินแยกกันจริง ไม่ใช่ค่าเดียวปลอมเป็นสอง ──
// (ถ้าเผลอรวมสองเกณฑ์กลับเป็นคำถามเดียว เคสนี้จะพัง — คำเดากว้างจะหลุดเข้าไปนับ)
const onlyVague = parseJudgeResponse(jev.toJson({
    m0: noul(0.99), s0: noul(0.10),
    m1: noul(0.99), s1: noul(0.10),
    m2: noul(0.99), s2: noul(0.10),
}));
assert.equal(onlyVague?.hits, 0, "ไม่ขัดแย้งเลยแต่กว้างทุกข้อ = ไม่นับสักข้อ");

// ── ขอบเกณฑ์: ที่ค่าเท่าเกณฑ์พอดีต้องนับ (>=) ──
const onEdge = parseJudgeResponse(jev.toJson({
    m0: noul(ECHO_JUDGE_MATCH_MIN), s0: noul(ECHO_JUDGE_SPECIFIC_MIN),
    m1: noul(0), s1: noul(0),
    m2: noul(0), s2: noul(0),
}));
assert.equal(onEdge?.hits, 1, "ค่าเท่าเกณฑ์พอดี = นับ");

// ── คำตอบหาย (คำถามไม่ครบ/ผิดชนิด) ต้องไม่กลายเป็น hit ──
const missing = parseJudgeResponse(jev.toJson({ m0: noul(0.9) }));
assert.equal(missing?.hits, 0, "ขาดคำตอบความเจาะจง = ไม่นับ ไม่ใช่เดาว่าผ่าน");
assert.equal(missing?.judgeScores?.[0].specific, 0, "คำตอบที่หายต้องเป็น 0 ไม่ใช่ NaN");

// ── โหมดเดิม (LLM) ต้องไม่ได้รับผลกระทบ ──
const legacy = parseJudgeResponse('```json\n{"matched":[{"index":2,"reason":"ตรงเพราะ..."}]}\n```');
assert.equal(legacy?.hits, 1, "รูปเดิมจาก LLM ยัง parse ได้เหมือนเดิม");
assert.equal(legacy?.judgeScores, undefined, "LLM ไม่มีคะแนนดิบ = undefined ไม่ใช่ []");

console.log("echo-score (jev judge) — ผ่านทั้งหมด");

// Run: node --experimental-strip-types lib/thread-fairness-ai.check.ts
import { buildCardSequence, threadJourney } from "./thread-journey.ts";
import {
    buildFairnessDossier, classifyPayoff, parseChecklist, hashFairnessInput, mixedModels, buildChecklistPrompt,
    FAIRNESS_MAX_STOPS, type FairnessChecklist,
} from "./thread-fairness-ai.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const lane = { id: "L1", type: "lane", name: "หลัก", orderIndex: 0 };
const cards = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, title: `การ์ด ${i}`, content: i === 19 ? "พี่ชายคือผู้ส่ง เขากลับมาพร้อมจดหมายฉบับสุดท้าย" : `เนื้อ ${i} `.repeat(i === 1 ? 200 : 1), beatIndex: i, laneId: "L1" }));
const seq = buildCardSequence([{ id: "e1", title: "ฉาก 1", orderIndex: 0, relatedChapterId: "ch1", canvasData: [lane, ...cards] }], [{ id: "ch1", title: "บท 1", orderIndex: 0 }]);
const byId = new Map(cards.map(c => [c.id, c]));
const cardOf = (s: { beat: { canvasItemId: string | null } }) => (s.beat.canvasItemId ? byId.get(s.beat.canvasItemId) ?? null : null);

const thread = (beats: Array<[string, string]>, summary: string | null = "พี่ชายส่งจดหมาย") => ({
    id: "T", title: "ใครส่งจดหมาย", summary,
    points: [{ id: "p1", text: "ใครส่ง", status: "resolved" }],
    beats: beats.map(([cid, role], i) => ({ id: `b${i}`, eventId: "e1", canvasItemId: cid, role, pointId: "p1" })),
});
const dossierOf = (t: ReturnType<typeof thread>) => buildFairnessDossier(t, threadJourney(t, [t], seq), cardOf as never);

assert(dossierOf(thread([["c0", "seed"]])) === null, "ไม่มีจุดเฉลย → ตรวจไม่ได้");

const t1 = thread([["c19", "payoff"], ["c1", "seed"], ["c5", "reinforce"]]);
const d1 = dossierOf(t1)!;
assert(d1.usedStops === 2 && d1.droppedStops === 0, "ใช้ 2 จุดก่อนเฉลย");
assert(!d1.prefixText.includes("พี่ชาย"), "prefix ไม่มีคำตอบจริงหรือเนื้อการ์ดเฉลย (ผู้ทายต้องไม่รู้)");
assert(d1.checklistText.includes("คำตอบจริงของปม: พี่ชายส่งจดหมาย"), "เช็คลิสต์มีคำตอบจริง");
assert(d1.prefixText.includes("[บท 1 · ฉาก 1 · C02] หว่าน · ประเด็น: ใครส่ง"), "อ้างรหัสการ์ดตามเส้นทาง");
assert(d1.prefixText.includes("(ผ่านไป 4 การ์ด)"), "บอกระยะระหว่างจุด");
assert(d1.prefixText.includes("…") && !d1.prefixText.includes("เนื้อ 1 ".repeat(120)), "เนื้อการ์ดยาวถูกตัด");
assert(!d1.payoffIsThin, "การ์ดเฉลยมีเนื้อ");
assert(dossierOf(thread([["c19", "payoff"]], null))!.checklistText.includes("ผู้เขียนไม่ได้ระบุ"), "ไม่มีคำอธิบาย → บอก AI ว่าไม่รู้คำตอบจริง");

const many = thread([["c19", "payoff"], ...Array.from({ length: 15 }, (_, i) => [`c${i}`, "reinforce"] as [string, string])]);
const dm = dossierOf(many)!;
assert(dm.usedStops === FAIRNESS_MAX_STOPS && dm.droppedStops === 3 && dm.prefixText.includes("ตัดจุดที่ไกลจากเฉลยออก 3 จุด"), "จุดเยอะ → เก็บ 12 ที่ใกล้เฉลย");
assert(!dm.prefixText.includes("[บท 1 · ฉาก 1 · C01]") && dm.prefixText.includes("C15"), "ที่ถูกตัดคือจุดไกลเฉลย");

// ป้าย
const ok: FairnessChecklist = { contradicts: false, newInfo: false, pointsSignposted: true, guessesDistinct: true, note: "" };
const bad: FairnessChecklist = { ...ok, newInfo: true };
assert(classifyPayoff(3, 3, ok) === "obvious", "3/3 + มีที่มา → ชัดเจน");
assert(classifyPayoff(1, 3, ok) === "balanced" && classifyPayoff(2, 3, ok) === "balanced", "1-2/3 + มีที่มา → พอดี");
assert(classifyPayoff(0, 3, ok) === "twist", "0/3 + มีที่มา → หักมุม");
assert(classifyPayoff(0, 3, bad) === "unfounded" && classifyPayoff(2, 3, bad) === "unfounded", "ทายไม่ครบ + ไม่มีที่มา → เบาะแสไม่พอ");
assert(classifyPayoff(3, 3, bad) === "obvious", "ทายถึงทุกข้อ → ชัดเจน แม้เช็คลิสต์ไม่ผ่าน");

// parse
assert(parseChecklist('```json\n{"contradicts":false,"newInfo":true,"pointsSignposted":true,"guessesDistinct":false,"note":"x"}\n```')?.guessesDistinct === false, "parse ผ่าน code fence");
assert(parseChecklist('{"contradicts":"no"}') === null && parseChecklist("ไม่ใช่ json") === null, "JSON เสีย → null");
assert(parseChecklist('{"contradicts":false,"newInfo":false,"pointsSignposted":true,"note":""}')!.guessesDistinct === true, "ไม่ตอบ guessesDistinct → ถือว่าหลากหลาย");
assert(buildChecklistPrompt("x", ["ก", "ข"]).user.includes("1. ก\n2. ข"), "เช็คลิสต์เห็นคำทาย");

// hash / โมเดล
assert(hashFairnessInput(d1) === hashFairnessInput({ ...d1 }) && hashFairnessInput(d1) !== hashFairnessInput({ ...d1, payoffText: "x" }), "hash เปลี่ยนเมื่อ input เปลี่ยน");
assert(!mixedModels({ models: { guess: "a", judge: "a", checklist: "a" } }) && mixedModels({ models: { guess: "a", judge: "b", checklist: "a" } }), "จับผลปนโมเดล");

console.log("thread-fairness-ai: all passed");

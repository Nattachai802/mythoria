// Run: node --experimental-strip-types lib/thread-journey.check.ts
import { buildCardSequence, threadJourney, unfairPoints, journeyLine, relationTag, type JourneyThreadInput } from "./thread-journey.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const lane = { id: "L1", type: "lane", name: "หลัก", orderIndex: 0 };
const card = (id: string, beatIndex: number, type?: string) => ({ id, type, title: id, beatIndex, laneId: "L1" });
const chapters = [{ id: "ch1", title: "บท 1", orderIndex: 0 }, { id: "ch2", title: "บท 2", orderIndex: 1 }];
// บท 2 มาก่อนใน array แต่ต้องเรียงตามบท · e3 ไม่ผูกบท · note ไม่นับ
const events = [
    { id: "e2", title: "ฉาก 2", orderIndex: 0, relatedChapterId: "ch2", canvasData: [lane, card("c4", 0), card("c5", 1)] },
    { id: "e1", title: "ฉาก 1", orderIndex: 0, relatedChapterId: "ch1", canvasData: [lane, card("c2", 1), card("c1", 0), card("n1", 0, "sticky-note"), card("c3", 2)] },
    { id: "e3", title: "ฉากลอย", orderIndex: 5, relatedChapterId: null, canvasData: [lane, card("x1", 0)] },
];
const seq = buildCardSequence(events, chapters);
const pos = (id: string) => seq.byCardId.get(id)!.pos;
assert(pos("c1") === 0 && pos("c2") === 1 && pos("c3") === 2 && pos("c4") === 3 && pos("c5") === 4, "เรียง บท → ฉาก → จังหวะ ข้ามลำดับใน array");
assert(pos("n1") === null, "โน้ตไม่นับตำแหน่ง");
assert(pos("x1") === null && seq.sceneStart.get("e3") === null, "ฉากไม่ผูกบท → ไม่รู้ตำแหน่ง");
assert(seq.byCardId.get("c1")!.code === "C01", "รหัสในฉากเหมือน story-format");

const beat = (id: string, eventId: string, canvasItemId: string | null, role: string, pointId: string | null = null) =>
    ({ id, eventId, canvasItemId, role, pointId });
const A: JourneyThreadInput = {
    id: "A", title: "ปม A",
    beats: [beat("a3", "e2", "c5", "payoff", "p1"), beat("a1", "e1", "c1", "seed", "p1"), beat("a2", "e3", "x1", "reinforce")],
    points: [{ id: "p1", text: "ใคร", status: "resolved" }, { id: "p2", text: "ทำไม", status: "resolved" }],
    links: [{ toThreadId: "C", kind: "misdirects" }],
};
const B: JourneyThreadInput = { id: "B", title: "ปม B", parentThreadId: "A", beats: [beat("b1", "e1", "c3", "seed")] };
const C: JourneyThreadInput = { id: "C", title: "ปม C", beats: [beat("c1b", "e2", null, "seed")] };
const D: JourneyThreadInput = { id: "D", title: "ปม D", beats: [beat("d1", "e2", "gone", "seed")] };
const all = [A, B, C, D];

const j = threadJourney(A, all, seq);
assert(j.stops.map(s => s.beat.id).join() === "a1,a3,a2", "จุดเรียงตามตำแหน่ง ที่ไม่รู้ตำแหน่งไปท้าย");
assert(j.first!.beat.id === "a1" && j.payoff!.beat.id === "a3", "จุดแรก + จุดเฉลย");
assert(j.stops[1].gapFromPrev === 4 && j.span === 4 && j.longestSilence === 4, "ห่าง 4 การ์ด (c1 → c5)");
const btw = j.stops[1].between;
assert(btw.length === 3, "ระหว่างนั้นมี 3 จุดของปมอื่น (B ที่ c3, C ต้นฉาก 2, D การ์ดหาย → ต้นฉาก 2)");
assert(btw.find(b => b.threadId === "B")!.tag === "child" && btw.find(b => b.threadId === "C")!.tag === "decoy" && btw.find(b => b.threadId === "D")!.tag === "none",
    "ป้ายความสัมพันธ์ ปมย่อย / ปมหลอก / ไม่เกี่ยว");
assert(j.stops[2].pos === null && j.stops[2].gapFromPrev === null, "ฉากไม่ผูกบท → ไม่คำนวณระยะ");
assert(threadJourney(D, all, seq).stops[0].sceneLevel, "การ์ดถูกลบ → ผูกทั้งฉาก");
assert(relationTag(B, A) === "parent" && relationTag(C, A) === "decoyed", "ป้ายฝั่งกลับ");

const uf = unfairPoints(j);
assert(j.clues.find(c => c.pointId === "p1")!.cluesBeforePayoff === 1, "ประเด็น p1 มีเบาะแส 1 การ์ดก่อนเฉลย");
assert(uf.length === 1 && uf[0].pointId === "p2", "ประเด็น p2 เฉลยโดยไม่มีเบาะแส → ไม่ยุติธรรม");
assert(threadJourney({ id: "E", title: "E", beats: [] }, all, seq).first === null, "ไม่มีจุดผูก → ไม่มีเส้นทาง");

const line = journeyLine(j, "e2", seq)!;
assert(line.includes("[ฉาก 1 · C01]") && line.includes("ห่างจากจุดล่าสุดของปมนี้ 4 การ์ด") && line.includes("ปม B (ปมย่อย)"), "บรรทัดสำหรับ AI: " + line);

console.log("thread-journey: all passed");

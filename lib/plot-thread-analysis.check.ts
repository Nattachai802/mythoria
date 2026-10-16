// Run: node --experimental-strip-types lib/plot-thread-analysis.check.ts
import { analyzeThread, analyzeThreadNetwork, threadIntent, threadProgress, type NetworkThreadLike } from "./plot-thread-analysis.ts";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

// ev1..ev9 อยู่บท 1..9
const order = (eventId: string) => (eventId.startsWith("ev") ? Number(eventId.slice(2)) : null);
const t = (id: string, over: Partial<NetworkThreadLike> = {}): NetworkThreadLike =>
    ({ id, title: id, type: "mystery", status: "planted", beats: [], ...over });
const kinds = (threads: NetworkThreadLike[]) => analyzeThreadNetwork(threads, order).map((w) => w.kind);

// before: A ต้องเฉลยก่อน B
const A = (payAt: string | null) => t("A", {
    beats: payAt ? [{ eventId: payAt, role: "payoff" }] : [],
    links: [{ toThreadId: "B", kind: "before" }],
});
const B = t("B", { beats: [{ eventId: "ev5", role: "payoff" }] });
assert(kinds([A("ev3"), B]).length === 0, "before: A เฉลยบท 3 ก่อน B บท 5 → ไม่เตือน");
assert(kinds([A("ev5"), B]).length === 0, "before: เฉลยบทเดียวกัน → ไม่เตือน");
assert(kinds([A("ev7"), B]).includes("order_violation"), "before: A เฉลยหลัง B → เตือน");
assert(kinds([A(null), B]).includes("order_violation"), "before: B เฉลยแล้ว A ยังไม่เฉลย → เตือน");
assert(kinds([A(null), t("B")]).length === 0, "before: ทั้งคู่ยังไม่เฉลย → ไม่เตือน");

// misdirects: ปมหลอก D ต้องคลี่ก่อนปมจริง B
const D = (over: Partial<NetworkThreadLike>) => t("D", { links: [{ toThreadId: "B", kind: "misdirects" }], ...over });
assert(kinds([D({}), B]).includes("decoy_after_truth"), "misdirects: ปมหลอกไม่คลี่ แต่ปมจริงเฉลยแล้ว → เตือน");
assert(kinds([D({ status: "abandoned" }), B]).length === 0, "misdirects: ปมหลอกตั้งใจทิ้ง → ไม่เตือน");
assert(kinds([D({ beats: [{ eventId: "ev4", role: "payoff" }] }), B]).length === 0, "misdirects: คลี่ปมหลอกก่อน → ไม่เตือน");

// ประเด็นค้างหลังเฉลย
const pts = [{ id: "p1", text: "ใครเป็นคนส่งจดหมาย", status: "open" }, { id: "p2", text: "x", status: "resolved" }];
const w = analyzeThreadNetwork([t("P", { beats: [{ eventId: "ev3", role: "payoff" }], points: pts })], order);
assert(w.length === 1 && w[0].kind === "open_points_after_payoff" && w[0].pointTexts.length === 1, "เฉลยแล้วเหลือประเด็นเปิด 1 ข้อ → เตือนพร้อมข้อความ");
assert(kinds([t("P", { points: pts })]).length === 0, "ยังไม่เฉลย ประเด็นเปิดได้ → ไม่เตือน");

// ความตึง
const beats = (...ts: Array<number | null>) => ts.map((x, i) => ({ eventId: `ev${i + 1}`, role: "reinforce", tension: x }));
assert(kinds([t("T", { beats: beats(3, 2, 3) })]).includes("flat_tension"), "ความตึงไม่เคยเกินจุดแรก → จืด");
assert(kinds([t("T", { beats: beats(2, 2, 4) })]).length === 0, "ความตึงขึ้น → ไม่เตือน");
assert(kinds([t("T", { beats: beats(3, null, null) })]).length === 0, "คะแนนจุดเดียว → ไม่ตัดสิน");
assert(kinds([t("T", { beats: [{ eventId: "ev5", role: "seed", tension: 1 }, { eventId: "ev2", role: "seed", tension: 4 }] })]).includes("flat_tension"),
    "เรียงตามบท ไม่ใช่ลำดับใน array → บท 2=4 บท 5=1 จืด");

// เจตนา: ค่าเก่าอ่านเป็น active
assert(threadIntent("paid") === "active" && threadIntent("planted") === "active" && threadIntent("on_hold") === "on_hold", "status เก่า → active · ค่าใหม่คงเดิม");

// ความคืบหน้า: คำนวณจากฉาก + ประเด็น
const prog = (over: Partial<NetworkThreadLike>) => threadProgress(t("X", over));
assert(prog({}) === "unseeded", "ไม่มีฉาก → ยังไม่หว่าน");
assert(prog({ beats: [{ eventId: "ev1", role: "seed" }] }) === "seeded", "มีหว่าน → หว่านแล้ว");
assert(prog({ beats: [{ eventId: "ev1", role: "seed" }, { eventId: "ev2", role: "reinforce" }] }) === "developing", "มีย้ำ → กำลังสาน");
assert(prog({ beats: [{ eventId: "ev1", role: "seed" }], points: pts }) === "partial", "ยังไม่เฉลยแต่คลี่ประเด็นบางข้อ → บางส่วน");
assert(prog({ beats: [{ eventId: "ev5", role: "payoff" }], points: pts }) === "partial", "เฉลยแต่ประเด็นค้าง → บางส่วน");
assert(prog({ beats: [{ eventId: "ev5", role: "payoff" }] }) === "paid", "เฉลยไม่มีประเด็นค้าง → เฉลยครบ");
assert(prog({ status: "paid" }) === "unseeded", "กด paid เอง (ค่าเก่า) ไม่ทำให้นับว่าเฉลย");

// analyzeThread: เจตนา + บทเป้า
const seeded = (status: string) => t("S", { status, beats: [{ eventId: "ev1", role: "seed" }] });
assert(analyzeThread(seeded("active"), order, 10).stale, "active ไม่แตะ 9 บท → stale");
assert(!analyzeThread(seeded("on_hold"), order, 10).stale, "พักไว้ → ไม่ stale");
assert(analyzeThread(seeded("on_hold"), order, 10).dangling, "พักไว้ → ยังนับว่าค้าง");
assert(!analyzeThread(seeded("open_ended"), order, 10).dangling, "ปลายเปิด → ไม่ค้าง");
assert(!analyzeThread(seeded("abandoned"), order, 10).dangling, "ทิ้ง → ไม่ค้าง");
assert(analyzeThread(seeded("active"), order, 6, 5).overdue, "เป้าบท 5 อยู่บท 6 ยังไม่เฉลย → เลยเป้า");
assert(!analyzeThread(seeded("active"), order, 5, 5).overdue, "ยังอยู่บทเป้า → ไม่เตือน");
assert(!analyzeThread(seeded("on_hold"), order, 6, 5).overdue, "พักไว้ → ไม่เตือนเลยเป้า");
assert(!analyzeThread(seeded("active"), order, 6, null).overdue, "ไม่ตั้งเป้า → ไม่เตือน");

// ปมใหญ่เฉลยแล้ว แต่ปมย่อยค้าง
const parent = t("P1", { beats: [{ eventId: "ev5", role: "payoff" }] });
const kid = (id: string, over: Partial<NetworkThreadLike> = {}) => t(id, { parentThreadId: "P1", ...over });
const grand = t("G1", { parentThreadId: "K1" });
const cw = analyzeThreadNetwork([parent, kid("K1", { beats: [{ eventId: "ev4", role: "payoff" }] }), grand], order).find(w => w.kind === "children_open_after_payoff");
assert(cw?.kind === "children_open_after_payoff" && cw.childIds.join() === "G1", "หลานค้าง → เตือนที่ปมใหญ่ (นับทุกชั้น)");
assert(!kinds([parent, kid("K2", { status: "abandoned" })]).includes("children_open_after_payoff"), "ปมย่อยที่ทิ้งแล้ว → ไม่เตือน");
assert(!kinds([t("P1"), kid("K3")]).includes("children_open_after_payoff"), "ปมใหญ่ยังไม่เฉลย → ไม่เตือน");

console.log("plot-thread-analysis: all passed");

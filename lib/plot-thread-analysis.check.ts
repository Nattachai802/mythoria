// Run: node --experimental-strip-types lib/plot-thread-analysis.check.ts
import { analyzeThreadNetwork, type NetworkThreadLike } from "./plot-thread-analysis.ts";

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
const w = analyzeThreadNetwork([t("P", { status: "paid", points: pts })], order);
assert(w.length === 1 && w[0].kind === "open_points_after_payoff" && w[0].pointTexts.length === 1, "เฉลยแล้วเหลือประเด็นเปิด 1 ข้อ → เตือนพร้อมข้อความ");
assert(kinds([t("P", { points: pts })]).length === 0, "ยังไม่เฉลย ประเด็นเปิดได้ → ไม่เตือน");

// ความตึง
const beats = (...ts: Array<number | null>) => ts.map((x, i) => ({ eventId: `ev${i + 1}`, role: "reinforce", tension: x }));
assert(kinds([t("T", { beats: beats(3, 2, 3) })]).includes("flat_tension"), "ความตึงไม่เคยเกินจุดแรก → จืด");
assert(kinds([t("T", { beats: beats(2, 2, 4) })]).length === 0, "ความตึงขึ้น → ไม่เตือน");
assert(kinds([t("T", { beats: beats(3, null, null) })]).length === 0, "คะแนนจุดเดียว → ไม่ตัดสิน");
assert(kinds([t("T", { beats: [{ eventId: "ev5", role: "seed", tension: 1 }, { eventId: "ev2", role: "seed", tension: 4 }] })]).includes("flat_tension"),
    "เรียงตามบท ไม่ใช่ลำดับใน array → บท 2=4 บท 5=1 จืด");

console.log("plot-thread-analysis: all passed");

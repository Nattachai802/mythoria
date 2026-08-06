// เช็คตัวเอง — รัน: node --experimental-strip-types lib/chapter-report.check.ts
//
// ตรรกะสองก้อนที่พังเงียบได้: baseline ที่ไม่ตัดตัวเองออกจะรายงานว่า "ปกติ" เสมอ
// และ "ค้างมากี่บท" ที่นับจากจุดอ้างอิงผิดจะเตือนถูกตอนแต่ตัวเลขผิด

import assert from "node:assert";
import { zAgainstBaseline, MIN_BASELINE, type StylometryFeature } from "./stylometry-features.ts";
import { analyzeThread, makeEventChapterOrder, STALE_GAP } from "./plot-thread-analysis.ts";

// ── z เทียบ baseline ──
const feat: StylometryFeature = {
    key: "t", label: "t", shortLabel: "t", unit: "",
    color: "#000",
    extract: (d) => (d.lexicalRichness as { v?: number })?.v ?? null,
};
const at = (v: number | null) => ({ lexicalRichness: v === null ? {} : { v } });

{
    // baseline คงที่ 10 → ค่า 10 ต้องได้ z = 0
    const flat = [at(10), at(10), at(10), at(10)];
    const r = zAgainstBaseline(at(10), flat, feat);
    assert.strictEqual(r.raw, 10);
    assert.strictEqual(r.mean, 10);
    assert.strictEqual(r.z, 0);
}
{
    // ค่าที่หลุดออกจาก baseline ต้องได้ z สูง — และต้องไม่ถูกกดเพราะนับตัวเองเข้า baseline
    const base = [at(10), at(10), at(10), at(10), at(10), at(10)];
    const r = zAgainstBaseline(at(20), base, feat);
    assert.ok(r.z !== null && r.z > 100, `คาดว่า z สูงมาก ได้ ${r.z}`);
}
{
    // baseline น้อยกว่า MIN_BASELINE → คืนค่าดิบแต่ไม่ตัดสิน
    const r = zAgainstBaseline(at(20), Array(MIN_BASELINE - 1).fill(at(10)), feat);
    assert.strictEqual(r.raw, 20);
    assert.strictEqual(r.z, null);
    assert.strictEqual(r.mean, null);
}
{
    // ตอนนี้ไม่มีค่า → ไม่ตัดสิน ไม่ใช่ตีเป็น 0
    const r = zAgainstBaseline(at(null), [at(10), at(11), at(12), at(13)], feat);
    assert.strictEqual(r.raw, null);
    assert.strictEqual(r.z, null);
}

// ── ปมค้าง ──
const events = [
    { id: "e1", relatedChapterId: "c1" },
    { id: "e5", relatedChapterId: "c5" },
    { id: "eNull", relatedChapterId: null },
];
const chapters = [{ id: "c1", orderIndex: 1 }, { id: "c5", orderIndex: 5 }];
const order = makeEventChapterOrder(events, chapters);

const thread = (status: string, beats: Array<{ eventId: string; role: string }>) =>
    ({ id: "t", title: "t", type: "mystery", status, beats });

{
    // หว่านบท 1 ไม่เคยเฉลย ดูจากบท 12 → ค้าง 11 บท เกิน STALE_GAP
    const a = analyzeThread(thread("planted", [{ eventId: "e1", role: "seed" }]), order, 12);
    assert.strictEqual(a.dangling, true);
    assert.strictEqual(a.seedOrder, 1);
    assert.strictEqual(a.gap, 11);
    assert.strictEqual(a.stale, true);
}
{
    // จุดอ้างอิงคือ "ตอนที่กำลังรีวิว" ไม่ใช่บทสุดท้ายของเรื่อง
    // ดูจากบท 3 → ค้างแค่ 2 บท ยังไม่ควรเตือน
    const a = analyzeThread(thread("planted", [{ eventId: "e1", role: "seed" }]), order, 3);
    assert.strictEqual(a.gap, 2);
    assert.strictEqual(a.stale, false);
}
{
    // มี payoff → ไม่ค้าง แม้ status ยังเป็น planted
    // (auto-advance ใน server/plot-threads.ts ทำครึ่งเดียว จึงเชื่อ beats มากกว่า status)
    const a = analyzeThread(
        thread("planted", [{ eventId: "e1", role: "seed" }, { eventId: "e5", role: "payoff" }]),
        order, 12,
    );
    assert.strictEqual(a.dangling, false);
    assert.strictEqual(a.stale, false);
}
{
    // ผู้เขียนตั้งใจทิ้ง → ไม่ต้องเตือน
    const a = analyzeThread(thread("abandoned", [{ eventId: "e1", role: "seed" }]), order, 12);
    assert.strictEqual(a.dangling, false);
}
{
    // เฉลยโดยไม่เคยหว่าน
    const a = analyzeThread(thread("paid", [{ eventId: "e5", role: "payoff" }]), order, 12);
    assert.strictEqual(a.orphanPayoff, true);
}
{
    // beat ที่ผูกกับฉากซึ่งไม่ระบุบท ต้องถูกตัดออก ไม่ใช่นับเป็นบท 0
    const a = analyzeThread(thread("planted", [{ eventId: "eNull", role: "seed" }]), order, 12);
    assert.strictEqual(a.seedOrder, null);
    assert.strictEqual(a.gap, null);
    assert.strictEqual(a.stale, false, "ไม่มีข้อมูลบท ต้องไม่เดาว่าค้าง");
}

assert.ok(STALE_GAP > 0);
console.log("✅ chapter-report ผ่านทั้งหมด");

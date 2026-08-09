/**
 * "เกิดพร้อมกัน" แปลว่าอยู่จังหวะเดียวกัน — บังคับให้จริงเสมอ ไม่ใช่แค่ตอนตั้งค่าเส้น
 *
 * เดิมย้าย beat ให้ครั้งเดียวตอนกดเปลี่ยนชนิดเส้นเป็น simultaneous หลังจากนั้นลาก
 * การ์ดไปจังหวะอื่นหรือสั่งเรียงอัตโนมัติก็แยกคู่ออกจากกันได้ พอคู่อยู่คนละคอลัมน์
 * เส้นจะตกไปที่ตัววาดแบบ cross-beat แล้วลากยาวข้ามการ์ดอื่น — อาการที่เห็นคือ
 * "เส้นบั๊ค" แต่รากคือข้อมูลขัดกับความหมายของมันเอง
 *
 * pure + sync → ดู lib/simultaneous-beats.test.ts
 */

export type BeatItem = { id: string; beatIndex?: number; links?: unknown[] };

const targetOf = (l: unknown): { targetId: string; kind: string } | null => {
    if (typeof l === "string") return { targetId: l, kind: "related" };
    if (l && typeof l === "object" && "targetId" in l) {
        const o = l as { targetId: string; kind?: string };
        return { targetId: o.targetId, kind: o.kind ?? "related" };
    }
    return null;
};

/**
 * ดึงทุกการ์ดที่ผูก "เกิดพร้อมกัน" กับ anchor (ทางตรงและทางอ้อม) มาไว้จังหวะเดียวกับ anchor
 *
 * anchorIds เรียงตามลำดับความสำคัญ — ถ้ากลุ่มทับกัน anchor ที่มาก่อนชนะ
 * คืน array เดิมทั้งก้อนถ้าไม่มีอะไรต้องขยับ (กัน re-render เปล่า)
 */
export function snapSimultaneousBeats<T extends BeatItem>(items: T[], anchorIds: string[]): T[] {
    const adj = new Map<string, string[]>();
    const connect = (a: string, b: string) => {
        if (!adj.has(a)) adj.set(a, []);
        adj.get(a)!.push(b);
    };
    for (const it of items) {
        for (const raw of it.links ?? []) {
            const l = targetOf(raw);
            // เส้นเก็บไว้ที่ต้นทางฝั่งเดียว แต่ "พร้อมกัน" ไม่มีทิศ — ต่อสองทาง
            if (l?.kind === "simultaneous") { connect(it.id, l.targetId); connect(l.targetId, it.id); }
        }
    }
    if (adj.size === 0) return items;

    const byId = new Map(items.map((i) => [i.id, i]));
    const beatOf = new Map<string, number>();

    for (const start of anchorIds) {
        const anchor = byId.get(start);
        if (!anchor || anchor.beatIndex === undefined || beatOf.has(start)) continue;
        const beat = anchor.beatIndex;
        beatOf.set(start, beat);
        const queue = [start];
        while (queue.length) {
            for (const next of adj.get(queue.shift()!) ?? []) {
                if (beatOf.has(next) || !byId.has(next)) continue;
                beatOf.set(next, beat);
                queue.push(next);
            }
        }
    }

    if (![...beatOf].some(([id, b]) => byId.get(id)!.beatIndex !== b)) return items;
    return items.map((i) => (beatOf.has(i.id) && i.beatIndex !== beatOf.get(i.id)
        ? { ...i, beatIndex: beatOf.get(i.id) }
        : i));
}

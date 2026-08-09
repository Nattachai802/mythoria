// Run: npx tsx lib/simultaneous-beats.test.ts
import { snapSimultaneousBeats } from "./simultaneous-beats";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

const sim = (targetId: string) => ({ targetId, kind: "simultaneous" });
const leads = (targetId: string) => ({ targetId, kind: "leads_to" });
const beats = (items: { id: string; beatIndex?: number }[]) =>
    items.map((i) => `${i.id}:${i.beatIndex}`).join(" ");

// 1. ปลายทางตามต้นทางมา
assert(
    beats(snapSimultaneousBeats(
        [{ id: "a", beatIndex: 2, links: [sim("b")] }, { id: "b", beatIndex: 5 }],
        ["a"],
    )) === "a:2 b:2",
    "ปลายทางย้ายมาจังหวะเดียวกับ anchor",
);

// 2. ไม่มีทิศ — ลาก "ปลายทาง" ก็ต้องดึงต้นทางตาม
assert(
    beats(snapSimultaneousBeats(
        [{ id: "a", beatIndex: 2, links: [sim("b")] }, { id: "b", beatIndex: 5 }],
        ["b"],
    )) === "a:5 b:5",
    "anchor เป็นปลายทาง ต้นทางตามมา",
);

// 3. ลามทั้งกลุ่ม a—b—c
assert(
    beats(snapSimultaneousBeats(
        [
            { id: "a", beatIndex: 0, links: [sim("b")] },
            { id: "b", beatIndex: 4, links: [sim("c")] },
            { id: "c", beatIndex: 9 },
        ],
        ["a"],
    )) === "a:0 b:0 c:0",
    "ลามข้ามทอดไปทั้งกลุ่ม",
);

// 4. "นำไปสู่" ต้องข้ามจังหวะได้ ห้ามแตะ
assert(
    beats(snapSimultaneousBeats(
        [{ id: "a", beatIndex: 0, links: [leads("b")] }, { id: "b", beatIndex: 1 }],
        ["a"],
    )) === "a:0 b:1",
    "leads_to ไม่ถูกดึงมารวมจังหวะ",
);

// 5. ไม่มีอะไรต้องขยับ → คืน array เดิม (ไม่สร้างใหม่ กัน re-render เปล่า)
const same = [{ id: "a", beatIndex: 3, links: [sim("b")] }, { id: "b", beatIndex: 3 }];
assert(snapSimultaneousBeats(same, ["a"]) === same, "ตรงกันอยู่แล้ว → คืน reference เดิม");

// 6. ไม่มีเส้น simultaneous เลย → คืน reference เดิม
const none = [{ id: "a", beatIndex: 1 }, { id: "b", beatIndex: 2 }];
assert(snapSimultaneousBeats(none, ["a"]) === none, "ไม่มี simultaneous → คืน reference เดิม");

// 7. anchor แรกชนะเมื่อกลุ่มทับกัน
assert(
    beats(snapSimultaneousBeats(
        [{ id: "a", beatIndex: 1, links: [sim("b")] }, { id: "b", beatIndex: 7 }],
        ["a", "b"],
    )) === "a:1 b:1",
    "anchor ตัวแรกชนะ",
);

// 8. เส้นชี้ไปการ์ดที่ถูกลบแล้ว ต้องไม่ระเบิด
assert(
    beats(snapSimultaneousBeats([{ id: "a", beatIndex: 2, links: [sim("ghost")] }], ["a"])) === "a:2",
    "targetId ที่ไม่มีจริง → ข้ามไป",
);

// 9. วงกลม a—b—a ต้องไม่วนไม่รู้จบ
assert(
    beats(snapSimultaneousBeats(
        [{ id: "a", beatIndex: 3, links: [sim("b")] }, { id: "b", beatIndex: 8, links: [sim("a")] }],
        ["a"],
    )) === "a:3 b:3",
    "เส้นวนกลับ → จบได้ ไม่ loop",
);

// 10. links แบบเก่าที่เก็บเป็น string ล้วน = related ไม่ใช่ simultaneous
assert(
    beats(snapSimultaneousBeats(
        [{ id: "a", beatIndex: 0, links: ["b"] }, { id: "b", beatIndex: 6 }],
        ["a"],
    )) === "a:0 b:6",
    "link แบบ string เก่า ไม่ถือเป็น simultaneous",
);

console.log("\nALL PASS ✓");

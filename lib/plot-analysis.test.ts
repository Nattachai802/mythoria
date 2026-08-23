// Run: npx tsx lib/plot-analysis.test.ts
import { analyzePlot, buildCoverageReport, type CoverageInput } from "./plot-analysis";
import { buildSceneFormat, type SceneFormatInput } from "./story-format";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

// ── fixture ผูกกัน 3 ฉาก ────────────────────────────────────────────────

const scene = (i: number, over: Partial<SceneFormatInput> = {}): SceneFormatInput => ({
    event: { id: `ev${i}`, title: `ฉาก ${i}` },
    items: [{
        id: `item${i}a`, title: `การ์ดเดียว`, content: null, beatIndex: 0, laneId: "lane1",
        children: [{ id: `ch${i}`, title: "เอริส", type: "character" }],
    }],
    lanes: [{ id: "lane1", name: "เลนหลัก" }],
    threads: [],
    eventId: `ev${i}`,
    elementDetails: new Map(),
    ideaNotes: [],
    ...over,
});

// ปมที่หว่านไว้ในฉาก 1 แต่ไม่เคยเฉลย + ปมที่ไม่เคยผูกเลย + ปมที่เฉลยแล้ว
const threads: SceneFormatInput["threads"] = [
    {
        id: "th1", title: "ใครฆ่าพ่อของเอริส", status: "active", color: null,
        beats: [{ id: "b1", eventId: "ev1", canvasItemId: "item1a", role: "seed" }],
    },
    { id: "th2", title: "ปมลอย", status: "active", color: null, beats: [] },
    {
        id: "th3", title: "ปมจบแล้ว", status: "paid", color: null,
        beats: [{ id: "b3", eventId: "ev1", canvasItemId: "item1a", role: "payoff" }],
    },
];

const names = ["เอริส", "ไรกะ", "มารุ", "โยชิ", "คาเนะ", "ทากุ"];
const nameOnlyContent = "ทีมปฏิบัติการประกอบด้วย " + Array(20).fill(names.join(" ")).join(" ");

const scenes = [
    buildSceneFormat(scene(1, {
        threads,
        items: [
            {
                id: "item1a", title: "พบศพ", content: "เอริสเจอศพพ่อในบ้านร้าง", beatIndex: 0, laneId: "lane1",
                children: [{ id: "ch1", title: "เอริส", type: "character" }],
            },
            {
                id: "item1b", title: "สมาชิกทีม", content: nameOnlyContent, beatIndex: 1, laneId: "lane1",
                children: names.map((n, i) => ({ id: `cn${i}`, title: n, type: "character" })),
            },
        ],
    })),
    buildSceneFormat(scene(2, {
        threads,
        items: [
            {
                id: "item2a", title: "สืบสวน", content: "ไรกะช่วยสืบ", beatIndex: 0, laneId: "lane1",
                children: [{ id: "ch2", title: "ไรกะ", type: "character" }],
                links: [{ targetId: "item2b", kind: "leads_to", label: null }],
            },
            {
                id: "item2b", title: "ล่องลอย", content: null, beatIndex: 1, laneId: "lane2",
                children: [{ id: "ch3", title: "ผีเร่ร่อน", type: "dummy_character" }],
            },
        ],
        lanes: [{ id: "lane1", name: "เลนหลัก" }, { id: "lane2", name: "เลนรอง" }],
    })),
    buildSceneFormat(scene(3, {
        threads,
        items: [{
            id: "item3a", title: "เดินผ่านหมู่บ้าน", content: null, beatIndex: 0, laneId: "lane1",
            children: [
                { id: "ch4", title: "เอริส", type: "character" },
                { id: "ch5", title: "ชาวบ้านขี้เมา", type: "dummy_character" },
            ],
        }],
    })),
];

const coverage: CoverageInput = {
    scenes: [
        { id: "ev1", hasSceneGoal: true, hasStoryTimeIndex: false, hasStoryDuration: false, hasPovCharacterId: false, keyMomentCount: 1, cardCount: 2 },
        { id: "ev2", hasSceneGoal: false, hasStoryTimeIndex: false, hasStoryDuration: false, hasPovCharacterId: false, keyMomentCount: 0, cardCount: 2 },
        { id: "ev3", hasSceneGoal: false, hasStoryTimeIndex: false, hasStoryDuration: false, hasPovCharacterId: false, keyMomentCount: 0, cardCount: 1 },
    ],
    threads: [
        { id: "th1", boundBeatCount: 1 },
        { id: "th2", boundBeatCount: 0 },
        { id: "th3", boundBeatCount: 1 },
    ],
};

const report = analyzePlot(scenes, coverage);

// ── 1.1 ปมค้าง ─────────────────────────────────────────────────────────

const unpaid = report.findings.filter(f => f.checkId === "threads_unpaid");
assert(unpaid.length === 2, "2 dangling threads flagged (ค้าง 2 จาก 3)");
const floating = unpaid.find(f => f.subjectRef === "th2")!;
assert(floating.message.includes("ยังไม่ได้ผูกกับจังหวะไหนเลย"), "thread with no beats reported as unbound, not unpaid");
const seeded = unpaid.find(f => f.subjectRef === "th1")!;
assert(seeded.message.includes("[C01]"), "seeded thread points at the card code");
assert(!report.findings.some(f => f.subjectRef === "th3"), "paid thread not flagged");

// ── 1.2 ตัวละครหาย ─────────────────────────────────────────────────────

const vanished = report.findings.filter(f => f.checkId === "vanished_participant");
assert(vanished.some(v => v.subjectRef === "ชาวบ้านขี้เมา"), "one-card dummy without thread/link flagged");
assert(!vanished.some(v => v.subjectRef === "ผีเร่ร่อน"), "participant in a link-target card not flagged");
assert(!vanished.some(v => v.subjectRef === "ไรกะ"), "linked-card participant not flagged");
assert(!vanished.some(v => v.subjectRef === "เอริส"), "multi-card participant not flagged");

// ── 1.3 ฉากเส้นเดียว ───────────────────────────────────────────────────

const single = report.findings.find(f => f.checkId === "single_lane")!;
assert(single.message.includes("2/3"), "2 of 3 scenes single-lane");
assert(single.message.includes("ข้อสังเกต"), "single-lane framed as observation not defect");

// ── 1.4 โครงซ้ำ ─────────────────────────────────────────────────────────
// ฉาก 1 กับ 3: บทบาทปม/เลน/จำนวนจังหวะ/เส้นเชื่อม — ฉาก 1 แตะปม ฉาก 3 ไม่แตะ จึงไม่ซ้ำกัน

const rep = report.findings.filter(f => f.checkId === "repetitive_shape");
assert(rep.length === 0, "no identical shape among these 3 scenes");

const twinScenes = [
    buildSceneFormat(scene(10, { threads: [] })),
    buildSceneFormat(scene(11, { threads: [] })),
];
const twinReport = analyzePlot(twinScenes, { scenes: [], threads: [] });
assert(twinReport.findings.some(f => f.checkId === "repetitive_shape"), "two identical scenes flagged as repetitive");

// ── 1.5 จังหวะที่เนื้อความเป็นชื่อคน ─────────────────────────────────────

const nameOnly = report.findings.find(f => f.checkId === "name_only_beat");
assert(!!nameOnly, "name-heavy beat flagged");
assert(nameOnly!.message.includes("% เป็นชื่อผู้ร่วมฉาก"), "message reports the measured share");
assert(nameOnly!.sceneId === "ev1", "finding pinned to its scene");
const normal = report.findings.filter(f => f.checkId === "name_only_beat");
assert(normal.length === 1, "content-bearing beats not flagged");

// ── 1.0 coverage ────────────────────────────────────────────────────────

assert(report.coverage.blockedSummary.includes("ระยะเวลาในเรื่อง 0/3"), "blocked summary lists empty duration field");
assert(report.coverage.blockedSummary.includes("มุมมอง (POV) 0/3"), "blocked summary lists empty POV field");
assert(!report.coverage.blockedSummary.includes("เป้าหมายฉาก"), "partially filled field not in blocked line");
const goalRow = report.coverage.rows.find(r => r.field === "เป้าหมายฉาก")!;
assert(goalRow.filled === 1 && goalRow.total === 3, "goal coverage counted 1/3");

// ── spine ───────────────────────────────────────────────────────────────

assert(report.sceneCount === 3 && report.cardCount === 5, "scene/card totals exclude nothing real");
assert(report.spine[1].lanesUsed === 2, "spine lane count per scene");
assert(report.spine[0].findingCount >= 1, "spine carries per-scene finding count");

// ── แผนเปล่า ────────────────────────────────────────────────────────────

const empty = analyzePlot([], { scenes: [], threads: [] });
assert(empty.findings.length === 0, "empty novel yields no findings");
assert(empty.coverage.blockedSummary === "", "empty novel has no blocked line");

console.log("\n✅ All tests passed");

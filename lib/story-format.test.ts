// Run: npx tsx lib/story-format.test.ts
import { buildSceneFormat, renderSceneMarkdown, FORMAT_VERSION, type SceneFormatInput } from "./story-format";

function assert(cond: boolean, msg: string) {
    if (!cond) throw new Error("FAIL: " + msg);
    console.log("✓ " + msg);
}

// ── fixture ────────────────────────────────────────────────────────────

const makeInput = (overrides: Partial<SceneFormatInput> = {}): SceneFormatInput => ({
    event: {
        id: "ev1",
        title: "ฉากเปิดตัว",
        sceneGoal: "แนะนำตัวละคร",
        sceneConflict: "ศัตรูมาเยือน",
        sceneOutcome: "ongoing",
        causeKind: "therefore",
        causeNote: "เหตุผลจากฉากก่อน",
        description: "คำอธิบายของฉาก",
    },
    items: [
        {
            id: "item1", title: "อัศวินเข้าเฝ้า", content: "เนื้อหาจังหวะ 1",
            beatIndex: 0, laneId: "lane1", isNarration: false, keyMomentLabel: "สำคัญ",
            children: [
                { id: "ch1", title: "อัศวิน", type: "character" },
                { id: "ch2", title: "กษัตริย์", type: "character" },
            ],
            links: [{ targetId: "item2", kind: "leads_to", label: "สาเหตุ" }],
        },
        {
            id: "item2", title: "ข่าวร้ายจากชายแดน", content: "เนื้อหาจังหวะ 2",
            beatIndex: 1, laneId: "lane1",
            children: [
                { id: "ch3", title: "อัศวิน", type: "character" },
                { id: "ch4", title: "ผู้สื่อข่าว", type: "dummy_character" },
            ],
        },
        {
            id: "item3", title: "ทหารรักษาการณ์", content: null,
            beatIndex: 0, laneId: "lane2",
            children: [
                { id: "ch5", title: "กษัตริย์", type: "character" },
            ],
        },
    ],
    lanes: [
        { id: "lane1", name: "เลนหลัก" },
        { id: "lane2", name: "เลนรอง" },
    ],
    threads: [
        {
            id: "th1", title: "ปมศัตรูลึกลับ", status: "active", color: "#ff0000",
            beats: [
                { id: "b1", eventId: "ev1", canvasItemId: "item1", role: "seed" },
                { id: "b2", eventId: "ev1", canvasItemId: "item2", role: "reinforce" },
            ],
        },
        {
            id: "th2", title: "ปมมิตรภาพ", status: "active", color: "#00ff00",
            beats: [
                { id: "b3", eventId: "ev1", canvasItemId: "item1", role: "seed" },
                { id: "b4", eventId: "ev1", canvasItemId: null, role: "payoff" },
            ],
        },
    ],
    eventId: "ev1",
    elementDetails: new Map([
        ["item1-character-ch1", { action: "คุกเข่า", goal: "ขอพระราชทาน", outcome: "ongoing" }],
    ]),
    ideaNotes: [
        { canvasItemId: "item1", notes: "โน้ตจากนักเขียน" },
        { canvasItemId: "item1", notes: "โน้ตอีกอัน" },
    ],
    ...overrides,
});

// ── buildSceneFormat tests ─────────────────────────────────────────────

const fmt = buildSceneFormat(makeInput());

assert(fmt.formatVersion === FORMAT_VERSION, "format version is set");
assert(fmt.scene.title === "ฉากเปิดตัว", "scene title");
assert(fmt.scene.outcome === "ยังไม่จบ", "scene outcome translated");

// sorting: beatIndex 0 first, then by lane order
assert(fmt.beats[0].code === "C01", "first beat code is C01");
assert(fmt.beats[0].title === "อัศวินเข้าเฝ้า", "first beat is from lane1 beat0");
assert(fmt.beats[1].code === "C02", "second beat is lane2 beat0 (ทหารรักษาการณ์)");
assert(fmt.beats[1].title === "ทหารรักษาการณ์", "second beat title");
assert(fmt.beats[2].code === "C03", "third beat code");

// simultaneous
assert(fmt.beats[0].simultaneousWith.includes("C02"), "C01 simultaneous with C02");
assert(fmt.beats[1].simultaneousWith.includes("C01"), "C02 simultaneous with C01");
assert(fmt.beats[2].simultaneousWith.length === 0, "C03 has no simultaneous");

// alias: อัศวิน appears in item1 + item2 (2 cards), กษัตริย์ in item1 + item3 (2 cards)
assert(fmt.cast.length === 3, "cast has 3 entries (อัศวิน, กษัตริย์, ผู้สื่อข่าว)");
const knightCast = fmt.cast.find(c => c.name === "อัศวิน")!;
assert(knightCast.alias !== null, "อัศวิน gets alias (appears in 2 cards)");
assert(knightCast.cardCount === 2, "อัศวิน card count is 2");

const messengerCast = fmt.cast.find(c => c.name === "ผู้สื่อข่าว")!;
assert(messengerCast.alias === null, "ผู้สื่อข่าว has no alias (appears in 1 card only)");
assert(messengerCast.type === "ตัวประกอบ (ยังไม่ได้สร้างเป็นตัวละคร)", "dummy_character type label");

// participants with element details
const p0 = fmt.beats[0].participants[0];
assert(p0.name === "อัศวิน", "participant name");
assert(p0.action === "คุกเข่า", "participant action from elementDetails");
assert(p0.goal === "ขอพระราชทาน", "participant goal");
assert(p0.outcome === "ยังไม่จบ", "participant outcome translated");

// links
assert(fmt.beats[0].links.length === 1, "C01 has 1 link");
assert(fmt.beats[0].links[0].toCode === "C03", "link target is C03 (item2 sorted to position 3)");
assert(fmt.beats[0].links[0].kindLabel === "นำไปสู่", "link kind label");
assert(fmt.beats[0].links[0].label === "สาเหตุ", "link label");

// threads
assert(fmt.beats[0].threadTouches.length === 2, "C01 has 2 thread touches");
const dangling = fmt.threads.filter(t => t.dangling);
assert(dangling.length === 1, "1 dangling thread (ปมศัตรูลึกลับ has no payoff)");
assert(dangling[0].title === "ปมศัตรูลึกลับ", "dangling thread is ปมศัตรูลึกลับ");

const resolved = fmt.threads.find(t => t.title === "ปมมิตรภาพ")!;
assert(!resolved.dangling, "ปมมิตรภาพ has payoff → not dangling");

// notes
assert(fmt.beats[0].notes.length === 2, "C01 has 2 notes");
assert(fmt.beats[0].notes[0] === "โน้ตจากนักเขียน", "first note text");

// beatCount / cardCount
assert(fmt.beatCount === 2, "2 distinct beats (index 0 and 1)");
assert(fmt.cardCount === 3, "3 cards total");

// causeKind
assert(fmt.scene.causeKind === "therefore", "cause kind preserved");

// ── renderSceneMarkdown tests ──────────────────────────────────────────

const md = renderSceneMarkdown(fmt);

assert(md.includes("---\nเอกสาร: กระดานพล็อตรายฉาก"), "frontmatter opens");
assert(md.includes("ฉาก: ฉากเปิดตัว"), "scene title in frontmatter");
assert(md.includes("เป้าหมาย: แนะนำตัวละคร"), "goal in frontmatter");
assert(md.includes("อุปสรรค: ศัตรูมาเยือน"), "conflict in frontmatter");
assert(md.includes("ผล: ยังไม่จบ"), "outcome in frontmatter");
assert(md.includes("ต่อจากฉากก่อน: ดังนั้น — เหตุผลจากฉากก่อน"), "cause in frontmatter");
assert(md.includes("จำนวนจังหวะ: 2"), "beat count in frontmatter");
assert(md.includes("จำนวนการ์ด: 3"), "card count in frontmatter");

assert(md.includes("[C01]"), "C01 code in output");
assert(md.includes("[C02]"), "C02 code in output");
assert(md.includes("[C03]"), "C03 code in output");

assert(md.includes("เกิดพร้อมกันกับ: [C02]"), "simultaneous reference");
assert(md.includes("เหตุการณ์สำคัญ: สำคัญ"), "key moment");
assert(md.includes("ผู้ร่วมฉากทั้งหมด:"), "cast table header");
assert(md.includes("| ตัวย่อ | ชื่อ | ชนิด | อยู่กี่การ์ด |"), "cast table columns");

// alias substitution
assert(md.includes(`@${knightCast.alias!.replace("@", "")}`), "alias used in output");

assert(md.includes("ปมทั้งหมดที่ผ่านฉากนี้:"), "thread summary section");
assert(md.includes("ปมที่ยังไม่เฉลย:"), "dangling threads section");
assert(md.includes("ปมศัตรูลึกลับ"), "dangling thread name");

assert(md.includes("นำไปสู่ → [C03]"), "link rendered with kind label");
assert(md.includes("(สาเหตุ)"), "link label in parentheses");

assert(md.includes("โน้ตของนักเขียน:"), "notes section");
assert(md.includes("- โน้ตจากนักเขียน"), "note content");

assert(md.includes("วิธีอ่านเอกสารนี้:"), "reading guide");
assert(md.includes("คำอธิบายของฉาก"), "description rendered");

// ── Edge case: empty scene ─────────────────────────────────────────────

const emptyFmt = buildSceneFormat(makeInput({
    items: [],
    threads: [],
    ideaNotes: [],
    elementDetails: new Map(),
    event: { id: "ev2" },
}));
assert(emptyFmt.beats.length === 0, "empty scene has no beats");
assert(emptyFmt.cast.length === 0, "empty scene has no cast");
assert(emptyFmt.scene.title === "(ไม่มีชื่อ)", "empty scene title fallback");
const emptyMd = renderSceneMarkdown(emptyFmt);
assert(emptyMd.includes("ฉาก: (ไม่มีชื่อ)"), "empty scene markdown has fallback title");

// ── Edge case: causeKind = but_then ────────────────────────────────────

const butFmt = buildSceneFormat(makeInput({
    event: { id: "ev3", title: "ฉาก3", causeKind: "but_then", causeNote: "อะไรบางอย่าง" },
}));
const butMd = renderSceneMarkdown(butFmt);
assert(butMd.includes("ต่อจากฉากก่อน: แต่ว่า — อะไรบางอย่าง"), "but_then cause rendered");

// ── ตัวย่อยึด @ นำหน้า ─────────────────────────────────────────────────
// "อัศวิน" โผล่ 2 การ์ดจึงได้ตัวย่อ ชื่อนี้เป็นส่วนหนึ่งของคำว่า "อัศวินดำ" ได้
// และภาษาไทยไม่เว้นวรรค ถ้าแทนชื่อเปล่าจะไปตัดกลางคำอื่น

const aliasFmt = buildSceneFormat(makeInput({
    items: [
        {
            id: "item1", title: "ก", content: "เขาเห็นอัศวินดำยืนอยู่ แล้ว @อัศวิน ก็เดินเข้ามา",
            beatIndex: 0, laneId: "lane1",
            children: [{ id: "ch1", title: "อัศวิน", type: "character" }],
        },
        {
            id: "item2", title: "ข", content: null, beatIndex: 1, laneId: "lane1",
            children: [{ id: "ch2", title: "อัศวิน", type: "character" }],
        },
    ],
}));
const aliasMd = renderSceneMarkdown(aliasFmt);

assert(aliasMd.includes("เขาเห็นอัศวินดำยืนอยู่"), "bare name inside another word is left alone");
assert(aliasMd.includes("แล้ว @A ก็เดินเข้ามา"), "@name is replaced by the alias");
assert(!aliasMd.includes("@@"), "alias never doubles the @");

// ── โน้ตบนกระดานไม่ใช่เหตุการณ์ ─────────────────────────────────────────

const noteFmt = buildSceneFormat(makeInput({
    items: [
        { id: "n1", type: "sticky-note", title: "อย่าลืมแก้ชื่อเมือง", content: null, beatIndex: 0, laneId: "lane1" },
        { id: "a1", title: "การ์ดจริง ก", content: null, beatIndex: 0, laneId: "lane1" },
        { id: "a2", title: "การ์ดจริง ข", content: null, beatIndex: 0, laneId: "lane2" },
    ],
}));

const noteBeat = noteFmt.beats.find(b => b.id === "n1")!;
const realBeat = noteFmt.beats.find(b => b.id === "a1")!;

assert(noteBeat.isBoardNote, "sticky note flagged as board note");
assert(noteBeat.simultaneousWith.length === 0, "board note is simultaneous with nothing");
assert(!realBeat.simultaneousWith.includes(noteBeat.code), "board note excluded from other cards' simultaneous list");
assert(realBeat.simultaneousWith.length === 1, "real card still sees the other real card");
assert(renderSceneMarkdown(noteFmt).includes("เป็นโน้ตที่นักเขียนแปะไว้บนกระดาน"), "board note labelled in markdown");

// ── 4a: formatVersion ลง frontmatter เสมอ ─────────────────────────────

assert(md.includes(`formatVersion: ${FORMAT_VERSION}`), "formatVersion rendered in frontmatter");
assert(emptyMd.includes(`formatVersion: ${FORMAT_VERSION}`), "formatVersion rendered even in empty scene");

// ── 4b: ปมที่ไม่แตะฉากนี้ไม่ลงตารางสรุป แต่ปมค้างยังโผล่ ──────────────────

const otherThread = {
    id: "th9", title: "ปมฉากอื่น", status: "active", color: null,
    beats: [{ id: "b9", eventId: "evX", canvasItemId: null, role: "seed" }],
};
const crossFmt = buildSceneFormat(makeInput({
    threads: [...makeInput().threads, otherThread],
}));
const crossMd = renderSceneMarkdown(crossFmt);
const table = crossMd.slice(crossMd.indexOf("ปมทั้งหมดที่ผ่านฉากนี้:"), crossMd.indexOf("ปมที่ยังไม่เฉลย:"));
assert(!table.includes("ปมฉากอื่น"), "thread from another scene excluded from summary table");
assert(crossMd.includes("ปมฉากอื่น — แตะในฉากอื่น ยังไม่ผูกในฉากนี้"), "dangling thread from another scene still listed with honest label");

// ── 4c: ชื่อพ้องคนละชนิดไม่ยุบเป็นแถวเดียว ──────────────────────────────

const dupFmt = buildSceneFormat(makeInput({
    items: [
        {
            id: "item1", title: "ก", content: null, beatIndex: 0, laneId: "lane1",
            children: [
                { id: "c1", title: "ปราสาท", type: "character" },
                { id: "c2", title: "ปราสาท", type: "building" },
            ],
        },
        {
            id: "item2", title: "ข", content: null, beatIndex: 1, laneId: "lane1",
            children: [{ id: "c3", title: "ปราสาท", type: "character" }],
        },
    ],
}));
const castleRows = dupFmt.cast.filter(c => c.name === "ปราสาท");
assert(castleRows.length === 2, "same name different type = 2 cast rows");
assert(castleRows.some(r => r.type === "ตัวละคร" && r.cardCount === 2), "character ปราสาท counts 2 cards");
assert(castleRows.some(r => r.type === "สถานที่" && r.cardCount === 1), "building ปราสาท counts 1 card");

// ── 4e: การ์ดคำบรรยายที่ยังมี children ไม่ขัดกับตัวเอง ───────────────────

const narrFmt = buildSceneFormat(makeInput({
    items: [{
        id: "item1", title: "คำบรรยายเปิดเรื่อง", content: null,
        beatIndex: 0, laneId: "lane1", isNarration: true,
        children: [{ id: "c1", title: "อัศวิน", type: "character" }],
    }],
}));
const narrMd = renderSceneMarkdown(narrFmt);
assert(!narrMd.includes("ไม่มีตัวละครร่วมฉาก"), "narration with participants does not claim no characters");
assert(narrMd.includes("ตั้งเป็นคำบรรยาย แต่การ์ดยังผูกผู้ร่วมฉากไว้:"), "narration with participants states the truth");

// ── 4f: causeKind ไม่รู้จักแสดง raw, ชื่อมี | ถูก escape ────────────────

const rawCauseFmt = buildSceneFormat(makeInput({
    event: { id: "ev4", title: "ฉาก4", causeKind: "meanwhile" },
}));
assert(renderSceneMarkdown(rawCauseFmt).includes("ต่อจากฉากก่อน: meanwhile"), "unknown causeKind shown raw, not guessed as แต่ว่า");

const pipeFmt = buildSceneFormat(makeInput({
    items: [{
        id: "item1", title: "ก", content: null, beatIndex: 0, laneId: "lane1",
        children: [{ id: "c1", title: "ทด|สอบ", type: "character" }],
    }],
}));
const pipeMd = renderSceneMarkdown(pipeFmt);
assert(pipeMd.includes("| ทด\\|สอบ |"), "pipe in cast name escaped");
const pipeThreadFmt = buildSceneFormat(makeInput({
    threads: [{ id: "th1", title: "ปม|ทดสอบ", status: "active", color: null, beats: [{ id: "b1", eventId: "ev1", canvasItemId: "item1", role: "seed" }] }],
}));
assert(renderSceneMarkdown(pipeThreadFmt).includes("| ปม\\|ทดสอบ |"), "pipe in thread title escaped");

// ── 4f: จำนวนการ์ดไม่นับ sticky note ───────────────────────────────────

assert(noteFmt.cardCount === 2, "cardCount excludes board notes");
assert(noteFmt.beatCount === 1, "beatCount from real cards only");

console.log("\n✅ All tests passed");

/**
 * ฟอร์แมตกลางของเรื่อง — ระดับฉาก (Scene)
 *
 * ที่มา: docs/story-format-plan.md
 *
 * buildSceneFormat()  → โครงสร้างจริง (ทุกผู้ใช้อ่านจากนี้)
 * renderSceneMarkdown() → ข้อความ Markdown (ให้ LLM อ่าน / ให้นักเขียนโหลด)
 *
 * ไม่มี side effect — ไม่ดาวน์โหลด ไม่ toast ไม่เรียก DOM
 * ไม่มี "use client" / "use server" — ใช้ได้ทั้งสองฝั่ง
 */

import { normalizeLink, LINK_KINDS, type CanvasLink } from "./link-kinds";

// ─── Version ───────────────────────────────────────────────────────────
export const FORMAT_VERSION = "1";

// ─── Types ─────────────────────────────────────────────────────────────

export interface CastEntry {
    alias: string | null;   // "@A" หรือ null ถ้าโผล่ครั้งเดียว
    name: string;
    type: string;           // ตัวละคร, ตัวประกอบ, สถานที่ ฯลฯ
    cardCount: number;
}

export interface BeatParticipant {
    alias: string | null;
    name: string;
    type: string;
    action?: string | null;
    goal?: string | null;
    outcome?: string | null;
}

export interface ThreadTouch {
    threadId: string;
    title: string;
    role: string;           // seed | reinforce | payoff
}

export interface BeatLink {
    toCode: string;         // "C03"
    toTitle: string;
    kind: string;
    kindLabel: string;
    label?: string | null;
}

export interface FormatBeat {
    code: string;           // "C01"
    id: string;
    beatIndex: number;
    lane: string;
    title: string;
    content?: string | null;
    isNarration: boolean;
    /** โน้ตที่นักเขียนแปะไว้บนกระดาน ไม่ใช่เหตุการณ์ในเรื่อง */
    isBoardNote: boolean;
    keyMoment?: string | null;
    simultaneousWith: string[];   // รหัส ["C02"]
    participants: BeatParticipant[];
    links: BeatLink[];
    threadTouches: ThreadTouch[];
    notes: string[];
}

export interface ThreadSummary {
    id: string;
    title: string;
    status: string;
    roles: string[];        // บทบาทเฉพาะฉากนี้ ["หว่าน", "ย้ำ"] — ว่าง = ไม่เคยแตะฉากนี้
    dangling: boolean;      // ยังไม่มี payoff
    danglingAtCards: string[];  // รหัส ["C01"]
}

export interface SceneFormat {
    formatVersion: string;
    scene: {
        id: string;
        title: string;
        goal?: string | null;
        conflict?: string | null;
        outcome?: string | null;
        causeKind?: string | null;
        causeNote?: string | null;
        description?: string | null;
    };
    beatCount: number;
    cardCount: number;
    cast: CastEntry[];
    beats: FormatBeat[];
    threads: ThreadSummary[];
}

// ─── Label maps (ย้ายจาก handleExportMarkdown) ─────────────────────────

const ROLE_LABEL: Record<string, string> = { seed: "หว่าน", reinforce: "ย้ำ", payoff: "เฉลย" };
const CAUSE_LABEL: Record<string, string> = { therefore: "ดังนั้น", but_then: "แต่ว่า" };
// ค่าที่ไม่รู้จักแสดง raw — ไม่เดาเป็น "แต่ว่า" เหมือนเดิม (คนละมาตรฐานกับ clean() ใน server/power-rule.ts)
const causeLabel = (k?: string | null) => (k ? (CAUSE_LABEL[k] ?? k) : null);
const OUTCOME_LABEL: Record<string, string> = { success: "สำเร็จ", failure: "ล้มเหลว", ongoing: "ยังไม่จบ", unknown: "ไม่แน่ชัด" };
// ชนิดที่โผล่จริงในข้อมูล: character, dummy_character, building, faction, sticky-note
// dummy = ตัวประกอบที่ยังไม่ได้สร้างเป็นตัวละครจริง — บอกไว้ ไม่งั้น AI จะรายงานว่าข้อมูลตัวละครหาย
const TYPE_LABEL: Record<string, string> = {
    character: "ตัวละคร",
    dummy_character: "ตัวประกอบ (ยังไม่ได้สร้างเป็นตัวละคร)",
    building: "สถานที่",
    location: "สถานที่",
    faction: "กลุ่ม",
    idea: "ไอเดีย",
    group: "กลุ่มการ์ด",
    "sticky-note": "โน้ต",
};
const typeLabel = (t?: string) =>
    (t && (TYPE_LABEL[t] ?? TYPE_LABEL[t.replace(/^dummy_/, "")])) || t || "-";

// ─── Alias utilities ───────────────────────────────────────────────────

const letter = (i: number) => i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));

function buildAliasMap(nameCards: Map<string, Set<string>>): Map<string, string> {
    const aliasOf = new Map<string, string>();
    // ตั้งตัวย่อเฉพาะชื่อที่โผล่ตั้งแต่ 2 การ์ดขึ้นไป — โผล่หนเดียวย่อแล้วไม่ประหยัด แถมเสียแถวใน legend ฟรี
    [...nameCards.entries()]
        .filter(([, set]) => set.size >= 2)
        .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
        .forEach(([name], i) => aliasOf.set(name, `@${letter(i)}`));
    return aliasOf;
}

function buildSubstituter(aliasOf: Map<string, string>): (t?: string | null) => string {
    // ยึด @ นำหน้าเสมอ — ในแอปนี้การอ้างถึงตัวละครในข้อความเขียนเป็น "@ชื่อ" อยู่แล้ว
    // (ดู renderNoteMentions ใน canvas-item.tsx ที่ใช้ anchor เดียวกัน)
    //
    // แทนชื่อเปล่าไม่ได้ด้วยสองเหตุผล: ภาษาไทยไม่เว้นวรรคระหว่างคำ ชื่อสั้นอย่าง "แดง"
    // จะไปกินคำอื่น ("ชุดสีแดง" -> "ชุดสี@A") และ "@ชื่อ" ที่เขียนถูกอยู่แล้วจะได้ @ ซ้อน
    // เพราะตัวย่อมี @ ในตัว
    //
    // ชื่อยาวก่อนชื่อสั้น กันชื่อที่เป็นส่วนหนึ่งของอีกชื่อไปตัดกลางคำ
    const aliasRe = aliasOf.size
        ? new RegExp("@(?:" + [...aliasOf.keys()].sort((a, b) => b.length - a.length)
            .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")", "g")
        : null;
    // alias มี @ ในตัวแล้ว จึงคืนตรง ๆ ไม่ต้องเติม @ ซ้ำ
    return (t?: string | null) => !t ? "" : (aliasRe ? t.replace(aliasRe, m => aliasOf.get(m.slice(1)) ?? m) : t);
}

// ─── Input types ───────────────────────────────────────────────────────

export interface SceneFormatInput {
    event: {
        id: string;
        title?: string | null;
        sceneGoal?: string | null;
        sceneConflict?: string | null;
        sceneOutcome?: string | null;
        causeKind?: string | null;
        causeNote?: string | null;
        description?: string | null;
    };
    items: Array<{
        id: string;
        /** ชนิดการ์ด — "sticky-note" คือโน้ตของนักเขียน ไม่ใช่เหตุการณ์ */
        type?: string;
        title?: string | null;
        content?: string | null;
        beatIndex?: number;
        laneId: string;
        isNarration?: boolean;
        keyMomentLabel?: string | null;
        children?: Array<{ id: string; referenceId?: string; title: string; type: string }>;
        links?: unknown[];
    }>;
    lanes: Array<{ id: string; name: string }>;
    threads: Array<{
        id: string;
        title: string;
        status: string;
        color: string | null;
        beats: Array<{ id: string; eventId: string; canvasItemId: string | null; role: string }>;
    }>;
    eventId: string;
    elementDetails: Map<string, { action?: string | null; goal?: string | null; outcome?: string | null }>;
    ideaNotes: Array<{ canvasItemId?: string | null; notes?: string | null }>;
}

// ─── buildSceneFormat ──────────────────────────────────────────────────

export function buildSceneFormat(input: SceneFormatInput): SceneFormat {
    const { event, items, lanes, threads, eventId, elementDetails, ideaNotes } = input;

    const laneName = new Map(lanes.map(l => [l.id, l.name]));
    const laneOrder = new Map(lanes.map((l, i) => [l.id, i]));

    // เรียงตามเวลาเล่า: จังหวะ แล้วเลน — ลำดับนี้กำหนดรหัส [C01] ด้วย
    const sorted = [...items].sort((a, b) =>
        ((a.beatIndex ?? 0) - (b.beatIndex ?? 0)) || ((laneOrder.get(a.laneId) ?? 0) - (laneOrder.get(b.laneId) ?? 0)));

    const codeById = new Map<string, string>(
        sorted.map((it, i) => [it.id, `C${String(i + 1).padStart(2, "0")}`]));
    const itemById = new Map(items.map(it => [it.id, it]));

    // ── Notes by item ──
    const notesByItem = new Map<string, Array<{ notes?: string | null }>>();
    ideaNotes.forEach(n => {
        if (!n.canvasItemId) return;
        const a = notesByItem.get(n.canvasItemId) ?? [];
        a.push(n); notesByItem.set(n.canvasItemId, a);
    });

    // ── ตัวย่อผู้ร่วมฉาก ──
    // คีย์ด้วย ชนิด+ชื่อ — ตัวละครชื่อ "ปราสาท" กับสถานที่ชื่อ "ปราสาท" คนละคน
    // ไม่ต้องยุบเป็นแถวเดียว (ชื่อพ้องก็จริง แต่นับการ์ดผสมและบอกชนิดผิด)
    const castKey = (c: { title: string; type: string }) => `${c.type}\u0000${c.title}`;
    const nameCards = new Map<string, Set<string>>();
    const nameType = new Map<string, string>();
    sorted.forEach(item => {
        ((item.children ?? []) as any[]).forEach(c => {
            if (!c.title) return;
            const k = castKey(c);
            const set = nameCards.get(k) ?? new Set<string>();
            set.add(item.id); nameCards.set(k, set);
            if (!nameType.has(k)) nameType.set(k, typeLabel(c.type));
        });
    });

    const aliasOf = buildAliasMap(nameCards);

    // ── cardBeats: canvasItemId → beat info ──
    const cardBeats = new Map<string, Array<{ threadId: string; title: string; role: string }>>();
    threads.forEach(t => t.beats.forEach(b => {
        if (b.eventId !== eventId || !b.canvasItemId) return;
        const arr = cardBeats.get(b.canvasItemId) ?? [];
        arr.push({ threadId: t.id, title: t.title, role: b.role });
        cardBeats.set(b.canvasItemId, arr);
    }));

    // ── Cast ──
    const cast: CastEntry[] = [...nameCards.entries()]
        .sort((a, b) => b[1].size - a[1].size || a[0].split("\u0000")[1].localeCompare(b[0].split("\u0000")[1]))
        .map(([k, set]) => ({
            alias: aliasOf.get(k) ?? null,
            name: k.split("\u0000")[1],
            type: nameType.get(k) ?? "-",
            cardCount: set.size,
        }));

    // ── การ์ดที่อยู่จังหวะเดียวกัน ──
    // จัดกลุ่มรอบเดียวแทนการ filter ซ้ำในทุกการ์ด
    // โน้ตบนกระดานไม่นับ — มันไม่ใช่เหตุการณ์ จะบอกว่า "เกิดพร้อมกัน" กับอะไรไม่ได้
    const isNote = (it: { type?: string }) => it.type === "sticky-note";
    const codesByBeat = new Map<number, string[]>();
    sorted.forEach(it => {
        if (isNote(it)) return;
        const b = it.beatIndex ?? 0;
        codesByBeat.set(b, [...(codesByBeat.get(b) ?? []), codeById.get(it.id)!]);
    });

    // ── Beats ──
    const beats: FormatBeat[] = sorted.map(item => {
        const code = codeById.get(item.id)!;

        // simultaneous
        const together = isNote(item)
            ? []
            : (codesByBeat.get(item.beatIndex ?? 0) ?? []).filter(c => c !== code);

        // participants
        const kids = (item.children ?? []) as any[];
        const participants: BeatParticipant[] = kids.map(c => {
            const det = elementDetails.get(`${item.id}-${c.type}-${c.referenceId || c.id}`);
            return {
                alias: aliasOf.get(castKey(c)) ?? null,
                name: c.title,
                type: typeLabel(c.type),
                action: det?.action ?? null,
                goal: det?.goal ?? null,
                outcome: det?.outcome ? (OUTCOME_LABEL[det.outcome] ?? det.outcome) : null,
            };
        });

        // links
        const rawLinks = (item.links ?? []).map(normalizeLink)
            .filter((l: CanvasLink) => codeById.has(l.targetId));
        const beatLinks: BeatLink[] = rawLinks.map((l: CanvasLink) => {
            const t = itemById.get(l.targetId);
            return {
                toCode: codeById.get(l.targetId)!,
                toTitle: t?.title ?? "",
                kind: l.kind,
                kindLabel: LINK_KINDS[l.kind]?.label ?? l.kind,
                label: l.label ?? null,
            };
        });

        // thread touches
        const bts = cardBeats.get(item.id) ?? [];
        const threadTouches: ThreadTouch[] = bts.map(b => ({
            threadId: b.threadId,
            title: b.title,
            role: b.role,
        }));

        // notes
        const itemNotes = (notesByItem.get(item.id) ?? [])
            .filter(n => n.notes)
            .map(n => n.notes!);

        return {
            code,
            id: item.id,
            beatIndex: item.beatIndex ?? 0,
            lane: laneName.get(item.laneId) ?? "-",
            title: item.title || "(ไม่มีชื่อ)",   // || ไม่ใช่ ?? — ชื่อว่างต้องได้ fallback ด้วย
            content: item.content ?? null,
            isNarration: !!item.isNarration,
            isBoardNote: isNote(item),
            keyMoment: item.keyMomentLabel ?? null,
            simultaneousWith: together,
            participants,
            links: beatLinks,
            threadTouches,
            notes: itemNotes,
        };
    });

    // ── Threads ──
    // roles นับเฉพาะจังหวะในฉากนี้ — roles ว่าง = ปมนั้นไม่เคยแตะฉากนี้
    // ตัวปมเองเก็บทุกตัวไว้ เพราะ dangling มองทั้งเรื่อง — ปมค้างเป็นคำถาม
    // ระดับนิยาย ฉากอื่นปล่อยไว้ไม่เฉลยก็ต้องเห็นที่นี่
    const threadSummaries: ThreadSummary[] = threads.map(t => {
        const sceneBeats = t.beats.filter(b => b.eventId === eventId);
        const hasPayoff = t.beats.some(b => b.role === "payoff");
        const closedByAuthor = t.status === "paid" || t.status === "abandoned";
        const dangling = !closedByAuthor && !hasPayoff;
        const roles = sceneBeats.map(b => ROLE_LABEL[b.role] ?? b.role);
        const danglingAtCards = dangling
            ? sceneBeats
                .filter(b => b.canvasItemId && codeById.has(b.canvasItemId))
                .map(b => codeById.get(b.canvasItemId!)!)
            : [];
        return {
            id: t.id,
            title: t.title,
            status: t.status,
            roles,
            dangling,
            danglingAtCards,
        };
    });

    // โน้ตบนกระดานไม่ใช่การ์ดเหตุการณ์ — ไม่นับเข้าจำนวนจังหวะ/การ์ด
    const realCards = sorted.filter(i => !isNote(i));
    const beatCountReal = new Set(realCards.map(i => i.beatIndex ?? 0)).size;

    return {
        formatVersion: FORMAT_VERSION,
        scene: {
            id: event.id,
            title: event.title || "(ไม่มีชื่อ)",
            goal: event.sceneGoal ?? null,
            conflict: event.sceneConflict ?? null,
            outcome: event.sceneOutcome ? (OUTCOME_LABEL[event.sceneOutcome] ?? event.sceneOutcome) : null,
            causeKind: event.causeKind ?? null,
            causeNote: event.causeNote ?? null,
            description: event.description ?? null,
        },
        beatCount: beatCountReal,
        cardCount: realCards.length,
        cast,
        beats,
        threads: threadSummaries,
    };
}

// ─── renderSceneMarkdown ───────────────────────────────────────────────

export function renderSceneMarkdown(format: SceneFormat): string {
    // สร้าง alias map จาก cast เพื่อ substitute ในข้อความ
    const aliasOf = new Map<string, string>();
    format.cast.forEach(c => { if (c.alias) aliasOf.set(c.name, c.alias); });
    const sub = buildSubstituter(aliasOf);

    const openThreads = format.threads.filter(t => t.dangling);
    // ชื่อที่มี | จะตัดคอลัมน์ตาราง Markdown —  escape ทุก cell
    const esc = (s: string) => s.replace(/\|/g, "\\|");
    const L: string[] = [];

    // frontmatter: ให้ AI รู้ขนาดและโฟกัสก่อนอ่านเนื้อ
    L.push("---");
    L.push("เอกสาร: กระดานพล็อตรายฉาก (หนึ่งไฟล์ = หนึ่งฉาก)");
    L.push(`formatVersion: ${format.formatVersion}`);
    L.push(`ฉาก: ${sub(format.scene.title)}`);
    if (format.scene.goal) L.push(`เป้าหมาย: ${sub(format.scene.goal)}`);
    if (format.scene.conflict) L.push(`อุปสรรค: ${sub(format.scene.conflict)}`);
    if (format.scene.outcome) L.push(`ผล: ${format.scene.outcome}`);
    if (format.scene.causeKind) {
        const w = causeLabel(format.scene.causeKind);
        L.push(`ต่อจากฉากก่อน: ${w}${format.scene.causeNote ? ` — ${sub(format.scene.causeNote)}` : ""}`);
    }
    L.push(`จำนวนจังหวะ: ${format.beatCount}`);
    L.push(`จำนวนการ์ด: ${format.cardCount}`);
    L.push(`ปมที่ยังไม่เฉลย: ${openThreads.length}`);
    L.push("---");

    // ไม่ซ้ำชื่อฉากอีกรอบ — frontmatter บอกไปแล้ว พอไม่มี # heading มันก็เหลือแค่บรรทัดซ้ำเปล่า ๆ
    if (format.scene.description) L.push("", sub(format.scene.description));

    L.push("", "วิธีอ่านเอกสารนี้:");
    L.push("- จังหวะ = ช่วงเวลาในฉาก เรียงตามลำดับการเล่า การ์ดที่อยู่จังหวะเดียวกัน คือเหตุการณ์ที่เกิดขึ้นพร้อมกัน");
    L.push("- เลน = สายเรื่องที่เดินขนานกัน คนละเลนในจังหวะเดียวกัน = เกิดพร้อมกันคนละที่หรือคนละกลุ่ม");
    L.push("- การ์ดทุกใบมีรหัส [C01] เส้นเชื่อมอ้างถึงรหัสนี้เสมอ ไม่ได้อ้างด้วยชื่อ");
    L.push("- ปม = เรื่องที่ต้องเฉลยภายหลัง มีสามบทบาท: หว่าน (ตั้งคำถาม) → ย้ำ (เตือนว่ายังค้าง) → เฉลย (ตอบ)");
    if (aliasOf.size) {
        L.push("- ผู้ร่วมฉากที่โผล่หลายการ์ดใช้ตัวย่อขึ้นต้นด้วย @ เช่น @A — ดูตารางถัดไป");
    }

    if (format.cast.length) {
        L.push("", "ผู้ร่วมฉากทั้งหมด:");
        L.push("| ตัวย่อ | ชื่อ | ชนิด | อยู่กี่การ์ด |");
        L.push("|---|---|---|---|");
        format.cast.forEach(c => {
            L.push(`| ${c.alias ?? "—"} | ${esc(c.name)} | ${esc(c.type)} | ${c.cardCount} / ${format.cardCount} |`);
        });
    }

    format.beats.forEach(beat => {
        L.push("", `[${beat.code}] ${sub(beat.title)}`);

        const beatNo = String(beat.beatIndex + 1).padStart(2, "0");
        L.push(`จังหวะ ${beatNo} · เลน: ${beat.lane}`);

        // การ์ดอื่นในจังหวะเดียวกัน = เกิดพร้อมกัน — ข้อมูลนี้หายไปทั้งดุ้นในฟอร์แมตเดิม
        if (beat.simultaneousWith.length) {
            L.push(`เกิดพร้อมกันกับ: ${beat.simultaneousWith.map(c => `[${c}]`).join(" ")}`);
        }
        if (beat.isBoardNote) L.push("เป็นโน้ตที่นักเขียนแปะไว้บนกระดาน ไม่ใช่เหตุการณ์ในเรื่อง");
        // การ์ดคำบรรยายบนกระดานแค่ติ๊ก flag ไม่ลบ children — ถ้ายังมีผู้ร่วมฉาก บอกตามจริง
        // สองประโยคขัดกัน ("ไม่มีตัวละคร" แล้วตามด้วยรายชื่อ) แย่กว่าไม่พูด
        if (beat.isNarration) {
            L.push(beat.participants.length
                ? "ตั้งเป็นคำบรรยาย แต่การ์ดยังผูกผู้ร่วมฉากไว้:"
                : "เป็นคำบรรยาย ไม่มีตัวละครร่วมฉาก");
        }
        if (beat.keyMoment) L.push(`เหตุการณ์สำคัญ: ${sub(beat.keyMoment)}`);

        if (beat.content) L.push("", sub(beat.content));

        if (beat.participants.length) {
            L.push("ผู้ร่วมฉาก:");
            beat.participants.forEach(p => {
                const bits = [
                    p.action && `ทำ: ${sub(p.action)}`,
                    p.goal && `เพื่อ: ${sub(p.goal)}`,
                    p.outcome && `ผล: ${p.outcome}`,
                ].filter(Boolean);
                const who = p.alias ?? p.name;
                L.push(`- ${p.type} — ${who}${bits.length ? ` · ${bits.join(" · ")}` : ""}`);
            });
        }

        if (beat.threadTouches.length) {
            L.push("ปมที่แตะในจังหวะนี้:");
            beat.threadTouches.forEach(t => L.push(`- ${ROLE_LABEL[t.role] ?? t.role} — "${sub(t.title)}"`));
        }

        if (beat.links.length) {
            L.push("เชื่อมไปยัง:");
            beat.links.forEach(l => {
                L.push(`- ${l.kindLabel} → [${l.toCode}] ${sub(l.toTitle)}${l.label ? ` (${sub(l.label)})` : ""}`);
            });
        }

        if (beat.notes.length) {
            L.push("โน้ตของนักเขียน:");
            beat.notes.forEach(n => L.push(`- ${sub(n)}`));
        }
    });

    // roles ว่าง = ปมไม่เคยแตะฉากนี้ ไม่เอาลงตารางสรุปของฉาก
    const sceneThreads = format.threads.filter(t => t.roles.length);
    if (sceneThreads.length) {
        L.push("", "ปมทั้งหมดที่ผ่านฉากนี้:");
        L.push("| ปม | สถานะ | บทบาทที่ปรากฏ |");
        L.push("|---|---|---|");
        sceneThreads.forEach(t => {
            const roles = t.roles.join(" → ") || "ยังไม่ผูก";
            L.push(`| ${esc(sub(t.title))} | ${esc(t.status)} | ${roles} |`);
        });
    }
    // แยกเป็นหัวข้อของตัวเอง — นี่คือคำถามอันดับหนึ่งที่คนเอาไฟล์นี้ไปถาม AI
    // เก็บปมค้างทุกตัวแม้ไม่แตะฉากนี้ — ปมค้างเป็นคำถามระดับนิยาย
    if (openThreads.length) {
        L.push("", "ปมที่ยังไม่เฉลย:");
        openThreads.forEach(t => {
            const where = t.danglingAtCards;
            const whereText = where.length
                ? `แตะไว้ที่ ${where.map(c => `[${c}]`).join(" ")}`
                : (t.roles.length ? "ยังไม่ผูกกับจังหวะไหน" : "แตะในฉากอื่น ยังไม่ผูกในฉากนี้");
            L.push(`- ${sub(t.title)} — ${whereText} ยังไม่มีจังหวะไหนเฉลย`);
        });
    }

    return L.join("\n");
}

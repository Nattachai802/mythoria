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
    roles: string[];        // ["หว่าน", "ย้ำ"]
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
    // แทนที่ชื่อยาวก่อนชื่อสั้น กันชื่อที่เป็นส่วนหนึ่งของอีกชื่อไปตัดกลางคำ
    const aliasRe = aliasOf.size
        ? new RegExp([...aliasOf.keys()].sort((a, b) => b.length - a.length)
            .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g")
        : null;
    return (t?: string | null) => !t ? "" : (aliasRe ? t.replace(aliasRe, m => aliasOf.get(m) ?? m) : t);
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

    // ── Notes by item ──
    const notesByItem = new Map<string, Array<{ notes?: string | null }>>();
    ideaNotes.forEach(n => {
        if (!n.canvasItemId) return;
        const a = notesByItem.get(n.canvasItemId) ?? [];
        a.push(n); notesByItem.set(n.canvasItemId, a);
    });

    // ── ตัวย่อผู้ร่วมฉาก ──
    const nameCards = new Map<string, Set<string>>();
    const nameType = new Map<string, string>();
    sorted.forEach(item => {
        ((item.children ?? []) as any[]).forEach(c => {
            if (!c.title) return;
            const set = nameCards.get(c.title) ?? new Set<string>();
            set.add(item.id); nameCards.set(c.title, set);
            if (!nameType.has(c.title)) nameType.set(c.title, typeLabel(c.type));
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
        .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
        .map(([name, set]) => ({
            alias: aliasOf.get(name) ?? null,
            name,
            type: nameType.get(name) ?? "-",
            cardCount: set.size,
        }));

    // ── Beats ──
    const beats: FormatBeat[] = sorted.map(item => {
        const code = codeById.get(item.id)!;

        // simultaneous
        const together = sorted
            .filter(o => o.id !== item.id && (o.beatIndex ?? 0) === (item.beatIndex ?? 0))
            .map(o => codeById.get(o.id)!);

        // participants
        const kids = (item.children ?? []) as any[];
        const participants: BeatParticipant[] = kids.map(c => {
            const det = elementDetails.get(`${item.id}-${c.type}-${c.referenceId || c.id}`);
            return {
                alias: aliasOf.get(c.title) ?? null,
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
            const t = items.find(x => x.id === l.targetId);
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
            keyMoment: item.keyMomentLabel ?? null,
            simultaneousWith: together,
            participants,
            links: beatLinks,
            threadTouches,
            notes: itemNotes,
        };
    });

    // ── Threads ──
    const threadSummaries: ThreadSummary[] = threads.map(t => {
        const hasPayoff = t.beats.some(b => b.role === "payoff");
        const closedByAuthor = t.status === "paid" || t.status === "abandoned";
        const dangling = !closedByAuthor && !hasPayoff;
        const roles = t.beats.map(b => ROLE_LABEL[b.role] ?? b.role);
        const danglingAtCards = dangling
            ? t.beats
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

    const beatCountReal = new Set(sorted.map(i => i.beatIndex ?? 0)).size;

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
        cardCount: sorted.length,
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
    const L: string[] = [];

    // frontmatter: ให้ AI รู้ขนาดและโฟกัสก่อนอ่านเนื้อ
    L.push("---");
    L.push("เอกสาร: กระดานพล็อตรายฉาก (หนึ่งไฟล์ = หนึ่งฉาก)");
    L.push(`ฉาก: ${sub(format.scene.title)}`);
    if (format.scene.goal) L.push(`เป้าหมาย: ${sub(format.scene.goal)}`);
    if (format.scene.conflict) L.push(`อุปสรรค: ${sub(format.scene.conflict)}`);
    if (format.scene.outcome) L.push(`ผล: ${format.scene.outcome}`);
    if (format.scene.causeKind) {
        const w = format.scene.causeKind === "therefore" ? "ดังนั้น" : "แต่ว่า";
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
            L.push(`| ${c.alias ?? "—"} | ${c.name} | ${c.type} | ${c.cardCount} / ${format.cardCount} |`);
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
        if (beat.isNarration) L.push("เป็นคำบรรยาย ไม่มีตัวละครร่วมฉาก");
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

    if (format.threads.length) {
        L.push("", "ปมทั้งหมดที่ผ่านฉากนี้:");
        L.push("| ปม | สถานะ | บทบาทที่ปรากฏ |");
        L.push("|---|---|---|");
        format.threads.forEach(t => {
            const roles = t.roles.join(" → ") || "ยังไม่ผูก";
            L.push(`| ${sub(t.title)} | ${t.status} | ${roles} |`);
        });
    }
    // แยกเป็นหัวข้อของตัวเอง — นี่คือคำถามอันดับหนึ่งที่คนเอาไฟล์นี้ไปถาม AI
    if (openThreads.length) {
        L.push("", "ปมที่ยังไม่เฉลย:");
        openThreads.forEach(t => {
            const where = t.danglingAtCards;
            L.push(`- ${sub(t.title)} — ${where.length ? `แตะไว้ที่ ${where.map(c => `[${c}]`).join(" ")}` : "ยังไม่ผูกกับจังหวะไหน"} ยังไม่มีจังหวะไหนเฉลย`);
        });
    }

    return L.join("\n");
}

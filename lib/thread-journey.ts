/**
 * เส้นทางของปม — ปมเดินผ่านเรื่องอย่างไร นับเป็น "การ์ด"
 *
 * เรียงการ์ดทั้งเรื่องเป็นเส้นเดียว: บท → ฉาก (orderIndex) → การ์ด (จังหวะ แล้วเลน)
 * ลำดับในฉากเหมือน lib/story-format.ts ทุกอย่าง รหัส [C01] จึงตรงกับที่ AI เห็น
 *
 * ใช้ทั้งหน้าสมุดปม (client) และบริบท AI (server) — สูตรเดียว ตัวเลขไม่ต่างกัน
 * pure module ไม่มี import
 */

// ─── canvas_data → การ์ด ──────────────────────────────────────────────

export interface CanvasCard {
    id: string;
    type?: string;
    title?: string | null;
    content?: string | null;
    beatIndex?: number;
    laneId: string;
    [k: string]: unknown;
}

/** ชนิดโหนดที่ไม่ใช่การ์ด (beatJoin/joinLegend = ของฟีเจอร์ที่ถอดไปแล้ว) */
const NON_CARD = new Set(["lane", "group", "chapter", "beatJoin", "joinLegend"]);

/** แยก canvas_data ของฉากหนึ่งเป็น items / lanes (เดิมอยู่ใน server/plot-analysis.ts) */
export function parseCanvasItems(canvasData: unknown): {
    items: CanvasCard[];
    lanes: Array<{ id: string; name: string }>;
} {
    const raw: Array<Record<string, unknown>> = Array.isArray(canvasData) ? canvasData : [];
    const lanes = raw
        .filter(it => it.type === "lane")
        .map(l => ({ id: String(l.id), name: (l.name as string) || "เลน", orderIndex: Number(l.orderIndex ?? 0) }))
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(({ id, name }) => ({ id, name }));
    const items = raw.filter(it => !NON_CARD.has(it.type as string)) as unknown as CanvasCard[];
    return { items, lanes };
}

/** เรียงการ์ดในฉาก: จังหวะ แล้วเลน — สูตรเดียวกับ buildSceneFormat */
export function sortSceneCards<T extends { beatIndex?: number; laneId: string }>(
    items: T[],
    lanes: Array<{ id: string }>,
): T[] {
    const laneOrder = new Map(lanes.map((l, i) => [l.id, i]));
    return [...items].sort((a, b) =>
        ((a.beatIndex ?? 0) - (b.beatIndex ?? 0)) || ((laneOrder.get(a.laneId) ?? 0) - (laneOrder.get(b.laneId) ?? 0)));
}

// ─── ลำดับการ์ดทั้งเรื่อง ───────────────────────────────────────────────

export interface SeqCard {
    cardId: string;
    /** รหัสในฉาก "C01" — ตรงกับ story-format */
    code: string;
    title: string;
    eventId: string;
    sceneTitle: string;
    chapterTitle: string | null;
    /** ตำแหน่งในเส้นเรื่อง (นับเฉพาะการ์ดจริง ไม่นับโน้ต) — null = ฉากไม่ผูกบท ไม่รู้ตำแหน่ง */
    pos: number | null;
}

export interface CardSequence {
    cards: SeqCard[];
    byCardId: Map<string, SeqCard>;
    /** ตำแหน่งการ์ดแรกของฉาก — ใช้กับจุดผูกระดับฉาก (ไม่มีการ์ด) */
    sceneStart: Map<string, number | null>;
    sceneTitle: Map<string, string>;
    chapterOf: Map<string, string | null>;
}

export function buildCardSequence(
    events: Array<{ id: string; title?: string | null; orderIndex: number; relatedChapterId?: string | null; canvasData?: unknown }>,
    chapters: Array<{ id: string; title: string; orderIndex: number }>,
): CardSequence {
    const chapterById = new Map(chapters.map(c => [c.id, c]));
    const placed = events.filter(e => e.relatedChapterId && chapterById.has(e.relatedChapterId));
    const unplaced = events.filter(e => !(e.relatedChapterId && chapterById.has(e.relatedChapterId)));
    placed.sort((a, b) =>
        chapterById.get(a.relatedChapterId!)!.orderIndex - chapterById.get(b.relatedChapterId!)!.orderIndex
        || a.orderIndex - b.orderIndex);
    unplaced.sort((a, b) => a.orderIndex - b.orderIndex);

    const cards: SeqCard[] = [];
    const sceneStart = new Map<string, number | null>();
    const sceneTitle = new Map<string, string>();
    const chapterOf = new Map<string, string | null>();
    let pos = 0;

    for (const [list, known] of [[placed, true], [unplaced, false]] as const) {
        for (const ev of list) {
            const { items, lanes } = parseCanvasItems(ev.canvasData);
            const title = ev.title || "(ไม่มีชื่อ)";
            const chTitle = known ? chapterById.get(ev.relatedChapterId!)!.title : null;
            sceneTitle.set(ev.id, title);
            chapterOf.set(ev.id, chTitle);
            sceneStart.set(ev.id, known ? pos : null);
            sortSceneCards(items, lanes).forEach((it, i) => {
                const isNote = it.type === "sticky-note";
                cards.push({
                    cardId: it.id,
                    code: `C${String(i + 1).padStart(2, "0")}`,
                    title: (it.title as string) || "(การ์ดไม่มีชื่อ)",
                    eventId: ev.id,
                    sceneTitle: title,
                    chapterTitle: chTitle,
                    pos: known && !isNote ? pos : null,
                });
                if (known && !isNote) pos++;
            });
        }
    }
    return { cards, byCardId: new Map(cards.map(c => [c.cardId, c])), sceneStart, sceneTitle, chapterOf };
}

// ─── เส้นทางของปม ───────────────────────────────────────────────────────

export interface JourneyBeatInput {
    id: string;
    eventId: string;
    canvasItemId: string | null;
    role: string;
    pointId?: string | null;
    tension?: number | null;
}

export interface JourneyThreadInput {
    id: string;
    title: string;
    parentThreadId?: string | null;
    beats: JourneyBeatInput[];
    points?: Array<{ id: string; text: string; status: string }>;
    links?: Array<{ toThreadId: string; kind: string }>;
}

/** ปมอื่นเกี่ยวกับปมนี้อย่างไร */
export type RelationTag = "child" | "parent" | "before" | "after" | "decoy" | "decoyed" | "none";

export interface JourneyStop {
    beat: JourneyBeatInput;
    /** null = ไม่รู้ตำแหน่ง (ฉากไม่ผูกบท) */
    pos: number | null;
    code: string | null;
    cardTitle: string | null;
    sceneTitle: string;
    chapterTitle: string | null;
    /** ผูกทั้งฉาก (ไม่มีการ์ด หรือการ์ดถูกลบ) */
    sceneLevel: boolean;
    /** ห่างจากจุดก่อนหน้าของปมนี้กี่การ์ด (null = จุดแรก หรือไม่รู้ตำแหน่ง) */
    gapFromPrev: number | null;
    /** ปมอื่นที่ผูกการ์ดระหว่างจุดก่อนหน้ากับจุดนี้ */
    between: Array<{ threadId: string; title: string; role: string; code: string | null; sceneTitle: string; tag: RelationTag }>;
}

export interface ThreadJourney {
    stops: JourneyStop[];
    first: JourneyStop | null;
    payoff: JourneyStop | null;
    /** หว่านแรกถึงเฉลยแรก (ยังไม่เฉลย = ถึงจุดล่าสุด) กี่การ์ด */
    span: number | null;
    longestSilence: number | null;
    /** ความครอบคลุมเบาะแสรายประเด็น — นับจุดหว่าน/ย้ำก่อนเฉลยแรก */
    clues: Array<{ pointId: string | null; text: string; cluesBeforePayoff: number; resolvedAtPayoff: boolean }>;
}

const ROLE_RANK: Record<string, number> = { seed: 0, reinforce: 1, payoff: 2 };

/** ตำแหน่งของ beat: การ์ด → ต้นฉาก → ไม่รู้ */
function locate(b: JourneyBeatInput, seq: CardSequence) {
    const card = b.canvasItemId ? seq.byCardId.get(b.canvasItemId) : undefined;
    const sceneTitle = seq.sceneTitle.get(b.eventId) ?? "(ฉากถูกลบ)";
    const chapterTitle = seq.chapterOf.get(b.eventId) ?? null;
    if (card && card.eventId === b.eventId && card.pos != null) {
        return { pos: card.pos, code: card.code, cardTitle: card.title, sceneTitle, chapterTitle, sceneLevel: false };
    }
    return {
        pos: seq.sceneStart.get(b.eventId) ?? null,
        code: card?.code ?? null,
        cardTitle: card?.title ?? null,
        sceneTitle, chapterTitle,
        sceneLevel: !card,
    };
}

export function relationTag(self: JourneyThreadInput, other: JourneyThreadInput): RelationTag {
    if (other.parentThreadId === self.id) return "child";
    if (self.parentThreadId === other.id) return "parent";
    const out = (self.links ?? []).find(l => l.toThreadId === other.id);
    if (out) return out.kind === "misdirects" ? "decoy" : "before";
    const inn = (other.links ?? []).find(l => l.toThreadId === self.id);
    if (inn) return inn.kind === "misdirects" ? "decoyed" : "after";
    return "none";
}

export const RELATION_LABEL: Record<RelationTag, string> = {
    child: "ปมย่อย",
    parent: "ปมแม่",
    before: "ต้องเฉลยก่อนปมนั้น",
    after: "ต้องเฉลยหลังปมนั้น",
    decoy: "ปมนี้หลอกปมนั้น",
    decoyed: "ปมหลอกของปมนี้",
    none: "ไม่เกี่ยว",
};

export function threadJourney(
    thread: JourneyThreadInput,
    allThreads: JourneyThreadInput[],
    seq: CardSequence,
): ThreadJourney {
    const sortStops = <T extends { pos: number | null; beat: JourneyBeatInput }>(xs: T[]) =>
        xs.sort((a, b) => (a.pos ?? Infinity) - (b.pos ?? Infinity) || (ROLE_RANK[a.beat.role] ?? 0) - (ROLE_RANK[b.beat.role] ?? 0));

    const stops: JourneyStop[] = sortStops(thread.beats.map(b => ({ beat: b, ...locate(b, seq), gapFromPrev: null, between: [] })));

    // จุดของปมอื่น (ที่รู้ตำแหน่ง) สำหรับ "ระหว่างนั้น"
    const others = allThreads.filter(t => t.id !== thread.id).flatMap(t => {
        const tag = relationTag(thread, t);
        return t.beats.map(b => ({ t, b, tag, ...locate(b, seq) })).filter(x => x.pos != null);
    });

    let prev: number | null = null;
    let longest: number | null = null;
    for (const s of stops) {
        if (s.pos == null) continue;
        if (prev != null) {
            s.gapFromPrev = s.pos - prev;
            longest = Math.max(longest ?? 0, s.gapFromPrev);
            const lo = prev, hi = s.pos;
            s.between = others
                .filter(o => o.pos! > lo && o.pos! < hi)
                .sort((a, b) => a.pos! - b.pos!)
                .map(o => ({ threadId: o.t.id, title: o.t.title, role: o.b.role, code: o.code, sceneTitle: o.sceneTitle, tag: o.tag }));
        }
        prev = s.pos;
    }

    const known = stops.filter(s => s.pos != null);
    const first = stops[0] ?? null;
    const payoff = stops.find(s => s.beat.role === "payoff") ?? null;
    const firstSeed = known.find(s => s.beat.role !== "payoff") ?? known[0];
    const end = payoff?.pos != null ? payoff : known[known.length - 1];
    const span = firstSeed && end && firstSeed.pos != null && end.pos != null ? end.pos - firstSeed.pos : null;

    // เบาะแสก่อนเฉลยแรก — ไม่มีประเด็น = นับรวมเป็นก้อนเดียว
    const payoffPos = payoff?.pos ?? Infinity;
    const isClue = (s: JourneyStop) => s.beat.role !== "payoff" && s.pos != null && s.pos < payoffPos;
    const points = thread.points ?? [];
    const clues = points.length
        ? points.map(p => ({
            pointId: p.id,
            text: p.text,
            cluesBeforePayoff: stops.filter(s => isClue(s) && s.beat.pointId === p.id).length,
            resolvedAtPayoff: p.status === "resolved" && payoff != null,
        }))
        : [{ pointId: null, text: thread.title, cluesBeforePayoff: stops.filter(isClue).length, resolvedAtPayoff: payoff != null }];

    return { stops, first, payoff, span, longestSilence: longest, clues };
}

/** ประเด็นที่เฉลยแล้วแต่ไม่มีเบาะแสมาก่อนเลย */
export function unfairPoints(j: ThreadJourney) {
    return j.clues.filter(c => c.resolvedAtPayoff && c.cluesBeforePayoff === 0);
}

/** บรรทัดย่อสำหรับบริบท AI — ตำแหน่งปมเทียบกับฉากที่กำลังดู */
export function journeyLine(j: ThreadJourney, currentEventId: string, seq: CardSequence): string | null {
    const at = (s: JourneyStop) => `[${s.sceneTitle}${s.code ? ` · ${s.code}` : ""}]`;
    if (!j.first) return null;
    const parts = [`โผล่ครั้งแรกที่ ${at(j.first)}`];
    const here = j.stops.find(s => s.beat.eventId === currentEventId && s.pos != null);
    const herePos = here?.pos ?? seq.sceneStart.get(currentEventId) ?? null;
    if (herePos != null) {
        const before = j.stops.filter(s => s.pos != null && s.pos < herePos && s.beat.eventId !== currentEventId);
        const last = before[before.length - 1];
        if (last) {
            parts.push(`ห่างจากจุดล่าสุดของปมนี้ ${herePos - last.pos!} การ์ด`);
            const names = [...new Set((here?.between ?? []).map(b => b.tag === "none" ? b.title : `${b.title} (${RELATION_LABEL[b.tag]})`))];
            if (names.length) parts.push(`ระหว่างนั้นมีปม ${names.slice(0, 5).join(", ")}${names.length > 5 ? ` +${names.length - 5}` : ""}`);
        }
    }
    if (j.payoff) parts.push(`เฉลยที่ ${at(j.payoff)}`);
    return parts.join(" · ");
}

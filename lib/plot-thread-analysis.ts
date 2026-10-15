/**
 * วิเคราะห์ปมเรื่อง — ปมไหนค้าง ปมไหนถูกลืม
 *
 * ย้ายออกมาจาก components/project/timeline/plot-thread-ledger.tsx เพราะไฟล์นั้น
 * เป็น "use client" แต่รายงานรายตอนต้องคำนวณเรื่องเดียวกันที่ฝั่ง server
 * ถ้าปล่อยให้เขียนสองที่ วันหนึ่ง "ค้างกี่บท" ในสองหน้าจะไม่ตรงกัน
 *
 * ไม่มี "use client" / "use server" — โมดูลบริสุทธิ์ ใช้ได้ทั้งสองฝั่ง
 */

/** บทที่ปมไม่ถูกแตะเลย → เตือนว่า "ผู้อ่านลืมไปแล้ว" */
export const STALE_GAP = 8;

export interface BeatLike {
    eventId: string;
    role: string; // seed | reinforce | payoff
    tension?: number | null;
}

export interface ThreadLike {
    id: string;
    title: string;
    type: string;
    status: string;
    importance?: string;
    beats: BeatLike[];
    points?: Array<{ id: string; text: string; status: string }>;
}

// ── เจตนา (ผู้เขียนตั้ง) vs ความคืบหน้า (คำนวณจากฉาก) ──

export const THREAD_INTENTS = ["active", "on_hold", "open_ended", "abandoned"] as const;
export type ThreadIntent = (typeof THREAD_INTENTS)[number];

/** ค่า status เก่า (planted/developing/paid) อ่านเป็น active — ความคืบหน้าย้ายไปคำนวณจากฉากแล้ว */
export function threadIntent(status: string): ThreadIntent {
    return (THREAD_INTENTS as readonly string[]).includes(status) ? (status as ThreadIntent) : "active";
}

export type ThreadProgress = "unseeded" | "seeded" | "developing" | "partial" | "paid";

/**
 * ยังไม่หว่าน → หว่านแล้ว → กำลังสาน (มีฉากย้ำ) → เฉลยบางส่วน → เฉลยครบ
 * เฉลยบางส่วน = มีฉากเฉลยแต่ประเด็นยังเปิด หรือยังไม่มีฉากเฉลยแต่คลี่ประเด็นไปบ้างแล้ว
 */
export function threadProgress(t: ThreadLike): ThreadProgress {
    const has = (role: string) => t.beats.some((b) => b.role === role);
    const points = t.points ?? [];
    const open = points.filter((p) => p.status !== "resolved").length;
    const resolved = points.length - open;
    if (has("payoff")) return open === 0 ? "paid" : "partial";
    if (resolved > 0) return "partial";
    if (has("reinforce")) return "developing";
    if (has("seed")) return "seeded";
    return "unseeded";
}

/** ปมนี้ยังต้องเฉลยไหม — ตั้งใจค้าง/ทิ้ง หรือมีฉากเฉลยแล้ว = ไม่ต้อง */
export function threadNeedsPayoff(t: Pick<ThreadLike, "status" | "beats">): boolean {
    const intent = threadIntent(t.status);
    if (intent === "open_ended" || intent === "abandoned") return false;
    return !t.beats.some((b) => b.role === "payoff");
}

export interface ThreadAnalysis {
    /** ยังไม่เฉลย */
    dangling: boolean;
    /** ยังไม่เฉลย และไม่ถูกแตะมานานเกิน STALE_GAP บท */
    stale: boolean;
    /** เฉลยโดยไม่เคยหว่าน */
    orphanPayoff: boolean;
    /** เลยบทที่ตั้งใจจะเฉลยแล้ว ยังไม่มีฉากเฉลย */
    overdue: boolean;
    progress: ThreadProgress;
    /** บทที่หว่านครั้งแรก (null ถ้าไม่มี beat ที่ผูกกับบท) */
    seedOrder: number | null;
    /** บทที่แตะล่าสุด */
    lastOrder: number | null;
    /** ห่างจากจุดอ้างอิงกี่บท */
    gap: number | null;
}

/**
 * แปลง eventId → ลำดับบท
 *
 * beat ผูกกับ timelineEvent ไม่ได้ผูกกับบทตรง ๆ และ relatedChapterId เป็น null ได้
 * beat ที่หาบทไม่เจอจะถูกตัดออกจากการคำนวณ ไม่ใช่เดา
 */
export function makeEventChapterOrder(
    events: Array<{ id: string; relatedChapterId?: string | null }>,
    chapters: Array<{ id: string; orderIndex: number }>,
): (eventId: string) => number | null {
    const chapterOrderById = new Map(chapters.map((c) => [c.id, c.orderIndex]));
    const eventById = new Map(events.map((e) => [e.id, e]));
    return (eventId: string) => {
        const ev = eventById.get(eventId);
        if (!ev?.relatedChapterId) return null;
        return chapterOrderById.get(ev.relatedChapterId) ?? null;
    };
}

/**
 * @param referenceOrder ลำดับบทที่ใช้เป็นจุดอ้างอิงของคำว่า "ค้างมากี่บท"
 *   - ledger ทั้งเล่มส่ง maxChapterOrder
 *   - รายงานรายตอนส่งบทที่กำลังรีวิว เพราะคำถามคือ "ณ ตอนนี้ ปมค้างมากี่บทแล้ว"
 *
 * @param targetOrder ลำดับบทที่ตั้งใจจะเฉลย (null = ไม่ได้ตั้ง)
 *
 * dangling มาจากฉาก + เจตนา (threadNeedsPayoff) — "พักไว้" ยังนับว่าค้าง แต่ไม่เตือนว่าถูกลืม
 */
export function analyzeThread(
    thread: ThreadLike,
    eventChapterOrder: (eventId: string) => number | null,
    referenceOrder: number,
    targetOrder: number | null = null,
): ThreadAnalysis {
    const hasPayoff = thread.beats.some((b) => b.role === "payoff");
    const hasSeed = thread.beats.some((b) => b.role === "seed");

    const orderOf = (b: BeatLike) => eventChapterOrder(b.eventId);
    const allOrders = thread.beats.map(orderOf).filter((n): n is number => n != null);
    const seedOrders = thread.beats.filter((b) => b.role === "seed").map(orderOf).filter((n): n is number => n != null);

    const lastOrder = allOrders.length ? Math.max(...allOrders) : null;
    const seedOrder = seedOrders.length ? Math.min(...seedOrders) : null;

    const dangling = threadNeedsPayoff(thread);
    const onHold = threadIntent(thread.status) === "on_hold";
    const gap = lastOrder != null ? referenceOrder - lastOrder : null;

    return {
        dangling,
        stale: dangling && !onHold && gap != null && gap >= STALE_GAP,
        orphanPayoff: hasPayoff && !hasSeed,
        overdue: dangling && !onHold && targetOrder != null && referenceOrder > targetOrder,
        progress: threadProgress(thread),
        seedOrder,
        lastOrder,
        gap,
    };
}

// ── คำเตือนระดับเครือข่ายปม (ประเด็น / ความสัมพันธ์ / ความตึง) ──

export interface NetworkThreadLike extends ThreadLike {
    links?: Array<{ toThreadId: string; kind: string }>; // ปมนี้เป็น from
}

export type ThreadWarning =
    /** มีลิงก์ A before B แต่ B เฉลยก่อน A (หรือ B เฉลยแล้ว A ยังไม่เฉลย) */
    | { kind: "order_violation"; threadId: string; otherId: string }
    /** ปมหลอกยังไม่คลี่ ณ บทที่ปมจริงเฉลยไปแล้ว */
    | { kind: "decoy_after_truth"; threadId: string; otherId: string }
    /** เฉลยแล้ว แต่ยังมีประเด็นเปิดค้าง */
    | { kind: "open_points_after_payoff"; threadId: string; pointTexts: string[] }
    /** มีคะแนนความตึง ≥2 จุด แต่ไม่มีจุดไหนสูงกว่าจุดแรก */
    | { kind: "flat_tension"; threadId: string };

/** บทแรกที่ปมเฉลย (null = ยังไม่เฉลย หรือ payoff ไม่ผูกบท) */
function payoffOrder(t: ThreadLike, order: (eventId: string) => number | null): number | null {
    const os = t.beats.filter((b) => b.role === "payoff").map((b) => order(b.eventId)).filter((n): n is number => n != null);
    return os.length ? Math.min(...os) : null;
}

/**
 * เรียง beat ตามบท แล้วดูความตึง — beat ไม่มีคะแนนหรือหาบทไม่เจอไม่นับ
 * ponytail: ภายในบทเดียวกันใช้ลำดับใน array ถ้าต้องแม่นกว่านี้ค่อยเรียงตามลำดับฉาก
 */
function isFlat(t: ThreadLike, order: (eventId: string) => number | null): boolean {
    const scored = t.beats
        .map((b, i) => ({ o: order(b.eventId), t: b.tension, i }))
        .filter((x): x is { o: number; t: number; i: number } => x.o != null && x.t != null)
        .sort((a, b) => a.o - b.o || a.i - b.i);
    if (scored.length < 2) return false;
    return !scored.slice(1).some((x) => x.t > scored[0].t);
}

export function analyzeThreadNetwork(
    threads: NetworkThreadLike[],
    eventChapterOrder: (eventId: string) => number | null,
): ThreadWarning[] {
    const byId = new Map(threads.map((t) => [t.id, t]));
    const out: ThreadWarning[] = [];

    for (const t of threads) {
        const tPay = payoffOrder(t, eventChapterOrder);

        for (const l of t.links ?? []) {
            const other = byId.get(l.toThreadId);
            if (!other) continue;
            const oPay = payoffOrder(other, eventChapterOrder);
            if (oPay == null) continue; // ปมปลายทางยังไม่เฉลย ยังไม่ผิด
            // ปมต้นทางต้องเฉลย "ก่อน" (บทเดียวกันถือว่าผ่าน — ลำดับในบทเราไม่รู้)
            const late = tPay == null || tPay > oPay;
            if (!late) continue;
            if (l.kind === "before") out.push({ kind: "order_violation", threadId: t.id, otherId: other.id });
            // ปมหลอกที่ผู้เขียนตั้งใจทิ้งไม่ต้องคลี่
            else if (l.kind === "misdirects" && threadNeedsPayoff(t)) out.push({ kind: "decoy_after_truth", threadId: t.id, otherId: other.id });
        }

        const paid = t.beats.some((b) => b.role === "payoff");
        const open = (t.points ?? []).filter((p) => p.status !== "resolved");
        if (paid && open.length) out.push({ kind: "open_points_after_payoff", threadId: t.id, pointTexts: open.map((p) => p.text) });

        if (isFlat(t, eventChapterOrder)) out.push({ kind: "flat_tension", threadId: t.id });
    }
    return out;
}

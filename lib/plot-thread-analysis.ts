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
}

export interface ThreadLike {
    id: string;
    title: string;
    type: string;
    status: string;
    importance?: string;
    beats: BeatLike[];
}

export interface ThreadAnalysis {
    /** ยังไม่เฉลย */
    dangling: boolean;
    /** ยังไม่เฉลย และไม่ถูกแตะมานานเกิน STALE_GAP บท */
    stale: boolean;
    /** เฉลยโดยไม่เคยหว่าน */
    orphanPayoff: boolean;
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
 * หมายเหตุ: อนุมาน dangling จาก beats เป็นหลัก แล้วค่อยเคารพ status ที่ผู้ใช้ตั้งเอง
 * (paid/abandoned) เพราะ auto-advance ใน server/plot-threads.ts ทำครึ่งเดียว —
 * ตั้ง paid ตอนเพิ่ม payoff แต่ไม่ถอยกลับตอนลบ beat นั้นทิ้ง
 */
export function analyzeThread(
    thread: ThreadLike,
    eventChapterOrder: (eventId: string) => number | null,
    referenceOrder: number,
): ThreadAnalysis {
    const hasPayoff = thread.beats.some((b) => b.role === "payoff");
    const hasSeed = thread.beats.some((b) => b.role === "seed");

    const orderOf = (b: BeatLike) => eventChapterOrder(b.eventId);
    const allOrders = thread.beats.map(orderOf).filter((n): n is number => n != null);
    const seedOrders = thread.beats.filter((b) => b.role === "seed").map(orderOf).filter((n): n is number => n != null);

    const lastOrder = allOrders.length ? Math.max(...allOrders) : null;
    const seedOrder = seedOrders.length ? Math.min(...seedOrders) : null;

    const closedByAuthor = thread.status === "paid" || thread.status === "abandoned";
    const dangling = !closedByAuthor && !hasPayoff;
    const gap = lastOrder != null ? referenceOrder - lastOrder : null;

    return {
        dangling,
        stale: dangling && gap != null && gap >= STALE_GAP,
        orphanPayoff: hasPayoff && !hasSeed,
        seedOrder,
        lastOrder,
        gap,
    };
}

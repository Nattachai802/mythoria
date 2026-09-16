/**
 * Beat Coach — อ่านจังหวะของการ์ดในฉากเดียว แล้วบอกว่า "ตอนนี้เป็นยังไง จังหวะถัดไปควรเป็นแบบไหน"
 *
 * เป็นผู้ช่วยคิด ไม่ใช่คิดแทน — บอกข้อสังเกต ไม่แก้ค่าให้ ไม่เขียนเนื้อหาให้
 *
 * กฎล้วน ไม่เรียก AI ไม่แตะ DB — ชั้น AI อยู่ที่ lib/beat-coach-ai.ts (ใช้ตอนข้อมูลขาดเกินเกณฑ์)
 * pure module ห้าม import อะไรเข้ามา ไม่งั้น `npm run check` โหลดไม่ได้ (ดู task.md 9e)
 */

/** ขาดเกินเท่านี้ = กฎเชื่อไม่ได้ ต้องชวนให้ AI ช่วยอ่าน */
export const MISSING_THRESHOLD = 0.4;

/** กี่จังหวะท้ายติดกันที่ต่ำ ถึงเรียกว่าเอื่อย */
const DRAG_RUN = 3;
const DRAG_MAX = 3; // pacing <= นี้ = ต่ำ

/** กี่จังหวะติดกันที่สูง ถึงเรียกว่าเร่งค้าง */
const HOT_RUN = 4;
const HOT_MIN = 8;

/** ต่างกันน้อยกว่านี้ทั้งฉาก = แบน */
const FLAT_SPREAD = 2;

export type BeatCoachState =
    | "no-data"      // ไม่มีจังหวะเลยสักใบ
    | "insufficient" // มีบ้างแต่ขาดเกินเกณฑ์ — ยังสรุปไม่ได้
    | "too-short"    // จังหวะเดียว ดูแนวโน้มไม่ได้
    | "ok"           // ไม่เจออะไรผิดปกติ
    | "dragging"     // เอื่อยยาว
    | "overheated"   // เร่งค้างนาน
    | "flat";        // แบนทั้งฉาก

export interface BeatCoachResult {
    state: BeatCoachState;
    /** สัดส่วนจังหวะที่ยังไม่ตั้งค่า 0-1 */
    missingRatio: number;
    beatCount: number;
    /** ข้อสังเกตหลัก */
    text: string;
    /** ข้อเสนอสำหรับจังหวะถัดไป — "" เมื่อยังสรุปไม่ได้ */
    suggestion: string;
    /** true = ควรขึ้นปุ่มชวนให้ AI ช่วยอ่าน */
    needsAi: boolean;
}

/**
 * @param pacings จังหวะที่ยุบเลนแล้ว เรียงตามลำดับการเล่า — null = ยังไม่ตั้งค่า
 *
 * ต้องยุบเลนมาก่อน: การ์ดคนละเลนที่ beatIndex เดียวกันคือเหตุการณ์ที่เกิดพร้อมกัน
 * ถ้านับเป็นคนละจังหวะ ฉากที่มี 2 เลนจะดูเหมือนยาวเป็นสองเท่าทั้งที่เวลาเท่าเดิม
 */
export function analyzeBeats(pacings: (number | null)[]): BeatCoachResult {
    const beatCount = pacings.length;
    const known = pacings.filter((p): p is number => typeof p === "number");
    const missingRatio = beatCount === 0 ? 1 : (beatCount - known.length) / beatCount;
    const base = { missingRatio, beatCount };

    if (known.length === 0) {
        return {
            ...base, state: "no-data", needsAi: true,
            text: "ยังไม่ได้ตั้งจังหวะการเล่าสักการ์ด",
            suggestion: "",
        };
    }
    if (missingRatio > MISSING_THRESHOLD) {
        return {
            ...base, state: "insufficient", needsAi: true,
            text: `ตั้งจังหวะไว้ ${known.length} จาก ${beatCount} จังหวะ — ยังไม่พอดูภาพรวม`,
            suggestion: "",
        };
    }
    if (known.length < 2) {
        return {
            ...base, state: "too-short", needsAi: false,
            text: "มีจังหวะเดียว ยังดูแนวโน้มไม่ได้",
            suggestion: "",
        };
    }

    // เอื่อย: ดูเฉพาะ "ท้ายสุด" เพราะคำแนะนำเป็นเรื่องจังหวะถัดไป ไม่ใช่สรุปย้อนหลัง
    const tail = known.slice(-DRAG_RUN);
    if (tail.length === DRAG_RUN && tail.every(p => p <= DRAG_MAX)) {
        return {
            ...base, state: "dragging", needsAi: false,
            text: `${DRAG_RUN} จังหวะท้ายอยู่ระดับ ${Math.max(...tail)} หรือต่ำกว่า — แรงตกต่อเนื่อง`,
            suggestion: "จังหวะถัดไปควรเร่งขึ้น เช่น มีเหตุการณ์ขัดจังหวะหรือข้อมูลใหม่ที่บังคับให้ตัดสินใจ",
        };
    }

    // เร่งค้าง: นับ run ที่ยาวที่สุด ไม่จำกัดว่าอยู่ท้าย — เร่งยาวตรงกลางก็ล้าเหมือนกัน
    let run = 0, longestHot = 0;
    for (const p of known) {
        run = p >= HOT_MIN ? run + 1 : 0;
        longestHot = Math.max(longestHot, run);
    }
    if (longestHot >= HOT_RUN) {
        return {
            ...base, state: "overheated", needsAi: false,
            text: `มีช่วงเร่งติดกัน ${longestHot} จังหวะ — คนอ่านล้าถ้าไม่มีจุดพัก`,
            suggestion: "ควรแทรกจังหวะผ่อน ให้ตัวละครได้ตอบสนองหรือทบทวนสิ่งที่เพิ่งเกิด",
        };
    }

    const spread = Math.max(...known) - Math.min(...known);
    if (spread < FLAT_SPREAD) {
        return {
            ...base, state: "flat", needsAi: false,
            text: `ทั้งฉากอยู่ระดับ ${Math.min(...known)}-${Math.max(...known)} — จังหวะแบน ไม่มีจุดสูงต่ำ`,
            suggestion: "ลองทำให้บางจังหวะเด่นกว่าเพื่อน หรือย่อบางจังหวะให้สั้นลง",
        };
    }

    return {
        ...base, state: "ok", needsAi: false,
        text: `จังหวะมีขึ้นลง (${Math.min(...known)}-${Math.max(...known)}) ไม่พบจุดที่น่าห่วง`,
        suggestion: "",
    };
}

/**
 * ยุบการ์ดหลายเลนที่จังหวะเดียวกันเป็นจังหวะเดียว — ใช้ค่าสูงสุดของกลุ่ม
 * (เกิดพร้อมกันแล้วมีอันหนึ่งเร่ง ทั้งจังหวะนั้นย่อมรู้สึกเร่ง)
 */
export function collapseByBeat(cards: { beatIndex: number; pacing: number | null }[]): (number | null)[] {
    const byBeat = new Map<number, number | null>();
    for (const c of cards) {
        const cur = byBeat.get(c.beatIndex);
        if (cur === undefined) byBeat.set(c.beatIndex, c.pacing);
        else if (typeof c.pacing === "number") byBeat.set(c.beatIndex, Math.max(cur ?? 0, c.pacing));
    }
    return [...byBeat.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
}

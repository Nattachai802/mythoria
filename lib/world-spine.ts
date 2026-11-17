/**
 * เส้นเวลาแบบเส้นเดียว (spine) — คิดตำแหน่งบนจอ · pure ไม่แตะ DB/React
 * -----------------------------------------------------------------------
 * รับช่องเวลาที่ buildWorldTimeline เรียงไว้แล้ว → ตำแหน่ง x ของแต่ละช่อง (ห่างตามเวลาแบบ log),
 * รอยตัด ⫽ ช่วงว่างยาว, ระดับความสูงของก้าน (ไม่ให้การ์ดทับกัน) และรวมกลุ่ม "+N" เมื่อจุดเดียวแน่นเกิน
 *
 * ไฟล์นี้ไม่ import อะไร (ตัวรัน check resolve relative import ไม่ได้ ดู task.md 9e)
 */

export type SpineSide = "up" | "down";

export interface SpineColumn { day: number | null }
export interface SpineInputItem { id: string; col: number; side: SpineSide }

export interface SpineOptions {
    /** ระยะพื้นฐานระหว่างช่อง (px) — ตัวซูม */
    base: number;
    /** ความกว้างการ์ด (px) ใช้กันทับ */
    cardW: number;
    /** ช่วงห่างกี่วันขึ้นไปถึงตัดเป็น ⫽ */
    breakDays: number;
    /** จุดเดียวข้างเดียวมีเกินเท่านี้ → รวมเป็น +N */
    clusterMax: number;
    /** กลุ่มที่ผู้ใช้กางแล้ว key = `${col}:${side}` */
    expanded?: Set<string>;
    /** ระยะขอบซ้าย/ขวา */
    pad?: number;
}

export interface SpinePlaced { id: string; col: number; side: SpineSide; x: number; level: number }
export interface SpineCluster { key: string; col: number; side: SpineSide; x: number; level: number; hidden: number }
export interface SpineBreak { x: number; days: number }

export interface SpineLayout {
    width: number;
    colX: number[];
    /** ขอบซ้าย/ขวาของแต่ละช่อง (กึ่งกลางระหว่างช่อง) — ใช้วาดแถบยุคและหาช่องตอนวาง */
    bounds: [number, number][];
    breaks: SpineBreak[];
    items: SpinePlaced[];
    clusters: SpineCluster[];
    levels: { up: number; down: number };
}

/** ระยะระหว่างสองช่อง: ไม่รู้เวลา = base · รู้เวลา = โตตาม log ของจำนวนวัน (ไม่เกิน 3 เท่า) · ยาวเกิน = ตัด */
function gapPx(prev: SpineColumn, cur: SpineColumn, o: SpineOptions): { px: number; cut: number | null } {
    if (prev.day == null || cur.day == null) return { px: o.base, cut: null };
    const d = Math.max(0, cur.day - prev.day);
    if (d >= o.breakDays) return { px: o.base, cut: d };
    // ponytail: log10 ตายตัว ถ้าอยากให้ผู้ใช้ปรับความ "ยืด" ค่อยเปิดเป็น option
    return { px: Math.min(o.base * 3, o.base * (0.75 + 0.35 * Math.log10(1 + d))), cut: null };
}

export function layoutSpine(columns: SpineColumn[], input: SpineInputItem[], o: SpineOptions): SpineLayout {
    const pad = o.pad ?? o.cardW / 2 + 16;
    const colX: number[] = [];
    const breaks: SpineBreak[] = [];
    let x = pad;
    columns.forEach((c, i) => {
        if (i > 0) {
            const g = gapPx(columns[i - 1], c, o);
            if (g.cut != null) breaks.push({ x: x + g.px / 2, days: g.cut });
            x += g.px;
        }
        colX.push(x);
    });
    const width = (colX.length ? x : pad) + pad;
    const bounds = colX.map((cx, i): [number, number] => [
        i === 0 ? 0 : (colX[i - 1] + cx) / 2,
        i === colX.length - 1 ? width : (cx + colX[i + 1]) / 2,
    ]);

    // รวมกลุ่ม: แยกตามช่อง+ข้าง เกิน clusterMax และยังไม่กาง → โชว์ (clusterMax-1) ใบ + ป้าย +N
    const groups = new Map<string, SpineInputItem[]>();
    for (const it of input) {
        if (it.col < 0 || it.col >= columns.length) continue;
        const k = `${it.col}:${it.side}`;
        groups.set(k, [...(groups.get(k) ?? []), it]);
    }
    type Slot = { kind: "item"; it: SpineInputItem } | { kind: "cluster"; key: string; col: number; side: SpineSide; hidden: number };
    const slots: Slot[] = [];
    for (const [k, list] of groups) {
        if (list.length > o.clusterMax && !o.expanded?.has(k)) {
            const keep = o.clusterMax - 1;
            list.slice(0, keep).forEach((it) => slots.push({ kind: "item", it }));
            slots.push({ kind: "cluster", key: k, col: list[0].col, side: list[0].side, hidden: list.length - keep });
        } else list.forEach((it) => slots.push({ kind: "item", it }));
    }

    // ระดับ: ไล่จากซ้ายไปขวา ใส่ระดับต่ำสุดที่การ์ดก่อนหน้าจบไปแล้ว (ต่อข้าง)
    const colOf = (s: Slot) => (s.kind === "item" ? s.it.col : s.col);
    const sideOf = (s: Slot) => (s.kind === "item" ? s.it.side : s.side);
    slots.sort((a, b) => colOf(a) - colOf(b));
    const ends: Record<SpineSide, number[]> = { up: [], down: [] };
    const items: SpinePlaced[] = [];
    const clusters: SpineCluster[] = [];
    const gap = 8;
    for (const s of slots) {
        const side = sideOf(s);
        const cx = colX[colOf(s)];
        const left = cx - o.cardW / 2;
        const lv = ends[side];
        let level = lv.findIndex((end) => end + gap <= left);
        if (level < 0) { level = lv.length; lv.push(0); }
        lv[level] = cx + o.cardW / 2;
        if (s.kind === "item") items.push({ id: s.it.id, col: s.it.col, side, x: cx, level });
        else clusters.push({ key: s.key, col: s.col, side, x: cx, level, hidden: s.hidden });
    }

    return { width, colX, bounds, breaks, items, clusters, levels: { up: ends.up.length, down: ends.down.length } };
}

/** หาช่องจากพิกัด x ตอนลากวาง: ใกล้กึ่งกลางระหว่างสองช่อง (±20% ของระยะ) = แทรกก่อนช่องขวา */
export function spineDropAt(layout: SpineLayout, x: number): { col: number; mode: "on" | "before" } | null {
    const { colX, bounds } = layout;
    if (!colX.length) return null;
    const col = bounds.findIndex(([l, r]) => x >= l && x < r);
    const i = col < 0 ? (x < 0 ? 0 : colX.length - 1) : col;
    if (i > 0 && x < colX[i]) {
        const mid = (colX[i - 1] + colX[i]) / 2;
        if (Math.abs(x - mid) <= (colX[i] - colX[i - 1]) * 0.2) return { col: i, mode: "before" };
    }
    if (i < colX.length - 1 && x > colX[i]) {
        const mid = (colX[i] + colX[i + 1]) / 2;
        if (Math.abs(x - mid) <= (colX[i + 1] - colX[i]) * 0.2) return { col: i + 1, mode: "before" };
    }
    return { col: i, mode: "on" };
}

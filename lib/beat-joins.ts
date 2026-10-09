// รอยต่อจังหวะ (beat join) — บอก "ลักษณะการต่อ" ระหว่างจังหวะ N กับ N+1 ด้วยสี
// เก็บเป็นโหนดใน canvasData ของฉาก (เหมือนเลน/ตอน) ไม่แก้ schema:
//   { type: 'beatJoin', fromBeat, kind, label }   — หนึ่งโหนดต่อรอยต่อ (kind = key ของสีใน legend)
//   { type: 'joinLegend', kinds: [...] }          — ชื่อสี + ธง "นับเป็นเหตุ-ผล" ต่อกระดาน
// pure data — ห้าม import อะไรเข้ามา (ตัวรันเทสต์ resolve relative import แบบไม่ใส่นามสกุลไม่ได้)

export type JoinKind = { key: string; color: string; name: string; cause: boolean };
export type BeatJoin = { fromBeat: number; kind: string | null; label?: string };

export const DEFAULT_JOIN_KINDS: JoinKind[] = [
    { key: "cause", color: "#1D9E75", name: "เหตุ→ผล", cause: true },
    { key: "flow", color: "#378ADD", name: "ต่อเนื่อง", cause: false },
    { key: "cut", color: "#BA7517", name: "ตัดฉาก", cause: false },
    { key: "jump", color: "#7F77DD", name: "กระโดดเวลา", cause: false },
    { key: "back", color: "#888780", name: "ย้อนอดีต", cause: false },
    { key: "twist", color: "#D85A30", name: "หักมุม", cause: false },
];

/** รวมค่าที่บันทึกไว้เข้ากับชุดเริ่มต้นตาม key — สีที่เพิ่มใหม่ในอนาคตโผล่เอง ชื่อ/ธงที่ผู้ใช้ตั้งไว้คงอยู่ */
export function normalizeJoinKinds(raw: unknown): JoinKind[] {
    const saved = new Map<string, any>();
    if (Array.isArray(raw)) for (const k of raw) if (k && typeof k.key === "string") saved.set(k.key, k);
    return DEFAULT_JOIN_KINDS.map((d) => {
        const s = saved.get(d.key);
        if (!s) return d;
        return {
            key: d.key,
            color: d.color,
            name: typeof s.name === "string" && s.name.trim() ? s.name : d.name,
            cause: typeof s.cause === "boolean" ? s.cause : d.cause,
        };
    });
}

/** แยกโหนดรอยต่อ + legend ออกจาก canvasData ทั้งก้อน */
export function readJoins(canvasData: unknown): { joins: BeatJoin[]; kinds: JoinKind[]; hasJoinNodes: boolean } {
    const raw: any[] = Array.isArray(canvasData) ? canvasData : [];
    const joins: BeatJoin[] = raw
        .filter((n) => n?.type === "beatJoin" && Number.isInteger(n.fromBeat) && n.fromBeat >= 0)
        .map((n) => ({ fromBeat: n.fromBeat as number, kind: typeof n.kind === "string" ? n.kind : null, label: typeof n.label === "string" && n.label ? n.label : undefined }));
    const legend = raw.find((n) => n?.type === "joinLegend");
    return { joins, kinds: normalizeJoinKinds(legend?.kinds), hasJoinNodes: joins.length > 0 || !!legend };
}

export const isJoinNodeType = (t: unknown) => t === "beatJoin" || t === "joinLegend";

export function joinNodes(joins: BeatJoin[], kinds: JoinKind[]): any[] {
    return [
        ...joins
            .filter((j) => j.kind || j.label)
            .map((j) => ({ id: `join-${j.fromBeat}`, type: "beatJoin", fromBeat: j.fromBeat, kind: j.kind, label: j.label ?? null })),
        { id: "join-legend", type: "joinLegend", kinds },
    ];
}

/** ตั้ง/แก้/ล้างรอยต่อหนึ่งจุด (ไม่มีทั้งสีและข้อความ = ลบโหนด) */
export function setJoin(joins: BeatJoin[], fromBeat: number, patch: Partial<Pick<BeatJoin, "kind" | "label">>): BeatJoin[] {
    const cur = joins.find((j) => j.fromBeat === fromBeat) ?? { fromBeat, kind: null };
    const next: BeatJoin = { ...cur, ...patch };
    const rest = joins.filter((j) => j.fromBeat !== fromBeat);
    return next.kind || next.label ? [...rest, next].sort((a, b) => a.fromBeat - b.fromBeat) : rest;
}

const kindOf = (kinds: JoinKind[], key: string | null) => (key ? kinds.find((k) => k.key === key) : undefined);

/** จังหวะ beatIndex มี "เหตุ" นำมาไหม = รอยต่อก่อนหน้า (beatIndex-1 → beatIndex) เป็นสีที่ติ๊กเหตุ-ผล */
export function hasCauseInto(joins: BeatJoin[], kinds: JoinKind[], beatIndex: number): boolean {
    if (beatIndex <= 0) return false;
    const j = joins.find((x) => x.fromBeat === beatIndex - 1);
    return !!kindOf(kinds, j?.kind ?? null)?.cause;
}

export type JoinStats = { boundaries: number; unset: number; longestNonCauseRun: number };

/** รอยต่อทั้งหมดของฉาก = beatCount-1 · "ไม่ใช่เหตุ-ผล" = ยังไม่ตั้ง หรือสีที่ไม่ได้ติ๊กเหตุ-ผล */
export function joinStats(joins: BeatJoin[], kinds: JoinKind[], beatCount: number): JoinStats {
    const boundaries = Math.max(0, beatCount - 1);
    let unset = 0, run = 0, longest = 0;
    for (let b = 0; b < boundaries; b++) {
        const k = kindOf(kinds, joins.find((j) => j.fromBeat === b)?.kind ?? null);
        if (!k) unset++;
        if (k?.cause) run = 0;
        else { run++; if (run > longest) longest = run; }
    }
    return { boundaries, unset, longestNonCauseRun: longest };
}

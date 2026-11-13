// ตรวจระบบฝ่ายด้วยกฎตายตัว (ไม่ใช้ AI) + เกณฑ์ "ยังอยู่ฝ่ายนี้ในบทนี้"
// ไฟล์ pure: ไม่ import lib อื่น (check runner ต้องใช้นามสกุล .ts ซึ่ง tsc ไม่รับ)

export type MembershipLike = { id?: string; characterId: string; factionId: string; startChapterId: string | null; endChapterId: string | null };
export type FactionLike = { id: string; name: string; leaderId?: string | null };
export type RelLike = { id?: string; sourceFactionId: string; targetFactionId: string; type: string; startChapterId?: string | null; endChapterId?: string | null };
export type StatusPoint = { chapterId: string; status: string };

export type FactionIssue =
    | { kind: "enemy-overlap"; characterId: string; factionIds: [string, string]; from: number | null; to: number | null }
    | { kind: "reversed-range"; characterId: string; factionId: string }
    | { kind: "leader-not-member"; factionId: string; characterId: string }
    | { kind: "empty"; factionId: string }
    | { kind: "rel-conflict"; factionIds: [string, string]; types: [string, string]; from: number | null; to: number | null };

type Ranged = { startChapterId?: string | null; endChapterId?: string | null };
const range = (m: Ranged, order: Map<string, number>): [number, number] => [
    m.startChapterId ? order.get(m.startChapterId) ?? -Infinity : -Infinity,
    m.endChapterId ? order.get(m.endChapterId) ?? Infinity : Infinity,
];

/** สังกัดยังอยู่ในบท selOrder ไหม — start/end ว่าง = เปิดปลาย · selOrder null (ทุกบท) = อยู่เสมอ */
export function activeIn(m: Ranged, order: Map<string, number>, selOrder: number | null) {
    if (selOrder === null) return true;
    const [a, b] = range(m, order);
    return a <= selOrder && selOrder <= b;
}

/** ความสัมพันธ์มีผลในบทนี้ไหม — เกณฑ์เดียวกับสังกัด */
export const relActiveIn = activeIn;

/** สถานะของฝ่าย ณ บท: จุดล่าสุดใน timeline ที่ไม่เกินบทนั้น · ไม่มี/ทุกบท = status ตั้งต้น */
export function statusAt(f: { status?: string | null; statusTimeline?: unknown }, order: Map<string, number>, selOrder: number | null): string | null {
    const base = f.status ?? null;
    if (selOrder === null || !Array.isArray(f.statusTimeline)) return base;
    let best: { o: number; s: string } | null = null;
    for (const p of f.statusTimeline as StatusPoint[]) {
        const o = order.get(p?.chapterId);
        if (o === undefined || o > selOrder) continue;
        if (!best || o >= best.o) best = { o, s: p.status };
    }
    return best ? best.s : base;
}

export type Defection = { characterId: string; fromFactionId: string; toFactionId: string; atOrder: number };

/** คนย้ายฝ่าย: สังกัด A จบที่บท N และสังกัด B เริ่มที่บท N หรือ N+1 */
export function findDefections(memberships: MembershipLike[], order: Map<string, number>): Defection[] {
    const out: Defection[] = [];
    for (const a of memberships) {
        const end = a.endChapterId ? order.get(a.endChapterId) : undefined;
        if (end === undefined) continue;
        for (const b of memberships) {
            if (b.characterId !== a.characterId || b.factionId === a.factionId) continue;
            const st = b.startChapterId ? order.get(b.startChapterId) : undefined;
            if (st !== undefined && (st === end || st === end + 1)) out.push({ characterId: a.characterId, fromFactionId: a.factionId, toFactionId: b.factionId, atOrder: st });
        }
    }
    return out;
}

export function findFactionIssues({ factions, memberships, rels, chapterOrder }: {
    factions: FactionLike[];
    memberships: MembershipLike[];
    rels: RelLike[];
    chapterOrder: Map<string, number>;
}): FactionIssue[] {
    const issues: FactionIssue[] = [];
    // คู่ศัตรู → ช่วงบทที่เป็นศัตรูกัน (หลายช่วงได้)
    const enemy = new Map<string, [number, number][]>();
    for (const r of rels.filter((r) => r.type === "enemy")) {
        const rg = range(r, chapterOrder);
        for (const k of [`${r.sourceFactionId}|${r.targetFactionId}`, `${r.targetFactionId}|${r.sourceFactionId}`]) enemy.set(k, [...(enemy.get(k) ?? []), rg]);
    }

    for (const m of memberships) {
        const [a, b] = range(m, chapterOrder);
        if (a > b) issues.push({ kind: "reversed-range", characterId: m.characterId, factionId: m.factionId });
    }

    // อยู่สองฝ่ายที่เป็นศัตรูกันในช่วงบทที่ทับกัน (อาจเป็นสายลับ — ให้ผู้เขียนตัดสิน)
    const byChar = new Map<string, MembershipLike[]>();
    for (const m of memberships) byChar.set(m.characterId, [...(byChar.get(m.characterId) ?? []), m]);
    for (const [characterId, ms] of byChar) {
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
            const x = ms[i], y = ms[j];
            const spans = enemy.get(`${x.factionId}|${y.factionId}`);
            if (!spans) continue;
            const [a1, b1] = range(x, chapterOrder), [a2, b2] = range(y, chapterOrder);
            for (const [ra, rb] of spans) {
                const from = Math.max(a1, a2, ra), to = Math.min(b1, b2, rb);
                if (from <= to) {
                    issues.push({
                        kind: "enemy-overlap", characterId, factionIds: [x.factionId, y.factionId],
                        from: Number.isFinite(from) ? from : null, to: Number.isFinite(to) ? to : null,
                    });
                    break;
                }
            }
        }
    }

    // คู่เดียวกัน ช่วงบททับกัน แต่ชนิดต่างกัน (เช่น พันธมิตรและศัตรูพร้อมกัน)
    for (let i = 0; i < rels.length; i++) for (let j = i + 1; j < rels.length; j++) {
        const x = rels[i], y = rels[j];
        const same = (x.sourceFactionId === y.sourceFactionId && x.targetFactionId === y.targetFactionId)
            || (x.sourceFactionId === y.targetFactionId && x.targetFactionId === y.sourceFactionId);
        if (!same || x.type === y.type) continue;
        const [a1, b1] = range(x, chapterOrder), [a2, b2] = range(y, chapterOrder);
        const from = Math.max(a1, a2), to = Math.min(b1, b2);
        if (from <= to) issues.push({
            kind: "rel-conflict", factionIds: [x.sourceFactionId, x.targetFactionId], types: [x.type, y.type],
            from: Number.isFinite(from) ? from : null, to: Number.isFinite(to) ? to : null,
        });
    }

    for (const f of factions) {
        const members = memberships.filter((m) => m.factionId === f.id);
        if (members.length === 0) issues.push({ kind: "empty", factionId: f.id });
        if (f.leaderId && !members.some((m) => m.characterId === f.leaderId)) issues.push({ kind: "leader-not-member", factionId: f.id, characterId: f.leaderId });
    }
    return issues;
}

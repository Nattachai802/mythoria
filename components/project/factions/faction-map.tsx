"use client";

import { useState } from "react";
import type { Defection } from "@/lib/faction-checks";

type F = { id: string; name: string; color?: string | null; parentFactionId?: string | null; status?: string | null; statusTimeline?: unknown; members?: { characterId: string }[] };
type R = { id: string; sourceFactionId: string; targetFactionId: string; type: string };

const REL_STYLE: Record<string, { stroke: string; dash?: string; label: string }> = {
    enemy: { stroke: "#dc2626", dash: "6 4", label: "ศัตรู" },
    rival: { stroke: "#f59e0b", dash: "3 3", label: "คู่แข่ง" },
    ally: { stroke: "#10b981", label: "พันธมิตร" },
    subsidiary: { stroke: "#818cf8", label: "ขึ้นตรงต่อ" },
    splinter: { stroke: "#a78bfa", dash: "2 4", label: "แตกออกมา" },
    neutral: { stroke: "#94a3b8", dash: "1 4", label: "เป็นกลาง" },
};

const W = 760, GAP = 24, BOX_W = 176, BOX_H = 64, SUB_W = 132, SUB_H = 50, PAD = 14, HEAD = 34;
type Box = { x: number; y: number; w: number; h: number };

/**
 * แผนที่อำนาจ แบบผสม: เริ่มต้นเห็นแค่ฝ่ายใหญ่ (รวมสมาชิกของกลุ่มย่อย) · กดฝ่ายใหญ่ = กางเป็นกรอบมีกลุ่มย่อยข้างใน
 * เส้นความสัมพันธ์ต่อเข้า "กล่องที่มองเห็น" — ฝ่ายย่อยที่ถูกพับอยู่จะต่อเข้ากล่องฝ่ายใหญ่แทน
 * ponytail: กางได้ 1 ชั้น (กลุ่มย่อยของกลุ่มย่อยรวมเข้ากลุ่มย่อย) — ลึกกว่านั้นดูที่มุมมองลำดับชั้น
 */
export function FactionMap({ factions, rels, defections = [], charName, statusOf, selectedId, onSelect }: {
    factions: F[]; rels: R[]; defections?: Defection[]; charName?: (id: string) => string;
    statusOf?: (f: F) => { label: string; color: string } | null;
    selectedId: string | null; onSelect: (id: string) => void;
}) {
    const [open, setOpen] = useState<Set<string>>(new Set());
    const ids = new Set(factions.map((f) => f.id));
    const byId = new Map(factions.map((f) => [f.id, f]));
    const kids = (id: string) => factions.filter((f) => f.parentFactionId === id);
    const roots = factions.filter((f) => !f.parentFactionId || !ids.has(f.parentFactionId));
    const rootOf = (id: string): string => {
        let cur = byId.get(id), guard = 0;
        while (cur?.parentFactionId && ids.has(cur.parentFactionId) && guard++ < 20) cur = byId.get(cur.parentFactionId);
        return cur?.id ?? id;
    };
    const subtree = (id: string): string[] => [id, ...kids(id).flatMap((k) => subtree(k.id))];
    const count = (id: string) => new Set(subtree(id).flatMap((x) => (byId.get(x)?.members ?? []).map((m) => m.characterId))).size;
    // กล่องที่มองเห็นของฝ่าย x: ถ้า root ของ x กางอยู่ → กลุ่มย่อยชั้นแรกที่ x อยู่ใต้ · ไม่งั้น → root
    const visibleNode = (x: string): string => {
        const r = rootOf(x);
        if (!open.has(r) || x === r) return r;
        let cur = byId.get(x)!;
        while (cur.parentFactionId && cur.parentFactionId !== r) cur = byId.get(cur.parentFactionId)!;
        return cur.id;
    };

    // วางแบบไหลซ้าย→ขวา ตัดบรรทัด (กรอบที่กางมีขนาดต่างกัน — วงกลมใช้ไม่ได้แล้ว)
    const boxes = new Map<string, Box>();
    let x = 0, y = 0, rowH = 0;
    for (const r of roots) {
        const ks = kids(r.id);
        const expanded = open.has(r.id) && ks.length > 0;
        const cols = expanded ? Math.max(1, Math.min(ks.length, Math.floor((W - PAD * 2 + 12) / (SUB_W + 12)))) : 0;
        const w = expanded ? Math.max(BOX_W, cols * (SUB_W + 12) - 12 + PAD * 2) : BOX_W;
        const h = expanded ? HEAD + Math.ceil(ks.length / cols) * (SUB_H + 12) - 12 + PAD : BOX_H;
        if (x > 0 && x + w > W) { x = 0; y += rowH + GAP + 18; rowH = 0; }
        boxes.set(r.id, { x, y, w, h });
        if (expanded) ks.forEach((k, i) => boxes.set(k.id, {
            x: x + PAD + (i % cols) * (SUB_W + 12), y: y + HEAD + Math.floor(i / cols) * (SUB_H + 12), w: SUB_W, h: SUB_H,
        }));
        x += w + GAP; rowH = Math.max(rowH, h);
    }
    const H = y + rowH + 30;
    const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

    // เส้นความสัมพันธ์ระหว่างกล่องที่มองเห็น — ซ้ำ/อยู่กล่องเดียวกัน = ข้าม
    const seen = new Set<string>();
    const lines = rels.flatMap((r) => {
        const a = visibleNode(r.sourceFactionId), b = visibleNode(r.targetFactionId);
        const key = [a, b].sort().join("|") + r.type;
        if (a === b || seen.has(key) || !boxes.has(a) || !boxes.has(b)) return [];
        seen.add(key);
        return [{ id: r.id, a: center(boxes.get(a)!), b: center(boxes.get(b)!), type: r.type }];
    });
    const used = [...new Set(lines.map((l) => l.type))].filter((t) => REL_STYLE[t]);
    const anyKids = roots.some((r) => kids(r.id).length > 0);

    if (factions.length === 0) return <p className="p-8 text-sm text-muted-foreground">ยังไม่มีฝ่าย</p>;

    const toggle = (id: string) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const node = (f: F, b: Box, sub: boolean) => {
        const st = statusOf?.(f);
        const ks = kids(f.id).length;
        const isOpenFrame = !sub && open.has(f.id) && ks > 0;
        const color = f.color ?? "#c2703d";
        const on = selectedId === f.id;
        const n = count(f.id);
        return (
            <g key={f.id}>
                {isOpenFrame ? (
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={color} fillOpacity={0.06} stroke={color} strokeWidth={on ? 3 : 1.5} />
                ) : (
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={color} fillOpacity={sub ? 0.7 : 0.85}
                        stroke={on ? "var(--forge-gold)" : "transparent"} strokeWidth={3} />
                )}
                <g role="button" tabIndex={0} aria-label={`${f.name} สมาชิก ${n} คน`} className="cursor-pointer focus:outline-none"
                    onClick={() => onSelect(f.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(f.id); } }}>
                    <rect x={b.x} y={b.y} width={b.w} height={isOpenFrame ? HEAD - 6 : b.h} fill="transparent" />
                    <text x={isOpenFrame ? b.x + 12 : b.x + b.w / 2} y={b.y + (isOpenFrame ? 22 : sub ? 22 : 27)} textAnchor={isOpenFrame ? "start" : "middle"}
                        className={isOpenFrame ? "fill-foreground font-bold" : "fill-white font-bold"} style={{ fontSize: sub ? 12 : 14 }}>
                        {f.name.length > (sub ? 14 : 18) ? f.name.slice(0, sub ? 13 : 17) + "…" : f.name}
                    </text>
                    <text x={isOpenFrame ? b.x + b.w - 12 : b.x + b.w / 2} y={b.y + (isOpenFrame ? 22 : sub ? 39 : 47)} textAnchor={isOpenFrame ? "end" : "middle"}
                        className={isOpenFrame ? "fill-muted-foreground" : "fill-white"} style={{ fontSize: 11, opacity: isOpenFrame ? 1 : 0.85 }}>
                        {n} คน{st ? ` · ${st.label}` : ""}{!sub && !isOpenFrame && ks > 0 ? ` · ${ks} กลุ่มย่อย` : ""}
                    </text>
                </g>
                {!sub && ks > 0 && (
                    <g role="button" tabIndex={0} aria-label={open.has(f.id) ? `พับ ${f.name}` : `กางกลุ่มย่อยของ ${f.name}`} aria-expanded={open.has(f.id)}
                        className="cursor-pointer focus:outline-none" onClick={() => toggle(f.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(f.id); } }}>
                        <rect x={b.x + b.w - 26} y={b.y + b.h - 22} width={22} height={18} rx={3} fill="black" fillOpacity={0.25} />
                        <text x={b.x + b.w - 15} y={b.y + b.h - 9} textAnchor="middle" className="fill-white" style={{ fontSize: 11 }}>{open.has(f.id) ? "▾" : "▸"}</text>
                    </g>
                )}
            </g>
        );
    };

    return (
        <div className="h-full flex flex-col p-4 gap-2 overflow-auto">
            {anyKids && (
                <div className="flex gap-1.5 text-[11px]">
                    <button type="button" onClick={() => setOpen(new Set(roots.filter((r) => kids(r.id).length).map((r) => r.id)))}
                        className="chamfered-sm border border-steel-800 px-2 py-0.5 hover:text-foreground text-muted-foreground cursor-pointer">กางทั้งหมด</button>
                    <button type="button" onClick={() => setOpen(new Set())}
                        className="chamfered-sm border border-steel-800 px-2 py-0.5 hover:text-foreground text-muted-foreground cursor-pointer">พับทั้งหมด</button>
                </div>
            )}
            <svg viewBox={`-8 -8 ${W + 16} ${H + 16}`} className="w-full min-h-[240px]" role="img" aria-label="แผนที่ความสัมพันธ์ระหว่างฝ่าย">
                <defs>
                    <marker id="defect-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 z" fill="var(--forge-gold)" />
                    </marker>
                </defs>
                {roots.map((r) => {
                    const b = boxes.get(r.id)!;
                    return open.has(r.id) && kids(r.id).length > 0 ? node(r, b, false) : null;
                })}
                {lines.map((l) => {
                    const st = REL_STYLE[l.type] ?? REL_STYLE.neutral;
                    return <line key={l.id} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={st.stroke} strokeWidth={2} strokeDasharray={st.dash} opacity={0.85} />;
                })}
                {defections.map((d, i) => {
                    const a = boxes.get(visibleNode(d.fromFactionId)), b = boxes.get(visibleNode(d.toFactionId));
                    if (!a || !b || a === b) return null;
                    const p = center(a), q = center(b);
                    const mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - 40 - (i % 3) * 16;
                    return (
                        <g key={`d${i}`}>
                            <path d={`M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`} fill="none" stroke="var(--forge-gold)" strokeWidth={1.5} markerEnd="url(#defect-arrow)" />
                            <text x={mx} y={my + 4} textAnchor="middle" className="fill-[var(--forge-gold)]" style={{ fontSize: 11 }}>
                                {charName?.(d.characterId) ?? ""} · บท {d.atOrder}
                            </text>
                        </g>
                    );
                })}
                {roots.map((r) => {
                    const b = boxes.get(r.id)!;
                    if (open.has(r.id) && kids(r.id).length > 0) return kids(r.id).map((k) => node(k, boxes.get(k.id)!, true));
                    return node(r, b, false);
                })}
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {used.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                        <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={REL_STYLE[t].stroke} strokeWidth="2" strokeDasharray={REL_STYLE[t].dash} /></svg>
                        {REL_STYLE[t].label}
                    </span>
                ))}
                {defections.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                        <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--forge-gold)" strokeWidth="2" /></svg>
                        ย้ายฝ่าย
                    </span>
                )}
                {!used.length && !defections.length && <span>ยังไม่มีความสัมพันธ์ระหว่างฝ่าย — กดที่ฝ่ายแล้วเพิ่มใน &ldquo;ความสัมพันธ์กับฝ่ายอื่น&rdquo;</span>}
                <span className="ml-auto">กดชื่อฝ่าย = ดูรายละเอียด · ▸ = กางกลุ่มย่อย</span>
            </div>
        </div>
    );
}

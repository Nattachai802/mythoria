"use client";

import { useRef, useState } from "react";
import type { Defection } from "@/lib/faction-checks";

type F = { id: string; name: string; color?: string | null; parentFactionId?: string | null; status?: string | null; statusTimeline?: unknown; members?: { characterId: string }[] };
type R = { id: string; sourceFactionId: string; targetFactionId: string; type: string };
type P = { x: number; y: number };

const REL_STYLE: Record<string, { stroke: string; dash?: string; label: string }> = {
    enemy: { stroke: "#dc2626", label: "ศัตรู" },
    rival: { stroke: "#f59e0b", dash: "6 4", label: "คู่แข่ง" },
    ally: { stroke: "#10b981", label: "พันธมิตร" },
    subsidiary: { stroke: "#818cf8", label: "ขึ้นตรงต่อ" },
    splinter: { stroke: "#a78bfa", dash: "2 4", label: "แตกออกมา" },
    neutral: { stroke: "#94a3b8", dash: "5 4", label: "เป็นกลาง" },
};

const W = 800, H = 520;
const radius = (n: number) => Math.min(56, 24 + n * 2);

/**
 * แผนที่กราฟโหนด: ฝ่ายใหญ่ = วงกลม (ขนาดตามสมาชิกรวมกลุ่มย่อย) · กลุ่มย่อยชั้นแรก = วงเล็กโคจรรอบ
 * ลากวงใหญ่ได้ · คลิก = เลือก (แผงข้างโชว์ข้อมูล)
 * ponytail: ตำแหน่งที่ลากเก็บแค่ใน state หน้าจอ รีเฟรชแล้ววางใหม่ — อยากจำต้องเพิ่มคอลัมน์ใน DB
 * ponytail: กลุ่มย่อยชั้นที่ 2+ นับรวมเข้ากลุ่มย่อยชั้นแรก
 */
export function FactionMap({ factions, rels, defections = [], charName, statusOf, selectedId, onSelect, onOpen }: {
    factions: F[]; rels: R[]; defections?: Defection[]; charName?: (id: string) => string;
    statusOf?: (f: F) => { key?: string; label: string; color: string } | null;
    selectedId: string | null; onSelect: (id: string) => void; onOpen?: (id: string) => void;
}) {
    const ids = new Set(factions.map((f) => f.id));
    const byId = new Map(factions.map((f) => [f.id, f]));
    const kids = (id: string) => factions.filter((f) => f.parentFactionId === id);
    const roots = factions.filter((f) => !f.parentFactionId || !ids.has(f.parentFactionId));
    const subtree = (id: string): string[] => [id, ...kids(id).flatMap((k) => subtree(k.id))];
    const count = (id: string) => new Set(subtree(id).flatMap((x) => (byId.get(x)?.members ?? []).map((m) => m.characterId))).size;

    const [moved, setMoved] = useState<Record<string, P>>({});
    const svgRef = useRef<SVGSVGElement>(null);
    const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

    // วางเริ่มต้นเป็นวงรีรอบกลาง (คนเดียว = ตรงกลาง)
    const pos = new Map<string, P>();
    roots.forEach((r, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / roots.length;
        const base = roots.length === 1 ? { x: W / 2, y: H / 2 } : { x: W / 2 + Math.cos(a) * 270, y: H / 2 + Math.sin(a) * 170 };
        pos.set(r.id, moved[r.id] ?? base);
    });
    const orbit = new Map<string, P & { root: string }>();
    for (const r of roots) {
        const ks = kids(r.id), c = pos.get(r.id)!, d = radius(count(r.id)) + 30;
        ks.forEach((k, i) => {
            const a = -Math.PI / 2 + (i * Math.PI * 2) / ks.length + 0.5;
            const p = { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, root: r.id };
            subtree(k.id).forEach((x) => orbit.set(x, p));
        });
    }
    const at = (id: string): P | undefined => pos.get(id) ?? orbit.get(id);

    const seen = new Set<string>();
    const lines = rels.flatMap((r) => {
        const a = at(r.sourceFactionId), b = at(r.targetFactionId);
        const key = [r.sourceFactionId, r.targetFactionId].sort().join("|") + r.type;
        if (!a || !b || a === b || seen.has(key)) return [];
        seen.add(key);
        return [{ id: r.id, a, b, type: r.type }];
    });
    const used = [...new Set(lines.map((l) => l.type))].filter((t) => REL_STYLE[t]);

    const toSvg = (e: React.PointerEvent) => {
        const pt = svgRef.current!.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        return pt.matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
    };
    const onDown = (e: React.PointerEvent, id: string) => {
        const p = toSvg(e), c = pos.get(id)!;
        drag.current = { id, dx: p.x - c.x, dy: p.y - c.y, moved: false };
        (e.target as Element).setPointerCapture(e.pointerId);
    };
    const onMove = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const p = toSvg(e);
        d.moved = true;
        setMoved((m) => ({ ...m, [d.id]: { x: Math.max(40, Math.min(W - 40, p.x - d.dx)), y: Math.max(50, Math.min(H - 40, p.y - d.dy)) } }));
    };
    const onUp = (id: string) => {
        if (drag.current && !drag.current.moved) onSelect(id);
        drag.current = null;
    };
    const keySelect = (id: string) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(id); } };

    if (factions.length === 0) return <p className="p-8 text-sm text-muted-foreground">ยังไม่มีฝ่าย</p>;

    const sel = selectedId ? byId.get(selectedId) : undefined;
    const selRels = sel ? rels.filter((r) => r.sourceFactionId === sel.id || r.targetFactionId === sel.id) : [];
    const look = (f: F) => {
        const st = statusOf?.(f);
        return { st, hidden: st?.key === "hidden" || st?.key === "secret", dead: st?.key === "disbanded" };
    };

    return (
        <div className="h-full flex gap-4 p-4">
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full chamfered-sm border border-steel-800 bg-card/40 touch-none select-none"
                    role="img" aria-label="แผนที่ความสัมพันธ์ระหว่างฝ่าย">
                    <defs>
                        <marker id="defect-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M0,0 L10,5 L0,10 z" fill="var(--forge-gold)" />
                        </marker>
                    </defs>
                    {lines.map((l) => {
                        const s = REL_STYLE[l.type] ?? REL_STYLE.neutral;
                        return <line key={l.id} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={s.stroke} strokeWidth={2} strokeDasharray={s.dash} opacity={0.75} />;
                    })}
                    {defections.map((d, i) => {
                        const p = at(d.fromFactionId), q = at(d.toFactionId);
                        if (!p || !q || p === q) return null;
                        const mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - 40 - (i % 3) * 16;
                        return (
                            <g key={`d${i}`}>
                                <path d={`M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`} fill="none" stroke="var(--forge-gold)" strokeWidth={1.5} markerEnd="url(#defect-arrow)" />
                                <text x={mx} y={my + 4} textAnchor="middle" className="fill-[var(--forge-gold)]" style={{ fontSize: 11 }}>{charName?.(d.characterId) ?? ""} · บท {d.atOrder}</text>
                            </g>
                        );
                    })}
                    {roots.map((r) => {
                        const c = pos.get(r.id)!, color = r.color ?? "#c2703d";
                        return kids(r.id).map((k) => {
                            const p = orbit.get(k.id)!, { hidden, dead } = look(k);
                            return (
                                <g key={k.id} role="button" tabIndex={0} aria-label={`${k.name} กลุ่มย่อยของ ${r.name}`} className="cursor-pointer focus:outline-none"
                                    opacity={dead ? 0.35 : 1} onClick={() => onSelect(k.id)} onKeyDown={keySelect(k.id)}>
                                    <line x1={c.x} y1={c.y} x2={p.x} y2={p.y} stroke={color} strokeWidth={1} opacity={0.4} />
                                    <circle cx={p.x} cy={p.y} r={11} fill={k.color ?? color} fillOpacity={hidden ? 0.4 : 0.9}
                                        stroke={selectedId === k.id ? "var(--forge-gold)" : "transparent"} strokeWidth={3} strokeDasharray={hidden ? "3 3" : undefined} />
                                    <text x={p.x} y={p.y + 25} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                                        {k.name.length > 12 ? k.name.slice(0, 11) + "…" : k.name}
                                    </text>
                                </g>
                            );
                        });
                    })}
                    {roots.map((r) => {
                        const c = pos.get(r.id)!, n = count(r.id), rad = radius(n), color = r.color ?? "#c2703d", { hidden, dead } = look(r);
                        return (
                            <g key={r.id} role="button" tabIndex={0} aria-label={`${r.name} สมาชิก ${n} คน`} className="cursor-grab active:cursor-grabbing focus:outline-none"
                                opacity={dead ? 0.4 : 1} onPointerDown={(e) => onDown(e, r.id)} onPointerMove={onMove} onPointerUp={() => onUp(r.id)} onKeyDown={keySelect(r.id)}>
                                <circle cx={c.x} cy={c.y} r={rad} fill={color} fillOpacity={hidden ? 0.45 : 0.9}
                                    stroke={selectedId === r.id ? "var(--forge-gold)" : hidden ? color : "transparent"} strokeWidth={3} strokeDasharray={hidden ? "5 4" : undefined} />
                                <text x={c.x} y={c.y + 5} textAnchor="middle" className="fill-white font-bold pointer-events-none" style={{ fontSize: 14 }}>{n}</text>
                                <text x={c.x} y={c.y - rad - 9} textAnchor="middle" className="fill-foreground font-bold pointer-events-none" style={{ fontSize: 14 }}>
                                    {r.name.length > 18 ? r.name.slice(0, 17) + "…" : r.name}
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {used.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1.5">
                            <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={REL_STYLE[t].stroke} strokeWidth="2" strokeDasharray={REL_STYLE[t].dash} /></svg>
                            {REL_STYLE[t].label}
                        </span>
                    ))}
                    {defections.length > 0 && <span className="text-[var(--forge-gold)]">→ ย้ายฝ่าย</span>}
                    <span className="ml-auto">วงใหญ่ = ฝ่ายใหญ่ (ตัวเลข = สมาชิก) · วงเล็ก = กลุ่มย่อย  · จาง = ยุบแล้ว · ลากวงใหญ่ได้</span>
                </div>
            </div>

            <aside className="w-56 shrink-0 border-l border-steel-800/60 pl-4 text-sm">
                {sel ? (() => {
                    const st = statusOf?.(sel);
                    const parent = sel.parentFactionId ? byId.get(sel.parentFactionId) : undefined;
                    return (
                        <div className="space-y-3">
                            <div>
                                <p className="font-display font-bold">{sel.name}</p>
                                {parent && <p className="text-xs text-muted-foreground">กลุ่มย่อยของ {parent.name}</p>}
                                <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full" style={{ background: st?.color ?? "#64748b" }} />
                                    {st?.label ?? "ไม่ระบุสถานะ"} · {count(sel.id)} คน
                                </p>
                            </div>
                            <div>
                                <p className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">กลุ่มย่อย</p>
                                {kids(sel.id).length ? kids(sel.id).map((k) => (
                                    <button key={k.id} type="button" onClick={() => onSelect(k.id)} className="block text-left hover:text-[var(--forge-amber)] cursor-pointer">· {k.name}</button>
                                )) : <p className="text-muted-foreground">—</p>}
                            </div>
                            <div>
                                <p className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">ความสัมพันธ์</p>
                                {selRels.length ? selRels.map((r) => {
                                    const other = byId.get(r.sourceFactionId === sel.id ? r.targetFactionId : r.sourceFactionId);
                                    const s = REL_STYLE[r.type] ?? REL_STYLE.neutral;
                                    return <p key={r.id}><span style={{ color: s.stroke }}>{s.label}</span> · {other?.name ?? "—"}</p>;
                                }) : <p className="text-muted-foreground">—</p>}
                            </div>
                            {onOpen && (
                                <button type="button" onClick={() => onOpen(sel.id)}
                                    className="w-full chamfered-sm border border-steel-800 py-1.5 text-xs hover:border-[var(--forge-amber)] hover:text-[var(--forge-amber)] cursor-pointer">
                                    เปิดรายละเอียด
                                </button>
                            )}
                        </div>
                    );
                })() : <p className="text-xs text-muted-foreground">คลิกฝ่ายบนแผนที่เพื่อดูข้อมูล</p>}
            </aside>
        </div>
    );
}

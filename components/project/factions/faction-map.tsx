"use client";

import { cn } from "@/lib/utils";
import type { Defection } from "@/lib/faction-checks";

type F = { id: string; name: string; color?: string | null; members?: unknown[] };
type R = { id: string; sourceFactionId: string; targetFactionId: string; type: string };

const REL_STYLE: Record<string, { stroke: string; dash?: string; label: string }> = {
    enemy: { stroke: "#dc2626", dash: "6 4", label: "ศัตรู" },
    rival: { stroke: "#f59e0b", dash: "3 3", label: "คู่แข่ง" },
    ally: { stroke: "#10b981", label: "พันธมิตร" },
    subsidiary: { stroke: "#818cf8", label: "ขึ้นตรงต่อ" },
    splinter: { stroke: "#a78bfa", dash: "2 4", label: "แตกออกมา" },
    neutral: { stroke: "#94a3b8", dash: "1 4", label: "เป็นกลาง" },
};

/**
 * แผนที่อำนาจ (อ่านอย่างเดียว) — ฝ่ายวางเป็นวงกลม เส้นตามชนิดความสัมพันธ์ ขนาดตามจำนวนสมาชิกในบทที่เลือก
 * ponytail: วงกลมพอสำหรับ ≲15 ฝ่าย — เกินนั้นป้ายจะเบียด ค่อยเปลี่ยนเป็น force layout
 */
export function FactionMap({ factions, rels, defections = [], charName, selectedId, onSelect }: {
    factions: F[]; rels: R[]; defections?: Defection[]; charName?: (id: string) => string; selectedId: string | null; onSelect: (id: string) => void;
}) {
    const W = 760, H = 520, cx = W / 2, cy = H / 2;
    const r = factions.length <= 1 ? 0 : Math.min(cx, cy) - 80;
    const maxM = Math.max(1, ...factions.map((f) => f.members?.length ?? 0));
    const pos = new Map(factions.map((f, i) => {
        const a = (i / Math.max(1, factions.length)) * Math.PI * 2 - Math.PI / 2;
        return [f.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }];
    }));
    const used = [...new Set(rels.map((x) => x.type))].filter((t) => REL_STYLE[t]);

    if (factions.length === 0) return <p className="p-8 text-sm text-muted-foreground">ยังไม่มีฝ่าย</p>;

    return (
        <div className="h-full flex flex-col p-4 gap-2 overflow-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-full min-h-[320px]" role="img" aria-label="แผนที่ความสัมพันธ์ระหว่างฝ่าย">
                {rels.map((x) => {
                    const a = pos.get(x.sourceFactionId), b = pos.get(x.targetFactionId);
                    if (!a || !b) return null;
                    const st = REL_STYLE[x.type] ?? REL_STYLE.neutral;
                    return <line key={x.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={st.stroke} strokeWidth={2} strokeDasharray={st.dash} opacity={0.8} />;
                })}
                <defs>
                    <marker id="defect-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                        <path d="M0,0 L10,5 L0,10 z" fill="var(--forge-gold)" />
                    </marker>
                </defs>
                {/* คนย้ายฝ่าย: เส้นโค้งสีทอง A → B (โค้งออกนอกเส้นความสัมพันธ์) */}
                {defections.map((d, i) => {
                    const a = pos.get(d.fromFactionId), b = pos.get(d.toFactionId);
                    if (!a || !b) return null;
                    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
                    const dx = mx - cx, dy = my - cy, len = Math.hypot(dx, dy) || 1;
                    const bend = 60 + (i % 3) * 18;
                    const qx = mx + (dx / len) * bend, qy = my + (dy / len) * bend;
                    return (
                        <g key={`d${i}`}>
                            <path d={`M${a.x},${a.y} Q${qx},${qy} ${b.x},${b.y}`} fill="none" stroke="var(--forge-gold)" strokeWidth={1.5} markerEnd="url(#defect-arrow)" opacity={0.9} />
                            <text x={qx} y={qy} textAnchor="middle" className="fill-[var(--forge-gold)]" style={{ fontSize: 11 }}>
                                {charName?.(d.characterId) ?? ""} · บท {d.atOrder}
                            </text>
                        </g>
                    );
                })}
                {factions.map((f) => {
                    const p = pos.get(f.id)!;
                    const n = f.members?.length ?? 0;
                    const size = 26 + (n / maxM) * 18;
                    const color = f.color ?? "#c2703d";
                    const on = selectedId === f.id;
                    return (
                        <g key={f.id} role="button" tabIndex={0} aria-label={`${f.name} สมาชิก ${n} คน`} className="cursor-pointer focus:outline-none"
                            onClick={() => onSelect(f.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(f.id); } }}>
                            <circle cx={p.x} cy={p.y} r={size} fill={color} fillOpacity={0.85}
                                stroke={on ? "var(--forge-gold)" : "transparent"} strokeWidth={4} />
                            <text x={p.x} y={p.y + 5} textAnchor="middle" className="fill-white font-bold" style={{ fontSize: 14 }}>{n}</text>
                            <text x={p.x} y={p.y + size + 18} textAnchor="middle" className={cn("fill-foreground", on && "font-bold")} style={{ fontSize: 13 }}>{f.name}</text>
                        </g>
                    );
                })}
            </svg>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {used.length ? used.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                        <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke={REL_STYLE[t].stroke} strokeWidth="2" strokeDasharray={REL_STYLE[t].dash} /></svg>
                        {REL_STYLE[t].label}
                    </span>
                )) : defections.length ? null : <span>ยังไม่มีความสัมพันธ์ระหว่างฝ่าย — กดที่ฝ่ายแล้วเพิ่มใน &ldquo;ความสัมพันธ์กับฝ่ายอื่น&rdquo;</span>}
                {defections.length > 0 && (
                    <span className="inline-flex items-center gap-1.5">
                        <svg width="22" height="6" aria-hidden><line x1="0" y1="3" x2="22" y2="3" stroke="var(--forge-gold)" strokeWidth="2" /></svg>
                        ย้ายฝ่าย
                    </span>
                )}
                <span className="ml-auto">ตัวเลข = สมาชิก · กดที่ฝ่ายเพื่อดูรายละเอียด</span>
            </div>
        </div>
    );
}

"use client";

import { useState, useMemo, useRef } from "react";
import { BarChart3, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface StylometryData {
    id: string;
    noteId: string;
    chapterTitle: string;
    pacingAndMood: any;
    authorNarrationStyle: any;
    characterDialogueVibes: any;
    lexicalRichness: any;
    chapterAnatomy: any;
    createdAt: string | Date;
    fingerprintAnalysis?: {
        similarity_score: number;
        status: string;
        is_anomaly: boolean;
        feature_details: Array<{ feature: string; z_score: number; status: string }>;
        alerts: Array<{ feature: string; z_score: number; message: string }>;
    };
}

interface StylometryDashboardProps {
    data: StylometryData[];
}

const FEATURES = [
    {
        key: "ttr",
        label: "ความหลากหลายของคลังคำ (TTR)",
        shortLabel: "คลังคำ TTR",
        unit: "%",
        color: "#8b5cf6",
        extract: (d: StylometryData) => d.lexicalRichness?.type_token_ratio_percentage ?? null,
    },
    {
        key: "punct",
        label: "ความหนาแน่นของเครื่องหมาย",
        shortLabel: "เครื่องหมาย",
        unit: "/1k",
        color: "#0ea5e9",
        extract: (d: StylometryData) => d.pacingAndMood?.total_density_per_1k ?? null,
    },
    {
        key: "sentlen",
        label: "ความยาวประโยคเฉลี่ย",
        shortLabel: "ยาวประโยค",
        unit: "คำ",
        color: "#f59e0b",
        extract: (d: StylometryData) => d.chapterAnatomy?.avg_words_per_sentence ?? null,
    },
    {
        key: "dialogue",
        label: "สัดส่วนบทสนทนา",
        shortLabel: "บทสนทนา",
        unit: "%",
        color: "#10b981",
        extract: (d: StylometryData) => d.chapterAnatomy?.dialogue_ratio_percentage ?? null,
    },
    {
        key: "particle",
        label: "ความหนาแน่นของคำลงท้าย",
        shortLabel: "คำลงท้าย",
        unit: "/1k",
        color: "#ec4899",
        extract: (d: StylometryData) => {
            const total = d.lexicalRichness?.total_words ?? 0;
            const particles = d.characterDialogueVibes?.total_particles ?? 0;
            return total > 0 ? Math.round((particles / total) * 1000 * 10) / 10 : null;
        },
    },
];

function computeZScores(data: StylometryData[], feat: typeof FEATURES[0]) {
    const vals = data.map(d => feat.extract(d));
    const valid = vals.filter((v): v is number => v !== null);
    if (valid.length < 2) return vals.map(() => ({ z: 0, raw: null as number | null }));
    const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
    const std = Math.sqrt(valid.reduce((a, b) => a + (b - mean) ** 2, 0) / valid.length) || 0.001;
    return vals.map(v => ({
        z: v !== null ? parseFloat(((v - mean) / std).toFixed(2)) : 0,
        raw: v,
    }));
}

export function StylometryDashboard({ data }: StylometryDashboardProps) {
    const [visibleFeatures, setVisibleFeatures] = useState<Set<string>>(
        new Set(FEATURES.map(f => f.key))
    );
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const toggleFeature = (key: string) => {
        setVisibleFeatures(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size === 1) return next; // keep at least one
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const featureZScores = useMemo(
        () => FEATURES.map(f => ({ key: f.key, scores: computeZScores(data, f) })),
        [data]
    );

    if (!data || data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center chamfered border border-dashed border-border bg-card/40">
                <BarChart3 className="w-10 h-10 text-[var(--forge-gold)]/50 mb-4" />
                <h3 className="text-lg font-display font-semibold">ยังไม่มีข้อมูลการวิเคราะห์สไตล์การเขียน</h3>
                <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                    ไปที่หน้าต่างแต่งนิยายในแต่ละตอน และกดปุ่ม <strong className="text-[var(--forge-amber)]">&ldquo;วิเคราะห์ลีลาการเขียน&rdquo;</strong> เพื่อนำข้อมูลเชิงลึกมาแสดงผลเปรียบเทียบที่นี่
                </p>
            </div>
        );
    }

    // ─── SVG layout ───────────────────────────────────────────────────────────
    // Min 900px, scale up at 70px/chapter so dots don't overlap
    const svgW = Math.max(900, data.length * 70);
    const svgH = 280;
    const padL = 44, padR = 20, padT = 28, padB = 40;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    // Y from -3 SD to +3 SD
    const yMin = -3, yMax = 3, yRange = yMax - yMin;
    const toX = (i: number) => padL + (data.length < 2 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const toY = (z: number) => padT + chartH - ((Math.max(yMin, Math.min(yMax, z)) - yMin) / yRange) * chartH;

    const yTicks = [-2, -1, 0, 1, 2];

    const buildPath = (scores: { z: number; raw: number | null }[]) => {
        const pts = scores.map((s, i) => ({ x: toX(i), y: toY(s.z), valid: s.raw !== null }));
        return pts.reduce((acc, p, i) => {
            if (!p.valid) return acc;
            if (i === 0 || !pts[i - 1].valid) return acc + `M${p.x},${p.y}`;
            const prev = pts[i - 1];
            const cpX = (prev.x + p.x) / 2;
            return acc + ` C${cpX},${prev.y} ${cpX},${p.y} ${p.x},${p.y}`;
        }, "");
    };

    const hoverX = hoveredIdx !== null ? toX(hoveredIdx) : null;

    return (
        <div className="space-y-5 pb-10">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-display font-bold tracking-tight">วิเคราะห์ลีลาการเขียน</h2>
                    <p className="text-muted-foreground mt-1 text-sm max-w-xl">
                        เปรียบเทียบคุณลักษณะการเขียนรายตอน — เห็นชัดว่าตอนไหนเปลี่ยนไปจากสไตล์ปกติของคุณ
                    </p>
                </div>
                <div className="font-technical text-[9px] uppercase tracking-[0.15em] px-3 py-1.5 bg-muted text-muted-foreground chamfered-sm border border-border flex gap-2 items-center shrink-0 tabular-nums">
                    <Info className="w-3.5 h-3.5" />
                    {data.length} ตอน
                </div>
            </div>

            {/* ── Main Multi-line Chart ── */}
            <div className="chamfered border border-border bg-card/50 p-5">
                <div className="pb-3">
                    <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Style Profile · ตลอดทั้งเรื่อง</span>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        แกน Y = ค่าเบี่ยงเบน (Z-Score) จากค่าเฉลี่ยสไตล์ของคุณ — เส้นที่ขึ้น/ลงแรงคือตอนที่เปลี่ยนไปมากกว่าปกติ
                    </p>

                    {/* Feature toggles */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        {FEATURES.map(f => {
                            const active = visibleFeatures.has(f.key);
                            return (
                                <button
                                    key={f.key}
                                    onClick={() => toggleFeature(f.key)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all select-none",
                                        active
                                            ? "text-white shadow border-transparent"
                                            : "bg-muted/50 text-muted-foreground border-border opacity-50 hover:opacity-80"
                                    )}
                                    style={active ? { backgroundColor: f.color, borderColor: f.color } : {}}
                                >
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: active ? "white" : f.color }}
                                    />
                                    {f.shortLabel}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-0">
                    <div className="overflow-x-auto">
                    <div
                        className="relative chamfered-sm border border-border/40 bg-muted/10 overflow-hidden select-none"
                        style={{ minWidth: `${svgW}px` }}
                    >
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${svgW} ${svgH}`}
                            className="w-full block"
                            style={{ width: `${svgW}px`, height: `${svgH}px` }}
                            onMouseMove={e => {
                                const rect = svgRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                const relX = (e.clientX - rect.left) / rect.width * svgW;
                                const idx = Math.round((relX - padL) / (chartW / (data.length - 1 || 1)));
                                setHoveredIdx(Math.max(0, Math.min(data.length - 1, idx)));
                            }}
                            onMouseLeave={() => setHoveredIdx(null)}
                        >
                            <defs>
                                <clipPath id="chart-clip">
                                    <rect x={padL} y={padT} width={chartW} height={chartH} />
                                </clipPath>
                            </defs>

                            {/* Anomaly zones ±1.96 */}
                            <rect x={padL} y={padT} width={chartW} height={toY(3) - toY(yMax)} fill="hsl(0,80%,55%)" fillOpacity="0.04" />
                            <rect x={padL} y={toY(yMin)} width={chartW} height={toY(yMin) - toY(-2)} fill="hsl(0,80%,55%)" fillOpacity="0.04" />

                            {/* Normal band -1 to +1 */}
                            <rect
                                x={padL} y={toY(1)} width={chartW} height={toY(-1) - toY(1)}
                                fill="hsl(48,90%,55%)" fillOpacity="0.08"
                            />

                            {/* Y-axis ticks */}
                            {yTicks.map(z => {
                                const y = toY(z);
                                const isMid = z === 0;
                                const isThreshold = Math.abs(z) === 2;
                                return (
                                    <g key={z}>
                                        <line
                                            x1={padL} y1={y} x2={svgW - padR} y2={y}
                                            stroke={isMid ? "hsl(48,90%,55%)" : isThreshold ? "hsl(0,70%,55%)" : "currentColor"}
                                            strokeWidth={isMid ? 1 : 0.5}
                                            strokeDasharray={isMid ? "4 6" : isThreshold ? "3 4" : "2 6"}
                                            opacity={isMid ? 0.5 : isThreshold ? 0.35 : 0.2}
                                            className={isMid ? "" : "text-muted-foreground"}
                                        />
                                        <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="9"
                                            fill={isMid ? "hsl(48,90%,55%)" : isThreshold ? "hsl(0,65%,55%)" : "hsl(0,0%,60%)"}
                                            fontWeight={isMid ? "700" : "400"}>
                                            {z > 0 ? `+${z}` : z}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Labels */}
                            <text x={padL + 4} y={toY(1) - 4} fontSize="8" fill="hsl(48,90%,55%)" opacity="0.7">โซนปกติ</text>
                            <text x={padL + 4} y={toY(2) - 4} fontSize="8" fill="hsl(0,65%,55%)" opacity="0.7">ผิดปกติ (&gt;2 SD)</text>

                            {/* Hover crosshair */}
                            {hoverX !== null && (
                                <line x1={hoverX} y1={padT} x2={hoverX} y2={padT + chartH}
                                    stroke="currentColor" strokeWidth="0.7" strokeDasharray="3 4"
                                    className="text-muted-foreground/40" />
                            )}

                            {/* Lines per feature */}
                            {FEATURES.filter(f => visibleFeatures.has(f.key)).map(f => {
                                const scores = featureZScores.find(s => s.key === f.key)!.scores;
                                const path = buildPath(scores);
                                return (
                                    <g key={f.key} clipPath="url(#chart-clip)">
                                        {/* Glow */}
                                        <path d={path} fill="none" stroke={f.color} strokeWidth="5" opacity="0.12" strokeLinecap="round" />
                                        {/* Main line */}
                                        <path d={path} fill="none" stroke={f.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                                        {/* Dots */}
                                        {scores.map((s, i) => {
                                            if (s.raw === null) return null;
                                            const isHover = hoveredIdx === i;
                                            const isAnomaly = Math.abs(s.z) >= 1.96;
                                            const isDrift = Math.abs(s.z) >= 1.0;
                                            return (
                                                <circle
                                                    key={i}
                                                    cx={toX(i)} cy={toY(s.z)}
                                                    r={isHover ? 6 : isAnomaly ? 5 : isDrift ? 4 : 3}
                                                    fill={f.color}
                                                    stroke="white"
                                                    strokeWidth={isHover || isAnomaly ? 2 : 1}
                                                    opacity={isHover ? 1 : isAnomaly ? 0.9 : 0.7}
                                                />
                                            );
                                        })}
                                    </g>
                                );
                            })}

                            {/* X-axis chapter labels */}
                            {data.map((d, i) => (
                                <text
                                    key={i}
                                    x={toX(i)} y={padT + chartH + 16}
                                    textAnchor="middle" fontSize="9"
                                    fill={hoveredIdx === i ? "hsl(48,90%,55%)" : "hsl(0,0%,60%)"}
                                    fontWeight={hoveredIdx === i ? "700" : "400"}
                                >
                                    {i + 1}
                                </text>
                            ))}
                        </svg>

                        {/* Hover Tooltip */}
                        {hoveredIdx !== null && (() => {
                            const chapter = data[hoveredIdx];
                            return (
                                <div className="absolute top-3 right-3 bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg p-3 min-w-[200px] pointer-events-none">
                                    <div className="font-semibold text-sm mb-2 truncate max-w-[180px]">
                                        {hoveredIdx + 1}. {chapter.chapterTitle}
                                    </div>
                                    <div className="space-y-1.5">
                                        {FEATURES.filter(f => visibleFeatures.has(f.key)).map(f => {
                                            const s = featureZScores.find(x => x.key === f.key)!.scores[hoveredIdx];
                                            const isAnomaly = Math.abs(s.z) >= 1.96;
                                            const isDrift = Math.abs(s.z) >= 1.0;
                                            return (
                                                <div key={f.key} className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                                                        <span className="text-[10px] text-muted-foreground truncate">{f.shortLabel}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 shrink-0 text-right">
                                                        <span className="text-[10px] text-muted-foreground font-mono">
                                                            {s.raw?.toFixed(1)}{f.unit}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[10px] font-bold font-mono",
                                                            isAnomaly ? "text-red-500" : isDrift ? "text-amber-500" : "text-emerald-500"
                                                        )}>
                                                            ({s.z > 0 ? "+" : ""}{s.z.toFixed(2)})
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    </div>{/* end overflow-x-auto */}

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3 text-[10px] text-muted-foreground">
                        <span>แกน Y = ค่าเบี่ยงเบน (SD) จากค่าเฉลี่ย</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-px bg-[var(--forge-gold)]/40 border-b border-dashed border-[var(--forge-gold)]/50 inline-block" />โซนปกติ (0 ±1)</span>
                        <span className="flex items-center gap-1 text-red-400/70"><span className="w-3 h-px bg-red-400/50 border-b border-dashed border-red-400/50 inline-block" />ผิดปกติ (±2)</span>
                    </div>
                </div>
            </div>

            {/* Bottom 2-col */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="chamfered border border-border bg-card/50 p-5">
                    <div className="mb-4">
                        <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">สัดส่วนบรรยาย vs สนทนา</span>
                        <p className="text-xs text-muted-foreground mt-1">ดุลยภาพระหว่างบทบรรยายและบทสนทนาในแต่ละตอน</p>
                    </div>
                    <div className="pb-1">
                        <ScrollArea className="h-[360px] pr-3">
                            <div className="space-y-4">
                                {data.map((item) => {
                                    const dialogRatio = item.chapterAnatomy?.dialogue_ratio_percentage || 0;
                                    const narrationRatio = item.chapterAnatomy?.narration_ratio_percentage || 0;
                                    return (
                                        <div key={item.id} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium truncate max-w-[160px]" title={item.chapterTitle}>{item.chapterTitle}</span>
                                                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                                    บรรยาย {narrationRatio}% / สนทนา {dialogRatio}%
                                                </span>
                                            </div>
                                            <div className="h-2.5 w-full bg-muted rounded-full flex overflow-hidden">
                                                <div className="bg-[var(--chart-3)] h-full opacity-70" style={{ width: `${narrationRatio}%` }} />
                                                <div className="bg-[var(--forge-gold)] h-full opacity-80" style={{ width: `${dialogRatio}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                        <div className="flex gap-4 mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground justify-center">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 chamfered-sm bg-[var(--chart-3)] opacity-70" />บทบรรยาย</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 chamfered-sm bg-[var(--forge-gold)] opacity-80" />บทสนทนา</span>
                        </div>
                    </div>
                </div>

                <div className="chamfered border border-border bg-card/50 p-5">
                    <div className="mb-4">
                        <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">อารมณ์และบรรยากาศรายตอน</span>
                        <p className="text-xs text-muted-foreground mt-1">น้ำเสียงภาพรวมและบรรยากาศตัวละครที่ระบบประเมิน</p>
                    </div>
                    <div className="pb-1">
                        <ScrollArea className="h-[360px] pr-3">
                            <div className="space-y-3">
                                {data.map((item) => {
                                    const mood = item.pacingAndMood?.vibe || "ไม่มีข้อมูล";
                                    const charVibe = item.characterDialogueVibes?.vibe || "ไม่มีข้อมูล";
                                    return (
                                        <div key={item.id} className="p-3 chamfered-sm border border-border bg-card/50">
                                            <h4 className="font-medium text-sm mb-2">{item.chapterTitle}</h4>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-muted-foreground block mb-1">ภาพรวมตอน</span>
                                                    <span className="inline-flex chamfered-sm bg-muted px-2 py-1 font-medium text-foreground">{mood.split('(')[0].trim()}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground block mb-1">บรรยากาศตัวละคร</span>
                                                    <span className="inline-flex chamfered-sm bg-[var(--forge-gold)]/10 px-2 py-1 font-medium text-[var(--forge-amber)]">{charVibe.split('(')[0].trim()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useMemo, useRef } from "react";
import { BarChart3, Info, Search, X, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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
        key: "mtld",
        label: "ความหลากหลายของคลังคำ (MTLD)",
        shortLabel: "คลังคำ MTLD",
        unit: "",
        color: "#8b5cf6",
        // MTLD ทนต่อความยาวตอน — แม่นกว่า TTR (fallback TTR ถ้าตอนเก่ายังไม่มี mtld)
        extract: (d: StylometryData) => d.lexicalRichness?.mtld ?? d.lexicalRichness?.type_token_ratio_percentage ?? null,
    },
    {
        key: "burstiness",
        label: "จังหวะประโยค (สั้น-ยาวสลับ)",
        shortLabel: "จังหวะ",
        unit: "",
        color: "#f43f5e",
        // -1 = สม่ำเสมอ, +1 = สั้นสลับยาวรุนแรง (action/บรรยายสลับ)
        extract: (d: StylometryData) => d.chapterAnatomy?.sentence_rhythm?.burstiness ?? null,
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

// แปล z-score แต่ละมิติ → ภาษานักเขียน (เทียบกับ "ค่าปกติของคุณเอง" ไม่ใช่คะแนน)
const FEATURE_PLAIN: Record<string, { name: string; high: string; low: string }> = {
    mtld: { name: "คลังคำ", high: "คำศัพท์หลากหลายกว่าปกติ", low: "ใช้คำซ้ำเยอะกว่าปกติ" },
    burstiness: { name: "จังหวะ", high: "สั้น-ยาวสลับแรง (action/ดราม่า)", low: "สม่ำเสมอ ราบเรียบ" },
    punct: { name: "เครื่องหมาย", high: "เยอะ อารมณ์พุ่ง", low: "น้อย โทนสงบ" },
    sentlen: { name: "ความยาวประโยค", high: "ประโยคยาว บรรยายไหล", low: "ประโยคสั้น กระชับเร็ว" },
    dialogue: { name: "บทสนทนา", high: "บทสนทนาเยอะ", low: "เน้นบรรยาย" },
    particle: { name: "คำลงท้าย", high: "เยอะ น้ำเสียงตัวละครชัด", low: "น้อย" },
};

/** สรุปตอนเป็นภาษาคน — เลขเป็นหลักฐาน คำเป็นคำตอบ */
function ChapterVerdict({ scores }: { scores: { key: string; z: number; raw: number | null }[] }) {
    const valid = scores.filter((s) => s.raw !== null);
    const maxZ = valid.length ? Math.max(...valid.map((s) => Math.abs(s.z))) : 0;
    const notable = valid.filter((s) => Math.abs(s.z) >= 1.0).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    const headline =
        maxZ >= 1.96
            ? { text: "ตอนนี้ต่างจากเล่มชัดเจน", amber: true, note: "ถ้าตั้งใจ (flashback / เปลี่ยนมุมมอง / ไคลแม็กซ์) ไม่ต้องกังวล" }
            : maxZ >= 1.0
                ? { text: "ต่างจากเล่มเล็กน้อย", amber: true, note: null }
                : { text: "กลมกลืนกับทั้งเล่ม", amber: false, note: null };
    return (
        <div className="mb-4 rounded-lg border bg-muted/30 p-3">
            <span className={cn("text-sm font-semibold", headline.amber ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                {headline.text}
            </span>
            {notable.length > 0 ? (
                <ul className="text-xs text-muted-foreground space-y-0.5 mt-1.5">
                    {notable.slice(0, 4).map((s) => {
                        const p = FEATURE_PLAIN[s.key];
                        if (!p) return null;
                        return <li key={s.key}>• {p.name}: {s.z > 0 ? p.high : p.low}</li>;
                    })}
                </ul>
            ) : (
                <p className="text-xs text-muted-foreground mt-1.5">ทุกมิติอยู่ในช่วงปกติของคุณ</p>
            )}
            {headline.note && <p className="text-[11px] text-muted-foreground/80 mt-1.5 italic">{headline.note}</p>}
        </div>
    );
}

export function StylometryDashboard({ data }: StylometryDashboardProps) {
    const [visibleFeatures, setVisibleFeatures] = useState<Set<string>>(
        new Set(FEATURES.map(f => f.key))
    );
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [search, setSearch] = useState("");
    const [anomalyOnly, setAnomalyOnly] = useState(false);
    const [showNumbers, setShowNumbers] = useState(false); // พับตัวเลข z-score ดิบ (writer-friendly default)
    const svgRef = useRef<SVGSVGElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

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

    // ค่าเบี่ยงเบนสูงสุดต่อตอน → ใช้ทำเครื่องหมาย "ผิดปกติ"
    const chapterMaxZ = useMemo(
        () => data.map((_, i) => {
            let max = 0;
            for (const fz of featureZScores) {
                const s = fz.scores[i];
                if (s.raw !== null) max = Math.max(max, Math.abs(s.z));
            }
            return max;
        }),
        [data, featureZScores]
    );
    const isAnomalyChapter = (i: number) => chapterMaxZ[i] >= 1.96;
    const anomalyCount = chapterMaxZ.filter(z => z >= 1.96).length;

    // ตอนที่โผล่ใน jump strip (กรองตามค้นหา / เฉพาะผิดปกติ)
    const jumpIndices = data
        .map((_, i) => i)
        .filter(i => {
            if (anomalyOnly && !isAnomalyChapter(i)) return false;
            if (!search.trim()) return true;
            const q = search.trim().toLowerCase();
            return String(i + 1).includes(q) || (data[i].chapterTitle || "").toLowerCase().includes(q);
        });

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
    const selectedX = selectedIdx !== null ? toX(selectedIdx) : null;

    // เลือกตอน → เลื่อนกราฟให้ตอนนั้นอยู่กลางจอ
    const selectChapter = (i: number) => {
        setSelectedIdx(i);
        const el = scrollRef.current;
        if (el && svgW > el.clientWidth) {
            const target = (toX(i) / svgW) * el.scrollWidth - el.clientWidth / 2;
            el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
        }
    };

    const step = (dir: number) => {
        const cur = selectedIdx ?? (dir > 0 ? -1 : data.length);
        selectChapter(Math.max(0, Math.min(data.length - 1, cur + dir)));
    };

    const idxFromEvent = (clientX: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const relX = ((clientX - rect.left) / rect.width) * svgW;
        const idx = Math.round((relX - padL) / (chartW / (data.length - 1 || 1)));
        return Math.max(0, Math.min(data.length - 1, idx));
    };

    const selected = selectedIdx !== null ? data[selectedIdx] : null;

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

            {/* ── Chapter navigator — bounded ไม่ว่ากี่ตอน ── */}
            <div className="chamfered border border-border bg-card/50 p-3 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* search jump */}
                    <div className="flex items-center gap-2 px-2.5 h-8 chamfered-sm border border-border bg-background flex-1 min-w-[160px] max-w-[240px]">
                        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <input
                            value={search}
                            onChange={e => {
                                setSearch(e.target.value);
                                const n = parseInt(e.target.value, 10);
                                if (!isNaN(n) && n >= 1 && n <= data.length) selectChapter(n - 1);
                            }}
                            placeholder="พิมพ์เลขตอน / ชื่อตอน…"
                            className="bg-transparent text-xs outline-none w-full placeholder:text-muted-foreground/60"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* stepper ◀ N / total ▶ */}
                    <div className="flex items-center h-8 chamfered-sm border border-border bg-background">
                        <button onClick={() => step(-1)} disabled={selectedIdx === 0}
                            className="h-full px-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-technical text-[10px] tabular-nums text-muted-foreground min-w-[96px] text-center px-1 border-x border-border">
                            {selectedIdx !== null ? `ตอนที่ ${selectedIdx + 1} / ${data.length}` : `เลือกตอน · ${data.length}`}
                        </span>
                        <button onClick={() => step(1)} disabled={selectedIdx === data.length - 1}
                            className="h-full px-2 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* anomaly toggle */}
                    {anomalyCount > 0 && (
                        <button
                            onClick={() => setAnomalyOnly(v => !v)}
                            className={cn(
                                "flex items-center gap-1.5 h-8 px-2.5 chamfered-sm border text-[11px] font-technical uppercase tracking-[0.08em] transition-colors",
                                anomalyOnly ? "border-red-400/50 text-red-500 bg-red-500/10" : "border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />ผิดปกติ <span className="tabular-nums">({anomalyCount})</span>
                        </button>
                    )}
                </div>

                {/* chip grid — โผล่เฉพาะตอนค้นหา / กรองผิดปกติ (bounded) */}
                {(search.trim() || anomalyOnly) && (
                    <div className="flex flex-wrap gap-1 max-h-[92px] overflow-y-auto pt-0.5">
                        {jumpIndices.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground italic px-1 py-1">ไม่พบตอนที่ตรงกับการค้นหา</span>
                        ) : jumpIndices.map(i => {
                            const sel = selectedIdx === i;
                            const anom = isAnomalyChapter(i);
                            return (
                                <button
                                    key={i}
                                    onClick={() => selectChapter(i)}
                                    title={data[i].chapterTitle}
                                    className={cn(
                                        "shrink-0 min-w-[26px] h-6 px-1.5 chamfered-sm text-[10px] tabular-nums border transition-colors",
                                        sel
                                            ? "bg-[var(--forge-gold)] border-[var(--forge-gold)] text-black font-bold"
                                            : anom
                                                ? "border-red-400/50 text-red-500 hover:bg-red-500/10"
                                                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                                    )}
                                >
                                    {i + 1}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Focused readout — ผลวิเคราะห์ตอนที่เลือก ── */}
            {selected && selectedIdx !== null && (
                <div className="chamfered border-2 border-[var(--forge-gold)]/40 bg-card/50 p-5">
                    <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-[var(--forge-amber)]">ตอนที่เลือก</span>
                            <h3 className="text-lg font-display font-bold tracking-tight truncate">
                                <span className="text-muted-foreground tabular-nums mr-1.5">{selectedIdx + 1}.</span>
                                {selected.chapterTitle}
                            </h3>
                        </div>
                        <button onClick={() => setSelectedIdx(null)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* สรุปภาษาคน (นำก่อนตัวเลข) */}
                    <ChapterVerdict
                        scores={FEATURES.map((f) => {
                            const s = featureZScores.find((x) => x.key === f.key)!.scores[selectedIdx];
                            return { key: f.key, z: s.z, raw: s.raw };
                        })}
                    />

                    {/* narration vs dialogue */}
                    {(() => {
                        const dia = selected.chapterAnatomy?.dialogue_ratio_percentage || 0;
                        const nar = selected.chapterAnatomy?.narration_ratio_percentage || 0;
                        return (
                            <div className="mb-4">
                                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                                    <span>บรรยาย {nar}%</span><span>สนทนา {dia}%</span>
                                </div>
                                <div className="h-3 w-full bg-muted chamfered-sm flex overflow-hidden">
                                    <div className="bg-[var(--chart-3)] h-full opacity-70" style={{ width: `${nar}%` }} />
                                    <div className="bg-[var(--forge-gold)] h-full opacity-80" style={{ width: `${dia}%` }} />
                                </div>
                            </div>
                        );
                    })()}

                    {/* feature z-scores — เชิงลึก พับไว้ default (เลขเป็นหลักฐาน ไม่ใช่พระเอก) */}
                    <button
                        onClick={() => setShowNumbers((v) => !v)}
                        className="text-[11px] text-muted-foreground hover:text-foreground mb-2 underline decoration-dotted underline-offset-2"
                    >
                        {showNumbers ? "ซ่อนตัวเลขเชิงลึก" : "ดูตัวเลขเชิงลึก (z-score รายมิติ)"}
                    </button>
                    {showNumbers && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mb-4">
                        {FEATURES.map(f => {
                            const s = featureZScores.find(x => x.key === f.key)!.scores[selectedIdx];
                            const isAnomaly = Math.abs(s.z) >= 1.96;
                            const isDrift = Math.abs(s.z) >= 1.0;
                            return (
                                <div key={f.key} className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-1.5 min-w-0">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                                        <span
                                            className="text-xs text-muted-foreground truncate cursor-help"
                                            title={FEATURE_PLAIN[f.key] ? `${FEATURE_PLAIN[f.key].name} — สูง: ${FEATURE_PLAIN[f.key].high} · ต่ำ: ${FEATURE_PLAIN[f.key].low}` : f.label}
                                        >{f.shortLabel}</span>
                                    </span>
                                    <span className="flex items-center gap-2 shrink-0 tabular-nums">
                                        <span className="text-[11px] text-muted-foreground font-mono">{s.raw?.toFixed(1) ?? "–"}{s.raw !== null ? f.unit : ""}</span>
                                        <span className={cn("text-[11px] font-bold font-mono", isAnomaly ? "text-red-500" : isDrift ? "text-amber-500" : "text-emerald-500")}>
                                            {s.raw !== null ? `${s.z > 0 ? "+" : ""}${s.z.toFixed(2)}` : ""}
                                            {isAnomaly && <AlertTriangle className="inline w-3 h-3 ml-0.5 -mt-0.5" />}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    )}

                    {/* mood + char vibe */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                        <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">อารมณ์ภาพรวม</span>
                            <span className="inline-flex chamfered-sm bg-muted px-2 py-1 text-xs font-medium">{(selected.pacingAndMood?.vibe || "ไม่มีข้อมูล").split("(")[0].trim()}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-muted-foreground block mb-1">บรรยากาศตัวละคร</span>
                            <span className="inline-flex chamfered-sm bg-[var(--forge-gold)]/10 px-2 py-1 text-xs font-medium text-[var(--forge-amber)]">{(selected.characterDialogueVibes?.vibe || "ไม่มีข้อมูล").split("(")[0].trim()}</span>
                        </div>
                    </div>

                    {/* C1 — คำซ้ำใกล้กัน (Echo detector) */}
                    {Array.isArray(selected.chapterAnatomy?.echoes) && selected.chapterAnatomy.echoes.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-border/60">
                            <span className="text-[10px] text-muted-foreground block mb-1">คำซ้ำใกล้กัน (อาจอ่านสะดุด)</span>
                            <p className="text-[11px] text-muted-foreground/80 mb-2">ลองทำ: แทนด้วยสรรพนาม/คำใกล้เคียง หรือตัดทิ้งบางตัว</p>
                            <div className="flex flex-col gap-1.5">
                                {selected.chapterAnatomy.echoes.slice(0, 8).map((e: { term: string; count: number; excerpt: string }, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                        <span className="inline-flex chamfered-sm bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 font-medium shrink-0">
                                            {e.term} ×{e.count}
                                        </span>
                                        <span className="text-muted-foreground line-clamp-2 leading-relaxed">…{e.excerpt}…</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* #4 — Rolling-window drift: จุดสไตล์เพี้ยนระดับย่อหน้า */}
                    {Array.isArray(selected.chapterAnatomy?.rolling_drift?.windows) && selected.chapterAnatomy.rolling_drift.windows.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-border/60">
                            <span className="text-[10px] text-muted-foreground block mb-2">จุดสไตล์เพี้ยนในตอน (จังหวะย่อหน้า)</span>
                            <div className="flex gap-0.5">
                                {selected.chapterAnatomy.rolling_drift.windows.map((w: { start_sentence: number; avg_sentence_len: number; z?: number; drift?: boolean }, i: number) => (
                                    <div
                                        key={i}
                                        title={`ประโยค #${w.start_sentence} · เฉลี่ย ${w.avg_sentence_len} คำ · z=${w.z ?? "–"}`}
                                        className={cn("h-6 flex-1 min-w-[6px] chamfered-sm", w.drift ? "bg-red-500/70" : "bg-emerald-500/25")}
                                    />
                                ))}
                            </div>
                            {selected.chapterAnatomy.rolling_drift.windows.some((w: { drift?: boolean }) => w.drift) && (
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">มีย่อหน้าที่จังหวะต่างจากตอนชัดเจน — ลองอ่านออกเสียงช่วงสีแดงเทียบจังหวะ ว่าตั้งใจหรือสไตล์หลุด</p>
                            )}
                        </div>
                    )}

                    {/* C2 — Voice distance: ตัวละครเสียงคล้ายกันเกิน */}
                    {(() => {
                        const pairs = selected.characterDialogueVibes?.voice_distances?.pairs as { a: string; b: string; distance: number; too_similar?: boolean }[] | undefined;
                        if (!Array.isArray(pairs) || pairs.length === 0) return null;
                        const close = pairs.filter((p) => p.too_similar);
                        return (
                            <div className="pt-3 mt-3 border-t border-border/60">
                                <span className="text-[10px] text-muted-foreground block mb-2">เสียงตัวละคร (ระยะห่าง — ใกล้ = คล้ายกัน)</span>
                                <div className="flex flex-col gap-1 text-xs">
                                    {(close.length > 0 ? close : pairs.slice(0, 3)).map((p, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className={cn("font-medium", p.too_similar && "text-amber-600 dark:text-amber-400")}>{p.a} ↔ {p.b}</span>
                                            <span className="ml-auto tabular-nums text-muted-foreground">{p.distance}</span>
                                            {p.too_similar && <span className="text-[10px] text-amber-600 dark:text-amber-400">คล้ายเกิน</span>}
                                        </div>
                                    ))}
                                </div>
                                {close.length > 0 && (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">ลองทำ: เพิ่มคำติดปาก/มุมมองเฉพาะตัว ให้แต่ละเสียงต่างกันชัดขึ้น</p>
                                )}
                            </div>
                        );
                    })()}

                    {/* #3 — Burrows's Delta: ลายเซ็นคำเล็ก เทียบข้ามตอน */}
                    {(() => {
                        const profiles = data.map((d) => d.lexicalRichness?.function_words).filter(Boolean) as Record<string, number>[];
                        const cur = selected.lexicalRichness?.function_words as Record<string, number> | undefined;
                        if (profiles.length < 2 || !cur) return null;
                        const keys = Object.keys(cur);
                        let sum = 0; const tops: { k: string; z: number }[] = [];
                        for (const k of keys) {
                            const vals = profiles.map((p) => p[k]).filter((v) => typeof v === "number");
                            if (vals.length < 2) continue;
                            const m = vals.reduce((a, b) => a + b, 0) / vals.length;
                            const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length) || 0.001;
                            const z = ((cur[k] ?? 0) - m) / sd;
                            sum += Math.abs(z); tops.push({ k, z });
                        }
                        const delta = keys.length ? sum / keys.length : 0;
                        tops.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
                        return (
                            <div className="pt-3 mt-3 border-t border-border/60">
                                <span className="text-[10px] text-muted-foreground block mb-1.5">
                                    ลายเซ็นคำเล็ก (Burrows Δ ข้ามตอน): <span className={cn("font-bold tabular-nums", delta >= 1.5 ? "text-red-500" : delta >= 1.0 ? "text-amber-500" : "text-emerald-500")}>{delta.toFixed(2)}</span>
                                </span>
                                <div className="text-[11px] text-muted-foreground">
                                    {tops.slice(0, 4).map((t) => `${t.k} ${t.z > 0 ? "+" : ""}${t.z.toFixed(1)}`).join(" · ")}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ── C3 Pacing Heatmap — จังหวะทั้งเล่มในแวบเดียว ── */}
            {data.length > 1 && (() => {
                const pace = data.map((d) => d.chapterAnatomy?.avg_words_per_sentence ?? null);
                const valid = pace.filter((v): v is number => v !== null);
                if (valid.length < 2) return null;
                const min = Math.min(...valid), max = Math.max(...valid);
                const colorFor = (v: number | null) => {
                    if (v === null) return "var(--muted)";
                    const t = max > min ? (v - min) / (max - min) : 0.5; // 0=รัว → 1=อืด
                    return `hsl(${140 - t * 140}, 64%, 50%)`; // เขียว(รัว) → แดง(อืด)
                };
                return (
                    <div className="chamfered border bg-card/50 p-4 mb-6">
                        <div className="flex items-center justify-between mb-3 gap-2">
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                จังหวะทั้งเล่ม (ความยาวประโยคเฉลี่ย)
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                                รัว
                                <span className="inline-block w-8 h-2 rounded-sm" style={{ background: "linear-gradient(90deg, hsl(140,64%,50%), hsl(70,64%,50%), hsl(0,64%,50%))" }} />
                                อืด
                            </span>
                        </div>
                        <div className="flex gap-0.5">
                            {data.map((d, i) => (
                                <button
                                    key={d.id}
                                    onClick={() => setSelectedIdx(i)}
                                    title={`${i + 1}. ${d.chapterTitle} · ${pace[i] ?? "–"} คำ/ประโยค`}
                                    className={cn(
                                        "h-7 flex-1 min-w-[8px] chamfered-sm transition-all hover:opacity-80",
                                        selectedIdx === i && "ring-2 ring-[var(--forge-gold)]",
                                    )}
                                    style={{ backgroundColor: colorFor(pace[i]) }}
                                    aria-label={`ตอนที่ ${i + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                );
            })()}

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
                    <div className="overflow-x-auto" ref={scrollRef}>
                    <div
                        className="relative chamfered-sm border border-border/40 bg-muted/10 overflow-hidden select-none"
                        style={{ minWidth: `${svgW}px` }}
                    >
                        <svg
                            ref={svgRef}
                            viewBox={`0 0 ${svgW} ${svgH}`}
                            className="w-full block cursor-pointer"
                            style={{ width: `${svgW}px`, height: `${svgH}px` }}
                            onMouseMove={e => {
                                const idx = idxFromEvent(e.clientX);
                                if (idx !== null) setHoveredIdx(idx);
                            }}
                            onMouseLeave={() => setHoveredIdx(null)}
                            onClick={e => {
                                const idx = idxFromEvent(e.clientX);
                                if (idx !== null) setSelectedIdx(idx);
                            }}
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

                            {/* Selected chapter marker (persistent) */}
                            {selectedX !== null && (
                                <line x1={selectedX} y1={padT} x2={selectedX} y2={padT + chartH}
                                    stroke="var(--forge-gold)" strokeWidth="1.5" opacity="0.7" />
                            )}

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
                                    fill={(hoveredIdx === i || selectedIdx === i) ? "hsl(48,90%,55%)" : "hsl(0,0%,60%)"}
                                    fontWeight={(hoveredIdx === i || selectedIdx === i) ? "700" : "400"}
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
                                {data.map((item, i) => {
                                    const dialogRatio = item.chapterAnatomy?.dialogue_ratio_percentage || 0;
                                    const narrationRatio = item.chapterAnatomy?.narration_ratio_percentage || 0;
                                    return (
                                        <button key={item.id} onClick={() => selectChapter(i)}
                                            className={cn("w-full text-left space-y-1.5 chamfered-sm px-2 py-1.5 -mx-2 transition-colors", selectedIdx === i ? "bg-[var(--forge-gold)]/10" : "hover:bg-muted/40")}>
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium truncate max-w-[160px]" title={item.chapterTitle}><span className="text-muted-foreground tabular-nums mr-1">{i + 1}.</span>{item.chapterTitle}</span>
                                                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                                    บรรยาย {narrationRatio}% / สนทนา {dialogRatio}%
                                                </span>
                                            </div>
                                            <div className="h-2.5 w-full bg-muted rounded-full flex overflow-hidden">
                                                <div className="bg-[var(--chart-3)] h-full opacity-70" style={{ width: `${narrationRatio}%` }} />
                                                <div className="bg-[var(--forge-gold)] h-full opacity-80" style={{ width: `${dialogRatio}%` }} />
                                            </div>
                                        </button>
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

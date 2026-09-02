"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { CARD_WIDTH } from "./chapter-overview-board";
import { PACING_MIN, PACING_MAX, pacingLabel } from "@/lib/scene-dramatic";
import { POSITIONAL_STRUCTURES } from "./structure-overlay";
import { CHAPTER_ARC_TEMPLATES } from "@/lib/chapter-arc-templates";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// รวมสองแหล่งให้เป็นรูปเดียวกัน — ทฤษฎีมีชื่อ (Save the Cat ฯลฯ, pos = % ทั้งเล่ม)
// กับ pattern สังเกตทั่วไปที่เราสังเคราะห์เอง (pos = % ในบทเดียว) ห้ามปนกันจนดูเหมือนมาจากแหล่งเดียวกัน
interface NormalizedStage { label: string; pos: number }
interface NormalizedStructure { id: string; group: "named" | "observed"; label: string; stages: NormalizedStage[] }

const ALL_STRUCTURES: NormalizedStructure[] = [
    ...POSITIONAL_STRUCTURES.map(s => ({
        id: s.id, group: "named" as const, label: s.nameTh,
        stages: s.stages.filter(st => st.pos != null).map(st => ({ label: st.nameTh ?? st.name, pos: st.pos! })),
    })),
    ...CHAPTER_ARC_TEMPLATES.map(t => ({
        id: t.id, group: "observed" as const, label: t.label,
        stages: t.stages.map(st => ({ label: st.name, pos: st.pos })),
    })),
];

const CHART_H = 320;
const PAD_Y = 24;
const STRUCT_BAND_H = 40; // แถบอ้างอิงโครงเรื่องมาตรฐาน — แสดงเฉพาะเลือกไว้
const LABEL_BAND_H = 60; // แถบชื่อการ์ดย่อย (หมุนเอียง กันชนกัน)

interface SubBeat {
    id: string;
    title: string;
    pacing: number | null;
    beatIndex: number;
}

interface PacingPoint {
    x: number;
    pacing: number | null;
    title: string;
    isScene: boolean;
}

const toY = (v: number) => {
    const innerH = CHART_H - PAD_Y * 2;
    return PAD_Y + innerH - ((v - PACING_MIN) / (PACING_MAX - PACING_MIN)) * innerH;
};

const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

function findStructureById(id: string) {
    if (id === "none") return null;
    return ALL_STRUCTURES.find(s => s.id === id) ?? null;
}

// แสดงทีละฉาก (ข้อมูลเยอะไปตอนอัดทั้งบทในจอเดียว) — จุดฉากใหญ่ + การ์ดไอเดีย/ฉากย่อยในฉากนั้นเท่านั้น
// เลื่อนฉากด้วยปุ่ม ก่อนหน้า/ถัดไป — เส้นอ้างอิงโครงเรื่องมาตรฐานยังเทียบได้ (คำนวณตำแหน่ง % ของฉากนี้ในภาพรวมทั้งบท)
export function PacingLine({ events }: { events: any[] }) {
    const [structureId, setStructureId] = useState<string>("none");
    const [index, setIndex] = useState(0);
    const currentIndex = Math.min(index, Math.max(events.length - 1, 0));
    const event = events[currentIndex];

    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ปุ่มลูกศรซ้าย/ขวาเลื่อนฉาก — ข้ามถ้าโฟกัสอยู่ในช่องกรอกข้อมูล/select กันชนกับการพิมพ์/เลือกค่า
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            if (e.key === "ArrowLeft") setIndex(i => Math.max(0, i - 1));
            else if (e.key === "ArrowRight") setIndex(i => Math.min(events.length - 1, i + 1));
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [events.length]);

    const { rawPoints, logicalWidth } = useMemo(() => {
        const pts: PacingPoint[] = [];
        const subBeats: SubBeat[] = Array.isArray(event?.subBeats) ? event.subBeats : [];
        const segments = subBeats.length + 1; // 1 ช่องสำหรับฉากใหญ่ + N สำหรับ sub-beat
        pts.push({
            x: 0,
            pacing: typeof event?.pacing === "number" ? event.pacing : null,
            title: event?.title || `ฉาก ${currentIndex + 1}`,
            isScene: true,
        });
        subBeats.forEach((b, k) => {
            pts.push({
                x: ((k + 1) / segments) * CARD_WIDTH,
                pacing: typeof b.pacing === "number" ? b.pacing : null,
                title: b.title || "การ์ดไอเดีย",
                isScene: false,
            });
        });
        return { rawPoints: pts, logicalWidth: CARD_WIDTH };
    }, [event, currentIndex]);

    // scale เฉพาะแกน X ในหน่วยพิกเซลจริง (ไม่ผ่าน SVG viewBox) — กันวงกลมบิดเป็นวงรีตอนสัดส่วนไม่เท่ากัน
    const scale = containerWidth > 0 ? containerWidth / logicalWidth : 1;
    const totalWidth = logicalWidth * scale;
    const points = useMemo(() => rawPoints.map(p => ({ ...p, x: p.x * scale })), [rawPoints, scale]);

    // ตัดเป็นช่วง (segment) ตามจุดที่มีค่าจริงติดกัน — กัน path ลากผ่านจุดที่ pacing เป็น null
    const segments = useMemo(() => {
        const runs: PacingPoint[][] = [];
        let current: PacingPoint[] = [];
        for (const p of points) {
            if (p.pacing == null) {
                if (current.length > 0) runs.push(current);
                current = [];
            } else {
                current.push(p);
            }
        }
        if (current.length > 0) runs.push(current);
        return runs;
    }, [points]);

    const hasAnyData = points.some(p => p.pacing != null);
    const structure = findStructureById(structureId);
    const totalH = (structure ? STRUCT_BAND_H : 0) + CHART_H + LABEL_BAND_H;
    const chartTop = structure ? STRUCT_BAND_H : 0;

    // ตำแหน่ง % ของฉากนี้ในภาพรวมทั้งบท (สมมติแต่ละฉากกินพื้นที่เท่ากัน) — ใช้หา stage ที่ตกอยู่ในช่วงฉากนี้
    const scenePosStart = (currentIndex / events.length) * 100;
    const scenePosEnd = ((currentIndex + 1) / events.length) * 100;
    // ทฤษฎีมีชื่อ (pos = % ทั้งเล่ม) เทียบกับช่วง % ของฉากนี้ในบท — pattern สังเกตทั่วไป (pos = % ในบทเดียว)
    // ใช้ทั้งช่วง 0-100% ของบทตรงๆ เพราะนิยามมาแบบนั้นอยู่แล้ว ไม่ต้องแปลง
    const structureTicksInScene = structure
        ? structure.group === "named"
            ? structure.stages.filter(s => s.pos >= scenePosStart && s.pos < scenePosEnd)
            : structure.stages
        : [];

    return (
        <div className="w-full h-full flex flex-col bg-white">
            {/* Header — เลื่อนฉาก + เลือกโครงเรื่องมาตรฐานมาเทียบ */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-200 shrink-0">
                <div className="flex items-center gap-1 shrink-0 bg-zinc-50 border border-zinc-200 chamfered-sm p-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9 chamfered-sm text-zinc-600 hover:text-zinc-900 hover:bg-white disabled:opacity-30"
                        disabled={currentIndex === 0} onClick={() => setIndex(i => Math.max(0, i - 1))}
                        aria-label="ฉากก่อนหน้า">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-technical text-[11px] tabular-nums text-zinc-600 shrink-0 w-14 text-center select-none">
                        {currentIndex + 1} / {events.length}
                    </span>
                    <Button variant="ghost" size="icon" className="h-9 w-9 chamfered-sm text-zinc-600 hover:text-zinc-900 hover:bg-white disabled:opacity-30"
                        disabled={currentIndex === events.length - 1} onClick={() => setIndex(i => Math.min(events.length - 1, i + 1))}
                        aria-label="ฉากถัดไป">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <h3 className="font-display font-semibold text-base text-zinc-900 truncate flex-1 min-w-0">{event?.title}</h3>
                <Select value={structureId} onValueChange={setStructureId}>
                    <SelectTrigger className="h-9 text-[12px] w-auto gap-1.5 px-3 border-zinc-300 text-zinc-600 shrink-0">
                        <SelectValue placeholder="เทียบกับโครงเรื่อง…" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">ไม่เทียบ</SelectItem>
                        <SelectGroup>
                            <SelectLabel className="text-[10px] text-zinc-400">ทฤษฎีมีชื่อ (ระดับทั้งเล่ม)</SelectLabel>
                            {POSITIONAL_STRUCTURES.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.nameTh}</SelectItem>
                            ))}
                        </SelectGroup>
                        <SelectGroup>
                            <SelectLabel className="text-[10px] text-zinc-400">รูปแบบที่สังเกตทั่วไป (ระดับบทนี้)</SelectLabel>
                            {CHAPTER_ARC_TEMPLATES.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                            ))}
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>

            <div ref={containerRef} className="relative flex-1 min-h-0 p-4">
                {!hasAnyData && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <span className="font-technical text-[11px] uppercase tracking-widest text-zinc-400">
                            ตั้งค่า &ldquo;จังหวะการเล่า&rdquo; ในโครงฉากดราม่าเพื่อเริ่มวาด
                        </span>
                    </div>
                )}
                <svg width={totalWidth} height={totalH} style={{ opacity: hasAnyData ? 1 : 0.35 }}>
                    {/* แถบอ้างอิงโครงเรื่องมาตรฐาน — เฉพาะจังหวะที่ตกอยู่ในช่วง % ของฉากนี้ */}
                    {structure && (
                        <g>
                            <line x1={0} y1={STRUCT_BAND_H - 1} x2={totalWidth} y2={STRUCT_BAND_H - 1} stroke="#e4e4e7" strokeWidth={1} />
                            {structureTicksInScene.length === 0 ? (
                                <text x={totalWidth / 2} y={22} fontSize={9} textAnchor="middle" fill="#d4d4d8" className="font-technical">
                                    {structure?.group === "named" ? "ไม่มีจังหวะมาตรฐานตกในฉากนี้" : "ไม่มีจังหวะในรูปแบบนี้"}
                                </text>
                            ) : structureTicksInScene.map((s, i) => {
                                // named: pos คือ % ทั้งบท ต้องแปลงเป็นตำแหน่งสัมพัทธ์ในฉากนี้ก่อน
                                // observed: pos คือ % ในฉากนี้อยู่แล้ว ใช้ตรงๆ
                                const localFrac = structure?.group === "named"
                                    ? (s.pos - scenePosStart) / (scenePosEnd - scenePosStart)
                                    : s.pos / 100;
                                const x = localFrac * totalWidth;
                                return (
                                    <g key={i}>
                                        <line x1={x} y1={0} x2={x} y2={totalH} stroke="#f59e0b" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 3" />
                                        <text x={x} y={10} fontSize={9} textAnchor="middle" fill="#b45309" className="font-technical" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                            {truncate(s.label, 14)}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    )}

                    {/* baseline กลาง (pacing = 5.5) อ้างอิงเบาๆ */}
                    <line
                        x1={0} y1={chartTop + toY((PACING_MIN + PACING_MAX) / 2)} x2={totalWidth} y2={chartTop + toY((PACING_MIN + PACING_MAX) / 2)}
                        stroke="#e4e4e7" strokeWidth={1} strokeDasharray="3 4"
                    />

                    {segments.map((run, si) => {
                        if (run.length === 1) {
                            const p = run[0];
                            return (
                                <circle key={si} cx={p.x} cy={chartTop + toY(p.pacing!)} r={p.isScene ? 5 : 3}
                                    fill="var(--forge-amber)" stroke="#fff" strokeWidth={2} />
                            );
                        }
                        const d = run.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${chartTop + toY(p.pacing!)}`).join(" ");
                        return (
                            <g key={si}>
                                <path d={d} fill="none" stroke="var(--forge-amber)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                {run.map((p, i) => (
                                    <circle key={i} cx={p.x} cy={chartTop + toY(p.pacing!)} r={p.isScene ? 5 : 3}
                                        fill="var(--forge-amber)" stroke="#fff" strokeWidth={2}>
                                        <title>{`${p.title} · ${p.pacing}/10 · ${pacingLabel(p.pacing)}`}</title>
                                    </circle>
                                ))}
                            </g>
                        );
                    })}

                    {/* จุดที่ยังไม่ตั้งจังหวะ — วงกลวงจาง ไม่มีเส้นลากผ่าน */}
                    {points.filter(p => p.pacing == null).map((p, i) => (
                        <circle key={`empty-${i}`} cx={p.x} cy={chartTop + toY((PACING_MIN + PACING_MAX) / 2)} r={p.isScene ? 4 : 2.5}
                            fill="none" stroke="#a1a1aa" strokeWidth={1.5}>
                            <title>{`${p.title} · ยังไม่ตั้งจังหวะ`}</title>
                        </circle>
                    ))}

                    {/* ชื่อการ์ดย่อย — หมุนเอียงใต้จุด (ชื่อฉากใหญ่ขึ้นแสดงในหัวข้อด้านบนแล้ว ไม่ต้องซ้ำ) */}
                    {points.filter(p => !p.isScene).map((p, i) => (
                        <text
                            key={`label-${i}`}
                            x={p.x} y={chartTop + CHART_H + 12}
                            fontSize={10}
                            fill="#71717a"
                            textAnchor="end"
                            transform={`rotate(-40 ${p.x} ${chartTop + CHART_H + 12})`}
                        >
                            {truncate(p.title, 18)}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
}

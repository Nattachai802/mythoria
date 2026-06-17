"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Navigation, Download, Clapperboard, Target, Swords, TrendingUp, TrendingDown, Minus, Check, X, Clock, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import type { ThreadWithBeats } from "@/server/plot-threads";

// ----------------------------------------------------------------------
// Mini canvas poster — ชิ้นใน canvas ฉบับย่อ (อ่านอย่างเดียว)
// ----------------------------------------------------------------------
function MiniPoster({ item }: { item: any }) {
    const rotation = item.id ? (parseInt(item.id.slice(-2), 16) % 7) - 3 : 0;
    const isIdea = item.type === "idea";
    const bg = isIdea ? "#fef9c3" : "#fafaf8";
    const icon = item.type === "character" ? "ตัวละคร" : item.type === "location" ? "สถานที่" : "ไอเดีย";

    return (
        <div
            className="absolute select-none px-1.5 py-1 rounded-[2px] shadow-md max-w-[120px]"
            style={{
                left: Math.min((item.x || 0) * 0.28, 150),
                top: Math.min((item.y || 0) * 0.28, 70),
                transform: `rotate(${rotation}deg)`,
                background: bg,
            }}
        >
            <p className="text-[8px] font-medium text-zinc-700 truncate leading-tight">
                {isIdea ? "💡 " : ""}{item.title || icon}
            </p>
        </div>
    );
}

// ----------------------------------------------------------------------
// outcome → tag config
// ----------------------------------------------------------------------
const OUTCOME_TAG: Record<string, { label: string; icon: typeof Check; bg: string; fg: string }> = {
    success: { label: "ดีขึ้น", icon: Check, bg: "#064e3b33", fg: "#6ee7b7" },
    failure: { label: "แย่ลง", icon: X, bg: "#7f1d1d33", fg: "#fca5a5" },
    ongoing: { label: "คาราคาซัง", icon: Clock, bg: "#78350f33", fg: "#fcd34d" },
    unknown: { label: "ยังไม่ชัด", icon: HelpCircle, bg: "#27272a", fg: "#a1a1aa" },
};

// ----------------------------------------------------------------------
// Storyboard frame
// ----------------------------------------------------------------------
function StoryboardFrame({ event, index, threadDots }: { event: any; index: number; threadDots: { color: string; title: string }[] }) {
    const items = (event.canvasData as any[]) || [];
    const shift: number | null = typeof event.valueShift === "number" ? event.valueShift : null;
    const outcome = event.sceneOutcome || (shift == null ? null : shift > 0 ? "success" : shift < 0 ? "failure" : "ongoing");
    const tag = outcome ? OUTCOME_TAG[outcome] : null;

    const ShiftIcon = shift == null ? Minus : shift > 0 ? TrendingUp : shift < 0 ? TrendingDown : Minus;
    const shiftCls = shift == null ? "text-zinc-500" : shift > 0 ? "text-emerald-500" : shift < 0 ? "text-red-500" : "text-amber-500";

    return (
        <div className="w-[215px] flex-shrink-0 bg-zinc-900 border border-zinc-800 rounded-md overflow-hidden">
            {/* Frame top */}
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0a0a0c] border-b border-zinc-800">
                <span className="font-technical text-[9px] uppercase tracking-[0.12em] text-zinc-500">
                    SC {String(index + 1).padStart(2, "0")}
                </span>
                {threadDots.length > 0 && (
                    <div className="flex gap-1">
                        {threadDots.slice(0, 5).map((d, i) => (
                            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: d.color }} title={d.title} />
                        ))}
                    </div>
                )}
            </div>

            {/* Mini canvas */}
            <div
                className="h-24 relative overflow-hidden"
                style={{ background: "#202023", backgroundImage: "radial-gradient(#2e2e33 1px, transparent 1px)", backgroundSize: "14px 14px" }}
            >
                {items.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-[10px] font-technical uppercase tracking-widest">
                        ว่าง
                    </div>
                ) : (
                    items.map((item: any) => <MiniPoster key={item.id} item={item} />)
                )}
            </div>

            {/* Drama strip */}
            <div className="p-2.5">
                <h4 className="text-[11px] font-medium text-zinc-200 truncate mb-1.5">{event.title}</h4>

                {event.sceneGoal && (
                    <div className="flex items-start gap-1.5 mb-1">
                        <Target className="h-3 w-3 shrink-0 mt-0.5 text-zinc-500" />
                        <span className="text-[10px] text-zinc-300 leading-snug">{event.sceneGoal}</span>
                    </div>
                )}
                {event.sceneConflict && (
                    <div className="flex items-start gap-1.5 mb-1">
                        <Swords className="h-3 w-3 shrink-0 mt-0.5 text-zinc-500" />
                        <span className="text-[10px] text-zinc-300 leading-snug">{event.sceneConflict}</span>
                    </div>
                )}

                {(tag || shift != null) && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                        {tag ? (
                            <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-[3px]" style={{ background: tag.bg, color: tag.fg }}>
                                <tag.icon className="h-2.5 w-2.5" />{tag.label}
                            </span>
                        ) : <span />}
                        {shift != null && (
                            <span className={`flex items-center gap-0.5 text-sm font-display font-bold tabular-nums ${shiftCls}`}>
                                <ShiftIcon className="h-3.5 w-3.5" />
                                {shift > 0 ? `+${shift}` : shift}
                            </span>
                        )}
                    </div>
                )}

                {!event.sceneGoal && !event.sceneConflict && !tag && shift == null && (
                    <p className="text-[10px] text-zinc-600 italic">ยังไม่ได้ตั้งโครงฉากดราม่า</p>
                )}
            </div>
        </div>
    );
}

// ----------------------------------------------------------------------
// Main Board
// ----------------------------------------------------------------------
interface ChapterOverviewBoardProps {
    chapterTitle: string;
    events: any[];
    threads?: ThreadWithBeats[];
}

export function ChapterOverviewBoard({ chapterTitle, events, threads = [] }: ChapterOverviewBoardProps) {
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 40, y: 40 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const panOffsetStartRef = useRef({ x: 0, y: 0 });

    // event → thread dots
    const eventThreadsMap = useMemo(() => {
        const m = new Map<string, { color: string; title: string }[]>();
        threads.forEach(t => {
            t.beats.forEach(b => {
                const arr = m.get(b.eventId) ?? [];
                arr.push({ color: t.color ?? "#f59e0b", title: t.title });
                m.set(b.eventId, arr);
            });
        });
        return m;
    }, [threads]);

    // ── Pan ──
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0 || e.button === 1) {
            e.preventDefault();
            setIsPanning(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
            panOffsetStartRef.current = { ...panOffset };
        }
    }, [panOffset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPanOffset({
            x: panOffsetStartRef.current.x + (e.clientX - panStartRef.current.x),
            y: panOffsetStartRef.current.y + (e.clientY - panStartRef.current.y),
        });
    }, [isPanning]);

    const handleMouseUp = useCallback(() => setIsPanning(false), []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        const direction = e.deltaY < 0 ? 1 : -1;
        setZoom(prev => Math.min(Math.max(prev + direction * 0.05, 0.3), 2.0));
    }, []);

    const handleExportAll = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            chapterTitle,
            totalScenes: events.length,
            scenes: events.map((event, index) => ({
                sceneNumber: index + 1,
                sceneId: event.id,
                sceneTitle: event.title,
                goal: event.sceneGoal,
                conflict: event.sceneConflict,
                outcome: event.sceneOutcome,
                valueShift: event.valueShift,
                items: ((event.canvasData as any[]) || []).map((item: any) => ({
                    id: item.id, type: item.type, title: item.title, content: item.content,
                })),
            })),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeTitle = chapterTitle.replace(/[^a-zA-Z0-9ก-๙]/g, "_").substring(0, 50);
        a.download = `chapter-${safeTitle}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Export สำเร็จ! (${events.length} scenes)`);
    };

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#0c0c0e] flex flex-col">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 h-14 bg-[#0a0a0c]/95 backdrop-blur border-b border-zinc-800 z-50 flex items-center px-6 justify-between">
                <div className="flex items-center gap-3">
                    <Clapperboard className="h-5 w-5 text-[var(--forge-amber)]" />
                    <h2 className="font-display font-semibold text-zinc-100">{chapterTitle}</h2>
                    <span className="font-technical text-[9px] uppercase tracking-widest text-zinc-500 border border-zinc-700 px-2 py-0.5 rounded-sm">
                        {events.length} scenes
                    </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportAll}
                    className="h-8 gap-1.5 chamfered-sm font-technical text-[9px] uppercase tracking-[0.08em] bg-transparent border-zinc-700 text-zinc-300 hover:text-zinc-100">
                    <Download className="h-3.5 w-3.5" />export
                </Button>
            </div>

            {/* Canvas */}
            <div
                className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
            >
                <div
                    style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                        transformOrigin: "top left",
                        position: "absolute",
                        transition: isPanning ? "none" : "transform 0.1s ease-out",
                        paddingTop: 72,
                    }}
                >
                    <div className="flex gap-3.5 items-start">
                        {events.length === 0 ? (
                            <div className="text-zinc-600 font-technical uppercase tracking-widest text-sm px-4">
                                ยังไม่มีฉากในบทนี้
                            </div>
                        ) : (
                            events.map((event, index) => (
                                <StoryboardFrame
                                    key={event.id}
                                    event={event}
                                    index={index}
                                    threadDots={eventThreadsMap.get(event.id) ?? []}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-6 right-6 z-50">
                <div className="bg-[#0a0a0c]/95 backdrop-blur chamfered-sm border border-zinc-800 p-1 flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100" onClick={() => setZoom(p => Math.min(p + 0.1, 2.0))} title="Zoom In"><ZoomIn className="w-4 h-4" /></Button>
                    <div className="text-center font-technical text-[9px] text-zinc-500 tabular-nums">{Math.round(zoom * 100)}%</div>
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100" onClick={() => setZoom(p => Math.max(p - 0.1, 0.3))} title="Zoom Out"><ZoomOut className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-zinc-100" onClick={() => { setZoom(1); setPanOffset({ x: 40, y: 40 }); }} title="Reset"><Navigation className="w-4 h-4" /></Button>
                </div>
            </div>
        </div>
    );
}

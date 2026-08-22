"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, Fragment } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    useDroppable,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    pointerWithin,
    DragOverlay,
} from "@dnd-kit/core";
import { ResourceSidebar } from "./resource-sidebar";
import { CanvasItem, DraggableCanvasItem } from "./canvas-item";
import { type BoardChapter, updateTimelineCanvas, getNovelDummyParticipants } from "@/server/timeline";
import { updateIdea, createIdea } from "@/server/idea"; // updateIdea: auto-reset isUsed flag
import { getSceneElementDetails, getIdeaNotesForIdeas, promoteDummy, promoteDummyAllScenes } from "@/server/scene-element-details";
import { addBeat, createThread, deleteBeat } from "@/server/plot-threads";
import type { ThreadWithBeats } from "@/server/plot-threads";
import { SceneElementDetailDialog } from "./scene-element-detail-dialog";
import { SceneElementDetails } from "@/db/schema";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Link2, X, Check, Download, List, Navigation, StickyNote, GitBranchPlus, Lightbulb, Loader2, Sprout, LayoutGrid, Rows3, PanelLeftClose, PanelLeftOpen, Repeat, Target, FileText } from "lucide-react";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createPortal } from "react-dom";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { snapSimultaneousBeats } from "@/lib/simultaneous-beats";
import { labelAnchor } from "@/lib/link-label";
import { buildSceneFormat, renderSceneMarkdown } from "@/lib/story-format";

interface PlaygroundBoardProps {
    eventId: string;
    novelId: string;
    initialItems: any[];
    event?: any; // timelineEvent เต็ม — ใช้ดึงฟิลด์ดราม่า (goal/conflict/outcome/POV/เหตุ-ผล) ตอน export
    characters: any[];
    locations: any[];
    ideas: any[];
    threads?: ThreadWithBeats[];
    factions?: any[];
    boardChapters?: BoardChapter[]; // ตอนที่แบ่งไว้บนกระดานอื่นของนิยายเดียวกัน — ใช้อ้างอิงตอนตั้งชื่อ
}

interface Lane {
    id: string;
    name: string;
    orderIndex: number;
    color?: string;
}

// สีเลน — เลือกได้เพื่อแยกเลนด้วยตา
const LANE_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#f43f5e", "#f97316", "#14b8a6", "#64748b"];

// hex → rgba (สำหรับ tint พื้นเลนแบบจางๆ)
const hexA = (hex: string, a: number) => {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// "ตอน" — กรอบครอบช่วงจังหวะภายในบอร์ดนี้ (กำหนด เริ่ม–จบ ชัดเจน)
interface Chapter {
    id: string;
    name: string;
    startBeat: number;
    endBeat: number;
}

const COLUMN_WIDTH = 280;
const LABEL_WIDTH = 150;
const GUTTER_WIDTH = Math.round(COLUMN_WIDTH / 3); // ช่องแคบระหว่างจังหวะ ให้เส้นเชื่อมวิ่งผ่าน
const BOARD_ZOOM = 0.8; // ponytail: native zoom out ~20% เพื่อเห็นภาพรวม, ปรับเป็น 1 ถ้าจะคืนขนาดจริง
const beatGridCol = (beatIndex: number) => beatIndex * 2 + 2; // คอลัมน์การ์ด (เว้นช่องกัตเตอร์แทรกทุกจังหวะ)

// ---- Canvas link (P-canvas): เส้นเชื่อมมีชนิด/label ----
// ย้ายไป lib/link-kinds.ts แล้ว — re-export เพื่อไม่ให้ import path เดิมพัง
// `export ... from` ไม่ดึงชื่อเข้า scope ของไฟล์นี้ — ต้อง import แล้ว re-export แยก
import { normalizeLink, LINK_KINDS, type CanvasLink } from "@/lib/link-kinds";
export { normalizeLink, LINK_KINDS, type CanvasLink };

// ---- Migration: ฉากเก่า (x,y อิสระ) -> lane + beatIndex ----
function buildBoardState(initialItems: any[]): { lanes: Lane[]; items: any[]; chapters: Chapter[] } {
    const laneItems = initialItems.filter((i: any) => i.type === 'lane');
    let lanes: Lane[] = laneItems
        .map((l: any) => ({ id: l.id, name: l.name || 'เลน', orderIndex: l.orderIndex ?? 0, color: l.color }))
        .sort((a, b) => a.orderIndex - b.orderIndex);

    // "ตอน" — กรอบครอบช่วงจังหวะ (เฉพาะบอร์ดนี้) เก็บเป็น node type 'chapter'
    const chapters: Chapter[] = initialItems
        .filter((i: any) => i.type === 'chapter')
        .map((c: any) => ({
            id: c.id,
            name: c.name || 'ตอน',
            startBeat: c.startBeat ?? 0,
            endBeat: c.endBeat ?? c.startBeat ?? 0,
        }))
        .sort((a, b) => a.startBeat - b.startBeat);

    // group frames เดิมเลิกใช้แล้ว (เลนทำหน้าที่จัดกลุ่มแทน) — กรองทิ้งเงียบๆ
    let cardItems = initialItems.filter((i: any) => i.type !== 'group' && i.type !== 'lane' && i.type !== 'chapter');

    const needsMigration = cardItems.some((i: any) => i.laneId == null || i.beatIndex == null);
    if (needsMigration) {
        if (lanes.length === 0) {
            lanes = [{ id: crypto.randomUUID(), name: 'ทั่วไป', orderIndex: 0 }];
        }
        const defaultLaneId = lanes[0].id;
        const sorted = [...cardItems].sort((a, b) => (a.x ?? 0) - (b.x ?? 0));
        const rankMap = new Map(sorted.map((it, idx) => [it.id, idx]));
        cardItems = cardItems.map((it: any) => ({
            ...it,
            laneId: it.laneId ?? defaultLaneId,
            beatIndex: it.beatIndex ?? rankMap.get(it.id) ?? 0,
        }));
    }
    if (lanes.length === 0) {
        lanes = [{ id: crypto.randomUUID(), name: 'ทั่วไป', orderIndex: 0 }];
    }
    return { lanes, items: cardItems, chapters };
}

// Red String Connection (ด้ายแดงแบบนักสืบ) — generalized ตามชนิดเส้น
function ConnectionLine({ start, end, kind = "related", label, onClick }: {
    start: { x: number; y: number };
    end: { x: number; y: number };
    kind?: string;
    label?: string | null;
    onClick?: () => void;
}) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const length = Math.sqrt(dx * dx + dy * dy);

    // เส้นสั้นแค่ไหนก็ต้องวาด (การ์ดช่องติดกันเหลือร่องแค่ ~12px) — scale ส่วนประกอบตามความยาว
    const shorten = Math.min(4, length * 0.12);

    const sX = start.x + Math.cos(angle) * shorten;
    const sY = start.y + Math.sin(angle) * shorten;
    const eX = end.x - Math.cos(angle) * shorten;
    const eY = end.y - Math.sin(angle) * shorten;

    const pathD = `M ${sX} ${sY} L ${eX} ${eY}`;

    const cfg = LINK_KINDS[kind] || LINK_KINDS.related;

    const arrowSize = Math.min(11, Math.max(5, length * 0.35));
    const arrowAngle = Math.PI / 7;
    const aX1 = eX - arrowSize * Math.cos(angle - arrowAngle);
    const aY1 = eY - arrowSize * Math.sin(angle - arrowAngle);
    const aX2 = eX - arrowSize * Math.cos(angle + arrowAngle);
    const aY2 = eY - arrowSize * Math.sin(angle + arrowAngle);

    // วาง label ใกล้ต้นเส้น (อยู่ในร่องข้างการ์ดต้นทาง ไม่โดนการ์ดกลางทางบัง)
    // เส้นสั้นมาก → ลอยเหนือกึ่งกลางเส้นแทน
    const labelDist = Math.min(36, length / 2);
    const labelX = sX + Math.cos(angle) * labelDist;
    const labelY = length < 40
        ? (sY + eY) / 2 - 14
        : sY + Math.sin(angle) * labelDist - 10;
    const displayLabel = label || (kind !== "related" ? cfg.label : null);

    return (
        <g>
            {/* เส้นขอบขาวบางให้ตัดกับเนื้อหาการ์ดที่อยู่ข้างใต้ */}
            <path d={pathD} stroke="var(--background)" strokeWidth="4" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
            <path d={pathD} stroke={cfg.color} strokeWidth="2" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
            <polygon points={`${eX},${eY} ${aX1},${aY1} ${aX2},${aY2}`} fill={cfg.color} fillOpacity="0.85" />
            <circle cx={sX} cy={sY} r={length < 40 ? 2.5 : 4} fill={cfg.pinFill} stroke={cfg.pinStroke} strokeWidth="1" />
            <circle cx={eX} cy={eY} r={length < 40 ? 2.5 : 4} fill={cfg.pinFill} stroke={cfg.pinStroke} strokeWidth="1" />
            {displayLabel && (
                <g style={{ pointerEvents: 'none' }}>
                    <rect x={labelX - displayLabel.length * 4.5} y={labelY - 9} width={displayLabel.length * 9} height={17} rx="4"
                        fill="white" stroke={cfg.color} strokeWidth="1" opacity="0.92" />
                    <text x={labelX} y={labelY + 3.5} textAnchor="middle" fontSize="10" fill={cfg.color} fontWeight="600">{displayLabel}</text>
                </g>
            )}
            {onClick && (
                <path d={pathD} stroke="transparent" strokeWidth="16" fill="none"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onClick(); }} />
            )}
        </g>
    );
}

// เส้นเชื่อมแบบตั้งฉาก (orthogonal) — วาด polyline หัก 90° ไม่มีเส้นเฉียง หัวลูกศรที่ปลายสุด
function OrthoLine({ points, kind = "related", label, hideLabel = false, onClick }: {
    points: Array<{ x: number; y: number }>;
    kind?: string;
    label?: string | null;
    /** เส้นนี้รวมบัสกับเส้นอื่นที่ป้ายเหมือนกัน — ให้เส้นแรกวาดป้ายคนเดียว */
    hideLabel?: boolean;
    onClick?: () => void;
}) {
    if (points.length < 2) return null;
    const cfg = LINK_KINDS[kind] || LINK_KINDS.related;
    const d = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

    // หัวลูกศรวางที่ปลายสุด หันตามทิศของ segment สุดท้าย
    const p2 = points[points.length - 1];
    const p1 = points[points.length - 2];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const arrowSize = 9;
    const aAng = Math.PI / 7;
    const a1x = p2.x - arrowSize * Math.cos(angle - aAng);
    const a1y = p2.y - arrowSize * Math.sin(angle - aAng);
    const a2x = p2.x - arrowSize * Math.cos(angle + aAng);
    const a2y = p2.y - arrowSize * Math.sin(angle + aAng);

    const start = points[0];
    const displayLabel = hideLabel ? null : (label || (kind !== "related" ? cfg.label : null));
    const mid = labelAnchor(points);

    return (
        <g>
            <path d={d} stroke="var(--background)" strokeWidth="4" strokeOpacity="0.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={d} stroke={cfg.color} strokeWidth="2" strokeOpacity="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <polygon points={`${p2.x},${p2.y} ${a1x},${a1y} ${a2x},${a2y}`} fill={cfg.color} fillOpacity="0.85" />
            <circle cx={start.x} cy={start.y} r={4} fill={cfg.pinFill} stroke={cfg.pinStroke} strokeWidth="1" />
            {displayLabel && (() => {
                const w = displayLabel.length * 9;
                const ly = mid.y;
                return (
                    <g style={{ pointerEvents: "none" }}>
                        <rect x={mid.x - w / 2} y={ly - 8} width={w} height={16} rx="4"
                            fill="white" stroke={cfg.color} strokeWidth="1" opacity="0.92" />
                        <text x={mid.x} y={ly + 3.5} textAnchor="middle" fontSize="10" fill={cfg.color} fontWeight="600">{displayLabel}</text>
                    </g>
                );
            })()}
            {onClick && (
                <path d={d} stroke="transparent" strokeWidth="16" fill="none"
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); onClick(); }} />
            )}
        </g>
    );
}

// Dialog แก้เส้นเชื่อม: เลือกชนิด + label + ลบ
function LinkEditDialog({ sourceTitle, targetTitle, link, onSave, onDelete, onClose }: {
    sourceTitle: string;
    targetTitle: string;
    link: CanvasLink;
    onSave: (patch: { kind: string; label: string | null }) => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const [kind, setKind] = useState(link.kind);
    const [label, setLabel] = useState(link.label || "");

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-muted-foreground" />
                        เส้นเชื่อม
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-medium text-foreground">{sourceTitle}</span>
                        {" → "}
                        <span className="font-medium text-foreground">{targetTitle}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">ชนิดความสัมพันธ์</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(LINK_KINDS).map(([k, cfg]) => (
                                <button
                                    key={k}
                                    onClick={() => setKind(k)}
                                    className={`h-8 rounded border text-xs transition-colors ${kind === k
                                        ? "border-current bg-muted font-semibold"
                                        : "border-border/60 text-muted-foreground hover:border-border"}`}
                                    style={kind === k ? { color: cfg.color } : undefined}
                                >
                                    {cfg.label}
                                </button>
                            ))}
                        </div>
                        {kind === "leads_to" && link.kind !== "leads_to" && (
                            <p className="text-[10px] text-muted-foreground">
                                * ตั้งเป็น "นำไปสู่" จะส่งตัวละครในการ์ดต้นทางต่อไปการ์ดปลายทาง
                            </p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Label บนเส้น (ไม่บังคับ)</label>
                        <Input
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                            placeholder="เช่น เพราะโดนหักหลัง"
                            className="h-8 text-xs"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onDelete}>
                            <X className="w-3.5 h-3.5 mr-1" /> ลบเส้น
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>ยกเลิก</Button>
                            <Button size="sm" className="h-8 text-xs" onClick={() => onSave({ kind, label: label.trim() || null })}>
                                <Check className="w-3.5 h-3.5 mr-1" /> บันทึก
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ThreadSuggestToast({
    ideaTitle,
    threads,
    novelId,
    eventId,
    onDismiss,
}: {
    ideaTitle: string;
    threads: ThreadWithBeats[];
    novelId: string;
    eventId: string;
    onDismiss: () => void;
}) {
    const [mode, setMode] = useState<"pick" | "new">("pick");
    const [selectedId, setSelectedId] = useState(threads[0]?.id ?? "");
    const [newTitle, setNewTitle] = useState(ideaTitle);
    const [isLinking, setIsLinking] = useState(false);

    const handleLink = async () => {
        setIsLinking(true);
        let threadId = selectedId;

        if (mode === "new") {
            if (!newTitle.trim()) return;
            const res = await createThread({ novelId, title: newTitle.trim(), type: "foreshadow" });
            if (!res.success || !res.data) { setIsLinking(false); toast.error("สร้างปมไม่สำเร็จ"); return; }
            threadId = res.data.id;
        }

        const res = await addBeat({ threadId, eventId, role: "seed", novelId });
        setIsLinking(false);
        if (res.success) {
            toast.success("ผูกปมแล้ว ✓");
            onDismiss();
        } else {
            toast.error("ผูกปมไม่สำเร็จ");
        }
    };

    return (
        <div className="chamfered-sm border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-xl w-[320px] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700/60 bg-zinc-950/60">
                <Sprout className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="font-technical text-[9px] uppercase tracking-widest text-zinc-400">วางแล้ว — ผูกปมดีไหม?</span>
                <button onClick={onDismiss} className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors">
                    <X className="h-3 w-3" />
                </button>
            </div>

            <div className="px-3 py-2.5 space-y-2">
                <p className="text-xs text-zinc-300 truncate">
                    <span className="text-amber-400 font-medium">"{ideaTitle}"</span>
                </p>

                <div className="flex gap-1">
                    <button
                        onClick={() => setMode("pick")}
                        className={`flex-1 h-6 text-[10px] chamfered-sm border transition-colors ${mode === "pick" ? "bg-zinc-700 border-zinc-500 text-zinc-100" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}
                    >
                        ปมที่มีอยู่
                    </button>
                    <button
                        onClick={() => setMode("new")}
                        className={`flex-1 h-6 text-[10px] chamfered-sm border transition-colors ${mode === "new" ? "bg-zinc-700 border-zinc-500 text-zinc-100" : "border-zinc-700 text-zinc-500 hover:text-zinc-300"}`}
                    >
                        สร้างปมใหม่
                    </button>
                </div>

                {mode === "pick" && threads.length > 0 && (
                    <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
                        {threads.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedId(t.id)}
                                className={`flex items-center gap-2 px-2 py-1.5 chamfered-sm border text-left text-xs transition-colors ${selectedId === t.id ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"}`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: t.color ?? "#f59e0b" }} />
                                <span className="truncate">{t.title}</span>
                                {selectedId === t.id && <Check className="h-3 w-3 ml-auto shrink-0 text-amber-400" />}
                            </button>
                        ))}
                    </div>
                )}

                {mode === "pick" && threads.length === 0 && (
                    <p className="text-[11px] text-zinc-500 text-center py-1">ยังไม่มีปม — ลองสร้างใหม่</p>
                )}

                {mode === "new" && (
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="ชื่อปมใหม่…"
                        className="w-full h-8 px-2 text-xs bg-zinc-800 border border-zinc-600 chamfered-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/60"
                        autoFocus
                    />
                )}

                <div className="flex gap-1.5 pt-0.5">
                    <button
                        onClick={handleLink}
                        disabled={isLinking || (mode === "pick" && !selectedId) || (mode === "new" && !newTitle.trim())}
                        className="flex-1 h-7 chamfered-sm bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                    >
                        {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sprout className="h-3 w-3" />}
                        {mode === "new" ? "สร้างและผูก" : "ผูกปม"}
                    </button>
                    <button
                        onClick={onDismiss}
                        className="h-7 px-2 chamfered-sm border border-zinc-700 text-zinc-500 text-[11px] hover:text-zinc-300 transition-colors"
                    >
                        ข้าม
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---- Storyboard grid: เลน (แถว) x จังหวะ/beat (คอลัมน์) ----
function LaneLabel({ lane, laneIndex, color, onRename, onRemove, onSetColor, canRemove }: {
    lane: Lane;
    laneIndex: number;
    color: string;
    onRename: (id: string, name: string) => void;
    onRemove: (id: string) => void;
    onSetColor: (id: string, color: string) => void;
    canRemove: boolean;
}) {
    return (
        <div
            style={{ gridColumn: 1, gridRow: laneIndex + 3, width: LABEL_WIDTH, borderLeft: `3px solid ${color}` }}
            className="sticky left-0 z-20 bg-muted/60 backdrop-blur-sm border-r border-b border-border/60 flex items-start gap-1 px-2.5 py-2.5 min-h-[140px]"
        >
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        className="mt-[7px] h-2.5 w-2.5 rounded-full shrink-0 ring-offset-1 hover:ring-2 hover:ring-offset-background transition-shadow"
                        style={{ background: color }}
                        title="เปลี่ยนสีเลน"
                    />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                    <div className="flex flex-wrap gap-1.5 max-w-[132px]">
                        {LANE_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => onSetColor(lane.id, c)}
                                className="h-5 w-5 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                style={{ background: c, outline: lane.color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                            >
                                {lane.color === c && <Check className="h-3 w-3 text-white" />}
                            </button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
            <input
                value={lane.name}
                onChange={e => onRename(lane.id, e.target.value)}
                className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--forge-amber)]/40 rounded px-1 py-0.5 transition-shadow"
                placeholder="ชื่อเลน…"
            />
            {canRemove && (
                <button onClick={() => onRemove(lane.id)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5" title="ลบเลน">
                    <X className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}

function BeatCell({ laneId, beatIndex, laneIndex, isTrailing, laneColor, isDrafting, onAddIdea, children }: {
    laneId: string;
    beatIndex: number;
    laneIndex: number;
    isTrailing: boolean;
    laneColor: string;
    isDrafting?: boolean;
    onAddIdea?: () => void;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `cell:${laneId}:${beatIndex}`,
        data: { acceptsCell: true, laneId, beatIndex },
    });

    return (
        <div
            ref={setNodeRef}
            style={{
                gridColumn: beatGridCol(beatIndex),
                gridRow: laneIndex + 3,
                width: COLUMN_WIDTH,
                background: isOver ? undefined : hexA(laneColor, 0.05),
            }}
            className={cn(
                "group/cell min-h-[140px] p-1.5 border-r border-b flex flex-col gap-1.5 transition-colors",
                isTrailing ? "border-dashed border-border/40" : "border-border/40",
                isOver && "bg-[var(--forge-amber)]/8 ring-1 ring-inset ring-[var(--forge-amber)]/40"
            )}
        >
            {isTrailing && !isDrafting && (
                <button
                    onClick={(e) => { e.stopPropagation(); onAddIdea?.(); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex-1 flex items-center justify-center text-muted-foreground/30 hover:text-[var(--forge-amber)] transition-colors"
                    title="เพิ่มไอเดียในจังหวะใหม่"
                >
                    <Plus className="w-5 h-5" />
                </button>
            )}
            {children}
        </div>
    );
}

// Popup เล็กๆ กำหนดตอน (ชื่อ + จังหวะเริ่ม/จบ) — ใช้ทั้งเพิ่มใหม่และแก้ของเดิม
function ChapterPopover({ trigger, initial, beatCount, onSave, onDelete, recentChapters = [] }: {
    trigger: React.ReactNode;
    initial: { name: string; startBeat: number; endBeat: number };
    beatCount: number;
    recentChapters?: BoardChapter[];
    onSave: (v: { name: string; startBeat: number; endBeat: number }) => void;
    onDelete?: () => void;
}) {
    const [open, setOpen] = useState(false);
    // ponytail: anchor จุดเดียวที่เมาส์ portal ไป body เอง เลยไม่โดน zoom ของกริดกวนพิกัด
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [name, setName] = useState(initial.name);
    const [start, setStart] = useState(initial.startBeat);
    const [end, setEnd] = useState(initial.endBeat);

    useEffect(() => {
        if (open) { setName(initial.name); setStart(initial.startBeat); setEnd(initial.endBeat); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const save = () => {
        onSave({ name: name.trim() || 'ตอน', startBeat: Math.min(start, end), endBeat: Math.max(start, end) });
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <span onPointerDown={(e) => setPos({ x: e.clientX, y: e.clientY })} className="contents">
                <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            </span>
            {open && createPortal(
                <PopoverAnchor style={{ position: 'fixed', left: pos.x, top: pos.y, width: 0, height: 0 }} />,
                document.body
            )}
            <PopoverContent align="start" sideOffset={8} collisionPadding={12} className="w-64 p-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                    placeholder="ชื่อตอน เช่น ตอนที่ 1"
                    className="h-8 text-sm"
                />
                {recentChapters.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground">ตอนล่าสุดในนิยาย — กดเพื่อใช้ชื่อนี้</p>
                        <div className="flex flex-wrap gap-1">
                            {recentChapters.map(c => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setName(c.name)}
                                    title={`${c.sceneTitle} · จังหวะ ${c.startBeat + 1}–${c.endBeat + 1}`}
                                    className="max-w-full truncate rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-[var(--forge-amber)]/50 hover:text-foreground"
                                >
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>จังหวะ {String(start + 1).padStart(2, '0')} – {String(end + 1).padStart(2, '0')}</span>
                    </div>
                    <Slider
                        min={0}
                        max={Math.max(0, beatCount - 1)}
                        step={1}
                        value={[start, end]}
                        onValueChange={([s, e]) => { setStart(s); setEnd(e); }}
                    />
                </div>
                <div className="flex items-center justify-between pt-1">
                    {onDelete ? (
                        <button onClick={() => { onDelete(); setOpen(false); }} className="text-xs text-destructive hover:underline">ลบตอน</button>
                    ) : <span />}
                    <Button size="sm" className="h-7 text-xs" onClick={save}>บันทึก</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// การ์ดร่างสร้างไอเดีย inline — ใส่แค่ชื่อ, Enter/blur ที่มีชื่อ = บันทึก, ว่าง/Esc = ทิ้ง
function DraftIdeaCard({ onCommit, onCancel }: { onCommit: (title: string) => void; onCancel: () => void }) {
    const [title, setTitle] = useState("");
    const cancelRef = useRef(false);
    return (
        <div
            className="rounded-md border border-[var(--forge-amber)]/60 bg-card p-2 shadow-sm animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="w-3.5 h-3.5 text-[var(--forge-amber)]" />
                <span className="text-[9px] uppercase font-technical tracking-wide text-muted-foreground">ไอเดียใหม่</span>
            </div>
            <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    else if (e.key === "Escape") { cancelRef.current = true; e.currentTarget.blur(); }
                }}
                onBlur={() => { if (cancelRef.current || !title.trim()) onCancel(); else onCommit(title.trim()); }}
                placeholder="ชื่อไอเดีย… (Enter บันทึก, ปล่อยว่าง = ทิ้ง)"
                className="w-full h-7 px-1 text-sm font-semibold bg-transparent border-b border-border/60 focus:outline-none focus:border-[var(--forge-amber)]"
            />
        </div>
    );
}

// Skeleton ระหว่างรอ createIdea — กันช่องว่างวูบหลัง commit draft (ผู้ใช้เข้าใจผิดว่าบั๊คแล้วกดสร้างซ้ำ)
function CreatingIdeaSkeleton({ title }: { title: string }) {
    return (
        <div className="rounded-md border border-dashed border-border/60 bg-card/60 p-2 animate-pulse">
            <div className="flex items-center gap-1.5 mb-1.5">
                <Loader2 className="w-3.5 h-3.5 text-[var(--forge-amber)] animate-spin" />
                <span className="text-[9px] uppercase font-technical tracking-wide text-muted-foreground">กำลังสร้าง…</span>
            </div>
            <p className="text-sm font-semibold text-foreground/70 truncate">{title}</p>
            <div className="mt-1.5 h-2 w-3/4 rounded bg-muted" />
        </div>
    );
}

const THREAD_ROLES: Array<{ value: string; label: string; icon: typeof Sprout; cls: string }> = [
    { value: "seed", label: "หว่าน", icon: Sprout, cls: "text-amber-500" },
    { value: "reinforce", label: "ย้ำ", icon: Repeat, cls: "text-blue-500" },
    { value: "payoff", label: "เฉลย", icon: Target, cls: "text-emerald-500" },
];

// Dialog ผูกปมกับการ์ด — เลือกบทบาท (หว่าน/ย้ำ/เฉลย) แล้วคลิกปม หรือสร้างปมใหม่
function ThreadBindDialog({ cardTitle, threads, bound, onBind, onCreateAndBind, onUnbind, onClose }: {
    cardTitle: string;
    threads: ThreadWithBeats[];
    bound: Array<{ beatId: string; threadId: string; title: string; color: string | null; role: string }>;
    onBind: (threadId: string, role: string) => void;
    onCreateAndBind: (title: string, role: string) => void;
    onUnbind: (beatId: string, threadId: string) => void;
    onClose: () => void;
}) {
    const [role, setRole] = useState("seed");
    const [newTitle, setNewTitle] = useState("");
    const boundThreadIds = new Set(bound.map(b => b.threadId));

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-[var(--forge-gold)]" /> ผูกปมกับการ์ด
                    </DialogTitle>
                    <DialogDescription className="text-xs truncate">{cardTitle}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {/* ปมที่ผูกอยู่ */}
                    {bound.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {bound.map(b => {
                                const r = THREAD_ROLES.find(x => x.value === b.role);
                                const RIcon = r?.icon ?? Sprout;
                                return (
                                    <span key={b.beatId} className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full border text-[11px]" style={{ borderColor: (b.color ?? "#f59e0b") + "80" }}>
                                        <span className="h-2 w-2 rounded-full" style={{ background: b.color ?? "#f59e0b" }} />
                                        <RIcon className={cn("w-3 h-3", r?.cls)} />
                                        <span className="truncate max-w-[110px]">{b.title}</span>
                                        <button onClick={() => onUnbind(b.beatId, b.threadId)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* เลือกบทบาท */}
                    <div className="flex gap-1.5">
                        {THREAD_ROLES.map(r => {
                            const Icon = r.icon;
                            return (
                                <button key={r.value} onClick={() => setRole(r.value)}
                                    className={cn("flex-1 h-8 rounded border text-xs flex items-center justify-center gap-1 transition-colors",
                                        role === r.value ? "border-current bg-muted " + r.cls : "border-border/60 text-muted-foreground hover:border-border")}>
                                    <Icon className="w-3.5 h-3.5" />{r.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* เลือกปมที่มี */}
                    <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto">
                        {threads.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-1">ยังไม่มีปม — สร้างใหม่ด้านล่าง</p>}
                        {threads.map(t => (
                            <button key={t.id} onClick={() => onBind(t.id, role)} disabled={boundThreadIds.has(t.id)}
                                className="flex items-center gap-2 px-2 py-1.5 rounded border text-left text-xs border-border/60 hover:border-border disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color ?? "#f59e0b" }} />
                                <span className="truncate flex-1">{t.title}</span>
                                {boundThreadIds.has(t.id) ? <Check className="w-3 h-3 text-emerald-500" /> : <Plus className="w-3 h-3 text-muted-foreground" />}
                            </button>
                        ))}
                    </div>

                    {/* สร้างปมใหม่ */}
                    <div className="flex gap-1.5 pt-1 border-t">
                        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="สร้างปมใหม่…" className="h-8 text-xs"
                            onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) { onCreateAndBind(newTitle.trim(), role); setNewTitle(""); } }} />
                        <Button size="sm" className="h-8 text-xs" disabled={!newTitle.trim()} onClick={() => { onCreateAndBind(newTitle.trim(), role); setNewTitle(""); }}>
                            <Plus className="w-3.5 h-3.5 mr-1" />สร้าง+ผูก
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function PlaygroundBoard({
    eventId,
    novelId,
    initialItems,
    event,
    characters,
    locations,
    ideas,
    threads = [],
    factions = [],
    boardChapters = [],
}: PlaygroundBoardProps) {
    const [{ lanes, items: initialCardItems, chapters: initialChapters }] = useState(() => buildBoardState(initialItems));
    const [lanes_, setLanes] = useState<Lane[]>(lanes);
    const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
    const [items, setItems] = useState<any[]>(initialCardItems);

    /**
     * ตอนทั้งนิยายเรียงตามลำดับเรื่อง = ตอนของบอร์ดอื่น (จาก DB ตอนโหลดหน้า) + ตอนของบอร์ดนี้ (state สด)
     * ต้องรวม state สดด้วย ไม่งั้นตอนที่เพิ่งแบ่งจะไม่โผล่จนกว่าจะรีเฟรช
     */
    const allChapters = useMemo(() => {
        const others = boardChapters.filter(c => c.sceneId !== eventId);
        const mine: BoardChapter[] = chapters.map(c => ({
            ...c,
            sceneId: eventId,
            sceneTitle: event?.title || "บอร์ดนี้",
            sceneOrder: event?.orderIndex ?? 0,
        }));
        return [...others, ...mine].sort((a, b) => a.sceneOrder - b.sceneOrder || a.startBeat - b.startBeat);
    }, [boardChapters, chapters, eventId, event?.title, event?.orderIndex]);

    // เลขตอนถัดไป นับจากทั้งนิยาย ไม่ใช่แค่บอร์ดนี้
    const nextChapterNumber = allChapters.reduce((max, c) => {
        const n = parseInt(c.name.match(/[0-9]+/)?.[0] ?? "", 10);
        return Number.isFinite(n) && n > max ? n : max;
    }, 0) + 1;
    const [activeDragItem, setActiveDragItem] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    // ไอเดียใหม่จะวางที่จังหวะไหน: 'latest' = จังหวะล่าสุด (คอลัมน์ที่มีอยู่) | 'new' = จังหวะใหม่ (คอลัมน์ท้าย)
    const [newIdeaBeat, setNewIdeaBeat] = useState<'latest' | 'new'>('new');
    const [newIdeaLaneId, setNewIdeaLaneId] = useState<string>(''); // '' = เลนแรก

    // สร้างไอเดีย inline: การ์ดร่างในช่องที่กด +
    const [draftCell, setDraftCell] = useState<{ laneId: string; beatIndex: number } | null>(null);
    // ระหว่างรอ createIdea → โชว์ skeleton ในช่องเดิม กันดูเหมือนบั๊ค/กดรัว
    const [creatingCell, setCreatingCell] = useState<{ laneId: string; beatIndex: number; title: string } | null>(null);
    const handleCommitDraft = useCallback(async (title: string) => {
        const cell = draftCell;
        setDraftCell(null);
        if (!title || !cell) return;
        setCreatingCell({ ...cell, title });
        const res = await createIdea({ title, novelId, category: 'general' });
        if (!res.success || !res.data) { toast.error('สร้างไอเดียไม่สำเร็จ'); setCreatingCell(null); return; }
        const idea = res.data;
        setItems(prev => [...prev, {
            id: crypto.randomUUID(), type: 'idea', referenceId: idea.id,
            title: idea.title, content: idea.content || '',
            laneId: cell.laneId, beatIndex: cell.beatIndex, children: [], links: [],
        }]);
        setCreatingCell(null);
        updateIdea(idea.id, { isUsed: true });
    }, [draftCell, novelId]);

    // ปมเรื่องระดับ card: เก็บ threads เป็น state เพื่ออัปเดต badge ทันทีหลังผูก/ปลด
    const [threadState, setThreadState] = useState<ThreadWithBeats[]>(threads);
    const [threadBindItem, setThreadBindItem] = useState<any | null>(null); // card ที่กำลังเปิด dialog ผูกปม
    // canvasItemId → beats ที่ผูกกับ card นั้นในฉากนี้ (พร้อมข้อมูลปม)
    const cardBeats = useMemo(() => {
        const m = new Map<string, Array<{ beatId: string; threadId: string; title: string; color: string | null; role: string }>>();
        threadState.forEach(t => t.beats.forEach(b => {
            if (b.eventId !== eventId || !b.canvasItemId) return;
            const arr = m.get(b.canvasItemId) ?? [];
            arr.push({ beatId: b.id, threadId: t.id, title: t.title, color: t.color, role: b.role });
            m.set(b.canvasItemId, arr);
        }));
        return m;
    }, [threadState, eventId]);

    const handleBindThread = useCallback(async (cardId: string, threadId: string, role: string) => {
        const res = await addBeat({ threadId, eventId, role, canvasItemId: cardId, novelId });
        if (res.success && res.data) {
            setThreadState(prev => prev.map(t => t.id === threadId
                ? { ...t, beats: [...t.beats, { id: res.data.id, eventId, canvasItemId: cardId, role, note: null, orderIndex: null }] }
                : t));
            toast.success("ผูกปมกับการ์ดแล้ว");
        } else toast.error("ผูกปมไม่สำเร็จ");
    }, [eventId, novelId]);

    const handleUnbindThread = useCallback(async (beatId: string, threadId: string) => {
        const res = await deleteBeat(beatId, novelId);
        if (res.success) {
            setThreadState(prev => prev.map(t => t.id === threadId
                ? { ...t, beats: t.beats.filter(b => b.id !== beatId) }
                : t));
        } else toast.error("ปลดปมไม่สำเร็จ");
    }, [novelId]);

    const handleCreateAndBind = useCallback(async (cardId: string, title: string, role: string) => {
        const res = await createThread({ novelId, title });
        if (!res.success || !res.data) { toast.error("สร้างปมไม่สำเร็จ"); return; }
        const thread = res.data;
        setThreadState(prev => [...prev, {
            id: thread.id, novelId, title: thread.title, type: thread.type, status: thread.status,
            importance: thread.importance, color: thread.color, note: thread.note, beats: [],
        }]);
        await handleBindThread(cardId, thread.id, role);
    }, [novelId, handleBindThread]);

    const [threadSuggest, setThreadSuggest] = useState<{
        ideaTitle: string;
        selectedThreadId: string;
        newThreadTitle: string;
        mode: "pick" | "new";
        isLinking: boolean;
    } | null>(null);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [linkingSourceId, setLinkingSourceId] = useState<string | null>(null)
    const [editingLink, setEditingLink] = useState<{ sourceId: string; targetId: string } | null>(null);
    // drag-to-connect (A)
    const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
    const [connectOverId, setConnectOverId] = useState<string | null>(null);

    const [elementDetailsMap, setElementDetailsMap] = useState<Map<string, SceneElementDetails>>(new Map());
    const [editingChild, setEditingChild] = useState<{ child: any; canvasItemId: string } | null>(null);

    const [ideaNotes, setIdeaNotes] = useState<SceneElementDetails[]>([]);

    // ชื่อ dummy ทั้งนิยาย (distinct) — ไว้ให้ @mention ในโน้ตอ้างถึงตัวประกอบจากฉากอื่นได้
    const [novelDummyNames, setNovelDummyNames] = useState<string[]>([]);
    useEffect(() => {
        getNovelDummyParticipants(novelId).then(res => {
            if (!res.success) return;
            const names = Array.from(new Set(res.data.flatMap(s => s.dummies.map(d => d.title))));
            setNovelDummyNames(names);
        });
    }, [novelId]);

    const [ancestorConnections, setAncestorConnections] = useState<Array<{
        id: string; sourceIdeaId: string; targetIdeaId: string; label?: string | null;
    }>>([]);
    const [ancestorDialogItem, setAncestorDialogItem] = useState<any | null>(null);
    const [ancestorSearch, setAncestorSearch] = useState('');
    const [ancestorLabel, setAncestorLabel] = useState('');
    const [ancestorIdeaNotesMap, setAncestorIdeaNotesMap] = useState<Map<string, string[]>>(new Map());

    const isFirstMount = useRef(true);
    const [showNavigator, setShowNavigator] = useState(false);

    // Grid measurement: ตำแหน่งจริงของแต่ละการ์ด สำหรับวาดเส้น link/ancestor
    const itemRefs = useRef(new Map<string, HTMLDivElement>());
    const gridRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [linkPositions, setLinkPositions] = useState<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());

    const registerItemRef = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) itemRefs.current.set(id, el); else itemRefs.current.delete(id);
    }, []);

    const recomputePositions = useCallback(() => {
        const container = gridRef.current;
        if (!container) return;
        const containerRect = container.getBoundingClientRect();
        const next = new Map<string, { x: number; y: number; w: number; h: number }>();
        itemRefs.current.forEach((el, id) => {
            const r = el.getBoundingClientRect();
            // SVG overlay อยู่ใน subtree ที่โดน zoom เดียวกัน หน่วยของมันเลยถูกย่อไปแล้ว
            // ต้องหารด้วย BOARD_ZOOM กลับเป็นหน่วย local ก่อนเอาไปวาด path ไม่งั้นเส้นจะเพี้ยนซ้อน
            next.set(id, {
                x: (r.left - containerRect.left + r.width / 2) / BOARD_ZOOM,
                y: (r.top - containerRect.top + r.height / 2) / BOARD_ZOOM,
                w: r.width / BOARD_ZOOM,
                h: r.height / BOARD_ZOOM,
            });
        });
        // ponytail: พิกัดเท่าเดิม → คืน state ตัวเดิม ไม่งั้น Map ใหม่ทุกครั้ง = re-render ทุกครั้ง
        // ทั้งที่ไม่มีอะไรขยับ (ฟังก์ชันนี้ถูกเรียกทั้งจาก layout effect และ ResizeObserver)
        // ไม่ใช่ตัวแก้ #185 — ตัวนั้นอยู่ที่ scene-participants-panel handleAddMany
        setLinkPositions(prev => {
            if (prev.size === next.size) {
                let same = true;
                for (const [id, p] of next) {
                    const q = prev.get(id);
                    if (!q || q.x !== p.x || q.y !== p.y || q.w !== p.w || q.h !== p.h) { same = false; break; }
                }
                if (same) return prev;
            }
            return next;
        });
    }, []);

    // การ์ดสูงขึ้นหลัง note/children/ancestor โหลด async → ต้องวัดใหม่ ไม่งั้น anchor ค้างที่กึ่งกลางเก่า (เลื่อนไปด้านบน)
    useLayoutEffect(() => {
        recomputePositions();
    }, [items, lanes_, chapters, ideaNotes, elementDetailsMap, ancestorConnections, recomputePositions]);

    useEffect(() => {
        const ro = new ResizeObserver(() => recomputePositions());
        if (gridRef.current) ro.observe(gridRef.current);
        // observe การ์ดแต่ละใบด้วย — ถ้าการ์ดใบเดียวสูงขึ้นแต่ container ไม่โต (มีการ์ดอื่นสูงกว่าในแถว) container RO จะไม่ยิง
        itemRefs.current.forEach(el => ro.observe(el));
        return () => ro.disconnect();
    }, [recomputePositions, items]);

    // จำนวน beat จริง + คอลัมน์ท้ายเปล่าไว้ลาก/วางเพื่อขยาย
    const beatCount = useMemo(
        () => Math.max(0, ...items.map(i => (typeof i.beatIndex === 'number' ? i.beatIndex : 0) + 1)),
        [items]
    );
    const totalColumns = beatCount + 1;

    // ยังไม่มีจังหวะในฉาก → เลือกได้แค่ "จังหวะใหม่"
    useEffect(() => {
        if (beatCount === 0 && newIdeaBeat !== 'new') setNewIdeaBeat('new');
    }, [beatCount, newIdeaBeat]);

    // ---- "ตอน" — กรอบครอบช่วงจังหวะ (กำหนดผ่าน dialog เริ่ม–จบ) ----
    const chapterRanges = useMemo(() => {
        return [...chapters]
            .map(c => ({ ...c, startBeat: Math.max(0, c.startBeat), endBeat: Math.min(beatCount - 1, c.endBeat) }))
            .filter(c => c.startBeat <= c.endBeat && c.startBeat < beatCount)
            .sort((a, b) => a.startBeat - b.startBeat);
    }, [chapters, beatCount]);

    const addChapter = useCallback((v: { name: string; startBeat: number; endBeat: number }) => {
        setChapters(prev => [...prev, { id: crypto.randomUUID(), ...v }]);
    }, []);

    const updateChapter = useCallback((id: string, v: { name: string; startBeat: number; endBeat: number }) => {
        setChapters(prev => prev.map(c => (c.id === id ? { ...c, ...v } : c)));
    }, []);

    const removeChapter = useCallback((id: string) => {
        setChapters(prev => prev.filter(c => c.id !== id));
    }, []);

    // Sync เมื่อเปลี่ยนฉาก
    useEffect(() => {
        const { lanes: newLanes, items: newItems } = buildBoardState(initialItems);
        setLanes(newLanes);
        setItems(newItems);
        isFirstMount.current = true;
    }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch element details on mount
    useEffect(() => {
        const fetchDetails = async () => {
            const result = await getSceneElementDetails(eventId);
            if (result.success && result.data) {
                const map = new Map<string, SceneElementDetails>();
                const notes: SceneElementDetails[] = [];
                result.data.forEach(detail => {
                    if (detail.elementType === 'idea_note') {
                        notes.push(detail);
                    } else {
                        const key = `${detail.canvasItemId}-${detail.elementType}-${detail.elementId}`;
                        map.set(key, detail);
                    }
                });
                setElementDetailsMap(map);
                setIdeaNotes(notes);
            }
        };
        fetchDetails();
    }, [eventId]);

    const handleDetailSaved = useCallback((detail: SceneElementDetails) => {
        if (detail.elementType === 'idea_note') {
            setIdeaNotes(prev => {
                const existing = prev.findIndex(n => n.id === detail.id);
                if (existing >= 0) {
                    const updated = [...prev];
                    updated[existing] = detail;
                    return updated;
                }
                return [...prev, detail];
            });
        } else {
            setElementDetailsMap(prev => {
                const newMap = new Map(prev);
                const key = `${detail.canvasItemId}-${detail.elementType}-${detail.elementId}`;
                newMap.set(key, detail);
                return newMap;
            });
        }
    }, []);

    const handleNoteDeleted = useCallback((id: string) => {
        setIdeaNotes(prev => prev.filter(n => n.id !== id));
    }, []);

    const handleEditChild = useCallback((child: any) => {
        setEditingChild({ child, canvasItemId: child.canvasItemId });
    }, []);

    // Quick inline note — สร้างใหม่ (existingNoteId ว่าง) หรือแก้ไขโน้ตเดิม ทำ inline บนการ์ด ไม่เปิด dialog
    const handleQuickAddNote = useCallback(async (item: any, text: string, existingNoteId?: string, noteKind?: string) => {
        const notes = text.trim();
        if (!notes) return;
        const { upsertSceneElementDetail } = await import('@/server/scene-element-details');
        const result = await upsertSceneElementDetail({
            id: existingNoteId,
            sceneId: eventId,
            elementType: 'idea_note',
            elementId: item.referenceId || item.id,
            canvasItemId: item.id,
            notes,
            noteKind,
            novelId,
            forceCreate: !existingNoteId,
        });
        if (result.success && result.data) {
            handleDetailSaved(result.data);
        } else {
            toast.error(result.error || "ไม่สามารถบันทึกได้");
        }
    }, [eventId, novelId, handleDetailSaved]);

    const handleDeleteNote = useCallback(async (noteId: string) => {
        const { deleteSceneElementDetail } = await import('@/server/scene-element-details');
        const result = await deleteSceneElementDetail(noteId, novelId, eventId);
        if (result.success) {
            handleNoteDeleted(noteId);
            toast.success("ลบโน้ตแล้ว");
        } else {
            toast.error("ลบไม่สำเร็จ");
        }
    }, [novelId, eventId, handleNoteDeleted]);

    // ลากสลับลำดับโน้ตในการ์ด — อัปเดต local state ทันที แล้วค่อยยิงบันทึกลำดับใหม่ไป DB
    const handleReorderNotes = useCallback(async (orderedNoteIds: string[]) => {
        setIdeaNotes(prev => {
            const byId = new Map(prev.map(n => [n.id, n]));
            const reordered = orderedNoteIds
                .map((id, index) => {
                    const note = byId.get(id);
                    return note ? { ...note, noteOrder: index } : undefined;
                })
                .filter((n) => n !== undefined);
            const reorderedIds = new Set(orderedNoteIds);
            return [...reordered, ...prev.filter(n => !reorderedIds.has(n.id))];
        });
        const { reorderIdeaNotes } = await import('@/server/scene-element-details');
        const result = await reorderIdeaNotes(novelId, eventId, orderedNoteIds);
        if (!result.success) toast.error("บันทึกลำดับโน้ตไม่สำเร็จ");
    }, [novelId, eventId]);

    useEffect(() => {
        const fetchAncestorConnections = async () => {
            const { getAncestorConnectionsByNovelId } = await import('@/server/idea');
            const result = await getAncestorConnectionsByNovelId(novelId);
            if (result.success && result.data) {
                setAncestorConnections(result.data.map(c => ({
                    id: c.id, sourceIdeaId: c.sourceIdeaId, targetIdeaId: c.targetIdeaId, label: c.label,
                })));
            }
        };
        fetchAncestorConnections();
    }, [novelId]);

    useEffect(() => {
        const targetIds = [...new Set(ancestorConnections.map(c => c.targetIdeaId))];
        if (targetIds.length === 0) {
            setAncestorIdeaNotesMap(new Map());
            return;
        }
        const fetchNotes = async () => {
            const result = await getIdeaNotesForIdeas(novelId, targetIds);
            if (result.success && result.data) setAncestorIdeaNotesMap(result.data);
        };
        fetchNotes();
    }, [ancestorConnections, novelId]);

    const handleOpenAncestorDialog = useCallback((item: any) => {
        setAncestorDialogItem(item);
        setAncestorSearch('');
        setAncestorLabel('');
    }, []);

    const handleCreateAncestor = useCallback(async (ancestorIdeaId: string) => {
        if (!ancestorDialogItem) return;
        const sourceIdeaId = ancestorDialogItem.referenceId || ancestorDialogItem.id;
        const { createIdeaConnection } = await import('@/server/idea');
        const result = await createIdeaConnection({
            sourceIdeaId, targetIdeaId: ancestorIdeaId, novelId, connectionType: 'ancestor', label: ancestorLabel || undefined,
        });
        if (result.success && result.data) {
            setAncestorConnections(prev => [...prev, {
                id: result.data.id, sourceIdeaId: result.data.sourceIdeaId, targetIdeaId: result.data.targetIdeaId, label: result.data.label,
            }]);
            toast.success('เชื่อมเหตุผลสำเร็จ!');
            setAncestorDialogItem(null);
        } else {
            toast.error('ไม่สามารถเชื่อมได้');
        }
    }, [ancestorDialogItem, novelId, ancestorLabel]);

    const handleRemoveAncestor = useCallback(async (connectionId: string) => {
        const { deleteIdeaConnection } = await import('@/server/idea');
        const result = await deleteIdeaConnection(connectionId);
        if (result.success) {
            setAncestorConnections(prev => prev.filter(c => c.id !== connectionId));
            toast.success('ลบเหตุผลสำเร็จ');
        }
    }, []);

    // Auto-save (items + lanes)
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            const laneNodes = lanes_.map(l => ({ id: l.id, type: 'lane', name: l.name, orderIndex: l.orderIndex, color: l.color }));
            const chapterNodes = chapters.map(c => ({ id: c.id, type: 'chapter', name: c.name, startBeat: c.startBeat, endBeat: c.endBeat }));
            const result = await updateTimelineCanvas(eventId, [...items, ...laneNodes, ...chapterNodes]);
            if (result.success) setLastSaved(new Date());
            else toast.error("บันทึกอัตโนมัติไม่สำเร็จ — ลองแก้อะไรสักอย่างเพื่อบันทึกใหม่");
            setIsSaving(false);
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, [items, lanes_, chapters, eventId]);

    // Linking Handlers
    const handleStartLink = (id: string) => {
        if (linkingSourceId === id) {
            setLinkingSourceId(null);
            toast.info("โหมดเชื่อมเส้น: ยกเลิกแล้ว");
        } else {
            setLinkingSourceId(id);
            toast.info("โหมดเชื่อมเส้น: คลิกการ์ดที่จะเชื่อมด้วย");
        }
    };

    const handleCompleteLink = (targetId: string) => {
        if (!linkingSourceId) return;
        if (linkingSourceId === targetId) return;

        setItems(prev => {
            const sourceItem = prev.find(i => i.id === linkingSourceId);
            if ((sourceItem?.links || []).some((l: any) => normalizeLink(l).targetId === targetId)) {
                toast.info("เชื่อมกันอยู่แล้ว");
                return prev;
            }
            return prev.map(item => item.id === linkingSourceId
                ? { ...item, links: [...(item.links || []), { targetId, kind: "related", label: null }] }
                : item
            );
        });
    };

    const handleFinishLinking = () => {
        const sourceItem = items.find(i => i.id === linkingSourceId);
        const linkCount = sourceItem?.links?.length || 0;
        setLinkingSourceId(null);
        toast.success(`เชื่อมเสร็จแล้ว! ${linkCount} เส้น`);
    };

    const handleCancelLink = () => {
        setLinkingSourceId(null);
        toast.info("ยกเลิกการเชื่อม");
    };

    const handleUnlink = (sourceId: string, targetId: string) => {
        setItems(prev => prev.map(item => item.id === sourceId
            ? { ...item, links: (item.links || []).filter((l: any) => normalizeLink(l).targetId !== targetId) }
            : item
        ));
    };

    const handleUpdateLink = (sourceId: string, targetId: string, patch: { kind?: string; label?: string | null }) => {
        setItems(prev => {
            const sourceItem = prev.find(i => i.id === sourceId);
            const targetItem = prev.find(i => i.id === targetId);
            const oldLink = (sourceItem?.links || []).map(normalizeLink).find((l: CanvasLink) => l.targetId === targetId);
            const becomesLeadsTo = patch.kind === "leads_to" && oldLink?.kind !== "leads_to";

            let newChildren: any[] = [];
            if (becomesLeadsTo) {
                const childrenToCopy = (sourceItem?.children || [])
                    .filter((c: any) => c.type !== 'location' && c.type !== 'sticky-note')
                    .map((c: any) => {
                        // role/บทบาทถูกแก้ที่ detail ต่อการ์ด — ดึงค่าล่าสุดมาใส่ child ที่ก็อป ไม่งั้นได้ role ตอนสร้าง
                        const d = elementDetailsMap.get(`${sourceId}-${c.type}-${c.referenceId || c.refId || c.id}`);
                        return { ...c, id: crypto.randomUUID(), role: d?.role || c.role };
                    });
                const existingRefIds = new Set((targetItem?.children || []).map((c: any) => c.referenceId));
                newChildren = childrenToCopy.filter((c: any) => {
                    if (!c.referenceId) {
                        return !(targetItem?.children || []).some(
                            (ec: any) => !ec.referenceId && ec.title === c.title && ec.type === c.type
                        );
                    }
                    return !existingRefIds.has(c.referenceId);
                });
            }

            const next = prev.map(item => {
                if (item.id === sourceId) {
                    return {
                        ...item,
                        links: (item.links || []).map((l: any) => {
                            const n = normalizeLink(l);
                            return n.targetId === targetId ? { ...n, ...patch } : n;
                        }),
                    };
                }
                if (item.id === targetId) {
                    return {
                        ...item,
                        ...(newChildren.length > 0 ? { children: [...(item.children || []), ...newChildren] } : {}),
                    };
                }
                return item;
            });

            // ยึด beat ของต้นทาง แล้วดึงทั้งกลุ่ม "เกิดพร้อมกัน" ตามมา
            return snapSimultaneousBeats(next, [sourceId]);
        });
        if (patch.kind === "leads_to") toast.success('ตั้งเป็น "นำไปสู่" — ตัวละครถูกส่งต่อไปการ์ดปลายทาง');

        // "เกิดพร้อมกัน" = อยู่จังหวะเดียวกัน — toast แจ้งผู้ใช้ (beat ถูกย้ายใน setItems ด้านบนแล้ว)
        if (patch.kind === "simultaneous") {
            const src = items.find(i => i.id === sourceId);
            const tgt = items.find(i => i.id === targetId);
            if (src && tgt && src.beatIndex !== tgt.beatIndex) {
                toast.success('ตั้งเป็น "เกิดพร้อมกัน" — ย้ายมาอยู่จังหวะเดียวกันแล้ว');
            }
        }
    };

    // Navigator: scroll การ์ดเข้าจอ (ไม่มี pan/zoom แล้ว)
    const handleCenterOnItem = (itemId: string) => {
        const el = itemRefs.current.get(itemId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        setShowNavigator(false);
    };


    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
                shouldActivate: (event: any) => !linkingSourceId && event.button === 0,
            },
        })
    );

    const handleRemoveChild = (parentId: string, childId: string) => {
        setItems(prev => prev.map(item => item.id === parentId
            ? { ...item, children: (item.children || []).filter((c: any) => c.id !== childId) }
            : item
        ));
    };

    // แก้ field บน child เดี่ยว ๆ (เช่น pinnedIdeaIds สำหรับเลือกว่าจะโชว์ไอเดียไหนของฝ่ายบนการ์ด)
    const handleUpdateChild = useCallback((parentId: string, childId: string, patch: any) => {
        setItems(prev => prev.map(item => item.id === parentId
            ? { ...item, children: (item.children || []).map((c: any) => c.id === childId ? { ...c, ...patch } : c) }
            : item
        ));
    }, []);

    const handleAddChild = useCallback((ideaId: string, child: any) => {
        setItems(prev => prev.map(item => item.id === ideaId
            ? { ...item, children: [...(item.children || []), child] }
            : item
        ));
    }, []);

    // แปลง dummy → ตัวจริง: เปลี่ยน dummy ชื่อเดียวกันทุก instance ในฉากให้ชี้ตัวละคร/ฝ่ายจริง + ย้าย detail
    // ผู้ใช้ไม่ต้องมาผูก participant ใหม่ (action/role เดิมตามไปด้วย)
    const handlePromoteDummy = useCallback(async (dummy: any, realId: string, scope: "scene" | "all" = "scene") => {
        const isFaction = dummy.type === "dummy_faction";
        const toType = isFaction ? "faction" : "character";
        const real = (isFaction ? factions : characters).find((e: any) => e.id === realId);
        if (!real) { toast.error("ไม่พบตัวจริง"); return; }

        // รวบรวม child.id ของ dummy ชื่อเดียวกันทุกการ์ด (ไว้ย้าย detail rows)
        const dummyElementIds: string[] = [];
        items.forEach((it: any) => (it.children || []).forEach((ch: any) => {
            if (ch.type === dummy.type && ch.title === dummy.title) dummyElementIds.push(ch.id);
        }));

        // แปลง children ใน state (autosave 2s จะ persist canvasData ให้เอง)
        setItems(prev => prev.map((it: any) => ({
            ...it,
            children: (it.children || []).map((ch: any) =>
                (ch.type === dummy.type && ch.title === dummy.title)
                    ? { ...ch, type: toType, referenceId: realId, title: real.name }
                    : ch),
        })));

        const res = await promoteDummy({ sceneId: eventId, novelId, fromType: dummy.type, toType, dummyElementIds, realId });
        if (!res.success) { toast.error(res.error || "แปลงไม่สำเร็จ"); return; }

        // โหลด detail map ใหม่ (elementId เปลี่ยนจาก child.id → realId)
        const dres = await getSceneElementDetails(eventId);
        if (dres.success && dres.data) {
            const map = new Map<string, SceneElementDetails>();
            const notes: SceneElementDetails[] = [];
            dres.data.forEach(d => {
                if (d.elementType === "idea_note") notes.push(d);
                else map.set(`${d.canvasItemId}-${d.elementType}-${d.elementId}`, d);
            });
            setElementDetailsMap(map);
            setIdeaNotes(notes);
        }

        // ทุกฉาก: ให้ server แปลง dummy ชื่อเดียวกันในฉากอื่นทั้งหมด (ยกเว้นฉากนี้ที่ทำไปแล้ว)
        if (scope === "all") {
            const res2 = await promoteDummyAllScenes({
                novelId, excludeSceneId: eventId, dummyTitle: dummy.title,
                fromType: dummy.type, toType, realId, realName: real.name,
            });
            if (res2.success) toast.success(`แปลงเป็น "${real.name}" แล้ว · อีก ${res2.scenesAffected} ฉากอื่น`);
            else toast.error(res2.error || "แปลงข้ามฉากบางส่วนไม่สำเร็จ");
            return;
        }
        toast.success(`แปลงเป็น "${real.name}" แล้ว`);
    }, [items, characters, factions, eventId, novelId]);

    // เรียงลำดับ beat ตาม chain "นำไปสู่" (คงเลนเดิม แค่ปรับคอลัมน์)
    const handleAutoArrange = () => {
        if (items.length === 0) return;
        const prevState = new Map(items.map(i => [i.id, i.beatIndex]));

        const ideaItems = items.filter(i => i.type === 'idea');
        const leadsTo = new Map<string, string[]>();
        ideaItems.forEach(i => {
            const targets = (i.links || []).map(normalizeLink)
                .filter((l: CanvasLink) => l.kind === 'leads_to')
                .map((l: CanvasLink) => l.targetId)
                .filter((tid: string) => ideaItems.some(x => x.id === tid));
            leadsTo.set(i.id, targets);
        });
        const depths = new Map<string, number>();
        const visiting = new Set<string>();
        const depthOf = (id: string): number => {
            if (depths.has(id)) return depths.get(id)!;
            if (visiting.has(id)) return 0;
            visiting.add(id);
            const incoming = ideaItems.filter(i => (leadsTo.get(i.id) || []).includes(id));
            const d = incoming.length === 0 ? 0 : Math.max(...incoming.map(i => depthOf(i.id))) + 1;
            visiting.delete(id);
            depths.set(id, d);
            return d;
        };
        ideaItems.forEach(i => depthOf(i.id));

        // เรียงตาม chain แล้วค่อยดึงคู่ "เกิดพร้อมกัน" กลับมารวมจังหวะ — anchor เรียงตาม
        // depth ตื้นไปลึก ตัวที่มาก่อนใน chain จึงเป็นคนกำหนดจังหวะของกลุ่ม
        const anchors = [...depths.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
        setItems(prev => snapSimultaneousBeats(
            prev.map(i => i.type === 'idea' && depths.has(i.id) ? { ...i, beatIndex: depths.get(i.id) } : i),
            anchors,
        ));
        toast.success('เรียง beat ตามลำดับ "นำไปสู่" แล้ว', {
            action: {
                label: 'ย้อนกลับ',
                onClick: () => setItems(cur => cur.map(i => prevState.has(i.id) ? { ...i, beatIndex: prevState.get(i.id) } : i)),
            },
        });
    };

    const handleAddLane = () => {
        setLanes(prev => [...prev, { id: crypto.randomUUID(), name: `เลน ${prev.length + 1}`, orderIndex: prev.length, color: LANE_COLORS[prev.length % LANE_COLORS.length] }]);
    };
    const handleRenameLane = (laneId: string, name: string) => {
        setLanes(prev => prev.map(l => l.id === laneId ? { ...l, name } : l));
    };
    const handleSetLaneColor = (laneId: string, color: string) => {
        setLanes(prev => prev.map(l => l.id === laneId ? { ...l, color } : l));
    };
    const handleRemoveLane = (laneId: string) => {
        if (lanes_.length <= 1) { toast.error('ต้องมีอย่างน้อย 1 เลน'); return; }
        if (items.some(i => i.laneId === laneId)) { toast.error('ย้ายการ์ดออกจากเลนนี้ก่อนถึงจะลบได้'); return; }
        setLanes(prev => prev.filter(l => l.id !== laneId));
    };

    // แปลง over.id (การ์ด idea = id ตรงๆ / cell = หาการ์ดในช่อง) → id การ์ดปลายทาง
    const resolveConnectTarget = (overId: string | null, sourceId: string | null): string | null => {
        if (!overId || !sourceId) return null;
        let targetId: string | null = null;
        if (items.some(i => i.id === overId)) targetId = overId;
        else if (overId.startsWith('cell:')) {
            const [, laneId, beatIndexStr] = overId.split(':');
            const t = items.find(i => i.laneId === laneId && i.beatIndex === Number(beatIndexStr));
            targetId = t?.id ?? null;
        }
        return targetId && targetId !== sourceId ? targetId : null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (linkingSourceId) return;
        const data = event.active.data.current as any;
        if (data?.from === 'connect') {
            setConnectingSourceId(data.sourceId);
            return; // ไม่โชว์ overlay การ์ดขณะลากเชื่อม
        }
        setActiveDragItem(data);
    };

    const handleDragOver = (event: DragOverEvent) => {
        if (!connectingSourceId) return;
        setConnectOverId(resolveConnectTarget(event.over ? String(event.over.id) : null, connectingSourceId));
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const activeData = active.data.current as any;

        // --- drag-to-connect: ลากปุ่มเชื่อมไปปล่อยที่การ์ดปลายทาง ---
        if (activeData?.from === 'connect') {
            const sourceId = activeData.sourceId as string;
            const targetId = resolveConnectTarget(over ? String(over.id) : null, sourceId);
            setConnectingSourceId(null);
            setConnectOverId(null);
            if (targetId) {
                setItems(prev => {
                    const src = prev.find(i => i.id === sourceId);
                    if ((src?.links || []).some((l: any) => normalizeLink(l).targetId === targetId)) {
                        toast.info("เชื่อมกันอยู่แล้ว");
                        return prev;
                    }
                    return prev.map(i => i.id === sourceId
                        ? { ...i, links: [...(i.links || []), { targetId, kind: "related", label: null }] }
                        : i);
                });
                setEditingLink({ sourceId, targetId }); // เปิดเลือกชนิดเส้นทันที
            }
            return;
        }

        if (linkingSourceId) return;
        setActiveDragItem(null);
        if (!over) return;

        const overData = over.data.current as any;
        const overId = String(over.id);
        const cellMatch = overId.startsWith('cell:');

        const isDuplicate = (parentItem: any, newItemRefId: string | undefined) => {
            if (!newItemRefId) return false;
            return parentItem.children?.some((c: any) => c.referenceId && c.referenceId === newItemRefId);
        };

        // --- ย้ายการ์ดที่มีอยู่แล้ว ---
        if (activeData?.from === "canvas") {
            // วางลงในไอเดีย (nest เป็น child)
            if (overData?.acceptDrops && over.id !== active.id) {
                if (activeData.type === 'idea') {
                    toast.error("ไอเดียซ้อนกันไม่ได้");
                    return;
                }
                setItems(prev => {
                    const targetIdea = prev.find(i => i.id === over.id);
                    if (targetIdea && isDuplicate(targetIdea, activeData.referenceId)) {
                        toast.error("มีอยู่ในไอเดียนี้แล้ว");
                        return prev;
                    }
                    const activeItem = prev.find(i => i.id === active.id);
                    if (!activeItem) return prev;
                    return prev.map(item => item.id === over.id
                        ? { ...item, children: [...(item.children || []), activeItem] }
                        : item
                    ).filter(i => i.id !== active.id);
                });
                return;
            }

            // ย้ายไปช่องอื่น
            if (cellMatch) {
                const [, laneId, beatIndexStr] = overId.split(':');
                const beatIndex = Number(beatIndexStr);
                // การ์ดที่ผูก "เกิดพร้อมกัน" ต้องย้ายจังหวะตามไปด้วย ไม่งั้นคู่แยกคอลัมน์
                // แล้วเส้นจะไปตกที่ตัววาดแบบ cross-beat ที่ลากยาวข้ามการ์ดอื่น
                setItems(prev => snapSimultaneousBeats(
                    prev.map(item => item.id === active.id ? { ...item, laneId, beatIndex } : item),
                    [String(active.id)],
                ));
            }
            return;
        }

        // --- ของใหม่จาก sidebar ---
        if (overData?.acceptDrops) {
            if (activeData.type === 'idea') {
                toast.error("ไอเดียซ้อนกันไม่ได้");
                return;
            }
            const incomingRefId = activeData.id;
            setItems(prev => {
                const targetIdea = prev.find(i => i.id === over.id);
                if (targetIdea && isDuplicate(targetIdea, incomingRefId)) {
                    toast.error("มีอยู่ในไอเดียนี้แล้ว");
                    return prev;
                }
                const newItem = {
                    id: crypto.randomUUID(),
                    type: activeData.type,
                    referenceId: incomingRefId,
                    title: activeData.title,
                    content: activeData.content,
                    role: activeData.role,
                };
                return prev.map(item => item.id === over.id
                    ? { ...item, children: [...(item.children || []), newItem] }
                    : item
                );
            });
            return;
        }

        if (cellMatch) {
            const [, laneId, beatIndexStr] = overId.split(':');
            const beatIndex = Number(beatIndexStr);
            const newItem = {
                id: crypto.randomUUID(),
                type: activeData.type,
                referenceId: activeData.id,
                title: activeData.title,
                content: activeData.content,
                role: activeData.role,
                laneId,
                beatIndex,
                children: [],
                links: [],
            };
            setItems(prev => [...prev, newItem]);

            if (activeData.type === 'idea' && activeData.id) {
                updateIdea(activeData.id, { isUsed: true });
                setThreadSuggest({
                    ideaTitle: activeData.title || "ไอเดียนี้",
                    selectedThreadId: threads[0]?.id ?? "",
                    newThreadTitle: activeData.title || "",
                    mode: "pick",
                    isLinking: false,
                });
                toast(
                    <ThreadSuggestToast
                        ideaTitle={activeData.title || "ไอเดียนี้"}
                        threads={threads}
                        novelId={novelId}
                        eventId={eventId}
                        onDismiss={() => toast.dismiss("thread-suggest")}
                    />,
                    { id: "thread-suggest", duration: 8000, unstyled: true, classNames: { toast: "w-full" } }
                );
            }
        }
    };

    const handleSetColor = (id: string, color: string | null) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, color } : item));
    };

    // เหตุการณ์สำคัญ (mock) — เก็บ label ใน canvas node, auto-save เดิมจัดการต่อ
    const handleSetKeyMoment = (id: string, label: string | null) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, keyMomentLabel: label } : item));
    };

    // ปักหมุดการ์ดว่าเป็น "คำบรรยาย/Narrator" (ไม่มีฉาก ไม่มีตัวละครร่วม) — เก็บใน canvas node เหมือน keyMoment, ไม่ต้องเพิ่มคอลัมน์ DB
    const handleSetNarration = (id: string, isNarration: boolean) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, isNarration } : item));
    };

    const handleRemoveItem = async (id: string) => {
        const removedItem = items.find(item => item.id === id);
        setItems((prev) => prev.filter((item) => item.id !== id));
        if (removedItem?.type === 'idea' && removedItem?.referenceId) {
            await updateIdea(removedItem.referenceId, { isUsed: false });
        }
    };

    const handleAddStickyNote = useCallback(() => {
        const newNote = {
            id: crypto.randomUUID(),
            type: 'sticky-note',
            title: 'Note',
            content: '',
            laneId: lanes_[0]?.id,
            beatIndex: beatCount,
            links: [],
        };
        setItems(prev => [...prev, newNote]);
        toast.success("เพิ่ม Sticky Note แล้ว");
    }, [lanes_, beatCount]);

    const handleExport = () => {
        // จัดกลุ่ม note (idea_note) ตามการ์ด
        const notesByItem = new Map<string, SceneElementDetails[]>();
        ideaNotes.forEach(n => {
            if (!n.canvasItemId) return;
            const arr = notesByItem.get(n.canvasItemId) ?? [];
            arr.push(n);
            notesByItem.set(n.canvasItemId, arr);
        });

        const exportData = {
            exportedAt: new Date().toISOString(),
            novelId,
            eventId,
            totalItems: items.length,
            chapters,          // ตอน (ช่วงจังหวะ)
            lanes: lanes_,
            items: items.map(item => ({
                id: item.id,
                type: item.type,
                title: item.title,
                content: item.content,
                color: item.color ?? null,
                keyMomentLabel: item.keyMomentLabel ?? null,
                isNarration: item.isNarration ?? false,
                referenceId: item.referenceId ?? null,
                laneId: item.laneId,
                beatIndex: item.beatIndex,
                links: item.links,
                children: item.children?.map((child: any) => ({
                    id: child.id, type: child.type, title: child.title, content: child.content, referenceId: child.referenceId,
                    // รายละเอียดฉากของ element ลูก (บทบาท/สถานะ ฯลฯ)
                    detail: elementDetailsMap.get(`${item.id}-${child.type}-${child.referenceId || child.id}`) ?? null,
                })),
                // ปมเรื่องที่ผูกกับการ์ดนี้ในฉากนี้
                threads: (cardBeats.get(item.id) ?? []).map(b => ({ threadId: b.threadId, title: b.title, role: b.role, color: b.color })),
                // โน้ตบนการ์ด
                notes: notesByItem.get(item.id) ?? [],
            })),
            // เส้น "ทำไมถึงทำแบบนี้" (ancestor / เหตุผล)
            ancestorConnections,
            // ปมเรื่องทั้งหมดของนิยาย (พร้อม beats ทุกจุด)
            threads: threadState.map(t => ({
                id: t.id, title: t.title, type: t.type, status: t.status, importance: t.importance, color: t.color, note: t.note,
                beats: t.beats.map(b => ({ id: b.id, eventId: b.eventId, canvasItemId: b.canvasItemId, role: b.role, note: b.note })),
            })),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `plot-board-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Export Playground สำเร็จ!');
    };

    // Export Markdown — ใช้ lib/story-format.ts (ย้าย logic ออกไปแล้ว)
    const handleExportMarkdown = () => {
        const format = buildSceneFormat({
            event: event ?? { id: eventId },
            items,
            lanes: lanes_,
            threads: threadState,
            eventId,
            elementDetails: elementDetailsMap,
            ideaNotes,
        });
        const md = renderSceneMarkdown(format);

        const blob = new Blob([md], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `scene-${(event?.title || "export").replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Export Markdown สำเร็จ!");
    };

    // anchor เส้นที่ขอบการ์ด (ฝั่งที่หันเข้าหากัน) — เส้นวิ่งใน gutter ระหว่างช่อง ไม่พาดหน้าการ์ด
    const edgeAnchors = (
        a: { x: number; y: number; w: number; h: number },
        b: { x: number; y: number; w: number; h: number },
    ) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= Math.abs(dy)) {
            const dir = dx >= 0 ? 1 : -1;
            return {
                start: { x: a.x + dir * (a.w / 2), y: a.y },
                end: { x: b.x - dir * (b.w / 2), y: b.y },
            };
        }
        const dir = dy >= 0 ? 1 : -1;
        return {
            start: { x: a.x, y: a.y + dir * (a.h / 2) },
            end: { x: b.x, y: b.y - dir * (b.h / 2) },
        };
    };

    // เส้นเชื่อม — node ที่มีหลายเส้นบนขอบเดียวกัน กระจายจุดยึด (fan-out) ไม่ให้เสียบจุดเดียวจนพันกัน
    const connections = (() => {
        // 1. รวม edge ทั้งหมดที่วาดได้
        const edges: Array<{
            sourceId: string; targetId: string; link: CanvasLink;
            sPos: { x: number; y: number; w: number; h: number };
            tPos: { x: number; y: number; w: number; h: number };
        }> = [];
        items.forEach(source => {
            const sPos = linkPositions.get(source.id);
            if (!sPos) return;
            (source.links || []).forEach((raw: any) => {
                const link = normalizeLink(raw);
                const tPos = linkPositions.get(link.targetId);
                if (!tPos) return;
                edges.push({ sourceId: source.id, targetId: link.targetId, link, sPos, tPos });
            });
        });

        // 2. นับดีกรี: target มีหลาย source = รวม (many→1), source มีหลาย target = แตก (1→many, mirror)
        const inCount = new Map<string, number>();
        const outCount = new Map<string, number>();
        edges.forEach(e => {
            inCount.set(e.targetId, (inCount.get(e.targetId) ?? 0) + 1);
            outCount.set(e.sourceId, (outCount.get(e.sourceId) ?? 0) + 1);
        });
        const GAP = GUTTER_WIDTH / 2; // ระยะบัส (แนวตั้งที่เส้นมารวม) ห่างจากขอบการ์ด

        // clamp Y ให้จุดเข้าอยู่ในตัวการ์ด (เข้าใกล้กลาง ไม่หลุดขอบ) — ใช้กับ mergeY ของ chain
        const clampY = (y: number, pos: { y: number; h: number }) =>
            Math.max(pos.y - pos.h / 2 + 10, Math.min(pos.y + pos.h / 2 - 10, y));

        const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;

        // --- occupancy: ดูการ์ดข้างเคียง 4 ทิศ (ซ้าย/ขวา = จังหวะ ±1 เลนเดียว, บน/ล่าง = จังหวะเดียวเลนติดกัน) ---
        // ฝั่งที่มีการ์ดบัง → ไม่ออก anchor ฝั่งนั้น ย้ายไปฝั่งว่างแทน
        type Side = 'right' | 'left' | 'up' | 'down';
        const laneOrder = new Map<string, number>(lanes_.map((l, i) => [l.id, i]));
        // ทิศที่ควรออก ตัดสินจาก beat/lane จริง (ไม่ใช่พิกเซลกึ่งกลาง ที่เพี้ยนเมื่อการ์ดสูงไม่เท่ากัน)
        // คนละจังหวะ → แนวนอน; จังหวะเดียวกัน → แนวตั้งตามลำดับเลน
        const sideToCard = (from: any, to: any): Side => {
            if (!from || !to) return 'right';
            if (to.beatIndex !== from.beatIndex) return to.beatIndex > from.beatIndex ? 'right' : 'left';
            const dl = (laneOrder.get(to.laneId) ?? 0) - (laneOrder.get(from.laneId) ?? 0);
            return dl >= 0 ? 'down' : 'up';
        };
        const SIDE_VEC: Record<Side, [number, number]> = { right: [1, 0], left: [-1, 0], up: [0, -1], down: [0, 1] };
        const anchorOn = (pos: { x: number; y: number; w: number; h: number }, side: Side) =>
            side === 'right' ? { x: pos.x + pos.w / 2, y: pos.y }
                : side === 'left' ? { x: pos.x - pos.w / 2, y: pos.y }
                    : side === 'up' ? { x: pos.x, y: pos.y - pos.h / 2 }
                        : { x: pos.x, y: pos.y + pos.h / 2 };

        // Y ที่เส้นมารวม: many→1 = เฉลี่ย Y ของ source ทั้งหมด (clamp เข้า target), 1→many = เฉลี่ย Y ของ target (clamp เข้า source)
        const targetMergeY = new Map<string, number>();
        const sourceMergeY = new Map<string, number>();
        edges.forEach(e => {
            if ((inCount.get(e.targetId) ?? 0) > 1 && !targetMergeY.has(e.targetId)) {
                const ys = edges.filter(x => x.targetId === e.targetId).map(x => x.sPos.y);
                targetMergeY.set(e.targetId, clampY(avg(ys), e.tPos));
            }
            if ((outCount.get(e.sourceId) ?? 0) > 1 && !sourceMergeY.has(e.sourceId)) {
                const ys = edges.filter(x => x.sourceId === e.sourceId).map(x => x.tPos.y);
                sourceMergeY.set(e.sourceId, clampY(avg(ys), e.sPos));
            }
        });

        const built = edges.map((e) => {
            const converge = (inCount.get(e.targetId) ?? 0) > 1; // รวมเข้า target
            const split = !converge && (outCount.get(e.sourceId) ?? 0) > 1; // แตกจาก source (mirror)

            const sItem = items.find((x: any) => x.id === e.sourceId);
            const tItem = items.find((x: any) => x.id === e.targetId);

            let points: Array<{ x: number; y: number }>;
            if (converge || split) {
                // chain รวม/แตก: บัสแนวตั้งที่ระดับ mergeY (คงพฤติกรรมเดิม)
                const dir = e.tPos.x >= e.sPos.x ? 1 : -1;
                const aX = e.sPos.x + dir * e.sPos.w / 2;
                const bX = e.tPos.x - dir * e.tPos.w / 2;
                let busX: number, aY: number, bY: number;
                if (converge) { busX = bX - dir * GAP; aY = e.sPos.y; bY = targetMergeY.get(e.targetId)!; }
                else { busX = aX + dir * GAP; aY = sourceMergeY.get(e.sourceId)!; bY = e.tPos.y; }
                points = [{ x: aX, y: aY }, { x: busX, y: aY }, { x: busX, y: bY }, { x: bX, y: bY }];
            } else if (sItem && tItem && sItem.beatIndex === tItem.beatIndex) {
                // จังหวะเดียวกัน (คอลัมน์เดียว) → ออกขวาทั้งคู่ แล้ววิ่งบัสในร่อง gutter ด้านขวา
                // ไม่ลากดิ่งผ่ากลางคอลัมน์ (จะทับการ์ดที่คั่นอยู่ระหว่าง source กับ target)
                const aX = e.sPos.x + e.sPos.w / 2;
                const bX = e.tPos.x + e.tPos.w / 2;
                const busX = Math.max(aX, bX) + GAP;
                // เยื้อง anchor เข้าหาการ์ดที่เชื่อม: จุดออกไปทาง target, จุดเข้ามาจากทาง source
                // กันไม่ให้ต้นศร (ออก) กับหัวศร (เข้า) ของการ์ดกลางตกจุดเดียวกัน
                const OFF = 14;
                const psY = clampY(e.sPos.y + Math.sign(e.tPos.y - e.sPos.y || 1) * OFF, e.sPos);
                const ptY = clampY(e.tPos.y + Math.sign(e.sPos.y - e.tPos.y || -1) * OFF, e.tPos);
                const ps = { x: aX, y: psY };
                const pt = { x: bX, y: ptY };
                points = [ps, { x: busX, y: psY }, { x: busX, y: ptY }, pt];
            } else {
                // cross-beat = แนวนอน → หักมุมฉากเสมอ ไม่มีสาขาแยก
                //
                // เดิมมีสาขา "ถ้าการ์ดซ้อน y กันให้ลากตรงที่ y เฉลี่ย" ซึ่งพังสองชั้น:
                //  1. เป็นสวิตช์ ไม่ใช่การไล่ระดับ — การ์ดปลายทางสูงขึ้นจนซ้อนแค่ 1px
                //     รูปเส้นเปลี่ยนจากหักมุม 5 จุดเป็นเส้นตรง 2 จุดทันที กระโดดทั้งเส้น
                //  2. y เฉลี่ยคำนวณจากการ์ด "ทั้งสองใบ" จุดที่เส้นออกจากต้นทางจึงขยับ
                //     เมื่อปลายทางยาวขึ้น ทั้งที่ไม่มีใครแตะต้นทางเลย
                //
                // รูปหักมุมยุบเป็นเส้นตรงเองอยู่แล้วเมื่อกึ่งกลาง y ตรงกัน (ขาแนวตั้งยาวศูนย์)
                // จึงไม่ต้องมีสาขาแยก และ ps อ้าง e.sPos อย่างเดียว — ปลายทางเปลี่ยนไม่กระทบจุดเริ่ม
                const sSide = sideToCard(sItem, tItem);
                const tSide = sideToCard(tItem, sItem);
                const ps = anchorOn(e.sPos, sSide);
                const pt = anchorOn(e.tPos, tSide);
                const s1 = { x: ps.x + SIDE_VEC[sSide][0] * GAP, y: ps.y };
                const t1 = { x: pt.x + SIDE_VEC[tSide][0] * GAP, y: pt.y };
                points = [ps, s1, { x: t1.x, y: s1.y }, t1, pt];
            }

            // ถ้าหัวลูกศร (จุดสุดท้าย) ตกทับกรอบการ์ดอื่น (ไม่ใช่ต้น/ปลายทาง) → ขยับ y ออก
            // ทิศขยับอ้างอิง source: source อยู่บน (y น้อยกว่า) → ขยับขึ้น, อยู่ล่าง → ขยับลง
            const tip = points[points.length - 1];
            const hit = [...linkPositions.entries()].find(([id, p]) =>
                id !== e.sourceId && id !== e.targetId &&
                tip.x > p.x - p.w / 2 && tip.x < p.x + p.w / 2 &&
                tip.y > p.y - p.h / 2 && tip.y < p.y + p.h / 2);
            if (hit) {
                const p = hit[1];
                const sourceAbove = e.sPos.y < e.tPos.y;
                const newY = sourceAbove ? p.y - p.h / 2 - 8 : p.y + p.h / 2 + 8;
                points[points.length - 1] = { x: tip.x, y: newY };
                points[points.length - 2] = { x: points[points.length - 2].x, y: newY };
            }

            return { e, points };
        });

        // จัด track: เส้นแนวตั้งที่วิ่งในร่องเดียวกัน (x ใกล้กัน + y ซ้อน) → ดันให้ห่างกันขั้นต่ำ ไม่ทับ
        const MIN_GUTTER_GAP = 16;
        const vsegs: Array<{ pathIdx: number; i: number; x: number; y0: number; y1: number }> = [];
        built.forEach((b, pathIdx) => {
            for (let i = 0; i < b.points.length - 1; i++) {
                const a = b.points[i], c = b.points[i + 1];
                if (Math.abs(a.x - c.x) < 0.5 && Math.abs(a.y - c.y) > 1)
                    vsegs.push({ pathIdx, i, x: a.x, y0: Math.min(a.y, c.y), y1: Math.max(a.y, c.y) });
            }
        });
        vsegs.sort((a, b) => a.x - b.x || a.y0 - b.y0);
        const placed: Array<{ x: number; y0: number; y1: number }> = [];
        vsegs.forEach(v => {
            let x = v.x;
            let bump = true;
            while (bump) {
                bump = false;
                for (const p of placed) {
                    if (v.y0 < p.y1 && v.y1 > p.y0 && Math.abs(x - p.x) < MIN_GUTTER_GAP) {
                        x = p.x + MIN_GUTTER_GAP;
                        bump = true;
                    }
                }
            }
            const dx = x - v.x;
            if (dx !== 0) {
                const pts = built[v.pathIdx].points;
                pts[v.i] = { ...pts[v.i], x: pts[v.i].x + dx };
                pts[v.i + 1] = { ...pts[v.i + 1], x: pts[v.i + 1].x + dx };
            }
            placed.push({ x, y0: v.y0, y1: v.y1 });
        });

        // หัวลูกศรต้องเข้าทางด้านที่เส้นวิ่งมาถึงจริง ๆ
        //
        // ด้านของ anchor ถูกเลือกไว้ตั้งแต่ต้นจาก beatIndex แต่ pass "จัด track" ข้างบนดัน
        // เส้นแนวตั้งไปทางขวาได้เรื่อย ๆ เส้นที่เคยอยู่ซ้ายของการ์ดปลายทางจึงไปโผล่ขวา
        // ขณะที่จุดจบยังปักที่ขอบซ้าย — ขาสุดท้ายเลยลากผ่ากลางการ์ดทั้งใบ
        // เช็คทีหลังเพราะต้องรู้ตำแหน่งจริงหลังโดนดันแล้ว
        built.forEach(({ e, points }) => {
            const n = points.length;
            if (n < 2) return;
            const tip = points[n - 1];
            const from = points[n - 2];
            const t = e.tPos;
            if (Math.abs(from.y - tip.y) < 0.5) {
                // ขาสุดท้ายแนวนอน → ลงที่ขอบซ้าย/ขวาอันที่ใกล้ทางเข้ากว่า
                const nearX = from.x > t.x ? t.x + t.w / 2 : t.x - t.w / 2;
                if (Math.abs(nearX - tip.x) > 0.5) {
                    // y ต้องอยู่ในช่วงของการ์ดด้วย ไม่งั้น anchor ลอยเลยขอบไป
                    const y = clampY(tip.y, t);
                    points[n - 1] = { x: nearX, y };
                    points[n - 2] = { ...from, y };
                }
            } else if (Math.abs(from.x - tip.x) < 0.5) {
                // ขาสุดท้ายแนวตั้ง → ลงที่ขอบบน/ล่างอันที่ใกล้ทางเข้ากว่า
                const nearY = from.y > t.y ? t.y + t.h / 2 : t.y - t.h / 2;
                if (Math.abs(nearY - tip.y) > 0.5) points[n - 1] = { ...tip, y: nearY };
            }
        });

        // เส้นหลายเส้นที่รวมเข้าการ์ดเดียวกันใช้บัสร่วมกัน ช่วงท้ายจึงทับกันสนิท —
        // ป้ายชนิดเดียวกันซ้ำที่เดิมไม่ได้บอกอะไรเพิ่ม วาดครั้งเดียวพอ
        // (ป้ายที่ผู้ใช้พิมพ์เองไม่ถือว่าซ้ำ ต่อให้ตกตำแหน่งเดียวกัน)
        const drawn = new Set<string>();
        return built.map(({ e, points }) => {
            const a = labelAnchor(points);
            const key = `${e.link.kind}@${Math.round(a.x / 8)},${Math.round(a.y / 8)}`;
            const duplicate = !e.link.label && drawn.has(key);
            if (!e.link.label) drawn.add(key);
            return (
                <OrthoLine
                    key={`${e.sourceId}-${e.targetId}`}
                    points={points}
                    kind={e.link.kind} label={e.link.label} hideLabel={duplicate}
                    onClick={() => setEditingLink({ sourceId: e.sourceId, targetId: e.targetId })}
                />
            );
        });
    })();

    const ancestorLines = ancestorConnections.map(conn => {
        const source = items.find(i => i.referenceId === conn.sourceIdeaId || i.id === conn.sourceIdeaId);
        const target = items.find(i => i.referenceId === conn.targetIdeaId || i.id === conn.targetIdeaId);
        if (!source || !target) return null;
        const sPos = linkPositions.get(source.id);
        const tPos = linkPositions.get(target.id);
        if (!sPos || !tPos) return null;
        const { start, end } = edgeAnchors(sPos, tPos);
        // ลูกศรชี้กลับไปจุด start (ไอเดียต้นทาง) เหมือนพฤติกรรมเดิม — ConnectionLine วาดหัวลูกศรที่ end เสมอ จึงสลับด้าน
        return <ConnectionLine key={`ancestor-${conn.id}`} start={end} end={start} kind="ancestor" label={conn.label} />;
    });

    return (
        <DndContext
            id="plot-playground-board"
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full">
                {/* Sidebar */}
                <div
                    className={`border-r bg-muted/10 overflow-hidden flex flex-col shrink-0 transition-[width] duration-300 ease-in-out ${sidebarCollapsed ? "w-9" : "w-60"}`}
                >
                    {sidebarCollapsed ? (
                        <div className="flex flex-col items-center pt-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="แสดงแถบทรัพยากร"
                                onClick={() => setSidebarCollapsed(false)}
                            >
                                <PanelLeftOpen className="w-4 h-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="w-60 h-full animate-in fade-in duration-300">
                            <ResourceSidebar
                                characters={characters}
                                locations={locations}
                                ideas={ideas}
                                factions={factions}
                                onCollapse={() => setSidebarCollapsed(true)}
                            />
                        </div>
                    )}
                </div>

                {/* Storyboard grid area */}
                <div className="flex-1 min-w-0 relative bg-muted/30 min-h-[400px] flex flex-col">
                    {/* Linking Mode Banner */}
                    {linkingSourceId && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-3 bg-[var(--forge-amber)] text-black px-4 py-2 rounded-lg shadow-lg border border-black/20">
                                <Link2 className="w-4 h-4 animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">โหมดเชื่อมเส้น</span>
                                    <span className="text-xs opacity-90">
                                        คลิกการ์ดที่จะเชื่อม ({items.find(i => i.id === linkingSourceId)?.links?.length || 0} เส้นแล้ว)
                                    </span>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <Button size="sm" variant="ghost" className="h-7 bg-black/10 hover:bg-black/20 text-black border-0" onClick={handleFinishLinking}>
                                        <Check className="w-3.5 h-3.5 mr-1" />เสร็จ
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 bg-black/10 hover:bg-black/20 text-black border-0" onClick={handleCancelLink}>
                                        <X className="w-3.5 h-3.5 mr-1" />ยกเลิก
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Toolbar — relative+z-40 ทำให้เป็น stacking context ของตัวเอง อยู่เหนือ sticky header ของกริด (z-30)
                        เดิมมีแค่ "z-30" แบบ static เลยไม่มีผล เพราะ z-index ต้องมาคู่กับ position; backdrop-blur เองก็ดัน
                        สร้าง stacking context ใหม่โดยไม่ตั้งใจ ทำให้ panel ลูก (z-50) ถูกขังอยู่ต่ำกว่ากริดที่อยู่นอก context นั้น */}
                    <div className="relative z-40 flex items-center gap-2 px-3 py-2 border-b bg-background/85 backdrop-blur">
                        <div className="relative">
                            <Button variant={showNavigator ? "secondary" : "ghost"} size="icon" className="h-8 w-8"
                                onClick={() => setShowNavigator(!showNavigator)} aria-label="สารบัญ" title="สารบัญ">
                                <List className="h-4 w-4" />
                            </Button>
                            {showNavigator && (
                                <div className="absolute top-full left-0 mt-2 w-64 bg-popover text-popover-foreground rounded-lg shadow-xl border overflow-hidden flex flex-col max-h-[60vh] z-50">
                                    <div className="p-2 border-b bg-muted/30 font-semibold text-xs text-muted-foreground flex items-center gap-2">
                                        <Navigation className="w-3 h-3" />
                                        <span>ไปยังการ์ด</span>
                                        <Button variant="ghost" size="icon" className="h-4 w-4 ml-auto" onClick={() => setShowNavigator(false)}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="overflow-y-auto p-1 space-y-1">
                                        {items.length === 0 && (
                                            <div className="p-4 text-center text-xs text-muted-foreground">ยังไม่มีการ์ดบนกระดาน</div>
                                        )}
                                        {['idea', 'character', 'faction', 'location', 'sticky-note'].map(type => {
                                            const typeItems = items.filter(i => i.type === type);
                                            if (typeItems.length === 0) return null;
                                            return (
                                                <div key={type} className="mb-2 last:mb-0">
                                                    <div className="px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground bg-muted/20 rounded-sm mb-0.5">
                                                        {type === 'sticky-note' ? 'Notes' : type + 's'}
                                                    </div>
                                                    {typeItems.map(item => (
                                                        <button key={item.id} onClick={() => handleCenterOnItem(item.id)}
                                                            className="w-full text-left px-2 py-1.5 hover:bg-muted rounded text-xs flex items-center gap-2 transition-colors group">
                                                            <div className={`w-2 h-2 rounded-full shrink-0 ${type === 'character' ? 'bg-blue-400' : type === 'location' ? 'bg-green-400' : type === 'idea' ? 'bg-yellow-400' : 'bg-purple-400'}`} />
                                                            <span className="truncate group-hover:text-primary transition-colors">
                                                                {item.title || (type === 'sticky-note' ? (item.content?.slice(0, 15) || 'Empty Note') : 'Untitled')}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAddStickyNote} aria-label="เพิ่ม Sticky Note" title="เพิ่ม Sticky Note">
                            <StickyNote className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleAutoArrange} aria-label='เรียง beat ตาม "นำไปสู่"' title='เรียง beat ตาม "นำไปสู่"'>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleAddLane} title="เพิ่มเลนใหม่">
                            <Rows3 className="h-4 w-4" />เพิ่มเลน
                        </Button>

                        <div className="flex-1" />

                        {/* สถานะบันทึก — autosave debounce 2 วิ ทำงานอยู่แล้ว ไม่มีปุ่ม Save */}
                        <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
                            {isSaving ? "กำลังบันทึก…" : lastSaved ? "บันทึกแล้ว" : ""}
                        </span>

                        <CreateIdeaDialog
                            novelId={novelId}
                            extraContent={
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">เลน</label>
                                        <select
                                            value={newIdeaLaneId || lanes_[0]?.id || ''}
                                            onChange={(e) => setNewIdeaLaneId(e.target.value)}
                                            className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                                        >
                                            {lanes_.map((l) => (
                                                <option key={l.id} value={l.id}>{l.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium">วางในจังหวะ</label>
                                        <div className="flex items-center chamfered-sm border border-border/60 overflow-hidden text-xs w-fit">
                                            <button
                                                type="button"
                                                disabled={beatCount === 0}
                                                onClick={() => setNewIdeaBeat('latest')}
                                                title={beatCount === 0 ? "ยังไม่มีจังหวะในฉากนี้ — สร้างจังหวะใหม่ก่อน" : undefined}
                                                className={cn(
                                                    "h-8 px-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                                                    newIdeaBeat === 'latest' ? "bg-[var(--forge-amber)]/15 text-[var(--forge-amber)] font-medium" : "text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                จังหวะล่าสุด
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setNewIdeaBeat('new')}
                                                className={cn("h-8 px-3 border-l border-border/60 transition-colors", newIdeaBeat === 'new' ? "bg-[var(--forge-amber)]/15 text-[var(--forge-amber)] font-medium" : "text-muted-foreground hover:bg-muted")}
                                            >
                                                จังหวะใหม่
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            }
                            onIdeaCreated={(idea) => {
                                const newItem = {
                                    id: crypto.randomUUID(),
                                    type: 'idea',
                                    referenceId: idea.id,
                                    title: idea.title,
                                    content: idea.content,
                                    laneId: newIdeaLaneId || lanes_[0]?.id,
                                    beatIndex: newIdeaBeat === 'latest' ? Math.max(0, beatCount - 1) : beatCount,
                                    children: [],
                                    links: [],
                                };
                                setItems(prev => [...prev, newItem]);
                                updateIdea(idea.id, { isUsed: true });
                            }}
                            trigger={
                                <Button size="sm" className="h-8 gap-1.5">
                                    <Plus className="w-4 h-4" />ไอเดียใหม่
                                </Button>
                            }
                        />

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="ส่งออก" title="ส่งออก">
                                    <Download className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleExport}>
                                    <Download className="w-4 h-4" />JSON (backup / re-import)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleExportMarkdown}>
                                    <FileText className="w-4 h-4" />Markdown (อ่านง่าย / ส่งให้ AI)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Grid viewport (scroll) */}
                    <div ref={viewportRef} id="canvas-viewport" className="flex-1 min-h-0 overflow-auto">
                        <div
                            ref={gridRef}
                            className="relative"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `${LABEL_WIDTH}px ${Array.from({ length: totalColumns }).map((_, i) => i < totalColumns - 1 ? `${COLUMN_WIDTH}px ${GUTTER_WIDTH}px` : `${COLUMN_WIDTH}px`).join(' ')}`,
                                gridTemplateRows: `30px 36px repeat(${lanes_.length}, auto)`,
                                width: 'max-content',
                                zoom: BOARD_ZOOM,
                            }}
                        >
                            {/* Chapter band row (ตอน) — gridRow 1 */}
                            <div
                                style={{ gridColumn: 1, gridRow: 1, width: LABEL_WIDTH }}
                                className="sticky left-0 z-30 bg-background border-r border-b border-border/60 flex items-center px-2"
                            >
                                <ChapterPopover
                                    recentChapters={allChapters.slice(-3).reverse()}
                                    beatCount={beatCount}
                                    initial={{ name: `ตอนที่ ${nextChapterNumber}`, startBeat: 0, endBeat: Math.max(0, beatCount - 1) }}
                                    onSave={addChapter}
                                    trigger={
                                        <button
                                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--forge-amber)] transition-colors"
                                            title="แบ่งตอน"
                                        >
                                            <Plus className="w-3 h-3" /> แบ่งตอน
                                        </button>
                                    }
                                />
                            </div>
                            {chapterRanges.map((c) => (
                                <div
                                    key={`chapter-${c.id}`}
                                    style={{ gridColumn: `${beatGridCol(c.startBeat)} / ${beatGridCol(c.endBeat) + 2}`, gridRow: 1 }}
                                    className="border-b border-border/60 px-1 flex items-center"
                                >
                                    <ChapterPopover
                                        recentChapters={allChapters.filter(x => x.id !== c.id).slice(-3).reverse()}
                                        beatCount={beatCount}
                                        initial={{ name: c.name, startBeat: c.startBeat, endBeat: c.endBeat }}
                                        onSave={(v) => updateChapter(c.id, v)}
                                        onDelete={() => removeChapter(c.id)}
                                        trigger={
                                            <button
                                                title="แก้ไขตอน"
                                                className="w-full h-[22px] rounded-[4px] bg-[var(--forge-amber)]/12 border border-[var(--forge-amber)]/30 hover:bg-[var(--forge-amber)]/20 transition-colors flex items-center justify-center px-2"
                                            >
                                                <span className="text-[10px] font-medium text-foreground/90 truncate">{c.name}</span>
                                            </button>
                                        }
                                    />
                                </div>
                            ))}

                            {/* Header row: จังหวะ/beat */}
                            <div
                                style={{ gridColumn: 1, gridRow: 2, width: LABEL_WIDTH }}
                                className="sticky left-0 top-0 z-30 bg-background border-r border-b border-border/60 flex items-center px-3"
                            >
                                <span className="font-technical text-[9px] uppercase tracking-[0.14em] text-muted-foreground">เลน \ จังหวะ</span>
                            </div>
                            {Array.from({ length: totalColumns }).map((_, beatIndex) => (
                                <Fragment key={`beat-head-${beatIndex}`}>
                                    <div
                                        style={{ gridColumn: beatGridCol(beatIndex), gridRow: 2, width: COLUMN_WIDTH }}
                                        className={cn(
                                            "sticky top-0 z-20 bg-background border-r border-b border-border/60 flex items-center justify-center gap-1.5",
                                            beatIndex === beatCount && "border-dashed"
                                        )}
                                    >
                                        {beatIndex !== beatCount && (
                                            <span className="h-1 w-1 rounded-full bg-[var(--forge-amber)]/70" />
                                        )}
                                        <span className={cn(
                                            "font-technical text-[10px] uppercase tracking-[0.12em] tabular-nums",
                                            beatIndex === beatCount ? "text-muted-foreground/40" : "text-muted-foreground"
                                        )}>
                                            {beatIndex === beatCount ? "+" : `จังหวะ ${String(beatIndex + 1).padStart(2, "0")}`}
                                        </span>
                                    </div>
                                    {beatIndex < totalColumns - 1 && (
                                        <div
                                            style={{ gridColumn: beatGridCol(beatIndex) + 1, gridRow: 2, width: GUTTER_WIDTH }}
                                            className="sticky top-0 z-20 bg-muted/20 border-b border-border/30"
                                        />
                                    )}
                                </Fragment>
                            ))}

                            {lanes_.map((lane, laneIndex) => {
                                const laneColor = lane.color || LANE_COLORS[laneIndex % LANE_COLORS.length];
                                return (
                                <Fragment key={lane.id}>
                                    <LaneLabel
                                        lane={lane}
                                        laneIndex={laneIndex}
                                        color={laneColor}
                                        onRename={handleRenameLane}
                                        onRemove={handleRemoveLane}
                                        onSetColor={handleSetLaneColor}
                                        canRemove={lanes_.length > 1}
                                    />
                                    {Array.from({ length: totalColumns }).map((_, beatIndex) => {
                                        const cellItems = items.filter(i => i.laneId === lane.id && i.beatIndex === beatIndex);
                                        return (
                                            <Fragment key={beatIndex}>
                                            <BeatCell
                                                laneId={lane.id}
                                                beatIndex={beatIndex}
                                                laneIndex={laneIndex}
                                                isTrailing={beatIndex === beatCount}
                                                laneColor={laneColor}
                                                isDrafting={
                                                    (draftCell?.laneId === lane.id && draftCell?.beatIndex === beatIndex) ||
                                                    (creatingCell?.laneId === lane.id && creatingCell?.beatIndex === beatIndex)
                                                }
                                                onAddIdea={() => setDraftCell({ laneId: lane.id, beatIndex })}
                                            >
                                                {cellItems.map(item => (
                                                    <DraggableCanvasItem
                                                        key={item.id}
                                                        item={item}
                                                        onRemove={() => handleRemoveItem(item.id)}
                                                        onRemoveChild={(childId) => handleRemoveChild(item.id, childId)}
                                                        onLinkStart={handleStartLink}
                                                        onLinkComplete={linkingSourceId && linkingSourceId !== item.id ? handleCompleteLink : undefined}
                                                        isLinkingSource={linkingSourceId === item.id}
                                                        isConnectSource={connectingSourceId === item.id}
                                                        isConnectTarget={!!connectingSourceId && connectOverId === item.id}
                                                        elementDetails={elementDetailsMap}
                                                        onEditChild={handleEditChild}
                                                        ideaNotes={ideaNotes}
                                                        onQuickAddNote={handleQuickAddNote}
                                                        onDeleteNote={handleDeleteNote}
                                                        onReorderNotes={handleReorderNotes}
                                                        novelId={novelId}
                                                        onSetAncestor={item.type === 'idea' ? () => handleOpenAncestorDialog(item) : undefined}
                                                        ancestorConnections={item.type === 'idea' ? ancestorConnections
                                                            .filter(c => c.sourceIdeaId === (item.referenceId || item.id))
                                                            .map(c => {
                                                                const targetIdea = ideas.find((idea: any) => idea.id === c.targetIdeaId);
                                                                const targetNotes = ancestorIdeaNotesMap.get(c.targetIdeaId) || [];
                                                                return {
                                                                    ...c,
                                                                    targetIdeaTitle: targetIdea?.title || null,
                                                                    targetIdeaContent: targetIdea?.content || null,
                                                                    targetIdeaCategory: targetIdea?.category || null,
                                                                    targetIdeaNotes: targetNotes.length > 0 ? targetNotes : undefined,
                                                                };
                                                            }) : undefined}
                                                        onRemoveAncestor={item.type === 'idea' ? handleRemoveAncestor : undefined}
                                                        sceneId={eventId}
                                                        characters={characters}
                                                        novelDummyNames={novelDummyNames}
                                                        factions={factions}
                                                        ideas={ideas}
                                                        onAddChild={handleAddChild}
                                                        onUpdateChild={handleUpdateChild}
                                                        onPromoteDummy={handlePromoteDummy}
                                                        onDetailSaved={handleDetailSaved}
                                                        onSetColor={(c) => handleSetColor(item.id, c)}
                                                        onSetKeyMoment={item.type === 'idea' ? (label) => handleSetKeyMoment(item.id, label) : undefined}
                                                        onSetNarration={item.type === 'idea' ? (v) => handleSetNarration(item.id, v) : undefined}
                                                        threadBeats={item.type === 'idea' ? (cardBeats.get(item.id) ?? []) : undefined}
                                                        onOpenThreadBind={item.type === 'idea' ? () => setThreadBindItem(item) : undefined}
                                                        onMeasureRef={registerItemRef}
                                                    />
                                                ))}

                                                {/* สร้างไอเดีย inline: การ์ดร่าง → skeleton ระหว่างรอ → ปุ่ม + (โผล่ตอน hover ช่อง) */}
                                                {creatingCell?.laneId === lane.id && creatingCell?.beatIndex === beatIndex ? (
                                                    <CreatingIdeaSkeleton title={creatingCell.title} />
                                                ) : draftCell?.laneId === lane.id && draftCell?.beatIndex === beatIndex ? (
                                                    <DraftIdeaCard
                                                        onCommit={handleCommitDraft}
                                                        onCancel={() => setDraftCell(null)}
                                                    />
                                                ) : beatIndex !== beatCount ? (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setDraftCell({ laneId: lane.id, beatIndex }); }}
                                                        onPointerDown={(e) => e.stopPropagation()}
                                                        className="opacity-0 group-hover/cell:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-[var(--forge-amber)] border border-dashed border-border/40 hover:border-[var(--forge-amber)]/50 rounded py-1"
                                                    >
                                                        <Plus className="w-3 h-3" /> ไอเดีย
                                                    </button>
                                                ) : null}
                                            </BeatCell>
                                            {beatIndex < totalColumns - 1 && (
                                                <div
                                                    key={`gutter-${beatIndex}`}
                                                    style={{ gridColumn: beatGridCol(beatIndex) + 1, gridRow: laneIndex + 3, width: GUTTER_WIDTH, background: hexA(laneColor, 0.05) }}
                                                    className="min-h-[140px] border-b border-border/30"
                                                />
                                            )}
                                        </Fragment>
                                        );
                                    })}
                                </Fragment>
                                );
                            })}

                            {/* เส้นเชื่อม overlay */}
                            <svg
                                className="absolute inset-0 pointer-events-none"
                                style={{ width: '100%', height: '100%', overflow: 'visible', zIndex: 10 }}
                            >
                                {connections}
                                {ancestorLines}
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
                {activeDragItem ? <CanvasItem item={activeDragItem} isOverlay /> : null}
            </DragOverlay>

            {/* Scene Element Detail Edit Dialog */}
            {editingChild && (
                <SceneElementDetailDialog
                    open={!!editingChild}
                    onOpenChange={(open) => !open && setEditingChild(null)}
                    elementType={editingChild.child.type}
                    elementId={editingChild.child.referenceId || editingChild.child.refId || editingChild.child.id}
                    elementName={editingChild.child.title}
                    sceneId={eventId}
                    novelId={novelId}
                    canvasItemId={editingChild.canvasItemId}
                    existingDetail={elementDetailsMap.get(
                        `${editingChild.canvasItemId}-${editingChild.child.type}-${editingChild.child.referenceId || editingChild.child.refId || editingChild.child.id}`
                    )}
                    onSaved={handleDetailSaved}
                />
            )}

            {/* Link Edit Dialog */}
            {editingLink && (() => {
                const src = items.find(i => i.id === editingLink.sourceId);
                const tgt = items.find(i => i.id === editingLink.targetId);
                const link = (src?.links || []).map(normalizeLink).find((l: CanvasLink) => l.targetId === editingLink.targetId);
                if (!src || !tgt || !link) return null;
                return (
                    <LinkEditDialog
                        sourceTitle={src.title}
                        targetTitle={tgt.title}
                        link={link}
                        onSave={(patch) => { handleUpdateLink(editingLink.sourceId, editingLink.targetId, patch); setEditingLink(null); }}
                        onDelete={() => { handleUnlink(editingLink.sourceId, editingLink.targetId); setEditingLink(null); toast.success("ลบเส้นเชื่อมแล้ว"); }}
                        onClose={() => setEditingLink(null)}
                    />
                );
            })()}

            {/* ผูกปมกับการ์ด */}
            {threadBindItem && (
                <ThreadBindDialog
                    cardTitle={threadBindItem.title || "การ์ดนี้"}
                    threads={threadState}
                    bound={cardBeats.get(threadBindItem.id) ?? []}
                    onBind={(threadId, role) => handleBindThread(threadBindItem.id, threadId, role)}
                    onCreateAndBind={(title, role) => handleCreateAndBind(threadBindItem.id, title, role)}
                    onUnbind={handleUnbindThread}
                    onClose={() => setThreadBindItem(null)}
                />
            )}

            {/* Ancestor Idea Dialog */}
            <Dialog open={!!ancestorDialogItem} onOpenChange={(open) => !open && setAncestorDialogItem(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitBranchPlus className="w-5 h-5 text-blue-500" />
                            เชื่อมเหตุผล (Ancestor Idea)
                        </DialogTitle>
                        <DialogDescription>
                            เลือกไอเดียที่เป็นต้นเหตุ / แรงจูงใจ ของ &quot;{ancestorDialogItem?.title}&quot;
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input
                            placeholder="ค้นหาไอเดีย..."
                            value={ancestorSearch}
                            onChange={(e) => setAncestorSearch(e.target.value)}
                            className="w-full"
                        />
                        <Input
                            placeholder="เหตุผล (ไม่บังคับ) เช่น: ทำเพราะ..."
                            value={ancestorLabel}
                            onChange={(e) => setAncestorLabel(e.target.value)}
                            className="w-full text-sm"
                        />
                        <div className="max-h-60 overflow-y-auto space-y-1 border rounded-md p-2">
                            {ideas
                                .filter((idea: any) => {
                                    const currentId = ancestorDialogItem?.referenceId || ancestorDialogItem?.id;
                                    if (idea.id === currentId) return false;
                                    if (ancestorSearch) {
                                        return idea.title?.toLowerCase().includes(ancestorSearch.toLowerCase()) ||
                                            idea.content?.toLowerCase().includes(ancestorSearch.toLowerCase());
                                    }
                                    return true;
                                })
                                .map((idea: any) => (
                                    <button key={idea.id} onClick={() => handleCreateAncestor(idea.id)}
                                        className="w-full text-left p-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors flex items-start gap-2">
                                        <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium truncate">{idea.title}</p>
                                            {idea.content && (
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {typeof idea.content === 'string' ? idea.content : 'Rich text...'}
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            {ideas.filter((idea: any) => {
                                const currentId = ancestorDialogItem?.referenceId || ancestorDialogItem?.id;
                                if (idea.id === currentId) return false;
                                if (ancestorSearch) return idea.title?.toLowerCase().includes(ancestorSearch.toLowerCase());
                                return true;
                            }).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">ไม่พบไอเดีย</p>
                                )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </DndContext>
    );
}

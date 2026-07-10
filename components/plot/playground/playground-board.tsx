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
import { updateTimelineCanvas } from "@/server/timeline";
import { updateIdea } from "@/server/idea"; // For auto-reset isUsed flag
import { getSceneElementDetails, getIdeaNotesForIdeas } from "@/server/scene-element-details";
import { addBeat, createThread } from "@/server/plot-threads";
import type { ThreadWithBeats } from "@/server/plot-threads";
import { SceneElementDetailDialog } from "./scene-element-detail-dialog";
import { IdeaNoteDialog } from "./idea-note-dialog";
import { SceneElementDetails } from "@/db/schema";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Save, Link2, X, Check, Download, List, Navigation, SkipBack, SkipForward, StickyNote, GitBranchPlus, Lightbulb, Loader2, Sprout, LayoutGrid, Rows3 } from "lucide-react";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PlaygroundBoardProps {
    eventId: string;
    novelId: string;
    initialItems: any[];
    characters: any[];
    locations: any[];
    ideas: any[];
    threads?: ThreadWithBeats[];
    factions?: any[];
}

interface Lane {
    id: string;
    name: string;
    orderIndex: number;
}

const COLUMN_WIDTH = 280;
const LABEL_WIDTH = 150;
const GUTTER_WIDTH = Math.round(COLUMN_WIDTH / 3); // ช่องแคบระหว่างจังหวะ ให้เส้นเชื่อมวิ่งผ่าน
const BOARD_ZOOM = 0.8; // ponytail: native zoom out ~20% เพื่อเห็นภาพรวม, ปรับเป็น 1 ถ้าจะคืนขนาดจริง
const beatGridCol = (beatIndex: number) => beatIndex * 2 + 2; // คอลัมน์การ์ด (เว้นช่องกัตเตอร์แทรกทุกจังหวะ)

// ---- Canvas link (P-canvas): เส้นเชื่อมมีชนิด/label ----
// link เก็บใน item.links — รองรับทั้ง string เก่า และ object ใหม่
export type CanvasLink = { targetId: string; kind: string; label?: string | null }
export const normalizeLink = (l: any): CanvasLink =>
    typeof l === "string" ? { targetId: l, kind: "related", label: null } : { kind: "related", ...l }

// เส้นทุกชนิดใช้ความหนา/ทึบ/ลูกศรแบบเดียวกันหมด ต่างกันแค่สี — เพื่อความสม่ำเสมอ ไม่มี dash แยกต่อชนิดอีกต่อไป
export const LINK_KINDS: Record<string, { label: string; color: string; pinFill: string; pinStroke: string }> = {
    related: { label: "เกี่ยวข้อง", color: "#dc2626", pinFill: "#991b1b", pinStroke: "#fca5a5" },          // ด้ายแดงเดิม
    leads_to: { label: "นำไปสู่", color: "#10b981", pinFill: "#047857", pinStroke: "#6ee7b7" },
    conflicts: { label: "ขัดแย้งกับ", color: "#ef4444", pinFill: "#991b1b", pinStroke: "#fca5a5" },
    simultaneous: { label: "เกิดพร้อมกัน", color: "#3b82f6", pinFill: "#1d4ed8", pinStroke: "#93c5fd" },
    ancestor: { label: "ทำไมถึงทำแบบนี้", color: "#3b82f6", pinFill: "#1d4ed8", pinStroke: "#93c5fd" },
}

// ---- Migration: ฉากเก่า (x,y อิสระ) -> lane + beatIndex ----
function buildBoardState(initialItems: any[]): { lanes: Lane[]; items: any[] } {
    const laneItems = initialItems.filter((i: any) => i.type === 'lane');
    let lanes: Lane[] = laneItems
        .map((l: any) => ({ id: l.id, name: l.name || 'เลน', orderIndex: l.orderIndex ?? 0 }))
        .sort((a, b) => a.orderIndex - b.orderIndex);

    // group frames เดิมเลิกใช้แล้ว (เลนทำหน้าที่จัดกลุ่มแทน) — กรองทิ้งเงียบๆ
    let cardItems = initialItems.filter((i: any) => i.type !== 'group' && i.type !== 'lane');

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
    return { lanes, items: cardItems };
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
function LaneLabel({ lane, laneIndex, onRename, onRemove, canRemove }: {
    lane: Lane;
    laneIndex: number;
    onRename: (id: string, name: string) => void;
    onRemove: (id: string) => void;
    canRemove: boolean;
}) {
    return (
        <div
            style={{ gridColumn: 1, gridRow: laneIndex + 2, width: LABEL_WIDTH }}
            className="sticky left-0 z-20 bg-muted/60 backdrop-blur-sm border-r border-b border-border/60 flex items-start gap-1 px-2.5 py-2.5 min-h-[140px]"
        >
            <span className="mt-[7px] h-2 w-2 rounded-full bg-[var(--forge-amber)] shrink-0" />
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

function BeatCell({ laneId, beatIndex, laneIndex, isTrailing, children }: {
    laneId: string;
    beatIndex: number;
    laneIndex: number;
    isTrailing: boolean;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `cell:${laneId}:${beatIndex}`,
        data: { acceptsCell: true, laneId, beatIndex },
    });

    return (
        <div
            ref={setNodeRef}
            style={{ gridColumn: beatGridCol(beatIndex), gridRow: laneIndex + 2, width: COLUMN_WIDTH }}
            className={cn(
                "min-h-[140px] p-1.5 border-r border-b flex flex-col gap-1.5 transition-colors",
                isTrailing ? "border-dashed border-border/40" : "border-border/40",
                isOver && "bg-[var(--forge-amber)]/8 ring-1 ring-inset ring-[var(--forge-amber)]/40"
            )}
        >
            {isTrailing && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground/30">
                    <Plus className="w-5 h-5" />
                </div>
            )}
            {children}
        </div>
    );
}

export function PlaygroundBoard({
    eventId,
    novelId,
    initialItems,
    characters,
    locations,
    ideas,
    threads = [],
    factions = [],
}: PlaygroundBoardProps) {
    const [{ lanes, items: initialCardItems }] = useState(() => buildBoardState(initialItems));
    const [lanes_, setLanes] = useState<Lane[]>(lanes);
    const [items, setItems] = useState<any[]>(initialCardItems);
    const [activeDragItem, setActiveDragItem] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

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

    const [elementDetailsMap, setElementDetailsMap] = useState<Map<string, SceneElementDetails>>(new Map());
    const [editingChild, setEditingChild] = useState<{ child: any; canvasItemId: string } | null>(null);

    const [ideaNotes, setIdeaNotes] = useState<SceneElementDetails[]>([]);
    const [editingNote, setEditingNote] = useState<{ item: any; existingNote?: SceneElementDetails } | null>(null);

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
        setLinkPositions(next);
    }, []);

    useLayoutEffect(() => {
        recomputePositions();
    }, [items, lanes_, recomputePositions]);

    useEffect(() => {
        const container = gridRef.current;
        if (!container) return;
        const ro = new ResizeObserver(() => recomputePositions());
        ro.observe(container);
        return () => ro.disconnect();
    }, [recomputePositions]);

    // จำนวน beat จริง + คอลัมน์ท้ายเปล่าไว้ลาก/วางเพื่อขยาย
    const beatCount = useMemo(
        () => Math.max(0, ...items.map(i => (typeof i.beatIndex === 'number' ? i.beatIndex : 0) + 1)),
        [items]
    );
    const totalColumns = beatCount + 1;

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

    const handleAddNote = useCallback((item: any) => {
        if (item.existingNoteId) {
            const existingNote = ideaNotes.find(n => n.id === item.existingNoteId);
            setEditingNote({ item, existingNote });
        } else {
            setEditingNote({ item });
        }
    }, [ideaNotes]);

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
            const laneNodes = lanes_.map(l => ({ id: l.id, type: 'lane', name: l.name, orderIndex: l.orderIndex }));
            const result = await updateTimelineCanvas(eventId, [...items, ...laneNodes]);
            if (result.success) setLastSaved(new Date());
            setIsSaving(false);
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, [items, lanes_, eventId]);

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
                    .map((c: any) => ({ ...c, id: crypto.randomUUID() }));
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

            const srcItem = prev.find(i => i.id === sourceId);
            const tgtItem = prev.find(i => i.id === targetId);
            const shouldMoveBeat =
                patch.kind === "simultaneous" &&
                srcItem && tgtItem &&
                srcItem.beatIndex !== tgtItem.beatIndex;

            return prev.map(item => {
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
                        ...(shouldMoveBeat ? { beatIndex: srcItem!.beatIndex } : {}),
                    };
                }
                return item;
            });
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

    const handleJumpToFirst = () => viewportRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
    const handleJumpToLast = () => viewportRef.current?.scrollTo({ left: viewportRef.current.scrollWidth, behavior: 'smooth' });

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

    const handleAddChild = useCallback((ideaId: string, child: any) => {
        setItems(prev => prev.map(item => item.id === ideaId
            ? { ...item, children: [...(item.children || []), child] }
            : item
        ));
    }, []);

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

        setItems(prev => prev.map(i => i.type === 'idea' && depths.has(i.id) ? { ...i, beatIndex: depths.get(i.id) } : i));
        toast.success('เรียง beat ตามลำดับ "นำไปสู่" แล้ว', {
            action: {
                label: 'ย้อนกลับ',
                onClick: () => setItems(cur => cur.map(i => prevState.has(i.id) ? { ...i, beatIndex: prevState.get(i.id) } : i)),
            },
        });
    };

    const handleAddLane = () => {
        setLanes(prev => [...prev, { id: crypto.randomUUID(), name: `เลน ${prev.length + 1}`, orderIndex: prev.length }]);
    };
    const handleRenameLane = (laneId: string, name: string) => {
        setLanes(prev => prev.map(l => l.id === laneId ? { ...l, name } : l));
    };
    const handleRemoveLane = (laneId: string) => {
        if (lanes_.length <= 1) { toast.error('ต้องมีอย่างน้อย 1 เลน'); return; }
        if (items.some(i => i.laneId === laneId)) { toast.error('ย้ายการ์ดออกจากเลนนี้ก่อนถึงจะลบได้'); return; }
        setLanes(prev => prev.filter(l => l.id !== laneId));
    };

    const handleDragStart = (event: DragStartEvent) => {
        if (linkingSourceId) return;
        setActiveDragItem(event.active.data.current);
    };

    const handleDragOver = (_event: DragOverEvent) => { };

    const handleDragEnd = (event: DragEndEvent) => {
        if (linkingSourceId) return;
        const { active, over } = event;
        setActiveDragItem(null);
        if (!over) return;

        const activeData = active.data.current as any;
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
                setItems(prev => prev.map(item => item.id === active.id ? { ...item, laneId, beatIndex } : item));
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

    const handleSave = async () => {
        setIsSaving(true);
        const laneNodes = lanes_.map(l => ({ id: l.id, type: 'lane', name: l.name, orderIndex: l.orderIndex }));
        const result = await updateTimelineCanvas(eventId, [...items, ...laneNodes]);
        if (result.success) {
            setLastSaved(new Date());
            toast.success("บันทึก layout แล้ว");
        } else {
            toast.error("บันทึกไม่สำเร็จ");
        }
        setIsSaving(false);
    };

    const handleSetColor = (id: string, color: string | null) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, color } : item));
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
        const exportData = {
            exportedAt: new Date().toISOString(),
            novelId,
            eventId,
            totalItems: items.length,
            lanes: lanes_,
            items: items.map(item => ({
                id: item.id,
                type: item.type,
                title: item.title,
                content: item.content,
                laneId: item.laneId,
                beatIndex: item.beatIndex,
                links: item.links,
                children: item.children?.map((child: any) => ({
                    id: child.id, type: child.type, title: child.title, content: child.content, referenceId: child.referenceId
                }))
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

        // 2. จัด slot ต่อ (node, ด้านของขอบ) — เรียงตามตำแหน่งปลายอีกฝั่ง ให้เส้นไม่ไขว้กันเองโดยไม่จำเป็น
        const sideOf = (from: { x: number; y: number }, to: { x: number; y: number }) => {
            const dx = to.x - from.x, dy = to.y - from.y;
            return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
        };
        const sideGroups = new Map<string, Array<{ edgeIdx: number; endpoint: 'source' | 'target'; counterpart: { x: number; y: number } }>>();
        edges.forEach((e, i) => {
            const sSide = sideOf(e.sPos, e.tPos);
            const tSide = sideOf(e.tPos, e.sPos);
            const push = (key: string, entry: any) => {
                if (!sideGroups.has(key)) sideGroups.set(key, []);
                sideGroups.get(key)!.push(entry);
            };
            push(`${e.sourceId}:${sSide}`, { edgeIdx: i, endpoint: 'source', counterpart: e.tPos });
            push(`${e.targetId}:${tSide}`, { edgeIdx: i, endpoint: 'target', counterpart: e.sPos });
        });
        // slot index ต่อ edge-endpoint
        const slotMap = new Map<string, { slot: number; count: number }>();
        sideGroups.forEach((entries, key) => {
            const side = key.split(':').pop()!;
            const horizontal = side === 'left' || side === 'right';
            // เรียงตามแกนตั้ง (ขอบซ้าย/ขวา) หรือแกนนอน (ขอบบน/ล่าง) ของปลายอีกฝั่ง
            const sorted = [...entries].sort((a, b) =>
                horizontal ? a.counterpart.y - b.counterpart.y : a.counterpart.x - b.counterpart.x
            );
            sorted.forEach((entry, slot) => {
                slotMap.set(`${entry.edgeIdx}:${entry.endpoint}`, { slot, count: sorted.length });
            });
        });

        // 3. anchor จริง: ขอบการ์ด + offset ตาม slot
        const anchorAt = (
            pos: { x: number; y: number; w: number; h: number },
            other: { x: number; y: number },
            edgeIdx: number,
            endpoint: 'source' | 'target',
        ) => {
            const side = sideOf(pos, other);
            const { slot, count } = slotMap.get(`${edgeIdx}:${endpoint}`) ?? { slot: 0, count: 1 };
            const spread = 18;
            const offset = (slot - (count - 1) / 2) * spread;
            if (side === 'right') return { x: pos.x + pos.w / 2, y: pos.y + Math.max(-pos.h / 2 + 10, Math.min(pos.h / 2 - 10, offset)) };
            if (side === 'left') return { x: pos.x - pos.w / 2, y: pos.y + Math.max(-pos.h / 2 + 10, Math.min(pos.h / 2 - 10, offset)) };
            if (side === 'bottom') return { x: pos.x + Math.max(-pos.w / 2 + 10, Math.min(pos.w / 2 - 10, offset)), y: pos.y + pos.h / 2 };
            return { x: pos.x + Math.max(-pos.w / 2 + 10, Math.min(pos.w / 2 - 10, offset)), y: pos.y - pos.h / 2 };
        };

        return edges.map((e, i) => (
            <ConnectionLine
                key={`${e.sourceId}-${e.targetId}`}
                start={anchorAt(e.sPos, e.tPos, i, 'source')}
                end={anchorAt(e.tPos, e.sPos, i, 'target')}
                kind={e.link.kind} label={e.link.label}
                onClick={() => setEditingLink({ sourceId: e.sourceId, targetId: e.targetId })}
            />
        ));
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
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full">
                {/* Sidebar */}
                <div className="w-60 border-r bg-muted/10 overflow-hidden flex flex-col">
                    <ResourceSidebar
                        characters={characters}
                        locations={locations}
                        ideas={ideas}
                        factions={factions}
                    />
                </div>

                {/* Storyboard grid area */}
                <div className="flex-1 min-w-0 relative bg-muted/30 min-h-[400px] flex flex-col">
                    {/* Linking Mode Banner */}
                    {linkingSourceId && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                            <div className="pointer-events-auto flex items-center gap-3 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg border-2 border-blue-600">
                                <Link2 className="w-4 h-4 animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium">โหมดเชื่อมเส้น</span>
                                    <span className="text-xs opacity-90">
                                        คลิกการ์ดที่จะเชื่อม ({items.find(i => i.id === linkingSourceId)?.links?.length || 0} เส้นแล้ว)
                                    </span>
                                </div>
                                <div className="flex gap-1 ml-2">
                                    <Button size="sm" variant="ghost" className="h-7 bg-white/20 hover:bg-white/30 text-white border-0" onClick={handleFinishLinking}>
                                        <Check className="w-3.5 h-3.5 mr-1" />เสร็จ
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 bg-white/20 hover:bg-white/30 text-white border-0" onClick={handleCancelLink}>
                                        <X className="w-3.5 h-3.5 mr-1" />ยกเลิก
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/85 backdrop-blur z-30">
                        <div className="relative">
                            <Button variant={showNavigator ? "secondary" : "ghost"} size="icon" className="h-8 w-8"
                                onClick={() => setShowNavigator(!showNavigator)} title="สารบัญ">
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

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:bg-purple-100" onClick={handleAddStickyNote} title="เพิ่ม Sticky Note">
                            <StickyNote className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-100" onClick={handleAutoArrange} title='เรียง beat ตาม "นำไปสู่"'>
                            <LayoutGrid className="h-4 w-4" />
                        </Button>

                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-emerald-600 hover:bg-emerald-100" onClick={handleAddLane} title="เพิ่มเลนใหม่">
                            <Rows3 className="h-4 w-4" />เพิ่มเลน
                        </Button>

                        <div className="w-px h-4 bg-border mx-1" />

                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleJumpToFirst} title="ไปจุดเริ่มต้น">
                            <SkipBack className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleJumpToLast} title="ไปจุดสุดท้าย">
                            <SkipForward className="h-4 w-4" />
                        </Button>

                        <div className="flex-1" />

                        <CreateIdeaDialog
                            novelId={novelId}
                            onIdeaCreated={(idea) => {
                                const newItem = {
                                    id: crypto.randomUUID(),
                                    type: 'idea',
                                    referenceId: idea.id,
                                    title: idea.title,
                                    content: idea.content,
                                    laneId: lanes_[0]?.id,
                                    beatIndex: beatCount,
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

                        <Button onClick={handleSave} disabled={isSaving} size="icon" variant="outline"
                            className={`h-8 w-8 ${lastSaved && !isSaving ? 'text-green-600 border-green-300' : ''}`}
                            title={isSaving ? "กำลังบันทึก..." : lastSaved ? "บันทึกแล้ว" : "บันทึก Layout"}>
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : lastSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        </Button>
                        <Button onClick={handleExport} size="icon" variant="outline" className="h-8 w-8" title="Export JSON">
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Grid viewport (scroll) */}
                    <div ref={viewportRef} id="canvas-viewport" className="flex-1 min-h-0 overflow-auto">
                        <div
                            ref={gridRef}
                            className="relative"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `${LABEL_WIDTH}px ${Array.from({ length: totalColumns }).map((_, i) => i < totalColumns - 1 ? `${COLUMN_WIDTH}px ${GUTTER_WIDTH}px` : `${COLUMN_WIDTH}px`).join(' ')}`,
                                gridTemplateRows: `36px repeat(${lanes_.length}, auto)`,
                                width: 'max-content',
                                zoom: BOARD_ZOOM,
                            }}
                        >
                            {/* Header row: จังหวะ/beat */}
                            <div
                                style={{ gridColumn: 1, gridRow: 1, width: LABEL_WIDTH }}
                                className="sticky left-0 top-0 z-30 bg-background border-r border-b border-border/60 flex items-center px-3"
                            >
                                <span className="font-technical text-[9px] uppercase tracking-[0.14em] text-muted-foreground">เลน \ จังหวะ</span>
                            </div>
                            {Array.from({ length: totalColumns }).map((_, beatIndex) => (
                                <Fragment key={`beat-head-${beatIndex}`}>
                                    <div
                                        style={{ gridColumn: beatGridCol(beatIndex), gridRow: 1, width: COLUMN_WIDTH }}
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
                                            style={{ gridColumn: beatGridCol(beatIndex) + 1, gridRow: 1, width: GUTTER_WIDTH }}
                                            className="sticky top-0 z-20 bg-muted/20 border-b border-border/30"
                                        />
                                    )}
                                </Fragment>
                            ))}

                            {lanes_.map((lane, laneIndex) => (
                                <Fragment key={lane.id}>
                                    <LaneLabel
                                        lane={lane}
                                        laneIndex={laneIndex}
                                        onRename={handleRenameLane}
                                        onRemove={handleRemoveLane}
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
                                                        elementDetails={elementDetailsMap}
                                                        onEditChild={handleEditChild}
                                                        ideaNotes={ideaNotes}
                                                        onAddNote={handleAddNote}
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
                                                        factions={factions}
                                                        onAddChild={handleAddChild}
                                                        onDetailSaved={handleDetailSaved}
                                                        onSetColor={(c) => handleSetColor(item.id, c)}
                                                        onMeasureRef={registerItemRef}
                                                    />
                                                ))}
                                            </BeatCell>
                                            {beatIndex < totalColumns - 1 && (
                                                <div
                                                    key={`gutter-${beatIndex}`}
                                                    style={{ gridColumn: beatGridCol(beatIndex) + 1, gridRow: laneIndex + 2, width: GUTTER_WIDTH }}
                                                    className="min-h-[140px] bg-muted/10 border-b border-border/30"
                                                />
                                            )}
                                        </Fragment>
                                        );
                                    })}
                                </Fragment>
                            ))}

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

            {/* Idea Note Dialog */}
            {editingNote && (
                <IdeaNoteDialog
                    open={!!editingNote}
                    onOpenChange={(open) => !open && setEditingNote(null)}
                    ideaId={editingNote.item.referenceId || editingNote.item.id}
                    ideaTitle={editingNote.item.title}
                    canvasItemId={editingNote.item.id}
                    sceneId={eventId}
                    novelId={novelId}
                    existingNote={editingNote.existingNote}
                    onSaved={handleDetailSaved}
                    onDeleted={handleNoteDeleted}
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

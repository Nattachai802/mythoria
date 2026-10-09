"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, useId, Fragment } from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    useDroppable,
    useSensor,
    useSensors,
    PointerSensor,
    KeyboardSensor,
    DragStartEvent,
    pointerWithin,
    DragOverlay,
} from "@dnd-kit/core";
import { CanvasItem, DraggableCanvasItem } from "./canvas-item";
import { EchoScorePanel } from "./echo-score-panel";
import { BeatCoachSection } from "./beat-coach-panel";
import { SceneRecapSection } from "./scene-recap-panel";
import type { EchoFinding } from "@/lib/echo-score";
import type { CausalityVerdict } from "@/lib/plot-recap";
import { type BoardChapter, updateTimelineCanvas, getNovelDummyParticipants } from "@/server/timeline";
import { updateIdea, createIdea } from "@/server/idea"; // updateIdea: auto-reset isUsed flag
import { getSceneElementDetails, getIdeaNotesForIdeas, promoteDummy, promoteDummyAllScenes } from "@/server/scene-element-details";
import { noteToPlain } from "@/lib/note-text";
import { addBeat, createThread, deleteBeat } from "@/server/plot-threads";
import type { ThreadWithBeats } from "@/server/plot-threads";
import { SceneElementDetailDialog } from "./scene-element-detail-dialog";
import { SceneElementDetails } from "@/db/schema";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, ChevronDown, ArrowUp, ArrowDown, Eye, Lock, LockOpen, Plus, Link2, X, Check, Download, List, Navigation, StickyNote, GitBranchPlus, Lightbulb, Loader2, Sprout, LayoutGrid, Rows3, Repeat, Target, FileText, Sparkles, Activity } from "lucide-react";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { createPortal } from "react-dom";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { analyzeBeats, collapseByBeat } from "@/lib/beat-coach";
import { SceneDramaticPanel } from "./scene-dramatic-panel";
import { buildSceneFormat, renderSceneMarkdown } from "@/lib/story-format";
import { useIsMobile } from "@/hooks/use-mobile";

// KeyboardSensor ตัวเดิมกิน Space ที่ bubble ขึ้นมาจากช่องพิมพ์ในการ์ด (เช่นโน้ตของไอเดีย)
// เพราะ dnd-kit จะข้าม guard ของตัวเองเมื่อ activatorNode เป็น null แล้ว preventDefault ทิ้ง
// กันไว้ที่ sensor ที่เดียว ดีกว่าไล่ใส่ stopPropagation ทุก input
class TypingSafeKeyboardSensor extends KeyboardSensor {
    static activators = [{
        eventName: "onKeyDown" as const,
        handler: (event: any, args: any, ctx: any) => {
            const target = event.target as HTMLElement | null;
            if (target?.isContentEditable || target?.closest?.("input, textarea, select, [contenteditable='true']")) {
                return false;
            }
            return (KeyboardSensor as any).activators[0].handler(event, args, ctx);
        },
    }];
}

interface PlaygroundBoardProps {
    eventId: string;
    novelId: string;
    initialItems: any[];
    sceneEvents?: any[]; // ฉากทั้งเรื่อง — ส่งต่อให้ SceneDramaticPanel ใช้เลือกฉากต้นเหตุ
    event?: any; // timelineEvent เต็ม — ใช้ดึงฟิลด์ดราม่า (goal/conflict/outcome/POV/เหตุ-ผล) ตอน export
    characters: any[];
    ideas: any[];
    threads?: ThreadWithBeats[];
    factions?: any[];
    powers?: any[];
    /** สิ่งของในนิยาย (ตาราง items) — alias เป็น worldItems ตอนรับ เพราะ items ในไฟล์นี้คือการ์ดบนแคนวาส */
    items?: any[];
    entities?: any[];
    worldSystems?: any[];
    boardChapters?: BoardChapter[]; // ตอนที่แบ่งไว้บนกระดานอื่นของนิยายเดียวกัน — ใช้อ้างอิงตอนตั้งชื่อ
    tonePresets?: { id: string; label: string; color: string }[];
    initialEchoFindings?: EchoFinding[];
    /** ความสัมพันธ์จากตารางโลก ใช้อนุมานโครงชั้นในการ์ด (P-nest) */
    participantLinks?: { charFactions?: any[]; charPowers?: any[] };
    initialSceneRecap?: { recap: string; causality?: CausalityVerdict; causalityNote?: string } | null;
}

// ชนิดเลน — ให้เลนมีความหมาย (เรื่องหลัก/รอง/มุมมองตัวละคร/ไทม์ไลน์) ไม่ใช่แค่แถวว่าง · เลนเก่าไม่มี kind = อิสระ
type LaneKind = 'main' | 'sub' | 'pov' | 'time' | 'free';
const LANE_KINDS: { key: LaneKind; label: string; hint: string }[] = [
    { key: 'main', label: 'เรื่องหลัก', hint: 'เส้นเรื่องหลักของฉาก (A-plot)' },
    { key: 'sub', label: 'เรื่องรอง', hint: 'เส้นเรื่องรองที่ไหลคู่กัน (B/C-plot)' },
    { key: 'pov', label: 'มุมมองตัวละคร', hint: 'เล่าผ่านสายตาตัวละครคนหนึ่ง' },
    { key: 'time', label: 'ไทม์ไลน์', hint: 'ช่วงเวลา เช่น อดีต/ปัจจุบัน' },
    { key: 'free', label: 'อิสระ', hint: 'ไม่กำหนดความหมาย' },
];
const laneKindLabel = (k?: LaneKind) => LANE_KINDS.find((x) => x.key === (k ?? 'free'))?.label ?? 'อิสระ';
// เลนเงียบ: ไม่มีการ์ดต่อเนื่องเท่านี้จังหวะ (ภายในช่วงจังหวะของฉาก) ถึงจะเตือน
const LANE_GAP_WARN = 3;

interface Lane {
    id: string;
    name: string;
    orderIndex: number;
    color?: string;
    kind?: LaneKind;
    characterId?: string | null;
}

interface LaneStats { count: number; longestGap: number; gapStart: number }

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
const BOARD_ZOOM_DEFAULT = 0.8; // ponytail: native zoom out ~20% เพื่อเห็นภาพรวม, ปรับเป็น 1 ถ้าจะคืนขนาดจริง
const beatGridCol = (beatIndex: number) => beatIndex * 2 + 2; // คอลัมน์การ์ด (เว้นช่องกัตเตอร์แทรกทุกจังหวะ)

// ---- Canvas link (P-canvas): เส้นเชื่อมมีชนิด/label ----
// ย้ายไป lib/link-kinds.ts แล้ว — re-export เพื่อไม่ให้ import path เดิมพัง
// `export ... from` ไม่ดึงชื่อเข้า scope ของไฟล์นี้ — ต้อง import แล้ว re-export แยก
import { normalizeLink, LINK_KINDS, DEFAULT_LINK_COLOR, LINK_COLOR_PRESETS, LEGACY_HIDDEN_NODE_TYPES, linkColor, type CanvasLink } from "@/lib/link-kinds";
export { normalizeLink, LINK_KINDS, type CanvasLink };

// ---- Migration: ฉากเก่า (x,y อิสระ) -> lane + beatIndex ----
// field โครงฉากดราม่าของการ์ดไอเดีย — อยู่ที่ ideas table (แหล่งจริง) ไม่ใช่ canvasData
// (ต่างจาก color/keyMomentLabel/isNarration ที่เป็น canvas-only) merge เข้า item ตอน build
// state ครั้งแรก ให้ popover เห็นค่าล่าสุดโดยไม่ต้อง query ซ้ำต่อการ์ด
const SCENE_DRAMA_FIELDS = ["sceneType", "sceneTone", "pacing", "sceneGoal", "sceneConflict", "sceneOutcome", "valueShift"] as const;

function buildBoardState(initialItems: any[], ideasList: any[] = []): { lanes: Lane[]; items: any[]; chapters: Chapter[]; keptNodes: any[] } {
    const laneItems = initialItems.filter((i: any) => i.type === 'lane');
    let lanes: Lane[] = laneItems
        .map((l: any) => ({ id: l.id, name: l.name || 'เลน', orderIndex: l.orderIndex ?? 0, color: l.color, kind: l.kind, characterId: l.characterId ?? null }))
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
    let cardItems = initialItems.filter((i: any) => i.type !== 'group' && i.type !== 'lane' && i.type !== 'chapter' && !LEGACY_HIDDEN_NODE_TYPES.includes(i.type));

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

    const ideaById = new Map(ideasList.map((i: any) => [i.id, i]));
    cardItems = cardItems.map((it: any) => {
        if (it.type !== 'idea' || !it.referenceId) return it;
        const idea = ideaById.get(it.referenceId);
        if (!idea) return it;
        const drama: Record<string, unknown> = {};
        for (const f of SCENE_DRAMA_FIELDS) drama[f] = idea[f] ?? null;
        return { ...it, ...drama };
    });

    // โหนดของฟีเจอร์รอยต่อจังหวะที่ถอดไปแล้ว: ไม่แสดง แต่เก็บกลับลงข้อมูลตอนบันทึก (ไม่ลบข้อมูลของผู้ใช้)
    const keptNodes = initialItems.filter((i: any) => LEGACY_HIDDEN_NODE_TYPES.includes(i.type));
    return { lanes, items: cardItems, chapters, keptNodes };
}

// หมุดปลายเส้น — สี่เหลี่ยมมนเลียนแบบรูสปรอกเก็ตของฟิล์ม ให้เข้าชุดกับการ์ดที่มี FilmSprockets/frame number
function FilmPin({ x, y, size, fill, stroke }: { x: number; y: number; size: number; fill: string; stroke: string }) {
    return <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={1.5} fill={fill} stroke={stroke} strokeWidth="1" />;
}

// จุดกึ่งกลางตามความยาวจริงของเส้นหลายท่อน (polyline) + มุมของท่อนที่จุดนั้นตกอยู่ — ใช้หมุนป้ายสไปซ์ให้ขนานกับเส้น ณ จุดนั้น
function polylineMidpoint(points: Array<{ x: number; y: number }>): { x: number; y: number; angleDeg: number } {
    const segs = points.slice(1).map((p, i) => {
        const a = points[i];
        const dx = p.x - a.x, dy = p.y - a.y;
        return { a, b: p, len: Math.sqrt(dx * dx + dy * dy) };
    });
    const total = segs.reduce((s, seg) => s + seg.len, 0);
    let remaining = total / 2;
    for (const seg of segs) {
        if (remaining <= seg.len || seg === segs[segs.length - 1]) {
            const t = seg.len > 0 ? remaining / seg.len : 0;
            return {
                x: seg.a.x + (seg.b.x - seg.a.x) * t,
                y: seg.a.y + (seg.b.y - seg.a.y) * t,
                angleDeg: Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) * (180 / Math.PI),
            };
        }
        remaining -= seg.len;
    }
    return { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, angleDeg: 0 };
}

// เทปสไปซ์ (splice tape) — จุดต่อฟิล์มจริงของช่างตัดต่อ ลายทแยงเหลือง-ดำ วางกึ่งกลางเส้นจุดเดียว
// ให้ตาโฟกัสจุดต่อจุดเดียวแทนจุดไข่ปลารกทั้งเส้น และเป็นภาพจำเฉพาะของงานตัดต่อฟิล์มที่จำได้ทันที
function SpliceTape({ x, y, angleDeg }: { x: number; y: number; angleDeg: number }) {
    const id = useId();
    const w = 18, h = 8;
    return (
        <g transform={`translate(${x} ${y}) rotate(${angleDeg})`}>
            <clipPath id={id}>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="1.5" />
            </clipPath>
            <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="1.5" fill="#18181b" stroke="#facc15" strokeWidth="0.75" />
            <g clipPath={`url(#${id})`}>
                {[-12, -6, 0, 6, 12].map(off => (
                    <rect key={off} x={off - 1.5} y={-h} width="3" height={h * 2} fill="#facc15" transform={`rotate(35 ${off} 0)`} />
                ))}
            </g>
        </g>
    );
}

// ตัวเส้นเชื่อม — แถบฟิล์มเข้ม (steel-800 เหมือนแถบ FilmSprockets บนการ์ด) + รอยต่อสไปซ์กึ่งกลาง
// แทนเส้นลวดสีเรียบ ๆ เดิม ให้เห็นเป็น "แถบฟิล์มจริง" ทอดเชื่อมสองเฟรม ไม่ใช่ด้ายผูกกระดานสืบสวน
// สีของแต่ละชนิดเส้น (cfg.color) ยังคงอยู่ที่หมุด/หัวลูกศร/ป้ายชื่อ พอสำหรับแยกชนิดโดยไม่ทำให้แถบฟิล์มรก
function FilmStripPath({ points, color }: { points: Array<{ x: number; y: number }>; color?: string }) {
    const d = points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
    if (color) {
        // เส้นสีล้วนในธีมฟิล์ม — รางสีที่ผู้ใช้เลือก + รูสปรอกเก็ตขาวเรียงกลางราง (เหมือนจุดขาวบนแถบฟิล์มของการ์ด)
        return (
            <>
                <path d={d} stroke={color} strokeWidth="6" strokeOpacity="0.92" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d={d} stroke="#fff" strokeWidth="2.2" strokeOpacity="0.8" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.01 7" />
            </>
        );
    }
    const mid = polylineMidpoint(points);
    return (
        <>
            <path d={d} stroke="var(--steel-800)" strokeWidth="6" strokeOpacity="0.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <SpliceTape x={mid.x} y={mid.y} angleDeg={mid.angleDeg} />
        </>
    );
}

// ป้ายชื่อเส้นเชื่อม — ชิปพื้นเข้ม ตัวหนังสือ font-technical แบบเดียวกับเลขเฟรม/ป้าย Kodak บนแคนนิสเตอร์
function LinkLabelTag({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
    const w = text.length * 9;
    return (
        <g style={{ pointerEvents: 'none' }}>
            <rect x={x - w / 2} y={y - 9} width={w} height={17} rx="2" fill="#18181b" stroke={color} strokeWidth="1" opacity="0.94" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="600" fill={color}
                style={{ fontFamily: 'var(--font-technical)', letterSpacing: '0.03em' }}>{text}</text>
        </g>
    );
}

// เส้นเชื่อมฟิล์ม (เดิมสไตล์ด้ายแดงแบบนักสืบ ปรับให้เข้าธีมฟิล์ม/เฟรมภาพยนตร์) — generalized ตามชนิดเส้น
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
            <FilmStripPath points={[{ x: sX, y: sY }, { x: eX, y: eY }]} />
            <polygon points={`${eX},${eY} ${aX1},${aY1} ${aX2},${aY2}`} fill={cfg.color} fillOpacity="0.85" />
            <FilmPin x={sX} y={sY} size={length < 40 ? 5 : 7} fill={cfg.pinFill} stroke={cfg.pinStroke} />
            <FilmPin x={eX} y={eY} size={length < 40 ? 5 : 7} fill={cfg.pinFill} stroke={cfg.pinStroke} />
            {displayLabel && <LinkLabelTag x={labelX} y={labelY} text={displayLabel} color={cfg.color} />}
            {onClick && (
                <path d={pathD} stroke="transparent" strokeWidth="16" fill="none"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onClick(); }} />
            )}
        </g>
    );
}

// เส้นเชื่อมการ์ดแบบตั้งฉาก (orthogonal) — สีล้วนในธีมฟิล์ม: รางสีมีรูสปรอกเก็ตขาว + หัวลูกศร + หมุดสี่เหลี่ยมต้นทาง ไม่มีข้อความ/ป้ายชนิด
function OrthoLine({ points, color, onClick }: {
    points: Array<{ x: number; y: number }>;
    color: string;
    onClick?: () => void;
}) {
    if (points.length < 2) return null;
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

    return (
        <g>
            <FilmStripPath points={points} color={color} />
            <polygon points={`${p2.x},${p2.y} ${a1x},${a1y} ${a2x},${a2y}`} fill={color} stroke="#18181b" strokeOpacity="0.55" strokeWidth="0.75" strokeLinejoin="round" />
            <FilmPin x={start.x} y={start.y} size={8} fill={color} stroke="#18181b" />
            {onClick && (
                <path d={d} stroke="transparent" strokeWidth="16" fill="none"
                    style={{ pointerEvents: "auto", cursor: "pointer" }}
                    onClick={(e) => { e.stopPropagation(); onClick(); }} />
            )}
        </g>
    );
}

// แก้เส้นเชื่อม: เลือกสี (จานสีสำเร็จรูป หรือสีอะไรก็ได้) + ลบ — เลือกแล้วใช้ทันที ไม่มีปุ่มบันทึก
function LinkColorDialog({ sourceTitle, targetTitle, color, onPick, onDelete, onClose }: {
    sourceTitle: string;
    targetTitle: string;
    color: string;
    onPick: (color: string, close: boolean) => void;
    onDelete: () => void;
    onClose: () => void;
}) {
    const isPreset = LINK_COLOR_PRESETS.includes(color.toLowerCase());
    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-xs">
                <DialogHeader>
                    <DialogTitle className="text-sm flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-muted-foreground" />
                        สีของเส้น
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        <span className="font-medium text-foreground">{sourceTitle}</span>
                        {" → "}
                        <span className="font-medium text-foreground">{targetTitle}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="สีของเส้น">
                        {LINK_COLOR_PRESETS.map(c => (
                            <button
                                key={c}
                                role="radio"
                                aria-checked={color.toLowerCase() === c}
                                aria-label={c}
                                onClick={() => onPick(c, true)}
                                className="h-7 w-7 rounded-full border-2 border-transparent transition-transform hover:scale-110 aria-checked:border-foreground"
                                style={{ background: c }}
                            />
                        ))}
                        <label
                            className={cn("relative h-7 w-7 rounded-full border-2 cursor-pointer overflow-hidden transition-transform hover:scale-110", !isPreset ? "border-foreground" : "border-dashed border-muted-foreground/60")}
                            title="เลือกสีอื่นเอง"
                            style={!isPreset ? { background: color } : undefined}
                        >
                            {isPreset && <Plus className="absolute inset-0 m-auto w-3.5 h-3.5 text-muted-foreground" />}
                            <input
                                type="color"
                                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_LINK_COLOR}
                                onChange={(e) => onPick(e.target.value, false)}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label="เลือกสีอื่นเอง"
                            />
                        </label>
                    </div>
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={onDelete}>
                            <X className="w-3.5 h-3.5 mr-1" /> ลบเส้น
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>เสร็จ</Button>
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
        <div className="chamfered-sm border border-border bg-popover text-popover-foreground shadow-xl w-[320px] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/40">
                <Sprout className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-technical text-[9px] uppercase tracking-widest text-muted-foreground">วางแล้ว — ผูกปมดีไหม?</span>
                <button onClick={onDismiss} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-3 w-3" />
                </button>
            </div>

            <div className="px-3 py-2.5 space-y-2">
                <p className="text-xs truncate">
                    <span className="text-amber-600 dark:text-amber-400 font-medium">"{ideaTitle}"</span>
                </p>

                <div className="flex gap-1">
                    <button
                        onClick={() => setMode("pick")}
                        className={`flex-1 h-6 text-[10px] chamfered-sm border transition-colors ${mode === "pick" ? "bg-muted border-border text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
                    >
                        ปมที่มีอยู่
                    </button>
                    <button
                        onClick={() => setMode("new")}
                        className={`flex-1 h-6 text-[10px] chamfered-sm border transition-colors ${mode === "new" ? "bg-muted border-border text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
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
                                className={`flex items-center gap-2 px-2 py-1.5 chamfered-sm border text-left text-xs transition-colors ${selectedId === t.id ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-200" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
                            >
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: t.color ?? "#f59e0b" }} />
                                <span className="truncate">{t.title}</span>
                                {selectedId === t.id && <Check className="h-3 w-3 ml-auto shrink-0 text-amber-400" />}
                            </button>
                        ))}
                    </div>
                )}

                {mode === "pick" && threads.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-1">ยังไม่มีปม — ลองสร้างใหม่</p>
                )}

                {mode === "new" && (
                    <input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="ชื่อปมใหม่…"
                        className="w-full h-8 px-2 text-xs bg-background border border-input chamfered-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/60"
                        autoFocus
                    />
                )}

                <div className="flex gap-1.5 pt-0.5">
                    <button
                        onClick={handleLink}
                        disabled={isLinking || (mode === "pick" && !selectedId) || (mode === "new" && !newTitle.trim())}
                        className="flex-1 h-7 chamfered-sm bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] font-medium hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                    >
                        {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sprout className="h-3 w-3" />}
                        {mode === "new" ? "สร้างและผูก" : "ผูกปม"}
                    </button>
                    <button
                        onClick={onDismiss}
                        className="h-7 px-2 chamfered-sm border border-border text-muted-foreground text-[11px] hover:text-foreground transition-colors"
                    >
                        ข้าม
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---- Storyboard grid: เลน (แถว) x จังหวะ/beat (คอลัมน์) ----
function LaneLabel({ lane, laneIndex, laneCount, color, stats, collapsed, locked, soloActive, isSolo, characters, onRename, onRemove, onSetColor, onSetKind, onMove, onToggleCollapse, onToggleSolo, onToggleLock, canRemove }: {
    lane: Lane;
    laneIndex: number;
    laneCount: number;
    color: string;
    stats: LaneStats;
    collapsed: boolean;
    locked: boolean;
    soloActive: boolean;
    isSolo: boolean;
    characters: any[];
    onRename: (id: string, name: string) => void;
    onRemove: (id: string) => void;
    onSetColor: (id: string, color: string) => void;
    onSetKind: (id: string, kind: LaneKind, characterId?: string | null) => void;
    onMove: (id: string, dir: -1 | 1) => void;
    onToggleCollapse: (id: string) => void;
    onToggleSolo: (id: string) => void;
    onToggleLock: (id: string) => void;
    canRemove: boolean;
}) {
    const kind = lane.kind ?? 'free';
    const boundChar = lane.characterId ? characters.find((c: any) => c.id === lane.characterId) : null;
    const silent = stats.count > 0 && stats.longestGap >= LANE_GAP_WARN;
    return (
        <div
            style={{ gridColumn: 1, gridRow: laneIndex + 3, width: LABEL_WIDTH, borderLeft: `3px solid ${color}` }}
            className={cn(
                "sticky left-0 z-20 bg-muted/60 backdrop-blur-sm border-r border-b border-border/60 px-2 py-2 transition-opacity duration-200 motion-reduce:transition-none",
                collapsed ? "min-h-[36px]" : "min-h-[140px]",
                soloActive && !isSolo && "opacity-40"
            )}
        >
            <div className="flex items-center gap-1">
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            className="h-2.5 w-2.5 rounded-full shrink-0 ring-offset-1 hover:ring-2 hover:ring-offset-background transition-shadow"
                            style={{ background: color }}
                            title="เปลี่ยนสีเลน"
                            aria-label="เปลี่ยนสีเลน"
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
                    aria-label="ชื่อเลน"
                />
                <button
                    onClick={() => onToggleCollapse(lane.id)}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title={collapsed ? "กางเลน" : "พับเลน"}
                    aria-label={collapsed ? "กางเลน" : "พับเลน"}
                    aria-expanded={!collapsed}
                >
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200 motion-reduce:transition-none", collapsed && "-rotate-90")} />
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="การกระทำของเลน" aria-label="การกระทำของเลน">
                            <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">ชนิดเลน</DropdownMenuLabel>
                        {LANE_KINDS.filter((k) => k.key !== 'pov').map((k) => (
                            <DropdownMenuItem key={k.key} onSelect={() => onSetKind(lane.id, k.key, null)}>
                                <span className="flex-1">{k.label}</span>
                                {kind === k.key && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
                            </DropdownMenuItem>
                        ))}
                        {characters.length > 0 && (
                            <>
                                <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">มุมมองตัวละคร (POV)</DropdownMenuLabel>
                                <div className="max-h-40 overflow-y-auto">
                                    {characters.map((c: any) => (
                                        <DropdownMenuItem key={c.id} onSelect={() => onSetKind(lane.id, 'pov', c.id)}>
                                            <span className="flex-1 truncate">{c.name}</span>
                                            {kind === 'pov' && lane.characterId === c.id && <Check className="w-3.5 h-3.5 text-muted-foreground" />}
                                        </DropdownMenuItem>
                                    ))}
                                </div>
                            </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onToggleSolo(lane.id)}>
                            <Eye className="w-3.5 h-3.5 mr-2" />
                            {isSolo ? "เลิกเน้นเลนนี้" : "เน้นเลนนี้เลน"}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={laneIndex === 0} onSelect={() => onMove(lane.id, -1)}>
                            <ArrowUp className="w-3.5 h-3.5 mr-2" />ย้ายขึ้น
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={laneIndex === laneCount - 1} onSelect={() => onMove(lane.id, 1)}>
                            <ArrowDown className="w-3.5 h-3.5 mr-2" />ย้ายลง
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={!canRemove} onSelect={() => onRemove(lane.id)}>
                            <X className="w-3.5 h-3.5 mr-2" />ลบเลน
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <p className="mt-1 pl-4 text-[11px] leading-snug text-muted-foreground">
                {kind === 'pov' && boundChar ? `POV ${boundChar.name}` : kind !== 'free' ? laneKindLabel(kind) : null}
                {kind !== 'free' && (kind !== 'pov' || boundChar) ? " · " : null}
                {stats.count > 0 ? `${stats.count} การ์ด` : "ยังไม่มีการ์ด"}
            </p>
            {!collapsed && (
                <div className="mt-1.5 pl-3 flex items-center gap-1">
                    <button
                        onClick={() => onToggleSolo(lane.id)}
                        aria-pressed={isSolo}
                        title={isSolo ? "เลิกเน้นเลนนี้" : "เน้นเลนนี้เลน (Solo)"}
                        aria-label="เน้นเลนนี้เลน"
                        className={cn("h-5 w-5 rounded text-[11px] font-medium transition-colors", isSolo ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                    >S</button>
                    <button
                        onClick={() => onToggleLock(lane.id)}
                        aria-pressed={locked}
                        title={locked ? "ปลดล็อกเลน" : "ล็อกเลน (กันลากการ์ดพลาด)"}
                        aria-label="ล็อกเลน"
                        className={cn("h-5 w-5 rounded flex items-center justify-center transition-colors", locked ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
                    >{locked ? <Lock className="w-3 h-3" /> : <LockOpen className="w-3 h-3" />}</button>
                </div>
            )}
            {!collapsed && silent && (
                <p
                    className="mt-0.5 pl-4 text-[11px] leading-snug text-amber-700 dark:text-amber-400"
                    title={`เลนนี้ไม่มีการ์ดต่อเนื่อง ${stats.longestGap} จังหวะ (จังหวะที่ ${stats.gapStart + 1}–${stats.gapStart + stats.longestGap})`}
                >
                    เงียบ {stats.longestGap} จังหวะ
                </p>
            )}
        </div>
    );
}

// ปุ่มเพิ่มเลน — เลือกชนิดก่อน (ถ้า POV เลือกตัวละครต่อ) แล้วเติมชื่อ/สีให้
function AddLaneButton({ characters, onAdd }: { characters: any[]; onAdd: (kind: LaneKind, characterId?: string | null) => void }) {
    const [open, setOpen] = useState(false);
    const [pickPov, setPickPov] = useState(false);
    const close = () => { setOpen(false); setPickPov(false); };
    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPickPov(false); }}>
            <PopoverTrigger asChild>
                <button
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-muted-foreground hover:text-[var(--forge-amber)] border border-dashed border-border/50 hover:border-[var(--forge-amber)]/50 chamfered-sm transition-colors"
                >
                    <Rows3 className="w-3.5 h-3.5" />เพิ่มเลน
                </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-60 p-1">
                {!pickPov ? (
                    <>
                        <p className="px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground">เลนนี้ไว้ทำอะไร</p>
                        {LANE_KINDS.map((k) => (
                            <button
                                key={k.key}
                                className="w-full text-left px-2 py-1.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
                                disabled={k.key === 'pov' && characters.length === 0}
                                onClick={() => { if (k.key === 'pov') setPickPov(true); else { onAdd(k.key); close(); } }}
                            >
                                <span className="block text-xs font-medium">{k.label}</span>
                                <span className="block text-[11px] text-muted-foreground">{k.hint}</span>
                            </button>
                        ))}
                    </>
                ) : (
                    <>
                        <button className="px-2 pt-1.5 pb-1 text-[11px] text-muted-foreground hover:text-foreground" onClick={() => setPickPov(false)}>← เลือกชนิดเลน</button>
                        <div className="max-h-56 overflow-y-auto">
                            {characters.map((c: any) => (
                                <button key={c.id} className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted transition-colors truncate" onClick={() => { onAdd('pov', c.id); close(); }}>
                                    {c.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    );
}

function BeatCell({ laneId, beatIndex, laneIndex, isTrailing, laneColor, isDrafting, collapsed, dimmed, locked, onAddIdea, children }: {
    laneId: string;
    beatIndex: number;
    laneIndex: number;
    isTrailing: boolean;
    laneColor: string;
    isDrafting?: boolean;
    collapsed?: boolean;
    dimmed?: boolean;
    locked?: boolean;
    onAddIdea?: () => void;
    children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `cell:${laneId}:${beatIndex}`,
        data: { acceptsCell: true, laneId, beatIndex },
        disabled: locked,
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
                "group/cell p-1.5 border-r border-b flex flex-col gap-1.5 transition-colors",
                collapsed ? "min-h-[36px] overflow-hidden" : "min-h-[140px]",
                dimmed && "opacity-40",
                isTrailing ? "border-dashed border-border/40" : "border-border/40",
                isOver && "bg-[var(--forge-amber)]/8 ring-1 ring-inset ring-[var(--forge-amber)]/40"
            )}
        >
            {isTrailing && !isDrafting && !collapsed && (
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

// การ์ดร่างสร้างไอเดีย inline — ช่องเดียวทำสองอย่าง: พิมพ์ชื่อใหม่ = สร้าง, หรือเลือกจากไอเดียเดิมที่ขึ้นมาให้
// (แทนที่การลากไอเดียจากแถบซ้ายซึ่งเลิกใช้แล้ว — กดที่ช่องที่ต้องการก่อน จึงไม่มีทางหย่อนผิดช่อง)
function DraftIdeaCard({ onCommit, onCancel, onPick, unusedIdeas = [] }: {
    onCommit: (title: string) => void;
    onCancel: () => void;
    onPick: (idea: any) => void;
    unusedIdeas?: any[];
}) {
    const [title, setTitle] = useState("");
    const cancelRef = useRef(false);

    const q = title.trim().toLowerCase();
    const matches = q
        ? unusedIdeas.filter((i: any) => (i.title || "").toLowerCase().includes(q)).slice(0, 4)
        : unusedIdeas.slice(0, 4);

    return (
        <div
            className="chamfered-sm border border-[var(--forge-amber)]/60 bg-card p-2 shadow-sm animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex items-center gap-1.5 mb-1">
                <Lightbulb className="w-3.5 h-3.5 text-[var(--forge-amber)]" />
                <span className="text-[9px] uppercase font-technical tracking-wide text-muted-foreground">ไอเดีย</span>
            </div>
            <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    else if (e.key === "Escape") { cancelRef.current = true; e.currentTarget.blur(); }
                }}
                onBlur={() => { if (cancelRef.current || !title.trim()) onCancel(); else onCommit(title.trim()); }}
                placeholder="ชื่อไอเดีย… (Enter = สร้างใหม่)"
                className="w-full h-7 px-1 text-sm font-semibold bg-transparent border-b border-border/60 focus:outline-none focus:border-[var(--forge-amber)]"
            />

            {matches.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                    <p className="text-[9px] uppercase font-technical tracking-wide text-muted-foreground/70">
                        หรือดึงจากคลังไอเดีย
                    </p>
                    {matches.map((idea: any) => (
                        <button
                            key={idea.id}
                            // mousedown ต้องกัน blur ไม่ให้ยิง onCommit ทับก่อนที่ click จะทำงาน
                            onMouseDown={(e) => { e.preventDefault(); cancelRef.current = true; onPick(idea); }}
                            className="w-full flex items-center gap-1.5 px-1 py-1 text-left text-xs chamfered-sm hover:bg-[var(--forge-amber)]/10 transition-colors"
                        >
                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 shrink-0" />
                            <span className="truncate">{idea.title}</span>
                        </button>
                    ))}
                </div>
            )}
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

// มือถือ: list ตามจังหวะ (เวลา) แทนกริดเลน×จังหวะ — ไม่มี drag/zoom/เส้นเชื่อม แค่ดู/แก้/เพิ่มการ์ด (เพิ่มผ่านปุ่ม "ไอเดียใหม่" ใน toolbar)
function MobilePlotList({ items, lanes, beatCount, chapterRanges, renderCard }: {
    items: any[];
    lanes: Lane[];
    beatCount: number;
    chapterRanges: Array<{ id: string; name: string; startBeat: number; endBeat: number }>;
    renderCard: (item: any, dragDisabled?: boolean) => React.ReactNode;
}) {
    if (items.length === 0) {
        return (
            <div className="flex-1 min-h-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                ยังไม่มีการ์ดในฉากนี้ — กด “ไอเดียใหม่” ด้านบนเพื่อเริ่ม
            </div>
        );
    }
    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-5">
            {Array.from({ length: beatCount }).map((_, beatIndex) => {
                const beatItems = items.filter(i => i.beatIndex === beatIndex);
                if (beatItems.length === 0) return null;
                const chapter = chapterRanges.find(c => beatIndex >= c.startBeat && beatIndex <= c.endBeat);
                return (
                    <div key={beatIndex} className="space-y-2.5">
                        <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-technical">
                            {chapter ? `${chapter.name} · ` : ""}จังหวะ {String(beatIndex + 1).padStart(2, "0")}
                        </div>
                        <div className="space-y-3">
                            {lanes.map((lane, laneIndex) => {
                                const laneItems = beatItems.filter(i => i.laneId === lane.id);
                                if (laneItems.length === 0) return null;
                                const laneColor = lane.color || LANE_COLORS[laneIndex % LANE_COLORS.length];
                                return laneItems.map(item => (
                                    <div key={item.id}>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: laneColor }} />
                                            <span className="text-[10px] text-muted-foreground truncate">{lane.name}</span>
                                        </div>
                                        {renderCard(item, true)}
                                    </div>
                                ));
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export function PlaygroundBoard({
    eventId,
    novelId,
    initialItems,
    event,
    sceneEvents = [],
    characters,
    ideas,
    threads = [],
    factions = [],
    powers = [],
    items: worldItems = [],
    entities = [],
    worldSystems = [],
    boardChapters = [],
    tonePresets = [],
    initialEchoFindings = [],
    participantLinks,
    initialSceneRecap = null,
}: PlaygroundBoardProps) {
    const [{ lanes, items: initialCardItems, chapters: initialChapters, keptNodes: initialKept }] = useState(() => buildBoardState(initialItems, ideas));
    const [lanes_, setLanes] = useState<Lane[]>(lanes);
    // สถานะมุมมองเลน (ไม่บันทึกลง DB): เลนที่พับ + เลนที่เน้น (เลนอื่นจางลง)
    const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
    const [soloLaneId, setSoloLaneId] = useState<string | null>(null);
    // แบบแทร็กวิดีโอ: ล็อกเลน (ลากการ์ดเข้า/ออกไม่ได้) · ซูมกระดาน · หัวอ่าน (จังหวะที่กำลังดู)
    const [lockedLanes, setLockedLanes] = useState<Set<string>>(new Set());
    const [boardZoom, setBoardZoom] = useState(BOARD_ZOOM_DEFAULT);
    const [playBeat, setPlayBeat] = useState<number | null>(null);
    const [keptNodes, setKeptNodes] = useState<any[]>(initialKept);
    // สีล่าสุดที่ผู้ใช้เลือก — เส้นใหม่ใช้สีนี้ (เลือกครั้งเดียว ลากต่อได้เลย)
    const [lastLinkColor, setLastLinkColor] = useState<string>(DEFAULT_LINK_COLOR);
    const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
    const [items, setItems] = useState<any[]>(initialCardItems);
    const [echoFindings, setEchoFindings] = useState<EchoFinding[]>(initialEchoFindings);
    const echoByCardId = useMemo(() => new Map(echoFindings.map(f => [f.cardId, f])), [echoFindings]);
    // การ์ด idea รันเฉพาะการ์ดตัวเองได้จาก dialog แยกจากปุ่ม "ตรวจ Echo ใหม่" ของทั้งบอร์ด — sync ผลกลับเข้า state เดียวกัน กัน badge ค้างผลเก่า
    const handleEchoResult = useCallback((finding: EchoFinding) => {
        setEchoFindings(prev => [...prev.filter(f => f.cardId !== finding.cardId), finding]);
    }, []);

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
    // สัญญาณเตือนของผู้ช่วยแต่ละตัว รวมขึ้นมาที่ปุ่มเดียว — ไม่งั้นคำเตือนจะถูกซ่อนในกล่องที่ยังไม่เปิด
    const [recapWarning, setRecapWarning] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const isMobile = useIsMobile();
    // ไอเดียใหม่จะวางที่จังหวะไหน: 'latest' = จังหวะล่าสุด (คอลัมน์ที่มีอยู่) | 'new' = จังหวะใหม่ (คอลัมน์ท้าย)
    const [newIdeaBeat, setNewIdeaBeat] = useState<'latest' | 'new'>('new');
    const [newIdeaLaneId, setNewIdeaLaneId] = useState<string>(''); // '' = เลนแรก

    // ไอเดียที่ยังไม่ถูกวางบนกระดานนี้ — เช็คจาก items ด้วย ไม่ใช่แค่ flag isUsed ที่อาจตามไม่ทัน
    const unusedIdeas = useMemo(() => {
        const onBoard = new Set(items.filter((i: any) => i.type === 'idea').map((i: any) => i.referenceId));
        return (ideas || []).filter((i: any) => !i.isUsed && !onBoard.has(i.id));
    }, [ideas, items]);

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
        suggestThreadBind(idea.title);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftCell, novelId]);

    // หลังวางไอเดียลงกระดาน ชวนผูกปม — เฉพาะตอนที่นิยายมีปมอยู่แล้ว
    // ถ้ายังไม่มีปมเลยสักเส้น ผู้เขียนใหม่ยังไม่รู้จัก "ปม" ด้วยซ้ำ การเด้งทันทีจะกลายเป็นขวางจังหวะ
    // function declaration ตั้งใจ — hoist ขึ้นไปให้ handler ที่ประกาศก่อนหน้าเรียกได้ โดยไม่ต้องสลับลำดับทั้งไฟล์
    function suggestThreadBind(ideaTitle: string) {
        if (threadState.length === 0) return;
        setThreadSuggest({
            ideaTitle: ideaTitle || "ไอเดียนี้",
            selectedThreadId: threadState[0]?.id ?? "",
            newThreadTitle: ideaTitle || "",
            mode: "pick",
            isLinking: false,
        });
        toast(
            <ThreadSuggestToast
                ideaTitle={ideaTitle || "ไอเดียนี้"}
                threads={threadState}
                novelId={novelId}
                eventId={eventId}
                onDismiss={() => toast.dismiss("thread-suggest")}
            />,
            { id: "thread-suggest", duration: 8000, unstyled: true, classNames: { toast: "w-full" } }
        );
    }

    // วางไอเดียที่มีอยู่แล้วลงช่อง — เดิมทำได้ทางเดียวคือลากจากแถบซ้าย
    const handlePickExistingIdea = useCallback((cell: { laneId: string; beatIndex: number }, idea: any) => {
        setDraftCell(null);
        setItems(prev => [...prev, {
            id: crypto.randomUUID(), type: 'idea', referenceId: idea.id,
            title: idea.title, content: idea.content || '',
            laneId: cell.laneId, beatIndex: cell.beatIndex, children: [], links: [],
        }]);
        updateIdea(idea.id, { isUsed: true });
        suggestThreadBind(idea.title);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const [, setThreadSuggest] = useState<{
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
            // ต้องหารด้วย boardZoom กลับเป็นหน่วย local ก่อนเอาไปวาด path ไม่งั้นเส้นจะเพี้ยนซ้อน
            next.set(id, {
                x: (r.left - containerRect.left + r.width / 2) / boardZoom,
                y: (r.top - containerRect.top + r.height / 2) / boardZoom,
                w: r.width / boardZoom,
                h: r.height / boardZoom,
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
    }, [boardZoom]);

    // การ์ดสูงขึ้นหลัง note/children/ancestor โหลด async → ต้องวัดใหม่ ไม่งั้น anchor ค้างที่กึ่งกลางเก่า (เลื่อนไปด้านบน)
    useLayoutEffect(() => {
        recomputePositions();
    }, [items, lanes_, chapters, ideaNotes, elementDetailsMap, ancestorConnections, collapsedLanes, recomputePositions]);

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

    // สถิติเลน: จำนวนการ์ด + ช่วงจังหวะว่างติดกันที่ยาวสุด (นับเฉพาะ 0..beatCount-1 ของฉากนี้)
    const laneStats = useMemo(() => {
        const m = new Map<string, LaneStats>();
        lanes_.forEach(lane => {
            const mine = items.filter(i => i.laneId === lane.id);
            const occupied = new Set<number>(mine.map(i => i.beatIndex).filter((b: any) => typeof b === 'number'));
            let longest = 0, start = 0, run = 0, runStart = 0;
            for (let b = 0; b < beatCount; b++) {
                if (occupied.has(b)) { run = 0; continue; }
                if (run === 0) runStart = b;
                run++;
                if (run > longest) { longest = run; start = runStart; }
            }
            m.set(lane.id, { count: mine.length, longestGap: longest, gapStart: start });
        });
        return m;
    }, [lanes_, items, beatCount]);


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

    // ลากบนแถบตอนเพื่อแบ่งตอนทันที ไม่ต้องเปิด popover ตั้งชื่อก่อน
    // ชื่อใช้ "ตอนที่ N" อัตโนมัติ — อยากเปลี่ยนค่อยกดที่แถบตอนทีหลัง (popover เดิม)
    const [dragBeat, setDragBeat] = useState<{ from: number; to: number } | null>(null);
    const dragBeatRef = useRef<{ from: number; to: number } | null>(null);
    dragBeatRef.current = dragBeat;

    // หนีบช่วงไม่ให้คร่อมตอนที่มีอยู่ — ลากชนแล้วหยุดที่ขอบ (ตอนซ้อนกันทำให้แถบกริดพัง)
    const clampChapterRange = useCallback((from: number, to: number) => {
        const dir = to >= from ? 1 : -1;
        let last = from;
        for (let b = from; dir > 0 ? b <= to : b >= to; b += dir) {
            if (chapterRanges.some(c => b >= c.startBeat && b <= c.endBeat)) break;
            last = b;
        }
        return { startBeat: Math.min(from, last), endBeat: Math.max(from, last) };
    }, [chapterRanges]);

    useEffect(() => {
        if (!dragBeat) return;
        // ผูกที่ window ไม่ใช่ที่ cell — ปล่อยเมาส์นอกแถบต้องจบ drag ด้วย ไม่งั้น state ค้าง
        const end = () => {
            const d = dragBeatRef.current;
            setDragBeat(null);
            if (!d) return;
            const { startBeat, endBeat } = clampChapterRange(d.from, d.to);
            addChapter({ name: `ตอนที่ ${nextChapterNumber}`, startBeat, endBeat });
        };
        const cancel = (e: KeyboardEvent) => { if (e.key === 'Escape') setDragBeat(null); };
        window.addEventListener('pointerup', end);
        window.addEventListener('keydown', cancel);
        return () => { window.removeEventListener('pointerup', end); window.removeEventListener('keydown', cancel); };
    }, [dragBeat, clampChapterRange, addChapter, nextChapterNumber]);

    // Sync เมื่อเปลี่ยนฉาก
    useEffect(() => {
        const { lanes: newLanes, items: newItems, keptNodes: newKept } = buildBoardState(initialItems);
        setLanes(newLanes);
        setItems(newItems);
        setKeptNodes(newKept);
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

    // กันปิดแท็บ/รีเฟรชระหว่างที่ autosave ยังไม่ลง — หน้าต่างนี้กว้าง 2 วิ + เวลาที่ยิงจริง
    // ceiling: เปลี่ยนหน้าในแอปเอง (next/link) ไม่ยิง beforeunload ต้องดัก router event ถึงจะกันได้
    const savePending = useRef(false);
    useEffect(() => {
        const warn = (e: BeforeUnloadEvent) => {
            if (!savePending.current) return;
            e.preventDefault();
            e.returnValue = ""; // เบราว์เซอร์เก่ายังต้องการค่านี้ถึงจะขึ้นกล่องยืนยัน
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, []);

    // Auto-save (items + lanes)
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        savePending.current = true;
        const timeoutId = setTimeout(async () => {
            setIsSaving(true);
            const laneNodes = lanes_.map(l => ({ id: l.id, type: 'lane', name: l.name, orderIndex: l.orderIndex, color: l.color, kind: l.kind, characterId: l.characterId ?? null }));
            const chapterNodes = chapters.map(c => ({ id: c.id, type: 'chapter', name: c.name, startBeat: c.startBeat, endBeat: c.endBeat }));
            const result = await updateTimelineCanvas(eventId, [...items, ...laneNodes, ...chapterNodes, ...keptNodes]);
            if (result.success) {
                setLastSaved(new Date());
                savePending.current = false; // ยิงพลาดยังถือว่าค้าง — ให้เตือนตอนปิดแท็บต่อไป
            } else {
                toast.error("บันทึกอัตโนมัติไม่สำเร็จ — ลองแก้อะไรสักอย่างเพื่อบันทึกใหม่");
            }
            setIsSaving(false);
        }, 2000);
        return () => clearTimeout(timeoutId);
    }, [items, lanes_, chapters, keptNodes, eventId]);

    // Linking Handlers
    const linkingStartCount = useRef(0);
    const handleStartLink = (id: string) => {
        if (linkingSourceId === id) {
            setLinkingSourceId(null);
            toast.info("โหมดเชื่อมเส้น: ยกเลิกแล้ว");
        } else {
            linkingStartCount.current = items.find(i => i.id === id)?.links?.length || 0;
            setLinkingSourceId(id);
            toast.info("โหมดเชื่อมเส้น: คลิกการ์ดที่จะเชื่อมด้วย");
        }
    };

    // เชื่อมอยู่แล้วทั้งสองทิศ (A→B หรือ B→A) นับเป็นซ้ำ — สองเส้นสวนกันวิ่งทับจนกดเส้นล่างไม่ได้
    const isLinked = (list: any[], a: string, b: string) => list.some(i =>
        (i.id === a && (i.links || []).some((l: any) => normalizeLink(l).targetId === b)) ||
        (i.id === b && (i.links || []).some((l: any) => normalizeLink(l).targetId === a)));

    // การ์ดหายจากกระดาน (ลบ/ซ้อนเข้าไอเดีย) → ตัดเส้นที่ชี้มาหามัน ไม่งั้น targetId ค้างถูกเซฟลง DB
    const stripLinksTo = (list: any[], goneId: string) => list.map(i =>
        (i.links || []).some((l: any) => normalizeLink(l).targetId === goneId)
            ? { ...i, links: i.links.filter((l: any) => normalizeLink(l).targetId !== goneId) }
            : i);

    // คืน true ถ้าเพิ่มเส้นได้ — เช็คซ้ำนอก updater เพื่อไม่ให้ toast เด้งซ้ำใน StrictMode
    const addLink = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return false;
        if (isLinked(items, sourceId, targetId)) { toast.info("เชื่อมกันอยู่แล้ว"); return false; }
        setItems(prev => isLinked(prev, sourceId, targetId) ? prev : prev.map(item => item.id === sourceId
            ? { ...item, links: [...(item.links || []), { targetId, kind: "related", label: null, color: lastLinkColor }] }
            : item));
        return true;
    };

    const handleCompleteLink = (targetId: string) => {
        if (!linkingSourceId) return;
        addLink(linkingSourceId, targetId);
    };

    const handleFinishLinking = () => {
        const sourceItem = items.find(i => i.id === linkingSourceId);
        const added = Math.max(0, (sourceItem?.links?.length || 0) - linkingStartCount.current);
        setLinkingSourceId(null);
        toast.success(`เชื่อมเสร็จแล้ว! เพิ่ม ${added} เส้น`);
    };

    const handleCancelLink = () => {
        setLinkingSourceId(null);
        toast.info("ยกเลิกการเชื่อม");
    };

    // ลบเส้น = ลบแค่เส้น (ไม่แตะผู้เข้าร่วมของการ์ดปลายทาง เส้นเก่าที่เคยก๊อปมาให้ถือเป็นข้อมูลปกติของการ์ดไปแล้ว)
    const handleUnlink = (sourceId: string, targetId: string) => {
        setItems(prev => prev.map(item => item.id === sourceId
            ? { ...item, links: (item.links || []).filter((l: any) => normalizeLink(l).targetId !== targetId) }
            : item));
    };

    const handleUpdateLink = (sourceId: string, targetId: string, patch: { color?: string }) => {
        setItems(prev => prev.map(item => item.id === sourceId
            ? { ...item, links: (item.links || []).map((l: any) => { const n = normalizeLink(l); return n.targetId === targetId ? { ...n, ...patch } : n; }) }
            : item));
    };

    // Navigator: scroll การ์ดเข้าจอ (ไม่มี pan/zoom แล้ว)
    const handleCenterOnItem = (itemId: string) => {
        const el = itemRefs.current.get(itemId);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        setShowNavigator(false);
    };


    // จังหวะผิดปกติ (เอื่อย/เร่งค้าง/แบน) หรือเหตุ-ผลไม่สมเหตุผล → ปุ่ม "ผู้ช่วย" ติดจุดเตือน
    const assistantAttention = useMemo(() => {
        const beatCards = items
            .filter((it: any) => it.type === "idea")
            .map((it: any) => ({ id: it.referenceId || it.id, beatIndex: it.beatIndex ?? 0, pacing: typeof it.pacing === "number" ? it.pacing : null }));
        const state = analyzeBeats(collapseByBeat(beatCards)).state;
        return recapWarning || state === "dragging" || state === "overheated" || state === "flat";
    }, [items, recapWarning]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
                shouldActivate: (event: any) => !linkingSourceId && event.button === 0,
            },
        }),
        // ลากด้วยคีย์บอร์ดได้ (Space/Enter จับ, ลูกศรเลื่อน) — ไม่งั้นฟีเจอร์หลักใช้ได้เฉพาะเมาส์
        useSensor(TypingSafeKeyboardSensor)
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

    // เรียงลำดับ beat ตามทิศของเส้นเชื่อม (ต้นทาง→ปลายทาง) คงเลนเดิม แค่ปรับคอลัมน์
    const handleAutoArrange = () => {
        if (items.length === 0) return;
        const prevState = new Map(items.map(i => [i.id, i.beatIndex]));

        const ideaItems = items.filter(i => i.type === 'idea');
        const leadsTo = new Map<string, string[]>();
        ideaItems.forEach(i => {
            const targets = (i.links || []).map(normalizeLink)
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
        toast.success('เรียงจังหวะตามทิศของเส้นเชื่อมแล้ว', {
            action: {
                label: 'ย้อนกลับ',
                onClick: () => setItems(cur => cur.map(i => prevState.has(i.id) ? { ...i, beatIndex: prevState.get(i.id) } : i)),
            },
        });
    };

    // ชื่อเริ่มต้นตามชนิดเลน — ผู้ใช้แก้ได้ทีหลัง (POV ใช้ชื่อตัวละคร)
    const handleAddLane = (kind: LaneKind = 'free', characterId?: string | null) => {
        setLanes(prev => {
            const nth = prev.filter(l => (l.kind ?? 'free') === kind).length + 1;
            const charName = characterId ? characters.find((c: any) => c.id === characterId)?.name : undefined;
            const name = kind === 'pov' ? `POV ${charName ?? ''}`.trim()
                : kind === 'main' ? (nth === 1 ? 'เรื่องหลัก' : `เรื่องหลัก ${nth}`)
                : kind === 'sub' ? `เรื่องรอง ${nth}`
                : kind === 'time' ? `ไทม์ไลน์ ${nth}`
                : `เลน ${prev.length + 1}`;
            return [...prev, { id: crypto.randomUUID(), name, orderIndex: prev.length, color: LANE_COLORS[prev.length % LANE_COLORS.length], kind, characterId: kind === 'pov' ? (characterId ?? null) : null }];
        });
    };
    const handleSetLaneKind = (laneId: string, kind: LaneKind, characterId?: string | null) => {
        setLanes(prev => prev.map(l => l.id === laneId ? { ...l, kind, characterId: kind === 'pov' ? (characterId ?? null) : null } : l));
    };
    const handleMoveLane = (laneId: string, dir: -1 | 1) => {
        setLanes(prev => {
            const i = prev.findIndex(l => l.id === laneId);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[i], next[j]] = [next[j], next[i]];
            return next.map((l, idx) => ({ ...l, orderIndex: idx }));
        });
        toast.info('เลขการ์ด #LBBN เปลี่ยนตามลำดับเลน');
    };
    const toggleLaneCollapse = (laneId: string) => setCollapsedLanes(prev => {
        const next = new Set(prev);
        if (next.has(laneId)) next.delete(laneId); else next.add(laneId);
        return next;
    });
    const toggleLaneLock = (laneId: string) => setLockedLanes(prev => {
        const next = new Set(prev);
        if (next.has(laneId)) next.delete(laneId); else next.add(laneId);
        return next;
    });
    const toggleLaneSolo = (laneId: string) => setSoloLaneId(cur => cur === laneId ? null : laneId);
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
            if (targetId) addLink(sourceId, targetId); // ลากปุ๊ปจบ — เส้นใช้สีล่าสุด ไม่เปิดไดอะล็อก
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
                    // การ์ดที่ซ้อนเข้าไอเดียออกจากกระดาน → ตัดเส้นที่ชี้มาหามันด้วย ไม่ให้ค้างใน DB
                    return stripLinksTo(prev.map(item => item.id === over.id
                        ? { ...item, children: [...(item.children || []), activeItem] }
                        : item
                    ).filter(i => i.id !== active.id), String(active.id));
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

    };

    const handleSetColor = (id: string, color: string | null) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, color } : item));
    };

    // โครงฉากดราม่าของการ์ดไอเดีย — patch เข้า item ทันทีหลัง IdeaDramaticPanel เซฟสำเร็จ
    // (ค่าจริงอยู่ที่ ideas table แล้ว ตรงนี้แค่ sync ให้ canvas ไม่ค้างค่าเก่าจนกว่าจะ reload)
    const handleSetSceneDrama = (id: string, patch: Record<string, unknown>) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, ...patch } : item));
    };

    // เหตุการณ์สำคัญ (mock) — เก็บ label ใน canvas node, auto-save เดิมจัดการต่อ
    // เปลี่ยนชื่อไอเดียจากบนกระดาน — ชื่ออยู่สองที่ (ideas.title คือแหล่งจริง, item.title ใน canvasData คือสำเนา)
    // เขียนทั้งคู่ ไม่งั้นอีกฝั่งค้างค่าเก่าจนกว่าจะ reload
    const handleRenameIdea = async (id: string, nextTitle: string) => {
        const target = items.find(i => i.id === id);
        const clean = nextTitle.trim();
        if (!target || !clean || clean === target.title) return;

        setItems(prev => prev.map(i => (i.id === id ? { ...i, title: clean } : i)));
        if (!target.referenceId) return; // การ์ดที่ยังไม่ผูกกับไอเดียจริง — เก็บแค่บน canvas

        const res = await updateIdea(target.referenceId, { title: clean });
        if (!res.success) {
            setItems(prev => prev.map(i => (i.id === id ? { ...i, title: target.title } : i)));
            toast.error("เปลี่ยนชื่อไอเดียไม่สำเร็จ");
        }
    };

    const handleSetKeyMoment = (id: string, label: string | null) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, keyMomentLabel: label } : item));
    };

    // ปักหมุดการ์ดว่าเป็น "คำบรรยาย/Narrator" (ไม่มีฉาก ไม่มีตัวละครร่วม) — เก็บใน canvas node เหมือน keyMoment, ไม่ต้องเพิ่มคอลัมน์ DB
    const handleSetNarration = (id: string, isNarration: boolean) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, isNarration } : item));
    };

    const handleRemoveItem = async (id: string) => {
        const removedItem = items.find(item => item.id === id);
        setItems((prev) => stripLinksTo(prev.filter((item) => item.id !== id), id));
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
                notes: (notesByItem.get(item.id) ?? []).map(n => ({ ...n, notes: noteToPlain(n.notes) })),
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
            // ให้ไฟล์ที่ export ออกไปเห็นโครงชั้นเหมือนที่เห็นบนจอ (P-nest)
            nestWorld: {
                charFactions: participantLinks?.charFactions,
                charPowers: participantLinks?.charPowers,
                items: worldItems as any[],
                powers: powers as any[],
            },
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
        // จุดต่อซ้าย/ขวาวัดจากขอบบนของการ์ด (แถวชื่อ) ไม่ใช่กึ่งกลาง — การ์ดที่ขอบบนเท่ากันแต่ความสูงต่างกัน
        // (ผู้เข้าร่วมยาว 1 vs 2 บรรทัด) จะได้เส้นตรงระดับเดียวกัน ไม่ต้องหักขึ้นลงเล็ก ๆ ระหว่างทาง
        const SIDE_ANCHOR_FROM_TOP = 44;
        const sideAnchorY = (pos: { y: number; h: number }) => pos.y - pos.h / 2 + Math.min(SIDE_ANCHOR_FROM_TOP, pos.h / 2);
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

        // เส้น converge/split หลายเส้นที่ใช้ node+ทิศเดียวกัน เดิม busX ตรงกันเป๊ะ (ฝั่ง target/source
        // ใช้ mergeY เดียวกันด้วย) จึงวิ่งทับกันสนิทตลอดช่วงบัส อ่านไม่ออกว่ามีกี่เส้น —
        // จัดลำดับ index ต่อกลุ่ม (target/source เดียวกัน + ทิศเดียวกัน) แล้วถ่างบัสออกทีละขั้น
        // ก่อนถึง pass "จัด track" ทั่วไป (ซึ่งจัดเฉพาะกรณีบังเอิญ x ใกล้กัน ไม่ได้ตั้งใจแยกกลุ่มนี้)
        const BUS_STEP = 18;
        // ขาสุดท้ายเดิมใช้ mergeY ค่าเดียวกันทั้งกลุ่ม หัวลูกศรจึงตกจุดเดียวกันเป๊ะ
        // ต่อให้บัสถ่างแล้วก็ยังอ่านเป็นเส้นเดียว — ถ่างจุดเข้าการ์ดด้วย
        //
        // สำคัญ: clamp ที่ "จุดศูนย์กลางของกลุ่ม" ไม่ใช่ที่เส้นแต่ละเส้น
        // เดิมทำ clamp(mergeY + offset) ทีละเส้น พอ mergeY ตกนอกการ์ด (source อยู่คนละเลน
        // ค่าเฉลี่ยจึงหลุดไปไกล) ทุกเส้นชนเพดานเดียวกัน ระยะถ่างหายเกลี้ยง กลับไปทับเหมือนเดิม
        const ENTRY_STEP_MIN = 14;  // แคบกว่านี้เส้นหนา 6-8px เหลือช่องว่างไม่พอให้ตาแยก
        const ENTRY_STEP_MAX = 36;  // กว้างกว่านี้เส้นเข้าคนละมุมการ์ด ไม่เหลือความเป็นกลุ่ม
        const ENTRY_PAD = 10;       // เท่ากับ clampY — จุดเข้าไม่เกาะขอบการ์ดพอดี
        // y ของจุดเข้าเส้นที่ idx ในกลุ่มขนาด n บนการ์ด pos
        const entryY = (mergeY: number, pos: { y: number; h: number }, idx: number, n: number) => {
            if (n <= 1) return clampY(mergeY, pos);
            const band = Math.max(0, pos.h - ENTRY_PAD * 2);
            // ยืดตามที่ว่างจริง แล้วคุมเพดาน/พื้น — การ์ดเตี้ยมากยอมให้แคบกว่าพื้น เพราะทับกันแย่กว่าแน่น
            const step = Math.min(ENTRY_STEP_MAX, Math.max(ENTRY_STEP_MIN, band / (n + 1)), band / (n - 1));
            const span = step * (n - 1);
            const lo = pos.y - pos.h / 2 + ENTRY_PAD + span / 2;
            const hi = pos.y + pos.h / 2 - ENTRY_PAD - span / 2;
            const center = Math.max(lo, Math.min(hi, mergeY));
            return center + (idx - (n - 1) / 2) * step;
        };
        const busGroupIndex = new Map<typeof edges[number], number>();
        const busGroupSize = new Map<typeof edges[number], number>();
        {
            const groups = new Map<string, typeof edges>();
            edges.forEach(e => {
                const converge = (inCount.get(e.targetId) ?? 0) > 1;
                const split = !converge && (outCount.get(e.sourceId) ?? 0) > 1;
                if (!converge && !split) return;
                const dir = e.tPos.x >= e.sPos.x ? 1 : -1;
                const key = converge ? `to:${e.targetId}:${dir}` : `from:${e.sourceId}:${dir}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(e);
            });
            groups.forEach(list => {
                // เรียงลำดับให้คงที่ (ไม่ขึ้นกับลำดับ insert) — ตามตำแหน่ง y ของปลายอีกฝั่ง
                list.sort((a, b) => (a.sPos.y + a.tPos.y) - (b.sPos.y + b.tPos.y));
                list.forEach((e, i) => { busGroupIndex.set(e, i); busGroupSize.set(e, list.length); });
            });
        }
        // การ์ดที่ทั้งรับหลายเส้นและส่งหลายเส้น: กลุ่มข้างบนยกให้ฝั่ง converge หมด
        // ขาออกจากต้นทางเลยออกจุดเดียวกันทับกัน — ถ่างจุดออกแยกอีกชุด ตามต้นทาง+ทิศ
        const outIndex = new Map<typeof edges[number], number>();
        const outSize = new Map<typeof edges[number], number>();
        {
            const groups = new Map<string, typeof edges>();
            edges.forEach(e => {
                if ((inCount.get(e.targetId) ?? 0) <= 1 || (outCount.get(e.sourceId) ?? 0) <= 1) return;
                const key = `${e.sourceId}:${e.tPos.x >= e.sPos.x ? 1 : -1}`;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key)!.push(e);
            });
            groups.forEach(list => {
                list.sort((a, b) => a.tPos.y - b.tPos.y);
                list.forEach((e, i) => { outIndex.set(e, i); outSize.set(e, list.length); });
            });
        }

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
                const idx = busGroupIndex.get(e) ?? 0;
                const n = busGroupSize.get(e) ?? 1;
                const busOffset = idx * BUS_STEP;
                let busX: number, aY: number, bY: number;
                if (converge) {
                    busX = bX - dir * (GAP + busOffset);
                    aY = outIndex.has(e) ? entryY(sourceMergeY.get(e.sourceId)!, e.sPos, outIndex.get(e)!, outSize.get(e)!) : e.sPos.y;
                    bY = entryY(targetMergeY.get(e.targetId)!, e.tPos, idx, n); }
                else { busX = aX + dir * (GAP + busOffset); aY = entryY(sourceMergeY.get(e.sourceId)!, e.sPos, idx, n); bY = e.tPos.y; }
                points = [{ x: aX, y: aY }, { x: busX, y: aY }, { x: busX, y: bY }, { x: bX, y: bY }];
            } else if (sItem && tItem && sItem.beatIndex === tItem.beatIndex && (() => {
                // การ์ดอยู่ซ้อนกันในคอลัมน์เดียว และไม่มีการ์ดอื่นคั่นกลาง → เส้นดิ่งสั้น ๆ จากขอบล่างลงขอบบน
                // (เดิมออกขวาแล้ววนเข้าขวา เป็นห่วงรูปตัว C ยึกยัก)
                if (Math.abs(e.sPos.x - e.tPos.x) > 6) return false;
                const down = e.tPos.y > e.sPos.y;
                const yA = down ? e.sPos.y + e.sPos.h / 2 : e.sPos.y - e.sPos.h / 2;
                const yB = down ? e.tPos.y - e.tPos.h / 2 : e.tPos.y + e.tPos.h / 2;
                const lo = Math.min(yA, yB), hi = Math.max(yA, yB);
                if ((down && yB < yA) || (!down && yB > yA)) return false; // การ์ดทับกัน ใช้เส้นอ้อมเดิม
                return ![...linkPositions.entries()].some(([id, p]) =>
                    id !== e.sourceId && id !== e.targetId &&
                    Math.abs(p.x - e.sPos.x) < p.w / 2 && p.y + p.h / 2 > lo && p.y - p.h / 2 < hi);
            })()) {
                const down = e.tPos.y > e.sPos.y;
                points = [
                    { x: e.sPos.x, y: down ? e.sPos.y + e.sPos.h / 2 : e.sPos.y - e.sPos.h / 2 },
                    { x: e.sPos.x, y: down ? e.tPos.y - e.tPos.h / 2 : e.tPos.y + e.tPos.h / 2 },
                ];
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
                const ps0 = anchorOn(e.sPos, sSide);
                const pt0 = anchorOn(e.tPos, tSide);
                const ps = sSide === 'right' || sSide === 'left' ? { x: ps0.x, y: sideAnchorY(e.sPos) } : ps0;
                const pt = tSide === 'right' || tSide === 'left' ? { x: pt0.x, y: sideAnchorY(e.tPos) } : pt0;
                const s1 = { x: ps.x + SIDE_VEC[sSide][0] * GAP, y: ps.y };
                const t1 = { x: pt.x + SIDE_VEC[tSide][0] * GAP, y: pt.y };
                // ขาแนวนอนยาวที่ y ของต้นทางผ่ากลางการ์ดที่คั่นอยู่ระหว่างจังหวะ →
                // ถ้ามีการ์ดขวาง ยกขานี้ขึ้น/ลงไปวิ่งเหนือ/ใต้กลุ่มที่ขวาง (เลือกฝั่งที่อ้อมน้อยกว่า)
                const x0 = Math.min(s1.x, t1.x), x1 = Math.max(s1.x, t1.x);
                const blockers = [...linkPositions.entries()].filter(([id, p]) =>
                    id !== e.sourceId && id !== e.targetId &&
                    p.x + p.w / 2 > x0 && p.x - p.w / 2 < x1 &&
                    s1.y > p.y - p.h / 2 && s1.y < p.y + p.h / 2).map(([, p]) => p);
                if (blockers.length) {
                    const above = Math.min(...blockers.map(p => p.y - p.h / 2)) - 8;
                    const below = Math.max(...blockers.map(p => p.y + p.h / 2)) + 8;
                    // ponytail: อ้อมชั้นเดียว — ขาที่ยกไปแล้วอาจชนการ์ดเลนข้างเคียงได้อีก ถ้าเจอบ่อยค่อยทำ routing ในร่องเลน
                    const midY = Math.abs(above - s1.y) <= Math.abs(below - s1.y) ? above : below;
                    points = [ps, s1, { x: s1.x, y: midY }, { x: t1.x, y: midY }, t1, pt];
                } else {
                    points = [ps, s1, { x: t1.x, y: s1.y }, t1, pt];
                }
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
                // clamp เข้าการ์ดปลายทาง — y ที่คิดจากการ์ดที่ชนอาจหลุดขอบปลายทาง หัวศรไปลอยในที่ว่าง
                const newY = clampY(sourceAbove ? p.y - p.h / 2 - 8 : p.y + p.h / 2 + 8, e.tPos);
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
            // หาช่องว่างที่ใกล้ x เดิมที่สุด สลับซ้าย/ขวา — เดิมดันขวาอย่างเดียว
            // เส้นหลัง ๆ ในร่องแน่นเลยถูกดันจนเลยร่องไปทับคอลัมน์การ์ดถัดไป
            const free = (cx: number) => !placed.some(p =>
                v.y0 < p.y1 && v.y1 > p.y0 && Math.abs(cx - p.x) < MIN_GUTTER_GAP);
            let x = v.x;
            for (let k = 1; !free(x) && k < 200; k++) {
                const off = Math.ceil(k / 2) * (MIN_GUTTER_GAP / 2) * (k % 2 ? 1 : -1);
                x = v.x + off;
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

        return built.map(({ e, points }) => (
            <OrthoLine
                key={`${e.sourceId}-${e.targetId}`}
                points={points}
                color={linkColor(e.link)}
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

    // เลขการ์ด #LBBN — L=เลน, BB=จังหวะ, N=ลำดับในช่องตามแกน y
    // ต้องเป็น map ก้อนเดียว เพราะลำดับในช่องต้องรู้ทั้งกระดาน การ์ดใบเดียวคำนวณเองไม่ได้
    const frameNoById = useMemo(() => {
        const m = new Map<string, string>();
        const d = (n: number) => String(Math.min(n, 9)); // ponytail: เพดาน 9 ตามที่ตกลง เกินกว่านั้นเลขชนกัน
        lanes_.forEach((lane, laneIndex) => {
            const byBeat = new Map<number, any[]>();
            items.filter(i => i.laneId === lane.id).forEach(i => {
                const b = i.beatIndex ?? 0;
                if (!byBeat.has(b)) byBeat.set(b, []);
                byBeat.get(b)!.push(i);
            });
            byBeat.forEach((cell, beatIndex) => cell.forEach((i, idx) =>
                m.set(i.id, `#${d(laneIndex + 1)}${String(beatIndex + 1).padStart(2, "0")}${d(idx + 1)}`)));
        });
        return m;
    }, [items, lanes_]);

    // การ์ดหนึ่งใบ — ใช้ร่วมกันทั้งกริด desktop และ list มือถือ (dragDisabled ปิด drag/connect บนมือถือ)
    const renderCard = (item: any, dragDisabled = false) => (
        <DraggableCanvasItem
            key={item.id}
            item={item}
            frameNo={frameNoById.get(item.id)}
            dragDisabled={dragDisabled}
            onRemove={() => handleRemoveItem(item.id)}
            onRemoveChild={(childId: string) => handleRemoveChild(item.id, childId)}
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
            powers={powers}
            items={worldItems}
            entities={entities}
            worldSystems={worldSystems}
            participantLinks={participantLinks}
            ideas={ideas}
            onAddChild={handleAddChild}
            onUpdateChild={handleUpdateChild}
            onPromoteDummy={handlePromoteDummy}
            onDetailSaved={handleDetailSaved}
            onSetColor={(c: string | null) => handleSetColor(item.id, c)}
            onSetSceneDrama={(patch: Record<string, unknown>) => handleSetSceneDrama(item.id, patch)}
            tonePresets={tonePresets}
            onRenameIdea={item.type === 'idea' ? (t: string) => handleRenameIdea(item.id, t) : undefined}
            onSetKeyMoment={item.type === 'idea' ? (label: string | null) => handleSetKeyMoment(item.id, label) : undefined}
            onSetNarration={item.type === 'idea' ? (v: boolean) => handleSetNarration(item.id, v) : undefined}
            threadBeats={item.type === 'idea' ? (cardBeats.get(item.id) ?? []) : undefined}
            onOpenThreadBind={item.type === 'idea' ? () => setThreadBindItem(item) : undefined}
            onMeasureRef={registerItemRef}
            echoFinding={echoByCardId.get(item.id)}
            onEchoResult={handleEchoResult}
        />
    );

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
                            <Button variant={showNavigator ? "secondary" : "ghost"} size="sm"
                                className="h-8 gap-1.5 text-xs pointer-coarse:h-11"
                                onClick={() => setShowNavigator(!showNavigator)} title="สารบัญ">
                                <List className="h-4 w-4" />สารบัญ
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

                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs pointer-coarse:h-11" onClick={handleAddStickyNote} title="เพิ่มโน้ตแปะ">
                            <StickyNote className="h-4 w-4" />โน้ต
                        </Button>

                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs pointer-coarse:h-11" onClick={handleAutoArrange} title='เรียงการ์ดใหม่ตามความสัมพันธ์ "นำไปสู่"'>
                            <LayoutGrid className="h-4 w-4" />เรียงจังหวะ
                        </Button>

                        {/* ผู้ช่วยทั้งสามตัวรวมไว้ในกล่องเดียว — เรียงจาก "อ่านได้ทันที" ไป "ต้องกดสั่ง AI"
                            เพื่อไม่ให้ผู้ใช้เผลอกดยิงงานที่เสีย token */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-8 gap-1.5 text-xs pointer-coarse:h-11", assistantAttention && "text-[var(--forge-amber)]")}
                                    title="ผู้ช่วยดูฉาก — จังหวะ / สรุปฉาก / Echo Score"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    ผู้ช่วย
                                    {assistantAttention && <span className="h-1.5 w-1.5 rounded-full bg-[var(--forge-amber)]" />}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" collisionPadding={12} className="w-[340px] p-0 overflow-hidden">
                                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-700/60">
                                    <Activity className="h-3 w-3 text-[var(--forge-amber)]" />
                                    <span className="font-technical text-[9px] uppercase tracking-widest text-zinc-300">
                                        ผู้ช่วยดูฉากนี้
                                    </span>
                                </div>

                                <div className="max-h-[calc(var(--radix-popover-content-available-height)-2rem)] overflow-y-auto divide-y divide-border/60">
                                    <BeatCoachSection
                                        novelId={novelId}
                                        sceneId={eventId}
                                        cards={items
                                            .filter((it: any) => it.type === "idea")
                                            .map((it: any) => ({ id: it.referenceId || it.id, beatIndex: it.beatIndex ?? 0, pacing: typeof it.pacing === "number" ? it.pacing : null }))}
                                    />

                                    <div className="p-3">
                                        <SceneRecapSection
                                            novelId={novelId}
                                            sceneId={eventId}
                                            initialRecap={initialSceneRecap}
                                            onWarningChange={setRecapWarning}
                                        />
                                    </div>

                                    <div className="p-3 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-technical text-[9px] uppercase tracking-widest text-muted-foreground flex-1">
                                                Echo Score
                                            </span>
                                            {echoFindings.length > 0 && (
                                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                                    พบ {echoFindings.length} การ์ด
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">หาจังหวะที่เดาได้ ผลขึ้นเป็นป้ายบนการ์ด</p>
                                        <EchoScorePanel
                                            novelId={novelId}
                                            sceneId={eventId}
                                            findingCount={echoFindings.length}
                                            onFindingsChange={setEchoFindings}
                                        />
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        {event && (
                            <SceneDramaticPanel event={event} characters={characters} events={sceneEvents} />
                        )}

                        <div className="flex-1" />

                        {/* ซูมกระดานแนวนอน/แนวตั้งพร้อมกัน — แบบไทม์ไลน์ตัดต่อ */}
                        {!isMobile && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>ซูม</span>
                                <Slider
                                    className="w-24"
                                    min={50}
                                    max={120}
                                    step={5}
                                    value={[Math.round(boardZoom * 100)]}
                                    onValueChange={([v]) => setBoardZoom(v / 100)}
                                    aria-label="ซูมกระดาน"
                                />
                                <span className="tabular-nums w-9">{Math.round(boardZoom * 100)}%</span>
                            </div>
                        )}

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
                                <Button size="sm" className="h-8 gap-1.5 pointer-coarse:h-11">
                                    <Plus className="w-4 h-4" />ไอเดียใหม่
                                </Button>
                            }
                        />

                        {/* เมนูนี้ทำเรื่องเดียว: เอาข้อมูลออกจากกระดาน — ใช้ไอคอนดาวน์โหลดให้รู้ว่าเป็นหมวดไหน */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 pointer-coarse:h-11 pointer-coarse:w-11" aria-label="ส่งออก" title="ส่งออก">
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

                    {!isMobile && playBeat !== null && playBeat < beatCount && (
                        <div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-1.5 text-xs" aria-live="polite">
                            <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground shrink-0">หัวอ่าน · จังหวะ {String(playBeat + 1).padStart(2, "0")}</span>
                            <span className="flex-1 min-w-0 truncate">
                                {(() => {
                                    const parts = lanes_
                                        .map(l => ({ l, cards: items.filter(i => i.laneId === l.id && i.beatIndex === playBeat) }))
                                        .filter(x => x.cards.length > 0)
                                        .map(x => `${x.l.name}: ${x.cards.map(c => c.title).join(', ')}`);
                                    return parts.length ? parts.join(' · ') : 'ไม่มีการ์ดในจังหวะนี้';
                                })()}
                            </span>
                            <button onClick={() => setPlayBeat(null)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label="ซ่อนหัวอ่าน" title="ซ่อนหัวอ่าน"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    )}

                    {isMobile ? (
                        <MobilePlotList
                            items={items}
                            lanes={lanes_}
                            beatCount={beatCount}
                            chapterRanges={chapterRanges}
                            renderCard={renderCard}
                        />
                    ) : (
                    <div ref={viewportRef} id="canvas-viewport" className="flex-1 min-h-0 overflow-auto">
                        <div
                            ref={gridRef}
                            className="relative"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `${LABEL_WIDTH}px ${Array.from({ length: totalColumns }).map((_, i) => i < totalColumns - 1 ? `${COLUMN_WIDTH}px ${GUTTER_WIDTH}px` : `${COLUMN_WIDTH}px`).join(' ')}`,
                                gridTemplateRows: `30px 36px repeat(${lanes_.length}, auto)`,
                                width: 'max-content',
                                zoom: boardZoom,
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
                            {/* ช่องเปล่าในแถบตอน — กดค้างแล้วลากเพื่อแบ่งตอน (แถบตอนจริงวางทับด้านบน) */}
                            {Array.from({ length: beatCount }).map((_, beatIndex) => {
                                if (chapterRanges.some(c => beatIndex >= c.startBeat && beatIndex <= c.endBeat)) return null;
                                const d = dragBeat && clampChapterRange(dragBeat.from, dragBeat.to);
                                const inDrag = !!d && beatIndex >= d.startBeat && beatIndex <= d.endBeat;
                                return (
                                    <div
                                        key={`chapter-slot-${beatIndex}`}
                                        style={{ gridColumn: beatGridCol(beatIndex), gridRow: 1 }}
                                        // onPointerEnter ต่อ cell ไม่คำนวณจาก clientX เอง — กริดมี zoom พิกัดจะเพี้ยน
                                        onPointerDown={(e) => { e.preventDefault(); setDragBeat({ from: beatIndex, to: beatIndex }); }}
                                        onPointerEnter={() => dragBeat && setDragBeat(p => p && { ...p, to: beatIndex })}
                                        title="กดค้างแล้วลากเพื่อแบ่งตอน"
                                        className={cn(
                                            "border-b border-border/60 cursor-ew-resize transition-colors",
                                            inDrag ? "bg-[var(--forge-amber)]/25" : "hover:bg-[var(--forge-amber)]/8"
                                        )}
                                    />
                                );
                            })}
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
                                        onClick={beatIndex !== beatCount ? () => setPlayBeat(cur => cur === beatIndex ? null : beatIndex) : undefined}
                                        onKeyDown={beatIndex !== beatCount ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlayBeat(cur => cur === beatIndex ? null : beatIndex); } } : undefined}
                                        role={beatIndex !== beatCount ? "button" : undefined}
                                        tabIndex={beatIndex !== beatCount ? 0 : undefined}
                                        aria-pressed={beatIndex !== beatCount ? playBeat === beatIndex : undefined}
                                        title={beatIndex !== beatCount ? "คลิกเพื่อวางหัวอ่านที่จังหวะนี้" : undefined}
                                        className={cn(
                                            "sticky top-0 z-20 bg-background border-r border-b border-border/60 flex items-center justify-center gap-1.5",
                                            beatIndex !== beatCount && "cursor-pointer hover:bg-muted/40 transition-colors",
                                            playBeat === beatIndex && "bg-[var(--forge-amber)]/15",
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
                                            className="sticky top-0 z-20 bg-muted/20 border-b border-border/30 flex items-center justify-center"
                                        >
                                        </div>
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
                                        laneCount={lanes_.length}
                                        color={laneColor}
                                        stats={laneStats.get(lane.id) ?? { count: 0, longestGap: 0, gapStart: 0 }}
                                        collapsed={collapsedLanes.has(lane.id)}
                                        locked={lockedLanes.has(lane.id)}
                                        soloActive={soloLaneId !== null}
                                        isSolo={soloLaneId === lane.id}
                                        characters={characters}
                                        onRename={handleRenameLane}
                                        onRemove={handleRemoveLane}
                                        onSetColor={handleSetLaneColor}
                                        onSetKind={handleSetLaneKind}
                                        onMove={handleMoveLane}
                                        onToggleCollapse={toggleLaneCollapse}
                                        onToggleSolo={toggleLaneSolo}
                                        onToggleLock={toggleLaneLock}
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
                                                collapsed={collapsedLanes.has(lane.id)}
                                                locked={lockedLanes.has(lane.id)}
                                                dimmed={soloLaneId !== null && soloLaneId !== lane.id}
                                                isDrafting={
                                                    (draftCell?.laneId === lane.id && draftCell?.beatIndex === beatIndex) ||
                                                    (creatingCell?.laneId === lane.id && creatingCell?.beatIndex === beatIndex)
                                                }
                                                onAddIdea={() => setDraftCell({ laneId: lane.id, beatIndex })}
                                            >
                                                {!collapsedLanes.has(lane.id) && cellItems.map(item => renderCard(item, lockedLanes.has(lane.id)))}

                                                {/* สร้างไอเดีย inline: การ์ดร่าง → skeleton ระหว่างรอ → ปุ่ม + (โผล่ตอน hover ช่อง) */}
                                                {creatingCell?.laneId === lane.id && creatingCell?.beatIndex === beatIndex ? (
                                                    <CreatingIdeaSkeleton title={creatingCell.title} />
                                                ) : draftCell?.laneId === lane.id && draftCell?.beatIndex === beatIndex ? (
                                                    <DraftIdeaCard
                                                        onCommit={handleCommitDraft}
                                                        onCancel={() => setDraftCell(null)}
                                                        onPick={(idea) => handlePickExistingIdea({ laneId: lane.id, beatIndex }, idea)}
                                                        unusedIdeas={unusedIdeas}
                                                    />
                                                ) : beatIndex !== beatCount && !collapsedLanes.has(lane.id) ? (
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
                                                    className={cn("border-b border-border/30", collapsedLanes.has(lane.id) ? "min-h-[36px]" : "min-h-[140px]", soloLaneId !== null && soloLaneId !== lane.id && "opacity-40")}
                                                />
                                            )}
                                        </Fragment>
                                        );
                                    })}
                                </Fragment>
                                );
                            })}

                            {/* เพิ่มเลนอยู่ท้ายคอลัมน์เลน ไม่ใช่ในเมนูรวม — เป็นการแก้โครงกระดาน คนละเรื่องกับส่งออก */}
                            <div
                                style={{ gridColumn: 1, gridRow: lanes_.length + 3, width: LABEL_WIDTH }}
                                className="sticky left-0 z-20 bg-muted/40 backdrop-blur-sm border-r border-b border-border/60 p-1.5"
                            >
                                <AddLaneButton characters={characters} onAdd={handleAddLane} />
                            </div>

                            {/* หัวอ่าน — เส้นตั้งผ่านทุกเลนที่จังหวะที่เลือก */}
                            {playBeat !== null && playBeat < beatCount && (
                                <div
                                    aria-hidden="true"
                                    className="absolute top-0 bottom-0 w-0.5 bg-[var(--forge-amber)] pointer-events-none z-[15]"
                                    style={{ left: LABEL_WIDTH + playBeat * (COLUMN_WIDTH + GUTTER_WIDTH) + COLUMN_WIDTH / 2 }}
                                />
                            )}

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
                    )}
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
                    <LinkColorDialog
                        sourceTitle={src.title}
                        targetTitle={tgt.title}
                        color={linkColor(link)}
                        onPick={(c, close) => { handleUpdateLink(editingLink.sourceId, editingLink.targetId, { color: c }); setLastLinkColor(c); if (close) setEditingLink(null); }}
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

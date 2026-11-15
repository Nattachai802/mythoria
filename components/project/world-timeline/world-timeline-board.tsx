"use client"

import { Fragment, useEffect, useMemo, useState, useTransition, type DragEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, GripVertical, Inbox, Plus, Undo2, ZoomIn } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { dayLabel } from "@/lib/story-date"
import type { LaneKind, TlItem, TlLane, WorldTimeline } from "@/lib/world-timeline"
import { formatWorldTime, gapLabel, type EraYear, type WorldCalendar } from "@/lib/world-calendar"
import { moveLoreOnTimeline, moveSceneOnTimeline, type DropTarget } from "@/server/world-timeline"
import { CalendarDialog } from "./calendar-dialog"
import { LoreTimePopover } from "./lore-time-popover"
import { CreateEventDialog } from "./create-event-dialog"

const LABEL_W = 176
const ZOOM_MIN = 72
const ZOOM_MAX = 240
const DEFAULT_OPEN: LaneKind[] = ["plot", "lore"]
const DRAG_MIME = "application/x-world-timeline"

const KIND_LABEL: Record<TlItem["kind"], string> = {
    scene: "ฉาก", lore: "lore", appear: "ปรากฏ", life: "เหตุการณ์ชีวิต", faction: "เข้ากลุ่ม", power: "ได้พลัง",
}

/** ของที่ลากได้: lore กับฉาก (ตัวต้นทางจริง) — ของที่อนุมานจากบทลากไม่ได้ เพราะไม่ได้เก็บเวลาเอง */
type DragPayload = { kind: "lore" | "scene"; id: string; title: string }
const isDraggable = (k: TlItem["kind"]): k is "lore" | "scene" => k === "lore" || k === "scene"

interface Props {
    novelId: string
    timeline: WorldTimeline
    timelineEpoch: Date | null
    calendar: WorldCalendar
    eraYears: EraYear[]
}

export function WorldTimelineBoard({ novelId, timeline, timelineEpoch, calendar, eraYears }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const openKey = `world-timeline:open:${novelId}`
    const zoomKey = `world-timeline:zoom:${novelId}`
    const [open, setOpen] = useState<Set<LaneKind>>(() => new Set(DEFAULT_OPEN))
    const [colW, setColW] = useState(128)
    const [dragging, setDragging] = useState<DragPayload | null>(null)
    const [hoverCol, setHoverCol] = useState<number | null>(null)
    const [createAt, setCreateAt] = useState<{ target: DropTarget | null; label: string | null } | null>(null)

    // จำค่าต่อนิยาย — อ่านพลาด (private mode ฯลฯ) ก็ใช้ค่าเริ่มต้น
    useEffect(() => {
        try {
            const rawOpen = localStorage.getItem(openKey)
            if (rawOpen) setOpen(new Set(JSON.parse(rawOpen) as LaneKind[]))
            const rawZoom = Number(localStorage.getItem(zoomKey))
            if (rawZoom >= ZOOM_MIN && rawZoom <= ZOOM_MAX) setColW(rawZoom)
        } catch { /* ใช้ค่าเริ่มต้น */ }
    }, [openKey, zoomKey])

    const toggle = (kind: LaneKind) => {
        setOpen(prev => {
            const next = new Set(prev)
            if (next.has(kind)) next.delete(kind)
            else next.add(kind)
            try { localStorage.setItem(openKey, JSON.stringify([...next])) } catch { /* ไม่จำก็ไม่เป็นไร */ }
            return next
        })
    }
    const zoom = (w: number) => {
        setColW(w)
        try { localStorage.setItem(zoomKey, String(w)) } catch { /* ไม่จำก็ไม่เป็นไร */ }
    }

    const epoch = useMemo(() => (timelineEpoch ? new Date(timelineEpoch) : null), [timelineEpoch])
    const { columns, segments, lanes, unplaced } = timeline
    const gridCols = `${LABEL_W}px repeat(${Math.max(columns.length, 1)}, ${colW}px)`

    const colLabel = (i: number) => {
        const c = columns[i]
        if (c.day != null && c.precision) return formatWorldTime(calendar, eraYears, c.day, c.precision)
        return dayLabel(c.storyDate, epoch) ?? `#${i + 1}`
    }
    // ช่วงว่างยาวระหว่างช่องที่มีเวลาจริงสองช่องติดกัน → ป้าย "≈ 300 ปี"
    const gapBefore = (i: number) => {
        const prev = columns[i - 1], cur = columns[i]
        return prev?.day != null && cur.day != null ? gapLabel(calendar, prev.day, cur.day) : null
    }
    const targetOf = (i: number): DropTarget => ({ eraId: columns[i].eraId, day: columns[i].day })

    // ── ลากวาง ──
    const startDrag = (e: DragEvent, payload: DragPayload) => {
        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
        e.dataTransfer.effectAllowed = "move"
        setDragging(payload)
    }
    const endDrag = () => { setDragging(null); setHoverCol(null) }
    const dropOn = (e: DragEvent, col: number) => {
        e.preventDefault()
        const raw = e.dataTransfer.getData(DRAG_MIME)
        endDrag()
        if (!raw) return
        const p = JSON.parse(raw) as DragPayload
        const target = targetOf(col)
        startTransition(async () => {
            const res = p.kind === "lore" ? await moveLoreOnTimeline(p.id, target) : await moveSceneOnTimeline(p.id, target)
            if (!res.success) {
                toast.error(res.error ?? "ย้ายไม่สำเร็จ")
                return
            }
            toast.success(`ย้าย "${p.title}" ไปที่ ${colLabel(col)}`)
            router.refresh()
        })
    }

    // lore ทุกชิ้น (บนแกนและในถาด) กดแล้วแก้ชื่อ/เวลา/ลบได้ — เวลาเดิมอ่านจากช่องที่มันอยู่
    const wrapLore: WrapLore = (sourceId, title, col, node) => {
        const c = col == null ? null : columns[col]
        return (
            <LoreTimePopover
                novelId={novelId} loreId={sourceId} title={title} calendar={calendar} eras={eraYears}
                current={c?.day != null && c.precision ? { day: c.day, precision: c.precision } : null}
            >
                <button type="button" className="block w-full min-w-0 text-left hover:opacity-80">{node}</button>
            </LoreTimePopover>
        )
    }

    const hrefOf = (item: TlItem) =>
        item.kind === "scene" || item.kind === "appear" ? `/dashboard/project/${novelId}/plot` : null

    const toolbar = (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
            <span className="text-xs text-muted-foreground">
                ลาก lore หรือฉากไปวางที่ช่องเวลา · กด lore เพื่อแก้ · ดับเบิลคลิกหัวช่องเพื่อสร้างเหตุการณ์ ณ เวลานั้น
            </span>
            <span className="flex-1" />
            {columns.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ZoomIn className="size-3.5" aria-hidden />
                    <input
                        type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={8} value={colW}
                        onChange={e => zoom(Number(e.target.value))}
                        aria-label="ความกว้างของช่องเวลา"
                        className="w-24"
                    />
                </label>
            )}
            <button
                type="button"
                onClick={() => setCreateAt({ target: null, label: null })}
                className="inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-sm hover:bg-muted"
            >
                <Plus className="size-4" /> เหตุการณ์
            </button>
            <CalendarDialog novelId={novelId} calendar={calendar} eras={eraYears} />
        </div>
    )

    const createDialog = (
        <CreateEventDialog
            novelId={novelId}
            open={createAt != null}
            target={createAt?.target ?? null}
            targetLabel={createAt?.label ?? null}
            eras={eraYears}
            onOpenChange={o => { if (!o) setCreateAt(null) }}
        />
    )

    if (columns.length === 0) {
        return (
            <div className="flex min-h-0 flex-1 flex-col">
                {toolbar}
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
                    <p className="font-medium">ยังไม่มีอะไรบนเส้นเวลา</p>
                    <p className="max-w-md text-sm text-muted-foreground">
                        กด "+ เหตุการณ์" เพื่อเริ่ม หรือกด lore ในถาดด้านล่างเพื่อใส่ปี · ฉากจะขึ้นแกนเมื่อจัดลำดับเวลาจากกระดานพล็อต หรือผูกยุคไว้
                    </p>
                </div>
                <UnplacedTray items={unplaced} wrapLore={wrapLore} onDragStart={startDrag} onDragEnd={endDrag} />
                {createDialog}
            </div>
        )
    }

    return (
        <div className={cn("flex min-h-0 flex-1 flex-col", isPending && "cursor-progress")}>
            {toolbar}
            <div className="min-h-0 flex-1 overflow-auto">
                <div className="relative w-max">
                    <div className="grid text-xs" style={{ gridTemplateColumns: gridCols }}>
                        {/* แถบยุค */}
                        <div className="sticky left-0 top-0 z-30 border-b border-r bg-background px-3 py-2 text-muted-foreground">ยุค</div>
                        {segments.map(seg => (
                            <div
                                key={seg.eraId ?? "_none"}
                                className="sticky top-0 z-20 truncate border-b border-r px-2 py-2 font-medium"
                                style={{
                                    gridColumn: `${seg.start + 2} / ${seg.end + 3}`,
                                    background: seg.color ? `color-mix(in oklch, ${seg.color} 18%, var(--background))` : "var(--background)",
                                }}
                                title={seg.name}
                            >
                                {seg.name}
                            </div>
                        ))}

                        {/* ป้ายช่อง — ดับเบิลคลิกเพื่อสร้างเหตุการณ์ ณ เวลานั้น */}
                        <div className="sticky left-0 top-[33px] z-30 border-b border-r bg-background px-3 py-1 text-muted-foreground">เวลา</div>
                        {columns.map((_, i) => {
                            const gap = gapBefore(i)
                            return (
                                <div
                                    key={i}
                                    className="sticky top-[33px] z-10 cursor-cell select-none truncate border-b border-r bg-background px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                                    title={`${colLabel(i)} · ดับเบิลคลิกเพื่อสร้างเหตุการณ์ที่นี่`}
                                    onDoubleClick={() => setCreateAt({ target: targetOf(i), label: colLabel(i) })}
                                >
                                    {gap && <span className="mr-1 font-medium text-foreground/70">{gap} ·</span>}
                                    {colLabel(i)}
                                </div>
                            )
                        })}

                        {lanes.map(lane => (
                            <LaneRows
                                key={lane.kind}
                                lane={lane}
                                colCount={columns.length}
                                colW={colW}
                                isOpen={open.has(lane.kind)}
                                onToggle={() => toggle(lane.kind)}
                                hrefOf={hrefOf}
                                wrapLore={wrapLore}
                                onDragStart={startDrag}
                                onDragEnd={endDrag}
                            />
                        ))}
                    </div>

                    {/* ช่องรับของที่ลากมา — โผล่เฉพาะตอนลาก ครอบทั้งความสูงของกระดาน */}
                    {dragging && (
                        <div className="absolute inset-y-0 z-40 flex" style={{ left: LABEL_W }}>
                            {columns.map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "h-full border-r border-dashed border-[var(--forge-gold)]/40",
                                        hoverCol === i && "bg-[var(--forge-gold)]/15",
                                    )}
                                    style={{ width: colW }}
                                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (hoverCol !== i) setHoverCol(i) }}
                                    onDragLeave={() => setHoverCol(h => (h === i ? null : h))}
                                    onDrop={e => dropOn(e, i)}
                                    title={colLabel(i)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <UnplacedTray items={unplaced} wrapLore={wrapLore} onDragStart={startDrag} onDragEnd={endDrag} />
            {createDialog}
        </div>
    )
}

type WrapLore = (sourceId: string, title: string, col: number | null, node: ReactNode) => ReactNode
type StartDrag = (e: DragEvent, payload: DragPayload) => void

function LaneRows({ lane, colCount, colW, isOpen, onToggle, hrefOf, wrapLore, onDragStart, onDragEnd }: {
    lane: TlLane
    colCount: number
    colW: number
    isOpen: boolean
    onToggle: () => void
    hrefOf: (item: TlItem) => string | null
    wrapLore: WrapLore
    onDragStart: StartDrag
    onDragEnd: () => void
}) {
    const allItems = lane.subLanes.flatMap(s => s.items)
    const busyCols = new Set(allItems.map(i => i.col))
    const Chevron = isOpen ? ChevronDown : ChevronRight

    return (
        <>
            <button
                type="button"
                onClick={onToggle}
                className="sticky left-0 z-10 flex items-center gap-1.5 border-b border-r bg-muted px-3 py-2 text-left font-medium hover:bg-muted/80"
                aria-expanded={isOpen}
            >
                <Chevron className="size-3.5 shrink-0" />
                <span className="truncate">{lane.label}</span>
                <span className="ml-auto text-[11px] font-normal text-muted-foreground">{lane.subLanes.length || ""}</span>
            </button>
            <div className="relative border-b bg-muted/40" style={{ gridColumn: `2 / ${colCount + 2}` }}>
                {lane.subLanes.length === 0 ? (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{lane.emptyText}</span>
                ) : !isOpen && [...busyCols].map(col => (
                    <span
                        key={col}
                        className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--forge-gold)]"
                        style={{ left: col * colW + colW / 2 }}
                    />
                ))}
            </div>

            {isOpen && lane.subLanes.map(sub => {
                const byCol = new Map<number, TlItem[]>()
                for (const it of sub.items) byCol.set(it.col, [...(byCol.get(it.col) ?? []), it])
                return (
                    <Fragment key={sub.id}>
                        <div className="sticky left-0 z-10 truncate border-b border-r bg-background py-2 pl-8 pr-3 text-muted-foreground" title={sub.label}>
                            {sub.label}
                        </div>
                        <div className="grid border-b" style={{ gridColumn: `2 / ${colCount + 2}`, gridTemplateColumns: `repeat(${colCount}, ${colW}px)` }}>
                            {[...byCol.entries()].map(([col, items]) => (
                                <div key={col} className="flex min-w-0 flex-col gap-1 border-r border-border/40 p-1" style={{ gridColumn: col + 1 }}>
                                    {items.map(it => {
                                        const chip = <ItemChip item={it} href={it.kind === "lore" ? null : hrefOf(it)} />
                                        const body = it.kind === "lore" ? wrapLore(it.sourceId, it.title, it.col, chip) : chip
                                        // ลากได้เฉพาะในเลนต้นทาง (โครงเรื่อง/Lore) — เลนตัวละคร/สถานที่เป็นเงาของของเดียวกัน
                                        const canDrag = isDraggable(it.kind) && (lane.kind === "plot" || lane.kind === "lore")
                                        return (
                                            <div
                                                key={it.id}
                                                className={cn("group flex min-w-0 items-center", canDrag && "cursor-grab active:cursor-grabbing")}
                                                draggable={canDrag}
                                                onDragStart={canDrag ? e => onDragStart(e, { kind: it.kind as "lore" | "scene", id: it.sourceId, title: it.title }) : undefined}
                                                onDragEnd={canDrag ? onDragEnd : undefined}
                                            >
                                                {canDrag && <GripVertical className="size-3 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" aria-hidden />}
                                                <div className="min-w-0 flex-1">{body}</div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </Fragment>
                )
            })}
        </>
    )
}

function ItemChip({ item, href }: { item: TlItem; href: string | null }) {
    const title = `${KIND_LABEL[item.kind]}: ${item.title}${item.approx ? " (ตำแหน่งประมาณจากบท)" : ""}${item.flashback ? " · เล่าย้อน" : ""}`
    const body = (
        <span
            className={cn(
                "flex items-center gap-1 truncate rounded-sm border px-1.5 py-0.5",
                item.kind === "scene" && "bg-background",
                item.kind === "lore" && "border-transparent bg-violet-500/12 text-violet-800 dark:text-violet-200",
                item.kind === "appear" && "border-transparent bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
                item.approx && "border-dashed bg-transparent italic text-muted-foreground",
            )}
            title={title}
        >
            {item.kind === "lore" && <span aria-hidden>◆</span>}
            {item.approx && <span aria-hidden>≈</span>}
            <span className="truncate">{item.title}</span>
            {item.flashback && <Undo2 className="size-3 shrink-0" aria-label="เล่าย้อน" />}
        </span>
    )
    return href ? <Link href={href} className="block min-w-0 hover:opacity-80" draggable={false}>{body}</Link> : body
}

function UnplacedTray({ items, wrapLore, onDragStart, onDragEnd }: {
    items: WorldTimeline["unplaced"]
    wrapLore: WrapLore
    onDragStart: StartDrag
    onDragEnd: () => void
}) {
    if (items.length === 0) return null
    return (
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/40 px-4 py-2 text-xs">
            <span className="mr-1 flex items-center gap-1 text-muted-foreground">
                <Inbox className="size-3.5" /> ยังไม่ระบุเวลา ({items.length})
            </span>
            {items.slice(0, 40).map(u => {
                const chip = (
                    <span className="block rounded-sm border border-dashed px-1.5 py-0.5" title={`${KIND_LABEL[u.kind]} · ${u.reason}`}>
                        {u.title}
                    </span>
                )
                const canDrag = u.kind === "lore" || u.kind === "scene"
                return (
                    <span
                        key={`${u.kind}:${u.id}`}
                        className={cn("inline-block", canDrag && "cursor-grab active:cursor-grabbing")}
                        draggable={canDrag}
                        onDragStart={canDrag ? e => onDragStart(e, { kind: u.kind as "lore" | "scene", id: u.id, title: u.title }) : undefined}
                        onDragEnd={canDrag ? onDragEnd : undefined}
                    >
                        {u.kind === "lore" ? wrapLore(u.id, u.title, null, chip) : chip}
                    </span>
                )
            })}
            {items.length > 40 && <span className="text-muted-foreground">+{items.length - 40}</span>}
        </div>
    )
}

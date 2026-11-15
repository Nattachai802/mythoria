"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Inbox, Undo2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { dayLabel } from "@/lib/story-date"
import type { LaneKind, TlItem, TlLane, WorldTimeline } from "@/lib/world-timeline"

const COL_W = 128
const LABEL_W = 176
const DEFAULT_OPEN: LaneKind[] = ["plot", "lore"]

const KIND_LABEL: Record<TlItem["kind"], string> = {
    scene: "ฉาก", lore: "lore", appear: "ปรากฏ", life: "เหตุการณ์ชีวิต", faction: "เข้ากลุ่ม", power: "ได้พลัง",
}

interface Props {
    novelId: string
    timeline: WorldTimeline
    timelineEpoch: Date | null
}

export function WorldTimelineBoard({ novelId, timeline, timelineEpoch }: Props) {
    const storageKey = `world-timeline:open:${novelId}`
    const [open, setOpen] = useState<Set<LaneKind>>(() => new Set(DEFAULT_OPEN))

    // จำว่ากางหมวดไหนไว้ ต่อนิยาย — อ่านพลาด (private mode ฯลฯ) ก็ใช้ค่าเริ่มต้น
    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey)
            if (raw) setOpen(new Set(JSON.parse(raw) as LaneKind[]))
        } catch { /* ใช้ค่าเริ่มต้น */ }
    }, [storageKey])

    const toggle = (kind: LaneKind) => {
        setOpen(prev => {
            const next = new Set(prev)
            if (next.has(kind)) next.delete(kind)
            else next.add(kind)
            try { localStorage.setItem(storageKey, JSON.stringify([...next])) } catch { /* ไม่จำก็ไม่เป็นไร */ }
            return next
        })
    }

    const epoch = useMemo(() => (timelineEpoch ? new Date(timelineEpoch) : null), [timelineEpoch])
    const { columns, segments, lanes, unplaced } = timeline
    const gridCols = `${LABEL_W}px repeat(${Math.max(columns.length, 1)}, ${COL_W}px)`

    const hrefOf = (item: TlItem) =>
        item.kind === "scene" || item.kind === "appear" ? `/dashboard/project/${novelId}/plot`
            : item.kind === "lore" ? `/dashboard/project/${novelId}/worldbuilding`
                : null

    if (columns.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
                <p className="font-medium">ยังไม่มีอะไรบนเส้นเวลา</p>
                <p className="max-w-md text-sm text-muted-foreground">
                    สร้างยุคแล้วผูก lore เข้ากับยุคในหน้าสร้างโลก หรือจัดลำดับเวลาของฉากจากปุ่มเส้นเวลาบนกระดานพล็อต ของเหล่านั้นจะมาโผล่ที่นี่
                </p>
                <UnplacedTray items={unplaced} />
            </div>
        )
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-auto">
                <div className="grid w-max text-xs" style={{ gridTemplateColumns: gridCols }}>
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

                    {/* ป้ายช่อง (วันที่ของฉาก ถ้ามี) */}
                    <div className="sticky left-0 top-[33px] z-30 border-b border-r bg-background px-3 py-1 text-muted-foreground">ลำดับเวลา</div>
                    {columns.map((c, i) => (
                        <div key={i} className="sticky top-[33px] z-10 border-b border-r bg-background px-2 py-1 text-[11px] text-muted-foreground">
                            {dayLabel(c.storyDate, epoch) ?? `#${i + 1}`}
                        </div>
                    ))}

                    {lanes.map(lane => (
                        <LaneRows
                            key={lane.kind}
                            lane={lane}
                            colCount={columns.length}
                            isOpen={open.has(lane.kind)}
                            onToggle={() => toggle(lane.kind)}
                            hrefOf={hrefOf}
                        />
                    ))}
                </div>
            </div>
            <UnplacedTray items={unplaced} />
        </div>
    )
}

function LaneRows({ lane, colCount, isOpen, onToggle, hrefOf }: {
    lane: TlLane
    colCount: number
    isOpen: boolean
    onToggle: () => void
    hrefOf: (item: TlItem) => string | null
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
                        style={{ left: col * COL_W + COL_W / 2 }}
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
                        <div className="grid border-b" style={{ gridColumn: `2 / ${colCount + 2}`, gridTemplateColumns: `repeat(${colCount}, ${COL_W}px)` }}>
                            {[...byCol.entries()].map(([col, items]) => (
                                <div key={col} className="flex flex-col gap-1 border-r border-border/40 p-1" style={{ gridColumn: col + 1 }}>
                                    {items.map(it => <ItemChip key={it.id} item={it} href={hrefOf(it)} />)}
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
    return href ? <Link href={href} className="block min-w-0 hover:opacity-80">{body}</Link> : body
}

function UnplacedTray({ items }: { items: WorldTimeline["unplaced"] }) {
    if (items.length === 0) return null
    return (
        <div className="flex flex-wrap items-center gap-1.5 border-t bg-muted/40 px-4 py-2 text-xs">
            <span className="mr-1 flex items-center gap-1 text-muted-foreground">
                <Inbox className="size-3.5" /> ยังไม่ระบุเวลา ({items.length})
            </span>
            {items.slice(0, 40).map(u => (
                <span key={`${u.kind}:${u.id}`} className="rounded-sm border border-dashed px-1.5 py-0.5" title={`${KIND_LABEL[u.kind]} · ${u.reason}`}>
                    {u.title}
                </span>
            ))}
            {items.length > 40 && <span className="text-muted-foreground">+{items.length - 40}</span>}
        </div>
    )
}

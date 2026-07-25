"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import { Chapter, TimelineEvent, Era, LoreEntry } from "@/db/schema"
import { updateTimelineEvent } from "@/server/timeline"
import { updateNovel } from "@/server/novel"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { CalendarClock, GripVertical, History, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { clampStoryDate, dayLabel, fromDateInputValue, toDateInputValue, STORY_DATE_MIN, STORY_DATE_MAX } from "@/lib/story-date"
import { toast } from "sonner"
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type EraWithLore = Era & { loreEntries: LoreEntry[] }

interface Props {
    novelId: string
    events: TimelineEvent[]
    chapters: Chapter[] // sorted
    onEventPatched: (id: string, patch: Partial<TimelineEvent>) => void
    eras?: EraWithLore[]
    timelineEpoch?: Date | null
    onEpochChange?: (epoch: Date | null) => void
}

// เส้นเวลาจริง (P3) — ลิสต์เรียงตาม storyTimeIndex, ลากจัดลำดับ, แถวที่เล่าสลับ = flashback ไฮไลต์
// storyDate/timelineEpoch (P3 Phase A) ทาบเป็น annotation บนลำดับเดิม ไม่ได้แทนที่กลไก drag reorder
export function ChronoTimelineSheet({ novelId, events, chapters, onEventPatched, eras = [], timelineEpoch, onEpochChange }: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // เลขลำดับเล่า: บทเรียงตาม orderIndex → ฉากใน chapter เรียงตาม orderIndex
    const narrativeOrder = useMemo(() => {
        const m = new Map<string, number>()
        let n = 1
        chapters.forEach(ch => {
            events
                .filter(e => e.relatedChapterId === ch.id)
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .forEach(e => m.set(e.id, n++))
        })
        // ฉากที่ไม่ผูกบท ต่อท้าย
        events.filter(e => !m.has(e.id)).forEach(e => m.set(e.id, n++))
        return m
    }, [events, chapters])

    const ordered = useMemo(
        () => events.filter(e => e.storyTimeIndex != null).sort((a, b) => (a.storyTimeIndex! - b.storyTimeIndex!)),
        [events]
    )
    const unordered = useMemo(
        () => events.filter(e => e.storyTimeIndex == null).sort((a, b) => (narrativeOrder.get(a.id) || 0) - (narrativeOrder.get(b.id) || 0)),
        [events, narrativeOrder]
    )

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

    // persist ลำดับใหม่ — อัปเดตเฉพาะตัวที่ index เปลี่ยน
    const persistOrder = (list: TimelineEvent[]) => {
        startTransition(async () => {
            const changed = list
                .map((e, idx) => ({ e, idx: idx + 1 }))
                .filter(({ e, idx }) => e.storyTimeIndex !== idx)
            for (const { e, idx } of changed) {
                const prev = e.storyTimeIndex ?? null
                onEventPatched(e.id, { storyTimeIndex: idx })
                const res = await updateTimelineEvent(e.id, { storyTimeIndex: idx })
                if (!res.success) {
                    onEventPatched(e.id, { storyTimeIndex: prev })
                    toast.error(`บันทึกลำดับ "${e.title}" ไม่สำเร็จ`)
                }
            }
        })
    }

    const handleDragEnd = (ev: DragEndEvent) => {
        const { active, over } = ev
        if (!over || active.id === over.id) return
        const oldIdx = ordered.findIndex(e => e.id === active.id)
        const newIdx = ordered.findIndex(e => e.id === over.id)
        if (oldIdx < 0 || newIdx < 0) return
        persistOrder(arrayMove(ordered, oldIdx, newIdx))
    }

    // ยังไม่จัด → กดเพิ่มเข้าท้ายเส้นเวลา
    const handleAddToTimeline = (e: TimelineEvent) => {
        persistOrder([...ordered, e])
    }

    const handleRemoveFromTimeline = (e: TimelineEvent) => {
        const prev = e.storyTimeIndex ?? null
        startTransition(async () => {
            onEventPatched(e.id, { storyTimeIndex: null })
            const res = await updateTimelineEvent(e.id, { storyTimeIndex: null })
            if (!res.success) {
                onEventPatched(e.id, { storyTimeIndex: prev })
                toast.error(`เอา "${e.title}" ออกจากเส้นเวลาไม่สำเร็จ`)
            }
        })
    }

    const epoch = useMemo(() => (timelineEpoch ? new Date(timelineEpoch) : null), [timelineEpoch])

    // ทุก handler patch แบบ optimistic แล้ว rollback เป็นค่าเดิมถ้า server ปฏิเสธ
    // ไม่งั้น UI ค้างค่าที่บันทึกไม่ผ่าน ผู้ใช้คิดว่าเซฟแล้วแต่รีเฟรชมาค่าหาย
    const handleStoryDateCommit = (e: TimelineEvent, value: number | null) => {
        const prev = e.storyDate ?? null
        if (value === prev) return
        onEventPatched(e.id, { storyDate: value })
        startTransition(async () => {
            const res = await updateTimelineEvent(e.id, { storyDate: value })
            if (!res.success) {
                onEventPatched(e.id, { storyDate: prev })
                toast.error(`บันทึกวันที่ "${e.title}" ไม่สำเร็จ`)
            }
        })
    }

    const handleEraChange = (e: TimelineEvent, eraId: string | null) => {
        const prev = e.eraId ?? null
        if (eraId === prev) return
        onEventPatched(e.id, { eraId })
        startTransition(async () => {
            const res = await updateTimelineEvent(e.id, { eraId })
            if (!res.success) {
                onEventPatched(e.id, { eraId: prev })
                toast.error(`บันทึกยุคของ "${e.title}" ไม่สำเร็จ`)
            }
        })
    }

    const handleEpochChange = (next: Date | null) => {
        const prev = epoch
        onEpochChange?.(next)
        startTransition(async () => {
            const res = await updateNovel(novelId, { timelineEpoch: next })
            if (!res.success) {
                onEpochChange?.(prev)
                toast.error("บันทึกวันเริ่มเรื่องไม่สำเร็จ")
            }
        })
    }

    // นับ flashback: แถวที่เลขลำดับเล่า "ถอยหลัง" เทียบแถวก่อนใน chrono order
    const flashbackIds = useMemo(() => {
        const ids = new Set<string>()
        for (let i = 1; i < ordered.length; i++) {
            const prev = narrativeOrder.get(ordered[i - 1].id) || 0
            const cur = narrativeOrder.get(ordered[i].id) || 0
            if (cur < prev) ids.add(ordered[i].id)
        }
        return ids
    }, [ordered, narrativeOrder])

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <CalendarClock className="h-3.5 w-3.5" />
                    เส้นเวลาจริง
                    {flashbackIds.size > 0 && (
                        <span className="ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold tabular-nums text-black">
                            {flashbackIds.size}
                        </span>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0 flex flex-col">
                <SheetHeader className="px-4 py-3 border-b">
                    <SheetTitle className="text-sm flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-[var(--forge-amber)]" />
                        เส้นเวลาจริงในโลกเรื่อง
                        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                        ลากเรียงตามเวลาที่เหตุการณ์ <em>เกิดจริง</em> — เลขในวงเล็บคือลำดับเล่า
                        แถวสีอำพัน = เล่าสลับเวลา (flashback)
                    </SheetDescription>
                </SheetHeader>

                <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20 text-[10px] text-muted-foreground">
                    <span className="shrink-0" id="epoch-label">Day 1 =</span>
                    <input
                        type="date"
                        aria-labelledby="epoch-label"
                        value={epoch ? toDateInputValue(epoch) : ""}
                        onChange={(ev) => handleEpochChange(ev.target.value ? fromDateInputValue(ev.target.value) : null)}
                        className="h-6 text-[10px] rounded border border-border/60 bg-background px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="text-muted-foreground/70">— ตั้งไว้จะแปลงวันของแต่ละฉากเป็น พ.ศ. จริง</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* ประวัติศาสตร์โลก — ก่อนเริ่มเรื่อง (จาก eras + loreEntries) */}
                    {eras.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-technical font-semibold">
                                    ประวัติศาสตร์โลก
                                </span>
                                <span className="text-[9px] text-muted-foreground">/worldbuilding</span>
                            </div>
                            {eras.map(era => (
                                <div key={era.id} className="pl-3 border-l-2 border-dashed" style={{ borderColor: era.color ?? undefined }}>
                                    <div className="text-[11px] font-semibold mb-1" style={{ color: era.color ?? undefined }}>{era.name}</div>
                                    {era.loreEntries.map(lore => (
                                        <div key={lore.id} className="text-[11px] text-muted-foreground py-0.5 flex items-baseline gap-1.5">
                                            <span style={{ color: era.color ?? undefined }}>•</span>
                                            <span className="text-[9px] uppercase tracking-wide shrink-0" style={{ color: era.color ?? undefined }}>{lore.type}</span>
                                            <span className="truncate">{lore.title}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                            <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--forge-amber)]">
                                <span className="flex-1 h-px bg-border" />
                                🚩 เรื่องเริ่มต้น
                                <span className="flex-1 h-px bg-border" />
                            </div>
                        </div>
                    )}

                    {/* จัดแล้ว */}
                    {ordered.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8 bg-muted/10 rounded border border-dashed border-border/40">
                            ยังไม่มีฉากบนเส้นเวลาจริง — กด + จากรายการด้านล่างเพื่อเริ่มจัด
                        </p>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={ordered.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1">
                                    {ordered.map((e, i) => {
                                        const prev = i > 0 ? ordered[i - 1] : null
                                        const gap = (prev?.storyDate != null && e.storyDate != null) ? e.storyDate - prev.storyDate : null
                                        return (
                                            <Fragment key={e.id}>
                                                {gap != null && (
                                                    <div className={cn(
                                                        "pl-7 pb-0.5 text-[10px] font-technical tabular-nums",
                                                        gap < 0 ? "text-red-500 font-semibold" : gap > 14 ? "text-[var(--forge-amber)] font-semibold" : "text-muted-foreground"
                                                    )}>
                                                        {gap < 0 ? `⚠ ย้อนเวลา ${Math.abs(gap)} วัน` : gap > 14 ? `⏳ timeskip +${gap} วัน` : `+${gap} วัน`}
                                                    </div>
                                                )}
                                                <ChronoRow
                                                    event={e}
                                                    chronoIndex={i + 1}
                                                    narrativeIndex={narrativeOrder.get(e.id) || 0}
                                                    isFlashback={flashbackIds.has(e.id)}
                                                    onRemove={() => handleRemoveFromTimeline(e)}
                                                    dayText={dayLabel(e.storyDate, epoch)}
                                                    eras={eras}
                                                    onEraChange={(eraId) => handleEraChange(e, eraId)}
                                                    onStoryDateCommit={(v) => handleStoryDateCommit(e, v)}
                                                />
                                            </Fragment>
                                        )
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}

                    {/* ยังไม่จัด */}
                    {unordered.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-technical font-semibold">
                                ยังไม่จัดลำดับ ({unordered.length})
                            </span>
                            {unordered.map(e => (
                                <div key={e.id} className="flex items-center gap-2 p-2 rounded border border-dashed border-border/50 text-xs">
                                    <span className="text-muted-foreground tabular-nums shrink-0">({narrativeOrder.get(e.id)})</span>
                                    <span className="truncate flex-1">{e.title}</span>
                                    {e.eventDate && <span className="text-[10px] text-muted-foreground truncate max-w-[90px]">{e.eventDate}</span>}
                                    <Button
                                        variant="ghost" size="sm"
                                        className="h-6 px-1.5 text-[10px] shrink-0"
                                        onClick={() => handleAddToTimeline(e)}
                                        disabled={isPending}
                                    >
                                        + เข้าเส้นเวลา
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

function ChronoRow({ event, chronoIndex, narrativeIndex, isFlashback, onRemove, dayText, eras, onEraChange, onStoryDateCommit }: {
    event: TimelineEvent
    chronoIndex: number
    narrativeIndex: number
    isFlashback: boolean
    onRemove: () => void
    dayText: string | null
    eras: EraWithLore[]
    onEraChange: (eraId: string | null) => void
    onStoryDateCommit: (value: number | null) => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
            className={cn(
                "flex items-start gap-2 p-2 rounded border text-xs bg-card group",
                isFlashback ? "border-amber-500/50 bg-amber-500/5" : "border-border"
            )}
        >
            <button
                {...attributes}
                {...listeners}
                aria-label={`ลากเพื่อจัดลำดับฉาก ${event.title}`}
                className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 mt-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <GripVertical className="w-3.5 h-3.5" />
            </button>
            <span className="font-technical text-[10px] text-muted-foreground tabular-nums w-5 shrink-0 mt-0.5">{chronoIndex}.</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{event.title}</span>
                    {isFlashback && <History className="w-3 h-3 text-amber-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="tabular-nums">เล่าเป็นลำดับที่ {narrativeIndex}</span>
                    {event.eventDate && <span className="truncate">· {event.eventDate}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                    {/* key ผูกกับค่าปัจจุบัน — ถ้า save fail แล้ว rollback ช่องจะ remount แสดงค่าเดิมจริง
                        (uncontrolled + defaultValue อย่างเดียวจะค้างค่าที่บันทึกไม่ผ่าน) */}
                    <input
                        key={event.storyDate ?? "empty"}
                        type="number"
                        min={STORY_DATE_MIN}
                        max={STORY_DATE_MAX}
                        step={1}
                        defaultValue={event.storyDate ?? ""}
                        placeholder="วันที่"
                        aria-label={`วันที่ในเรื่องของฉาก ${event.title}`}
                        onBlur={(ev) => {
                            const raw = ev.target.value.trim()
                            if (raw === "") return onStoryDateCommit(null)
                            const n = Number(raw)
                            onStoryDateCommit(Number.isFinite(n) ? clampStoryDate(n) : null)
                        }}
                        className="w-14 h-5 px-1 text-[10px] rounded border border-border/50 bg-background tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    {dayText && <span className="text-[9px] text-muted-foreground font-technical shrink-0">{dayText}</span>}
                    {eras.length > 0 && (
                        <select
                            value={event.eraId ?? ""}
                            onChange={(ev) => onEraChange(ev.target.value || null)}
                            aria-label={`ยุคของฉาก ${event.title}`}
                            className={cn(
                                "h-5 text-[9px] max-w-[104px] shrink-0 rounded border-0 bg-transparent px-0.5 cursor-pointer",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                event.eraId ? "text-muted-foreground hover:text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"
                            )}
                        >
                            <option value="">ไม่ระบุยุค</option>
                            {eras.map(era => <option key={era.id} value={era.id}>{era.name}</option>)}
                        </select>
                    )}
                </div>
            </div>
            {/* focus-visible:opacity-100 จำเป็น — ไม่งั้นผู้ใช้คีย์บอร์ด Tab มาถึงแล้วมองไม่เห็นปุ่มเลย */}
            <button
                onClick={onRemove}
                aria-label={`เอา "${event.title}" ออกจากเส้นเวลา`}
                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-[10px] shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                ✕
            </button>
        </div>
    )
}

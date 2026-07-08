"use client"

import { useMemo, useState, useTransition } from "react"
import { Chapter, TimelineEvent } from "@/db/schema"
import { updateTimelineEvent } from "@/server/timeline"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { CalendarClock, GripVertical, History, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface Props {
    novelId: string
    events: TimelineEvent[]
    chapters: Chapter[] // sorted
    onEventPatched: (id: string, patch: Partial<TimelineEvent>) => void
}

// เส้นเวลาจริง (P3) — ลิสต์เรียงตาม storyTimeIndex, ลากจัดลำดับ, แถวที่เล่าสลับ = flashback ไฮไลต์
export function ChronoTimelineSheet({ novelId, events, chapters, onEventPatched }: Props) {
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
                onEventPatched(e.id, { storyTimeIndex: idx })
                const res = await updateTimelineEvent(e.id, { storyTimeIndex: idx })
                if (!res.success) toast.error(`บันทึกลำดับ "${e.title}" ไม่สำเร็จ`)
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
        startTransition(async () => {
            onEventPatched(e.id, { storyTimeIndex: null })
            await updateTimelineEvent(e.id, { storyTimeIndex: null })
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

                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {/* จัดแล้ว */}
                    {ordered.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8 bg-muted/10 rounded border border-dashed border-border/40">
                            ยังไม่มีฉากบนเส้นเวลาจริง — กด + จากรายการด้านล่างเพื่อเริ่มจัด
                        </p>
                    ) : (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={ordered.map(e => e.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-1">
                                    {ordered.map((e, i) => (
                                        <ChronoRow
                                            key={e.id}
                                            event={e}
                                            chronoIndex={i + 1}
                                            narrativeIndex={narrativeOrder.get(e.id) || 0}
                                            isFlashback={flashbackIds.has(e.id)}
                                            onRemove={() => handleRemoveFromTimeline(e)}
                                        />
                                    ))}
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

function ChronoRow({ event, chronoIndex, narrativeIndex, isFlashback, onRemove }: {
    event: TimelineEvent
    chronoIndex: number
    narrativeIndex: number
    isFlashback: boolean
    onRemove: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id })

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
            className={cn(
                "flex items-center gap-2 p-2 rounded border text-xs bg-card group",
                isFlashback ? "border-amber-500/50 bg-amber-500/5" : "border-border"
            )}
        >
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground shrink-0">
                <GripVertical className="w-3.5 h-3.5" />
            </button>
            <span className="font-technical text-[10px] text-muted-foreground tabular-nums w-5 shrink-0">{chronoIndex}.</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{event.title}</span>
                    {isFlashback && <History className="w-3 h-3 text-amber-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="tabular-nums">เล่าเป็นลำดับที่ {narrativeIndex}</span>
                    {event.eventDate && <span className="truncate">· {event.eventDate}</span>}
                </div>
            </div>
            <button
                onClick={onRemove}
                className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] shrink-0"
                title="เอาออกจากเส้นเวลา"
            >
                ✕
            </button>
        </div>
    )
}

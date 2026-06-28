"use client"

import { useState } from "react"
import {
    DndContext,
    DragOverlay,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    sortableKeyboardCoordinates,
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Chapter, TimelineEvent, Character, Location } from "@/db/schema"
import { ChapterColumn } from "./chapter-column"
import { EventCard } from "./event-card"
import { Clock, CheckCircle2, FolderOpen, SlidersHorizontal, Eye, X, Activity } from "lucide-react"
import { reorderTimelineEvents, updateTimelineEvent } from "@/server/timeline"
import { useMemo } from "react"
import { toast } from "sonner"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PlotThreadLedger } from "./plot-thread-ledger"
import { StoryStructureCheatSheet } from "./story-structure-cheatsheet"
import { StructureOverlay, POSITIONAL_STRUCTURES } from "./structure-overlay"
import type { ThreadWithBeats } from "@/server/plot-threads"
import { ArcStrip } from "./arc-strip"
import { TensionCurve } from "./tension-curve"
import type { StoryArc } from "@/db/schema"

type ThreadDot = { color: string; title: string }

const EVENT_TYPE_LABELS: Record<string, string> = {
    scene: "ฉาก",
    action: "แอ็กชัน",
    dialogue: "บทสนทนา",
    flashback: "ย้อนอดีต",
    revelation: "เปิดเผย",
    emotional: "อารมณ์",
    transition: "เชื่อมฉาก",
}

function Stat({
    icon, label, value, sub, highlight,
}: {
    icon: React.ReactNode
    label: string
    value: string | number
    sub?: string
    highlight?: boolean
}) {
    return (
        <div className="flex flex-col gap-0.5 px-3.5 py-2">
            <span className="font-technical text-[9px] uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-1">
                {icon}{label}
            </span>
            <span className="flex items-baseline gap-1">
                <span className={cn(
                    "text-lg font-display font-bold tabular-nums leading-none",
                    highlight && "text-[var(--forge-amber)]"
                )}>
                    {value}
                </span>
                {sub && <span className="text-[10px] text-muted-foreground tabular-nums">{sub}</span>}
            </span>
        </div>
    )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-16 shrink-0">{label}</span>
            <div className="flex-1 min-w-0">{children}</div>
        </label>
    )
}

interface TimelineBoardProps {
    novelId: string
    chapters: Chapter[]
    initialEvents: TimelineEvent[]
    characters?: Character[]
    locations?: Location[]
    threads?: ThreadWithBeats[]
    arcs?: StoryArc[]
}

export function TimelineBoard({
    novelId,
    chapters,
    initialEvents,
    characters = [],
    locations = [],
    threads = [],
    arcs = [],
}: TimelineBoardProps) {
    const [events, setEvents] = useState<TimelineEvent[]>(initialEvents)
    const [activeId, setActiveId] = useState<string | null>(null)

    // ── Filter / lens state ──
    const [filterType, setFilterType] = useState<string>("all")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterCharacter, setFilterCharacter] = useState<string>("all")
    const [filterLocation, setFilterLocation] = useState<string>("all")
    const [filterThread, setFilterThread] = useState<string>("all")
    const [showTension, setShowTension] = useState(false)
    const [structureId, setStructureId] = useState<string>("none")

    // ── event → threads map ──
    const eventThreadsMap = useMemo(() => {
        const m = new Map<string, ThreadDot[]>()
        threads.forEach(t => {
            t.beats.forEach(b => {
                const existing = m.get(b.eventId) ?? []
                existing.push({ color: t.color ?? "#f59e0b", title: t.title })
                m.set(b.eventId, existing)
            })
        })
        return m
    }, [threads])

    // ── event ids belonging to the selected thread ──
    const threadEventIds = useMemo(() => {
        if (filterThread === "all") return null
        const t = threads.find(t => t.id === filterThread)
        if (!t) return null
        return new Set(t.beats.map(b => b.eventId))
    }, [threads, filterThread])

    const activeFilterCount =
        [filterType, filterStatus, filterCharacter, filterLocation, filterThread]
            .filter(v => v !== "all").length
    const isFiltering = activeFilterCount > 0
    const lensCount = (showTension ? 1 : 0) + (structureId !== "none" ? 1 : 0)

    const matchEvent = (e: TimelineEvent) => {
        if (filterType !== "all" && (e.eventType || "scene") !== filterType) return false
        if (filterStatus === "completed" && !e.isCompleted) return false
        if (filterStatus === "draft" && e.isCompleted) return false
        if (filterCharacter !== "all") {
            const ids = (e.relatedCharacterIds as string[]) || []
            if (!ids.includes(filterCharacter)) return false
        }
        if (filterLocation !== "all") {
            const ids = (e.relatedLocationIds as string[]) || []
            if (!ids.includes(filterLocation)) return false
        }
        if (threadEventIds && !threadEventIds.has(e.id)) return false
        return true
    }

    const matchedIds = useMemo(
        () => new Set(events.filter(matchEvent).map(e => e.id)),
        [events, filterType, filterStatus, filterCharacter, filterLocation, threadEventIds]
    )

    // ── Overview stats ──
    const totalScenes = events.length
    const completedScenes = events.filter(e => e.isCompleted).length
    const completedPct = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0
    const emptyChapters = chapters.filter(
        c => !events.some(e => e.relatedChapterId === c.id)
    ).length

    const clearFilters = () => {
        setFilterType("all")
        setFilterStatus("all")
        setFilterCharacter("all")
        setFilterLocation("all")
        setFilterThread("all")
    }

    // Optimistic completion toggle — updates the board (and overview %) instantly
    const handleToggleComplete = (id: string) => {
        const target = events.find(e => e.id === id)
        if (!target) return
        const next = !target.isCompleted
        setEvents(prev => prev.map(e => (e.id === id ? { ...e, isCompleted: next } : e)))
        updateTimelineEvent(id, { isCompleted: next }).then((res) => {
            if (res.success) {
                toast.success(next ? "ฉากนี้เสร็จแล้ว ✓" : "ทำเครื่องหมายเป็นฉบับร่าง")
            } else {
                // revert on failure
                setEvents(prev => prev.map(e => (e.id === id ? { ...e, isCompleted: !next } : e)))
                toast.error("อัปเดตไม่สำเร็จ")
            }
        })
    }

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event
        setActiveId(active.id as string)
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeId = active.id
        const overId = over.id

        if (activeId === overId) return

        const isActiveEvent = true // We only drag events
        const isOverEvent = events.some(e => e.id === overId)
        const isOverChapter = chapters.some(c => c.id === overId)

        if (isActiveEvent && isOverEvent) {
            setEvents((events) => {
                const activeIndex = events.findIndex((e) => e.id === activeId)
                const overIndex = events.findIndex((e) => e.id === overId)

                if (events[activeIndex].relatedChapterId !== events[overIndex].relatedChapterId) {
                    const newEvents = [...events];
                    newEvents[activeIndex] = {
                        ...newEvents[activeIndex],
                        relatedChapterId: events[overIndex].relatedChapterId
                    };
                    return arrayMove(newEvents, activeIndex, overIndex);
                }

                return arrayMove(events, activeIndex, overIndex)
            })
        }

        if (isActiveEvent && isOverChapter) {
            setEvents((events) => {
                const activeIndex = events.findIndex((e) => e.id === activeId)

                const newEvents = [...events];
                newEvents[activeIndex] = {
                    ...newEvents[activeIndex],
                    relatedChapterId: overId as string
                };
                return arrayMove(newEvents, activeIndex, activeIndex)
            })
        }
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveId(null)
        const { active, over } = event
        if (!over) return

        const activeId = active.id as string
        const overId = over.id as string

        if (activeId === overId) return

        const activeEvent = events.find(e => e.id === activeId)
        if (!activeEvent) return

        const updatesToSave: { id: string; orderIndex: number; relatedChapterId: string | null }[] = []

        const orderedEventsByChapter: Record<string, TimelineEvent[]> = {}
        events.forEach(e => {
            if (e.relatedChapterId) {
                if (!orderedEventsByChapter[e.relatedChapterId]) orderedEventsByChapter[e.relatedChapterId] = []
                orderedEventsByChapter[e.relatedChapterId].push(e)
            }
        })

        Object.entries(orderedEventsByChapter).forEach(([chapId, chapEvents]) => {
            chapEvents.forEach((e, idx) => {
                updatesToSave.push({
                    id: e.id,
                    orderIndex: idx,
                    relatedChapterId: chapId
                })
            })
        })

        try {
            await reorderTimelineEvents(updatesToSave)
        } catch (error) {
            console.error("Failed to update timeline", error)
        }
    }

    // Sort chapters
    const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex)

    // Get active event for drag overlay
    const activeEvent = activeId ? events.find(e => e.id === activeId) : null

    if (chapters.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                    <Clock className="w-10 h-10 mb-2 opacity-50" />
                    <h3 className="font-semibold text-lg">No Chapters Yet</h3>
                    <p className="text-sm">Please create a chapter to start building your timeline.</p>
                </div>
            </div>
        )
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full flex flex-col relative">
                {/* Overview + Filter toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/60">
                    {/* Overview stats — เหลือเฉพาะที่ต้องลงมือ: ความคืบหน้า + บทที่ยังว่าง */}
                    <div className="flex items-center divide-x divide-border/60 chamfered-sm border border-border bg-card/50">
                        <Stat
                            icon={<CheckCircle2 className="h-3 w-3" />}
                            label="เสร็จแล้ว"
                            value={`${completedPct}%`}
                            sub={`${completedScenes}/${totalScenes} ฉาก`}
                        />
                        <Stat
                            icon={<FolderOpen className="h-3 w-3" />}
                            label="บทที่ยังว่าง"
                            value={emptyChapters}
                            highlight={emptyChapters > 0}
                        />
                    </div>

                    {/* Tools · Filters · Views */}
                    <div className="flex flex-wrap items-center gap-2">
                        <StoryStructureCheatSheet />
                        <PlotThreadLedger
                            novelId={novelId}
                            threads={threads}
                            events={events}
                            chapters={chapters}
                        />

                        <span className="h-5 w-px bg-border mx-0.5" />

                        {/* ตัวกรอง — รวมทุก filter ไว้ที่เดียว */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 gap-1.5 text-xs",
                                        isFiltering && "border-[var(--forge-amber)]/50 text-[var(--forge-amber)]"
                                    )}
                                >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                    ตัวกรอง
                                    {activeFilterCount > 0 && (
                                        <span className="ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[var(--forge-amber)] text-[10px] font-bold tabular-nums text-black">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-64 p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">ตัวกรองฉาก</span>
                                    {isFiltering && (
                                        <button onClick={clearFilters} className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                                            <X className="h-3 w-3" />ล้าง
                                        </button>
                                    )}
                                </div>
                                <FilterRow label="ประเภท">
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">ทุกประเภท</SelectItem>
                                            {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                                                <SelectItem key={k} value={k}>{v}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterRow>
                                <FilterRow label="สถานะ">
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">ทุกสถานะ</SelectItem>
                                            <SelectItem value="completed">เสร็จแล้ว</SelectItem>
                                            <SelectItem value="draft">ฉบับร่าง</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FilterRow>
                                {characters.length > 0 && (
                                    <FilterRow label="ตัวละคร">
                                        <Select value={filterCharacter} onValueChange={setFilterCharacter}>
                                            <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">ทุกตัวละคร</SelectItem>
                                                {characters.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FilterRow>
                                )}
                                {locations.length > 0 && (
                                    <FilterRow label="สถานที่">
                                        <Select value={filterLocation} onValueChange={setFilterLocation}>
                                            <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">ทุกสถานที่</SelectItem>
                                                {locations.map(l => (
                                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FilterRow>
                                )}
                                {threads.length > 0 && (
                                    <FilterRow label="ปม">
                                        <Select value={filterThread} onValueChange={setFilterThread}>
                                            <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">ทุกปม</SelectItem>
                                                {threads.map(t => (
                                                    <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FilterRow>
                                )}
                            </PopoverContent>
                        </Popover>

                        {/* มุมมอง — เลเยอร์ที่ทาบบนกระดาน */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 gap-1.5 text-xs",
                                        lensCount > 0 && "border-[var(--forge-amber)]/50 text-[var(--forge-amber)]"
                                    )}
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    มุมมอง
                                    {lensCount > 0 && (
                                        <span className="ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[var(--forge-amber)] text-[10px] font-bold tabular-nums text-black">
                                            {lensCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-60 p-3 space-y-3">
                                <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">เลเยอร์ทาบกระดาน</span>
                                <FilterRow label="ทาบโครงเรื่อง">
                                    <Select value={structureId} onValueChange={setStructureId}>
                                        <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">ไม่ทาบ</SelectItem>
                                            {POSITIONAL_STRUCTURES.map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.nameTh}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FilterRow>
                                <button
                                    onClick={() => setShowTension(v => !v)}
                                    className={cn(
                                        "w-full flex items-center justify-between h-8 px-2.5 chamfered-sm border text-xs transition-colors",
                                        showTension
                                            ? "border-[var(--forge-amber)]/50 text-[var(--forge-amber)] bg-[var(--forge-amber)]/5"
                                            : "border-border text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <Activity className="h-3.5 w-3.5" />เส้น tension
                                    </span>
                                    <span className="font-technical text-[9px] uppercase tracking-[0.08em]">
                                        {showTension ? "เปิด" : "ปิด"}
                                    </span>
                                </button>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Timeline Area */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden px-8 pt-4 pb-8">
                    <div className="min-w-max flex flex-col h-full">
                        {/* Story Arc strip */}
                        <ArcStrip
                            novelId={novelId}
                            chapters={sortedChapters}
                            arcs={arcs}
                        />

                        {/* Structure overlay (template guide) */}
                        {structureId !== "none" && (
                            <StructureOverlay structureId={structureId} chapters={sortedChapters} />
                        )}

                        {/* Tension curve (A2) */}
                        {showTension && (
                            <TensionCurve chapters={sortedChapters} events={events} />
                        )}

                        {/* Chapter columns */}
                        <div className="flex flex-1 min-w-max items-start pt-6">
                        {sortedChapters.map((chapter, index) => {
                            const chapterEvents = events.filter(e => e.relatedChapterId === chapter.id)
                            return (
                                <ChapterColumn
                                    key={chapter.id}
                                    chapter={chapter}
                                    events={chapterEvents}
                                    characters={characters}
                                    locations={locations}
                                    isFirst={index === 0}
                                    isLast={index === sortedChapters.length - 1}
                                    matchedIds={matchedIds}
                                    isFiltering={isFiltering}
                                    eventThreadsMap={eventThreadsMap}
                                    onToggleComplete={handleToggleComplete}
                                />
                            )
                        })}

                        {/* End Node */}
                        <div className="h-1 w-16 bg-gradient-to-r from-muted-foreground/30 to-transparent mt-[26px]" />
                        <div className="mt-[18px] h-4 w-4 rounded-full bg-muted-foreground/20" />
                        </div>
                    </div>
                </div>
            </div>

            <DragOverlay>
                {activeEvent ? (
                    <EventCard
                        event={activeEvent}
                        characters={characters}
                        locations={locations}
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    )
}
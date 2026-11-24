"use client"

import { useState, useEffect, useSyncExternalStore } from "react"
import { createPortal } from "react-dom"
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
import Link from "next/link"
import { TimelineEvent, Character, Location, Era, LoreEntry } from "@/db/schema"
import { PLOT_HEADER_SLOT_ID, type ChapterForBoard } from "./types"
import { ChapterColumn } from "./chapter-column"
import { EventCard } from "./event-card"
import { Clock, SlidersHorizontal, Eye, X, Activity, AlertTriangle, Route, Loader2, BookPlus, GanttChart, PencilLine, Milestone, Lightbulb } from "lucide-react"
import { reorderTimelineEvents, updateTimelineEvent, createTimelineEvent } from "@/server/timeline"
import { placeNoteInChapter, type VaultNoteView } from "@/server/idea-vault"
import { IdeaTray } from "./idea-tray"
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
import { StoryStructureCheatSheet } from "./story-structure-cheatsheet"
import { StructureOverlay, POSITIONAL_STRUCTURES } from "./structure-overlay"
import type { ThreadWithBeats } from "@/server/plot-threads"
import { ArcStrip } from "./arc-strip"
import { PlotUndoMenu } from "./plot-undo-menu"
import { TensionCurve } from "./tension-curve"
import { ThreadRibbon } from "./thread-ribbon"
import { SceneSidePanel } from "./scene-side-panel"
import { TimelineConflictsPanel } from "./timeline-conflicts-panel"
import type { StoryArc } from "@/db/schema"
import { getChapterIssueMap, type TimelineConflict, type ChapterIssues } from "@/server/timeline-conflicts"

type ThreadDot = { color: string; title: string }

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
    chapters: ChapterForBoard[]
    initialEvents: TimelineEvent[]
    characters?: Character[]
    locations?: Location[]
    threads?: ThreadWithBeats[]
    arcs?: StoryArc[]
    eras?: (Era & { loreEntries: LoreEntry[] })[]
    timelineEpoch?: Date | null
    /** โน้ตในคลังที่ยังไม่ถูกใช้ (ไม่มีลิงก์ used_in) สำหรับถาดไอเดีย */
    trayNotes?: VaultNoteView[]
    /** ไอเดียที่มีโน้ตชนิด "คำถาม" ค้างอยู่ — นับในแถบล่าง */
    openQuestions?: number
}

export function TimelineBoard({
    novelId,
    chapters,
    initialEvents,
    characters = [],
    locations = [],
    threads = [],
    arcs = [],
    eras = [],
    timelineEpoch = null,
    trayNotes = [],
    openQuestions = 0,
}: TimelineBoardProps) {
    const [events, setEvents] = useState<TimelineEvent[]>(initialEvents)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    // ถาดไอเดีย (task.md 20D) — เปิด/ปิดจำต่อนิยาย · รายการเป็น state ในหน้าจอ (แหล่งจริงคือ idea_vault)
    const trayKey = `plot-board:tray:${novelId}`
    const [trayOpen, setTrayOpen] = useState(false)
    const [tray, setTray] = useState<VaultNoteView[]>(trayNotes)
    useEffect(() => {
        try { setTrayOpen(localStorage.getItem(trayKey) === "1") } catch { /* ปิดไว้ */ }
    }, [trayKey])
    const toggleTray = () => setTrayOpen(v => {
        try { localStorage.setItem(trayKey, v ? "0" : "1") } catch { /* ไม่จำก็ได้ */ }
        return !v
    })
    // วางโน้ตลงบท = สร้างฉากใหม่ท้ายบท มีการ์ด (สำเนาของโน้ต) ใบแรกบน canvas + ผูก used_in
    // โน้ตยังอยู่ในคลัง แค่หายจากถาดเพราะถาดแสดงเฉพาะที่ยังไม่ใช้
    const placeIdea = async (noteId: string, chapterId: string) => {
        const note = tray.find(n => n.id === noteId)
        if (!note) return
        setTray(prev => prev.filter(n => n.id !== noteId))
        const res = await placeNoteInChapter(noteId, chapterId)
        if (!res.success) {
            setTray(prev => [note, ...prev])
            toast.error("วางไอเดียไม่สำเร็จ")
            return
        }
        setEvents(prev => [...prev, res.data.event])
        toast.success(`ทำ “${note.text}” เป็นฉากแล้ว · โน้ตยังอยู่ในคลัง`)
    }
    // โหมดร่าง (phase 1): ซ่อนคำเตือนบนกระดาน เหลือตัวนับในแถบเครื่องมือ — จำต่อนิยายใน localStorage
    const draftKey = `plot-board:draft:${novelId}`
    const [draftMode, setDraftMode] = useState(true)
    const [showArcs, setShowArcs] = useState(arcs.length > 0)
    useEffect(() => {
        try { const v = localStorage.getItem(draftKey); if (v != null) setDraftMode(v === "1") } catch { /* ใช้ค่าเริ่มต้น */ }
    }, [draftKey])
    const toggleDraft = () => setDraftMode(v => {
        try { localStorage.setItem(draftKey, v ? "0" : "1") } catch { /* ไม่จำก็ไม่เป็นไร */ }
        return !v
    })

    // useState's initializer only runs once — server refetch (router.refresh() after create/delete) needs this to reach the board
    useEffect(() => { setEvents(initialEvents) }, [initialEvents])
    const [activeId, setActiveId] = useState<string | null>(null)

    // ── Filter / lens state ──
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterCharacter, setFilterCharacter] = useState<string>("all")
    const [filterLocation, setFilterLocation] = useState<string>("all")
    const [filterThread, setFilterThread] = useState<string>("all")
    const [showTension, setShowTension] = useState(false)
    const [showRibbon, setShowRibbon] = useState(threads.length > 0) // เลนปมด้านล่าง: เปิดเองเมื่อมีปม
    const [structureId, setStructureId] = useState<string>("none")
    const [conflicts, setConflicts] = useState<TimelineConflict[] | null>(null)
    const [chapterIssues, setChapterIssues] = useState<Record<string, ChapterIssues>>({})

    // Load timeline conflicts once for the toolbar chip (B1). Manual planning board — one eager query is fine.
    useEffect(() => {
        getChapterIssueMap(novelId)
            .then(res => {
                if (res.success) setConflicts(res.conflicts)
                setChapterIssues(res.byChapter)
            })
            .catch(() => setConflicts([]))
    }, [novelId])

    // ── event → threads map ──
    const eventThreadsMap = useMemo(() => {
        const m = new Map<string, ThreadDot[]>()
        threads.forEach(t => {
            t.beats.forEach(b => {
                const existing = m.get(b.eventId) ?? []
                existing.push({ color: t.color ?? "var(--forge-amber)", title: t.title })
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
        [filterStatus, filterCharacter, filterLocation, filterThread]
            .filter(v => v !== "all").length
    const isFiltering = activeFilterCount > 0
    const lensCount = (showTension ? 1 : 0) + (showRibbon ? 1 : 0) + (structureId !== "none" ? 1 : 0) + (showArcs ? 1 : 0)

    const matchEvent = (e: TimelineEvent) => {
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
        [events, filterStatus, filterCharacter, filterLocation, threadEventIds]
    )

    // ── Overview stats ──
    const totalScenes = events.length
    const completedScenes = events.filter(e => e.isCompleted).length
    const completedPct = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0
    const emptyChapters = chapters.filter(
        c => !events.some(e => e.relatedChapterId === c.id)
    ).length

    const clearFilters = () => {
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
    const selectedEvent = selectedId ? events.find(e => e.id === selectedId) ?? null : null
    const eventTitles = useMemo(() => new Map(events.map(e => [e.id, e.title])), [events])

    if (chapters.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground px-6 text-center">
                <div className="flex flex-col items-center gap-3 max-w-sm">
                    <Clock className="w-10 h-10 opacity-50" />
                    <h3 className="font-display font-semibold text-lg text-foreground">ยังไม่มีบท</h3>
                    <p className="text-sm">สร้างบทแรกก่อน แล้วค่อยเริ่มวางฉากบนเส้นเวลา</p>
                    <Button asChild size="sm" className="mt-1">
                        <Link href={`/dashboard/project/${novelId}`}>
                            <BookPlus className="h-4 w-4 mr-1.5" />ไปสร้างบท
                        </Link>
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <DndContext
            id="plot-board"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full flex flex-col relative">
                {/* เครื่องมือกระดาน — portal เข้าแถบแท็บของหน้า หน้าตาเดียวกับแท็บ */}
                <PlotHeaderSlot>
                    {/* Tools · Filters · Views */}
                    <div role="toolbar" aria-label="เครื่องมือกระดานพล็อต" className={TAB_LIKE_TOOLS}>
                        <StoryStructureCheatSheet />
                        <PlotUndoMenu novelId={novelId} />

                        {/* ข้อขัดแย้ง timeline (B1) — เดินทางข้ามสถานที่เร็วเกินจริง */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 gap-1.5 text-xs",
                                        conflicts && conflicts.length > 0 && !draftMode ? "border-amber-500/50 text-amber-500" : ""
                                    )}
                                >
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    ข้อขัดแย้ง
                                    {conflicts === null ? (
                                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-label="กำลังตรวจสอบ" />
                                    ) : conflicts.length > 0 ? (
                                        <span className={cn("ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[10px] font-bold tabular-nums", draftMode ? "bg-muted text-muted-foreground" : "bg-amber-500 text-black")}>
                                            {conflicts.length}
                                        </span>
                                    ) : null}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-80 p-3">
                                <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">ข้อขัดแย้งบนเส้นเวลา</span>
                                <div className="mt-2">
                                    <TimelineConflictsPanel novelId={novelId} conflicts={conflicts ?? []} />
                                </div>
                            </PopoverContent>
                        </Popover>

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
                                {isFiltering && (
                                    <p className="text-[11px] text-muted-foreground tabular-nums -mt-1">
                                        แสดง <span className="text-[var(--forge-amber)] font-medium">{matchedIds.size}</span>/{totalScenes} ฉาก
                                    </p>
                                )}
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

                        {/* เส้นเวลา — ชีต chrono เดิมซ้ำกับหน้าเส้นเวลาโลก จึงพาไปหน้านั้นแทน (task.md 20A) */}
                        <Link
                            href={`/dashboard/project/${novelId}/timeline`}
                            className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 font-technical text-[13px] text-muted-foreground hover:text-foreground"
                        >
                            <GanttChart className="h-3.5 w-3.5" />เส้นเวลา
                        </Link>

                        <button
                            type="button"
                            onClick={toggleTray}
                            aria-pressed={trayOpen}
                            title="ถาดไอเดีย — จดเร็ว แล้วลากลงบทเพื่อทำเป็นฉาก"
                            className="inline-flex items-center gap-1.5"
                        >
                            <Lightbulb className="h-3.5 w-3.5" />ถาดไอเดีย{tray.length > 0 && <span className="tabular-nums">· {tray.length}</span>}
                        </button>

                        <button
                            type="button"
                            onClick={toggleDraft}
                            aria-pressed={draftMode}
                            title={draftMode ? "โหมดร่าง: ซ่อนคำเตือนบนกระดาน — กดเพื่อแสดง" : "แสดงคำเตือนอยู่ — กดเพื่อกลับโหมดร่าง"}
                            className="inline-flex items-center gap-1.5"
                        >
                            <PencilLine className="h-3.5 w-3.5" />{draftMode ? "โหมดร่าง" : "โหมดตรวจ"}
                        </button>

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
                                    onClick={() => setShowArcs(v => !v)}
                                    role="switch"
                                    aria-checked={showArcs}
                                    aria-label="แถบ story arc"
                                    className={cn(
                                        "w-full flex items-center justify-between h-8 px-2.5 chamfered-sm border text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-amber)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                        showArcs
                                            ? "border-[var(--forge-amber)]/50 text-[var(--forge-amber)] bg-[var(--forge-amber)]/5"
                                            : "border-border text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <Milestone className="h-3.5 w-3.5" />แถบ story arc
                                    </span>
                                    <span className="font-technical text-[9px] uppercase tracking-[0.08em]">
                                        {showArcs ? "เปิด" : "ปิด"}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setShowTension(v => !v)}
                                    role="switch"
                                    aria-checked={showTension}
                                    aria-label="เลนส์เส้น tension"
                                    className={cn(
                                        "w-full flex items-center justify-between h-8 px-2.5 chamfered-sm border text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-amber)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
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
                                <button
                                    onClick={() => setShowRibbon(v => !v)}
                                    role="switch"
                                    aria-checked={showRibbon}
                                    aria-label="เลนส์เลนปม"
                                    className={cn(
                                        "w-full flex items-center justify-between h-8 px-2.5 chamfered-sm border text-xs transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forge-amber)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                        showRibbon
                                            ? "border-[var(--forge-amber)]/50 text-[var(--forge-amber)] bg-[var(--forge-amber)]/5"
                                            : "border-border text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <span className="inline-flex items-center gap-1.5">
                                        <Route className="h-3.5 w-3.5" />เลนปม
                                    </span>
                                    <span className="font-technical text-[9px] uppercase tracking-[0.08em]">
                                        {showRibbon ? "เปิด" : "ปิด"}
                                    </span>
                                </button>
                            </PopoverContent>
                        </Popover>
                    </div>
                </PlotHeaderSlot>

                <div className="flex min-h-0 flex-1">
                {trayOpen && (
                    <IdeaTray
                        novelId={novelId}
                        notes={tray}
                        chapters={sortedChapters.map(c => ({ id: c.id, title: c.title }))}
                        onAdded={note => setTray(prev => [note, ...prev])}
                        onPlace={placeIdea}
                        onClose={toggleTray}
                    />
                )}
                {/* Timeline Area — เลื่อนแนวตั้งเดียวทั้ง board (ทุกคอลัมน์เลื่อนพร้อมกัน) */}
                <div className="min-w-0 flex-1 overflow-auto px-6 pt-4">
                    <div className="min-w-max flex flex-col min-h-full">
                        {/* Story Arc strip */}
                        {showArcs && (
                            <ArcStrip
                                novelId={novelId}
                                chapters={sortedChapters}
                                arcs={arcs}
                            />
                        )}

                        {/* Structure overlay (template guide) */}
                        {structureId !== "none" && (
                            <StructureOverlay structureId={structureId} chapters={sortedChapters} />
                        )}

                        {/* Tension curve (A2) */}
                        {showTension && (
                            <TensionCurve chapters={sortedChapters} events={events} />
                        )}

                        {/* Chapter columns — ยืดทุกคอลัมน์สูงเท่าคอลัมน์ที่ยาวสุด หัวบทจึง sticky ได้ทุกบท ไม่ใช่แค่บทที่ยาว */}
                        <div className="motion-stagger flex min-w-max flex-1 items-stretch gap-3 pb-8 pt-2">
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
                                    issues={chapterIssues[chapter.id]}
                                    novelId={novelId}
                                    draftMode={draftMode}
                                    selectedId={selectedId}
                                    onOpenScene={id => setSelectedId(cur => (cur === id ? null : id))}
                                    eventTitles={eventTitles}
                                    onDropIdea={placeIdea}
                                />
                            )
                        })}

                        </div>

                        {/* เลนปมเรื่องด้านล่าง (task.md 20B) — ติดขอบล่างของพื้นที่เลื่อน วางฉากอยู่ก็เห็นปมที่เปิดค้าง */}
                        {showRibbon && threads.length > 0 && (
                            <div className="sticky bottom-0 z-10 border-t bg-background/95 pt-1.5 backdrop-blur-sm">
                                <ThreadRibbon threads={threads} chapters={sortedChapters} events={events} />
                            </div>
                        )}
                    </div>
                </div>
                {selectedEvent && (
                    <SceneSidePanel
                        event={selectedEvent}
                        chapterTitle={sortedChapters.find(c => c.id === selectedEvent.relatedChapterId)?.title ?? null}
                        sceneIndex={events.filter(e => e.relatedChapterId === selectedEvent.relatedChapterId).sort((a, b) => a.orderIndex - b.orderIndex).findIndex(e => e.id === selectedEvent.id)}
                        threads={threads}
                        onClose={() => setSelectedId(null)}
                        onPatched={(id, patch) => setEvents(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))}
                    />
                )}
                </div>

                {/* แถบสถานะล่าง — สถิติย้ายมาจากบนสุด (task.md 20B) */}
                <div className="flex shrink-0 items-center gap-3 border-t bg-[var(--sidebar)] px-6 py-1.5 pr-20 text-[11px] tabular-nums text-muted-foreground">
                    <span>{totalScenes} ฉาก · {sortedChapters.length} บท</span>
                    <span>เสร็จ {completedScenes}/{totalScenes} ({completedPct}%)</span>
                    <span>พล็อตแน่นอนแล้ว {events.filter(e => e.plotStatus === "confirmed").length}/{totalScenes}</span>
                    {emptyChapters > 0 && <span className="text-[var(--forge-amber)]">บทที่ยังว่าง {emptyChapters}</span>}
                    {draftMode && conflicts && conflicts.length > 0 && (
                        <span>มี {conflicts.length} จุดให้ดูทีหลัง</span>
                    )}
                    {openQuestions > 0 && <span>คำถามที่ยังไม่มีคำตอบ {openQuestions}</span>}
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
/** portal แถบเครื่องมือขึ้น header ของหน้า plot — ไม่เจอช่อง = วางเป็นแถบเดิมในกระดาน */
function PlotHeaderSlot({ children }: { children: React.ReactNode }) {
    // server snapshot = null → hydrate ตรงกับ HTML ฝั่ง server ก่อน แล้วค่อยย้ายขึ้น header ฝั่ง client
    const slot = useSyncExternalStore(noopSubscribe, () => document.getElementById(PLOT_HEADER_SLOT_ID), () => null)
    const row = <>{children}</>
    // ponytail: portal ข้าม server component — ถ้า header ย้ายเข้า client ทั้งก้อนวันไหน ค่อยส่งเป็น prop แทน
    return slot
        ? createPortal(row, slot)
        : <div className="flex justify-end px-4 border-b border-border/60">{row}</div>
}

const noopSubscribe = () => () => {}

/**
 * เครื่องมือให้หน้าตาเหมือนแท็บ (plot-page-tabs.tsx): ตัวอักษร technical 13px ไม่มีกรอบ/พื้น
 * เส้นใต้ทองเมื่อเปิดอยู่ (data-state=open ของ Radix popover/sheet)
 * ponytail: ทับสไตล์ปุ่มของแต่ละ component ด้วย selector ลูก — ไม่ต้องไล่แก้ trigger ทีละไฟล์
 */
const TAB_LIKE_TOOLS = cn(
    "flex flex-wrap items-center",
    "[&_button]:h-auto [&_button]:rounded-none [&_button]:border-0 [&_button]:border-b-2 [&_button]:border-transparent",
    "[&_button]:bg-transparent [&_button]:shadow-none [&_button]:px-3 [&_button]:py-2 [&_button]:-mb-px",
    "[&_button]:font-technical [&_button]:text-[13px] [&_button]:normal-case [&_button]:tracking-normal [&_button]:text-muted-foreground",
    "[&_button:hover]:text-foreground [&_button:hover]:bg-transparent",
    "[&_button[data-state=open]]:border-[var(--forge-gold)] [&_button[data-state=open]]:text-foreground",
)

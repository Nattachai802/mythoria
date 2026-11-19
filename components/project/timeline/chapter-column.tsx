"use client"

import { useState } from "react"

import type { ChapterForBoard } from "./types"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Plus, Layout, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ChapterIssues } from "@/server/timeline-conflicts"
import { cn } from "@/lib/utils"
import { TimelineEvent, Character, Location } from "@/db/schema"
import { EventCard } from "./event-card"
import { CreateSceneDialog } from "./create-scene-dialog"
import { IDEA_DRAG_TYPE } from "./idea-tray"

type ThreadDot = { color: string; title: string }

interface ChapterColumnProps {
    chapter: ChapterForBoard
    events: TimelineEvent[]
    characters?: Character[]
    locations?: Location[]
    isFirst: boolean
    isLast: boolean
    matchedIds?: Set<string>
    isFiltering?: boolean
    eventThreadsMap?: Map<string, ThreadDot[]>
    onToggleComplete?: (id: string) => void
    issues?: ChapterIssues
    novelId?: string
    /** โหมดร่าง: ซ่อนคำเตือน (ป้ายปัญหาของบท, "แล้วก็") */
    draftMode?: boolean
    selectedId?: string | null
    onOpenScene?: (id: string) => void
    /** id → ชื่อฉาก ใช้ทำข้อความลิงก์เหตุ-ผลบนการ์ด */
    eventTitles?: Map<string, string>
    /** วางไอเดียจากถาด (ลากแบบ native) ลงบทนี้ */
    onDropIdea?: (ideaId: string, chapterId: string) => void
}

export function ChapterColumn({
    chapter,
    events,
    characters = [],
    locations = [],
    isFirst,
    matchedIds,
    isFiltering = false,
    eventThreadsMap,
    onToggleComplete,
    issues,
    novelId,
    draftMode = false,
    selectedId,
    onOpenScene,
    eventTitles,
    onDropIdea,
}: ChapterColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: chapter.id })
    const [ideaOver, setIdeaOver] = useState(false)

    const sortedEvents = [...events].sort((a, b) => a.orderIndex - b.orderIndex)
    const completedCount = events.filter(e => e.isCompleted).length
    const matchedCount = matchedIds ? events.filter(e => matchedIds.has(e.id)).length : events.length
    const columnDimmed = isFiltering && matchedCount === 0

    // ฉากทุกใบโชว์ทันที — เดิมซ่อนหลังกระป๋องฟิล์มต้องกดทีละบท (task.md 20B)
    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex w-[272px] shrink-0 flex-col rounded-lg transition-opacity duration-300",
                "animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out [animation-fill-mode:backwards] motion-reduce:animate-none",
                isOver && "ring-2 ring-[var(--forge-amber)]/30",
                columnDimmed && "opacity-30",
            )}
        >
            {/* หัวบท */}
            <div className="sticky top-0 z-10 mb-2 flex items-center gap-2 bg-background/95 px-1 py-1.5 backdrop-blur-sm">
                <span className="chamfered-sm flex h-6 min-w-6 shrink-0 items-center justify-center bg-[var(--steel-800)] px-1 font-mono text-xs font-semibold text-[var(--forge-gold)]">
                    {isFirst ? "S" : chapter.orderIndex}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-semibold leading-tight" title={chapter.title}>{chapter.title}</p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                        {isFiltering
                            ? `${matchedCount}/${events.length} ตรงตัวกรอง`
                            : `${events.length} ฉาก${completedCount > 0 ? ` · เสร็จ ${completedCount}` : ""}`}
                    </p>
                </div>
                {issues && !draftMode && <ChapterIssueBadge issues={issues} novelId={novelId} />}
                <Link
                    href={`/dashboard/project/${chapter.novelId}/chapter/${chapter.id}/overview`}
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title="ภาพรวมบทนี้ (จังหวะ / สรุป / เช็คลิสต์)"
                    aria-label={`ภาพรวมบท ${chapter.title}`}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Layout className="h-3.5 w-3.5" />
                </Link>
            </div>

            <div
                className={cn("rounded-lg bg-muted/40 p-1.5 transition-colors", ideaOver && "bg-[var(--forge-amber)]/10 ring-2 ring-[var(--forge-amber)]/50")}
                // ถาดไอเดียใช้ลากแบบ native (dataTransfer) แยกจาก dnd-kit ที่ใช้เรียงฉาก จึงไม่ตีกัน
                onDragOver={onDropIdea ? (e) => { if (e.dataTransfer.types.includes(IDEA_DRAG_TYPE)) { e.preventDefault(); setIdeaOver(true) } } : undefined}
                onDragLeave={onDropIdea ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIdeaOver(false) } : undefined}
                onDrop={onDropIdea ? (e) => {
                    const id = e.dataTransfer.getData(IDEA_DRAG_TYPE)
                    setIdeaOver(false)
                    if (id) { e.preventDefault(); onDropIdea(id, chapter.id) }
                } : undefined}
            >
                <SortableContext items={sortedEvents.map(e => e.id)} strategy={verticalListSortingStrategy}>
                    {sortedEvents.map((event, index) => (
                        <EventCard
                            key={event.id}
                            event={event}
                            characters={characters}
                            locations={locations}
                            isDimmed={isFiltering && !!matchedIds && !matchedIds.has(event.id)}
                            threadDots={eventThreadsMap?.get(event.id)}
                            onToggleComplete={onToggleComplete}
                            isFirstScene={isFirst && index === 0}
                            hideWeakCausal={draftMode}
                            isSelected={selectedId === event.id}
                            onOpen={onOpenScene}
                            causeTitle={event.causeEventId ? eventTitles?.get(event.causeEventId) : null}
                        />
                    ))}
                </SortableContext>
                <CreateSceneDialog
                    novelId={chapter.novelId}
                    chapterId={chapter.id}
                    trigger={
                        <button
                            type="button"
                            className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:border-[var(--forge-amber)]/60 hover:text-foreground"
                        >
                            <Plus className="h-3.5 w-3.5" /> เพิ่มฉาก
                        </button>
                    }
                />
            </div>
        </div>
    )
}

function ChapterIssueBadge({ issues, novelId }: { issues: ChapterIssues; novelId?: string }) {
    const holeTotal = issues.holes.reduce((n, h) => n + h.count, 0)
    const total = issues.travel.length + holeTotal
    if (total === 0) return null
    const noteHref = (id: string) => novelId ? `/dashboard/project/${novelId}/note/${id}` : "#"
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={`บทนี้มีปัญหา ${total} จุด`}
                    className="flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/50 bg-background px-1.5 py-0.5 text-[11px] font-medium text-amber-500 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                >
                    <AlertTriangle className="h-3 w-3" />
                    {total}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3 space-y-3 text-sm" onPointerDown={(e) => e.stopPropagation()}>
                {issues.travel.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground/80">เดินทางไม่ทัน ({issues.travel.length})</p>
                        {issues.travel.map((c, i) => (
                            <div key={`${c.characterId}-${i}`} className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs">
                                <p>{c.message}</p>
                                <p className="mt-1 text-muted-foreground">
                                    <Link href={noteHref(c.fromLocation.noteId)} className="underline-offset-2 hover:underline">{c.fromLocation.noteTitle || "โน้ตต้นทาง"}</Link>
                                    {" → "}
                                    <Link href={noteHref(c.toLocation.noteId)} className="underline-offset-2 hover:underline">{c.toLocation.noteTitle || "โน้ตปลายทาง"}</Link>
                                </p>
                            </div>
                        ))}
                    </div>
                )}
                {issues.holes.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground/80">ช่องโหว่พล็อต ({holeTotal})</p>
                        {issues.holes.map(h => (
                            <Link key={h.noteId} href={noteHref(h.noteId)} className="flex justify-between rounded-md px-2 py-1 text-xs hover:bg-muted">
                                <span className="truncate">{h.noteTitle}</span>
                                <span className="text-amber-500">{h.count}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}

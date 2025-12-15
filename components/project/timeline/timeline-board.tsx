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
} from "@dnd-kit/sortable"
import { Chapter, TimelineEvent } from "@/db/schema"
import { ChapterColumn } from "./chapter-column"
import { EventCard } from "./event-card"
import { Clock, Plus, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { reorderTimelineEvents } from "@/server/timeline"

interface TimelineBoardProps {
    novelId: string
    chapters: Chapter[]
    initialEvents: TimelineEvent[]
}

export function TimelineBoard({ novelId, chapters, initialEvents }: TimelineBoardProps) {
    const [events, setEvents] = useState<TimelineEvent[]>(initialEvents)
    const [activeId, setActiveId] = useState<string | null>(null)

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

        // Prepare updates for reordering
        // We need to update orderIndex for all events in the affected chapter(s)
        // For simplicity and correctness, we recalculate orderIndex for ALL events in the affected chapters based on their current position in `events` array.

        const updatesToSave: { id: string; orderIndex: number; relatedChapterId: string | null }[] = []

        // We need to preserve the order from `events` array
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

    // เรียงลำดับ Chapter ก่อน render
    const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex)

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
                {/* ส่วนหัว Timeline (เช่น Start Story Icon) */}
                <div className="flex items-center gap-2 p-4 pb-0 text-muted-foreground">
                    <Clock className="w-5 h-5" />
                    <span className="font-semibold text-sm">Story Timeline</span>
                </div>

                {/* พื้นที่ Scroll แนวนอน */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden p-8">
                    <div className="flex h-full min-w-max items-start pt-8">
                        {/* pt-8 เพื่อเว้นที่ให้ Label ของ Chapter */}

                        {sortedChapters.map((chapter, index) => (
                            <ChapterColumn
                                key={chapter.id}
                                chapter={chapter}
                                events={events.filter(e => e.relatedChapterId === chapter.id)}
                                isFirst={index === 0} // เช็คตัวแรก
                                isLast={index === sortedChapters.length - 1} // เช็คตัวสุดท้าย
                            />
                        ))}

                        {/* End Node (Optional: จุดจบเรื่อง) */}
                        <div className="h-1 w-16 bg-gradient-to-r from-muted-foreground/30 to-transparent mt-[26px]" />
                        <div className="mt-[18px] h-4 w-4 rounded-full bg-muted-foreground/20" />
                    </div>
                </div>


            </div>

            <DragOverlay>
                {activeId ? (
                    <EventCard event={events.find(e => e.id === activeId)!} />
                ) : null}
            </DragOverlay>
        </DndContext >
    )
}
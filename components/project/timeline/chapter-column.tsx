"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Chapter, TimelineEvent, Character, Location } from "@/db/schema"
import { createTimelineEvent } from "@/server/timeline"
import { EventCard } from "./event-card"
import { CreateSceneDialog } from "./create-scene-dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ChapterColumnProps {
    chapter: Chapter
    events: TimelineEvent[]
    characters?: Character[]
    locations?: Location[]
    isFirst: boolean
    isLast: boolean
}

export function ChapterColumn({
    chapter,
    events,
    characters = [],
    locations = [],
    isFirst,
    isLast
}: ChapterColumnProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { setNodeRef, isOver } = useDroppable({
        id: chapter.id,
    })

    const sortedEvents = [...events].sort((a, b) => a.orderIndex - b.orderIndex)

    const handleChapterClick = async (e: React.MouseEvent) => {
        e.stopPropagation()

        if (events.length > 0) {
            router.push(`/dashboard/project/${chapter.novelId}/plot/${events[0].id}`)
        } else {
            startTransition(async () => {
                const result = await createTimelineEvent({
                    title: "Scene 1",
                    description: "",
                    novelId: chapter.novelId,
                    relatedChapterId: chapter.id,
                    eventDate: "",
                    orderIndex: 0,
                })

                if (result.success && result.event) {
                    toast.success("Scene 1 created automatically")
                    router.push(`/dashboard/project/${chapter.novelId}/plot/${result.event.id}`)
                } else {
                    toast.error("Failed to create scene")
                }
            })
        }
    }

    // Count completed events
    const completedCount = events.filter(e => e.isCompleted).length

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col items-center min-w-[320px] max-w-[320px] h-full relative group",
                isOver && "ring-2 ring-primary/20 rounded-lg"
            )}
        >
            {/* Horizontal line connector */}
            <div className="absolute top-[24px] left-0 w-full flex items-center justify-center pointer-events-none">
                <div className={cn(
                    "h-1 w-1/2 bg-muted-foreground/30",
                    isFirst ? "invisible" : "visible"
                )} />

                <div className={cn(
                    "h-1 w-1/2 bg-muted-foreground/30",
                    isLast && "bg-gradient-to-r from-muted-foreground/30 to-transparent"
                )} />
            </div>

            {/* Chapter Header */}
            <div className="relative z-10 mb-4 flex flex-col items-center">
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleChapterClick}
                    className={cn(
                        "h-12 w-12 rounded-full border-4 flex items-center justify-center shadow-sm transition-all duration-300 cursor-pointer",
                        "bg-background border-primary text-primary font-bold text-lg",
                        "group-hover:scale-110 group-hover:border-primary/80",
                        isPending && "opacity-50 cursor-wait"
                    )}
                    aria-disabled={isPending}
                >
                    {isFirst ? "S" : chapter.orderIndex}
                </div>

                <div className="absolute top-14 w-52 text-center bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border shadow-sm">
                    <span className="text-sm font-semibold text-foreground block truncate">
                        {chapter.title}
                    </span>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                        <span>{events.length} scenes</span>
                        {completedCount > 0 && (
                            <>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                    {completedCount} done
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Events List */}
            <div className="w-full mt-12 px-2 flex-1 min-h-0">
                <ScrollArea className="h-full max-h-[calc(100vh-280px)]">
                    <SortableContext
                        items={sortedEvents.map(e => e.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="space-y-3 pb-4">
                            {/* Vertical Timeline Line */}
                            {sortedEvents.length > 0 && (
                                <div className="absolute left-1/2 top-32 bottom-20 w-0.5 bg-gradient-to-b from-muted-foreground/30 via-muted-foreground/20 to-transparent -translate-x-1/2 pointer-events-none" />
                            )}

                            {sortedEvents.map((event) => (
                                <EventCard
                                    key={event.id}
                                    event={event}
                                    characters={characters}
                                    locations={locations}
                                />
                            ))}
                        </div>
                    </SortableContext>

                    {/* Add Scene Button */}
                    <div className="mt-2 mb-4">
                        <CreateSceneDialog
                            novelId={chapter.novelId}
                            chapterId={chapter.id}
                            trigger={
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed border-muted-foreground/30 hover:border-primary/50"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Scene
                                </Button>
                            }
                        />
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}
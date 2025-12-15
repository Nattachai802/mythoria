"use client"

import { useDroppable } from "@dnd-kit/core"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Chapter, TimelineEvent } from "@/db/schema"
import { createTimelineEvent } from "@/server/timeline"


interface ChapterColumnProps {
    chapter: Chapter
    events: TimelineEvent[]
    isFirst: boolean
    isLast: boolean
}

export function ChapterColumn({ chapter, events, isFirst, isLast }: ChapterColumnProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { setNodeRef } = useDroppable({
        id: chapter.id,
    })

    const handleChapterClick = async (e: React.MouseEvent) => {
        e.stopPropagation()

        if (events.length > 0) {
            // มี scene อยู่แล้ว ไปที่ scene แรก
            router.push(`/dashboard/project/${chapter.novelId}/plot/${events[0].id}`)
        } else {
            // ไม่มี scene สร้างอัตโนมัติ
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

    return (
        <div
            ref={setNodeRef}
            className="flex flex-col items-center min-w-[300px] max-w-[300px] h-full relative group"
        >
            <div className="absolute top-[24px] left-0 w-full flex items-center justify-center pointer-events-none">
                <div className={cn(
                    "h-1 w-1/2 bg-muted-foreground/30",
                    isFirst ? "invisible" : "visible"
                )} />

                <div className={cn(
                    "h-1 w-1/2 bg-muted-foreground/30",
                    isLast && "bg-gradient-to-r from-muted-foreground/30 to-transparent" // Fade out ตอนจบ
                )} />
            </div>

            <div className="relative z-10 mb-6 flex flex-col items-center">
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
                    {isFirst ? "S" : chapter.orderIndex} {/* ถ้าตัวแรกแสดง S (Start) */}
                </div>

                <div className="absolute top-14 w-48 text-center bg-background/80 backdrop-blur-sm px-2 rounded-md border shadow-sm">
                    <span className="text-sm font-semibold text-foreground block truncate">
                        {chapter.title}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {events.length} Events
                    </span>
                </div>
            </div>

            {/* Events section */}
            {/* Events section removed */}
        </div>
    )
}
"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"
import { Plus, Layout } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Chapter, TimelineEvent, Character, Location } from "@/db/schema"
import { createTimelineEvent } from "@/server/timeline"
import { EventCard } from "./event-card"
import { CreateSceneDialog } from "./create-scene-dialog"
import { Button } from "@/components/ui/button"

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
    const [isExpanded, setIsExpanded] = useState(false)

    const { setNodeRef, isOver } = useDroppable({
        id: chapter.id,
    })

    const sortedEvents = [...events].sort((a, b) => a.orderIndex - b.orderIndex)

    const handleChapterClick = async (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsExpanded(!isExpanded)
    }

    const completedCount = events.filter(e => e.isCompleted).length

    // CSS Pattern สำหรับรูหนามเตย
    const filmPerforationStyle = {
        backgroundImage: `
            linear-gradient(to bottom, 
                transparent 0px, 
                transparent 8px, 
                #3f3f46 8px, 
                #3f3f46 16px,
                transparent 16px,
                transparent 24px
            )
        `,
        backgroundSize: '100% 24px',
        backgroundRepeat: 'repeat-y',
    }

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex flex-col items-center min-w-[260px] max-w-[260px] h-full relative group",
                isOver && "ring-2 ring-primary/20 rounded-lg"
            )}
        >
            {/* Horizontal line connector */}
            <div className="absolute top-[32px] left-0 w-full flex items-center justify-center pointer-events-none">
                <div className={cn(
                    "h-1 w-1/2 bg-muted-foreground/30",
                    isFirst ? "invisible" : "visible"
                )} />

                <div className={cn(
                    "h-1 w-1/2 bg-muted-foreground/30",
                    isLast && "bg-gradient-to-r from-muted-foreground/30 to-transparent"
                )} />
            </div>

            {/* Realistic 35mm Film Canister */}
            <div className="relative z-10 mb-6 flex flex-col items-center">
                <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={handleChapterClick}
                    className={cn(
                        "relative cursor-pointer transition-all duration-300",
                        "hover:scale-105",
                        isPending && "opacity-50 cursor-wait"
                    )}
                    aria-disabled={isPending}
                >
                    {/* 1. Spool Knob (แกนหมุนด้านบน) */}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-3 rounded-t-md bg-gradient-to-b from-zinc-300 to-zinc-400 shadow-sm z-20" />

                    {/* 2. Top Cap (ฝาปิดบน) */}
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-14 h-3 rounded-sm bg-gradient-to-b from-zinc-800 to-zinc-900 shadow-md z-10">
                        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/40" />
                    </div>

                    {/* 3. Cylindrical Body (ตัวถังกระบอก) */}
                    <div className={cn(
                        "relative w-12 h-20 mt-4 rounded-sm overflow-hidden",
                        // Metallic gradient to simulate cylinder
                        "bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800",
                        "border-2 border-zinc-900/50",
                        "shadow-lg",
                        isExpanded && "ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background"
                    )}>
                        {/* Metallic Highlight (แสงตกกระทบซ้าย) */}
                        <div className="absolute left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-zinc-500/40 via-zinc-400/30 to-zinc-500/40 pointer-events-none" />

                        {/* Kodak-Style Label (ฉลากสีเหลือง-ส้ม) */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-12 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 flex flex-col items-center justify-center border-y border-amber-600/30">
                            {/* Brand Text */}
                            <span className="text-[6px] font-bold text-zinc-900 tracking-wider uppercase">
                                Chapter
                            </span>
                            {/* Chapter Number - ISO Style */}
                            <span className="text-2xl font-black text-zinc-900 leading-none -mt-0.5">
                                {isFirst ? "S" : chapter.orderIndex}
                            </span>
                            {/* Scene Count */}
                            <span className="text-[6px] font-semibold text-zinc-800 mt-0.5">
                                {events.length} SCENES
                            </span>
                        </div>

                        {/* DX Code Pattern (ลายข้างกระบอก) */}
                        <div className="absolute right-1 top-2 bottom-2 w-[2px] flex flex-col gap-[3px] pointer-events-none">
                            <div className="h-1 bg-zinc-900/50 rounded-full" />
                            <div className="h-1 bg-zinc-900/50 rounded-full" />
                            <div className="h-1 bg-zinc-900/50 rounded-full" />
                        </div>

                        {/* Bottom Shadow (ความลึก) */}
                        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                    </div>

                    {/* Film Leader (ลิ้นฟิล์มที่ยื่นออกมา) */}
                    {isExpanded && (
                        <div className="absolute left-1/2 top-[96px] -translate-x-1/2 w-8 h-24 pointer-events-none z-0">
                            {/* Film Strip emerging from canister */}
                            <div
                                className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-full bg-gradient-to-b from-amber-900/80 via-amber-800/50 to-transparent"
                                style={{
                                    clipPath: 'polygon(40% 0%, 60% 0%, 55% 100%, 45% 100%)',
                                }}
                            >
                                {/* Perforation hints */}
                                <div className="absolute left-0 top-2 bottom-8 w-[2px] bg-black/30" />
                                <div className="absolute right-0 top-2 bottom-8 w-[2px] bg-black/30" />
                            </div>
                        </div>
                    )}

                    {/* 4. Bottom Cap */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-2 rounded-b-sm bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-md z-10" />
                </div>

                {/* Chapter Info Label */}
                <div className="absolute top-[118px] w-52 text-center bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border shadow-sm">
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
                    <div className="mt-1 flex justify-center">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 text-[10px] px-2 w-full"
                            onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/project/${chapter.novelId}/chapter/${chapter.id}/overview`)
                            }}
                        >
                            <Layout className="h-3 w-3 mr-1" />
                            Board View
                        </Button>
                    </div>
                </div>
            </div>

            {/* Filmstrip Container - Collapsible */}
            <div
                className={cn(
                    "w-full mt-20 flex-1 min-h-0 overflow-hidden transition-all duration-500 ease-in-out",
                    isExpanded ? "opacity-100 max-h-[calc(100vh-320px)]" : "opacity-0 max-h-0"
                )}
            >
                <div className="h-full overflow-y-auto no-scrollbar">
                    <div className="relative flex">
                        {/* Left Perforation */}
                        <div
                            className="w-3 bg-[#18181b] border-r border-white/10 shrink-0"
                            style={filmPerforationStyle}
                        />

                        {/* Content Area */}
                        <div className="flex-1 bg-[#faf9f6] relative">
                            <SortableContext
                                items={sortedEvents.map(e => e.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="px-2 py-3 space-y-0">
                                    {sortedEvents.map((event, index) => (
                                        <div key={event.id} className="relative">
                                            <EventCard
                                                event={event}
                                                characters={characters}
                                                locations={locations}
                                            />
                                            <div className="h-[2px] bg-zinc-300/60 mx-1" />
                                        </div>
                                    ))}

                                    {/* Add Scene Button */}
                                    <div className="pt-2 pb-3">
                                        <CreateSceneDialog
                                            novelId={chapter.novelId}
                                            chapterId={chapter.id}
                                            trigger={
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "w-full h-20 justify-center",
                                                        "bg-white/50 hover:bg-white/80",
                                                        "text-muted-foreground hover:text-primary",
                                                        "border-2 border-dashed border-zinc-300/70 hover:border-primary/50",
                                                        "transition-all duration-200"
                                                    )}
                                                >
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Plus className="h-5 w-5" />
                                                        <span className="text-xs font-medium">Add Scene</span>
                                                    </div>
                                                </Button>
                                            }
                                        />
                                    </div>
                                </div>
                            </SortableContext>
                        </div>

                        {/* Right Perforation */}
                        <div
                            className="w-3 bg-[#18181b] border-l border-white/10 shrink-0"
                            style={filmPerforationStyle}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
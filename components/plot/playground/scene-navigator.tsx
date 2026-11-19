"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, ChevronLeft, ChevronRight, Plus, Trash2, ArrowLeft, GanttChart } from "lucide-react"
import { Chapter, TimelineEvent } from "@/db/schema"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { CreateSceneDialog } from "@/components/project/timeline/create-scene-dialog"
import { deleteTimelineEvent } from "@/server/timeline"
import { toast } from "sonner"
import { pushPlotUndo, removePlotUndo } from "@/hooks/use-plot-undo-stack"
import { restorePlotUndoEntry } from "@/lib/plot-undo-restore"
import Link from "next/link"

interface SceneNavigatorProps {
    novelId: string
    currentEvent: TimelineEvent
    events: TimelineEvent[]
    chapters: Chapter[]
    novelTitle?: string
}

export function SceneNavigator({
    novelId,
    currentEvent,
    events,
    chapters,
    novelTitle,
}: SceneNavigatorProps) {
    const router = useRouter()
    const [open, setOpen] = React.useState(false)
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    // Group events by chapter
    const eventsByChapter = React.useMemo(() => {
        const grouped: Record<string, TimelineEvent[]> = {}
        const chapterOrder: string[] = []

        // Sort chapters by orderIndex
        const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex)

        sortedChapters.forEach(c => {
            grouped[c.id] = []
            chapterOrder.push(c.id)
        })

        // Add "Unassigned" group if needed
        grouped["unassigned"] = []

        events.forEach(e => {
            if (e.relatedChapterId && grouped[e.relatedChapterId]) {
                grouped[e.relatedChapterId].push(e)
            } else {
                grouped["unassigned"].push(e)
            }
        })

        // Remove empty groups or sort events within groups if needed (events already sorted by server?)
        return { grouped, chapterOrder }
    }, [chapters, events])

    // ลบฉาก — snapshot field หลักเก็บเข้าสแตกกู้คืนกลาง (รอด navigation เพราะ sessionStorage ไม่ใช่ React state)
    // undo ทันทีจาก toast, หรือทีหลังจากเมนู "กู้คืนล่าสุด" ที่หน้า /plot (ปม/canvas ของฉากเดิมกู้ไม่คืน — จำกัดเฉพาะ field หลัก)
    const handleDelete = async () => {
        setDeleteOpen(false)
        const snapshot = currentEvent
        const res = await deleteTimelineEvent(currentEvent.id)
        if (!res.success) { toast.error("ลบฉากไม่สำเร็จ"); return }
        const entry = pushPlotUndo(novelId, {
            kind: "scene",
            label: snapshot.title,
            payload: {
                novelId,
                title: snapshot.title,
                description: snapshot.description,
                eventDate: snapshot.eventDate,
                relatedChapterId: snapshot.relatedChapterId,
                relatedCharacterIds: snapshot.relatedCharacterIds,
                relatedLocationIds: snapshot.relatedLocationIds,
                eventType: snapshot.eventType,
                canvasData: snapshot.canvasData,
            },
        })
        router.push(`/dashboard/project/${novelId}/plot`)
        toast.success("ลบฉากแล้ว", {
            action: {
                label: "ย้อนกลับ",
                onClick: () => restorePlotUndoEntry(novelId, entry).then(r => {
                    if (r.success) {
                        removePlotUndo(novelId, entry.id)
                        if (r.sceneId) router.push(`/dashboard/project/${novelId}/plot/${r.sceneId}`)
                    } else toast.error(r.error || "ย้อนกลับไม่สำเร็จ")
                }),
            },
        })
    }

    const currentChapter = chapters.find(c => c.id === currentEvent.relatedChapterId)

    // ลำดับเล่าแบบแบน (บทตาม orderIndex → ฉากในบท → ยังไม่จัดตอน) สำหรับปุ่มฉากก่อน/ถัดไป (task.md 20C)
    const flat = [...eventsByChapter.chapterOrder.flatMap(id => eventsByChapter.grouped[id]), ...eventsByChapter.grouped["unassigned"]]
    const pos = flat.findIndex(e => e.id === currentEvent.id)
    const prev = pos > 0 ? flat[pos - 1] : null
    const next = pos >= 0 && pos < flat.length - 1 ? flat[pos + 1] : null
    const chapterScenes = eventsByChapter.grouped[currentEvent.relatedChapterId ?? "unassigned"] ?? eventsByChapter.grouped["unassigned"]
    const posInChapter = chapterScenes.findIndex(e => e.id === currentEvent.id)
    const stepBtn = (target: TimelineEvent | null, dir: "prev" | "next") => (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-8 text-muted-foreground transition-transform active:scale-90 pointer-coarse:h-11 pointer-coarse:w-11"
            disabled={!target}
            onClick={() => target && router.push(`/dashboard/project/${novelId}/plot/${target.id}`)}
            aria-label={dir === "prev" ? "ฉากก่อนหน้า" : "ฉากถัดไป"}
            title={target ? `${dir === "prev" ? "ฉากก่อนหน้า" : "ฉากถัดไป"}: ${target.title}` : dir === "prev" ? "ฉากแรกแล้ว" : "ฉากสุดท้ายแล้ว"}
        >
            {dir === "prev" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
    )

    return (
        <div className="flex min-w-0 flex-1 items-center gap-1">
            <Button variant="ghost" size="icon" asChild className="mr-1 shrink-0 text-muted-foreground transition-transform active:scale-90">
                <Link href={`/dashboard/project/${novelId}/plot`} aria-label="กลับกระดานพล็อต" title="กลับกระดานพล็อต">
                    <ArrowLeft className="w-4 h-4" />
                </Link>
            </Button>

            {stepBtn(prev, "prev")}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        role="combobox"
                        aria-expanded={open}
                        aria-label={`เลือกฉาก (ตอนนี้: ${currentEvent.title})`}
                        className="group flex h-11 w-[min(300px,calc(100vw-8rem))] items-center gap-2 rounded-md px-2.5 text-left transition-colors hover:bg-muted data-[state=open]:bg-muted"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-[15px] font-semibold leading-tight">{currentEvent.title}</span>
                            <span className="block truncate text-[11px] tabular-nums text-muted-foreground">
                                {currentChapter?.title ?? "ยังไม่จัดตอน"}{posInChapter >= 0 && ` · ฉาก ${posInChapter + 1}/${chapterScenes.length}`}
                            </span>
                        </span>
                        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="ค้นหาฉาก..." />
                        <CommandList>
                            <CommandEmpty>ไม่พบฉาก</CommandEmpty>
                            {eventsByChapter.chapterOrder.map(chapterId => {
                                const chapterEvents = eventsByChapter.grouped[chapterId]
                                if (chapterEvents.length === 0) return null
                                const chapter = chapters.find(c => c.id === chapterId)
                                return (
                                    <CommandGroup key={chapterId} heading={chapter?.title || "ไม่ระบุตอน"}>
                                        {chapterEvents.map(event => (
                                            <CommandItem
                                                key={event.id}
                                                value={`${event.title} ${event.id}`} // Ensure unique value for search
                                                onSelect={() => {
                                                    setOpen(false)
                                                    router.push(`/dashboard/project/${novelId}/plot/${event.id}`)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        currentEvent.id === event.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                {event.title}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )
                            })}
                            {eventsByChapter.grouped["unassigned"].length > 0 && (
                                <CommandGroup heading="ยังไม่จัดตอน">
                                    {eventsByChapter.grouped["unassigned"].map(event => (
                                        <CommandItem
                                            key={event.id}
                                            value={`${event.title} ${event.id}`}
                                            onSelect={() => {
                                                setOpen(false)
                                                router.push(`/dashboard/project/${novelId}/plot/${event.id}`)
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    currentEvent.id === event.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {event.title}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {stepBtn(next, "next")}

            {/* ฉากใหม่ชิดชื่อฉาก — สร้างในบทเดียวกับฉากนี้ */}
            <div className="ml-1 shrink-0">
                <CreateSceneDialog
                    novelId={novelId}
                    chapterId={currentEvent.relatedChapterId || ""}
                    trigger={
                        <Button variant="outline" size="sm" className="h-8 gap-1.5">
                            <Plus className="w-4 h-4" />
                            ฉากใหม่
                        </Button>
                    }
                />
            </div>

            {/* ขวา: ชื่อเรื่อง · ดูบนเส้นเวลา · ลบ */}
            <div className="ml-auto flex shrink-0 items-center gap-1">
                {novelTitle && (
                    <span className="mr-2 hidden max-w-[16rem] truncate text-xs text-muted-foreground lg:inline" title={novelTitle}>{novelTitle}</span>
                )}

                <Button variant="ghost" size="icon" asChild className="text-muted-foreground pointer-coarse:h-11 pointer-coarse:w-11">
                    <Link
                        href={`/dashboard/project/${novelId}/timeline?focus=${encodeURIComponent(`scene:${currentEvent.id}`)}`}
                        aria-label="ดูฉากนี้บนเส้นเวลา"
                        title="ดูฉากนี้บนเส้นเวลา"
                    >
                        <GanttChart className="w-4 h-4" />
                    </Link>
                </Button>

                {/* เมนูที่มีรายการเดียวไม่คุ้มเป็นเมนู — ปุ่มถังขยะตรง ๆ อ่านออกทันทีว่าคืออะไร */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteOpen(true)}
                    aria-label="ลบฉากนี้"
                    title="ลบฉากนี้"
                    className="text-muted-foreground hover:text-destructive pointer-coarse:h-11 pointer-coarse:w-11"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบฉากนี้?</AlertDialogTitle>
                        <AlertDialogDescription>
                            “{currentEvent.title}” จะถูกลบ — กู้คืนได้จาก toast ทันทีหลังลบ
                            หรือจากเมนู “กู้คืนล่าสุด” ที่หน้ากระดานพล็อต (ปม/แคนวาสของฉากเดิมกู้คืนไม่ได้)
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleDelete() }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            ลบฉาก
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

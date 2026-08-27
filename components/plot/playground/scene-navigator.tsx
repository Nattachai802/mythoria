"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronsUpDown, Plus, Trash2, MoreHorizontal, ArrowLeft } from "lucide-react"
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
}

export function SceneNavigator({
    novelId,
    currentEvent,
    events,
    chapters
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

    return (
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="mr-2">
                <Link href={`/dashboard/project/${novelId}/plot`}>
                    <ArrowLeft className="w-4 h-4" />
                </Link>
            </Button>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-[min(250px,calc(100vw-2rem))] justify-between truncate"
                    >
                        <span className="truncate">
                            {currentEvent.title}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
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

            <CreateSceneDialog
                novelId={novelId}
                chapterId={currentEvent.relatedChapterId || ""}
                trigger={
                    <Button variant="default" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        ฉากใหม่
                    </Button>
                }
            />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreHorizontal className="w-4 h-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onSelect={(e) => { e.preventDefault(); setDeleteOpen(true) }}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        ลบฉาก
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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

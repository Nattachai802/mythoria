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
import { CreateSceneDialog } from "@/components/project/timeline/create-scene-dialog"
import { deleteTimelineEvent } from "@/server/timeline"
import { toast } from "sonner"
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

    const handleDelete = async () => {
        if (confirm("Are you sure you want to delete this scene?")) {
            const res = await deleteTimelineEvent(currentEvent.id)
            if (res.success) {
                toast.success("Scene deleted")
                router.push(`/dashboard/project/${novelId}/plot`)
            } else {
                toast.error("Failed to delete scene")
            }
        }
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
                        className="w-[250px] justify-between truncate"
                    >
                        <span className="truncate">
                            {currentEvent.title}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search scene..." />
                        <CommandList>
                            <CommandEmpty>No scene found.</CommandEmpty>
                            {eventsByChapter.chapterOrder.map(chapterId => {
                                const chapterEvents = eventsByChapter.grouped[chapterId]
                                if (chapterEvents.length === 0) return null
                                const chapter = chapters.find(c => c.id === chapterId)
                                return (
                                    <CommandGroup key={chapterId} heading={chapter?.title || "Unknown Chapter"}>
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
                                <CommandGroup heading="Unassigned">
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
                        New Scene
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
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Scene
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    )
}

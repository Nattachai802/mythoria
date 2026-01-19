"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TimelineEvent, Character, Location } from "@/db/schema"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    Clock,
    GripVertical,
    MapPin,
    Swords,
    MessageSquare,
    History,
    Lightbulb,
    Heart,
    ArrowRight,
    Film
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { updateTimelineEvent } from "@/server/timeline"
import { toast } from "sonner"

// Event type configuration
const EVENT_TYPES = {
    scene: {
        label: "Scene",
        icon: Film,
        color: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
        accent: "border-l-slate-500"
    },
    action: {
        label: "Action",
        icon: Swords,
        color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
        accent: "border-l-red-500"
    },
    dialogue: {
        label: "Dialogue",
        icon: MessageSquare,
        color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30",
        accent: "border-l-blue-500"
    },
    flashback: {
        label: "Flashback",
        icon: History,
        color: "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30",
        accent: "border-l-amber-500"
    },
    revelation: {
        label: "Revelation",
        icon: Lightbulb,
        color: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
        accent: "border-l-purple-500"
    },
    emotional: {
        label: "Emotional",
        icon: Heart,
        color: "bg-pink-500/20 text-pink-600 dark:text-pink-400 border-pink-500/30",
        accent: "border-l-pink-500"
    },
    transition: {
        label: "Transition",
        icon: ArrowRight,
        color: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        accent: "border-l-emerald-500"
    },
} as const

type EventType = keyof typeof EVENT_TYPES

interface EventCardProps {
    event: TimelineEvent
    characters?: Character[]
    locations?: Location[]
}

export function EventCard({ event, characters = [], locations = [] }: EventCardProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: event.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 1,
    }

    // Get event type config
    const eventType = (event.eventType as EventType) || "scene"
    const typeConfig = EVENT_TYPES[eventType] || EVENT_TYPES.scene
    const TypeIcon = typeConfig.icon

    // Get related characters (max 4 shown)
    const relatedCharacterIds = (event.relatedCharacterIds as string[]) || []
    const relatedCharacters = characters.filter(c => relatedCharacterIds.includes(c.id))
    const displayedCharacters = relatedCharacters.slice(0, 4)
    const remainingCount = relatedCharacters.length - 4

    // Get related location (first one)
    const relatedLocationIds = (event.relatedLocationIds as string[]) || []
    const relatedLocation = locations.find(l => relatedLocationIds.includes(l.id))

    // Handle completion toggle
    const handleToggleComplete = (checked: boolean) => {
        startTransition(async () => {
            const result = await updateTimelineEvent(event.id, { isCompleted: checked })
            if (!result.success) {
                toast.error("Failed to update event")
            }
        })
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="relative w-full flex justify-center group"
        >
            {/* Connector dot on timeline */}
            <div className={cn(
                "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 z-0",
                event.isCompleted
                    ? "bg-emerald-500 border-emerald-500"
                    : "bg-background border-muted-foreground/40",
                isDragging && "bg-primary border-primary"
            )} />

            {/* Event Card */}
            <Card className={cn(
                "relative ml-8 w-full overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-200",
                "bg-card hover:shadow-lg border-l-4",
                typeConfig.accent,
                event.isCompleted && "opacity-60",
                isDragging && "shadow-xl ring-2 ring-primary/20 rotate-1 scale-105"
            )}>
                {/* Horizontal connector line */}
                <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-muted-foreground/30 -translate-y-1/2" />

                {/* Drag Handle */}
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity cursor-grab z-10"
                    onPointerDown={(e) => {
                        e.stopPropagation()
                        listeners?.onPointerDown?.(e)
                    }}
                >
                    <GripVertical className="h-3 w-3 text-muted-foreground" />
                </div>

                {/* Card Content - Compact */}
                <div className="p-2">
                    {/* Header: Checkbox + Title */}
                    <div className="flex items-center gap-2 pr-5">
                        <Checkbox
                            checked={event.isCompleted || false}
                            onCheckedChange={handleToggleComplete}
                            disabled={isPending}
                            className="h-3.5 w-3.5"
                            onClick={(e) => e.stopPropagation()}
                        />

                        <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                                if (!isDragging) {
                                    router.push(`/dashboard/project/${event.novelId}/plot/${event.id}`)
                                }
                            }}
                        >
                            <h4 className={cn(
                                "font-medium text-xs leading-snug text-foreground/90 hover:text-primary transition-colors truncate",
                                event.isCompleted && "line-through text-muted-foreground"
                            )}>
                                {event.title}
                            </h4>
                        </div>
                    </div>

                    {/* Compact Metadata Row */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {/* Event Type Badge */}
                        <Badge variant="outline" className={cn("text-[9px] h-4 gap-0.5 font-medium border px-1", typeConfig.color)}>
                            <TypeIcon className="h-2.5 w-2.5" />
                            {typeConfig.label}
                        </Badge>

                        {/* Location - Compact */}
                        {relatedLocation && (
                            <Badge variant="outline" className="text-[9px] h-4 gap-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-1">
                                <MapPin className="h-2.5 w-2.5" />
                                <span className="truncate max-w-[60px]">{relatedLocation.name}</span>
                            </Badge>
                        )}

                        {/* Characters Count - Compact */}
                        {displayedCharacters.length > 0 && (
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex -space-x-1">
                                            {displayedCharacters.slice(0, 3).map((char) => (
                                                <Avatar key={char.id} className="h-4 w-4 border border-background">
                                                    {char.image ? (
                                                        <AvatarImage src={char.image} alt={char.name} />
                                                    ) : null}
                                                    <AvatarFallback className="text-[8px] bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                                                        {char.name.slice(0, 1).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                            {relatedCharacters.length > 3 && (
                                                <div className="h-4 w-4 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] text-muted-foreground">
                                                    +{relatedCharacters.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="text-xs">
                                        {relatedCharacters.map(c => c.name).join(", ")}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    )
}
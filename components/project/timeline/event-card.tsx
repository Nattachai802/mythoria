"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TimelineEvent, Character, Location } from "@/db/schema"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
    GripVertical,
    MapPin,
    Swords,
    MessageSquare,
    History,
    Lightbulb,
    Heart,
    ArrowRight,
    Film,
    CheckCircle2,
    Circle,
    TrendingUp,
    TrendingDown
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useState } from "react"

// Event type configuration - minimal colors
const EVENT_TYPES = {
    scene: {
        label: "Scene",
        icon: Film,
        color: "text-slate-400",
    },
    action: {
        label: "Action",
        icon: Swords,
        color: "text-red-400",
    },
    dialogue: {
        label: "Dialogue",
        icon: MessageSquare,
        color: "text-blue-400",
    },
    flashback: {
        label: "Flashback",
        icon: History,
        color: "text-amber-400",
    },
    revelation: {
        label: "Revelation",
        icon: Lightbulb,
        color: "text-purple-400",
    },
    emotional: {
        label: "Emotional",
        icon: Heart,
        color: "text-pink-400",
    },
    transition: {
        label: "Transition",
        icon: ArrowRight,
        color: "text-emerald-400",
    },
} as const

type EventType = keyof typeof EVENT_TYPES

type ThreadDot = { color: string; title: string }

interface EventCardProps {
    event: TimelineEvent
    characters?: Character[]
    locations?: Location[]
    isDimmed?: boolean
    threadDots?: ThreadDot[]
    onToggleComplete?: (id: string) => void
}

export function EventCard({ event, characters = [], locations = [], isDimmed = false, threadDots, onToggleComplete }: EventCardProps) {
    const router = useRouter()
    const [isHovered, setIsHovered] = useState(false)

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

    // Get related characters (max 3 shown for minimal look)
    const relatedCharacterIds = (event.relatedCharacterIds as string[]) || []
    const relatedCharacters = characters.filter(c => relatedCharacterIds.includes(c.id))
    const displayedCharacters = relatedCharacters.slice(0, 3)
    const remainingCount = relatedCharacters.length - 3

    // Get related location (first one)
    const relatedLocationIds = (event.relatedLocationIds as string[]) || []
    const relatedLocation = locations.find(l => relatedLocationIds.includes(l.id))

    // Handle completion toggle — state lives in TimelineBoard (optimistic)
    const handleToggleComplete = (e: React.MouseEvent) => {
        e.stopPropagation()
        onToggleComplete?.(event.id)
    }

    const handleClick = () => {
        if (!isDragging) {
            router.push(`/dashboard/project/${event.novelId}/plot/${event.id}`)
        }
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative w-full py-2 transition-all duration-300",
                // Fade-in animation on mount
                "animate-in fade-in slide-in-from-bottom-4 duration-500",
                // Lens: de-emphasize cards that don't match the active filter
                isDimmed && "opacity-25 grayscale hover:opacity-60",
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Film Frame Card */}
            <div
                className={cn(
                    "relative overflow-hidden cursor-pointer chamfered-sm",
                    "transition-all duration-300 ease-out",
                    "bg-[#f5f5f0] dark:bg-card border border-zinc-200/60 dark:border-border",
                    // Hover state
                    isHovered && !isDragging && [
                        "bg-[#eeede8] dark:bg-accent",
                        "shadow-md shadow-primary/10",
                        "scale-[1.01]",
                    ],
                    // Drag state
                    isDragging && "shadow-2xl ring-2 ring-primary/30 scale-105"
                )}
                onClick={handleClick}
            >
                {/* Status Indicator Strip (Left Edge) */}
                <div
                    className={cn(
                        "absolute left-0 top-0 bottom-0 transition-all duration-300",
                        isHovered ? "w-1" : "w-0.5",
                        event.isCompleted
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                            : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                    )}
                />

                {/* Content */}
                <div className="pl-3 pr-2 py-3">
                    {/* Title Row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <h4
                            className={cn(
                                "font-display font-semibold text-sm leading-snug tracking-tight",
                                "text-zinc-800 dark:text-foreground transition-all duration-200",
                                isHovered && !event.isCompleted && "text-primary",
                                event.isCompleted && "text-zinc-400 dark:text-muted-foreground line-through"
                            )}
                        >
                            {event.title}
                        </h4>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                            {/* Status Toggle — always visible so it's easy to find */}
                            <button
                                onClick={handleToggleComplete}
                                className={cn(
                                    "p-1 rounded hover:bg-zinc-200/60 dark:hover:bg-muted transition-colors",
                                    event.isCompleted
                                        ? "text-emerald-500"
                                        : "text-amber-500/70 hover:text-amber-500"
                                )}
                                title={event.isCompleted ? "ทำเครื่องหมายเป็นฉบับร่าง" : "ทำเครื่องหมายว่าเสร็จ"}
                            >
                                {event.isCompleted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <Circle className="w-4 h-4" />
                                )}
                            </button>

                            {/* Drag Handle (fade in on hover) */}
                            <div
                                {...attributes}
                                {...listeners}
                                className={cn(
                                    "p-1 rounded hover:bg-zinc-200/60 dark:hover:bg-muted cursor-grab active:cursor-grabbing text-zinc-500 dark:text-muted-foreground transition-opacity duration-200",
                                    isHovered ? "opacity-100" : "opacity-0"
                                )}
                                onPointerDown={(e) => {
                                    e.stopPropagation()
                                    listeners?.onPointerDown?.(e)
                                }}
                            >
                                <GripVertical className="w-3.5 h-3.5" />
                            </div>
                        </div>
                    </div>

                    {/* Thread dots — colored edge marks แบบฟิล์มตัดต่อ */}
                    {threadDots && threadDots.length > 0 && (
                        <div className="flex items-center gap-1 mb-1.5">
                            {threadDots.slice(0, 5).map((dot, i) => (
                                <TooltipProvider key={i} delayDuration={100}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span
                                                className="h-2 w-2 chamfered-sm shrink-0 cursor-default transition-transform hover:scale-110"
                                                style={{
                                                    background: dot.color,
                                                    boxShadow: `0 0 5px ${dot.color}66`,
                                                }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            <span className="font-technical text-[9px] uppercase tracking-wide">{dot.title}</span>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                    )}

                    {/* Metadata Footer */}
                    <div className="flex items-center justify-between text-xs">
                        {/* Left: Type & Location */}
                        <div className="flex items-center gap-2 text-zinc-600 dark:text-muted-foreground">
                            {/* Event Type */}
                            <div className={cn("flex items-center gap-1 transition-colors", typeConfig.color)}>
                                <TypeIcon className="w-3 h-3" />
                                <span className="text-[9px] uppercase tracking-wide font-medium">
                                    {typeConfig.label}
                                </span>
                            </div>

                            {/* Location */}
                            {relatedLocation && (
                                <>
                                    <span className="text-zinc-400">·</span>
                                    <div className="flex items-center gap-1 max-w-[80px]">
                                        <MapPin className="w-3 h-3 shrink-0" />
                                        <span className="truncate text-[9px]">
                                            {relatedLocation.name}
                                        </span>
                                    </div>
                                </>
                            )}

                            {/* Value-shift badge (D1) */}
                            {typeof event.valueShift === "number" && event.valueShift !== 0 && (
                                <>
                                    <span className="text-zinc-400">·</span>
                                    <div className={cn(
                                        "flex items-center gap-0.5",
                                        event.valueShift > 0 ? "text-emerald-500" : "text-red-500"
                                    )}>
                                        {event.valueShift > 0
                                            ? <TrendingUp className="w-3 h-3" />
                                            : <TrendingDown className="w-3 h-3" />}
                                        <span className="text-[9px] tabular-nums font-medium">
                                            {event.valueShift > 0 ? `+${event.valueShift}` : event.valueShift}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Character Avatars */}
                        {displayedCharacters.length > 0 && (
                            <div className="flex -space-x-1.5">
                                {displayedCharacters.map((char) => (
                                    <TooltipProvider key={char.id} delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Avatar className={cn(
                                                    "h-5 w-5 border-2 border-[#f5f5f0] ring-1 ring-zinc-300/40",
                                                    "transition-transform duration-200",
                                                    isHovered && "scale-110"
                                                )}>
                                                    {char.image ? (
                                                        <AvatarImage src={char.image} alt={char.name} />
                                                    ) : null}
                                                    <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                                                        {char.name.slice(0, 1).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs">
                                                {char.name}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ))}
                                {remainingCount > 0 && (
                                    <div className={cn(
                                        "h-5 w-5 rounded-full bg-zinc-300 border-2 border-[#f5f5f0]",
                                        "flex items-center justify-center text-[8px] text-zinc-600 font-semibold",
                                        "transition-transform duration-200",
                                        isHovered && "scale-110"
                                    )}>
                                        +{remainingCount}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
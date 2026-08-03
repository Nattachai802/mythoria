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
    TrendingDown,
    Shield,
    Eye
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useState } from "react"

// ชนิดฉาก — ไอคอนคือตัวแยก ไม่ใช่สี (สีสงวนไว้ให้สิ่งที่ต้องการสายตาจริง ๆ)
const EVENT_TYPES = {
    scene: { label: "Scene", icon: Film },
    action: { label: "Action", icon: Swords },
    dialogue: { label: "Dialogue", icon: MessageSquare },
    flashback: { label: "Flashback", icon: History },
    revelation: { label: "Revelation", icon: Lightbulb },
    emotional: { label: "Emotional", icon: Heart },
    transition: { label: "Transition", icon: ArrowRight },
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
    isFirstScene?: boolean // ฉากแรกของเรื่อง — ไม่ต้องเตือน "แล้วก็"
}

export function EventCard({ event, characters = [], locations = [], isDimmed = false, threadDots, onToggleComplete, isFirstScene = false }: EventCardProps) {
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

    // Get related location (first one)
    const relatedLocationIds = (event.relatedLocationIds as string[]) || []
    const relatedLocation = locations.find(l => relatedLocationIds.includes(l.id))

    // POV character (P1)
    const povCharacter = event.povCharacterId ? characters.find(c => c.id === event.povCharacterId) : null

    // Handle scene participants from canvas children and their elementDetails (per Idea level)
    const elementDetails = (event as any).elementDetails || []
    const canvasItems = (event.canvasData as any[]) || []

    const uniqueCharsMap = new Map<string, any>()
    const uniqueFactionsMap = new Map<string, any>()

    canvasItems.forEach((item: any) => {
        if (item.children && Array.isArray(item.children)) {
            item.children.forEach((child: any) => {
                const detail = elementDetails.find((d: any) =>
                    d.canvasItemId === item.id &&
                    d.elementId === (child.referenceId || child.id) &&
                    d.elementType === child.type
                );

                if (child.type === 'character' || child.type === 'dummy_character') {
                    // ตัวละครจริง: ยึด "ตัวตนจริง" เป็น key — referenceId ก่อน, ถ้าหายค่อย match ด้วยชื่อ
                    // ป้องกันพระเอกในหลายการ์ดถูกนับเป็นคนละตัวเมื่อ child.referenceId หลุด (ตกไปใช้ child.id ที่ไม่ซ้ำ)
                    const realChar = child.type === 'character'
                        ? (characters.find(c => c.id === child.referenceId) || characters.find(c => c.name === child.title))
                        : null;
                    // dummy ไม่มี referenceId → ยุบด้วยชื่อ (dummy ชื่อเดียวกันในหลายการ์ด = ตัวเดียวในสรุปฉาก)
                    const identity = realChar ? realChar.id : (child.referenceId || child.title || child.id);
                    const key = `character-${identity}`;
                    const existing = uniqueCharsMap.get(key);
                    const actionText = detail?.action ? `${detail.action}` : '';

                    if (existing) {
                        if (actionText && !existing.actions.includes(actionText)) {
                            existing.actions.push(actionText);
                        }
                    } else {
                        uniqueCharsMap.set(key, {
                            id: child.id,
                            name: child.title || realChar?.name || "ตัวละครชั่วคราว",
                            image: realChar?.image || null,
                            isDummy: child.type === 'dummy_character',
                            actions: actionText ? [actionText] : [],
                        });
                    }
                } else if (child.type === 'faction' || child.type === 'dummy_faction') {
                    // กลุ่มฝ่ายจริง: ยึด referenceId ก่อน ถ้าหายค่อยชื่อ (กันนับซ้ำเหมือนตัวละคร)
                    const identity = child.referenceId || child.title || child.id;
                    const key = `faction-${identity}`;
                    const existing = uniqueFactionsMap.get(key);
                    const actionText = detail?.action ? `${detail.action}` : '';

                    if (existing) {
                        if (actionText && !existing.actions.includes(actionText)) {
                            existing.actions.push(actionText);
                        }
                    } else {
                        uniqueFactionsMap.set(key, {
                            id: child.id,
                            name: child.title,
                            isDummy: child.type === 'dummy_faction',
                            actions: actionText ? [actionText] : [],
                        });
                    }
                }
            });
        }
    });

    const charactersList = Array.from(uniqueCharsMap.values()).map(c => ({
        ...c,
        action: c.actions.join(' | ') || null
    }));
    const factionsList = Array.from(uniqueFactionsMap.values()).map(f => ({
        ...f,
        action: f.actions.join(' | ') || null
    }));

    let displayedAvatars: any[] = []
    let remainingAvatarsCount = 0
    const factionParts: any[] = factionsList

    if (charactersList.length > 0) {
        displayedAvatars = charactersList.slice(0, 3)
        remainingAvatarsCount = charactersList.length - 3
    } else {
        // Fallback to relatedCharacterIds
        const relatedCharacterIds = (event.relatedCharacterIds as string[]) || []
        const relatedCharacters = characters.filter(c => relatedCharacterIds.includes(c.id))
        displayedAvatars = relatedCharacters.slice(0, 3).map((c: any) => ({
            id: c.id,
            name: c.name,
            image: c.image,
            isDummy: false,
            action: null,
        }))
        remainingAvatarsCount = relatedCharacters.length - 3
    }

    // คำเชื่อมเหตุ-ผลกับฉากก่อนหน้า — "แล้วก็" คือจุดอ่อนของพล็อต จึงเป็นอันเดียวในแถวนี้ที่ได้สี
    const causal: { label: string; hint: string; weak: boolean } | null =
        event.causeKind === "therefore"
            ? { label: "ดังนั้น", hint: event.causeNote || "ผลต่อเนื่องจากเรื่องก่อนหน้า", weak: false }
            : event.causeKind === "but"
                ? { label: "แต่ว่า", hint: event.causeNote || "หักเหจากเรื่องก่อนหน้า", weak: false }
                : !isFirstScene
                    ? { label: "แล้วก็…", hint: 'ยังไม่ระบุเหตุ-ผลกับเรื่องก่อนหน้า — พล็อตแบบ "แล้วก็" ตั้งได้ในโครงฉากดราม่า', weak: true }
                    : null

    const hasThreads = !!threadDots && threadDots.length > 0

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
                "relative w-full py-1.5",
                // Lens: de-emphasize cards that don't match the active filter
                isDimmed && "opacity-30 transition-opacity duration-200 hover:opacity-70 motion-reduce:transition-none",
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div
                className={cn(
                    "relative cursor-pointer chamfered-sm border bg-card",
                    "transition-colors duration-150 ease-out motion-reduce:transition-none",
                    isHovered && !isDragging ? "border-[var(--forge-amber)]/50 bg-accent/40" : "border-border",
                    // เสร็จแล้ว = ถอยไปเป็นพื้นหลัง ไม่ต้องมีแถบสีเรืองแสงมาป่าวประกาศ
                    event.isCompleted && !isHovered && "border-border/60 bg-muted/40",
                    isDragging && "ring-1 ring-[var(--forge-amber)]/50",
                )}
                onClick={handleClick}
            >
                <div className="px-3 py-2.5">
                    {/* Title */}
                    <div className="flex items-start justify-between gap-2">
                        <h4
                            className={cn(
                                "text-sm font-medium leading-snug text-foreground",
                                event.isCompleted && "text-muted-foreground line-through decoration-1",
                            )}
                        >
                            {event.title}
                        </h4>

                        <div className="flex shrink-0 items-center gap-0.5">
                            <button
                                onClick={handleToggleComplete}
                                className={cn(
                                    "rounded p-1 transition-colors hover:bg-muted motion-reduce:transition-none",
                                    event.isCompleted
                                        ? "text-emerald-600 dark:text-emerald-500"
                                        : "text-muted-foreground/60 hover:text-foreground",
                                )}
                                title={event.isCompleted ? "ทำเครื่องหมายเป็นฉบับร่าง" : "ทำเครื่องหมายว่าเสร็จ"}
                            >
                                {event.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                            </button>

                            <div
                                {...attributes}
                                {...listeners}
                                className={cn(
                                    "cursor-grab rounded p-1 text-muted-foreground/60 transition-opacity duration-150 hover:bg-muted active:cursor-grabbing motion-reduce:transition-none",
                                    isHovered ? "opacity-100" : "opacity-0",
                                )}
                                onPointerDown={(e) => {
                                    e.stopPropagation()
                                    listeners?.onPointerDown?.(e)
                                }}
                            >
                                <GripVertical className="h-3.5 w-3.5" />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    {event.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {event.description}
                        </p>
                    )}

                    {/* ข้อมูลฉาก — บรรทัดเดียว สีกลางทั้งแถว */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                            <TypeIcon className="h-3 w-3 shrink-0" />
                            <span className="shrink-0 font-technical text-[10px] uppercase tracking-wide">
                                {typeConfig.label}
                            </span>

                            {relatedLocation && (
                                <>
                                    <MetaDot />
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{relatedLocation.name}</span>
                                </>
                            )}

                            {povCharacter && (
                                <>
                                    <MetaDot />
                                    <Eye className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{povCharacter.name}</span>
                                </>
                            )}

                            {factionParts.length > 0 && (
                                <>
                                    <MetaDot />
                                    <Shield className="h-3 w-3 shrink-0" />
                                    <span className="shrink-0 tabular-nums">{factionParts.length}</span>
                                </>
                            )}

                            {/* ค่าที่ขึ้น/ลง — ข้อมูลสองขั้วจริง สีจึงมีความหมาย ไม่ใช่ของตกแต่ง */}
                            {typeof event.valueShift === "number" && event.valueShift !== 0 && (
                                <>
                                    <MetaDot />
                                    <span
                                        className={cn(
                                            "flex shrink-0 items-center gap-0.5 tabular-nums",
                                            event.valueShift > 0
                                                ? "text-emerald-700 dark:text-emerald-500"
                                                : "text-red-700 dark:text-red-400",
                                        )}
                                        title={`ค่าเปลี่ยนแปลง${event.valueShift > 0 ? "ขึ้น" : "ลง"} ${Math.abs(event.valueShift)}`}
                                    >
                                        {event.valueShift > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                        {event.valueShift > 0 ? `+${event.valueShift}` : event.valueShift}
                                    </span>
                                </>
                            )}
                        </div>

                        {displayedAvatars.length > 0 && (
                            <div className="flex shrink-0 -space-x-1.5">
                                {displayedAvatars.map((char, i) => (
                                    <TooltipProvider key={char.id || i} delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Avatar className={cn("h-5 w-5 border-2 border-card", char.isDummy && "border-dashed")}>
                                                    {char.image ? <AvatarImage src={char.image} alt={char.name} /> : null}
                                                    <AvatarFallback className={cn("text-[8px]", char.isDummy ? "bg-muted text-muted-foreground" : "bg-primary/20 text-primary")}>
                                                        {char.name.slice(0, 1).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="max-w-xs space-y-1 p-2 text-xs">
                                                <p className="font-semibold">{char.name} {char.isDummy && "(ชั่วคราว)"}</p>
                                                {char.action && (
                                                    <p className="text-[11px] leading-normal text-muted-foreground">
                                                        <span className="font-medium text-foreground">ทำอะไร:</span> {char.action}
                                                    </p>
                                                )}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ))}
                                {remainingAvatarsCount > 0 && (
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-muted text-[9px] font-medium text-muted-foreground">
                                        +{remainingAvatarsCount}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* โครงเรื่อง: คำเชื่อมเหตุ-ผล + ปมที่ฉากนี้แตะ — คนละเรื่องกับข้อมูลฉาก จึงแยกบรรทัด */}
                    {(hasThreads || causal) && (
                        <div className="mt-2 flex items-center gap-2 border-t border-border/60 pt-2">
                            {causal && (
                                <span
                                    className={cn(
                                        "shrink-0 text-[11px]",
                                        causal.weak
                                            ? "text-[var(--forge-amber)] underline decoration-dashed underline-offset-2"
                                            : "text-muted-foreground",
                                    )}
                                    title={causal.hint}
                                >
                                    {causal.label}
                                </span>
                            )}

                            {hasThreads && (
                                <div className="flex items-center gap-1">
                                    {threadDots!.slice(0, 4).map((dot, i) => (
                                        <TooltipProvider key={i} delayDuration={100}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span
                                                        role="img"
                                                        aria-label={`ปม: ${dot.title}`}
                                                        className="h-1.5 w-4 shrink-0 rounded-full"
                                                        style={{ background: dot.color }}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <span className="text-xs">{dot.title}</span>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                    {threadDots!.length > 4 && (
                                        <span className="text-[11px] tabular-nums text-muted-foreground" aria-label={`และอีก ${threadDots!.length - 4} ปม`}>
                                            +{threadDots!.length - 4}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

/** ตัวคั่นข้อมูล — จางกว่าข้อความที่มันคั่นเสมอ */
function MetaDot() {
    return <span aria-hidden className="shrink-0 text-border">·</span>
}

"use client"

import { useState, useEffect } from "react"
import { Map as MapIcon, ChevronDown, ChevronUp, Clock, AlertCircle, Calendar, Lightbulb } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { getTimeLineEvents } from "@/server/timeline"
import { getIdeasByNovelId } from "@/server/idea"
import { getSceneElementDetails } from "@/server/scene-element-details"
import { TimelineEvent, Idea, SceneElementDetails } from "@/db/schema"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { User, MapPin } from "lucide-react"

interface NotePlotPanelProps {
    noteId: string
    novelId: string
    linkedChapterId?: string | null
}

// ─── Timeline Event helpers ────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
    scene: "ฉาก",
    action: "แอ็คชัน",
    dialogue: "บทสนทนา",
    flashback: "แฟลชแบ็ก",
    revelation: "เปิดเผย",
    emotional: "อารมณ์",
    transition: "เชื่อมต่อ",
}

const EVENT_TYPE_COLORS: Record<string, string> = {
    scene: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    action: "bg-red-500/10 text-red-600 border-red-500/20",
    dialogue: "bg-green-500/10 text-green-600 border-green-500/20",
    flashback: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    revelation: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    emotional: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    transition: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

// ─── Component ─────────────────────────────────────────────────────────────

export function NotePlotPanel({ noteId, novelId, linkedChapterId }: NotePlotPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true)
    const [loading, setLoading] = useState(true)

    // events for this chapter
    const [events, setEvents] = useState<TimelineEvent[]>([])
    // ideaId → Idea lookup map (all ideas in novel)
    const [ideaMap, setIdeaMap] = useState<Map<string, Idea>>(new Map())
    // eventId → idea IDs linked via sceneElementDetails
    const [eventIdeaMap, setEventIdeaMap] = useState<Map<string, string[]>>(new Map())
    // eventId → full SceneElementDetails array for ALL elements
    const [eventAllDetailsMap, setEventAllDetailsMap] = useState<Map<string, SceneElementDetails[]>>(new Map())

    const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
    const [selectedIdeaSummary, setSelectedIdeaSummary] = useState<{ idea: Idea, event: TimelineEvent } | null>(null)

    useEffect(() => {
        async function loadAll() {
            setLoading(true)
            try {
                if (!linkedChapterId) return

                // 1. Load timeline events for this chapter
                const eventsResult = await getTimeLineEvents(novelId)
                let chapterEvents: TimelineEvent[] = []
                if (eventsResult.success && eventsResult.events) {
                    chapterEvents = eventsResult.events
                        .filter(e => e.relatedChapterId === linkedChapterId)
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                    setEvents(chapterEvents)
                }

                // 2. Load all ideas in novel → build lookup map
                const ideasResult = await getIdeasByNovelId(novelId)
                const newIdeaMap = new Map<string, Idea>()
                if (ideasResult.success && ideasResult.data) {
                    for (const idea of ideasResult.data) {
                        newIdeaMap.set(idea.id, idea)
                    }
                    setIdeaMap(newIdeaMap)
                }

                // 3. For each event, load sceneElementDetails → find idea_note elements
                if (chapterEvents.length > 0) {
                    const detailsResults = await Promise.all(
                        chapterEvents.map(e => getSceneElementDetails(e.id))
                    )
                    const newEventIdeaMap = new Map<string, string[]>()
                    const newEventAllDetailsMap = new Map<string, SceneElementDetails[]>()
                    
                    chapterEvents.forEach((event, i) => {
                        const result = detailsResults[i]
                        if (result.success && result.data) {
                            newEventAllDetailsMap.set(event.id, result.data)
                            const ideaDetails = result.data.filter(d => d.elementType === "idea_note")
                            if (ideaDetails.length > 0) {
                                const ideaIds = ideaDetails
                                    .map(d => d.elementId)
                                    // deduplicate
                                    .filter((id, idx, arr) => arr.indexOf(id) === idx)
                                newEventIdeaMap.set(event.id, ideaIds)
                            }
                        }
                    })
                    setEventIdeaMap(newEventIdeaMap)
                    setEventAllDetailsMap(newEventAllDetailsMap)
                }
            } catch (error) {
                console.error("Failed to load plot panel:", error)
            } finally {
                setLoading(false)
            }
        }

        loadAll()
    }, [novelId, linkedChapterId])

    if (loading) {
        return (
            <div className="border rounded-lg p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                </div>
            </div>
        )
    }

    return (
        <div className="border rounded-lg bg-card">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-t-lg"
            >
                <div className="flex items-center gap-2">
                    <MapIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Chapter Plot</span>
                    <Badge variant="secondary" className="text-xs">{events.length}</Badge>
                </div>
                {isExpanded
                    ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {isExpanded && (
                <div className="p-3 pt-0 border-t space-y-3 bg-muted/10">
                    {!linkedChapterId ? (
                        <p className="text-xs flex items-center text-amber-500 mt-3 pt-2">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Link this note to a chapter to view its plot.
                        </p>
                    ) : events.length === 0 ? (
                        <p className="text-xs text-muted-foreground mt-3 pt-2">
                            No plot events for this chapter yet.
                        </p>
                    ) : (
                        <div className="space-y-3 mt-3">
                            {events.map((event, index) => {
                                const isEventExpanded = expandedEventId === event.id
                                const typeKey = event.eventType ?? "scene"
                                const typeLabel = EVENT_TYPE_LABELS[typeKey] ?? typeKey
                                const typeColor = EVENT_TYPE_COLORS[typeKey] ?? EVENT_TYPE_COLORS.scene
                                // Ideas linked to this event
                                const linkedIdeaIds = eventIdeaMap.get(event.id) ?? []
                                const linkedIdeas = linkedIdeaIds
                                    .map(id => ideaMap.get(id))
                                    .filter((idea): idea is Idea => idea !== undefined)

                                return (
                                    <div key={event.id} className="relative pl-4">
                                        {/* Timeline line */}
                                        {index !== events.length - 1 && (
                                            <div className="absolute left-[7px] top-6 bottom-[-16px] w-[2px] bg-border" />
                                        )}
                                        {/* Timeline dot */}
                                        <div className={cn(
                                            "absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 bg-background flex items-center justify-center",
                                            event.isCompleted ? "border-green-500" : "border-primary"
                                        )}>
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full",
                                                event.isCompleted ? "bg-green-500" : "bg-primary"
                                            )} />
                                        </div>

                                        {/* Event Card */}
                                        <button
                                            onClick={() => setExpandedEventId(isEventExpanded ? null : event.id)}
                                            className="w-full text-left bg-background border rounded-md p-2 text-sm shadow-sm hover:bg-muted/30 transition-colors"
                                        >
                                            {/* Header row */}
                                            <div className="flex items-start justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 text-xs font-medium text-primary min-w-0">
                                                    <Clock className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{event.title}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    {linkedIdeas.length > 0 && (
                                                        <span className="flex items-center gap-0.5 text-[10px] text-amber-500">
                                                            <Lightbulb className="w-2.5 h-2.5" />
                                                            {linkedIdeas.length}
                                                        </span>
                                                    )}
                                                    <ChevronDown className={cn(
                                                        "w-3 h-3 text-muted-foreground transition-transform",
                                                        isEventExpanded && "rotate-180"
                                                    )} />
                                                </div>
                                            </div>

                                            {/* Badges */}
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                <span className={cn(
                                                    "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none",
                                                    typeColor
                                                )}>
                                                    {typeLabel}
                                                </span>
                                                {event.isCompleted && (
                                                    <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none bg-green-500/10 text-green-600 border-green-500/20">
                                                        เสร็จแล้ว
                                                    </span>
                                                )}
                                                {event.eventDate && (
                                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                                        <Calendar className="w-2.5 h-2.5" />
                                                        {event.eventDate}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Expanded section */}
                                            {isEventExpanded && (
                                                <div className="mt-2 pt-2 border-t border-border/60 space-y-2">
                                                    {/* Description */}
                                                    {event.description ? (
                                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                                            {event.description}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-muted-foreground/50 italic">
                                                            ไม่มีรายละเอียดเพิ่มเติม
                                                        </p>
                                                    )}

                                                    {/* Linked Ideas */}
                                                    {linkedIdeas.length > 0 && (
                                                        <div className="space-y-1 pt-1 border-t border-border/40">
                                                            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                                                <Lightbulb className="w-2.5 h-2.5" />
                                                                ไอเดียที่เชื่อมโยง
                                                            </p>
                                                            {linkedIdeas.map(idea => {
                                                                const detail = eventAllDetailsMap.get(event.id)?.find(d => d.elementType === "idea_note" && d.elementId === idea.id)
                                                                return (
                                                                    <div
                                                                        key={idea.id}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            setSelectedIdeaSummary({ idea, event })
                                                                        }}
                                                                        className="rounded p-1.5 text-xs bg-muted/40 border-l-2 cursor-pointer hover:bg-muted/80 transition-colors"
                                                                        style={{ borderLeftColor: idea.color ?? "#3b82f6" }}
                                                                    >
                                                                        <p className="font-medium text-foreground leading-tight">
                                                                            {idea.title}
                                                                        </p>
                                                                        {idea.summary && (
                                                                            <p className="text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                                                                                {idea.summary}
                                                                            </p>
                                                                        )}
                                                                        {(detail?.action || detail?.outcome) && (
                                                                            <div className="mt-1 pt-1 border-t border-border/40 text-[10px] text-muted-foreground flex items-center gap-2">
                                                                                {detail.action && <span><span className="font-medium">Role:</span> {detail.action}</span>}
                                                                                {detail.outcome && <span><span className="font-medium">Status:</span> {detail.outcome}</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
            
            {/* Read-Only Idea Summary Dialog */}
            <Dialog open={!!selectedIdeaSummary} onOpenChange={(open) => !open && setSelectedIdeaSummary(null)}>
                {selectedIdeaSummary && (
                    <DialogContent className="max-w-md bg-white">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-yellow-500" />
                                <span>{selectedIdeaSummary.idea.title}</span>
                            </DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                            {/* Idea Summary */}
                            <div className="bg-yellow-50/50 p-3 rounded-md text-sm text-muted-foreground leading-relaxed">
                                {selectedIdeaSummary.idea.summary || selectedIdeaSummary.idea.content || "ไม่มีรายละเอียด"}
                            </div>

                            {/* Canvas Children Data */}
                            {(() => {
                                const canvasData = (selectedIdeaSummary.event.canvasData as any[]) || [];
                                const canvasIdea = canvasData.find(item => item.type === "idea" && (item.referenceId === selectedIdeaSummary.idea.id || item.id === selectedIdeaSummary.idea.id));
                                const children = canvasIdea?.children || [];
                                const characters = children.filter((c: any) => c.type === "character");
                                const others = children.filter((c: any) => c.type !== "character" && c.type !== "sticky-note");
                                const allDetails = eventAllDetailsMap.get(selectedIdeaSummary.event.id) || [];

                                return (
                                    <div className="space-y-4">
                                        {characters.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                                                    <User className="w-3 h-3" /> CHARACTERS
                                                </p>
                                                <div className="space-y-1">
                                                    {characters.map((child: any) => {
                                                        // find detail for this child
                                                        const detail = allDetails.find(d => d.canvasItemId === canvasIdea.id && d.elementId === (child.referenceId || child.id));
                                                        return (
                                                            <div key={child.id} className="p-2 rounded border bg-slate-50 text-xs shadow-sm">
                                                                <div className="flex items-center gap-2 font-medium">
                                                                    <User className="w-3 h-3 text-slate-400" />
                                                                    {child.title}
                                                                </div>
                                                                {detail?.action && (
                                                                    <div className="mt-1 pl-5 text-muted-foreground/80 flex items-start gap-1">
                                                                        <span className="text-red-500">📌</span>
                                                                        <span>{detail.action}{detail.how ? ` • ${detail.how}` : ""}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {others.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                                                    <Lightbulb className="w-3 h-3 text-yellow-500" /> OTHERS
                                                </p>
                                                <div className="space-y-1">
                                                    {others.map((child: any) => {
                                                        const detail = allDetails.find(d => d.canvasItemId === canvasIdea.id && d.elementId === (child.referenceId || child.id));
                                                        return (
                                                            <div key={child.id} className="p-2 rounded border bg-amber-50 border-amber-100 text-xs shadow-sm">
                                                                <div className="flex items-center gap-2 font-medium">
                                                                    <Lightbulb className="w-3 h-3 text-amber-500" />
                                                                    {child.title}
                                                                </div>
                                                                {detail?.action && (
                                                                    <div className="mt-1 pl-5 text-muted-foreground/80 flex items-start gap-1">
                                                                        <span className="text-red-500">📌</span>
                                                                        <span>{detail.action}{detail.how ? ` • ${detail.how}` : ""}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    )
}

"use client";

import { useEffect, useState } from "react";
import { MapPin, Loader2, ChevronRight, Heart, FileText, Clock, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
    getCharacterJourney,
    CharacterJourneyPoint
} from "@/server/character-state-queries";
import { detectCharacterConflicts, TimelineConflict } from "@/server/timeline-conflicts";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface CharacterJourneyProps {
    characterId: string;
    novelId: string;
}

const STATUS_COLORS: Record<string, string> = {
    alive: "bg-emerald-500",
    injured: "bg-amber-500",
    severely_injured: "bg-orange-500",
    unconscious: "bg-purple-500",
    dead: "bg-red-500",
    escaped: "bg-blue-500",
};

const METHOD_ICONS: Record<string, string> = {
    walk: "🚶",
    horse: "🐴",
    carriage: "🛒",
    boat: "⛵",
    teleport: "✨",
    custom: "⚙️",
};

interface TravelSegment {
    fromNoteId: string;
    toNoteId: string;
    travelTime: number | null;
    travelTimeUnit: string | null;
    travelMethod: string | null;
}

export function CharacterJourney({ characterId, novelId }: CharacterJourneyProps) {
    const [journey, setJourney] = useState<CharacterJourneyPoint[]>([]);
    const [travelSegments, setTravelSegments] = useState<Map<string, TravelSegment>>(new Map());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true);

            // Fetch journey
            const journeyResult = await getCharacterJourney(characterId);
            if (journeyResult.success) {
                setJourney(journeyResult.journey);
            }

            // Fetch conflicts to get travel times
            const conflictsResult = await detectCharacterConflicts(characterId, novelId);
            if (conflictsResult.success) {
                const segments = new Map<string, TravelSegment>();
                for (const conflict of conflictsResult.conflicts) {
                    const key = `${conflict.fromLocation.noteId}-${conflict.toLocation.noteId}`;
                    segments.set(key, {
                        fromNoteId: conflict.fromLocation.noteId,
                        toNoteId: conflict.toLocation.noteId,
                        travelTime: conflict.requiredTime,
                        travelTimeUnit: conflict.requiredTimeUnit,
                        travelMethod: conflict.travelMethod,
                    });
                }
                setTravelSegments(segments);
            }

            setIsLoading(false);
        }
        fetchData();
    }, [characterId, novelId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (journey.length === 0) {
        return (
            <div className="text-center py-6 text-muted-foreground">
                <MapPin className="h-6 w-6 mx-auto mb-2 opacity-40" />
                <p className="text-sm">ยังไม่มีข้อมูลการเดินทาง</p>
                <p className="text-xs mt-1">AI จะวิเคราะห์เมื่อมีการเขียน Note</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>เส้นทางการเดินทาง ({journey.length} จุด)</span>
            </div>

            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-border" />

                <div className="space-y-0">
                    {journey.map((point, index) => {
                        // Check if there's travel info to the next point
                        const nextPoint = journey[index + 1];
                        const segmentKey = nextPoint ? `${point.noteId}-${nextPoint.noteId}` : null;
                        const travelInfo = segmentKey ? travelSegments.get(segmentKey) : null;

                        return (
                            <div key={`${point.noteId}-${index}`}>
                                {/* Journey Point */}
                                <div className="relative pl-10 py-2">
                                    {/* Timeline dot */}
                                    <div
                                        className={cn(
                                            "absolute left-2.5 top-3.5 w-3 h-3 rounded-full border-2 border-background",
                                            point.status ? STATUS_COLORS[point.status] || "bg-muted" : "bg-muted"
                                        )}
                                    />

                                    {/* Content */}
                                    <Link
                                        href={`/dashboard/project/${novelId}/notes/${point.noteId}`}
                                        className="group block p-2 rounded-lg hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                {/* Location */}
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3 w-3 text-primary" />
                                                    <span className="font-medium text-sm">
                                                        {point.locationName || "ไม่ระบุสถานที่"}
                                                    </span>
                                                </div>

                                                {/* Note title */}
                                                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                                                    <FileText className="h-3 w-3" />
                                                    <span className="truncate">{point.noteTitle}</span>
                                                </div>

                                                {/* Status info */}
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    {point.health !== null && (
                                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                            <Heart className="h-2.5 w-2.5 mr-0.5 text-red-500" />
                                                            {point.health}%
                                                        </Badge>
                                                    )}
                                                    {point.mood && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {point.mood}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Arrow indicator */}
                                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </Link>
                                </div>

                                {/* Travel Time Indicator between points */}
                                {travelInfo && travelInfo.travelTime && (
                                    <div className="relative pl-10 py-1">
                                        <div className="absolute left-[14px] top-0 bottom-0 w-0.5 bg-amber-500/50" />
                                        <div className="flex items-center gap-2 py-1 px-2 ml-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs">
                                            <Clock className="h-3 w-3 text-amber-500" />
                                            <span className="text-amber-700 dark:text-amber-400">
                                                {METHOD_ICONS[travelInfo.travelMethod || "walk"]} {travelInfo.travelTime} {travelInfo.travelTimeUnit === "hours" ? "ชม." : travelInfo.travelTimeUnit === "days" ? "วัน" : travelInfo.travelTimeUnit}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

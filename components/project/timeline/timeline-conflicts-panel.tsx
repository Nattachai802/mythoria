"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, MapPin, ArrowRight, ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    detectTimelineConflicts,
    detectCharacterConflicts,
    TimelineConflict
} from "@/server/timeline-conflicts";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TimelineConflictsPanelProps {
    novelId: string;
    characterId?: string; // If provided, show conflicts for this character only
}

const METHOD_ICONS: Record<string, string> = {
    walk: "🚶",
    horse: "🐴",
    carriage: "🛒",
    boat: "⛵",
    teleport: "✨",
    custom: "⚙️",
};

function ConflictCard({ conflict, novelId }: { conflict: TimelineConflict; novelId: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <div className="group flex items-start gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-colors">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{conflict.characterName}</span>
                            <Badge variant="outline" className="text-[10px] h-4">
                                {METHOD_ICONS[conflict.travelMethod || "walk"]} {conflict.requiredTime} {conflict.requiredTimeUnit === "hours" ? "ชม." : conflict.requiredTimeUnit === "days" ? "วัน" : conflict.requiredTimeUnit}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{conflict.fromLocation.name}</span>
                            <ArrowRight className="h-3 w-3 text-amber-500" />
                            <span className="truncate">{conflict.toLocation.name}</span>
                        </div>
                    </div>

                    <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )} />
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="mt-2 p-3 bg-muted/30 rounded-lg text-sm space-y-2">
                    <p className="text-muted-foreground">{conflict.message}</p>

                    <div className="flex gap-2">
                        <Link href={`/dashboard/project/${novelId}/notes/${conflict.fromLocation.noteId}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                📄 {conflict.fromLocation.noteTitle || "Note"}
                            </Button>
                        </Link>
                        <Link href={`/dashboard/project/${novelId}/notes/${conflict.toLocation.noteId}`}>
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                                📄 {conflict.toLocation.noteTitle || "Note"}
                            </Button>
                        </Link>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export function TimelineConflictsPanel({ novelId, characterId }: TimelineConflictsPanelProps) {
    const [conflicts, setConflicts] = useState<TimelineConflict[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);

    useEffect(() => {
        async function fetchConflicts() {
            setIsLoading(true);
            try {
                const result = characterId
                    ? await detectCharacterConflicts(characterId, novelId)
                    : await detectTimelineConflicts(novelId);

                if (result.success) {
                    setConflicts(result.conflicts);
                }
            } catch (error) {
                console.error("Failed to fetch conflicts:", error);
            } finally {
                setIsLoading(false);
            }
        }
        fetchConflicts();
    }, [novelId, characterId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (conflicts.length === 0) {
        return (
            <div className="flex items-center gap-2 py-3 px-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
                <Clock className="h-4 w-4" />
                <span>ไม่พบความขัดแย้งทาง Timeline</span>
            </div>
        );
    }

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between py-2 px-3 bg-amber-500/10 rounded-lg cursor-pointer hover:bg-amber-500/15 transition-colors">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-sm">
                            พบ {conflicts.length} เหตุการณ์ที่ต้องตรวจสอบ
                        </span>
                    </div>
                    <ChevronDown className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        isExpanded && "rotate-180"
                    )} />
                </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
                <div className="space-y-2 mt-2">
                    {conflicts.map((conflict, index) => (
                        <ConflictCard
                            key={`${conflict.characterId}-${conflict.fromLocation.noteId}-${index}`}
                            conflict={conflict}
                            novelId={novelId}
                        />
                    ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

"use client";

import { useEffect, useState } from "react";
import { getAllFactionsWithMembers, getFactionsByNovelId } from "@/server/factions";
import { getChapters } from "@/server/chapter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Users, ChevronDown, ChevronUp, User } from "lucide-react";
import Link from "next/link";

interface FactionTimelineViewProps {
    novelId: string;
}

interface FactionMember {
    id: string;
    characterId: string;
    role: string | null;
    startChapterId: string | null;
    endChapterId: string | null;
    character: {
        id: string;
        name: string;
        image: string | null;
        role: string;
    };
}

interface FactionWithMembers {
    id: string;
    name: string;
    description: string | null;
    type: string | null;
    color: string | null;
    members: FactionMember[];
}

interface Chapter {
    id: string;
    title: string;
    orderIndex: number;
}

export function FactionTimelineView({ novelId }: FactionTimelineViewProps) {
    const [factions, setFactions] = useState<FactionWithMembers[]>([]);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [expandedFactions, setExpandedFactions] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, [novelId]);

    const fetchData = async () => {
        setIsLoading(true);
        const [factionsResult, chaptersResult] = await Promise.all([
            getAllFactionsWithMembers(novelId),
            getChapters(novelId),
        ]);

        if (factionsResult.success && factionsResult.data) {
            setFactions(factionsResult.data as FactionWithMembers[]);
            // Expand first faction by default
            if (factionsResult.data.length > 0) {
                setExpandedFactions(new Set([factionsResult.data[0].id]));
            }
        }
        if (chaptersResult.success && chaptersResult.chapters) {
            setChapters(chaptersResult.chapters);
        }
        setIsLoading(false);
    };

    const toggleFaction = (factionId: string) => {
        setExpandedFactions((prev) => {
            const next = new Set(prev);
            if (next.has(factionId)) {
                next.delete(factionId);
            } else {
                next.add(factionId);
            }
            return next;
        });
    };

    const getChapterIndex = (chapterId: string | null): number => {
        if (!chapterId) return -1;
        const chapter = chapters.find((ch) => ch.id === chapterId);
        return chapter ? chapter.orderIndex : -1;
    };

    const getMemberTimelineBar = (member: FactionMember) => {
        const startIndex = getChapterIndex(member.startChapterId);
        const endIndex = getChapterIndex(member.endChapterId);
        const totalChapters = chapters.length;

        if (totalChapters === 0) return { left: "0%", width: "100%" };

        // If no start, assume from beginning
        const effectiveStart = startIndex === -1 ? 0 : startIndex - 1;
        // If no end, assume until current/end
        const effectiveEnd = endIndex === -1 ? totalChapters : endIndex;

        const left = (effectiveStart / totalChapters) * 100;
        const width = ((effectiveEnd - effectiveStart) / totalChapters) * 100;

        return {
            left: `${Math.max(0, left)}%`,
            width: `${Math.min(100 - left, width)}%`,
        };
    };

    const getFactionColor = (color: string | null): string => {
        if (color) {
            if (color.startsWith("#") || color.startsWith("rgb")) {
                return color;
            }
            // Handle Tailwind color names
            return `var(--color-${color}-500)`;
        }
        return "#6b7280"; // Default gray
    };

    if (isLoading) {
        return <div className="text-sm text-muted-foreground py-4">กำลังโหลดข้อมูลก๊ก…</div>;
    }

    if (factions.length === 0) {
        return (
            <div className="flex flex-col items-center text-center py-10 chamfered border border-dashed border-border bg-card/40">
                <Users className="w-9 h-9 text-[var(--forge-gold)]/50 mb-3" />
                <p className="text-sm text-muted-foreground">ยังไม่มีก๊ก/ฝ่าย</p>
                <p className="text-xs text-muted-foreground/70 mt-1">สร้างก๊กในหน้าความสัมพันธ์เพื่อติดตามสมาชิก</p>
            </div>
        );
    }

    return (
        <div className="chamfered border border-border bg-card/50 p-5 space-y-4">
                {/* Chapter markers */}
                {chapters.length > 0 && (
                    <div className="relative h-6 mb-2">
                        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-border" />
                        <div className="flex justify-between">
                            {chapters.length <= 10 ? (
                                chapters.map((ch) => (
                                    <TooltipProvider key={ch.id}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="w-2 h-4 bg-muted-foreground/50 rounded-sm cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>บทที่ {ch.orderIndex}: {ch.title}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                ))
                            ) : (
                                <>
                                    <span className="text-xs text-muted-foreground">บท 1</span>
                                    <span className="text-xs text-muted-foreground">บท {chapters.length}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Factions */}
                <div className="space-y-3">
                    {factions.map((faction) => {
                        const isExpanded = expandedFactions.has(faction.id);
                        const factionColorStyle = faction.color
                            ? { backgroundColor: faction.color.startsWith("#") ? faction.color : undefined }
                            : {};

                        return (
                            <div key={faction.id} className="border border-border chamfered-sm overflow-hidden">
                                {/* Faction Header */}
                                <button
                                    className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted/70 transition-colors text-left"
                                    onClick={() => toggleFaction(faction.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-4 h-4 rounded-full"
                                            style={factionColorStyle}
                                        />
                                        <span className="font-medium">{faction.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {faction.members.length} สมาชิก
                                        </Badge>
                                        {faction.type && (
                                            <Badge variant="secondary" className="text-xs">
                                                {faction.type}
                                            </Badge>
                                        )}
                                    </div>
                                    {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>

                                {/* Members Timeline */}
                                {isExpanded && (
                                    <div className="p-3 space-y-2">
                                        {faction.members.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                ยังไม่มีสมาชิก
                                            </p>
                                        ) : (
                                            faction.members.map((member) => {
                                                const bar = getMemberTimelineBar(member);
                                                return (
                                                    <div
                                                        key={member.id}
                                                        className="flex items-center gap-3"
                                                    >
                                                        {/* Character Info */}
                                                        <Link
                                                            href={`/dashboard/project/${novelId}/characters/${member.character.id}`}
                                                            className="flex items-center gap-2 w-36 shrink-0 hover:opacity-80"
                                                        >
                                                            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
                                                                {member.character.image ? (
                                                                    <img
                                                                        src={member.character.image}
                                                                        alt={member.character.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <User className="w-4 h-4 text-muted-foreground" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium truncate">
                                                                    {member.character.name}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground truncate">
                                                                    {member.role || "สมาชิก"}
                                                                </p>
                                                            </div>
                                                        </Link>

                                                        {/* Timeline Bar */}
                                                        <div className="flex-1 h-4 bg-muted rounded-full relative overflow-hidden">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div
                                                                            className="absolute h-full rounded-full transition-all cursor-help"
                                                                            style={{
                                                                                left: bar.left,
                                                                                width: bar.width,
                                                                                backgroundColor: faction.color || "#3b82f6",
                                                                            }}
                                                                        />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>
                                                                            {member.startChapterId
                                                                                ? `เริ่ม: บท ${getChapterIndex(member.startChapterId)}`
                                                                                : "เริ่มแต่แรก"
                                                                            }
                                                                            {" - "}
                                                                            {member.endChapterId
                                                                                ? `จบ: บท ${getChapterIndex(member.endChapterId)}`
                                                                                : "ยังอยู่"
                                                                            }
                                                                        </p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
        </div>
    );
}

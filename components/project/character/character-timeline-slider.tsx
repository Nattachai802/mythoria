"use client";

import { useEffect, useState } from "react";
import {
    getCharacterStateTimeline,
    compareCharacterStates,
    CharacterStateAtChapter,
} from "@/server/character-state-queries";
import { getChapters } from "@/server/chapter";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MapPin,
    Heart,
    Smile,
    Activity,
    GitCompare,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface CharacterTimelineSliderProps {
    characterId: string;
    novelId: string;
}

export function CharacterTimelineSlider({
    characterId,
    novelId,
}: CharacterTimelineSliderProps) {
    const [timeline, setTimeline] = useState<CharacterStateAtChapter[]>([]);
    const [chapters, setChapters] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [compareMode, setCompareMode] = useState(false);
    const [compareChapterId, setCompareChapterId] = useState<string>("");
    const [comparison, setComparison] = useState<{
        from: CharacterStateAtChapter | null;
        to: CharacterStateAtChapter | null;
        differences: string[];
    } | null>(null);

    useEffect(() => {
        fetchData();
    }, [characterId, novelId]);

    const fetchData = async () => {
        setIsLoading(true);
        const [timelineResult, chaptersResult] = await Promise.all([
            getCharacterStateTimeline(characterId, novelId),
            getChapters(novelId),
        ]);

        if (timelineResult.success && timelineResult.timeline) {
            setTimeline(timelineResult.timeline);
        }
        if (chaptersResult.success && chaptersResult.chapters) {
            setChapters(chaptersResult.chapters);
        }
        setIsLoading(false);
    };

    const handleCompare = async () => {
        if (!compareChapterId || timeline.length === 0) return;

        const currentState = timeline[currentIndex];
        const result = await compareCharacterStates(
            characterId,
            currentState.chapterId,
            compareChapterId
        );

        if (result.success && result.comparison) {
            setComparison(result.comparison);
        }
    };

    const currentState = timeline[currentIndex];

    const getHealthColor = (health: number | null) => {
        if (health === null) return "bg-gray-400";
        if (health >= 80) return "bg-green-500";
        if (health >= 50) return "bg-yellow-500";
        if (health >= 25) return "bg-orange-500";
        return "bg-red-500";
    };

    if (isLoading) {
        return (
            <div className="text-sm text-muted-foreground py-4">กำลังโหลด Timeline…</div>
        );
    }

    if (timeline.length === 0) {
        return (
            <div className="flex flex-col items-center text-center py-10 chamfered border border-dashed border-border bg-card/40">
                <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลสถานะตัวละครในบทใด</p>
                <p className="text-xs text-muted-foreground/70 mt-1">ลองเขียน Note แล้วเชื่อมโยงกับบท</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-end mb-2">
                <Button
                    variant={compareMode ? "default" : "outline"}
                    size="sm"
                    className="chamfered-sm"
                    onClick={() => {
                        setCompareMode(!compareMode);
                        setComparison(null);
                    }}
                >
                    <GitCompare className="w-4 h-4 mr-2" />
                    เปรียบเทียบ
                </Button>
            </div>
            <div className="space-y-6">
                {/* Timeline Slider */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between font-technical text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                        <span>บทที่ {timeline[0]?.chapterOrderIndex || 1}</span>
                        <span>บทที่ {timeline[timeline.length - 1]?.chapterOrderIndex || 1}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Slider
                            value={[currentIndex]}
                            onValueChange={(v) => setCurrentIndex(v[0])}
                            max={timeline.length - 1}
                            min={0}
                            step={1}
                            className="flex-1"
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentIndex(Math.min(timeline.length - 1, currentIndex + 1))}
                            disabled={currentIndex === timeline.length - 1}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="text-center">
                        <span className="font-display text-lg font-semibold">
                            บทที่ {currentState?.chapterOrderIndex}: {currentState?.chapterTitle}
                        </span>
                    </div>
                </div>

                {/* Current State Display */}
                {currentState && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 border-y border-border/60 divide-x divide-border/50">
                        <div className="py-3 px-1 first:pl-0">
                            
                            <p className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1"><MapPin className="w-3 h-3" />ตำแหน่ง</p>
                            <p className="font-medium text-sm">{currentState.locationName || "ไม่ระบุ"}</p>
                        </div>
                        <div className="py-3 px-1 first:pl-0">
                            
                            <p className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1"><Activity className="w-3 h-3" />สถานะ</p>
                            <p className="font-medium text-sm">{currentState.status || "ปกติ"}</p>
                        </div>
                        <div className="py-3 px-1 first:pl-0">
                            
                            <p className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1"><Smile className="w-3 h-3" />อารมณ์</p>
                            <p className="font-medium text-sm">
                                {currentState.mood || "ปกติ"}
                            </p>
                        </div>
                        <div className="py-3 px-1 first:pl-0">
                            
                            <p className="flex items-center gap-1.5 font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1"><Heart className="w-3 h-3" />สุขภาพ</p>
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${getHealthColor(currentState.health)}`} />
                                <span className="font-medium text-sm">
                                    {currentState.health !== null ? `${currentState.health}%` : "?"}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Compare Mode */}
                {compareMode && (
                    <div className="border-t pt-4 space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-sm">เปรียบเทียบกับ:</span>
                            <Select value={compareChapterId} onValueChange={setCompareChapterId}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="เลือกบท..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {chapters.map((ch) => (
                                        <SelectItem key={ch.id} value={ch.id}>
                                            บทที่ {ch.orderIndex}: {ch.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleCompare} disabled={!compareChapterId}>
                                เปรียบเทียบ
                            </Button>
                        </div>

                        {comparison && (
                            <div className="border-l-2 border-[var(--forge-gold)]/40 pl-4">
                                <h4 className="font-medium mb-3">ความแตกต่าง:</h4>
                                {comparison.differences.length === 0 ? (
                                    <p className="text-muted-foreground">ไม่มีความแตกต่าง</p>
                                ) : (
                                    <ul className="space-y-2">
                                        {comparison.differences.map((diff, i) => (
                                            <li key={i} className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-primary" />
                                                {diff}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Notes */}
                {currentState?.notes && (
                    <div className="border-t pt-4">
                        <p className="text-sm text-muted-foreground mb-1">หมายเหตุ:</p>
                        <p className="text-sm">{currentState.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

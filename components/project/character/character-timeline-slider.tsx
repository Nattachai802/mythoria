"use client";

import { useEffect, useState } from "react";
import {
    getCharacterStateTimeline,
    compareCharacterStates,
    CharacterStateAtChapter,
} from "@/server/character-state-queries";
import { getChapters } from "@/server/chapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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

    const getMoodEmoji = (mood: string | null) => {
        if (!mood) return "😐";
        const lowerMood = mood.toLowerCase();
        if (lowerMood.includes("happy") || lowerMood.includes("สุข")) return "😊";
        if (lowerMood.includes("sad") || lowerMood.includes("เศร้า")) return "😢";
        if (lowerMood.includes("angry") || lowerMood.includes("โกรธ")) return "😠";
        if (lowerMood.includes("fear") || lowerMood.includes("กลัว")) return "😨";
        if (lowerMood.includes("calm") || lowerMood.includes("สงบ")) return "😌";
        return "😐";
    };

    const getHealthColor = (health: number | null) => {
        if (health === null) return "bg-gray-400";
        if (health >= 80) return "bg-green-500";
        if (health >= 50) return "bg-yellow-500";
        if (health >= 25) return "bg-orange-500";
        return "bg-red-500";
    };

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    กำลังโหลด Timeline...
                </CardContent>
            </Card>
        );
    }

    if (timeline.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    <p>ยังไม่มีข้อมูลสถานะตัวละครในบทใดๆ</p>
                    <p className="text-sm mt-1">ลองเขียน Note แล้วเชื่อมโยงกับบท</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>📊 สถานะตัวละครตาม Timeline</span>
                    <Button
                        variant={compareMode ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                            setCompareMode(!compareMode);
                            setComparison(null);
                        }}
                    >
                        <GitCompare className="w-4 h-4 mr-2" />
                        เปรียบเทียบ
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Timeline Slider */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
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
                        <Badge variant="outline" className="text-lg px-4 py-1">
                            บทที่ {currentState?.chapterOrderIndex}: {currentState?.chapterTitle}
                        </Badge>
                    </div>
                </div>

                {/* Current State Display */}
                {currentState && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <MapPin className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                            <p className="text-xs text-muted-foreground mb-1">ตำแหน่ง</p>
                            <p className="font-medium text-sm">{currentState.locationName || "ไม่ระบุ"}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <Activity className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                            <p className="text-xs text-muted-foreground mb-1">สถานะ</p>
                            <p className="font-medium text-sm">{currentState.status || "ปกติ"}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <Smile className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                            <p className="text-xs text-muted-foreground mb-1">อารมณ์</p>
                            <p className="font-medium text-sm">
                                {getMoodEmoji(currentState.mood)} {currentState.mood || "ปกติ"}
                            </p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 text-center">
                            <Heart className="w-5 h-5 mx-auto mb-1 text-red-500" />
                            <p className="text-xs text-muted-foreground mb-1">สุขภาพ</p>
                            <div className="flex items-center justify-center gap-2">
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
                            <div className="bg-muted/30 rounded-lg p-4">
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
            </CardContent>
        </Card>
    );
}

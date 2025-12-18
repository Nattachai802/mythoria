"use client";

import { useEffect, useState } from "react";
import { getRelationshipHistory, recordOpinionChange } from "@/server/character";
import { getChapters } from "@/server/chapter";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface RelationshipTimelineProps {
    relationshipId: string;
    novelId: string;
    currentOpinionLevel: number;
    characterName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdate?: () => void;
}

interface HistoryEntry {
    id: string;
    opinionLevel: number;
    sentiment: string | null;
    reason: string | null;
    createdAt: string;
    chapter: {
        id: string;
        title: string;
        orderIndex: number;
    } | null;
}

export function RelationshipTimeline({
    relationshipId,
    novelId,
    currentOpinionLevel,
    characterName,
    open,
    onOpenChange,
    onUpdate,
}: RelationshipTimelineProps) {
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [chapters, setChapters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);

    // Form state
    const [newOpinionLevel, setNewOpinionLevel] = useState(currentOpinionLevel);
    const [selectedChapter, setSelectedChapter] = useState<string>("");
    const [reason, setReason] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open, relationshipId]);

    const fetchData = async () => {
        setIsLoading(true);
        const [historyResult, chaptersResult] = await Promise.all([
            getRelationshipHistory(relationshipId),
            getChapters(novelId),
        ]);

        if (historyResult.success && historyResult.data) {
            setHistory(historyResult.data as unknown as HistoryEntry[]);
        }
        if (chaptersResult.success && chaptersResult.chapters) {
            setChapters(chaptersResult.chapters);
        }
        setIsLoading(false);
    };

    const handleAddEntry = async () => {
        setIsSaving(true);
        const result = await recordOpinionChange(
            relationshipId,
            novelId,
            newOpinionLevel,
            selectedChapter && selectedChapter !== "none" ? selectedChapter : undefined,
            reason || undefined
        );

        if (result.success) {
            await fetchData();
            setShowAddForm(false);
            setReason("");
            setSelectedChapter("");
            onUpdate?.();
        }
        setIsSaving(false);
    };

    const getOpinionColor = (level: number) => {
        if (level >= 80) return "bg-emerald-500";
        if (level >= 60) return "bg-green-400";
        if (level >= 40) return "bg-yellow-400";
        if (level >= 20) return "bg-orange-400";
        return "bg-red-500";
    };

    const getTrendIcon = (current: number, previous: number | null) => {
        if (previous === null) return null;
        const diff = current - previous;
        if (diff > 5) return <TrendingUp className="w-4 h-4 text-green-500" />;
        if (diff < -5) return <TrendingDown className="w-4 h-4 text-red-500" />;
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>ประวัติความสัมพันธ์กับ {characterName}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            กำลังโหลด...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            <p>ยังไม่มีประวัติการเปลี่ยนแปลง</p>
                            <p className="text-sm mt-1">คลิก "เพิ่มจุดเปลี่ยน" เพื่อบันทึกจุดสำคัญ</p>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* Timeline line */}
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                            {/* Timeline entries */}
                            <div className="space-y-4">
                                {history.map((entry, index) => {
                                    const prevLevel = index > 0 ? history[index - 1].opinionLevel : null;
                                    return (
                                        <div key={entry.id} className="relative pl-10">
                                            {/* Timeline dot */}
                                            <div className={`absolute left-2 top-2 w-5 h-5 rounded-full border-2 border-background ${getOpinionColor(entry.opinionLevel)}`} />

                                            <div className="bg-muted/50 rounded-lg p-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{entry.opinionLevel}%</span>
                                                        {getTrendIcon(entry.opinionLevel, prevLevel)}
                                                    </div>
                                                    {entry.chapter && (
                                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                            บทที่ {entry.chapter.orderIndex}: {entry.chapter.title}
                                                        </span>
                                                    )}
                                                </div>

                                                {entry.reason && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {entry.reason}
                                                    </p>
                                                )}

                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {new Date(entry.createdAt).toLocaleDateString('th-TH', {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add new entry form */}
                    {showAddForm && (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                            <h4 className="font-medium">เพิ่มจุดเปลี่ยน</h4>

                            <div className="space-y-2">
                                <Label>ระดับความสัมพันธ์ใหม่: {newOpinionLevel}%</Label>
                                <Slider
                                    value={[newOpinionLevel]}
                                    onValueChange={(v) => setNewOpinionLevel(v[0])}
                                    max={100}
                                    min={0}
                                    step={5}
                                />
                                <div className={`h-2 rounded-full ${getOpinionColor(newOpinionLevel)}`} />
                            </div>

                            <div className="space-y-2">
                                <Label>บทที่เกิดเหตุการณ์ (ไม่บังคับ)</Label>
                                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกบท..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">ไม่ระบุ</SelectItem>
                                        {chapters.map((ch) => (
                                            <SelectItem key={ch.id} value={ch.id}>
                                                บทที่ {ch.orderIndex}: {ch.title}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>เหตุผล / เหตุการณ์ที่ทำให้เปลี่ยน</Label>
                                <Input
                                    placeholder="เช่น ช่วยชีวิต, ทรยศ, เปิดเผยความลับ..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                                    ยกเลิก
                                </Button>
                                <Button onClick={handleAddEntry} disabled={isSaving}>
                                    {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t pt-4">
                    {!showAddForm && (
                        <Button onClick={() => setShowAddForm(true)} className="w-full">
                            <Plus className="w-4 h-4 mr-2" />
                            เพิ่มจุดเปลี่ยน
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

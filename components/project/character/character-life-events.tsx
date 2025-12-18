"use client";

import { useEffect, useState } from "react";
import {
    getCharacterLifeEvents,
    createLifeEvent,
    updateLifeEvent,
    deleteLifeEvent,
} from "@/server/life-events";
import { EVENT_TYPES, EventType } from "@/lib/life-event-types";
import { getChapters } from "@/server/chapter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CharacterLifeEventsProps {
    characterId: string;
    novelId: string;
}

interface LifeEvent {
    id: string;
    title: string;
    description: string | null;
    eventType: string;
    impact: string | null;
    importance: number | null;
    changedTraits: string[] | null;
    createdAt: string;
    chapter: {
        id: string;
        title: string;
        orderIndex: number;
    } | null;
}

const IMPACT_CONFIG = {
    positive: { label: 'เชิงบวก', color: 'bg-green-500', icon: '✨' },
    negative: { label: 'เชิงลบ', color: 'bg-red-500', icon: '💔' },
    neutral: { label: 'กลาง', color: 'bg-gray-500', icon: '⚖️' },
};

export function CharacterLifeEvents({ characterId, novelId }: CharacterLifeEventsProps) {
    const [events, setEvents] = useState<LifeEvent[]>([]);
    const [chapters, setChapters] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventType, setEventType] = useState<EventType>("other");
    const [impact, setImpact] = useState("neutral");
    const [importance, setImportance] = useState(5);
    const [selectedChapter, setSelectedChapter] = useState<string>("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [characterId]);

    const fetchData = async () => {
        setIsLoading(true);
        const [eventsResult, chaptersResult] = await Promise.all([
            getCharacterLifeEvents(characterId),
            getChapters(novelId),
        ]);

        if (eventsResult.success && eventsResult.data) {
            setEvents(eventsResult.data as unknown as LifeEvent[]);
        }
        if (chaptersResult.success && chaptersResult.chapters) {
            setChapters(chaptersResult.chapters);
        }
        setIsLoading(false);
    };

    const resetForm = () => {
        setTitle("");
        setDescription("");
        setEventType("other");
        setImpact("neutral");
        setImportance(5);
        setSelectedChapter("");
        setEditingEvent(null);
    };

    const openAddDialog = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const openEditDialog = (event: LifeEvent) => {
        setEditingEvent(event);
        setTitle(event.title);
        setDescription(event.description || "");
        setEventType(event.eventType as EventType);
        setImpact(event.impact || "neutral");
        setImportance(event.importance || 5);
        setSelectedChapter(event.chapter?.id || "");
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("กรุณาใส่ชื่อเหตุการณ์");
            return;
        }

        setIsSaving(true);

        const data = {
            title: title.trim(),
            description: description.trim() || undefined,
            eventType,
            impact,
            importance,
            chapterId: selectedChapter && selectedChapter !== "none" ? selectedChapter : undefined,
        };

        let result;
        if (editingEvent) {
            result = await updateLifeEvent(editingEvent.id, data);
        } else {
            result = await createLifeEvent({
                ...data,
                characterId,
                novelId,
            });
        }

        if (result.success) {
            toast.success(editingEvent ? "อัปเดตเหตุการณ์แล้ว" : "เพิ่มเหตุการณ์แล้ว");
            setIsDialogOpen(false);
            resetForm();
            fetchData();
        } else {
            toast.error("เกิดข้อผิดพลาด");
        }

        setIsSaving(false);
    };

    const handleDelete = async () => {
        if (!deleteId) return;

        const result = await deleteLifeEvent(deleteId);
        if (result.success) {
            toast.success("ลบเหตุการณ์แล้ว");
            fetchData();
        } else {
            toast.error("ไม่สามารถลบเหตุการณ์ได้");
        }
        setDeleteId(null);
    };

    const getEventConfig = (type: string) => {
        return EVENT_TYPES[type as EventType] || EVENT_TYPES.other;
    };

    const getImpactConfig = (impactType: string) => {
        return IMPACT_CONFIG[impactType as keyof typeof IMPACT_CONFIG] || IMPACT_CONFIG.neutral;
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5" />
                            เหตุการณ์สำคัญในชีวิต
                        </CardTitle>
                        <Button onClick={openAddDialog} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            เพิ่มเหตุการณ์
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            กำลังโหลด...
                        </div>
                    ) : events.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                            <p className="mb-2">ยังไม่มีเหตุการณ์สำคัญ</p>
                            <p className="text-sm">บันทึกจุดเปลี่ยนสำคัญในชีวิตตัวละคร เช่น การค้นพบพลัง, การสูญเสีย, ความสำเร็จ</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {events.map((event) => {
                                const eventConfig = getEventConfig(event.eventType);
                                const impactConfig = getImpactConfig(event.impact || "neutral");

                                return (
                                    <div
                                        key={event.id}
                                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                                    >
                                        {/* Event Icon */}
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${eventConfig.color} text-white`}>
                                            {eventConfig.icon}
                                        </div>

                                        {/* Event Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-medium">{event.title}</span>
                                                <Badge variant="outline" className="text-xs">
                                                    {eventConfig.label}
                                                </Badge>
                                                <Badge variant="outline" className={`text-xs ${event.impact === 'positive' ? 'border-green-500 text-green-600' : event.impact === 'negative' ? 'border-red-500 text-red-600' : ''}`}>
                                                    {impactConfig.icon} {impactConfig.label}
                                                </Badge>
                                            </div>

                                            {event.description && (
                                                <p className="text-sm text-muted-foreground line-clamp-2 mb-1">
                                                    {event.description}
                                                </p>
                                            )}

                                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                {event.chapter && (
                                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                                                        บทที่ {event.chapter.orderIndex}
                                                    </span>
                                                )}
                                                <span>ความสำคัญ: {event.importance}/10</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => openEditDialog(event)}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                                onClick={() => setDeleteId(event.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {editingEvent ? "แก้ไขเหตุการณ์" : "เพิ่มเหตุการณ์สำคัญ"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ชื่อเหตุการณ์ *</Label>
                            <Input
                                placeholder="เช่น ค้นพบพลังที่ซ่อนอยู่"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>รายละเอียด</Label>
                            <Textarea
                                placeholder="อธิบายเหตุการณ์ที่เกิดขึ้น..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>ประเภทเหตุการณ์</Label>
                                <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(EVENT_TYPES).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                {config.icon} {config.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>ผลกระทบ</Label>
                                <Select value={impact} onValueChange={setImpact}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(IMPACT_CONFIG).map(([key, config]) => (
                                            <SelectItem key={key} value={key}>
                                                {config.icon} {config.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
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
                            <Label>ความสำคัญ: {importance}/10</Label>
                            <Slider
                                value={[importance]}
                                onValueChange={(v) => setImportance(v[0])}
                                max={10}
                                min={1}
                                step={1}
                            />
                            <p className="text-xs text-muted-foreground">
                                เหตุการณ์ที่สำคัญมากจะแสดงก่อน
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบเหตุการณ์</AlertDialogTitle>
                        <AlertDialogDescription>
                            คุณแน่ใจหรือไม่ว่าต้องการลบเหตุการณ์นี้?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            ลบ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

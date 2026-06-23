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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
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
import {
    Plus, Pencil, Trash2,
    HeartCrack, Trophy, Skull, Lightbulb, Sparkles, Heart, Zap, Pin,
    TrendingUp, TrendingDown, Minus,
    type LucideIcon,
} from "lucide-react";
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

// Lucide icons replace the emoji in EVENT_TYPES; category color drives the timeline dot
const EVENT_ICONS: Record<string, LucideIcon> = {
    trauma: HeartCrack,
    achievement: Trophy,
    loss: Skull,
    discovery: Lightbulb,
    transformation: Sparkles,
    relationship: Heart,
    power: Zap,
    other: Pin,
};

const EVENT_DOT: Record<string, string> = {
    trauma: "text-red-500",
    achievement: "text-[var(--forge-amber)]",
    loss: "text-zinc-400",
    discovery: "text-sky-500",
    transformation: "text-violet-500",
    relationship: "text-pink-500",
    power: "text-[var(--forge-gold)]",
    other: "text-zinc-400",
};

const IMPACT_CONFIG = {
    positive: { label: 'เชิงบวก', cls: 'text-emerald-500', Icon: TrendingUp },
    negative: { label: 'เชิงลบ', cls: 'text-red-500', Icon: TrendingDown },
    neutral: { label: 'กลาง', cls: 'text-muted-foreground', Icon: Minus },
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
            <div className="flex justify-end mb-4">
                <Button onClick={openAddDialog} size="sm" variant="outline" className="chamfered-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มเหตุการณ์
                </Button>
            </div>

            {isLoading ? (
                <div className="text-sm text-muted-foreground py-6">กำลังโหลด…</div>
            ) : events.length === 0 ? (
                <div className="flex flex-col items-center text-center py-12 chamfered border border-dashed border-border bg-card/40">
                    <Sparkles className="w-9 h-9 text-[var(--forge-gold)]/50 mb-3" />
                    <p className="font-display font-semibold">ยังไม่มีเหตุการณ์สำคัญ</p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
                        บันทึกจุดเปลี่ยนในชีวิตตัวละคร เช่น การค้นพบพลัง การสูญเสีย หรือความสำเร็จ
                    </p>
                </div>
            ) : (
                <div className="relative ml-3 border-l border-border/70 pl-7 space-y-6">
                    {events.map((event) => {
                        const eventConfig = getEventConfig(event.eventType);
                        const impactConfig = getImpactConfig(event.impact || "neutral");
                        const EventIcon = EVENT_ICONS[event.eventType] || Pin;
                        const ImpactIcon = impactConfig.Icon;

                        return (
                            <div key={event.id} className="group relative">
                                {/* timeline node */}
                                <span className={`absolute -left-[37px] top-0.5 flex h-6 w-6 items-center justify-center chamfered-sm border border-border bg-card ${EVENT_DOT[event.eventType] || "text-muted-foreground"}`}>
                                    <EventIcon className="h-3.5 w-3.5" />
                                </span>

                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            {event.chapter && (
                                                <span className="font-technical text-[9px] uppercase tracking-[0.12em] text-[var(--forge-amber)]">
                                                    บทที่ {event.chapter.orderIndex}
                                                </span>
                                            )}
                                            <span className="font-technical text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                                                {eventConfig.label}
                                            </span>
                                        </div>
                                        <h4 className="font-display font-semibold leading-tight">{event.title}</h4>
                                        {event.description && (
                                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                                {event.description}
                                            </p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <span className={`inline-flex items-center gap-1 text-[11px] ${impactConfig.cls}`}>
                                                <ImpactIcon className="h-3 w-3" />{impactConfig.label}
                                            </span>
                                            <span className="font-technical text-[10px] tabular-nums text-muted-foreground">
                                                ความสำคัญ {event.importance}/10
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(event)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => setDeleteId(event.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add/Edit Sheet */}
            <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>
                            {editingEvent ? "แก้ไขเหตุการณ์" : "เพิ่มเหตุการณ์สำคัญ"}
                        </SheetTitle>
                    </SheetHeader>

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
                                                {config.label}
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
                                                {config.label}
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

                    <SheetFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
                            ยกเลิก
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

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

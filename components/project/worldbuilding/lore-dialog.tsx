"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createLoreEntry, updateLoreEntry, getLoreEntriesByNovelId } from "@/server/lore";
import { getLocationsByNovelId } from "@/server/locations";
import { getLoreGroupsByNovelId } from "@/server/lore-groups";
import { getErasByNovelId } from "@/server/eras";
import { getCharactersByNovelId } from "@/server/character";
import { toast } from "sonner";
import { Loader2, Globe, MapPin, FolderTree, Layers, Clock, Plus, Sparkles, BrainCircuit } from "lucide-react";
import { EraDialog } from "./era-dialog";
import { LoreRichEditor, MentionItem } from "./lore-rich-editor";
import { FloatingIdeaPool } from "./floating-idea-pool";

interface LoreDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    novelId: string;
    editEntry?: {
        id: string;
        title: string;
        content?: string | null;
        type?: string | null;
        eraId?: string | null;
        scope?: string | null;
        locationId?: string | null;
        parentLoreId?: string | null;
        groupId?: string | null;
        icon?: string | null;
        color?: string | null;
        importance?: number | null;
    } | null;
    defaultLocationId?: string | null;
    defaultParentLoreId?: string | null;
    defaultGroupId?: string | null;
    defaultEraId?: string | null;
    onSuccess?: () => void;
}

const LORE_TYPES = [
    { value: "event", label: "⚡ เหตุการณ์" },
    { value: "legend", label: "📜 ตำนาน" },
    { value: "prophecy", label: "🔮 คำทำนาย" },
    { value: "mythology", label: "🐉 ตำนานเทพ" },
    { value: "history", label: "📚 ประวัติศาสตร์" },
];

const COLORS = [
    { value: "#8b5cf6", label: "ม่วง" },
    { value: "#3b82f6", label: "น้ำเงิน" },
    { value: "#10b981", label: "เขียว" },
    { value: "#f59e0b", label: "ส้ม" },
    { value: "#ef4444", label: "แดง" },
    { value: "#ec4899", label: "ชมพู" },
];

export function LoreDialog({
    open,
    onOpenChange,
    novelId,
    editEntry,
    defaultLocationId,
    defaultParentLoreId,
    defaultGroupId,
    defaultEraId,
    onSuccess,
}: LoreDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [locations, setLocations] = useState<any[]>([]);
    const [loreEntries, setLoreEntries] = useState<any[]>([]);
    const [loreGroups, setLoreGroups] = useState<any[]>([]);
    const [eras, setEras] = useState<any[]>([]);
    const [characters, setCharacters] = useState<any[]>([]);
    const [eraDialogOpen, setEraDialogOpen] = useState(false);
    
    // LLM Extraction States
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractedIdeas, setExtractedIdeas] = useState<string[]>([]);
    const [foundCharacters, setFoundCharacters] = useState<string[]>([]);
    const [foundLocations, setFoundLocations] = useState<string[]>([]);
    const [foundItems, setFoundItems] = useState<string[]>([]);

    // Form fields
    const [title, setTitle] = useState(editEntry?.title || "");
    const [content, setContent] = useState(editEntry?.content || "");
    const [type, setType] = useState(editEntry?.type || "event");
    const [eraId, setEraId] = useState(editEntry?.eraId || defaultEraId || "");
    const [scope, setScope] = useState(editEntry?.scope || (defaultLocationId ? "location" : "world"));
    const [locationId, setLocationId] = useState(editEntry?.locationId || defaultLocationId || "");
    const [parentLoreId, setParentLoreId] = useState(editEntry?.parentLoreId || defaultParentLoreId || "");
    const [groupId, setGroupId] = useState(editEntry?.groupId || defaultGroupId || "");
    const [icon, setIcon] = useState(editEntry?.icon || "");
    const [color, setColor] = useState(editEntry?.color || "#8b5cf6");
    const [importance, setImportance] = useState(editEntry?.importance || 5);

    const isEdit = !!editEntry;

    // Fetch data when dialog opens
    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open, novelId]);

    const fetchData = async () => {
        const [locResult, loreResult, groupResult, erasResult, charResult] = await Promise.all([
            getLocationsByNovelId(novelId),
            getLoreEntriesByNovelId(novelId),
            getLoreGroupsByNovelId(novelId),
            getErasByNovelId(novelId),
            getCharactersByNovelId(novelId),
        ]);

        if (locResult.success && locResult.data) {
            setLocations(locResult.data);
        }
        if (loreResult.success && loreResult.data) {
            const filtered = editEntry
                ? (loreResult.data as any[]).filter(l => l.id !== editEntry.id)
                : loreResult.data;
            setLoreEntries(filtered as any[]);
        }
        if (groupResult.success && groupResult.data) {
            setLoreGroups(groupResult.data);
        }
        if (erasResult.success && erasResult.data) {
            setEras(erasResult.data);
        }
        if (charResult.success && charResult.data) {
            setCharacters(charResult.data);
        }
    };
    
    const mentionItems = useMemo<MentionItem[]>(() => {
        const items: MentionItem[] = [];
        locations.forEach(loc => items.push({ id: loc.id, value: loc.name, type: "location" }));
        loreEntries.forEach(lore => items.push({ id: lore.id, value: lore.title, type: "lore" }));
        characters.forEach(char => items.push({ id: char.id, value: char.name, type: "character" }));
        return items;
    }, [locations, loreEntries, characters]);
    
    const handleExtractIdeas = async () => {
        if (!content.trim()) {
            toast.error("กรุณาระบุเนื้อหาก่อนเพื่อสกัดไอเดีย");
            return;
        }

        setIsExtracting(true);
        try {
            const res = await fetch(`/api/novel/${novelId}/lore/extract-entities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content })
            });

            const data = await res.json();
            if (res.ok) {
                setFoundCharacters(data.foundCharacters || []);
                setFoundLocations(data.foundLocations || []);
                setFoundItems(data.foundItems || []);
                setExtractedIdeas(data.newIdeas || []);
                toast.success(`พบในระบบ: ${data.foundCharacters.length + data.foundLocations.length + data.foundItems.length} | ไอเดียใหม่: ${data.newIdeas.length}`);
            } else {
                toast.error(data.error || "เกิดข้อผิดพลาดในการสกัดข้อมูล");
            }
        } catch (error) {
            toast.error("ไม่สามารถเชื่อมต่อ AI ได้");
        } finally {
            setIsExtracting(false);
        }
    };

    // Reset form when dialog opens or editEntry changes
    useEffect(() => {
        if (editEntry) {
            setTitle(editEntry.title);
            setContent(editEntry.content || "");
            setType(editEntry.type || "event");
            setEraId(editEntry.eraId || "");
            setScope(editEntry.scope || "world");
            setLocationId(editEntry.locationId || "");
            setParentLoreId(editEntry.parentLoreId || "");
            setGroupId(editEntry.groupId || "");
            setIcon(editEntry.icon || "");
            setColor(editEntry.color || "#8b5cf6");
            setImportance(editEntry.importance || 5);
        } else {
            setScope(defaultLocationId ? "location" : "world");
            setLocationId(defaultLocationId || "");
            setParentLoreId(defaultParentLoreId || "");
            setGroupId(defaultGroupId || "");
            setEraId(defaultEraId || "");
        }
    }, [editEntry, defaultLocationId, defaultParentLoreId, defaultGroupId, defaultEraId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("กรุณาระบุชื่อ");
            return;
        }

        if (scope === "location" && !locationId) {
            toast.error("กรุณาเลือกสถานที่");
            return;
        }

        setIsLoading(true);
        try {
            const data = {
                title: title.trim(),
                content: content.trim() || undefined,
                type,
                eraId: eraId && eraId !== "none" ? eraId : null,
                scope,
                locationId: scope === "location" ? locationId : null,
                parentLoreId: parentLoreId && parentLoreId !== "none" ? parentLoreId : null,
                groupId: groupId && groupId !== "none" ? groupId : null,
                icon: icon.trim() || undefined,
                color,
                importance,
                relatedCharacterIds: foundCharacters.length > 0 ? foundCharacters : undefined,
                relatedLocationIds: foundLocations.length > 0 ? foundLocations : undefined,
                relatedItemIds: foundItems.length > 0 ? foundItems : undefined,
            };

            let result;
            if (isEdit) {
                result = await updateLoreEntry(editEntry.id, data);
            } else {
                result = await createLoreEntry({ ...data, novelId });
            }

            if (result.success) {
                toast.success(isEdit ? "แก้ไขสำเร็จ" : "สร้างสำเร็จ");
                onOpenChange(false);
                onSuccess?.();
                if (!isEdit) {
                    resetForm();
                }
            } else {
                toast.error(result.error || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setTitle("");
        setContent("");
        setType("event");
        setEraId(defaultEraId || "");
        setScope(defaultLocationId ? "location" : "world");
        setLocationId(defaultLocationId || "");
        setParentLoreId(defaultParentLoreId || "");
        setGroupId(defaultGroupId || "");
        setIcon("");
        setColor("#8b5cf6");
        setImportance(5);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEdit ? "แก้ไข Lore" : "สร้าง Lore ใหม่"}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="basic">ข้อมูลพื้นฐาน</TabsTrigger>
                                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                <TabsTrigger value="hierarchy">ลำดับชั้น</TabsTrigger>
                            </TabsList>

                            {/* Basic Tab */}
                            <TabsContent value="basic" className="space-y-4 mt-4">
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-1">
                                        <Label htmlFor="icon">Icon</Label>
                                        <Input
                                            id="icon"
                                            value={icon}
                                            onChange={(e) => setIcon(e.target.value)}
                                            placeholder="⚡"
                                            className="text-center text-xl"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <Label htmlFor="title">ชื่อ *</Label>
                                        <Input
                                            id="title"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="สงครามมหาเทพครั้งที่ 1"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>ประเภท</Label>
                                        <Select value={type} onValueChange={setType}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LORE_TYPES.map((t) => (
                                                    <SelectItem key={t.value} value={t.value}>
                                                        {t.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>สี</Label>
                                        <Select value={color} onValueChange={setColor}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {COLORS.map((c) => (
                                                    <SelectItem key={c.value} value={c.value}>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.value }} />
                                                            {c.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label htmlFor="content">เนื้อหา</Label>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleExtractIdeas}
                                            disabled={isExtracting || !content.trim()}
                                            className="h-7 text-xs border-dashed border-primary/50 text-primary hover:bg-primary/10"
                                        >
                                            {isExtracting ? (
                                                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                            ) : (
                                                <BrainCircuit className="w-3 h-3 mr-1.5" />
                                            )}
                                            ✨ AI สกัดไอเดีย & สร้าง Idea Pool
                                        </Button>
                                    </div>
                                    <LoreRichEditor
                                        value={content}
                                        onChange={setContent}
                                        mentionItems={mentionItems}
                                    />
                                    
                                    {extractedIdeas.length > 0 && (
                                        <FloatingIdeaPool ideas={extractedIdeas} />
                                    )}

                                    {(foundCharacters.length > 0 || foundLocations.length > 0 || foundItems.length > 0) && (
                                        <div className="mt-4 flex flex-wrap gap-2 items-center bg-muted/50 p-2.5 rounded-lg border border-dashed text-sm">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            <span className="font-medium text-foreground">เอนทิตีในระบบที่พบ:</span>
                                            {foundCharacters.map(id => {
                                                const c = characters.find(x => x.id === id);
                                                return c ? <span key={id} className="px-2.5 py-0.5 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20">👤 {c.name}</span> : null;
                                            })}
                                            {foundLocations.map(id => {
                                                const l = locations.find(x => x.id === id);
                                                return l ? <span key={id} className="px-2.5 py-0.5 bg-green-500/10 text-green-500 rounded-full border border-green-500/20">📍 {l.name}</span> : null;
                                            })}
                                            {/* Note: items are not currently loaded in lore-dialog.tsx, so we just show count or generic tag if we don't have the item names fetched */}
                                            {foundItems.length > 0 && (
                                                <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20">📦 พบไอเท็ม {foundItems.length} ชิ้น</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <Label>ความสำคัญ: {importance}</Label>
                                    <Slider
                                        value={[importance]}
                                        onValueChange={([v]) => setImportance(v)}
                                        min={1}
                                        max={10}
                                        step={1}
                                        className="mt-2"
                                    />
                                </div>
                            </TabsContent>

                            {/* Timeline Tab */}
                            <TabsContent value="timeline" className="space-y-4 mt-4">
                                {/* Era Selection */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        ยุคสมัย
                                    </Label>
                                    <div className="flex gap-2">
                                        <Select value={eraId} onValueChange={setEraId}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="เลือกยุคสมัย..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">ไม่ระบุยุค</SelectItem>
                                                {eras.map((era) => (
                                                    <SelectItem key={era.id} value={era.id}>
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: era.color || "#8b5cf6" }}
                                                            />
                                                            {era.icon || "⏳"} {era.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setEraDialogOpen(true)}
                                            title="สร้างยุคใหม่"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        เลือกยุคสมัยที่ Lore นี้เกิดขึ้น หรือสร้างยุคใหม่
                                    </p>
                                </div>

                                {/* Scope Selection */}
                                <div className="space-y-2">
                                    <Label>ขอบเขต</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={scope === "world" ? "default" : "outline"}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => {
                                                setScope("world");
                                                setLocationId("");
                                            }}
                                        >
                                            <Globe className="h-4 w-4 mr-2" />
                                            🌍 Lore ของโลก
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={scope === "location" ? "default" : "outline"}
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => setScope("location")}
                                        >
                                            <MapPin className="h-4 w-4 mr-2" />
                                            📍 Lore ของสถานที่
                                        </Button>
                                    </div>
                                </div>

                                {/* Location Select */}
                                {scope === "location" && (
                                    <div className="space-y-2">
                                        <Label>สถานที่ *</Label>
                                        <Select value={locationId} onValueChange={setLocationId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="เลือกสถานที่..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {locations.map((loc) => (
                                                    <SelectItem key={loc.id} value={loc.id}>
                                                        {loc.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </TabsContent>

                            {/* Hierarchy Tab */}
                            <TabsContent value="hierarchy" className="space-y-4 mt-4">
                                {/* Parent Lore (Sub-lore) */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <FolderTree className="h-4 w-4" />
                                        Lore แม่ (สำหรับ Sub-lore)
                                    </Label>
                                    <Select value={parentLoreId} onValueChange={setParentLoreId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="ไม่มี (เป็น Lore หลัก)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">ไม่มี (เป็น Lore หลัก)</SelectItem>
                                            {loreEntries.map((lore) => (
                                                <SelectItem key={lore.id} value={lore.id}>
                                                    {lore.icon || "📜"} {lore.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        เลือก Lore แม่เพื่อทำให้ Lore นี้เป็น Sub-lore
                                    </p>
                                </div>

                                {/* Group */}
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Layers className="h-4 w-4" />
                                        กลุ่ม
                                    </Label>
                                    <Select value={groupId} onValueChange={setGroupId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="ไม่มีกลุ่ม" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">ไม่มีกลุ่ม</SelectItem>
                                            {loreGroups.map((group) => (
                                                <SelectItem key={group.id} value={group.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: group.color || "#6366f1" }}
                                                        />
                                                        {group.icon || "📁"} {group.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        จัดกลุ่ม Lore ไว้ด้วยกันเพื่อการจัดการที่ง่ายขึ้น
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEdit ? "บันทึก" : "สร้าง"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Era Dialog */}
            <EraDialog
                open={eraDialogOpen}
                onOpenChange={setEraDialogOpen}
                novelId={novelId}
                onSuccess={fetchData}
            />
        </>
    );
}

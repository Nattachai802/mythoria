"use client";

import { useEffect, useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    Clock, Globe, MapPin, Sparkles, Pencil, X, 
    Layers, Star, BrainCircuit, Loader2, Plus 
} from "lucide-react";
import { updateLoreEntry } from "@/server/lore";
import { createIdea, updateIdea } from "@/server/idea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LoreEntry {
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
    location?: { name: string } | null;
    era?: { id: string; name: string; color: string; icon?: string } | null;
    group?: { id: string; name: string; color: string; icon?: string } | null;
    relatedCharacterIds?: any | null;
    relatedLocationIds?: any | null;
    relatedItemIds?: any | null;
}

interface LoreDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: LoreEntry | null;
    novelId: string;
    characters?: { id: string; name: string }[];
    locations?: { id: string; name: string }[];
    items?: { id: string; name: string }[];
    ideas?: any[];
    onEdit: () => void;
    onSuccess?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
    event: "⚡",
    legend: "📜",
    prophecy: "🔮",
    mythology: "🐉",
    history: "📚",
};

const TYPE_LABELS: Record<string, string> = {
    event: "เหตุการณ์",
    legend: "ตำนาน",
    prophecy: "คำทำนาย",
    mythology: "ตำนานเทพ",
    history: "ประวัติศาสตร์",
};

function stripHtml(html: string | null | undefined): string {
    if (!html) return "";
    let text = html.replace(/<[^>]*>/g, "");
    // Decode common entities
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    return text.trim();
}

export function LoreDetailDialog({
    open,
    onOpenChange,
    entry,
    novelId,
    characters = [],
    locations = [],
    items = [],
    ideas = [],
    onEdit,
    onSuccess,
}: LoreDetailDialogProps) {
    const [activeTab, setActiveTab] = useState("basic");
    const [tagInput, setTagInput] = useState("");
    const [isExtracting, setIsExtracting] = useState(false);

    // Local state for linked entities to allow immediate UI updates
    const [localChars, setLocalChars] = useState<string[]>([]);
    const [localLocs, setLocalLocs] = useState<string[]>([]);
    const [localItems, setLocalItems] = useState<string[]>([]);
    const [localIdeaIds, setLocalIdeaIds] = useState<string[]>([]);

    useEffect(() => {
        if (entry) {
            setLocalChars((entry.relatedCharacterIds as string[]) || []);
            setLocalLocs((entry.relatedLocationIds as string[]) || []);
            setLocalItems((entry.relatedItemIds as string[]) || []);
            
            const linkedIdeas = ideas.filter(idea => 
                ((idea.linkedLoreIds as string[]) || []).includes(entry.id)
            );
            setLocalIdeaIds(linkedIdeas.map(i => i.id));
        }
    }, [entry, ideas]);

    if (!entry) return null;

    const entryColor = entry.color || "#8b5cf6";
    const typeLabel = entry.type ? TYPE_LABELS[entry.type] || entry.type : "ทั่วไป";
    const typeIcon = entry.icon || (entry.type ? TYPE_ICONS[entry.type] : "⚡");

    // Map matched full entity data from local states
    const relChars = characters.filter(c => localChars.includes(c.id));
    const relLocs = locations.filter(l => localLocs.includes(l.id));
    const relItems = items.filter(i => localItems.includes(i.id));
    const relIdeas = ideas.filter(idea => localIdeaIds.includes(idea.id));

    // Handle Toggling/Removing entity associations
    const handleToggleChar = async (charId: string) => {
        const isLinked = localChars.includes(charId);
        const nextChars = isLinked 
            ? localChars.filter(id => id !== charId) 
            : [...localChars, charId];
        
        setLocalChars(nextChars);
        await updateLoreEntry(entry.id, { relatedCharacterIds: nextChars });
        onSuccess?.();
    };

    const handleToggleLoc = async (locId: string) => {
        const isLinked = localLocs.includes(locId);
        const nextLocs = isLinked 
            ? localLocs.filter(id => id !== locId) 
            : [...localLocs, locId];
        
        setLocalLocs(nextLocs);
        await updateLoreEntry(entry.id, { relatedLocationIds: nextLocs });
        onSuccess?.();
    };

    const handleToggleItem = async (itemId: string) => {
        const isLinked = localItems.includes(itemId);
        const nextItems = isLinked 
            ? localItems.filter(id => id !== itemId) 
            : [...localItems, itemId];
        
        setLocalItems(nextItems);
        await updateLoreEntry(entry.id, { relatedItemIds: nextItems });
        onSuccess?.();
    };

    const handleToggleIdea = async (ideaId: string) => {
        const isLinked = localIdeaIds.includes(ideaId);
        const nextIdeaIds = isLinked 
            ? localIdeaIds.filter(id => id !== ideaId) 
            : [...localIdeaIds, ideaId];
        
        setLocalIdeaIds(nextIdeaIds);
        
        const targetIdea = ideas.find(i => i.id === ideaId);
        if (targetIdea) {
            const currentLoreIds = (targetIdea.linkedLoreIds as string[]) || [];
            const nextLoreIds = isLinked 
                ? currentLoreIds.filter(id => id !== entry.id)
                : [...currentLoreIds, entry.id];
            await updateIdea(ideaId, { linkedLoreIds: nextLoreIds });
        }
        onSuccess?.();
    };

    const handleCreateCustomTag = async (title: string) => {
        if (!title.trim()) return;
        
        // Prevent duplicate ideas
        const existingIdea = ideas.find(i => i.title.toLowerCase() === title.trim().toLowerCase());
        if (existingIdea) {
            await handleToggleIdea(existingIdea.id);
            setTagInput("");
            return;
        }

        const res = await createIdea({
            title: title.trim(),
            category: "worldbuilding",
            novelId,
            linkedLoreIds: [entry.id]
        });
        if (res.success && res.data) {
            toast.success(`สร้างและเพิ่มแท็ก "${title}" สำเร็จ`);
            setLocalIdeaIds(prev => [...prev, res.data.id]);
            setTagInput("");
            onSuccess?.();
        } else {
            toast.error("สร้างแท็กไม่สำเร็จ");
        }
    };

    // AI extraction directly inside the view dialog
    const handleExtractAI = async () => {
        if (!entry.content) return;
        setIsExtracting(true);
        try {
            const res = await fetch(`/api/novel/${novelId}/lore/extract-entities`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: entry.content })
            });

            const data = await res.json();
            if (res.ok) {
                // Link detected characters
                const matchedCharIds = (data.foundCharacters || []) as string[];
                const nextChars = Array.from(new Set([...localChars, ...matchedCharIds]));
                if (matchedCharIds.length > 0) {
                    setLocalChars(nextChars);
                    await updateLoreEntry(entry.id, { relatedCharacterIds: nextChars });
                }

                // Link detected locations
                const matchedLocIds = (data.foundLocations || []) as string[];
                const nextLocs = Array.from(new Set([...localLocs, ...matchedLocIds]));
                if (matchedLocIds.length > 0) {
                    setLocalLocs(nextLocs);
                    await updateLoreEntry(entry.id, { relatedLocationIds: nextLocs });
                }

                // Link detected items
                const matchedItemIds = (data.foundItems || []) as string[];
                const nextItems = Array.from(new Set([...localItems, ...matchedItemIds]));
                if (matchedItemIds.length > 0) {
                    setLocalItems(nextItems);
                    await updateLoreEntry(entry.id, { relatedItemIds: nextItems });
                }

                // Link detected ideas
                const insertedIdeas = (data.insertedIdeas || []) as any[];
                if (insertedIdeas.length > 0) {
                    setLocalIdeaIds(prev => Array.from(new Set([...prev, ...insertedIdeas.map(i => i.id)])));
                    await Promise.all(insertedIdeas.map(async (i) => {
                        const currentLoreIds = (i.linkedLoreIds as string[]) || [];
                        if (!currentLoreIds.includes(entry.id)) {
                            await updateIdea(i.id, { linkedLoreIds: [...currentLoreIds, entry.id] });
                        }
                    }));
                }

                toast.success("วิเคราะห์ AI และผูกแท็กเรียบร้อย!");
                onSuccess?.();
            } else {
                toast.error(data.error || "เกิดข้อผิดพลาดในการสกัดข้อมูล");
            }
        } catch (error) {
            toast.error("ไม่สามารถเชื่อมต่อ AI ได้");
        } finally {
            setIsExtracting(false);
        }
    };

    // Suggestions for tag editor
    const tagSuggestions = useMemo(() => {
        const query = tagInput.toLowerCase().trim();
        if (!query) return [];

        const matches: { id: string; name: string; type: "character" | "location" | "item" | "idea" }[] = [];

        characters.forEach(c => {
            if (c.name.toLowerCase().includes(query) && !localChars.includes(c.id)) {
                matches.push({ id: c.id, name: c.name, type: "character" });
            }
        });
        locations.forEach(l => {
            if (l.name.toLowerCase().includes(query) && !localLocs.includes(l.id)) {
                matches.push({ id: l.id, name: l.name, type: "location" });
            }
        });
        items.forEach(item => {
            if (item.name.toLowerCase().includes(query) && !localItems.includes(item.id)) {
                matches.push({ id: item.id, name: item.name, type: "item" });
            }
        });
        ideas.forEach(idea => {
            if (idea.title.toLowerCase().includes(query) && !localIdeaIds.includes(idea.id)) {
                matches.push({ id: idea.id, name: idea.title, type: "idea" });
            }
        });

        return matches.slice(0, 5);
    }, [tagInput, characters, locations, items, ideas, localChars, localLocs, localItems, localIdeaIds]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-[480px] max-h-[85vh] overflow-y-auto p-0 border border-slate-100 dark:border-slate-800 bg-background/95 backdrop-blur-md shadow-2xl">
                {/* Header Section with colored accent */}
                <div 
                    className="relative p-5 pb-3 border-b flex items-start justify-between gap-4"
                    style={{ borderTop: `5px solid ${entryColor}` }}
                >
                    <div className="flex items-start gap-3 w-full">
                        <div 
                            className="w-11 h-11 rounded-lg flex items-center justify-center text-xl shrink-0 shadow-sm"
                            style={{ 
                                background: `linear-gradient(135deg, ${entryColor}15, ${entryColor}25)`,
                                border: `1px solid ${entryColor}30`
                            }}
                        >
                            {typeIcon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge 
                                    variant="outline" 
                                    className="text-[9px] uppercase font-bold border-0 px-1.5 py-0.5"
                                    style={{ color: entryColor, background: `${entryColor}15` }}
                                >
                                    {typeLabel}
                                </Badge>
                                {entry.era && (
                                    <Badge variant="outline" className="text-[9px] font-bold border-slate-200 dark:border-slate-700 bg-muted/30">
                                        <Clock className="w-2 h-2 mr-1" />
                                        {entry.era.name}
                                    </Badge>
                                )}
                                {entry.group && (
                                    <Badge variant="outline" className="text-[9px] font-bold border-slate-200 dark:border-slate-700 bg-muted/30">
                                        <Layers className="w-2 h-2 mr-1" />
                                        {entry.group.name}
                                    </Badge>
                                )}
                            </div>
                            <DialogTitle className="text-base font-bold text-foreground mt-1 leading-snug truncate">
                                {entry.title}
                            </DialogTitle>
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-lg">
                            <TabsTrigger value="basic" className="text-xs">เนื้อหาหลัก</TabsTrigger>
                            <TabsTrigger value="tags" className="text-xs flex items-center gap-1">
                                แท็ก & AI 
                                {(relChars.length + relLocs.length + relItems.length + relIdeas.length) > 0 && (
                                    <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full px-1.5 py-0.2 text-[10px] font-bold">
                                        {relChars.length + relLocs.length + relItems.length + relIdeas.length}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Basic Info Tab */}
                        <TabsContent value="basic" className="space-y-4 mt-4 outline-none">
                            {entry.content ? (
                                <div className="space-y-1.5">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">เนื้อหาหลัก / รายละเอียด</h4>
                                    <div className="p-3 rounded-lg bg-muted/20 border border-muted/50 leading-relaxed text-xs text-foreground/90 whitespace-pre-wrap max-h-[160px] overflow-y-auto">
                                        {stripHtml(entry.content)}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">ไม่มีเนื้อหารายละเอียดสำหรับตำนานนี้</p>
                            )}

                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1 p-2.5 rounded-lg border bg-muted/5">
                                    <span className="text-[10px] font-medium text-muted-foreground">ขอบเขต / สถานที่</span>
                                    <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold">
                                        {entry.scope === "location" && entry.location ? (
                                            <>
                                                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                                                <span className="truncate">สถานที่: {entry.location.name}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Globe className="w-3.5 h-3.5 text-blue-500" />
                                                <span>ขอบเขต: ระดับโลก (World Lore)</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1 p-2.5 rounded-lg border bg-muted/5">
                                    <span className="text-[10px] font-medium text-muted-foreground">ระดับความสำคัญ</span>
                                    <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold">
                                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                        <span>ระดับ {entry.importance || 5} / 10</span>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Tags & AI Tab */}
                        <TabsContent value="tags" className="space-y-4 mt-4 outline-none">
                            {/* AI Extraction Button */}
                            <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-dashed bg-amber-50/20 dark:bg-amber-950/5">
                                <div className="min-w-0">
                                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">สกัดแท็กด้วย AI</h5>
                                    <p className="text-[10px] text-muted-foreground">ใช้ AI ตรวจสอบตัวละคร สถานที่ หรือไอเดียใหม่จากเนื้อหา</p>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={handleExtractAI}
                                    disabled={isExtracting || !entry.content}
                                    className="h-8 border-amber-300/60 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-700 dark:text-amber-400 shrink-0 gap-1"
                                >
                                    {isExtracting ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <BrainCircuit className="w-3.5 h-3.5" />
                                    )}
                                    วิเคราะห์
                                </Button>
                            </div>

                            {/* Tag Input Field (Write custom tag) */}
                            <div className="space-y-1.5 relative">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">เขียนแท็กใหม่ หรือค้นหาในระบบ</label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="พิมพ์ชื่อแท็ก เช่น นักเวท, เมืองหลวง..."
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleCreateCustomTag(tagInput);
                                            }
                                        }}
                                        className="h-8 text-xs"
                                    />
                                    <Button 
                                        size="sm"
                                        onClick={() => handleCreateCustomTag(tagInput)}
                                        disabled={!tagInput.trim()}
                                        className="h-8 px-2.5 shrink-0"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Suggestions Dropdown */}
                                {tagSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-20 overflow-hidden divide-y">
                                        {tagSuggestions.map(s => (
                                            <button
                                                key={`${s.type}-${s.id}`}
                                                type="button"
                                                onClick={async () => {
                                                    if (s.type === "character") await handleToggleChar(s.id);
                                                    if (s.type === "location") await handleToggleLoc(s.id);
                                                    if (s.type === "item") await handleToggleItem(s.id);
                                                    if (s.type === "idea") await handleToggleIdea(s.id);
                                                    setTagInput("");
                                                }}
                                                className="w-full text-left px-3 py-1.5 hover:bg-muted text-xs flex items-center justify-between"
                                            >
                                                <span>
                                                    {s.type === "character" ? "👤" : s.type === "location" ? "📍" : s.type === "item" ? "📦" : "💡"} {s.name}
                                                </span>
                                                <span className="text-[9px] uppercase text-muted-foreground tracking-wider font-semibold">
                                                    {s.type === "character" ? "ตัวละคร" : s.type === "location" ? "สถานที่" : s.type === "item" ? "ไอเทม" : "ไอเดีย/แท็ก"}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Current Tags Display with click to remove */}
                            <div className="space-y-3 pt-1">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">แท็กที่ผูกไว้ในตอนนี้</h4>
                                
                                {relChars.length === 0 && relLocs.length === 0 && relItems.length === 0 && relIdeas.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">ยังไม่ได้เชื่อมโยงแท็กใดๆ</p>
                                ) : (
                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                        {/* Characters */}
                                        {relChars.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-muted-foreground font-semibold">👤 ตัวละคร</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {relChars.map(c => (
                                                        <Badge 
                                                            key={c.id} 
                                                            variant="secondary"
                                                            className="text-[10px] py-0.5 pl-2 pr-1.5 bg-blue-50/50 hover:bg-blue-100/50 border border-blue-200/50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/50 flex items-center gap-1 group"
                                                        >
                                                            {c.name}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleToggleChar(c.id)}
                                                                className="opacity-60 hover:opacity-100 hover:text-red-500 rounded-full"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Locations */}
                                        {relLocs.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-muted-foreground font-semibold">📍 สถานที่</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {relLocs.map(l => (
                                                        <Badge 
                                                            key={l.id} 
                                                            variant="secondary"
                                                            className="text-[10px] py-0.5 pl-2 pr-1.5 bg-emerald-50/50 hover:bg-emerald-100/50 border border-emerald-200/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50 flex items-center gap-1 group"
                                                        >
                                                            {l.name}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleToggleLoc(l.id)}
                                                                className="opacity-60 hover:opacity-100 hover:text-red-500 rounded-full"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Items */}
                                        {relItems.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-muted-foreground font-semibold">📦 ไอเทม</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {relItems.map(i => (
                                                        <Badge 
                                                            key={i.id} 
                                                            variant="secondary"
                                                            className="text-[10px] py-0.5 pl-2 pr-1.5 bg-amber-50/50 hover:bg-amber-100/50 border border-amber-200/50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50 flex items-center gap-1 group"
                                                        >
                                                            {i.name}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleToggleItem(i.id)}
                                                                className="opacity-60 hover:opacity-100 hover:text-red-500 rounded-full"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Ideas */}
                                        {relIdeas.length > 0 && (
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-muted-foreground font-semibold">💡 ไอเดีย/แท็กเขียนเอง</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {relIdeas.map(idea => (
                                                        <Badge 
                                                            key={idea.id} 
                                                            variant="secondary"
                                                            className="text-[10px] py-0.5 pl-2 pr-1.5 bg-purple-50/50 hover:bg-purple-100/50 border border-purple-200/50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/50 flex items-center gap-1 group"
                                                        >
                                                            {idea.title}
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleToggleIdea(idea.id)}
                                                                className="opacity-60 hover:opacity-100 hover:text-red-500 rounded-full"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/10 flex items-center justify-between gap-4">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onOpenChange(false)}
                    >
                        ปิด
                    </Button>
                    <Button 
                        size="sm"
                        onClick={() => {
                            onOpenChange(false);
                            onEdit();
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1.5"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        แก้ไข Lore
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus, MoreHorizontal, Pencil, Trash2, Copy,
    Layers, ChevronDown, ChevronRight as ChevronRightIcon, MapPin,
    FolderPlus, Clock, X, Menu, BookOpen, Download, Search, FilterX, Sparkles
} from "lucide-react";
import { deleteLoreEntry } from "@/server/lore";
import { toast } from "sonner";
import { LoreDialog } from "./lore-dialog";
import { LoreGroupDialog } from "./lore-group-dialog";
import { LoreVisualTimeline } from "./lore-visual-timeline";

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
    orderIndex?: number | null;
    location?: { name: string } | null;
    era?: { id: string; name: string; color: string; icon?: string } | null;
    parentLore?: LoreEntry | null;
    childLores?: LoreEntry[];
    group?: { id: string; name: string; color: string; icon?: string } | null;
}

interface LoreGroup {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    loreEntries?: LoreEntry[];
}

interface Era {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    orderIndex?: number | null;
    loreEntries?: LoreEntry[];
}

interface LoreTimelineProps {
    entries: LoreEntry[];
    groups?: LoreGroup[];
    eras?: Era[];
    novelId: string;
    onRefresh?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
    event: "⚡",
    legend: "📜",
    prophecy: "🔮",
    mythology: "🐉",
    history: "📚",
};

const TYPE_COLORS: Record<string, string> = {
    event: "#f59e0b",
    legend: "#8b5cf6",
    prophecy: "#ec4899",
    mythology: "#10b981",
    history: "#3b82f6",
};

// Type labels for Thai display
const TYPE_LABELS: Record<string, string> = {
    event: "เหตุการณ์",
    legend: "ตำนาน",
    prophecy: "คำทำนาย",
    mythology: "เทพนิยาย",
    history: "ประวัติศาสตร์",
};

export function LoreTimeline({ entries, groups = [], eras = [], novelId, onRefresh }: LoreTimelineProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<LoreEntry | null>(null);
    const [editGroup, setEditGroup] = useState<LoreGroup | null>(null);
    const [defaultParentLoreId, setDefaultParentLoreId] = useState<string | null>(null);
    const [defaultGroupId, setDefaultGroupId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<"timeline" | "hierarchy" | "groups" | "eras">("timeline");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    // Search and Filter states
    const [searchQuery, setSearchQuery] = useState("");
    const [filterEra, setFilterEra] = useState<string>("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [filterImportance, setFilterImportance] = useState<string>("all");

    // Check if any filter is active
    const hasActiveFilters = searchQuery || filterEra !== "all" || filterType !== "all" || filterImportance !== "all";

    // Clear all filters
    const clearFilters = () => {
        setSearchQuery("");
        setFilterEra("all");
        setFilterType("all");
        setFilterImportance("all");
    };

    // Filter entries based on search and filters
    const filteredEntries = useMemo(() => {
        return entries.filter(entry => {
            // Search by title or content
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchTitle = entry.title.toLowerCase().includes(query);
                const matchContent = entry.content?.toLowerCase().includes(query);
                if (!matchTitle && !matchContent) return false;
            }
            // Filter by Era
            if (filterEra !== "all" && entry.eraId !== filterEra) {
                return false;
            }
            // Filter by Type
            if (filterType !== "all" && entry.type !== filterType) {
                return false;
            }
            // Filter by Importance
            if (filterImportance !== "all") {
                const importance = entry.importance || 0;
                if (filterImportance === "high" && importance < 7) return false;
                if (filterImportance === "medium" && (importance < 4 || importance > 6)) return false;
                if (filterImportance === "low" && importance > 3) return false;
            }
            return true;
        });
    }, [entries, searchQuery, filterEra, filterType, filterImportance]);

    const rootEntries = filteredEntries.filter(e => !e.parentLoreId);
    const ungroupedEntries = filteredEntries.filter(e => !e.groupId && !e.parentLoreId);
    const loresWithoutEra = filteredEntries.filter(e => !e.eraId && !e.parentLoreId);

    const handleEdit = (entry: LoreEntry) => {
        setEditEntry(entry);
        setDefaultParentLoreId(null);
        setDefaultGroupId(null);
        setDialogOpen(true);
    };

    const handleAddSubLore = (parentId: string) => {
        setEditEntry(null);
        setDefaultParentLoreId(parentId);
        setDefaultGroupId(null);
        setDialogOpen(true);
    };

    const handleAddToGroup = (groupId: string) => {
        setEditEntry(null);
        setDefaultParentLoreId(null);
        setDefaultGroupId(groupId);
        setDialogOpen(true);
    };

    const handleEditGroup = (group: LoreGroup) => {
        setEditGroup(group);
        setGroupDialogOpen(true);
    };

    const handleDelete = async (entry: LoreEntry) => {
        if (!confirm(`ลบ "${entry.title}" ใช่หรือไม่?`)) return;
        const result = await deleteLoreEntry(entry.id);
        if (result.success) {
            toast.success("ลบตำนานสำเร็จ");
            onRefresh?.();
        } else {
            toast.error(result.error || "ไม่สามารถลบได้");
        }
    };

    const getFormattedLoreText = (entry: LoreEntry, depth: number = 0): string => {
        const indent = "  ".repeat(depth);
        const prefix = depth > 0 ? `${indent}• ` : "";
        let text = `${prefix}${entry.title}`;
        if (entry.content) {
            if (depth === 0) {
                text += `\n\n${entry.content}`;
            } else {
                const indentedContent = entry.content
                    .split("\n")
                    .map(line => `${indent}  ${line}`)
                    .join("\n");
                text += `\n${indentedContent}`;
            }
        }
        
        const children = entries.filter(e => e.parentLoreId === entry.id);
        if (children.length > 0) {
            const childrenText = children
                .map(child => getFormattedLoreText(child, depth + 1))
                .join("\n\n");
            text += `\n\n${childrenText}`;
        }
        
        return text;
    };

    const handleCopy = (entry: LoreEntry) => {
        const textToCopy = getFormattedLoreText(entry);
        navigator.clipboard.writeText(textToCopy.trim())
            .then(() => {
                toast.success("คัดลอกตำนานไปยังคลิปบอร์ดแล้ว");
            })
            .catch(() => {
                toast.error("ไม่สามารถคัดลอกได้");
            });
    };

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            setEditEntry(null);
            setDefaultParentLoreId(null);
            setDefaultGroupId(null);
        }
    };

    const handleGroupDialogClose = (open: boolean) => {
        setGroupDialogOpen(open);
        if (!open) setEditGroup(null);
    };

    const handleExportLore = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            novelId,
            totalEntries: entries.length,
            totalGroups: groups.length,
            totalEras: eras.length,
            loreEntries: entries.map(e => ({
                id: e.id,
                title: e.title,
                content: e.content,
                type: e.type,
                icon: e.icon,
                color: e.color,
                importance: e.importance,
                scope: e.scope,
                era: e.era?.name || null,
                location: e.location?.name || null,
                group: e.group?.name || null,
                parentLoreId: e.parentLoreId,
            })),
            groups: groups.map(g => ({
                id: g.id,
                name: g.name,
                description: g.description,
                color: g.color,
                icon: g.icon,
            })),
            eras: eras.map(e => ({
                id: e.id,
                name: e.name,
                description: e.description,
                color: e.color,
                icon: e.icon,
                orderIndex: e.orderIndex,
            })),
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lore-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Export สำเร็จ!');
    };

    const toggleGroup = (groupId: string) => {
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    const getChildLores = (parentId: string) => {
        return entries.filter(e => e.parentLoreId === parentId);
    };

    // Zig-zag Timeline Node (Light Theme)
    const CosmicNode = ({ entry, index }: { entry: LoreEntry; index: number }) => {
        const children = getChildLores(entry.id);
        const hasChildren = children.length > 0;
        const entryColor = entry.color || TYPE_COLORS[entry.type || "event"] || "#8b5cf6";
        const isLeft = index % 2 === 0;
        const isImportant = entry.importance && entry.importance > 7;

        return (
            <div className="relative">
                <div className={`flex items-start gap-4 ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                    {/* Card Side */}
                    <div className={`flex-1 ${isLeft ? 'pr-8' : 'pl-8'}`}>
                        <div
                            className={`group relative cursor-pointer transition-all duration-300 hover:scale-[1.02] ${isLeft ? 'text-right' : 'text-left'}`}
                            onClick={() => handleEdit(entry)}
                        >
                            {/* Connection Line */}
                            <svg
                                className={`absolute top-6 ${isLeft ? 'right-0' : 'left-0'} w-8 h-8 overflow-visible`}
                                style={{ transform: isLeft ? 'none' : 'scaleX(-1)' }}
                            >
                                <path
                                    d="M 0 16 Q 16 16 32 16"
                                    fill="none"
                                    stroke={entryColor}
                                    strokeWidth="2"
                                    strokeOpacity="0.4"
                                    className="transition-all group-hover:stroke-opacity-80"
                                />
                            </svg>

                            {/* Glass Card - Light Theme */}
                            <div
                                className="relative rounded-xl overflow-hidden backdrop-blur-sm border transition-all duration-300"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    borderColor: `${entryColor}40`,
                                    boxShadow: isImportant
                                        ? `0 0 25px ${entryColor}25, 0 4px 20px rgba(0,0,0,0.08)`
                                        : '0 4px 20px rgba(0,0,0,0.06)',
                                }}
                            >
                                {/* Glow on hover */}
                                <div
                                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                                    style={{ boxShadow: `0 0 25px ${entryColor}30` }}
                                />

                                {/* Top accent line */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                                    style={{ background: `linear-gradient(90deg, transparent, ${entryColor}, transparent)` }}
                                />

                                <div className="p-4 pt-5">
                                    {/* Header */}
                                    <div className={`flex items-center gap-3 ${isLeft ? 'flex-row-reverse' : ''}`}>
                                        <div
                                            className="min-w-12 h-12 px-3 rounded-lg flex items-center justify-center text-2xl shrink-0"
                                            style={{
                                                background: `linear-gradient(135deg, ${entryColor}20, ${entryColor}10)`,
                                                border: `1px solid ${entryColor}30`,
                                            }}
                                        >
                                            {entry.icon || TYPE_ICONS[entry.type || "event"] || "⚡"}
                                        </div>
                                        <div className={`flex-1 min-w-0 ${isLeft ? 'text-right' : 'text-left'}`}>
                                            <h3
                                                className="font-bold text-base text-slate-800 line-clamp-1"
                                                style={{ fontFamily: 'Georgia, serif' }}
                                            >
                                                {entry.title}
                                            </h3>
                                            <div className={`flex items-center gap-2 mt-1 flex-wrap ${isLeft ? 'justify-end' : 'justify-start'}`}>
                                                {entry.type && (
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] h-5 capitalize border-0"
                                                        style={{ color: entryColor, background: `${entryColor}15` }}
                                                    >
                                                        {entry.type}
                                                    </Badge>
                                                )}
                                                {entry.era && (
                                                    <Badge variant="outline" className="text-[10px] h-5 border-slate-200 text-slate-500">
                                                        <Clock className="h-2.5 w-2.5 mr-1" />
                                                        {entry.era.name}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    {entry.content && (
                                        <p className={`text-sm text-slate-600 line-clamp-2 mt-3 ${isLeft ? 'text-right' : 'text-left'}`}>
                                            {entry.content}
                                        </p>
                                    )}

                                    {/* Footer */}
                                    <div className={`flex items-center gap-2 mt-3 ${isLeft ? 'justify-end' : 'justify-start'}`}>
                                        {entry.scope === "location" && entry.location && (
                                            <Badge variant="secondary" className="text-[10px] h-5 bg-slate-100 text-slate-600 border-0">
                                                <MapPin className="h-2.5 w-2.5 mr-1" />
                                                {entry.location.name}
                                            </Badge>
                                        )}
                                        {hasChildren && (
                                            <Badge
                                                className="text-[10px] h-5 border-0"
                                                style={{ background: `${entryColor}20`, color: entryColor }}
                                            >
                                                {children.length} เหตุการณ์ย่อย
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className={`absolute top-2 ${isLeft ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-full bg-white hover:bg-slate-100 text-slate-600 shadow-sm border"
                                            onClick={(e) => { e.stopPropagation(); handleAddSubLore(entry.id); }}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 rounded-full bg-white hover:bg-slate-100 text-slate-600 shadow-sm border"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                                    <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleCopy(entry)}>
                                                    <Copy className="h-4 w-4 mr-2" /> คัดลอก
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleAddSubLore(entry.id)}>
                                                    <Plus className="h-4 w-4 mr-2" /> เพิ่ม Sub-lore
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDelete(entry)} className="text-red-600">
                                                    <Trash2 className="h-4 w-4 mr-2" /> ลบ
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Center Node */}
                    <div className="relative z-10 shrink-0">
                        <div
                            className="min-w-10 h-10 px-2 rounded-full flex items-center justify-center text-lg border-2 bg-white transition-all duration-300 hover:scale-110"
                            style={{
                                borderColor: entryColor,
                                boxShadow: `0 0 15px ${entryColor}40, 0 2px 8px rgba(0,0,0,0.1)`
                            }}
                        >
                            {entry.icon || TYPE_ICONS[entry.type || "event"] || "⚡"}
                        </div>
                    </div>

                    {/* Empty Side */}
                    <div className="flex-1" />
                </div>

                {/* Sub-lores */}
                {hasChildren && (
                    <div className={`relative mt-2 mb-4 ${isLeft ? 'mr-[calc(50%+1.25rem)] pr-8' : 'ml-[calc(50%+1.25rem)] pl-8'}`}>
                        <svg
                            className={`absolute top-0 ${isLeft ? 'right-[calc(100%-2rem)]' : 'left-[calc(100%-2rem)]'} w-8 h-full overflow-visible`}
                            style={{ transform: isLeft ? 'none' : 'scaleX(-1)' }}
                        >
                            <path
                                d={`M 32 0 Q 16 0 16 20 L 16 ${children.length * 60}`}
                                fill="none"
                                stroke={entryColor}
                                strokeWidth="1.5"
                                strokeOpacity="0.25"
                                strokeDasharray="4 4"
                            />
                        </svg>

                        <div className="space-y-2">
                            {children.map((child) => {
                                const childColor = child.color || entryColor;
                                return (
                                    <div
                                        key={child.id}
                                        className="group relative cursor-pointer"
                                        onClick={() => handleEdit(child)}
                                    >
                                        <div
                                            className={`absolute top-3 ${isLeft ? '-right-6' : '-left-6'} w-3 h-3 rounded-full border bg-white`}
                                            style={{ borderColor: childColor, boxShadow: `0 0 6px ${childColor}30` }}
                                        />

                                        <div
                                            className={`rounded-lg p-3 border transition-all duration-200 hover:shadow-md bg-white ${isLeft ? 'pl-8' : 'pr-8'}`}
                                            style={{ borderColor: `${childColor}25` }}
                                        >
                                            {/* Action buttons for sub-lore */}
                                            <div className={`absolute top-2.5 ${isLeft ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 rounded-full bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-700 shadow-sm border shrink-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(child);
                                                    }}
                                                >
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            <div className={`flex items-center gap-2 ${isLeft ? 'flex-row-reverse' : ''}`}>
                                                <span className="text-base">{child.icon || TYPE_ICONS[child.type || "event"] || "⚡"}</span>
                                                <span className="font-medium text-sm text-slate-700 line-clamp-1">{child.title}</span>
                                                {getChildLores(child.id).length > 0 && (
                                                    <Badge
                                                        className="text-[9px] h-4 px-1 border-0"
                                                        style={{ background: `${childColor}20`, color: childColor }}
                                                    >
                                                        +{getChildLores(child.id).length}
                                                    </Badge>
                                                )}
                                            </div>
                                            {child.content && (
                                                <p className={`text-xs text-slate-500 line-clamp-1 mt-1 ${isLeft ? 'text-right' : ''}`}>
                                                    {child.content}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderLoreCard = (entry: LoreEntry) => {
        const children = getChildLores(entry.id);
        const hasChildren = children.length > 0;
        const entryColor = entry.color || TYPE_COLORS[entry.type || "event"] || "#8b5cf6";

        return (
            <div key={entry.id} className="space-y-2">
                <Card className="hover:shadow-lg transition-shadow overflow-hidden" style={{ borderLeftColor: entryColor, borderLeftWidth: "4px" }}>
                    <CardContent className="pt-4 pb-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl shrink-0" style={{ backgroundColor: `${entryColor}20` }}>
                                    {entry.icon || TYPE_ICONS[entry.type || "event"] || "⚡"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-medium line-clamp-1">{entry.title}</h4>
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {entry.era && <Badge variant="outline" className="text-xs">{entry.era.name}</Badge>}
                                        {entry.scope === "location" && entry.location && (
                                            <Badge variant="secondary" className="text-xs gap-1"><MapPin className="h-3 w-3" />{entry.location.name}</Badge>
                                        )}
                                        {hasChildren && (
                                            <Badge className="text-xs" style={{ backgroundColor: `${entryColor}20`, color: entryColor }}>{children.length} sub-lore</Badge>
                                        )}
                                    </div>
                                    {entry.content && <p className="text-sm text-muted-foreground line-clamp-2 mt-2">{entry.content}</p>}
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(entry)}><Pencil className="h-4 w-4 mr-2" /> แก้ไข</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCopy(entry)}><Copy className="h-4 w-4 mr-2" /> คัดลอก</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddSubLore(entry.id)}><Plus className="h-4 w-4 mr-2" /> เพิ่ม Sub-lore</DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDelete(entry)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" /> ลบ</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">ประวัติศาสตร์และตำนาน</h3>
                <div className="flex border rounded-lg overflow-hidden">
                    <Button variant={viewMode === "timeline" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("timeline")}>Timeline</Button>
                    <Button variant={viewMode === "hierarchy" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("hierarchy")}>Hierarchy</Button>
                    <Button variant={viewMode === "groups" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("groups")}>Groups</Button>
                    <Button variant={viewMode === "eras" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("eras")}><Clock className="h-3 w-3 mr-1" />Eras</Button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg border">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหา Lore..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 bg-white"
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setSearchQuery("")}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>

                {/* Era Filter */}
                <Select value={filterEra} onValueChange={setFilterEra}>
                    <SelectTrigger className="w-[140px] h-9 bg-white">
                        <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="ยุคสมัย" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทุกยุค</SelectItem>
                        {eras.map((era) => (
                            <SelectItem key={era.id} value={era.id}>
                                <span className="flex items-center gap-1.5">
                                    <span>{era.icon || "📅"}</span>
                                    <span>{era.name}</span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[140px] h-9 bg-white">
                        <Layers className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทุกประเภท</SelectItem>
                        {Object.entries(TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                                <span className="flex items-center gap-1.5">
                                    <span>{TYPE_ICONS[key]}</span>
                                    <span>{label}</span>
                                </span>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Importance Filter */}
                <Select value={filterImportance} onValueChange={setFilterImportance}>
                    <SelectTrigger className="w-[140px] h-9 bg-white">
                        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue placeholder="ความสำคัญ" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        <SelectItem value="high">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span>สูง (7-10)</span>
                            </span>
                        </SelectItem>
                        <SelectItem value="medium">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span>กลาง (4-6)</span>
                            </span>
                        </SelectItem>
                        <SelectItem value="low">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                <span>ต่ำ (1-3)</span>
                            </span>
                        </SelectItem>
                    </SelectContent>
                </Select>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-9 text-muted-foreground hover:text-foreground"
                    >
                        <FilterX className="h-4 w-4 mr-1.5" />
                        ล้าง
                    </Button>
                )}

                {/* Results count */}
                {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-auto">
                        พบ {filteredEntries.length} รายการ
                    </Badge>
                )}
            </div>

            {/* Content */}
            {entries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <p className="text-lg mb-2">ยังไม่มี Lore</p>
                    <p className="text-sm">เพิ่มตำนาน เหตุการณ์สำคัญ หรือประวัติศาสตร์ของโลก</p>
                </div>
            ) : filteredEntries.length === 0 && hasActiveFilters ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed bg-slate-50/50">
                    <Search className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg mb-2">ไม่พบ Lore ที่ตรงกับการค้นหา</p>
                    <p className="text-sm mb-4">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                        <FilterX className="h-4 w-4 mr-1.5" />
                        ล้างตัวกรองทั้งหมด
                    </Button>
                </div>
            ) : viewMode === "timeline" ? (
                /* Cosmic Archive Timeline - Light Theme */
                <div
                    className="relative rounded-2xl overflow-hidden p-8"
                    style={{
                        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%)',
                    }}
                >
                    {/* Subtle pattern */}
                    <div
                        className="absolute inset-0 opacity-30"
                        style={{
                            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.03) 0%, transparent 50%),
                                            radial-gradient(circle at 75% 75%, rgba(59, 130, 246, 0.03) 0%, transparent 50%)`,
                        }}
                    />

                    {/* Central Line */}
                    <div
                        className="absolute left-1/2 top-8 bottom-8 w-0.5 -translate-x-1/2"
                        style={{
                            background: 'linear-gradient(180deg, transparent, #a78bfa, #60a5fa, #a78bfa, transparent)',
                            boxShadow: '0 0 15px rgba(167, 139, 250, 0.3)',
                        }}
                    />

                    {/* Timeline Items */}
                    <div className="relative space-y-8">
                        {rootEntries.map((entry, index) => (
                            <CosmicNode key={entry.id} entry={entry} index={index} />
                        ))}
                    </div>
                </div>
            ) : viewMode === "hierarchy" ? (
                <div className="space-y-3">{rootEntries.map(entry => renderLoreCard(entry))}</div>
            ) : viewMode === "groups" ? (
                <div className="space-y-4">
                    {groups.map(group => {
                        const groupLores = entries.filter(e => e.groupId === group.id && !e.parentLoreId);
                        return (
                            <Card key={group.id}>
                                <Collapsible open={expandedGroups.has(group.id)} onOpenChange={() => toggleGroup(group.id)}>
                                    <CardHeader className="py-3">
                                        <div className="flex items-center justify-between">
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" className="p-0 h-auto hover:bg-transparent gap-2">
                                                    {expandedGroups.has(group.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
                                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color || "#6366f1" }} />
                                                    <span className="text-lg">{group.icon || "📁"}</span>
                                                    <CardTitle className="text-base">{group.name}</CardTitle>
                                                    <Badge variant="secondary">{groupLores.length}</Badge>
                                                </Button>
                                            </CollapsibleTrigger>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleAddToGroup(group.id)}><Plus className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleEditGroup(group)}><Pencil className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                        {group.description && <p className="text-sm text-muted-foreground pl-6">{group.description}</p>}
                                    </CardHeader>
                                    <CollapsibleContent>
                                        <CardContent className="pt-0 space-y-2">
                                            {groupLores.length === 0 ? (
                                                <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มี Lore ในกลุ่มนี้</p>
                                            ) : (
                                                groupLores.map(entry => renderLoreCard(entry))
                                            )}
                                        </CardContent>
                                    </CollapsibleContent>
                                </Collapsible>
                            </Card>
                        );
                    })}
                    {ungroupedEntries.length > 0 && (
                        <Card>
                            <CardHeader className="py-3">
                                <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="text-base">ไม่มีกลุ่ม</CardTitle>
                                    <Badge variant="secondary">{ungroupedEntries.length}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-0 space-y-2">{ungroupedEntries.map(entry => renderLoreCard(entry))}</CardContent>
                        </Card>
                    )}
                </div>
            ) : (
                <LoreVisualTimeline eras={eras} ungroupedLores={loresWithoutEra} novelId={novelId} onRefresh={onRefresh} />
            )}

            {/* Dialogs */}
            <LoreDialog open={dialogOpen} onOpenChange={handleDialogClose} novelId={novelId} editEntry={editEntry} defaultParentLoreId={defaultParentLoreId} defaultGroupId={defaultGroupId} onSuccess={onRefresh} />
            <LoreGroupDialog open={groupDialogOpen} onOpenChange={handleGroupDialogClose} novelId={novelId} editGroup={editGroup} onSuccess={onRefresh} />

            {/* Floating Action Button */}
            <FloatingLoreFab
                onCreateLore={() => setDialogOpen(true)}
                onCreateGroup={() => setGroupDialogOpen(true)}
                onExport={handleExportLore}
            />
        </div>
    );
}

// Floating Action Button Component
function FloatingLoreFab({ onCreateLore, onCreateGroup, onExport }: { onCreateLore: () => void; onCreateGroup: () => void; onExport: () => void }) {
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!boxRef.current) return;
            if (!boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    const menuItems = [
        { label: "สร้าง Lore ใหม่", action: onCreateLore, Icon: BookOpen, color: "text-blue-600" },
        { label: "สร้างกลุ่ม", action: onCreateGroup, Icon: FolderPlus, color: "text-purple-600" },
        { label: "Export JSON", action: onExport, Icon: Download, color: "text-emerald-600" },
    ];

    return (
        <div
            ref={boxRef}
            className="fixed right-4 bottom-6 z-50 select-none"
            aria-live="polite"
        >
            {/* เมนูที่แตกออกมา */}
            <div
                className={`absolute bottom-16 right-0 mb-2 origin-bottom-right transition-all duration-300 ease-out
                ${open
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-95 pointer-events-none translate-y-3"
                    }`}
            >
                <div className="bg-background rounded-xl shadow-2xl border backdrop-blur-sm overflow-hidden">
                    <div className="p-2">
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            ตัวเลือก
                        </div>
                        <ul className="space-y-1">
                            {menuItems.map((item, idx) => (
                                <li key={idx}>
                                    <button
                                        onClick={() => {
                                            setOpen(false);
                                            item.action();
                                        }}
                                        className="group flex items-center gap-3 px-4 py-3 rounded-lg w-full
                                                   text-sm font-medium text-foreground
                                                   hover:bg-muted
                                                   active:bg-muted active:scale-[0.98]
                                                   transition-all duration-200 ease-out"
                                    >
                                        <span
                                            className={`flex-shrink-0 w-8 h-8 rounded-lg bg-muted 
                                                       flex items-center justify-center
                                                       group-hover:bg-primary group-hover:text-primary-foreground
                                                       transition-all duration-200 ${item.color}`}
                                        >
                                            <item.Icon className="w-4 h-4" />
                                        </span>
                                        <span className="text-left whitespace-nowrap">{item.label}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* ลูกศรชี้ */}
                    <div className="absolute -bottom-1 right-4 w-3 h-3 bg-background border-r border-b 
                                    border-border transform rotate-45 shadow-sm">
                    </div>
                </div>
            </div>

            {/* ปุ่มหลักแบบสี่เหลี่ยม */}
            <button
                type="button"
                aria-expanded={open}
                aria-label="เมนูสร้าง Lore"
                onClick={() => setOpen((v) => !v)}
                className={`relative w-14 h-14 rounded-xl shadow-xl border-2
                flex items-center justify-center
                transition-all duration-300 ease-out active:scale-90 hover:scale-105
                ${open
                        ? "bg-primary border-primary text-primary-foreground shadow-primary/30"
                        : "bg-primary border-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/40"
                    }`}
            >
                {/* Hamburger → X Animation */}
                <div className="relative w-5 h-5 flex flex-col justify-center items-center">
                    <span
                        className={`absolute h-0.5 w-5 bg-current rounded-full transition-all duration-300 ease-out
                            ${open ? "rotate-45 translate-y-0" : "-translate-y-1.5"}`}
                    />
                    <span
                        className={`absolute h-0.5 w-5 bg-current rounded-full transition-all duration-300 ease-out
                            ${open ? "opacity-0 scale-0" : "opacity-100 scale-100"}`}
                    />
                    <span
                        className={`absolute h-0.5 w-5 bg-current rounded-full transition-all duration-300 ease-out
                            ${open ? "-rotate-45 translate-y-0" : "translate-y-1.5"}`}
                    />
                </div>

                {/* Ripple effect */}
                {open && (
                    <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-20" />
                )}
            </button>
        </div>
    );
}

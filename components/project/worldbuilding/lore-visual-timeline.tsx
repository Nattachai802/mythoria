"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Plus, MoreHorizontal, Pencil, Trash2,
    Clock, ChevronDown, ChevronRight, MapPin
} from "lucide-react";
import { deleteLoreEntry } from "@/server/lore";
import { toast } from "sonner";
import { LoreDialog } from "./lore-dialog";

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

interface Era {
    id: string;
    name: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
    orderIndex?: number | null;
    loreEntries?: LoreEntry[];
}

interface LoreVisualTimelineProps {
    eras: Era[];
    ungroupedLores: LoreEntry[];
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

export function LoreVisualTimeline({ eras, ungroupedLores, novelId, onRefresh }: LoreVisualTimelineProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<LoreEntry | null>(null);
    const [defaultEraId, setDefaultEraId] = useState<string | null>(null);
    const [expandedEras, setExpandedEras] = useState<Set<string>>(new Set(eras.map(e => e.id)));

    const handleEdit = (entry: LoreEntry) => {
        setEditEntry(entry);
        setDefaultEraId(null);
        setDialogOpen(true);
    };

    const handleAddToEra = (eraId: string) => {
        setEditEntry(null);
        setDefaultEraId(eraId);
        setDialogOpen(true);
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

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open);
        if (!open) {
            setEditEntry(null);
            setDefaultEraId(null);
        }
    };

    const toggleEra = (eraId: string) => {
        const newExpanded = new Set(expandedEras);
        if (newExpanded.has(eraId)) {
            newExpanded.delete(eraId);
        } else {
            newExpanded.add(eraId);
        }
        setExpandedEras(newExpanded);
    };

    const getChildLores = (entries: LoreEntry[], parentId: string) => {
        return entries.filter(e => e.parentLoreId === parentId);
    };

    const renderLoreCard = (entry: LoreEntry, allEntries: LoreEntry[], depth: number = 0) => {
        const children = getChildLores(allEntries, entry.id);
        const hasChildren = children.length > 0;
        const entryColor = entry.color || TYPE_COLORS[entry.type || "event"] || "#8b5cf6";

        return (
            <div key={entry.id} className="space-y-2">
                <Card
                    className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden border-l-4"
                    style={{
                        borderLeftColor: entryColor,
                        marginLeft: depth * 16,
                    }}
                    onClick={() => handleEdit(entry)}
                >
                    <CardContent className="pt-3 pb-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div
                                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 transition-transform group-hover:scale-110"
                                    style={{ backgroundColor: `${entryColor}20` }}
                                >
                                    {entry.icon || TYPE_ICONS[entry.type || "event"] || "⚡"}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-sm line-clamp-1 text-slate-800">{entry.title}</h4>
                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                        {entry.type && (
                                            <Badge
                                                variant="outline"
                                                className="text-[10px] h-4 capitalize border-0"
                                                style={{ color: entryColor, background: `${entryColor}15` }}
                                            >
                                                {entry.type}
                                            </Badge>
                                        )}
                                        {entry.scope === "location" && entry.location && (
                                            <Badge variant="secondary" className="text-[10px] h-4 gap-0.5">
                                                <MapPin className="h-2.5 w-2.5" />
                                                {entry.location.name}
                                            </Badge>
                                        )}
                                        {hasChildren && (
                                            <Badge
                                                className="text-[10px] h-4 border-0"
                                                style={{ backgroundColor: `${entryColor}20`, color: entryColor }}
                                            >
                                                {children.length} ย่อย
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                        <Pencil className="h-4 w-4 mr-2" /> แก้ไข
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDelete(entry)} className="text-red-600">
                                        <Trash2 className="h-4 w-4 mr-2" /> ลบ
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardContent>
                </Card>

                {/* Render children */}
                {hasChildren && (
                    <div className="space-y-2 border-l-2 border-dashed ml-4" style={{ borderColor: `${entryColor}30` }}>
                        {children.map(child => renderLoreCard(child, allEntries, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // Sort eras by orderIndex
    const sortedEras = [...eras].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

    return (
        <div className="space-y-4">
            {/* Visual Timeline Header */}
            <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-violet-500" />
                <h3 className="text-lg font-semibold">Visual Timeline</h3>
            </div>

            {/* Era Columns - Horizontal Scroll */}
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
                {sortedEras.map((era) => {
                    const eraColor = era.color || "#6366f1";
                    const eraLores = (era.loreEntries || []).filter(e => !e.parentLoreId);

                    return (
                        <div
                            key={era.id}
                            className="flex-shrink-0 w-80 rounded-xl overflow-hidden border shadow-sm"
                            style={{
                                background: `linear-gradient(180deg, ${eraColor}08 0%, white 100%)`,
                                borderColor: `${eraColor}25`,
                            }}
                        >
                            {/* Era Header */}
                            <div
                                className="p-4 border-b"
                                style={{
                                    background: `linear-gradient(135deg, ${eraColor}15 0%, ${eraColor}05 100%)`,
                                    borderColor: `${eraColor}20`,
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => toggleEra(era.id)}
                                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                    >
                                        {expandedEras.has(era.id) ? (
                                            <ChevronDown className="h-4 w-4" style={{ color: eraColor }} />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" style={{ color: eraColor }} />
                                        )}
                                        <span className="text-xl">{era.icon || "📅"}</span>
                                        <h4 className="font-semibold text-slate-800">{era.name}</h4>
                                        <Badge
                                            variant="secondary"
                                            className="text-xs h-5"
                                            style={{ background: `${eraColor}20`, color: eraColor }}
                                        >
                                            {eraLores.length}
                                        </Badge>
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleAddToEra(era.id)}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                                {era.description && (
                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{era.description}</p>
                                )}
                            </div>

                            {/* Era Lores */}
                            {expandedEras.has(era.id) && (
                                <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                                    {eraLores.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400">
                                            <p className="text-sm">ยังไม่มี Lore</p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="mt-2"
                                                onClick={() => handleAddToEra(era.id)}
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                เพิ่ม Lore
                                            </Button>
                                        </div>
                                    ) : (
                                        eraLores.map(entry => renderLoreCard(entry, era.loreEntries || [], 0))
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Ungrouped Lores Column */}
                {ungroupedLores.length > 0 && (
                    <div
                        className="flex-shrink-0 w-80 rounded-xl overflow-hidden border shadow-sm bg-slate-50/50"
                        style={{ borderColor: "#94a3b830" }}
                    >
                        {/* Header */}
                        <div className="p-4 border-b bg-slate-100/50" style={{ borderColor: "#94a3b820" }}>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <h4 className="font-semibold text-slate-600">ไม่ระบุยุค</h4>
                                <Badge variant="secondary" className="text-xs h-5">
                                    {ungroupedLores.length}
                                </Badge>
                            </div>
                        </div>

                        {/* Lores */}
                        <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
                            {ungroupedLores.filter(e => !e.parentLoreId).map(entry =>
                                renderLoreCard(entry, ungroupedLores, 0)
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Dialog */}
            <LoreDialog
                open={dialogOpen}
                onOpenChange={handleDialogClose}
                novelId={novelId}
                editEntry={editEntry}
                defaultEraId={defaultEraId}
                onSuccess={onRefresh}
            />
        </div>
    );
}

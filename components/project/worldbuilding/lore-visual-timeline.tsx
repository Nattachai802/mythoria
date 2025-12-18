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
import { Plus, MoreHorizontal, Pencil, Trash2, MapPin, Globe, ChevronDown, ChevronRight } from "lucide-react";
import { deleteLoreEntry } from "@/server/lore";
import { toast } from "sonner";
import { LoreDialog } from "./lore-dialog";
import { EraDialog } from "./era-dialog";

interface LoreEntry {
    id: string;
    title: string;
    content?: string | null;
    type?: string | null;
    eraId?: string | null;
    scope?: string | null;
    locationId?: string | null;
    parentLoreId?: string | null;
    icon?: string | null;
    color?: string | null;
    importance?: number | null;
    location?: { name: string } | null;
    era?: { id: string; name: string; color: string; icon?: string } | null;
    childLores?: LoreEntry[];
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

export function LoreVisualTimeline({ eras, ungroupedLores, novelId, onRefresh }: LoreVisualTimelineProps) {
    const [loreDialogOpen, setLoreDialogOpen] = useState(false);
    const [eraDialogOpen, setEraDialogOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<LoreEntry | null>(null);
    const [editEra, setEditEra] = useState<Era | null>(null);
    const [defaultEraId, setDefaultEraId] = useState<string | null>(null);
    const [defaultParentLoreId, setDefaultParentLoreId] = useState<string | null>(null);
    const [expandedLores, setExpandedLores] = useState<Set<string>>(new Set());

    const handleEditLore = (entry: LoreEntry) => {
        setEditEntry(entry);
        setDefaultEraId(null);
        setDefaultParentLoreId(null);
        setLoreDialogOpen(true);
    };

    const handleAddLoreToEra = (eraId: string) => {
        setEditEntry(null);
        setDefaultEraId(eraId);
        setDefaultParentLoreId(null);
        setLoreDialogOpen(true);
    };

    const handleAddSubLore = (parentId: string, eraId?: string | null) => {
        setEditEntry(null);
        setDefaultParentLoreId(parentId);
        setDefaultEraId(eraId || null);
        setLoreDialogOpen(true);
    };

    const handleEditEra = (era: Era) => {
        setEditEra(era);
        setEraDialogOpen(true);
    };

    const handleDeleteLore = async (entry: LoreEntry) => {
        if (!confirm(`ลบ "${entry.title}" ใช่หรือไม่?`)) return;

        const result = await deleteLoreEntry(entry.id);
        if (result.success) {
            toast.success("ลบ Lore สำเร็จ");
            onRefresh?.();
        } else {
            toast.error(result.error || "ไม่สามารถลบได้");
        }
    };

    const toggleLore = (loreId: string) => {
        const newExpanded = new Set(expandedLores);
        if (newExpanded.has(loreId)) {
            newExpanded.delete(loreId);
        } else {
            newExpanded.add(loreId);
        }
        setExpandedLores(newExpanded);
    };

    const handleLoreDialogClose = (open: boolean) => {
        setLoreDialogOpen(open);
        if (!open) {
            setEditEntry(null);
            setDefaultEraId(null);
            setDefaultParentLoreId(null);
        }
    };

    const handleEraDialogClose = (open: boolean) => {
        setEraDialogOpen(open);
        if (!open) setEditEra(null);
    };

    // Get child lores from an entry's childLores or from ungrouped list
    const getChildLores = (parentId: string, allLores: LoreEntry[]) => {
        return allLores.filter(l => l.parentLoreId === parentId);
    };

    // Render a lore card
    const renderLoreCard = (entry: LoreEntry, allLores: LoreEntry[], depth: number = 0) => {
        const children = getChildLores(entry.id, allLores);
        const hasChildren = children.length > 0;

        return (
            <div key={entry.id} className="w-full">
                <Card
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    style={{
                        borderLeftColor: entry.color || "#8b5cf6",
                        borderLeftWidth: "3px",
                        marginLeft: depth * 16,
                    }}
                >
                    <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                {hasChildren && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 shrink-0 p-0"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleLore(entry.id);
                                        }}
                                    >
                                        {expandedLores.has(entry.id) ? (
                                            <ChevronDown className="h-4 w-4" />
                                        ) : (
                                            <ChevronRight className="h-4 w-4" />
                                        )}
                                    </Button>
                                )}
                                <div className="min-w-0 flex-1" onClick={() => handleEditLore(entry)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">{entry.icon || TYPE_ICONS[entry.type || "event"] || "⚡"}</span>
                                        <span className="font-medium text-sm line-clamp-1">{entry.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        {entry.scope === "location" && entry.location && (
                                            <Badge variant="outline" className="text-xs gap-0.5 py-0">
                                                <MapPin className="h-2.5 w-2.5" />
                                                {entry.location.name}
                                            </Badge>
                                        )}
                                        {hasChildren && (
                                            <Badge variant="secondary" className="text-xs py-0">
                                                {children.length} sub
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                        <MoreHorizontal className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEditLore(entry)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        แก้ไข
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAddSubLore(entry.id, entry.eraId)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        เพิ่ม Sub-lore
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeleteLore(entry)} className="text-red-600">
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        ลบ
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </CardContent>
                </Card>

                {/* Children */}
                {hasChildren && expandedLores.has(entry.id) && (
                    <div className="space-y-2 mt-2">
                        {children.map(child => renderLoreCard(child, allLores, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">📅 Visual Timeline</h3>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setEraDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        สร้างยุค
                    </Button>
                    <Button onClick={() => setLoreDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        เพิ่ม Lore
                    </Button>
                </div>
            </div>

            {/* Timeline Grid */}
            {eras.length === 0 && ungroupedLores.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <p className="text-lg mb-2">ยังไม่มียุคสมัย</p>
                    <p className="text-sm mb-4">สร้างยุคสมัยเพื่อจัดกลุ่ม Lore ตามช่วงเวลา</p>
                    <Button onClick={() => setEraDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        สร้างยุคแรก
                    </Button>
                </div>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {/* Era Columns */}
                    {eras.map((era) => {
                        const rootLores = (era.loreEntries || []).filter(l => !l.parentLoreId);
                        return (
                            <Card
                                key={era.id}
                                className="flex-shrink-0 w-80"
                                style={{
                                    borderTopColor: era.color || "#8b5cf6",
                                    borderTopWidth: "4px",
                                }}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <span>{era.icon || "⏳"}</span>
                                            {era.name}
                                            <Badge variant="secondary" className="ml-1">
                                                {era.loreEntries?.length || 0}
                                            </Badge>
                                        </CardTitle>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleAddLoreToEra(era.id)}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    เพิ่ม Lore
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleEditEra(era)}>
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    แก้ไขยุค
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    {era.description && (
                                        <p className="text-xs text-muted-foreground">{era.description}</p>
                                    )}
                                </CardHeader>
                                <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {rootLores.length === 0 ? (
                                        <Button
                                            variant="outline"
                                            className="w-full border-dashed"
                                            onClick={() => handleAddLoreToEra(era.id)}
                                        >
                                            <Plus className="h-4 w-4 mr-2" />
                                            เพิ่ม Lore
                                        </Button>
                                    ) : (
                                        rootLores.map(entry => renderLoreCard(entry, era.loreEntries || [], 0))
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}

                    {/* Ungrouped Lores Column */}
                    {ungroupedLores.length > 0 && (
                        <Card className="flex-shrink-0 w-80 border-dashed">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
                                    <Globe className="h-4 w-4" />
                                    ไม่ระบุยุค
                                    <Badge variant="outline">{ungroupedLores.filter(l => !l.parentLoreId).length}</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                                {ungroupedLores
                                    .filter(l => !l.parentLoreId)
                                    .map(entry => renderLoreCard(entry, ungroupedLores, 0))}
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* Dialogs */}
            <LoreDialog
                open={loreDialogOpen}
                onOpenChange={handleLoreDialogClose}
                novelId={novelId}
                editEntry={editEntry}
                defaultEraId={defaultEraId}
                defaultParentLoreId={defaultParentLoreId}
                onSuccess={onRefresh}
            />

            <EraDialog
                open={eraDialogOpen}
                onOpenChange={handleEraDialogClose}
                novelId={novelId}
                editEra={editEra}
                onSuccess={onRefresh}
            />
        </div>
    );
}

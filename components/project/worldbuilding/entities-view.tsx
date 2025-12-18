"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { EntityCard } from "./entity-card";
import { EntityDialog } from "./entity-dialog";

interface EntitiesViewProps {
    entities: any[];
    novelId: string;
    onRefresh?: () => void;
}

export function EntitiesView({ entities, novelId, onRefresh }: EntitiesViewProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editEntity, setEditEntity] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterThreat, setFilterThreat] = useState("all");

    const filteredEntities = entities.filter((entity) => {
        const matchesSearch = entity.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === "all" || entity.type === filterType;
        const matchesThreat = filterThreat === "all" || entity.threatLevel === filterThreat;
        return matchesSearch && matchesType && matchesThreat;
    });

    const handleEdit = (entity: any) => {
        setEditEntity(entity);
        setDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open);
        if (!open) setEditEntity(null);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาสิ่งมีชีวิต..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทุกประเภท</SelectItem>
                        <SelectItem value="creature">🦎 Creature</SelectItem>
                        <SelectItem value="monster">👹 Monster</SelectItem>
                        <SelectItem value="spirit">👻 Spirit</SelectItem>
                        <SelectItem value="beast">🐺 Beast</SelectItem>
                        <SelectItem value="humanoid">🧝 Humanoid</SelectItem>
                        <SelectItem value="plant">🌿 Plant</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterThreat} onValueChange={setFilterThreat}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="ระดับอันตราย" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทุกระดับ</SelectItem>
                        <SelectItem value="harmless">Harmless</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="extreme">Extreme</SelectItem>
                        <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                </Select>

                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    เพิ่มสิ่งมีชีวิต
                </Button>
            </div>

            {/* Entities Grid */}
            {filteredEntities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    {entities.length === 0 ? (
                        <div>
                            <p className="text-lg mb-2">ยังไม่มีสิ่งมีชีวิต</p>
                            <p className="text-sm">เพิ่มมอนสเตอร์ สัตว์วิเศษ หรือสิ่งมีชีวิตอื่นๆ ในโลกของคุณ</p>
                        </div>
                    ) : (
                        <p>ไม่พบสิ่งมีชีวิตที่ตรงกับการค้นหา</p>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredEntities.map((entity) => (
                        <EntityCard
                            key={entity.id}
                            entity={entity}
                            onEdit={handleEdit}
                            onDeleted={onRefresh}
                        />
                    ))}
                </div>
            )}

            {/* Dialog */}
            <EntityDialog
                open={dialogOpen}
                onOpenChange={handleDialogClose}
                novelId={novelId}
                editEntity={editEntity}
                onSuccess={onRefresh}
            />
        </div>
    );
}

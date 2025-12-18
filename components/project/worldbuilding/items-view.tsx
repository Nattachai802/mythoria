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
import { ItemCard } from "./item-card";
import { ItemDialog } from "./item-dialog";

interface ItemsViewProps {
    items: any[];
    novelId: string;
    characters?: { id: string; name: string }[];
    locations?: { id: string; name: string }[];
    onRefresh?: () => void;
}

export function ItemsView({ items, novelId, characters = [], locations = [], onRefresh }: ItemsViewProps) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editItem, setEditItem] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterRarity, setFilterRarity] = useState("all");

    const filteredItems = items.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === "all" || item.type === filterType;
        const matchesRarity = filterRarity === "all" || item.rarity === filterRarity;
        return matchesSearch && matchesType && matchesRarity;
    });

    const handleEdit = (item: any) => {
        setEditItem(item);
        setDialogOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open);
        if (!open) setEditItem(null);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ค้นหาไอเทม..."
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
                        <SelectItem value="artifact">🏺 Artifact</SelectItem>
                        <SelectItem value="weapon">⚔️ Weapon</SelectItem>
                        <SelectItem value="armor">🛡️ Armor</SelectItem>
                        <SelectItem value="potion">🧪 Potion</SelectItem>
                        <SelectItem value="material">💎 Material</SelectItem>
                        <SelectItem value="currency">💰 Currency</SelectItem>
                        <SelectItem value="misc">📦 Misc</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filterRarity} onValueChange={setFilterRarity}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="ความหายาก" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ทุกระดับ</SelectItem>
                        <SelectItem value="common">Common</SelectItem>
                        <SelectItem value="uncommon">Uncommon</SelectItem>
                        <SelectItem value="rare">Rare</SelectItem>
                        <SelectItem value="epic">Epic</SelectItem>
                        <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                </Select>

                <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    สร้างไอเทม
                </Button>
            </div>

            {/* Items Grid */}
            {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    {items.length === 0 ? (
                        <div>
                            <p className="text-lg mb-2">ยังไม่มีไอเทม</p>
                            <p className="text-sm">คลิก "สร้างไอเทม" เพื่อเพิ่มไอเทมแรกของคุณ</p>
                        </div>
                    ) : (
                        <p>ไม่พบไอเทมที่ตรงกับการค้นหา</p>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredItems.map((item) => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            onEdit={handleEdit}
                            onDeleted={onRefresh}
                        />
                    ))}
                </div>
            )}

            {/* Dialog */}
            <ItemDialog
                open={dialogOpen}
                onOpenChange={handleDialogClose}
                novelId={novelId}
                characters={characters}
                locations={locations}
                editItem={editItem}
                onSuccess={onRefresh}
            />
        </div>
    );
}

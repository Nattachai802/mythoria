"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, User, MapPin } from "lucide-react";
import { deleteItem } from "@/server/items";
import { toast } from "sonner";

interface ItemCardProps {
    item: {
        id: string;
        name: string;
        description?: string | null;
        type?: string | null;
        rarity?: string | null;
        icon?: string | null;
        lore?: string | null;
        owner?: { id: string; name: string } | null;
        location?: { id: string; name: string } | null;
    };
    onEdit?: (item: any) => void;
    onDeleted?: () => void;
}

const RARITY_COLORS: Record<string, string> = {
    common: "bg-gray-500",
    uncommon: "bg-green-500",
    rare: "bg-blue-500",
    epic: "bg-purple-500",
    legendary: "bg-yellow-500",
};

const TYPE_ICONS: Record<string, string> = {
    artifact: "🏺",
    weapon: "⚔️",
    armor: "🛡️",
    potion: "🧪",
    material: "💎",
    currency: "💰",
    misc: "📦",
};

export function ItemCard({ item, onEdit, onDeleted }: ItemCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`ลบ "${item.name}" ใช่หรือไม่?`)) return;

        setIsDeleting(true);
        try {
            const result = await deleteItem(item.id);
            if (result.success) {
                toast.success("ลบไอเทมสำเร็จ");
                onDeleted?.();
            } else {
                toast.error(result.error || "ไม่สามารถลบได้");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsDeleting(false);
        }
    };

    const typeIcon = TYPE_ICONS[item.type || "misc"] || "📦";
    const rarityColor = RARITY_COLORS[item.rarity || "common"] || "bg-gray-500";

    return (
        <Card className="group hover:shadow-lg transition-all duration-200 border-l-4" style={{ borderLeftColor: getRarityHex(item.rarity) }}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{item.icon || typeIcon}</span>
                        <div>
                            <CardTitle className="text-lg">{item.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                    {item.type || "misc"}
                                </Badge>
                                <Badge className={`${rarityColor} text-white text-xs`}>
                                    {item.rarity || "common"}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit?.(item)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDelete} disabled={isDeleting} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />
                                ลบ
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardContent>
                {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {item.description}
                    </p>
                )}

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {item.owner && (
                        <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{item.owner.name}</span>
                        </div>
                    )}
                    {item.location && (
                        <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{item.location.name}</span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function getRarityHex(rarity?: string | null): string {
    const colors: Record<string, string> = {
        common: "#6b7280",
        uncommon: "#22c55e",
        rare: "#3b82f6",
        epic: "#a855f7",
        legendary: "#eab308",
    };
    return colors[rarity || "common"] || "#6b7280";
}

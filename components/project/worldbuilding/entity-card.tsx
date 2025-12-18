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
import { MoreHorizontal, Pencil, Trash2, MapPin } from "lucide-react";
import { deleteEntity } from "@/server/entities";
import { toast } from "sonner";

interface EntityCardProps {
    entity: {
        id: string;
        name: string;
        description?: string | null;
        type?: string | null;
        threatLevel?: string | null;
        icon?: string | null;
        color?: string | null;
        habitat?: string | null;
        abilities?: string[] | null;
        locations?: Array<{
            id: string;
            population?: string | null;
            location: { id: string; name: string };
        }>;
    };
    onEdit?: (entity: any) => void;
    onDeleted?: () => void;
}

const THREAT_COLORS: Record<string, string> = {
    harmless: "bg-gray-400",
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    extreme: "bg-red-500",
    legendary: "bg-purple-500",
};

const TYPE_ICONS: Record<string, string> = {
    creature: "🦎",
    monster: "👹",
    spirit: "👻",
    beast: "🐺",
    humanoid: "🧝",
    plant: "🌿",
};

export function EntityCard({ entity, onEdit, onDeleted }: EntityCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`ลบ "${entity.name}" ใช่หรือไม่?`)) return;

        setIsDeleting(true);
        try {
            const result = await deleteEntity(entity.id);
            if (result.success) {
                toast.success("ลบสิ่งมีชีวิตสำเร็จ");
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

    const typeIcon = TYPE_ICONS[entity.type || "creature"] || "🦎";
    const threatColor = THREAT_COLORS[entity.threatLevel || "harmless"] || "bg-gray-400";

    return (
        <Card className="group hover:shadow-lg transition-all duration-200" style={{ borderColor: entity.color || "#ef4444" }}>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">{entity.icon || typeIcon}</span>
                        <div>
                            <CardTitle className="text-lg">{entity.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                    {entity.type || "creature"}
                                </Badge>
                                <Badge className={`${threatColor} text-white text-xs`}>
                                    {entity.threatLevel || "harmless"}
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
                            <DropdownMenuItem onClick={() => onEdit?.(entity)}>
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
                {entity.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {entity.description}
                    </p>
                )}

                {entity.abilities && entity.abilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {(entity.abilities as string[]).slice(0, 3).map((ability, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                                {ability}
                            </Badge>
                        ))}
                        {entity.abilities.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                                +{entity.abilities.length - 3}
                            </Badge>
                        )}
                    </div>
                )}

                {entity.locations && entity.locations.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>
                            {entity.locations.map((l) => l.location.name).join(", ")}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

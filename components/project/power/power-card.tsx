"use client";

import { Power, PowerLevel } from "@/db/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Zap, Star, ChevronRight } from "lucide-react";
import { deletePower } from "@/server/power";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface PowerCardProps {
    power: Power & { levels?: PowerLevel[] };
    novelId: string;
    onEdit?: () => void;
    onClick?: () => void;
}

const rarityColors: Record<string, string> = {
    common: "bg-slate-100 text-slate-700 border-slate-200",
    rare: "bg-blue-100 text-blue-700 border-blue-200",
    epic: "bg-purple-100 text-purple-700 border-purple-200",
    legendary: "bg-amber-100 text-amber-700 border-amber-200",
};

const typeIcons: Record<string, string> = {
    elemental: "🔥",
    physical: "💪",
    mental: "🧠",
    support: "💚",
    special: "✨",
};

export function PowerCard({ power, novelId, onEdit, onClick }: PowerCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${power.name}"?`)) {
            return;
        }

        setIsDeleting(true);
        const result = await deletePower(power.id);

        if (result.success) {
            toast.success("Power deleted successfully");
        } else {
            toast.error(result.error || "Failed to delete power");
            setIsDeleting(false);
        }
    };

    const handleCardClick = () => {
        if (onClick) {
            onClick();
        } else {
            router.push(`/dashboard/project/${novelId}/powers/${power.id}`);
        }
    };

    const levelCount = power.levels?.length || 0;
    const maxLevel = power.maxLevel || 10;

    return (
        <Card
            className="group hover:shadow-lg transition-all cursor-pointer border-l-4"
            style={{ borderLeftColor: power.color || "#3b82f6" }}
            onClick={handleCardClick}
        >
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                            style={{ backgroundColor: `${power.color}20` }}
                        >
                            {power.icon || typeIcons[power.type || "special"]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate">
                                {power.name}
                            </h3>
                            <div className="flex gap-1 mt-1 flex-wrap">
                                <Badge
                                    variant="outline"
                                    className={cn("text-xs", rarityColors[power.rarity || "common"])}
                                >
                                    <Star className="w-3 h-3 mr-1" />
                                    {power.rarity}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                    {power.type}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(); }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                disabled={isDeleting}
                                className="text-red-600"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {isDeleting ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

            <CardContent>
                {power.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {power.description}
                    </p>
                )}

                {/* Limitations */}
                {((power as any).limitations as string[] || []).length > 0 && (
                    <div className="mb-3 space-y-1">
                        {((power as any).limitations as string[]).slice(0, 2).map((limitation, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-amber-600">
                                <span>⚠️</span>
                                <span className="line-clamp-1">{limitation}</span>
                            </div>
                        ))}
                        {((power as any).limitations as string[]).length > 2 && (
                            <span className="text-xs text-muted-foreground">
                                +{((power as any).limitations as string[]).length - 2} more
                            </span>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        <span>{levelCount}/{maxLevel} Levels</span>
                    </div>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </CardContent>
        </Card>
    );
}

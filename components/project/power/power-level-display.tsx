"use client";

import { PowerLevel } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Trash2, Plus, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface PowerLevelDisplayProps {
    levels: PowerLevel[];
    currentLevel?: number;
    onEditLevel?: (level: PowerLevel) => void;
    onDeleteLevel?: (levelId: string) => void;
    onAddLevel?: () => void;
    editable?: boolean;
}

export function PowerLevelDisplay({
    levels,
    currentLevel = 1,
    onEditLevel,
    onDeleteLevel,
    onAddLevel,
    editable = false,
}: PowerLevelDisplayProps) {
    const sortedLevels = [...levels].sort((a, b) => a.level - b.level);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Power Levels</h4>
                {editable && onAddLevel && (
                    <Button size="sm" variant="outline" onClick={onAddLevel}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add Level
                    </Button>
                )}
            </div>

            {sortedLevels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                    No levels defined yet. Add levels to define pros and cons for each tier.
                </p>
            ) : (
                <div className="space-y-2">
                    {sortedLevels.map((level) => {
                        const isCurrentOrPast = level.level <= currentLevel;
                        const isCurrent = level.level === currentLevel;
                        const pros = (level.pros as string[]) || [];
                        const cons = (level.cons as string[]) || [];

                        return (
                            <Card
                                key={level.id}
                                className={cn(
                                    "transition-all",
                                    isCurrent && "ring-2 ring-primary",
                                    !isCurrentOrPast && "opacity-50"
                                )}
                            >
                                <CardContent className="p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={isCurrentOrPast ? "default" : "outline"}
                                                    className="text-xs"
                                                >
                                                    Lv. {level.level}
                                                </Badge>
                                                {level.name && (
                                                    <span className="text-sm font-medium">{level.name}</span>
                                                )}
                                                {isCurrent && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Current
                                                    </Badge>
                                                )}
                                            </div>

                                            {level.description && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {level.description}
                                                </p>
                                            )}

                                            {/* Pros & Cons */}
                                            {(pros.length > 0 || cons.length > 0) && (
                                                <div className="grid grid-cols-2 gap-3 mt-2">
                                                    {pros.length > 0 && (
                                                        <div className="space-y-1">
                                                            <span className="text-xs font-medium text-emerald-600">
                                                                ข้อดี
                                                            </span>
                                                            {pros.map((pro, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-start gap-1 text-xs"
                                                                >
                                                                    <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                                                    <span>{pro}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {cons.length > 0 && (
                                                        <div className="space-y-1">
                                                            <span className="text-xs font-medium text-red-600">
                                                                ข้อเสีย
                                                            </span>
                                                            {cons.map((con, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-start gap-1 text-xs"
                                                                >
                                                                    <X className="w-3 h-3 text-red-500 mt-0.5 shrink-0" />
                                                                    <span>{con}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Changes from previous level */}
                                            {((level as any).changes as string[] || []).length > 0 && (
                                                <div className="mt-2 space-y-1">
                                                    <span className="text-xs font-medium text-blue-600">
                                                        การเปลี่ยนแปลง
                                                    </span>
                                                    {((level as any).changes as string[]).map((change, i) => (
                                                        <div
                                                            key={i}
                                                            className="flex items-start gap-1 text-xs"
                                                        >
                                                            <ArrowUp className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                                                            <span>{change}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Stats */}
                                            {(level.powerBoost || level.cooldown || level.manaCost) && (
                                                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                                                    {level.powerBoost && (
                                                        <span>⚡ +{level.powerBoost}% power</span>
                                                    )}
                                                    {level.cooldown && (
                                                        <span>⏱️ {level.cooldown}s cooldown</span>
                                                    )}
                                                    {level.manaCost && (
                                                        <span>💧 {level.manaCost} mana</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {editable && (
                                            <div className="flex gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6"
                                                    onClick={() => onEditLevel?.(level)}
                                                >
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6 text-red-500 hover:text-red-600"
                                                    onClick={() => onDeleteLevel?.(level.id)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

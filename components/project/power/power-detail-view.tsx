"use client";

import { useState } from "react";
import { Power, PowerLevel } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Zap, Star, AlertTriangle } from "lucide-react";
import { PowerLevelDisplay } from "./power-level-display";
import { PowerLevelDialog } from "./power-level-dialog";
import { EditPowerDialog } from "./edit-power-dialog";
import { deletePowerLevel } from "@/server/power";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PowerDetailViewProps {
    power: Power & { levels?: PowerLevel[] };
    novelId: string;
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

export function PowerDetailView({ power, novelId }: PowerDetailViewProps) {
    const router = useRouter();
    const [editPowerOpen, setEditPowerOpen] = useState(false);
    const [levelDialogOpen, setLevelDialogOpen] = useState(false);
    const [editingLevel, setEditingLevel] = useState<PowerLevel | null>(null);

    const levels = power.levels || [];
    const nextLevel = levels.length > 0
        ? Math.max(...levels.map(l => l.level)) + 1
        : 1;

    const limitations = ((power as any).limitations as string[]) || [];

    const handleAddLevel = () => {
        setEditingLevel(null);
        setLevelDialogOpen(true);
    };

    const handleEditLevel = (level: PowerLevel) => {
        setEditingLevel(level);
        setLevelDialogOpen(true);
    };

    const handleDeleteLevel = async (levelId: string) => {
        if (!confirm("Are you sure you want to delete this level?")) return;

        const result = await deletePowerLevel(levelId);
        if (result.success) {
            toast.success("Level deleted");
            router.refresh();
        } else {
            toast.error(result.error || "Failed to delete level");
        }
    };

    const handleLevelSuccess = () => {
        router.refresh();
    };

    return (
        <div className="space-y-6">
            {/* Power Header */}
            <Card style={{ borderLeftColor: power.color || "#3b82f6", borderLeftWidth: "4px" }}>
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                            <div
                                className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                                style={{ backgroundColor: `${power.color}20` }}
                            >
                                {power.icon || typeIcons[power.type || "special"]}
                            </div>
                            <div>
                                <CardTitle className="text-2xl">{power.name}</CardTitle>
                                <div className="flex gap-2 mt-2">
                                    <Badge
                                        variant="outline"
                                        className={rarityColors[power.rarity || "common"]}
                                    >
                                        <Star className="w-3 h-3 mr-1" />
                                        {power.rarity}
                                    </Badge>
                                    <Badge variant="secondary">
                                        {typeIcons[power.type || "special"]} {power.type}
                                    </Badge>
                                    <Badge variant="outline">
                                        <Zap className="w-3 h-3 mr-1" />
                                        Max Lv. {power.maxLevel}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                        <Button variant="outline" onClick={() => setEditPowerOpen(true)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Power
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {power.description && (
                        <p className="text-muted-foreground">{power.description}</p>
                    )}

                    {/* Limitations */}
                    {limitations.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600" />
                                <span className="font-medium text-amber-800 dark:text-amber-200">
                                    ข้อจำกัดของพลัง
                                </span>
                            </div>
                            <ul className="space-y-1">
                                {limitations.map((limitation, index) => (
                                    <li key={index} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                        <span className="mt-0.5">⚠️</span>
                                        <span>{limitation}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Power Levels */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">ระดับพลัง (Power Levels)</CardTitle>
                </CardHeader>
                <CardContent>
                    <PowerLevelDisplay
                        levels={levels}
                        editable={true}
                        onAddLevel={handleAddLevel}
                        onEditLevel={handleEditLevel}
                        onDeleteLevel={handleDeleteLevel}
                    />
                </CardContent>
            </Card>

            {/* Edit Power Dialog */}
            <EditPowerDialog
                power={power}
                open={editPowerOpen}
                onOpenChange={setEditPowerOpen}
                onSuccess={() => router.refresh()}
            />

            {/* Power Level Dialog */}
            <PowerLevelDialog
                powerId={power.id}
                open={levelDialogOpen}
                onOpenChange={setLevelDialogOpen}
                editingLevel={editingLevel}
                nextLevel={nextLevel}
                onSuccess={handleLevelSuccess}
            />
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Power, PowerLevel, CharacterPower } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Zap, Trash2, ChevronUp, ChevronDown, Sparkles } from "lucide-react";
import {
    assignPowerToCharacter,
    removePowerFromCharacter,
    updateCharacterPower,
    getCharacterPowers,
    checkPossibleCombinations,
} from "@/server/character-power";
import { getPowersByNovelId } from "@/server/power";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PowerLevelDisplay } from "@/components/project/power/power-level-display";

interface CharacterPowerManagerProps {
    characterId: string;
    novelId: string;
}

type CharacterPowerWithDetails = CharacterPower & {
    power: Power & { levels: PowerLevel[] };
};

export function CharacterPowerManager({ characterId, novelId }: CharacterPowerManagerProps) {
    const [characterPowers, setCharacterPowers] = useState<CharacterPowerWithDetails[]>([]);
    const [availablePowers, setAvailablePowers] = useState<(Power & { levels: PowerLevel[] })[]>([]);
    const [possibleCombinations, setPossibleCombinations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedPowerId, setSelectedPowerId] = useState<string>("");
    const [acquiredMethod, setAcquiredMethod] = useState<string>("");
    const [notes, setNotes] = useState<string>("");

    const loadData = async () => {
        setLoading(true);
        try {
            const [powersResult, charPowersResult, combosResult] = await Promise.all([
                getPowersByNovelId(novelId),
                getCharacterPowers(characterId),
                checkPossibleCombinations(characterId, novelId),
            ]);

            if (powersResult.success) {
                setAvailablePowers(powersResult.data as any);
            }
            if (charPowersResult.success) {
                setCharacterPowers(charPowersResult.data as CharacterPowerWithDetails[]);
            }
            if (combosResult.success) {
                setPossibleCombinations(combosResult.data as any);
            }
        } catch (error) {
            console.error("Error loading data:", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [characterId, novelId]);

    const handleAddPower = async () => {
        if (!selectedPowerId) {
            toast.error("Please select a power");
            return;
        }

        const result = await assignPowerToCharacter({
            characterId,
            powerId: selectedPowerId,
            acquiredMethod: acquiredMethod || undefined,
            notes: notes || undefined,
        });

        if (result.success) {
            toast.success("Power assigned successfully");
            setAddDialogOpen(false);
            setSelectedPowerId("");
            setAcquiredMethod("");
            setNotes("");
            loadData();
        } else {
            toast.error(result.error || "Failed to assign power");
        }
    };

    const handleRemovePower = async (characterPowerId: string, powerName: string) => {
        if (!confirm(`Remove "${powerName}" from this character?`)) return;

        const result = await removePowerFromCharacter(characterPowerId);
        if (result.success) {
            toast.success("Power removed");
            loadData();
        } else {
            toast.error(result.error || "Failed to remove power");
        }
    };

    const handleLevelChange = async (characterPowerId: string, newLevel: number) => {
        const result = await updateCharacterPower(characterPowerId, { currentLevel: newLevel });
        if (result.success) {
            loadData();
        } else {
            toast.error("Failed to update level");
        }
    };

    // Powers not yet assigned to this character
    const unassignedPowers = availablePowers.filter(
        (power) => !characterPowers.some((cp) => cp.powerId === power.id)
    );

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    Loading powers...
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Powers</h3>
                    <Badge variant="secondary">{characterPowers.length}</Badge>
                </div>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" disabled={unassignedPowers.length === 0}>
                            <Plus className="h-4 w-4 mr-1" />
                            Add Power
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Assign Power</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Power</Label>
                                <Select value={selectedPowerId} onValueChange={setSelectedPowerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a power..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unassignedPowers.map((power) => (
                                            <SelectItem key={power.id} value={power.id}>
                                                <div className="flex items-center gap-2">
                                                    <span>{power.icon || "⚡"}</span>
                                                    <span>{power.name}</span>
                                                    <Badge variant="outline" className="text-xs ml-2">
                                                        {power.rarity}
                                                    </Badge>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>How was it acquired?</Label>
                                <Select value={acquiredMethod} onValueChange={setAcquiredMethod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select method..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="born">Born with it</SelectItem>
                                        <SelectItem value="trained">Trained</SelectItem>
                                        <SelectItem value="gifted">Gifted</SelectItem>
                                        <SelectItem value="stolen">Stolen</SelectItem>
                                        <SelectItem value="awakened">Awakened</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes (optional)</Label>
                                <Textarea
                                    placeholder="Any additional details..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={handleAddPower}>
                                    Assign Power
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* No powers message */}
            {characterPowers.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No powers assigned yet</p>
                        {availablePowers.length === 0 && (
                            <p className="text-xs mt-1">Create powers in the Powers page first</p>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {characterPowers.map((cp) => {
                        const maxLevel = cp.power.maxLevel || 10;
                        const currentLevel = cp.currentLevel || 1;

                        return (
                            <Card
                                key={cp.id}
                                className="border-l-4"
                                style={{ borderLeftColor: cp.power.color || "#3b82f6" }}
                            >
                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                                style={{ backgroundColor: `${cp.power.color}20` }}
                                            >
                                                {cp.power.icon || "⚡"}
                                            </div>
                                            <div>
                                                <h4 className="font-semibold">{cp.power.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="outline" className="text-xs">
                                                        {cp.power.type}
                                                    </Badge>
                                                    {cp.acquiredMethod && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {cp.acquiredMethod}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Level Controls */}
                                            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6"
                                                    disabled={currentLevel <= 1}
                                                    onClick={() => handleLevelChange(cp.id, currentLevel - 1)}
                                                >
                                                    <ChevronDown className="h-3 w-3" />
                                                </Button>
                                                <span className="text-sm font-medium px-2">
                                                    Lv. {currentLevel}
                                                </span>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-6 w-6"
                                                    disabled={currentLevel >= maxLevel}
                                                    onClick={() => handleLevelChange(cp.id, currentLevel + 1)}
                                                >
                                                    <ChevronUp className="h-3 w-3" />
                                                </Button>
                                            </div>

                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                                onClick={() => handleRemovePower(cp.id, cp.power.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>

                                {cp.power.levels && cp.power.levels.length > 0 && (
                                    <CardContent className="pt-0">
                                        <PowerLevelDisplay
                                            levels={cp.power.levels}
                                            currentLevel={currentLevel}
                                        />
                                    </CardContent>
                                )}

                                {cp.notes && (
                                    <CardContent className="pt-0">
                                        <p className="text-xs text-muted-foreground italic">
                                            {cp.notes}
                                        </p>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Possible Combinations */}
            {possibleCombinations.length > 0 && (
                <Card className="border-dashed border-2 border-amber-300 bg-amber-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                            <Sparkles className="w-4 h-4" />
                            Possible Power Combinations
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {possibleCombinations.map((combo: any) => (
                                <div
                                    key={combo.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <span>→</span>
                                    <span className="font-medium">
                                        {combo.resultPower?.icon || "✨"} {combo.resultPower?.name}
                                    </span>
                                    {combo.description && (
                                        <span className="text-muted-foreground text-xs">
                                            ({combo.description})
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

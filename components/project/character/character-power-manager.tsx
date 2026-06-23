"use client";

import { useState, useEffect } from "react";
import { Power, PowerLevel, CharacterPower } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
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
import { Plus, Zap, Trash2, ChevronUp, ChevronDown, Sparkles, ArrowRight } from "lucide-react";
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
        return <div className="text-sm text-muted-foreground py-4">กำลังโหลดพลัง…</div>;
    }

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3">
                <span className="font-technical text-[10px] uppercase tracking-[0.15em] text-muted-foreground tabular-nums">
                    {characterPowers.length} พลังที่ถือครอง
                </span>
                <Sheet open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <SheetTrigger asChild>
                        <Button size="sm" variant="outline" className="chamfered-sm" disabled={unassignedPowers.length === 0}>
                            <Plus className="h-4 w-4 mr-1" />
                            เพิ่มพลัง
                        </Button>
                    </SheetTrigger>
                    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>มอบพลังให้ตัวละคร</SheetTitle>
                        </SheetHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>เลือกพลัง</Label>
                                <Select value={selectedPowerId} onValueChange={setSelectedPowerId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกพลัง…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {unassignedPowers.map((power) => (
                                            <SelectItem key={power.id} value={power.id}>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 chamfered-sm shrink-0" style={{ backgroundColor: power.color || "var(--forge-gold)" }} />
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
                                <Label>ได้พลังมาอย่างไร?</Label>
                                <Select value={acquiredMethod} onValueChange={setAcquiredMethod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="เลือกวิธี…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="born">เกิดมาพร้อมพลัง</SelectItem>
                                        <SelectItem value="trained">ฝึกฝน</SelectItem>
                                        <SelectItem value="gifted">ได้รับมอบ</SelectItem>
                                        <SelectItem value="stolen">ขโมยมา</SelectItem>
                                        <SelectItem value="awakened">ปลุกพลัง</SelectItem>
                                        <SelectItem value="other">อื่นๆ</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>หมายเหตุ (ไม่บังคับ)</Label>
                                <Textarea
                                    placeholder="รายละเอียดเพิ่มเติม…"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                                    ยกเลิก
                                </Button>
                                <Button onClick={handleAddPower}>
                                    มอบพลัง
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            {/* No powers message */}
            {characterPowers.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 chamfered border border-dashed border-border bg-card/40">
                    <Zap className="w-9 h-9 text-[var(--forge-gold)]/50 mb-3" />
                    <p className="text-sm text-muted-foreground">ยังไม่ได้มอบพลังให้ตัวละครนี้</p>
                    {availablePowers.length === 0 && (
                        <p className="text-xs text-muted-foreground/70 mt-1">สร้างพลังในหน้าระบบพลังก่อน</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {characterPowers.map((cp) => {
                        const maxLevel = cp.power.maxLevel || 10;
                        const currentLevel = cp.currentLevel || 1;
                        const accent = cp.power.color || "var(--forge-gold)";

                        return (
                            <div key={cp.id} className="chamfered border border-border bg-card/50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="w-10 h-10 chamfered-sm flex items-center justify-center shrink-0 border"
                                            style={{ backgroundColor: `color-mix(in oklch, ${accent} 16%, transparent)`, borderColor: `color-mix(in oklch, ${accent} 35%, transparent)` }}
                                        >
                                            {cp.power.icon ? (
                                                <span className="text-lg leading-none">{cp.power.icon}</span>
                                            ) : (
                                                <Zap className="w-5 h-5" style={{ color: accent }} />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-display font-bold leading-tight truncate">{cp.power.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="font-technical text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                                                    {cp.power.type}
                                                </span>
                                                {cp.acquiredMethod && (
                                                    <span className="text-xs text-muted-foreground">· {cp.acquiredMethod}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Level Controls */}
                                        <div className="flex items-center gap-1 bg-muted chamfered-sm p-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-6 w-6"
                                                disabled={currentLevel <= 1}
                                                onClick={() => handleLevelChange(cp.id, currentLevel - 1)}
                                            >
                                                <ChevronDown className="h-3 w-3" />
                                            </Button>
                                            <span className="font-technical text-xs font-medium px-1.5 tabular-nums">
                                                ระดับ {currentLevel}
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

                                {cp.power.levels && cp.power.levels.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-border/60">
                                        <PowerLevelDisplay levels={cp.power.levels} currentLevel={currentLevel} />
                                    </div>
                                )}

                                {cp.notes && (
                                    <p className="text-xs text-muted-foreground italic mt-2">{cp.notes}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Possible Combinations */}
            {possibleCombinations.length > 0 && (
                <div className="chamfered border border-[var(--forge-gold)]/40 bg-[var(--forge-gold)]/[0.06] p-4">
                    <div className="flex items-center gap-2 mb-2.5 font-technical text-[10px] uppercase tracking-[0.15em] text-[var(--forge-amber)]">
                        <Sparkles className="w-3.5 h-3.5" />
                        การผสานพลังที่เป็นไปได้
                    </div>
                    <div className="space-y-1.5">
                        {possibleCombinations.map((combo: any) => (
                            <div key={combo.id} className="flex items-center gap-2 text-sm">
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="font-medium">{combo.resultPower?.name}</span>
                                {combo.description && (
                                    <span className="text-muted-foreground text-xs">({combo.description})</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

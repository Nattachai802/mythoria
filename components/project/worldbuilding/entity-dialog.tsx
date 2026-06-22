"use client";

import { useState } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { createEntity, updateEntity } from "@/server/entities";
import { toast } from "sonner";

interface EntityDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    novelId: string;
    editEntity?: {
        id: string;
        name: string;
        description?: string | null;
        type?: string | null;
        threatLevel?: string | null;
        appearance?: string | null;
        abilities?: string[] | null;
        weaknesses?: string[] | null;
        habitat?: string | null;
        icon?: string | null;
        color?: string | null;
    } | null;
    onSuccess?: () => void;
}

const ENTITY_TYPES = [
    { value: "creature", label: "🦎 Creature" },
    { value: "monster", label: "👹 Monster" },
    { value: "spirit", label: "👻 Spirit" },
    { value: "beast", label: "🐺 Beast" },
    { value: "humanoid", label: "🧝 Humanoid" },
    { value: "plant", label: "🌿 Plant" },
];

const THREAT_LEVELS = [
    { value: "harmless", label: "Harmless" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "extreme", label: "Extreme" },
    { value: "legendary", label: "Legendary" },
];

const HABITATS = [
    { value: "forest", label: "🌲 ป่า" },
    { value: "mountain", label: "⛰️ ภูเขา" },
    { value: "cave", label: "🕳️ ถ้ำ" },
    { value: "water", label: "🌊 น้ำ" },
    { value: "sky", label: "☁️ ท้องฟ้า" },
    { value: "underground", label: "⬇️ ใต้ดิน" },
    { value: "desert", label: "🏜️ ทะเลทราย" },
    { value: "swamp", label: "🪷 หนองบึง" },
];

export function EntityDialog({
    open,
    onOpenChange,
    novelId,
    editEntity,
    onSuccess,
}: EntityDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(editEntity?.name || "");
    const [description, setDescription] = useState(editEntity?.description || "");
    const [type, setType] = useState(editEntity?.type || "creature");
    const [threatLevel, setThreatLevel] = useState(editEntity?.threatLevel || "harmless");
    const [appearance, setAppearance] = useState(editEntity?.appearance || "");
    const [abilities, setAbilities] = useState<string[]>((editEntity?.abilities as string[]) || []);
    const [weaknesses, setWeaknesses] = useState<string[]>((editEntity?.weaknesses as string[]) || []);
    const [habitat, setHabitat] = useState(editEntity?.habitat || "forest");
    const [icon, setIcon] = useState(editEntity?.icon || "");
    const [color, setColor] = useState(editEntity?.color || "#ef4444");

    const [newAbility, setNewAbility] = useState("");
    const [newWeakness, setNewWeakness] = useState("");

    const isEdit = !!editEntity;

    const addAbility = () => {
        if (newAbility.trim()) {
            setAbilities([...abilities, newAbility.trim()]);
            setNewAbility("");
        }
    };

    const addWeakness = () => {
        if (newWeakness.trim()) {
            setWeaknesses([...weaknesses, newWeakness.trim()]);
            setNewWeakness("");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("กรุณาระบุชื่อ");
            return;
        }

        setIsLoading(true);
        try {
            const data = {
                name: name.trim(),
                description: description.trim() || undefined,
                type,
                threatLevel,
                appearance: appearance.trim() || undefined,
                abilities: abilities.length > 0 ? abilities : undefined,
                weaknesses: weaknesses.length > 0 ? weaknesses : undefined,
                habitat,
                icon: icon.trim() || undefined,
                color,
            };

            let result;
            if (isEdit) {
                result = await updateEntity(editEntity.id, data);
            } else {
                result = await createEntity({ ...data, novelId });
            }

            if (result.success) {
                toast.success(isEdit ? "แก้ไขสำเร็จ" : "สร้างสำเร็จ");
                onOpenChange(false);
                onSuccess?.();
                // Reset form
                if (!isEdit) {
                    setName("");
                    setDescription("");
                    setType("creature");
                    setThreatLevel("harmless");
                    setAppearance("");
                    setAbilities([]);
                    setWeaknesses([]);
                    setHabitat("forest");
                    setIcon("");
                    setColor("#ef4444");
                }
            } else {
                toast.error(result.error || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{isEdit ? "แก้ไขสิ่งมีชีวิต" : "สร้างสิ่งมีชีวิตใหม่"}</SheetTitle>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <Label htmlFor="icon">Icon</Label>
                            <Input
                                id="icon"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="🐉"
                                className="text-center text-xl"
                            />
                        </div>
                        <div className="col-span-3">
                            <Label htmlFor="name">ชื่อ *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="มังกรเพลิง"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>ประเภท</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ENTITY_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>ระดับอันตราย</Label>
                            <Select value={threatLevel} onValueChange={setThreatLevel}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {THREAT_LEVELS.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>ถิ่นอาศัย</Label>
                            <Select value={habitat} onValueChange={setHabitat}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {HABITATS.map((h) => (
                                        <SelectItem key={h.value} value={h.value}>
                                            {h.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="description">คำอธิบาย</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="สิ่งมีชีวิตในตำนานที่..."
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label htmlFor="appearance">รูปลักษณ์</Label>
                        <Textarea
                            id="appearance"
                            value={appearance}
                            onChange={(e) => setAppearance(e.target.value)}
                            placeholder="มีเกล็ดสีแดง ปีกกว้าง..."
                            rows={2}
                        />
                    </div>

                    {/* Abilities */}
                    <div>
                        <Label>ความสามารถ</Label>
                        <div className="flex gap-2 mb-2">
                            <Input
                                value={newAbility}
                                onChange={(e) => setNewAbility(e.target.value)}
                                placeholder="พ่นไฟ"
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAbility())}
                            />
                            <Button type="button" size="icon" onClick={addAbility}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {abilities.map((ability, i) => (
                                <Badge key={i} variant="secondary" className="gap-1">
                                    {ability}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setAbilities(abilities.filter((_, j) => j !== i))} />
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Weaknesses */}
                    <div>
                        <Label>จุดอ่อน</Label>
                        <div className="flex gap-2 mb-2">
                            <Input
                                value={newWeakness}
                                onChange={(e) => setNewWeakness(e.target.value)}
                                placeholder="น้ำ"
                                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWeakness())}
                            />
                            <Button type="button" size="icon" onClick={addWeakness}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {weaknesses.map((weakness, i) => (
                                <Badge key={i} variant="outline" className="gap-1 text-red-500">
                                    {weakness}
                                    <X className="h-3 w-3 cursor-pointer" onClick={() => setWeaknesses(weaknesses.filter((_, j) => j !== i))} />
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <SheetFooter className="flex-row justify-end gap-2 px-0">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            ยกเลิก
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEdit ? "บันทึก" : "สร้าง"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}

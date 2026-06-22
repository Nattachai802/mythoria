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
import { createItem, updateItem } from "@/server/items";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ItemDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    novelId: string;
    characters?: { id: string; name: string }[];
    locations?: { id: string; name: string }[];
    editItem?: {
        id: string;
        name: string;
        description?: string | null;
        type?: string | null;
        rarity?: string | null;
        currentOwnerId?: string | null;
        locationId?: string | null;
        lore?: string | null;
        icon?: string | null;
    } | null;
    onSuccess?: () => void;
}

const ITEM_TYPES = [
    { value: "artifact", label: "🏺 Artifact" },
    { value: "weapon", label: "⚔️ Weapon" },
    { value: "armor", label: "🛡️ Armor" },
    { value: "potion", label: "🧪 Potion" },
    { value: "material", label: "💎 Material" },
    { value: "currency", label: "💰 Currency" },
    { value: "misc", label: "📦 Misc" },
];

const RARITIES = [
    { value: "common", label: "Common" },
    { value: "uncommon", label: "Uncommon" },
    { value: "rare", label: "Rare" },
    { value: "epic", label: "Epic" },
    { value: "legendary", label: "Legendary" },
];

export function ItemDialog({
    open,
    onOpenChange,
    novelId,
    characters = [],
    locations = [],
    editItem,
    onSuccess,
}: ItemDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(editItem?.name || "");
    const [description, setDescription] = useState(editItem?.description || "");
    const [type, setType] = useState(editItem?.type || "artifact");
    const [rarity, setRarity] = useState(editItem?.rarity || "common");
    const [currentOwnerId, setCurrentOwnerId] = useState(editItem?.currentOwnerId || "");
    const [locationId, setLocationId] = useState(editItem?.locationId || "");
    const [lore, setLore] = useState(editItem?.lore || "");
    const [icon, setIcon] = useState(editItem?.icon || "");

    const isEdit = !!editItem;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("กรุณาระบุชื่อไอเทม");
            return;
        }

        setIsLoading(true);
        try {
            const data = {
                name: name.trim(),
                description: description.trim() || undefined,
                type,
                rarity,
                currentOwnerId: currentOwnerId && currentOwnerId !== "none" ? currentOwnerId : undefined,
                locationId: locationId && locationId !== "none" ? locationId : undefined,
                lore: lore.trim() || undefined,
                icon: icon.trim() || undefined,
            };

            let result;
            if (isEdit) {
                result = await updateItem(editItem.id, data);
            } else {
                result = await createItem({ ...data, novelId });
            }

            if (result.success) {
                toast.success(isEdit ? "แก้ไขไอเทมสำเร็จ" : "สร้างไอเทมสำเร็จ");
                onOpenChange(false);
                onSuccess?.();
                // Reset form
                if (!isEdit) {
                    setName("");
                    setDescription("");
                    setType("artifact");
                    setRarity("common");
                    setCurrentOwnerId("");
                    setLocationId("");
                    setLore("");
                    setIcon("");
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
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{isEdit ? "แก้ไขไอเทม" : "สร้างไอเทมใหม่"}</SheetTitle>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <Label htmlFor="icon">Icon</Label>
                            <Input
                                id="icon"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="🏺"
                                className="text-center text-xl"
                            />
                        </div>
                        <div className="col-span-3">
                            <Label htmlFor="name">ชื่อ *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ดาบเทพสังหาร"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>ประเภท</Label>
                            <Select value={type} onValueChange={setType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ITEM_TYPES.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>ความหายาก</Label>
                            <Select value={rarity} onValueChange={setRarity}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RARITIES.map((r) => (
                                        <SelectItem key={r.value} value={r.value}>
                                            {r.label}
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
                            placeholder="ดาบโบราณที่มีพลังมหาศาล..."
                            rows={2}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>เจ้าของปัจจุบัน</Label>
                            <Select value={currentOwnerId} onValueChange={setCurrentOwnerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="ไม่มีเจ้าของ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">ไม่มีเจ้าของ</SelectItem>
                                    {characters.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>ตำแหน่งที่อยู่</Label>
                            <Select value={locationId} onValueChange={setLocationId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="ไม่ระบุ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">ไม่ระบุ</SelectItem>
                                    {locations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>
                                            {l.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="lore">ประวัติ/ตำนาน</Label>
                        <Textarea
                            id="lore"
                            value={lore}
                            onChange={(e) => setLore(e.target.value)}
                            placeholder="ตำนานเล่าว่าดาบนี้ถูกตีขึ้นมาจาก..."
                            rows={3}
                        />
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

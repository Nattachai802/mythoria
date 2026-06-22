"use client";

import { useState, useEffect } from "react";
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
import { createLoreGroup, updateLoreGroup, deleteLoreGroup } from "@/server/lore-groups";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface LoreGroupDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    novelId: string;
    editGroup?: {
        id: string;
        name: string;
        description?: string | null;
        color?: string | null;
        icon?: string | null;
    } | null;
    onSuccess?: () => void;
}

const COLORS = [
    { value: "#6366f1", label: "Indigo" },
    { value: "#8b5cf6", label: "Purple" },
    { value: "#ec4899", label: "Pink" },
    { value: "#ef4444", label: "Red" },
    { value: "#f59e0b", label: "Orange" },
    { value: "#10b981", label: "Emerald" },
    { value: "#3b82f6", label: "Blue" },
    { value: "#6b7280", label: "Gray" },
];

export function LoreGroupDialog({
    open,
    onOpenChange,
    novelId,
    editGroup,
    onSuccess,
}: LoreGroupDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [name, setName] = useState(editGroup?.name || "");
    const [description, setDescription] = useState(editGroup?.description || "");
    const [color, setColor] = useState(editGroup?.color || "#6366f1");
    const [icon, setIcon] = useState(editGroup?.icon || "");

    const isEdit = !!editGroup;

    useEffect(() => {
        if (editGroup) {
            setName(editGroup.name);
            setDescription(editGroup.description || "");
            setColor(editGroup.color || "#6366f1");
            setIcon(editGroup.icon || "");
        } else {
            setName("");
            setDescription("");
            setColor("#6366f1");
            setIcon("");
        }
    }, [editGroup]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("กรุณาระบุชื่อกลุ่ม");
            return;
        }

        setIsLoading(true);
        try {
            const data = {
                name: name.trim(),
                description: description.trim() || undefined,
                color,
                icon: icon.trim() || undefined,
            };

            let result;
            if (isEdit) {
                result = await updateLoreGroup(editGroup.id, data);
            } else {
                result = await createLoreGroup({ ...data, novelId });
            }

            if (result.success) {
                toast.success(isEdit ? "แก้ไขกลุ่มสำเร็จ" : "สร้างกลุ่มสำเร็จ");
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error(result.error || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!editGroup) return;
        if (!confirm("ต้องการลบกลุ่มนี้? Lore ในกลุ่มจะไม่ถูกลบ แต่จะถูกยกออกจากกลุ่ม")) return;

        setIsDeleting(true);
        try {
            const result = await deleteLoreGroup(editGroup.id);
            if (result.success) {
                toast.success("ลบกลุ่มสำเร็จ");
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error(result.error || "ไม่สามารถลบได้");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{isEdit ? "แก้ไขกลุ่ม Lore" : "สร้างกลุ่ม Lore ใหม่"}</SheetTitle>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <Label htmlFor="icon">Icon</Label>
                            <Input
                                id="icon"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="📁"
                                className="text-center text-xl"
                            />
                        </div>
                        <div className="col-span-3">
                            <Label htmlFor="name">ชื่อกลุ่ม *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ยุคโบราณ"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="description">คำอธิบาย</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="รวบรวมเรื่องราวในยุคโบราณ..."
                            rows={2}
                        />
                    </div>

                    <div>
                        <Label>สี</Label>
                        <Select value={color} onValueChange={setColor}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {COLORS.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.value }} />
                                            {c.label}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <SheetFooter className="flex-row justify-between gap-2 px-0">
                        {isEdit && (
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="mr-auto"
                            >
                                {isDeleting ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                ลบ
                            </Button>
                        )}
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

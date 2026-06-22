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
import { createEra, updateEra, deleteEra } from "@/server/eras";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface EraDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    novelId: string;
    editEra?: {
        id: string;
        name: string;
        description?: string | null;
        color?: string | null;
        icon?: string | null;
    } | null;
    onSuccess?: () => void;
}

const COLORS = [
    { value: "#8b5cf6", label: "ม่วง" },
    { value: "#3b82f6", label: "น้ำเงิน" },
    { value: "#10b981", label: "เขียว" },
    { value: "#f59e0b", label: "ส้ม" },
    { value: "#ef4444", label: "แดง" },
    { value: "#ec4899", label: "ชมพู" },
    { value: "#6366f1", label: "Indigo" },
    { value: "#14b8a6", label: "Teal" },
];

export function EraDialog({
    open,
    onOpenChange,
    novelId,
    editEra,
    onSuccess,
}: EraDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [name, setName] = useState(editEra?.name || "");
    const [description, setDescription] = useState(editEra?.description || "");
    const [color, setColor] = useState(editEra?.color || "#8b5cf6");
    const [icon, setIcon] = useState(editEra?.icon || "");

    const isEdit = !!editEra;

    useEffect(() => {
        if (editEra) {
            setName(editEra.name);
            setDescription(editEra.description || "");
            setColor(editEra.color || "#8b5cf6");
            setIcon(editEra.icon || "");
        } else {
            setName("");
            setDescription("");
            setColor("#8b5cf6");
            setIcon("");
        }
    }, [editEra]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("กรุณาระบุชื่อยุค");
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
                result = await updateEra(editEra.id, data);
            } else {
                result = await createEra({ ...data, novelId });
            }

            if (result.success) {
                toast.success(isEdit ? "แก้ไขยุคสำเร็จ" : "สร้างยุคสำเร็จ");
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
        if (!editEra) return;
        if (!confirm("ต้องการลบยุคนี้? Lore ในยุคนี้จะถูกยกออกจากยุค")) return;

        setIsDeleting(true);
        try {
            const result = await deleteEra(editEra.id);
            if (result.success) {
                toast.success("ลบยุคสำเร็จ");
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
                    <SheetTitle>{isEdit ? "แก้ไขยุคสมัย" : "สร้างยุคสมัยใหม่"}</SheetTitle>
                </SheetHeader>

                <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-1">
                            <Label htmlFor="icon">Icon</Label>
                            <Input
                                id="icon"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="⏳"
                                className="text-center text-xl"
                            />
                        </div>
                        <div className="col-span-3">
                            <Label htmlFor="name">ชื่อยุค *</Label>
                            <Input
                                id="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="ยุคโบราณ, ยุคมืด, ปัจจุบัน"
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
                            placeholder="ช่วงเวลาที่เทพเจ้ายังดำรงอยู่บนโลก..."
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

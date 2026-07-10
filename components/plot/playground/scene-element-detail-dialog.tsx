"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { User, MapPin, Loader2, Shield, ChevronDown } from "lucide-react";
import { upsertSceneElementDetail } from "@/server/scene-element-details";
import { toast } from "sonner";
import { SceneElementDetails } from "@/db/schema";
import { ROLES } from "./scene-participants-panel";
import { cn } from "@/lib/utils";

const detailSchema = z.object({
    action: z.string().optional(),
    how: z.string().optional(),
    goal: z.string().optional(),
    outcome: z.string().optional(),
    role: z.string().optional(),
    notes: z.string().optional(),
});

type DetailFormData = z.infer<typeof detailSchema>;

interface SceneElementDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    elementType: "character" | "location" | "faction" | "dummy_character" | "dummy_faction";
    elementId: string;
    elementName: string;
    sceneId: string;
    novelId: string;
    canvasItemId?: string;
    existingDetail?: SceneElementDetails | null;
    onSaved?: (detail: SceneElementDetails) => void;
}

export function SceneElementDetailDialog({
    open,
    onOpenChange,
    elementType,
    elementId,
    elementName,
    sceneId,
    novelId,
    canvasItemId,
    existingDetail,
    onSaved,
}: SceneElementDetailDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const form = useForm<DetailFormData>({
        resolver: zodResolver(detailSchema),
        defaultValues: {
            action: "",
            how: "",
            goal: "",
            outcome: "",
            role: "protagonist",
            notes: "",
        },
    });

    // Reset form when dialog opens with existing data
    useEffect(() => {
        if (open) {
            form.reset({
                action: existingDetail?.action || "",
                how: existingDetail?.how || "",
                goal: existingDetail?.goal || "",
                outcome: existingDetail?.outcome || "",
                role: existingDetail?.role || "protagonist",
                notes: existingDetail?.notes || "",
            });
            // เปิดโหมดละเอียดอัตโนมัติถ้ามีข้อมูลเดิมในช่องละเอียดอยู่แล้ว
            setShowAdvanced(!!(existingDetail?.how || existingDetail?.goal || existingDetail?.outcome || existingDetail?.notes));
        }
    }, [open, existingDetail, form]);

    // role มีความหมายเฉพาะตัวละคร/faction (สถานที่ไม่มี "บทบาท")
    const hasRole = elementType !== "location";

    const onSubmit = async (data: DetailFormData) => {
        setIsSubmitting(true);

        const result = await upsertSceneElementDetail({
            id: existingDetail?.id,
            sceneId,
            elementType,
            elementId,
            canvasItemId,
            action: data.action || undefined,
            how: data.how || undefined,
            goal: data.goal || undefined,
            outcome: data.outcome || undefined,
            role: hasRole ? (data.role || undefined) : undefined,
            notes: data.notes || undefined,
            novelId,
        });

        if (result.success && result.data) {
            toast.success("บันทึกรายละเอียดสำเร็จ");
            onSaved?.(result.data);
            onOpenChange(false);
        } else {
            toast.error(result.error || "ไม่สามารถบันทึกได้");
        }
        setIsSubmitting(false);
    };

    const TypeIcon = (elementType === "character" || elementType === "dummy_character") ? User 
                   : (elementType === "faction" || elementType === "dummy_faction") ? Shield 
                   : MapPin;
    const typeColor = (elementType === "character" || elementType === "dummy_character") ? "text-blue-500"
                    : (elementType === "faction" || elementType === "dummy_faction") ? "text-emerald-500"
                    : "text-green-500";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <TypeIcon className={`w-5 h-5 ${typeColor}`} />
                        <span>รายละเอียด: {elementName}</span>
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="action"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>ทำอะไรในซีนนี้</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={(elementType === "location")
                                                ? "เช่น เป็นสถานที่เกิดเหตุที่ตัวเอกค้นพบศพ"
                                                : "เช่น ลอบเข้าบ้านร้างเพื่อหาหลักฐาน แต่กลับเจอศพ"
                                            }
                                            className="min-h-[70px] resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {hasRole && (
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem className="min-w-0">
                                        <FormLabel>บทบาท</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="w-full [&>span]:truncate">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {ROLES.map((r) => (
                                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* โหมดละเอียด (ไม่บังคับ) — how/goal/outcome/notes */}
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-180")} />
                            โหมดละเอียด (ไม่บังคับ)
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4 border-l-2 border-border/60 pl-3">
                                <FormField
                                    control={form.control}
                                    name="how"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>อย่างไร (How)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="เช่น ใช้ดาบวิเศษ, เจรจาลับ, ทรยศ" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="goal"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>เป้าหมาย/แรงจูงใจ (Goal)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="เช่น เพื่อปกป้องหมู่บ้าน, แย่งชิงพื้นที่" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="outcome"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>ผลลัพธ์ (Outcome)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="เช่น พ่ายแพ้, ได้ข้อมูลลับ" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>หมายเหตุ</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="รายละเอียดเพิ่มเติม..."
                                                    className="min-h-[70px] resize-none"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    "💾 บันทึก"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

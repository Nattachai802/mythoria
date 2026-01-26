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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { User, MapPin, Loader2, CheckCircle2, XCircle, Clock, HelpCircle } from "lucide-react";
import { upsertSceneElementDetail } from "@/server/scene-element-details";
import { toast } from "sonner";
import { SceneElementDetails } from "@/db/schema";

const detailSchema = z.object({
    action: z.string().optional(),
    how: z.string().optional(),
    goal: z.string().optional(),
    outcome: z.string().optional(),
    notes: z.string().optional(),
});

type DetailFormData = z.infer<typeof detailSchema>;

interface SceneElementDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    elementType: "character" | "location";
    elementId: string;
    elementName: string;
    sceneId: string;
    novelId: string;
    canvasItemId?: string;
    existingDetail?: SceneElementDetails | null;
    onSaved?: (detail: SceneElementDetails) => void;
}

const outcomeOptions = [
    { value: "unknown", label: "ยังไม่ทราบ", icon: HelpCircle, color: "text-muted-foreground" },
    { value: "success", label: "สำเร็จ", icon: CheckCircle2, color: "text-green-500" },
    { value: "failure", label: "ล้มเหลว", icon: XCircle, color: "text-red-500" },
    { value: "ongoing", label: "กำลังดำเนินการ", icon: Clock, color: "text-yellow-500" },
];

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

    const form = useForm<DetailFormData>({
        resolver: zodResolver(detailSchema),
        defaultValues: {
            action: "",
            how: "",
            goal: "",
            outcome: "unknown",
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
                outcome: existingDetail?.outcome || "unknown",
                notes: existingDetail?.notes || "",
            });
        }
    }, [open, existingDetail, form]);

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

    const TypeIcon = elementType === "character" ? User : MapPin;
    const typeColor = elementType === "character" ? "text-blue-500" : "text-green-500";

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
                                    <FormLabel>ทำอะไร (Action)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={elementType === "character"
                                                ? "เช่น สู้กับมอนสเตอร์, ค้นหาสมบัติ"
                                                : "เช่น สถานที่เกิดเหตุ, จุดพบปะ"
                                            }
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="how"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>อย่างไร (How)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={elementType === "character"
                                                ? "เช่น ใช้ดาบวิเศษ, ร่ายเวทมนตร์"
                                                : "เช่น มีหมอกหนา, ตอนกลางคืน"
                                            }
                                            {...field}
                                        />
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
                                        <Input
                                            placeholder={elementType === "character"
                                                ? "เช่น เพื่อปกป้องหมู่บ้าน, ต้องการล้างแค้น"
                                                : "เช่น จุดหมายปลายทาง, สถานที่ซ่อนตัว"
                                            }
                                            {...field}
                                        />
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
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex flex-wrap gap-3"
                                        >
                                            {outcomeOptions.map((option) => {
                                                const Icon = option.icon;
                                                return (
                                                    <div key={option.value} className="flex items-center space-x-2">
                                                        <RadioGroupItem value={option.value} id={option.value} />
                                                        <Label
                                                            htmlFor={option.value}
                                                            className={`flex items-center gap-1.5 cursor-pointer ${field.value === option.value ? option.color : "text-muted-foreground"
                                                                }`}
                                                        >
                                                            <Icon className="w-4 h-4" />
                                                            {option.label}
                                                        </Label>
                                                    </div>
                                                );
                                            })}
                                        </RadioGroup>
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
                                            className="min-h-[80px] resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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

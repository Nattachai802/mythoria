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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, StickyNote, Trash2 } from "lucide-react";
import { upsertSceneElementDetail, deleteSceneElementDetail } from "@/server/scene-element-details";
import { toast } from "sonner";
import { SceneElementDetails } from "@/db/schema";

const noteSchema = z.object({
    notes: z.string().min(1, "กรุณากรอกข้อความ"),
});

type NoteFormData = z.infer<typeof noteSchema>;

interface IdeaNoteDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    ideaId: string;
    ideaTitle: string;
    canvasItemId: string;
    sceneId: string;
    novelId: string;
    existingNote?: SceneElementDetails | null;
    onSaved?: (detail: SceneElementDetails) => void;
    onDeleted?: (id: string) => void;
}

export function IdeaNoteDialog({
    open,
    onOpenChange,
    ideaId,
    ideaTitle,
    canvasItemId,
    sceneId,
    novelId,
    existingNote,
    onSaved,
    onDeleted,
}: IdeaNoteDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const form = useForm<NoteFormData>({
        resolver: zodResolver(noteSchema),
        defaultValues: {
            notes: "",
        },
    });

    // Reset form when dialog opens with existing data
    useEffect(() => {
        if (open) {
            form.reset({
                notes: existingNote?.notes || "",
            });
        }
    }, [open, existingNote, form]);

    const onSubmit = async (data: NoteFormData) => {
        setIsSubmitting(true);

        const result = await upsertSceneElementDetail({
            id: existingNote?.id,
            sceneId,
            elementType: "idea_note",
            elementId: ideaId,
            canvasItemId,
            notes: data.notes,
            novelId,
            // Force create new note if no existing id (for one-to-many)
            forceCreate: !existingNote?.id,
        });

        if (result.success && result.data) {
            toast.success(existingNote?.id ? "แก้ไข note สำเร็จ" : "เพิ่ม note สำเร็จ");
            onSaved?.(result.data);
            onOpenChange(false);
        } else {
            toast.error(result.error || "ไม่สามารถบันทึกได้");
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!existingNote?.id) return;

        setIsDeleting(true);
        const result = await deleteSceneElementDetail(existingNote.id, novelId, sceneId);

        if (result.success) {
            toast.success("ลบ note สำเร็จ");
            onDeleted?.(existingNote.id);
            onOpenChange(false);
        } else {
            toast.error("ไม่สามารถลบได้");
        }
        setIsDeleting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <StickyNote className="w-5 h-5 text-yellow-500" />
                        <span>Note: {ideaTitle}</span>
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>เขียน Note</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="เขียนบันทึกช่วยจำ..."
                                            className="min-h-[150px] resize-none bg-yellow-50 border-yellow-200 focus:border-yellow-400"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-between pt-2">
                            {existingNote?.id ? (
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4 mr-1" />
                                            ลบ
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <div />
                            )}

                            <div className="flex gap-2">
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
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

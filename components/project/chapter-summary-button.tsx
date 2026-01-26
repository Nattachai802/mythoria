"use client";

import { useState } from "react";
import { Sparkles, Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { generateChapterSummary, saveChapterSummary } from "@/server/chapter-summary";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChapterSummaryButtonProps {
    chapterId: string;
    novelId: string;
    initialSummary?: string | null;
}

export function ChapterSummaryButton({
    chapterId,
    novelId,
    initialSummary,
}: ChapterSummaryButtonProps) {
    const [summary, setSummary] = useState(initialSummary || "");
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const [open, setOpen] = useState(false);

    async function handleGenerate(forceRegenerate: boolean = false) {
        setIsGenerating(true);
        try {
            const result = await generateChapterSummary(chapterId, forceRegenerate);

            if (result.success && result.summary) {
                setSummary(result.summary);
                if (result.cached) {
                    toast.info("ใช้ summary ที่เคยสร้างไว้");
                } else {
                    toast.success("สร้าง summary สำเร็จ!");
                }
            } else {
                toast.error(result.error || "ไม่สามารถสร้าง summary ได้");
            }
        } catch (error) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleSave() {
        const result = await saveChapterSummary(chapterId, editValue, novelId);
        if (result.success) {
            setSummary(editValue);
            setIsEditing(false);
            toast.success("บันทึก summary สำเร็จ");
        } else {
            toast.error("ไม่สามารถบันทึกได้");
        }
    }

    function startEdit() {
        setEditValue(summary);
        setIsEditing(true);
    }

    function cancelEdit() {
        setIsEditing(false);
        setEditValue("");
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "h-7 w-7",
                        summary && "text-amber-500 hover:text-amber-600"
                    )}
                    title={summary ? "ดู/แก้ไข Summary" : "สร้าง Summary ด้วย AI"}
                >
                    <Sparkles className="h-3.5 w-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-amber-500" />
                            Chapter Summary
                        </h4>
                        {summary && !isEditing && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={startEdit}
                            >
                                <Pencil className="h-3 w-3 mr-1" />
                                แก้ไข
                            </Button>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="space-y-2">
                            <Textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                rows={3}
                                className="text-sm resize-none"
                                placeholder="พิมพ์ summary..."
                            />
                            <div className="flex justify-end gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    onClick={cancelEdit}
                                >
                                    <X className="h-3 w-3 mr-1" />
                                    ยกเลิก
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-7"
                                    onClick={handleSave}
                                >
                                    <Check className="h-3 w-3 mr-1" />
                                    บันทึก
                                </Button>
                            </div>
                        </div>
                    ) : summary ? (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {summary}
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-8 text-xs"
                                onClick={() => handleGenerate(true)}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                        กำลังสร้างใหม่...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-3 w-3 mr-1" />
                                        สร้างใหม่ด้วย AI
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground mb-3">
                                ยังไม่มี summary สำหรับบทนี้
                            </p>
                            <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleGenerate(false)}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        กำลังสร้าง...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        สร้าง Summary ด้วย AI
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

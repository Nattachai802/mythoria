"use client";

import { useState, useCallback } from "react";
import { Pilcrow, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { checkSpacing, type SpacingError } from "@/lib/thai-spacing";

interface ThaiSpacingButtonProps {
    /** ref ของ ReactQuill (quillRef.current) — ใช้ getEditor() */
    editorRef: React.RefObject<any>;
}

/** ตรวจเว้นวรรคไทยตามหลักราชบัณฑิตฯ (rule-based, ฝั่ง Next ล้วน — instant ไม่ผ่าน service)
 *  ปรัชญา: แนะนำ ไม่แก้อัตโนมัติ ผู้เขียนกดข้าม/แก้รายตัวเอง */
export function ThaiSpacingButton({ editorRef }: ThaiSpacingButtonProps) {
    const [open, setOpen] = useState(false);
    const [errors, setErrors] = useState<SpacingError[]>([]);

    const scan = useCallback(() => {
        const editor = editorRef.current?.getEditor();
        const text: string = editor ? editor.getText() : "";
        const found = checkSpacing(text);
        setErrors(found);
        return found;
    }, [editorRef]);

    const handleOpen = (next: boolean) => {
        if (next) {
            const found = scan();
            if (found.length === 0) {
                toast.success("เว้นวรรคถูกต้องตามหลักทั้งหมด");
                return; // ไม่เปิด popover เปล่า
            }
        }
        setOpen(next);
    };

    const jump = (e: SpacingError) => {
        const editor = editorRef.current?.getEditor();
        if (!editor) return;
        editor.focus();
        // เลือกช่องว่าง (หรือวางเคอร์เซอร์ตรงจุดที่ขาด)
        editor.setSelection(e.position, Math.max(e.gapLength, 1));
    };

    const fix = (e: SpacingError) => {
        const editor = editorRef.current?.getEditor();
        if (!editor) return;
        if (e.expected === "SMALL") {
            editor.insertText(e.position, " ");          // เพิ่มช่องว่างที่ขาด
        } else if (e.expected === "NONE") {
            editor.deleteText(e.position, e.gapLength);   // ลบช่องว่างที่ไม่ควรมี
        }
        // index ขยับหลังแก้ → re-scan ใหม่หมด
        const remaining = scan();
        if (remaining.length === 0) {
            toast.success("แก้ครบแล้ว");
            setOpen(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={handleOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] font-mono tracking-wide border-steel-700 hover:border-primary/50 hover:text-primary gap-1.5"
                >
                    <Pilcrow className="h-3 w-3" />
                    เว้นวรรค
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-xs font-medium">จุดเว้นวรรคที่ควรปรับ</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{errors.length} จุด</span>
                </div>
                <ScrollArea className="max-h-72">
                    <div className="p-2 space-y-1.5">
                        {errors.map((e, i) => (
                            <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs space-y-1.5">
                                <p className="leading-relaxed break-words">{e.message}</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground/70 font-mono mr-auto">
                                        กฎ {e.ruleId}
                                    </span>
                                    <button
                                        onClick={() => jump(e)}
                                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5"
                                    >
                                        <ArrowRight className="h-3 w-3" /> ไป
                                    </button>
                                    <button
                                        onClick={() => fix(e)}
                                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline px-1.5 py-0.5"
                                    >
                                        <Check className="h-3 w-3" /> แก้
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <p className="text-[10px] text-muted-foreground px-3 py-2 border-t">
                    ตามหลักราชบัณฑิตฯ — นิยายเว้นวรรคเชิงศิลป์ได้ ข้ามจุดที่ตั้งใจไว้ได้เลย
                </p>
            </PopoverContent>
        </Popover>
    );
}

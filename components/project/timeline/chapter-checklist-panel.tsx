"use client";

import { useState, useTransition } from "react";
import { ListChecks, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getChapterChecklist, type ChecklistItem, type ChecklistKind } from "@/server/chapter-checklist";
import { toast } from "sonner";

const KIND_LABEL: Record<ChecklistKind, string> = {
    dangling_thread: "ปมค้างที่แตะบทนี้",
    no_causal: "ฉากไม่มี causal link",
    no_pov: "ฉากยังไม่ตั้ง POV",
    no_pacing: "ฉากยังไม่ตั้งจังหวะ",
    causality_unsupported: "ตรวจแล้วว่าเหตุ-ผลไม่สมเหตุผล",
    echo_high: "จังหวะพล็อตคาดเดาง่าย (Echo Score สูง)",
};

// ยิงครั้งแรกก่อน sort ค่อยจัดกลุ่ม — เรียงตามลำดับที่คุยกันไว้ใน task.md
const KIND_ORDER: ChecklistKind[] = ["dangling_thread", "no_causal", "no_pov", "no_pacing", "causality_unsupported", "echo_high"];

function itemLabel(item: ChecklistItem): string {
    return item.threadTitle ?? item.sceneTitle ?? "";
}

interface ChapterChecklistPanelProps {
    novelId: string;
    chapterId: string;
}

/** เช็คลิสต์ "บทนี้มีอะไรต้องแก้" — รวม signal ที่มีอยู่แล้วในระบบ plot (task.md 8a)
 * ยิงตอน popover เปิดครั้งแรกเท่านั้น (ไม่ preload ตอนโหลดหน้า กันโหลดข้อมูลที่ไม่ได้ดู) */
export function ChapterChecklistPanel({ novelId, chapterId }: ChapterChecklistPanelProps) {
    const [items, setItems] = useState<ChecklistItem[] | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleOpenChange = (open: boolean) => {
        if (open && items === null && !isPending) {
            startTransition(async () => {
                const res = await getChapterChecklist(novelId, chapterId);
                if (res.success) setItems(res.items);
                else toast.error(res.error);
            });
        }
    };

    const sorted = items ? [...items].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)) : [];

    return (
        <Popover onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 chamfered-sm font-technical text-[9px] uppercase tracking-[0.08em] bg-transparent border-zinc-700 text-zinc-300 hover:text-zinc-100"
                >
                    <ListChecks className="h-3.5 w-3.5" />เช็คลิสต์บทนี้
                </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-96 p-4 space-y-3 max-h-[70vh] overflow-y-auto">
                <p className="font-technical text-[10px] uppercase tracking-wide text-muted-foreground">
                    บทนี้มีอะไรต้องแก้
                </p>

                {isPending && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังตรวจ…
                    </div>
                )}

                {!isPending && items && sorted.length === 0 && (
                    <p className="text-xs text-muted-foreground italic py-2">ไม่มีอะไรต้องแก้ตอนนี้</p>
                )}

                {!isPending && sorted.length > 0 && (
                    <ul className="space-y-1.5">
                        {sorted.map((item, i) => (
                            <li key={i} className="text-sm leading-snug flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                                <span>
                                    <span className="text-foreground">{KIND_LABEL[item.kind]}</span>
                                    {itemLabel(item) && <span className="text-muted-foreground"> — {itemLabel(item)}</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </PopoverContent>
        </Popover>
    );
}

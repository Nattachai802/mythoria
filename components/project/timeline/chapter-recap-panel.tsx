"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { runChapterRecap } from "@/server/plot-recap";
import { toast } from "sonner";

interface ChapterRecapButtonProps {
    novelId: string;
    chapterId: string;
    initialRecap?: string | null;
}

/**
 * สรุปทั้งบท — สังเคราะห์จากสรุปฉากทุกฉากในบท (ระดับเหนือกว่า SceneRecapPanel)
 * เป็นปุ่ม + popover เพราะ header ของ ChapterOverviewBoard สูงแค่ 56px ไม่มีที่วาง panel เต็ม
 */
export function ChapterRecapButton({ novelId, chapterId, initialRecap }: ChapterRecapButtonProps) {
    const [recap, setRecap] = useState<string | null>(initialRecap ?? null);
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const handleRun = () => {
        startTransition(async () => {
            const result = await runChapterRecap(novelId, chapterId);
            if (result.success) {
                setRecap(result.recap);
                if (!result.skipped) toast.success("สรุปบทเสร็จแล้ว");
            } else {
                toast.error(result.error);
            }
        });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 chamfered-sm font-technical text-[9px] uppercase tracking-[0.08em] bg-transparent border-zinc-700 text-zinc-300 hover:text-zinc-100"
                >
                    <FileText className="h-3.5 w-3.5" />สรุปบท
                </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-96 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <p className="font-technical text-[10px] uppercase tracking-wide text-muted-foreground">
                        สรุปบท (จากโครงพล็อต)
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRun}
                        disabled={isPending}
                        className="h-7 gap-1.5 text-xs"
                    >
                        {isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : recap ? (
                            <RefreshCw className="h-3 w-3" />
                        ) : (
                            <FileText className="h-3 w-3" />
                        )}
                        {isPending ? "กำลังสรุป…" : recap ? "สรุปใหม่" : "สรุปบทนี้"}
                    </Button>
                </div>

                {recap ? (
                    <p
                        className="text-sm leading-relaxed text-foreground"
                        style={{ opacity: isPending ? 0.4 : 1, transition: "opacity 0.2s" }}
                    >
                        {recap}
                    </p>
                ) : (
                    <p className="text-xs text-muted-foreground italic">ยังไม่เคยสรุปบทนี้</p>
                )}
            </PopoverContent>
        </Popover>
    );
}

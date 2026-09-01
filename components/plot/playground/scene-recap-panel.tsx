"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { runSceneRecap } from "@/server/plot-recap";
import type { CausalityVerdict } from "@/lib/plot-recap";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

interface SceneRecapPanelProps {
    novelId: string;
    sceneId: string;
    initialRecap?: { recap: string; causality?: CausalityVerdict; causalityNote?: string } | null;
}

const CAUSALITY_LABEL: Record<Exclude<CausalityVerdict, "not_stated">, { text: string; icon: typeof AlertTriangle; cls: string }> = {
    unsupported: { text: "อ้างเหตุ-ผลไว้ แต่เนื้อฉากไม่ได้แสดง", icon: AlertTriangle, cls: "text-amber-600 dark:text-amber-400" },
    unclear: { text: "ความเชื่อมโยงเหตุ-ผลก้ำกึ่ง", icon: HelpCircle, cls: "text-muted-foreground" },
    supported: { text: "เหตุ-ผลสอดคล้องกับเนื้อฉาก", icon: FileText, cls: "text-emerald-600 dark:text-emerald-400" },
};

/**
 * ปุ่มเดียวในทูลบาร์ (เข้าชุดกับ EchoScorePanel) — ผลโผล่เป็น popover แทนแถบเต็มความกว้างแบบเดิม
 * เพราะสรุปฉากเป็นย่อหน้าเดียวระดับฉาก ไม่มี "การ์ด" ให้กระจายผลไปเกาะแบบ Echo Score
 *
 * ปุ่มเดียวทำสองหน้าที่: กด = สั่งสรุป (มี hash-skip ในตัวอยู่แล้ว ไม่เปลืองถ้าไม่มีอะไรเปลี่ยน)
 * และ Popover เปิด/ปิดตาม default ของ Radix trigger — ไม่ควบคุม state เอง
 */
export function SceneRecapPanel({ novelId, sceneId, initialRecap }: SceneRecapPanelProps) {
    const [recap, setRecap] = useState<string | null>(initialRecap?.recap ?? null);
    const [causality, setCausality] = useState<CausalityVerdict | undefined>(initialRecap?.causality);
    const [causalityNote, setCausalityNote] = useState<string | undefined>(initialRecap?.causalityNote);
    const [isPending, startTransition] = useTransition();

    const handleRun = () => {
        startTransition(async () => {
            const result = await runSceneRecap(novelId, sceneId);
            if (result.success) {
                setRecap(result.recap);
                setCausality(result.causality);
                setCausalityNote(result.causalityNote);
                if (!result.skipped) toast.success("สรุปฉากเสร็จแล้ว");
            } else {
                toast.error(result.error);
            }
        });
    };

    const causalityInfo = causality && causality !== "not_stated" ? CAUSALITY_LABEL[causality] : null;
    const hasWarning = causality === "unsupported";

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRun}
                    disabled={isPending}
                    className="h-8 gap-1.5 text-xs relative"
                    title="สรุปฉากนี้ + ตรวจเหตุ-ผล"
                >
                    {isPending ? (
                        <Loader2 size={13} className="animate-spin" />
                    ) : recap ? (
                        <RefreshCw size={13} />
                    ) : (
                        <FileText size={13} />
                    )}
                    {isPending ? "กำลังสรุป…" : recap ? "สรุปฉากใหม่" : "สรุปฉาก"}
                    {hasWarning && (
                        <span
                            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full"
                            style={{ background: "var(--forge-amber)" }}
                            title={causalityInfo?.text}
                        />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-2.5 text-sm">
                {recap ? (
                    <p className="leading-relaxed text-foreground">{recap}</p>
                ) : (
                    <p className="text-xs text-muted-foreground">ยังไม่เคยสรุปฉากนี้ — กด "สรุปฉาก" เพื่อเริ่ม</p>
                )}
                {causalityInfo && (
                    <div className="flex items-start gap-1.5 border-t border-border/60 pt-2 text-xs">
                        <causalityInfo.icon size={13} className={`shrink-0 mt-0.5 ${causalityInfo.cls}`} />
                        <span className={causalityInfo.cls}>
                            {causalityInfo.text}
                            {causalityNote && <span className="text-muted-foreground"> — {causalityNote}</span>}
                        </span>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}

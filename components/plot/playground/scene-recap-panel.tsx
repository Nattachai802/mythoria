"use client";

import { useState, useTransition } from "react";
import { FileText, Loader2, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";
import { runSceneRecap } from "@/server/plot-recap";
import type { CausalityVerdict } from "@/lib/plot-recap";
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
 * สรุปฉากจากโครงสร้างบนกระดาน (cast/threads/beats) — คนละอันกับ Echo Score
 * (นั่นวัดความคาดเดาได้ นี่แค่เล่าให้ฟังว่าฉากนี้เกิดอะไรขึ้น)
 *
 * ยิงคอลเดียวได้ 2 อย่าง: สรุปฉาก + ตรวจว่า causeKind/causeNote ที่ตั้งไว้สมเหตุผลกับเนื้อฉากไหม
 * (อ่าน context เดียวกันอยู่แล้ว ไม่ต้องยิงเพิ่มสำหรับ causality)
 *
 * pattern เดียวกับ EchoScorePanel: ปุ่ม opt-in, แคชผลไว้ ไม่ auto-run
 */
export function SceneRecapPanel({ novelId, sceneId, initialRecap }: SceneRecapPanelProps) {
    const [recap, setRecap] = useState<string | null>(initialRecap?.recap ?? null);
    const [causality, setCausality] = useState<CausalityVerdict | undefined>(initialRecap?.causality);
    const [causalityNote, setCausalityNote] = useState<string | undefined>(initialRecap?.causalityNote);
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <div
            className="chamfered"
            style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
            }}
        >
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between gap-3 text-left transition-colors hover:bg-accent/50"
                style={{ padding: "10px 16px" }}
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <FileText size={14} style={{ color: "var(--forge-gold)", flexShrink: 0 }} />
                    <span
                        style={{
                            fontFamily: "var(--font-technical)",
                            fontSize: 12,
                            color: "var(--muted-foreground)",
                            letterSpacing: "0.04em",
                        }}
                    >
                        สรุปฉาก
                    </span>
                    {causalityInfo && causality === "unsupported" && (
                        <span title={causalityInfo.text} style={{ display: "inline-flex" }}>
                            <AlertTriangle size={12} style={{ color: "var(--forge-gold)" }} />
                        </span>
                    )}
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        transform: isOpen ? "rotate(180deg)" : undefined,
                        transition: "transform 0.15s",
                    }}
                >
                    ▾
                </span>
            </button>

            {isOpen && (
                <div
                    style={{
                        borderTop: "1px solid var(--border)",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p
                            style={{
                                fontFamily: "var(--font-technical)",
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                                margin: 0,
                            }}
                        >
                            ใช้ AI · สรุปฉาก + ตรวจเหตุ-ผลในคอลเดียว
                        </p>
                        <button
                            onClick={handleRun}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-60"
                            style={{ minHeight: 36, borderColor: "var(--border)" }}
                        >
                            {isPending ? (
                                <Loader2 size={13} className="animate-spin" />
                            ) : recap ? (
                                <RefreshCw size={13} />
                            ) : (
                                <FileText size={13} />
                            )}
                            {isPending ? "กำลังสรุป…" : recap ? "สรุปใหม่" : "สรุปฉากนี้"}
                        </button>
                    </div>

                    {recap && (
                        <p
                            style={{
                                fontSize: 13,
                                lineHeight: 1.6,
                                color: "var(--foreground)",
                                margin: 0,
                                opacity: isPending ? 0.4 : 1,
                                transition: "opacity 0.2s",
                            }}
                        >
                            {recap}
                        </p>
                    )}

                    {causalityInfo && (
                        <div
                            className="flex items-start gap-1.5"
                            style={{ fontSize: 12, opacity: isPending ? 0.4 : 1, transition: "opacity 0.2s" }}
                        >
                            <causalityInfo.icon size={13} className={`shrink-0 mt-0.5 ${causalityInfo.cls}`} />
                            <span className={causalityInfo.cls}>
                                {causalityInfo.text}
                                {causalityNote && <span className="text-muted-foreground"> — {causalityNote}</span>}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target, Calendar, Zap, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateNovel } from "@/server/novel";
import { cn } from "@/lib/utils";

interface WritingGoalsSettingsCardProps {
    novelId: string;
    initialTargetWordCount?: number | null;
    initialTargetDeadline?: Date | null;
    initialDailyTargetMode?: string | null;
    initialDailyTargetWordCount?: number | null;
}

export function WritingGoalsSettingsCard({
    novelId,
    initialTargetWordCount,
    initialTargetDeadline,
    initialDailyTargetMode,
    initialDailyTargetWordCount,
}: WritingGoalsSettingsCardProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [targetWordCount, setTargetWordCount] = useState<string>(
        initialTargetWordCount?.toString() ?? ""
    );
    const [deadline, setDeadline] = useState<string>(
        initialTargetDeadline
            ? new Date(initialTargetDeadline).toISOString().split("T")[0]
            : ""
    );
    const [dailyMode, setDailyMode] = useState<"dynamic" | "static">(
        (initialDailyTargetMode as "dynamic" | "static") ?? "dynamic"
    );
    const [dailyTarget, setDailyTarget] = useState<string>(
        initialDailyTargetWordCount?.toString() ?? "1000"
    );

    // ---- derived: days remaining & estimated daily from form values ----
    const estimatedDaily = (() => {
        if (dailyMode === "static") return parseInt(dailyTarget) || 0;
        if (!deadline || !targetWordCount) return null;
        const words = parseInt(targetWordCount) || 0;
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        const days = Math.max(1, Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000));
        return Math.ceil(words / days);
    })();

    const daysLeft = (() => {
        if (!deadline) return null;
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000));
    })();

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateNovel(novelId, {
                targetWordCount: targetWordCount ? parseInt(targetWordCount) : undefined,
                targetDeadline: deadline ? new Date(deadline) : undefined,
                dailyTargetMode: dailyMode,
                dailyTargetWordCount: parseInt(dailyTarget) || 1000,
            } as any);

            if (result.success) {
                toast.success("บันทึกเป้าหมายการเขียนแล้ว");
                router.refresh();
            } else {
                toast.error("บันทึกไม่สำเร็จ กรุณาลองใหม่");
            }
        });
    };

    return (
        <div className="border border-border chamfered bg-card/60">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
                <div className="p-1.5 bg-[var(--forge-gold)]/10 chamfered-sm">
                    <Target className="h-4 w-4 text-[var(--forge-gold)]" />
                </div>
                <div>
                    <h2 className="text-sm font-semibold">เป้าหมายและเดดไลน์การเขียน</h2>
                    <p className="text-xs text-muted-foreground">กำหนดจำนวนคำและวันที่ต้องการเขียนให้เสร็จ</p>
                </div>
            </div>

            <div className="p-5 space-y-6">
                {/* Target Word Count */}
                <div className="space-y-2">
                    <Label htmlFor="targetWordCount" className="text-xs font-medium flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                        เป้าหมายจำนวนคำทั้งเรื่อง
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="targetWordCount"
                            type="number"
                            min={0}
                            placeholder="เช่น 100000"
                            value={targetWordCount}
                            onChange={(e) => setTargetWordCount(e.target.value)}
                            className="max-w-[200px] font-mono"
                        />
                        <span className="text-sm text-muted-foreground">คำ</span>
                    </div>
                </div>

                {/* Deadline */}
                <div className="space-y-2">
                    <Label htmlFor="deadline" className="text-xs font-medium flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        วันที่ต้องการเขียนให้เสร็จ (Deadline)
                    </Label>
                    <Input
                        id="deadline"
                        type="date"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="max-w-[200px]"
                        min={new Date().toISOString().split("T")[0]}
                    />
                    {daysLeft !== null && (
                        <p className="text-xs text-muted-foreground">
                            เหลืออีก <span className="font-semibold text-foreground">{daysLeft}</span> วัน
                        </p>
                    )}
                </div>

                {/* Daily Target Mode */}
                <div className="space-y-3">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        โหมดเป้าหมายรายวัน
                    </Label>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Dynamic Mode */}
                        <button
                            type="button"
                            onClick={() => setDailyMode("dynamic")}
                            className={cn(
                                "flex flex-col gap-1.5 p-3 text-left border chamfered-sm transition-all",
                                dailyMode === "dynamic"
                                    ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/5"
                                    : "border-border hover:border-border/80 hover:bg-muted/30"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">อัตโนมัติ (Dynamic)</span>
                                {dailyMode === "dynamic" && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--forge-gold)]" />
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug">
                                คำนวณใหม่ทุกวันจาก "คำที่เหลือ ÷ วันที่เหลือ"
                            </p>
                        </button>

                        {/* Static Mode */}
                        <button
                            type="button"
                            onClick={() => setDailyMode("static")}
                            className={cn(
                                "flex flex-col gap-1.5 p-3 text-left border chamfered-sm transition-all",
                                dailyMode === "static"
                                    ? "border-[var(--forge-gold)] bg-[var(--forge-gold)]/5"
                                    : "border-border hover:border-border/80 hover:bg-muted/30"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold">กำหนดเอง (Static)</span>
                                {dailyMode === "static" && (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-[var(--forge-gold)]" />
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-snug">
                                เขียนจำนวนคำคงที่ที่กำหนดไว้ทุกวัน
                            </p>
                        </button>
                    </div>

                    {/* Static daily target input */}
                    {dailyMode === "static" && (
                        <div className="flex items-center gap-2 pt-1">
                            <Input
                                id="dailyTarget"
                                type="number"
                                min={100}
                                max={50000}
                                value={dailyTarget}
                                onChange={(e) => setDailyTarget(e.target.value)}
                                className="max-w-[160px] font-mono"
                            />
                            <span className="text-sm text-muted-foreground">คำ / วัน</span>
                        </div>
                    )}
                </div>

                {/* Estimate Preview */}
                {estimatedDaily !== null && (
                    <div className="border border-border/60 chamfered-sm bg-muted/30 p-3 flex items-center gap-3">
                        <Target className="h-4 w-4 text-[var(--forge-gold)] shrink-0" />
                        <div>
                            <p className="text-xs text-muted-foreground">เป้าหมายรายวันประมาณการ</p>
                            <p className="text-sm font-display font-bold tabular-nums">
                                {estimatedDaily.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">คำ / วัน</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end pt-1">
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        size="sm"
                        className="bg-[var(--forge-gold)] text-black hover:bg-[var(--forge-gold)]/90 font-semibold"
                    >
                        {isPending ? "กำลังบันทึก..." : "บันทึกเป้าหมาย"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

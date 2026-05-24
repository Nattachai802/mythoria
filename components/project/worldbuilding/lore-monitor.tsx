"use client";

import { useEffect, useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Loader2, CheckCircle2, XCircle, RefreshCw, Clock } from "lucide-react";
import { getLoreExtractionStatuses } from "@/server/lore";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

interface LoreMonitorProps {
    novelId: string;
    onRefresh: () => void;
}

export function LoreMonitor({ novelId, onRefresh }: LoreMonitorProps) {
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const prevEntriesRef = useRef<any[]>([]);

    const fetchStatuses = async (showLoadingState = false) => {
        if (showLoadingState) setLoading(true);
        try {
            const res = await getLoreExtractionStatuses(novelId);
            if (res.success && res.data) {
                setEntries(res.data);
            }
        } catch (error) {
            console.error("Error fetching extraction statuses:", error);
        } finally {
            if (showLoadingState) setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        fetchStatuses(true);
    }, [novelId]);

    // Check for changes to trigger onRefresh
    useEffect(() => {
        const prev = prevEntriesRef.current;
        let shouldRefresh = false;

        entries.forEach((currentEntry) => {
            const previousEntry = prev.find((p) => p.id === currentEntry.id);
            if (previousEntry) {
                // If it was processing/pending and now is completed/failed
                const wasRunning = previousEntry.extractionStatus === "pending" || previousEntry.extractionStatus === "processing";
                const isFinished = currentEntry.extractionStatus === "completed" || currentEntry.extractionStatus === "failed";
                if (wasRunning && isFinished) {
                    shouldRefresh = true;
                }
            } else {
                // It's a new entry and it is already finished
                const isFinished = currentEntry.extractionStatus === "completed" || currentEntry.extractionStatus === "failed";
                if (isFinished) {
                    shouldRefresh = true;
                }
            }
        });

        prevEntriesRef.current = entries;

        if (shouldRefresh) {
            console.log("[LoreMonitor] Extraction finished, refreshing parent UI...");
            onRefresh();
        }
    }, [entries, onRefresh]);

    // Polling logic: poll every 3 seconds if there is a pending or processing item
    useEffect(() => {
        const hasActiveTasks = entries.some(
            (e) => e.extractionStatus === "pending" || e.extractionStatus === "processing"
        );

        if (!hasActiveTasks) return;

        const interval = setInterval(() => {
            fetchStatuses(false);
        }, 3000);

        return () => clearInterval(interval);
    }, [entries]);

    const activeCount = entries.filter(
        (e) => e.extractionStatus === "pending" || e.extractionStatus === "processing"
    ).length;

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="relative flex items-center gap-2 border-primary/20 hover:border-primary/50"
                >
                    {activeCount > 0 ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="hidden sm:inline text-xs font-medium">ติดตามสถานะ AI</span>
                    {activeCount > 0 && (
                        <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-[10px] animate-pulse">
                            {activeCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">การวิเคราะห์ข้อมูล AI</h4>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => fetchStatuses(true)}
                        disabled={loading}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
                <ScrollArea className="h-72">
                    {entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs gap-1.5 p-4 text-center">
                            <Clock className="h-6 w-6 stroke-[1.5]" />
                            <p>ไม่มีประวัติการวิเคราะห์ล่าสุด</p>
                            <p className="text-[10px] text-muted-foreground/80">ระบบจะประมวลผลเมื่อคุณเขียนเนื้อหา Lore</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {entries.map((entry) => {
                                const isPending = entry.extractionStatus === "pending";
                                const isProcessing = entry.extractionStatus === "processing";
                                const isCompleted = entry.extractionStatus === "completed";
                                const isFailed = entry.extractionStatus === "failed";

                                return (
                                    <div key={entry.id} className="p-3 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <p className="text-xs font-semibold truncate text-foreground">
                                                    {entry.title}
                                                </p>
                                                {isFailed && entry.extractionError && (
                                                    <p className="text-[10px] text-destructive leading-tight break-words">
                                                        ข้อผิดพลาด: {entry.extractionError}
                                                    </p>
                                                )}
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <span>อัปเดตเมื่อ:</span>
                                                    <span>
                                                        {formatDistanceToNow(new Date(entry.updatedAt), {
                                                            addSuffix: true,
                                                            locale: th,
                                                        })}
                                                    </span>
                                                </p>
                                            </div>
                                            <div>
                                                {isPending && (
                                                    <Badge variant="outline" className="text-[10px] font-normal border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1 animate-pulse">
                                                        <Clock className="h-3 w-3" />
                                                        รอคิว
                                                    </Badge>
                                                )}
                                                {isProcessing && (
                                                    <Badge variant="outline" className="text-[10px] font-normal border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 gap-1">
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        กำลังวิเคราะห์
                                                    </Badge>
                                                )}
                                                {isCompleted && (
                                                    <Badge variant="outline" className="text-[10px] font-normal border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        สำเร็จ
                                                    </Badge>
                                                )}
                                                {isFailed && (
                                                    <Badge variant="outline" className="text-[10px] font-normal border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 gap-1">
                                                        <XCircle className="h-3 w-3" />
                                                        ล้มเหลว
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}

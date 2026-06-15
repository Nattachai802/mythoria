"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface WordsChartProps {
    data: { date: string; words: number }[];
}

const BAR_MAX = 150;

export function WordsChart({ data }: WordsChartProps) {
    const maxWords = useMemo(() => Math.max(...data.map(d => d.words), 1), [data]);

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
        return days[date.getDay()];
    };

    const getBarHeight = (words: number) => {
        if (words === 0) return 3;
        return Math.max(3, (words / maxWords) * BAR_MAX);
    };

    // Forge-gold intensity ramp
    const getBarColor = (words: number) => {
        if (words === 0) return "bg-muted";
        if (words < 500) return "bg-[var(--forge-gold)]/30";
        if (words < 1000) return "bg-[var(--forge-gold)]/55";
        if (words < 2000) return "bg-[var(--forge-gold)]/78";
        return "bg-[var(--forge-gold)]";
    };

    const totalWords = useMemo(() => data.reduce((sum, d) => sum + d.words, 0), [data]);
    const avgWords = useMemo(() => Math.round(totalWords / data.length), [totalWords, data.length]);
    const avgPx = useMemo(() => (avgWords / maxWords) * BAR_MAX, [avgWords, maxWords]);
    const today = useMemo(() => new Date().toISOString().split('T')[0], []);

    return (
        <div className="space-y-3">
            {/* Plot area with average reference line */}
            <div className="relative pt-5">
                {/* Average line */}
                {avgWords > 0 && (
                    <div
                        className="absolute left-0 right-0 z-[1] pointer-events-none flex items-center"
                        style={{ bottom: `${avgPx}px` }}
                    >
                        <div className="flex-1 border-t border-dashed border-[var(--forge-gold)]/40" />
                        <span className="ml-2 font-technical text-[9px] tabular-nums text-[var(--forge-gold)]/80 bg-card/80 px-1">
                            เฉลี่ย {avgWords.toLocaleString()}
                        </span>
                    </div>
                )}

                {/* Bars */}
                <div className="relative z-[2] flex items-end justify-between gap-2" style={{ height: `${BAR_MAX}px` }}>
                    {data.map((item) => {
                        const isToday = item.date === today;
                        return (
                            <div key={item.date} className="flex flex-col items-center justify-end flex-1 h-full">
                                <span className={cn(
                                    "text-[10px] font-medium tabular-nums mb-1.5",
                                    isToday ? "text-[var(--forge-gold)]" : "text-muted-foreground"
                                )}>
                                    {item.words > 0 ? item.words.toLocaleString() : ''}
                                </span>
                                <div
                                    className={cn(
                                        "w-full max-w-[44px] rounded-t-sm transition-all duration-500",
                                        getBarColor(item.words),
                                        isToday && "ring-1 ring-[var(--forge-gold)]/50 ring-offset-1 ring-offset-card"
                                    )}
                                    style={{ height: `${getBarHeight(item.words)}px` }}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Day labels */}
            <div className="flex items-center justify-between gap-2">
                {data.map((item) => {
                    const isToday = item.date === today;
                    return (
                        <span
                            key={item.date}
                            className={cn(
                                "flex-1 text-center text-[11px]",
                                isToday ? "text-[var(--forge-gold)] font-semibold" : "text-muted-foreground"
                            )}
                        >
                            {getDayName(item.date)}
                        </span>
                    );
                })}
            </div>

            {/* Footer readout */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60">
                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                    รวม 7 วัน
                </span>
                <span className="text-sm font-semibold tabular-nums">
                    {totalWords.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">คำ</span>
                </span>
            </div>
        </div>
    );
}

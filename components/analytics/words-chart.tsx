"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface WordsChartProps {
    data: { date: string; words: number }[];
}

export function WordsChart({ data }: WordsChartProps) {
    const maxWords = useMemo(() => {
        const max = Math.max(...data.map(d => d.words), 1);
        return max;
    }, [data]);

    const getDayName = (dateStr: string) => {
        const date = new Date(dateStr);
        const days = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
        return days[date.getDay()];
    };

    const getBarHeight = (words: number) => {
        if (words === 0) return 4; // Minimum height
        return Math.max(4, (words / maxWords) * 160);
    };

    const getBarColor = (words: number) => {
        if (words === 0) return "bg-muted";
        if (words < 500) return "bg-violet-300 dark:bg-violet-700";
        if (words < 1000) return "bg-violet-400 dark:bg-violet-600";
        if (words < 2000) return "bg-violet-500 dark:bg-violet-500";
        return "bg-violet-600 dark:bg-violet-400";
    };

    const totalWords = useMemo(() => data.reduce((sum, d) => sum + d.words, 0), [data]);
    const avgWords = useMemo(() => Math.round(totalWords / data.length), [totalWords, data.length]);

    return (
        <div className="space-y-4">
            {/* Chart */}
            <div className="flex items-end justify-between gap-2 h-48 px-4">
                {data.map((item, index) => (
                    <div key={item.date} className="flex flex-col items-center gap-2 flex-1">
                        {/* Value label */}
                        <span className="text-xs text-muted-foreground font-medium">
                            {item.words > 0 ? item.words.toLocaleString() : '-'}
                        </span>

                        {/* Bar */}
                        <div
                            className={cn(
                                "w-full max-w-12 rounded-t-lg transition-all duration-500",
                                getBarColor(item.words)
                            )}
                            style={{ height: `${getBarHeight(item.words)}px` }}
                        />

                        {/* Day label */}
                        <span className="text-xs text-muted-foreground">
                            {getDayName(item.date)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Average line indicator */}
            <div className="flex items-center justify-between px-4 pt-2 border-t">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-0.5 bg-violet-500 rounded" />
                    <span className="text-xs text-muted-foreground">
                        รวม 7 วัน: <span className="font-medium">{totalWords.toLocaleString()}</span> คำ
                    </span>
                </div>
                <span className="text-xs text-muted-foreground">
                    เฉลี่ย: <span className="font-medium">{avgWords.toLocaleString()}</span> คำ/วัน
                </span>
            </div>
        </div>
    );
}

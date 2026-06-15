"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ActivityCalendarProps {
    activity: { date: string; count: number; words: number }[];
    large?: boolean;
}

export function ActivityCalendar({ activity, large = false }: ActivityCalendarProps) {
    const activityMap = useMemo(() => {
        const map = new Map<string, { count: number; words: number }>();
        for (const item of activity) {
            map.set(item.date, { count: item.count, words: item.words });
        }
        return map;
    }, [activity]);

    const days = useMemo(() => {
        const result: { date: string; dayOfWeek: number; count: number; words: number }[] = [];
        const today = new Date();

        for (let i = 89; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const data = activityMap.get(dateStr) || { count: 0, words: 0 };

            result.push({
                date: dateStr,
                dayOfWeek: date.getDay(),
                count: data.count,
                words: data.words,
            });
        }

        return result;
    }, [activityMap]);

    const weeks = useMemo(() => {
        const result: typeof days[] = [];
        let currentWeek: typeof days = [];

        const firstDay = days[0];
        if (firstDay) {
            for (let i = 0; i < firstDay.dayOfWeek; i++) {
                currentWeek.push({ date: '', dayOfWeek: i, count: -1, words: 0 });
            }
        }

        for (const day of days) {
            currentWeek.push(day);
            if (day.dayOfWeek === 6) {
                result.push(currentWeek);
                currentWeek = [];
            }
        }

        if (currentWeek.length > 0) {
            result.push(currentWeek);
        }

        return result;
    }, [days]);

    // Month label for each week column: show when first real day of week is day 1–7 of a new month
    const monthLabels = useMemo(() => {
        return weeks.map((week) => {
            const firstReal = week.find(d => d.date !== '');
            if (!firstReal) return null;
            const d = new Date(firstReal.date);
            if (d.getDate() <= 7) {
                return d.toLocaleDateString('th-TH', { month: 'short' });
            }
            return null;
        });
    }, [weeks]);

    const getIntensity = (words: number): number => {
        if (words === 0) return 0;
        if (words < 500) return 1;
        if (words < 1000) return 2;
        if (words < 2000) return 3;
        return 4;
    };

    const intensityColors = [
        "bg-muted",
        "bg-[var(--forge-gold)]/20",
        "bg-[var(--forge-gold)]/40",
        "bg-[var(--forge-gold)]/70",
        "bg-[var(--forge-gold)]",
    ];

    const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    const cellSize = large ? "w-7 h-7" : "w-6 h-6";
    const gap = large ? "gap-2" : "gap-1.5";
    const labelH = large ? "h-7" : "h-6";

    return (
        <div className={cn("flex flex-col", large ? "gap-5" : "gap-5")}>
            <div className="flex gap-3">
                {/* Day-of-week labels */}
                <div className={cn("flex flex-col pt-5 pr-2 text-xs text-muted-foreground", gap)}>
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <div key={day} className={cn(labelH, "flex items-center")}>
                            {day % 2 === 1 ? dayLabels[day] : ''}
                        </div>
                    ))}
                </div>

                {/* Grid + month labels */}
                <div className="flex flex-col gap-1 overflow-x-auto pb-1 w-full">
                    {/* Month labels row */}
                    <div className={cn("flex", gap)}>
                        {weeks.map((_, wi) => (
                            <div key={wi} className={cn("flex-shrink-0 text-[9px] text-muted-foreground/60", large ? "w-7" : "w-6")}>
                                {monthLabels[wi] ?? ''}
                            </div>
                        ))}
                    </div>

                    {/* Week columns */}
                    <div className={cn("flex", gap)}>
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className={cn("flex flex-col flex-shrink-0", gap)}>
                                {week.map((day) => (
                                    day.count === -1 ? (
                                        <div key={day.date || `empty-${day.dayOfWeek}`} className={cellSize} />
                                    ) : (
                                        <Tooltip key={day.date}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        cellSize,
                                                        "chamfered-sm cursor-pointer transition-colors hover:ring-2 hover:ring-[var(--forge-gold)]/50",
                                                        intensityColors[getIntensity(day.words)]
                                                    )}
                                                />
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-sm">
                                                <p className="font-medium">{day.words.toLocaleString()} คำ</p>
                                                <p className="text-muted-foreground">
                                                    {new Date(day.date).toLocaleDateString('th-TH', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span>น้อย</span>
                {intensityColors.map((color, index) => (
                    <div key={index} className={cn("chamfered-sm", color, large ? "w-4 h-4" : "w-3.5 h-3.5")} />
                ))}
                <span>มาก</span>
            </div>
        </div>
    );
}

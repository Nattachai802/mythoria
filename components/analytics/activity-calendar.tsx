"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ActivityCalendarProps {
    activity: { date: string; count: number; words: number }[];
}

export function ActivityCalendar({ activity }: ActivityCalendarProps) {
    // Create a map for quick lookup
    const activityMap = useMemo(() => {
        const map = new Map<string, { count: number; words: number }>();
        for (const item of activity) {
            map.set(item.date, { count: item.count, words: item.words });
        }
        return map;
    }, [activity]);

    // Generate last 90 days
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

    // Group by weeks
    const weeks = useMemo(() => {
        const result: typeof days[] = [];
        let currentWeek: typeof days = [];

        // Fill in empty days at the start
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

        // Add remaining days
        if (currentWeek.length > 0) {
            result.push(currentWeek);
        }

        return result;
    }, [days]);

    // Get intensity level (0-4)
    const getIntensity = (words: number): number => {
        if (words === 0) return 0;
        if (words < 500) return 1;
        if (words < 1000) return 2;
        if (words < 2000) return 3;
        return 4;
    };

    const intensityColors = [
        "bg-muted",
        "bg-emerald-200 dark:bg-emerald-900",
        "bg-emerald-300 dark:bg-emerald-700",
        "bg-emerald-500 dark:bg-emerald-500",
        "bg-emerald-600 dark:bg-emerald-400",
    ];

    const dayLabels = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    return (
        <div className="space-y-6 flex flex-col h-full justify-center">
            <div className="flex gap-3">
                {/* Day labels */}
                <div className="flex flex-col gap-2 pr-4 text-sm text-muted-foreground mt-1">
                    {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                        <div key={day} className="h-6 flex items-center">
                            {day % 2 === 1 ? dayLabels[day] : ''}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="flex gap-2 overflow-x-auto pb-2 w-full">
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-2">
                            {week.map((day) => (
                                day.count === -1 ? (
                                    <div key={day.date || `empty-${day.dayOfWeek}`} className="w-6 h-6" />
                                ) : (
                                    <Tooltip key={day.date}>
                                        <TooltipTrigger asChild>
                                            <div
                                                className={cn(
                                                    "w-6 h-6 rounded-md cursor-pointer transition-colors hover:ring-2 hover:ring-foreground/20",
                                                    intensityColors[getIntensity(day.words)]
                                                )}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-sm">
                                            <p className="font-medium">{day.words.toLocaleString()} words</p>
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

            {/* Legend */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2">
                <span>น้อย</span>
                {intensityColors.map((color, index) => (
                    <div
                        key={index}
                        className={cn("w-4 h-4 rounded-md", color)}
                    />
                ))}
                <span>มาก</span>
            </div>
        </div>
    );
}

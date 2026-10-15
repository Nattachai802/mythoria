"use client";

import { useRouter } from "next/navigation";
import type { TimelineEvent } from "@/db/schema";
import type { ThreadWithBeats } from "@/server/plot-threads";
import type { ChapterForBoard } from "@/components/project/timeline/types";
import { useThreadWarnCount } from "@/components/project/timeline/plot-thread-ledger";

interface PlotPageTabsProps {
    novelId: string;
    activeTab: "board" | "threads";
    threads: ThreadWithBeats[];
    events: TimelineEvent[];
    chapters: ChapterForBoard[];
}

export function PlotPageTabs({ novelId, activeTab, threads, events, chapters }: PlotPageTabsProps) {
    const router = useRouter();
    const warnCount = useThreadWarnCount({ threads, events, chapters });

    const tabs = [
        { id: "board" as const, label: "กระดาน", href: `/dashboard/project/${novelId}/plot` },
        { id: "threads" as const, label: "ปมเรื่อง", href: `/dashboard/project/${novelId}/plot?tab=threads` },
    ];

    return (
        <div role="tablist" aria-label="โหมดหน้าพล็อต" className="flex gap-1" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
            {tabs.map(tab => {
                const isActive = tab.id === activeTab;
                return (
                    <button
                        key={tab.id}
                        id={`plot-tab-${tab.id}`}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => router.push(tab.href)}
                        style={{
                            padding: "8px 16px",
                            border: "none",
                            background: "transparent",
                            borderBottom: isActive ? "2px solid var(--forge-gold)" : "2px solid transparent",
                            color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
                            fontFamily: "var(--font-technical)",
                            fontSize: 13,
                            fontWeight: isActive ? 600 : 400,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            marginBottom: -1,
                        }}
                    >
                        {tab.label}
                        {tab.id === "threads" && warnCount > 0 && (
                            <span className="ml-1.5 tabular-nums text-[var(--forge-amber)]" aria-label={`${warnCount} ปมต้องดู`}>⚠{warnCount}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

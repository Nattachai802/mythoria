"use client";

import { useRouter } from "next/navigation";

interface PlotPageTabsProps {
    novelId: string;
    activeTab: "board" | "analysis";
}

export function PlotPageTabs({ novelId, activeTab }: PlotPageTabsProps) {
    const router = useRouter();

    const tabs = [
        { id: "board" as const, label: "กระดาน", href: `/dashboard/project/${novelId}/plot` },
        { id: "analysis" as const, label: "วิเคราะห์", href: `/dashboard/project/${novelId}/plot?tab=analysis` },
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
                    </button>
                );
            })}
        </div>
    );
}

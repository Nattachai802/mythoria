"use client";

import { useState, useTransition } from "react";
import type { PlotFinding } from "@/lib/plot-analysis";
import { setPlotFindingVerdict } from "@/server/plot-analysis";

interface FindingRowProps {
    finding: PlotFinding;
    novelId: string;
    initialVerdict: string | null;
    size?: "main" | "sub";
}

export function FindingRow({ finding, novelId, initialVerdict, size = "sub" }: FindingRowProps) {
    const [verdict, setVerdict] = useState<string | null>(initialVerdict);
    const [isPending, startTransition] = useTransition();

    const handleDismiss = () => {
        const next = verdict === "not_real" ? null : "not_real";
        startTransition(async () => {
            const res = await setPlotFindingVerdict(novelId, finding.checkId, finding.subjectRef, next, finding.evidence);
            if (res.success) setVerdict(next);
        });
    };

    const isDismissed = verdict === "not_real";
    return (
        <div className={`flex items-baseline justify-between gap-4 transition-opacity ${isDismissed ? "opacity-40" : ""}`}>
            <span style={{ fontSize: size === "main" ? 14 : 13, fontWeight: size === "main" ? 600 : 400, lineHeight: 1.5, color: "var(--foreground)", flex: 1 }}>
                {finding.message}
            </span>
            <button
                id={`verdict-${finding.checkId}-${finding.subjectRef.replace(/[^a-zA-Z0-9]/g, "-")}`}
                onClick={handleDismiss}
                disabled={isPending}
                aria-pressed={isDismissed}
                style={{
                    minHeight: 44, minWidth: 44, padding: "0 12px",
                    borderRadius: "var(--radius-sm)", border: "1px solid",
                    borderColor: isDismissed ? "var(--border)" : "oklch(0.55 0.02 250 / 0.4)",
                    background: isDismissed ? "var(--muted)" : "transparent",
                    color: "var(--muted-foreground)",
                    fontFamily: "var(--font-technical)", fontSize: 11,
                    cursor: isPending ? "wait" : "pointer", whiteSpace: "nowrap",
                }}
            >
                {isDismissed ? "✓ ไม่ใช่ปัญหา" : "ไม่ใช่ปัญหา"}
            </button>
        </div>
    );
}

"use client";

import type { SceneSpineEntry, PlotFinding } from "@/lib/plot-analysis";

interface SceneSpineProps {
    spine: SceneSpineEntry[];
    findings: PlotFinding[];
}

export function SceneSpine({ spine, findings }: SceneSpineProps) {
    return (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }} role="list" aria-label="สันฉากทั้งหมด">
            <div className="flex gap-3 pb-1" style={{ minWidth: "max-content" }}>
                {spine.map((entry) => {
                    const hasFindings = entry.findingCount > 0;
                    return (
                        <div key={entry.sceneId} role="listitem" className="flex flex-col items-center gap-1" style={{ minWidth: 80 }}>
                            <div
                                className="w-full rounded-sm"
                                style={{
                                    height: 6,
                                    background: hasFindings
                                        ? "var(--forge-gold)"
                                        : entry.lanesUsed > 1
                                            ? "oklch(0.55 0.02 250)"
                                            : "oklch(0.75 0.01 250 / 0.5)",
                                }}
                                aria-hidden="true"
                            />
                            <span
                                style={{
                                    fontFamily: "var(--font-technical)",
                                    fontSize: 10,
                                    color: "var(--muted-foreground)",
                                    maxWidth: 80,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    display: "block",
                                }}
                                title={entry.title}
                            >
                                {entry.title}
                            </span>
                            <span
                                style={{
                                    fontFamily: "var(--font-technical)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: hasFindings ? "var(--forge-gold)" : "var(--foreground)",
                                }}
                            >
                                {entry.cardCount > 0 ? entry.cardCount : "—"}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

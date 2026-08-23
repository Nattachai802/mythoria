"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { runEchoScore } from "@/server/plot-analysis";
import { setPlotFindingVerdict } from "@/server/plot-analysis";
import type { EchoFinding } from "@/lib/echo-score";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface EchoScorePanelProps {
    novelId: string;
    sceneId: string;
    initialFindings?: EchoFinding[];
}

/**
 * Panel สำหรับหน้า scene board /plot/[eventId]
 *
 * - มีปุ่ม "ตรวจฉากนี้" (opt-in, เสียเงิน)
 * - โหลดแล้ว: แสดงรายการ์ดพร้อม hitCount/K และคำเดา
 * - รองรับ hash skip (UI แสดง "(ผลเดิม)" ถ้าการ์ดไม่เปลี่ยน)
 */
export function EchoScorePanel({ novelId, sceneId, initialFindings }: EchoScorePanelProps) {
    const [findings, setFindings] = useState<EchoFinding[]>(initialFindings ?? []);
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const hasResults = findings.length > 0;

    const handleRun = () => {
        startTransition(async () => {
            const result = await runEchoScore(novelId, sceneId);
            if (result.success) {
                setFindings(result.findings);
                const skippedMsg = result.skipped > 0 ? ` (ข้าม ${result.skipped} การ์ดที่ไม่เปลี่ยน)` : "";
                toast.success(`ตรวจเสร็จ ${result.findings.length} การ์ด${skippedMsg}`);
            } else {
                toast.error(result.error);
            }
        });
    };

    return (
        <div
            className="chamfered"
            style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
            }}
        >
            {/* Header — กดเพื่อ expand */}
            <button
                id="echo-score-panel-toggle"
                onClick={() => setIsOpen(prev => !prev)}
                className="w-full flex items-center justify-between gap-3 text-left transition-colors hover:bg-accent/50"
                style={{ padding: "10px 16px" }}
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <Sparkles
                        size={14}
                        style={{ color: "var(--forge-gold)", flexShrink: 0 }}
                    />
                    <span
                        style={{
                            fontFamily: "var(--font-technical)",
                            fontSize: 12,
                            color: "var(--muted-foreground)",
                            letterSpacing: "0.04em",
                        }}
                    >
                        หาจังหวะที่เดาได้
                    </span>
                    {hasResults && (
                        <span
                            style={{
                                fontFamily: "var(--font-technical)",
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                                opacity: 0.7,
                            }}
                        >
                            · {findings.length} การ์ด
                        </span>
                    )}
                </div>
                <span
                    style={{
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        transform: isOpen ? "rotate(180deg)" : undefined,
                        transition: "transform 0.15s",
                    }}
                >
                    ▾
                </span>
            </button>

            {/* Body */}
            {isOpen && (
                <div
                    style={{
                        borderTop: "1px solid var(--border)",
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 16,
                    }}
                >
                    {/* Run button */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p
                            style={{
                                fontFamily: "var(--font-technical)",
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                                margin: 0,
                            }}
                        >
                            ใช้ AI · ~170 ครั้งต่อฉาก · Gemini 2.5 Flash
                            {hasResults && " · กดอีกครั้งเพื่ออัปเดต"}
                        </p>
                        <Button
                            id="echo-score-run-btn"
                            size="sm"
                            variant="outline"
                            onClick={handleRun}
                            disabled={isPending}
                            style={{ minHeight: 36, gap: 6 }}
                        >
                            {isPending ? (
                                <Loader2 size={13} className="animate-spin" />
                            ) : hasResults ? (
                                <RefreshCw size={13} />
                            ) : (
                                <Sparkles size={13} />
                            )}
                            {isPending
                                ? "กำลังตรวจ…"
                                : hasResults
                                    ? "ตรวจใหม่"
                                    : "ตรวจฉากนี้"}
                        </Button>
                    </div>

                    {/* Results */}
                    {hasResults && (
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 12,
                                opacity: isPending ? 0.4 : 1,
                                transition: "opacity 0.2s",
                            }}
                        >
                            {findings.map(f => (
                                <EchoFindingRow
                                    key={f.cardCode}
                                    finding={f}
                                    novelId={novelId}
                                    sceneId={sceneId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── EchoFindingRow ───────────────────────────────────────────────────────

interface EchoFindingRowProps {
    finding: EchoFinding;
    novelId: string;
    sceneId: string;
}

function EchoFindingRow({ finding, novelId, sceneId }: EchoFindingRowProps) {
    const { evidence, cardCode, cardTitle, hasIncomingLink } = finding;
    const [dismissed, setDismissed] = useState(false);
    const [isPending, startTransition] = useTransition();

    const K = evidence.k;
    const hits = evidence.hitCount;
    const guesses = evidence.guesses ?? [];

    // ตัวกันอ่านผิด (ตามแผน): echo ต่ำ + ไม่มีเส้นเข้า = น่าสงสัย
    const isLowEcho = hits <= K / 2;
    const isSuspect = isLowEcho && !hasIncomingLink;

    const handleDismiss = () => {
        startTransition(async () => {
            const next = dismissed ? null : "not_real";
            const res = await setPlotFindingVerdict(
                novelId, "echo", cardCode,
                next,
                evidence as unknown as Record<string, unknown>,
                evidence.promptVersion,
            );
            if (res.success) setDismissed(!dismissed);
        });
    };

    // คำเดาที่แสดง: เฉพาะ 3 อันแรก
    const displayGuesses = guesses.slice(0, 3);

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                opacity: dismissed ? 0.4 : 1,
                transition: "opacity 0.2s",
            }}
        >
            <div className="flex items-baseline justify-between gap-4">
                <span
                    style={{
                        fontFamily: "var(--font-technical)",
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        flexShrink: 0,
                    }}
                >
                    {cardCode}
                </span>
                <span
                    style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--foreground)",
                        flex: 1,
                    }}
                >
                    {cardTitle}
                </span>
                <span
                    style={{
                        fontFamily: "var(--font-technical)",
                        fontSize: 12,
                        color: "var(--muted-foreground)",
                        flexShrink: 0,
                    }}
                >
                    เดาได้ {hits}/{K}
                    {hasIncomingLink && " · มีเส้นเข้า"}
                </span>
            </div>

            {/* คำเดา */}
            {displayGuesses.length > 0 && (
                <div
                    style={{
                        paddingLeft: 28,
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                    }}
                >
                    {displayGuesses.map((g, i) => (
                        <span
                            key={i}
                            style={{
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                                fontStyle: "italic",
                            }}
                        >
                            "{g}"
                        </span>
                    ))}
                    {guesses.length > 3 && (
                        <span
                            style={{
                                fontSize: 11,
                                color: "var(--muted-foreground)",
                                opacity: 0.6,
                            }}
                        >
                            +{guesses.length - 3} คำเดาอื่น
                        </span>
                    )}
                </div>
            )}

            {/* ตัวกันอ่านผิด */}
            {isSuspect && (
                <p
                    style={{
                        paddingLeft: 28,
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        margin: 0,
                        opacity: 0.7,
                    }}
                >
                    เดาได้น้อย + ไม่มีเส้นเหตุ-ผลเข้า — ว้าวจริงหรือเรื่องไร้เหตุผล?
                </p>
            )}

            {/* ปุ่ม verdict */}
            <div style={{ paddingLeft: 28 }}>
                <button
                    id={`echo-verdict-${cardCode}`}
                    onClick={handleDismiss}
                    disabled={isPending}
                    aria-pressed={dismissed}
                    style={{
                        padding: "4px 10px",
                        minHeight: 44,
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid",
                        borderColor: dismissed ? "var(--border)" : "oklch(0.55 0.02 250 / 0.4)",
                        background: dismissed ? "var(--muted)" : "transparent",
                        color: "var(--muted-foreground)",
                        fontFamily: "var(--font-technical)",
                        fontSize: 11,
                        cursor: isPending ? "wait" : "pointer",
                    }}
                >
                    {dismissed ? "✓ ไม่ใช่ปัญหา" : "ไม่ใช่ปัญหา"}
                </button>
            </div>
        </div>
    );
}

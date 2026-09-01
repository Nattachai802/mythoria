"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, RefreshCw, Zap } from "lucide-react";
import { runEchoScore, listEchoTargets } from "@/server/plot-analysis";
import { setPlotFindingVerdict } from "@/server/plot-analysis";
import { type EchoFinding } from "@/lib/echo-score";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface EchoScorePanelProps {
    novelId: string;
    sceneId: string;
    findingCount: number;
    onFindingsChange: (findings: EchoFinding[]) => void;
}

/**
 * ปุ่มเดียว — สั่งตรวจ Echo Score ทั้งฉาก ผลไปโผล่เป็น label เล็กบนการ์ดแต่ละใบ
 * (ไม่มี panel สรุปแยกอีกต่อไป — ผู้เรียก (PlaygroundBoard) เก็บ findings แล้วผูกเข้าการ์ดผ่าน cardId)
 *
 * - มีปุ่ม "ตรวจฉากนี้" (opt-in, เสียเงิน)
 * - รองรับ hash skip (ข้ามการ์ดที่ไม่เปลี่ยนตั้งแต่รอบก่อน)
 */
export function EchoScorePanel({ novelId, sceneId, findingCount, onFindingsChange }: EchoScorePanelProps) {
    const [isPending, startTransition] = useTransition();
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const hasResults = findingCount > 0;

    // ยิงทีละการ์ด (reuse cardIds scoping ของ runEchoScore) แทนยิงรวดเดียวทั้งฉาก
    // เพื่อให้ผลแต่ละใบโผล่ทันทีที่เสร็จ แทนที่จะรอ spinner เดียวจนจบแล้วเทกองมาทีเดียว
    const handleRun = () => {
        startTransition(async () => {
            const listRes = await listEchoTargets(novelId, sceneId);
            if (!listRes.success) { toast.error(listRes.error); return; }
            const targets = listRes.targets;
            if (targets.length === 0) { toast.success("ไม่มีการ์ดให้ตรวจในฉากนี้"); return; }

            setProgress({ done: 0, total: targets.length });
            const nextFindings: EchoFinding[] = [];
            let skippedCount = 0;

            for (const t of targets) {
                const result = await runEchoScore(novelId, sceneId, [t.id]);
                if (!result.success) {
                    toast.error(result.error);
                    setProgress(null);
                    return;
                }
                if (result.findings.length > 0) nextFindings.push(result.findings[0]);
                skippedCount += result.skipped;
                onFindingsChange([...nextFindings]);
                setProgress(p => (p ? { done: p.done + 1, total: p.total } : p));
            }

            setProgress(null);
            const skippedMsg = skippedCount > 0 ? ` (ข้าม ${skippedCount} การ์ดที่ไม่เปลี่ยน)` : "";
            toast.success(`ตรวจเสร็จ ${nextFindings.length} การ์ด${skippedMsg}`);
        });
    };

    return (
        <Button
            id="echo-score-run-btn"
            size="sm"
            variant="ghost"
            onClick={handleRun}
            disabled={isPending}
            className="h-8 gap-1.5 text-xs"
            title="หาจังหวะที่เดาได้ (Echo Score) — ผลขึ้นเป็น label บนการ์ด"
        >
            {isPending ? (
                <Loader2 size={13} className="animate-spin" />
            ) : hasResults ? (
                <RefreshCw size={13} />
            ) : (
                <Sparkles size={13} />
            )}
            {progress
                ? `กำลังตรวจ ${progress.done}/${progress.total}`
                : hasResults
                    ? "ตรวจ Echo ใหม่"
                    : "ตรวจ Echo Score"}
        </Button>
    );
}

// ─── EchoGuessBadge ─────────────────────────────────────────────────────
// Label เล็กมุมขวาบนของการ์ด บอกว่าจังหวะนี้ "เดาง่าย/เดายาก" แค่ไหน (จาก hitCount/K)

interface EchoGuessBadgeProps {
    finding: EchoFinding;
}

// แปลง @A/@B ฯลฯ กลับเป็นชื่อจริง — ผู้อ่าน (นักเขียน) ไม่รู้จักตัวย่อที่ระบบใช้ตัดคำเรียก LLM
function deAlias(text: string, cast?: { alias: string; name: string }[]): string {
    if (!cast || cast.length === 0) return text;
    return cast.reduce((out, c) => out.split(c.alias).join(c.name), text);
}

export function EchoGuessBadge({ finding }: EchoGuessBadgeProps) {
    const { hitCount, k, guesses = [], matched = [], cast } = finding.evidence;
    const ratio = k > 0 ? hitCount / k : 0;

    // กลาง (40–60%) ไม่ฟันธง — ไม่ต้องมี label กวนตา
    if (ratio > 0.4 && ratio < 0.6) return null;

    const isEasy = ratio >= 0.6;
    // เข้าธีม forge เดิม — ทองสำหรับ "ต้องระวัง" (เดาง่าย), เขียวมิ้นต์เย็นสำหรับ "ดีแล้ว" (เดายาก)
    const dotColor = isEasy ? "var(--forge-amber)" : "oklch(0.65 0.14 165)";
    const hitSet = new Set(matched.map(m => m.index));
    const reasonOf = new Map(matched.map(m => [m.index, m.reason]));

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 shrink-0 rounded-full border px-1.5 py-0.5 leading-none cursor-help"
                    style={{
                        borderColor: "var(--border)",
                        fontFamily: "var(--font-technical)",
                        fontSize: 9,
                        letterSpacing: "0.02em",
                        color: "var(--muted-foreground)",
                    }}
                >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
                    {isEasy ? "เดาง่าย" : "เดายาก"}
                </span>
            </TooltipTrigger>
            <TooltipContent
                className="max-w-80 px-3 py-2.5"
                onPointerDownOutside={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 mb-2">
                    <span
                        style={{ fontFamily: "var(--font-technical)", fontSize: 10, letterSpacing: "0.04em", opacity: 0.8 }}
                    >
                        ECHO SCORE · เดาถูก {hitCount}/{k}
                    </span>
                    <span className="flex items-center gap-[3px]" aria-hidden="true">
                        {Array.from({ length: k }).map((_, i) => (
                            <span
                                key={i}
                                className="h-1.5 w-1.5 rounded-full shrink-0"
                                style={{ background: i < hitCount ? dotColor : "currentColor", opacity: i < hitCount ? 1 : 0.25 }}
                            />
                        ))}
                    </span>
                </div>
                {guesses.length > 0 && (
                    <div className="flex flex-col divide-y divide-primary-foreground/15 border-t border-primary-foreground/15">
                        {guesses.map((g, i) => (
                            <div key={i} className="flex items-start gap-2 py-1.5">
                                <span
                                    className="mt-[3px] h-1.5 w-1.5 rounded-full shrink-0"
                                    style={{ background: hitSet.has(i) ? dotColor : "currentColor", opacity: hitSet.has(i) ? 1 : 0.25 }}
                                    title={hitSet.has(i) ? "AI เดาข้อนี้ถูก" : "AI เดาข้อนี้ผิด"}
                                />
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="italic opacity-90 leading-snug" style={{ fontSize: 11 }}>
                                        "{deAlias(g, cast)}"
                                    </span>
                                    {reasonOf.has(i) && (
                                        <span className="opacity-70 leading-snug" style={{ fontSize: 10 }}>
                                            → {deAlias(reasonOf.get(i)!, cast)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </TooltipContent>
        </Tooltip>
    );
}

// ─── EchoFindingRow ───────────────────────────────────────────────────────

interface EchoFindingRowProps {
    finding: EchoFinding;
    novelId: string;
    sceneId: string;
    isTurningPoint?: boolean;
}

export function EchoFindingRow({ finding, novelId, sceneId, isTurningPoint }: EchoFindingRowProps) {
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

    // คำเดาที่แสดง: เฉพาะ 3 อันแรก แปลง @A/@B กลับเป็นชื่อจริงก่อนโชว์
    const displayGuesses = guesses.slice(0, 3).map(g => deAlias(g, evidence.cast));

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
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                    }}
                >
                    {cardTitle}
                    {isTurningPoint && (
                        <span title="จุดพลิกผัน — เดาได้ยากกว่าจังหวะอื่นในฉากนี้ผิดปกติ" style={{ display: "inline-flex", flexShrink: 0 }}>
                            <Zap size={12} style={{ color: "var(--forge-gold)" }} />
                        </span>
                    )}
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

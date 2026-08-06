"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_PLAIN } from "@/lib/stylometry-features";

/**
 * รายงานตรวจสุขภาพรายตอน — ตัวเลขล้วน ไม่เรียก LLM
 *
 * โหลดเองตอน mount ไม่มีปุ่มให้กด เพราะไม่มีต้นทุนต่อครั้ง
 * ทุกสถานะที่ผิดปกติมีข้อความอธิบายของตัวเอง ไม่ปล่อยให้เห็นช่องว่างเปล่า ๆ
 * แล้วเดาว่าฟีเจอร์พัง
 */

type Metric = {
    key: string;
    label: string;
    shortLabel: string;
    unit: string;
    raw: number | null;
    z: number | null;
    baselineMean: number | null;
    notable: boolean;
    anomalous: boolean;
};

type ThreadItem = {
    id: string;
    title: string;
    type: string;
    seedOrder: number | null;
    lastOrder: number | null;
    gap: number | null;
    stale: boolean;
};

type Report =
    | { status: "unpositioned" | "no_stylometry"; message: string }
    | {
        status: "ok";
        position: number;
        chapterOrder: number;
        baselineCount: number;
        baselineEnough: boolean;
        outdatedAnalysis: boolean;
        metrics: Metric[];
        warnings: {
            voicePairs: Array<{ a: string; b: string; distance: number }>;
            drift: { z: number; at: number | null } | null;
            echoes: Array<{ term: string; count: number }>;
        };
        threads: { reason: "none_created" | null; items: ThreadItem[] };
    };

export function ChapterStatsReport({ novelId, noteId }: { novelId: string; noteId: string }) {
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        fetch(`/api/novel/${novelId}/note/${noteId}/chapter-report`)
            .then(async (r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then((d) => { if (!cancelled) setReport(d); })
            .catch((e) => { if (!cancelled) setError(String(e.message ?? e)); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [novelId, noteId]);

    if (loading) {
        return (
            <Shell>
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                    <RefreshCw className="h-3 w-3 animate-spin" /> กำลังอ่านตัวเลข…
                </div>
            </Shell>
        );
    }

    if (error) {
        return (
            <Shell>
                <p className="text-xs text-destructive py-3">โหลดรายงานไม่สำเร็จ ({error})</p>
            </Shell>
        );
    }

    if (!report) return null;

    if (report.status !== "ok") {
        return (
            <Shell>
                <p className="text-xs text-muted-foreground py-3">{report.message}</p>
            </Shell>
        );
    }

    const shown = report.metrics.filter((m) => m.raw !== null);
    const notable = shown.filter((m) => m.notable).sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0));

    return (
        <Shell subtitle={`เทียบกับ ${report.baselineCount} ตอนก่อนหน้า`}>
            {report.outdatedAnalysis && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                    ตัวเลขชุดนี้มาจากการวิเคราะห์เวอร์ชันเก่า — สั่งวิเคราะห์สไตล์ใหม่จะได้จังหวะประโยค
                    ความหนาแน่นประสาทสัมผัส และคำซ้ำเพิ่มมาด้วย
                </p>
            )}

            {!report.baselineEnough ? (
                <p className="text-[11px] text-muted-foreground mb-2">
                    ยังมีตอนก่อนหน้าไม่พอ ({report.baselineCount}) — แสดงค่าดิบไว้ก่อน ยังตัดสินไม่ได้ว่าผิดปกติไหม
                </p>
            ) : notable.length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">ทุกมิติอยู่ในช่วงปกติของคุณ</p>
            ) : (
                <ul className="text-xs space-y-0.5 mb-2">
                    {notable.slice(0, 4).map((m) => {
                        const p = FEATURE_PLAIN[m.key];
                        if (!p) return null;
                        return (
                            <li key={m.key} className={cn(m.anomalous && "text-amber-600 dark:text-amber-400")}>
                                • {p.name}: {(m.z ?? 0) > 0 ? p.high : p.low}
                            </li>
                        );
                    })}
                </ul>
            )}

            <div className="space-y-1">
                {shown.map((m) => (
                    <div key={m.key} className="flex items-center gap-2 text-[11px]">
                        <span className="w-20 shrink-0 text-muted-foreground">{m.shortLabel}</span>
                        <Trend z={m.z} />
                        <span className="tabular-nums font-medium">{m.raw}{m.unit}</span>
                        {m.baselineMean !== null && (
                            <span className="text-muted-foreground/70 tabular-nums">เฉลี่ย {m.baselineMean}</span>
                        )}
                    </div>
                ))}
            </div>

            {(report.warnings.voicePairs.length > 0 || report.warnings.drift || report.warnings.echoes.length > 0) && (
                <div className="mt-3 space-y-1">
                    {report.warnings.voicePairs.map((p) => (
                        <Warn key={`${p.a}-${p.b}`}>
                            {p.a} / {p.b} พูดคล้ายกันเกินไป แยกเสียงไม่ออก
                        </Warn>
                    ))}
                    {report.warnings.drift && (
                        <Warn>
                            น้ำเสียงเพี้ยนช่วงประโยคที่ {report.warnings.drift.at ?? "?"} (z={report.warnings.drift.z})
                        </Warn>
                    )}
                    {report.warnings.echoes.length > 0 && (
                        <Warn>
                            คำซ้ำ: {report.warnings.echoes.map((e) => `${e.term}×${e.count}`).join(" · ")}
                        </Warn>
                    )}
                </div>
            )}

            <div className="mt-3 border-t pt-2">
                <p className="text-[11px] font-medium text-muted-foreground mb-1">ปมที่ยังไม่เฉลย</p>
                {report.threads.reason === "none_created" ? (
                    <p className="text-[11px] text-muted-foreground/80">
                        ยังไม่ได้บันทึกปมเรื่องไว้ — เพิ่มได้ที่กระดานปมในหน้าไทม์ไลน์
                    </p>
                ) : report.threads.items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/80">ไม่มีปมค้าง ณ ตอนนี้</p>
                ) : (
                    <ul className="space-y-0.5">
                        {report.threads.items.slice(0, 5).map((t) => (
                            <li key={t.id} className="text-[11px] flex items-baseline gap-1.5">
                                <span className={cn("shrink-0", t.stale ? "text-red-500" : "text-amber-500")}>●</span>
                                <span className="truncate">{t.title}</span>
                                <span className="text-muted-foreground/70 shrink-0 ml-auto tabular-nums">
                                    {t.seedOrder !== null && `หว่านบท ${t.seedOrder}`}
                                    {t.gap !== null && t.gap > 0 && ` · ค้าง ${t.gap} บท`}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Shell>
    );
}

function Shell({ subtitle, children }: { subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">ตรวจสุขภาพตอน</span>
                {subtitle && <span className="text-[11px] text-muted-foreground ml-auto">{subtitle}</span>}
            </div>
            {children}
        </div>
    );
}

function Trend({ z }: { z: number | null }) {
    if (z === null) return <span className="w-3.5 shrink-0" />;
    if (Math.abs(z) < 1) return <span className="w-3.5 shrink-0 text-muted-foreground/50">●</span>;
    const Icon = z > 0 ? TrendingUp : TrendingDown;
    return <Icon className={cn("h-3.5 w-3.5 shrink-0", Math.abs(z) >= 1.96 ? "text-amber-500" : "text-muted-foreground")} />;
}

function Warn({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{children}</span>
        </p>
    );
}

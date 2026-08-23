"use client";

import type { PlotAnalysisReport, PlotFinding } from "@/lib/plot-analysis";
import type { EchoFinding } from "@/lib/echo-score";
import { SceneSpine } from "./scene-spine";
import { FindingRow } from "./finding-row";
import { CoverageLine } from "./coverage-line";
import { EchoScoreBlock } from "./echo-score-block";

interface PlotAnalysisPanelProps {
    novelId: string;
    report: PlotAnalysisReport;
    verdicts: Record<string, string | null>;
    /** echo findings จาก DB จัดกลุ่มตาม sceneId — key = sceneId */
    echoFindings: Record<string, EchoFinding[]>;
}

function groupFindings(findings: PlotFinding[]): {
    main: PlotFinding[];
    sub: PlotFinding[];
} {
    return {
        main: findings.filter(f => f.checkId === "threads_unpaid"),
        sub: findings.filter(f => f.checkId !== "threads_unpaid"),
    };
}

export function PlotAnalysisPanel({ novelId, report, verdicts, echoFindings }: PlotAnalysisPanelProps) {
    const { main, sub } = groupFindings(report.findings);
    const verdictKey = (f: PlotFinding) => `${f.checkId}:${f.subjectRef}`;
    const totalFindings = report.findings.length;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Phase 1 panel */}
            <section
                aria-label="วิเคราะห์โครงเรื่อง"
                style={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    padding: "20px 24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                }}
                className="chamfered"
            >
                {/* Header */}
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <h2 style={{ fontFamily: "var(--font-technical)", fontSize: 12, fontWeight: 400, color: "var(--muted-foreground)", margin: 0, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        อ่านโครงเรื่อง
                    </h2>
                    <span style={{ fontFamily: "var(--font-technical)", fontSize: 11, color: "var(--muted-foreground)", opacity: 0.7 }}>
                        {report.sceneCount} ฉาก · {report.cardCount} การ์ด · {report.threadCount} ปม
                    </span>
                </div>

                {/* Scene Spine */}
                {report.spine.length > 0 && (
                    <SceneSpine spine={report.spine} findings={report.findings} />
                )}

                {(totalFindings > 0 || report.coverage.blockedSummary) && (
                    <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />
                )}

                {totalFindings === 0 && !report.coverage.blockedSummary && (
                    <p style={{ fontFamily: "var(--font-technical)", fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                        ยังไม่มีข้อสังเกต — กรอกข้อมูลเพิ่มเพื่อปลดล็อกเช็ค
                    </p>
                )}

                {/* Main findings — threads_unpaid */}
                {main.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>
                            {main.length} ปมค้าง
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {main.map(f => (
                                <FindingRow key={verdictKey(f)} finding={f} novelId={novelId} initialVerdict={verdicts[verdictKey(f)] ?? null} size="main" />
                            ))}
                        </div>
                        <p style={{ fontFamily: "var(--font-technical)", fontSize: 11, color: "var(--muted-foreground)", margin: 0 }}>
                            นิยายลงเป็นตอนทิ้งปมค้างข้ามตอนได้ตามปกติ — เป็นข้อสังเกต ไม่ใช่ข้อบกพร่อง
                        </p>
                    </div>
                )}

                {/* Sub findings */}
                {sub.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {sub.map(f => (
                            <FindingRow key={verdictKey(f)} finding={f} novelId={novelId} initialVerdict={verdicts[verdictKey(f)] ?? null} size="sub" />
                        ))}
                    </div>
                )}

                <CoverageLine blockedSummary={report.coverage.blockedSummary} />
            </section>

            {/* Phase 2 — Echo Score block (พื้นจางกว่า ตามแผน) */}
            <EchoScoreBlock
                novelId={novelId}
                spine={report.spine}
                echoFindings={echoFindings}
            />
        </div>
    );
}

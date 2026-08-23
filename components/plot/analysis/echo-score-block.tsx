"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import type { SceneSpineEntry } from "@/lib/plot-analysis";
import type { EchoFinding } from "@/lib/echo-score";

interface EchoScoreBlockProps {
    novelId: string;
    /** spine ของฉากทั้งหมด — ใช้แสดง per-scene summary */
    spine: SceneSpineEntry[];
    /** echo findings ที่บันทึกไว้แล้ว (อาจว่างถ้ายังไม่เคยรัน) */
    echoFindings: Record<string, EchoFinding[]>; // key = sceneId
}

/**
 * Block สรุป Echo Score บนหน้า /plot (ระดับทั้งเรื่อง)
 *
 * ตามแผน: พื้นจางกว่า panel Phase 1, ว่างเปล่าจนกว่าจะเคยรัน
 * ไม่มีปุ่มรันในหน้านี้ — ลิงก์ไปกระดานฉากนั้นแทน
 */
export function EchoScoreBlock({ novelId, spine, echoFindings }: EchoScoreBlockProps) {
    const hasAnyResult = Object.values(echoFindings).some(arr => arr.length > 0);

    return (
        <section
            aria-label="Echo Score — จังหวะที่เดาได้"
            className="chamfered"
            style={{
                background: "transparent",
                border: "1px dashed var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "14px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                opacity: 0.85,
            }}
        >
            {/* Header */}
            <div className="flex items-center gap-2">
                <Sparkles size={13} style={{ color: "var(--forge-gold)", flexShrink: 0 }} />
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
                <span
                    style={{
                        fontFamily: "var(--font-technical)",
                        fontSize: 11,
                        color: "var(--muted-foreground)",
                        opacity: 0.6,
                    }}
                >
                    · ใช้ AI · ~170 ครั้งต่อฉาก
                </span>
            </div>

            {/* Per-scene rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {spine.map(entry => {
                    const sceneFindings = echoFindings[entry.sceneId] ?? [];
                    const hasResult = sceneFindings.length > 0;
                    const boardHref = `/dashboard/project/${novelId}/plot/${entry.sceneId}?action=echo`;

                    // นับการ์ดที่ hit > K/2 (เดาได้บ่อย)
                    const highEchoCount = sceneFindings.filter(
                        f => f.evidence.hitCount > f.evidence.k / 2,
                    ).length;

                    return (
                        <div
                            key={entry.sceneId}
                            className="flex items-center justify-between gap-4"
                        >
                            <span
                                style={{
                                    fontSize: 13,
                                    color: "var(--foreground)",
                                    flex: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {entry.title}
                            </span>

                            <span
                                style={{
                                    fontFamily: "var(--font-technical)",
                                    fontSize: 12,
                                    color: "var(--muted-foreground)",
                                    flexShrink: 0,
                                    minWidth: 120,
                                    textAlign: "right",
                                }}
                            >
                                {hasResult
                                    ? `เดาได้ ${highEchoCount}/${sceneFindings.length} การ์ด`
                                    : "ยังไม่เคยตรวจ"}
                            </span>

                            {/* ลิงก์ไปกระดาน — ไม่มีปุ่มรันตรงนี้ */}
                            <Link
                                id={`echo-link-${entry.sceneId}`}
                                href={boardHref}
                                style={{
                                    fontFamily: "var(--font-technical)",
                                    fontSize: 11,
                                    color: "var(--muted-foreground)",
                                    textDecoration: "none",
                                    flexShrink: 0,
                                    padding: "4px 10px",
                                    minHeight: 32,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    borderRadius: "var(--radius-sm)",
                                    border: "1px solid var(--border)",
                                    gap: 4,
                                    transition: "all 0.15s",
                                }}
                                aria-label={`ตรวจ Echo Score ฉาก ${entry.title}`}
                            >
                                {hasResult ? "ดูรายละเอียด" : "ตรวจ"}
                                {" ↗"}
                            </Link>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

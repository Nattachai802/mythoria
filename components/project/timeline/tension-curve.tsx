"use client"

import { useMemo } from "react"
import { Chapter, TimelineEvent } from "@/db/schema"

const COLUMN_WIDTH = 260
const HEIGHT = 96
const PAD_Y = 16

interface TensionCurveProps {
    chapters: Chapter[] // sorted
    events: TimelineEvent[]
}

export function TensionCurve({ chapters, events }: TensionCurveProps) {
    const { points, peakIdx, valleyIdx, hasData } = useMemo(() => {
        // net valueShift ต่อบท → cumulative running total
        let running = 0
        const cumulative = chapters.map(ch => {
            const net = events
                .filter(e => e.relatedChapterId === ch.id)
                .reduce((sum, e) => sum + (typeof e.valueShift === "number" ? e.valueShift : 0), 0)
            running += net
            return running
        })

        const hasData = events.some(e => typeof e.valueShift === "number" && e.valueShift !== 0)

        // หา range เพื่อ normalize (รวม 0 เสมอ เพื่อให้เส้น baseline อยู่ในกรอบ)
        const lo = Math.min(0, ...cumulative)
        const hi = Math.max(0, ...cumulative)
        const span = hi - lo || 1

        const innerH = HEIGHT - PAD_Y * 2
        const toY = (v: number) => PAD_Y + innerH - ((v - lo) / span) * innerH

        const points = cumulative.map((v, i) => ({
            x: i * COLUMN_WIDTH + COLUMN_WIDTH / 2,
            y: toY(v),
            value: v,
        }))

        // peak / valley
        let peakIdx = 0, valleyIdx = 0
        cumulative.forEach((v, i) => {
            if (v > cumulative[peakIdx]) peakIdx = i
            if (v < cumulative[valleyIdx]) valleyIdx = i
        })

        return { points, peakIdx, valleyIdx, hasData, toY }
    }, [chapters, events])

    const totalWidth = chapters.length * COLUMN_WIDTH

    if (chapters.length === 0) return null

    // baseline (value = 0) y position — recompute เดียวกับ toY
    const cumulative = points.map(p => p.value)
    const lo = Math.min(0, ...cumulative)
    const hi = Math.max(0, ...cumulative)
    const span = hi - lo || 1
    const innerH = HEIGHT - PAD_Y * 2
    const zeroY = PAD_Y + innerH - ((0 - lo) / span) * innerH

    // smooth path (catmull-rom-ish via quadratic midpoints)
    const linePath = points.reduce((acc, p, i) => {
        if (i === 0) return `M ${p.x} ${p.y}`
        const prev = points[i - 1]
        const midX = (prev.x + p.x) / 2
        return `${acc} Q ${prev.x} ${prev.y}, ${midX} ${(prev.y + p.y) / 2} T ${p.x} ${p.y}`
    }, "")

    // area fill path (line → down to baseline → back)
    const areaPath = points.length
        ? `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`
        : ""

    return (
        <div className="relative flex-shrink-0" style={{ width: totalWidth + 32, height: HEIGHT }}>
            {!hasData && (
                <div className="absolute inset-0 flex items-center justify-start pl-2">
                    <span className="font-technical text-[9px] uppercase tracking-widest text-muted-foreground/60">
                        เส้น tension — ตั้งค่า "การเปลี่ยนค่า" ในโครงฉากดราม่าเพื่อเริ่มวาด
                    </span>
                </div>
            )}
            <svg width={totalWidth} height={HEIGHT} className="overflow-visible" style={{ opacity: hasData ? 1 : 0.25 }}>
                <defs>
                    <linearGradient id="tension-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--forge-amber)" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="var(--forge-amber)" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* zero baseline */}
                <line
                    x1={0} y1={zeroY} x2={totalWidth} y2={zeroY}
                    stroke="currentColor" strokeOpacity={0.18} strokeWidth={1} strokeDasharray="3 4"
                    className="text-muted-foreground"
                />

                {/* area fill */}
                {hasData && <path d={areaPath} fill="url(#tension-area)" />}

                {/* curve line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke="var(--forge-amber)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "drop-shadow(0 1px 3px rgba(245,158,11,0.3))" }}
                />

                {/* points */}
                {points.map((p, i) => {
                    const isPeak = hasData && i === peakIdx && p.value > 0
                    const isValley = hasData && i === valleyIdx && p.value < 0
                    const big = isPeak || isValley
                    return (
                        <g key={i}>
                            {big && (
                                <circle cx={p.x} cy={p.y} r={7}
                                    fill={isPeak ? "#10b981" : "#ef4444"} fillOpacity={0.15} />
                            )}
                            <circle
                                cx={p.x} cy={p.y} r={big ? 4 : 2.5}
                                fill={isPeak ? "#10b981" : isValley ? "#ef4444" : "var(--forge-amber)"}
                                stroke="var(--background)" strokeWidth={1.5}
                            />
                            {big && (
                                <text
                                    x={p.x} y={isPeak ? p.y - 11 : p.y + 18}
                                    textAnchor="middle"
                                    className="font-technical"
                                    fontSize={8}
                                    fill={isPeak ? "#10b981" : "#ef4444"}
                                    style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
                                >
                                    {isPeak ? "จุดสูงสุด" : "จุดต่ำสุด"}
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

"use client"

import { useMemo } from "react"
import { Chapter, TimelineEvent } from "@/db/schema"
import { type ThreadWithBeats } from "@/server/plot-threads"
import { cn } from "@/lib/utils"

const COLUMN_WIDTH = 260 // ต้องตรงกับ chapter column / tension curve
const LANE_HEIGHT = 26
const STALE_GAP = 8 // บทที่ปมเงียบติดกัน → ทาบแดงเตือน (ตรงกับ ledger)

const ROLE_COLOR: Record<string, string> = {
    seed: "#f59e0b",      // หว่าน
    reinforce: "#3b82f6", // ย้ำ
    payoff: "#10b981",    // เฉลย
}

interface ThreadRibbonProps {
    threads: ThreadWithBeats[]
    chapters: Chapter[] // sorted
    events: TimelineEvent[]
}

interface Lane {
    thread: ThreadWithBeats
    chapterBeats: string[][] // ต่อบท: roles ของ beats ในบทนั้น (ว่าง = ไม่แตะ)
    firstIdx: number
    lastIdx: number
    isOpen: boolean // ยังไม่เฉลย/ไม่ทิ้ง
    staleRanges: Array<[number, number]> // ช่วงเงียบเกิน STALE_GAP
}

export function ThreadRibbon({ threads, chapters, events }: ThreadRibbonProps) {
    const lanes = useMemo<Lane[]>(() => {
        const chapterIdxByEvent = new Map<string, number>()
        events.forEach(e => {
            if (!e.relatedChapterId) return
            const idx = chapters.findIndex(c => c.id === e.relatedChapterId)
            if (idx >= 0) chapterIdxByEvent.set(e.id, idx)
        })

        return threads
            .map(thread => {
                const chapterBeats: string[][] = chapters.map(() => [])
                thread.beats.forEach(b => {
                    const idx = chapterIdxByEvent.get(b.eventId)
                    if (idx !== undefined) chapterBeats[idx].push(b.role)
                })

                const touched = chapterBeats
                    .map((roles, i) => (roles.length > 0 ? i : -1))
                    .filter(i => i >= 0)
                if (touched.length === 0) return null

                const firstIdx = touched[0]
                const lastIdx = touched[touched.length - 1]
                const isOpen = thread.status !== "paid" && thread.status !== "abandoned"

                // gap เงียบระหว่าง beat ติดกัน + ช่วงท้ายถ้าปมยังเปิดค้าง
                const staleRanges: Array<[number, number]> = []
                for (let i = 1; i < touched.length; i++) {
                    if (touched[i] - touched[i - 1] > STALE_GAP) {
                        staleRanges.push([touched[i - 1], touched[i]])
                    }
                }
                if (isOpen && chapters.length - 1 - lastIdx > STALE_GAP) {
                    staleRanges.push([lastIdx, chapters.length - 1])
                }

                return { thread, chapterBeats, firstIdx, lastIdx, isOpen, staleRanges }
            })
            .filter((l): l is Lane => l !== null)
            // major ก่อน แล้วเรียงตามบทที่เริ่มหว่าน
            .sort((a, b) =>
                a.thread.importance === b.thread.importance
                    ? a.firstIdx - b.firstIdx
                    : a.thread.importance === "major" ? -1 : 1
            )
    }, [threads, chapters, events])

    if (chapters.length === 0) return null

    const totalWidth = chapters.length * COLUMN_WIDTH
    const cx = (i: number) => i * COLUMN_WIDTH + COLUMN_WIDTH / 2

    if (lanes.length === 0) {
        return (
            <div className="flex items-center pl-2 py-1.5 flex-shrink-0" style={{ width: totalWidth + 32 }}>
                <span className="font-technical text-[9px] uppercase tracking-widest text-muted-foreground/60">
                    เลนปม — ผูกปมเข้ากับฉากผ่านสมุดปมเพื่อเริ่มวาดเลน
                </span>
            </div>
        )
    }

    return (
        <div className="flex flex-col flex-shrink-0 py-1" style={{ width: totalWidth + 32 }}>
            {lanes.map(lane => {
                const color = lane.thread.color ?? "#f59e0b"
                const y = LANE_HEIGHT / 2
                const endX = lane.isOpen ? cx(chapters.length - 1) : cx(lane.lastIdx)

                return (
                    <div key={lane.thread.id} className="relative" style={{ height: LANE_HEIGHT, width: totalWidth }}>
                        <svg width={totalWidth} height={LANE_HEIGHT} className="absolute inset-0 overflow-visible">
                            {/* เส้นหลัก: ช่วงที่ปมมีชีวิต */}
                            <line
                                x1={cx(lane.firstIdx)} y1={y} x2={cx(lane.lastIdx)} y2={y}
                                stroke={color} strokeWidth={lane.thread.importance === "major" ? 2.5 : 1.5}
                                strokeOpacity={0.55} strokeLinecap="round"
                            />
                            {/* หางค้าง: ปมยังเปิด ลากเส้นประจางถึงบทสุดท้าย */}
                            {lane.isOpen && lane.lastIdx < chapters.length - 1 && (
                                <line
                                    x1={cx(lane.lastIdx)} y1={y} x2={endX} y2={y}
                                    stroke={color} strokeWidth={1.5}
                                    strokeOpacity={0.25} strokeDasharray="2 5" strokeLinecap="round"
                                />
                            )}
                            {/* ช่วงเงียบเกิน STALE_GAP — ทาบแดงจาง */}
                            {lane.staleRanges.map(([a, b], i) => (
                                <line
                                    key={i}
                                    x1={cx(a) + 8} y1={y} x2={cx(b) - 8} y2={y}
                                    stroke="#ef4444" strokeWidth={3}
                                    strokeOpacity={0.18} strokeLinecap="round"
                                />
                            ))}
                            {/* จุด beat ต่อบท สีตาม role (เฉลย > ย้ำ > หว่าน) */}
                            {lane.chapterBeats.map((roles, ci) => {
                                if (roles.length === 0) return null
                                const role = roles.includes("payoff") ? "payoff"
                                    : roles.includes("reinforce") ? "reinforce" : "seed"
                                return (
                                    <g key={ci}>
                                        <circle
                                            cx={cx(ci)} cy={y} r={role === "payoff" ? 5 : 3.5}
                                            fill={ROLE_COLOR[role]}
                                            stroke="var(--background)" strokeWidth={1.5}
                                        />
                                        {roles.length > 1 && (
                                            <text
                                                x={cx(ci)} y={y - 7} textAnchor="middle"
                                                fontSize={7} className="font-technical"
                                                fill={ROLE_COLOR[role]}
                                            >
                                                ×{roles.length}
                                            </text>
                                        )}
                                    </g>
                                )
                            })}
                            {/* เครื่องหมายปมค้างท้ายเรื่อง */}
                            {lane.isOpen && (
                                <text
                                    x={endX + 10} y={y + 3}
                                    fontSize={8} className="font-technical"
                                    fill="#ef4444" fillOpacity={0.8}
                                    style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}
                                >
                                    ค้าง
                                </text>
                            )}
                        </svg>

                        {/* ป้ายชื่อปม — sticky ติดขอบซ้ายตอน scroll */}
                        <div className="sticky left-2 inline-flex items-center h-full pointer-events-none" style={{ zIndex: 2 }}>
                            <span
                                className={cn(
                                    "px-1.5 py-px rounded-[3px] font-technical text-[8px] uppercase tracking-wider border backdrop-blur-sm bg-background/85 whitespace-nowrap",
                                    lane.thread.importance === "major" ? "font-bold" : "opacity-80"
                                )}
                                style={{ color, borderColor: `${color}40` }}
                                title={`${lane.thread.title} — ${lane.thread.beats.length} beats`}
                            >
                                {lane.thread.title}
                                {lane.isOpen && <span className="ml-1 text-red-500/80">●</span>}
                            </span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

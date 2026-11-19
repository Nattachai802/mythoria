"use client"

import type { ChapterForBoard } from "./types"
import { useMemo, useState } from "react"
import { TimelineEvent } from "@/db/schema"
import { type ThreadWithBeats } from "@/server/plot-threads"
import { threadNeedsPayoff } from "@/lib/plot-thread-analysis"

// ต้องตรงกับ chapter-column (w-[272px]) + gap-3 ของแถวคอลัมน์
const COLUMN_WIDTH = 272
const COLUMN_PITCH = COLUMN_WIDTH + 12
const ROW_H = 34
const STACK = 9 // ระยะห่างจุดที่ซ้อนกันในฉากเดียว
const MAX_STACK = 3

const ROLE_LABEL: Record<string, string> = { seed: "หว่าน", reinforce: "ย้ำ", payoff: "เฉลย" }

interface ThreadRibbonProps {
    threads: ThreadWithBeats[]
    chapters: ChapterForBoard[] // sorted
    events: TimelineEvent[]
}

interface Dot { x: number; y: number; threadId: string; thread: string; color: string; role: string; label: string }

/**
 * เส้นปมแบบเส้นเดียว — ทุก beat เป็นจุดบนเส้นแนวนอนตามตำแหน่งฉากของมัน (ซ้าย = เกิดก่อน)
 * ชี้จุดไหน → เส้นเชื่อมจุดของปมนั้นทั้งเรื่อง ปมอื่นจางลง · ความสูงคงที่ ไม่โตตามจำนวนปม
 */
export function ThreadRibbon({ threads, chapters, events }: ThreadRibbonProps) {
    const [hoverIdx, setHoverIdx] = useState<number | null>(null)

    const { dots, extra, openCount } = useMemo(() => {
        // x ของฉาก: กระจายตามลำดับฉากในคอลัมน์ของบทนั้น
        const xByEvent = new Map<string, { x: number; title: string }>()
        chapters.forEach((c, ci) => {
            const list = events.filter(e => e.relatedChapterId === c.id).sort((a, b) => a.orderIndex - b.orderIndex)
            list.forEach((e, si) => xByEvent.set(e.id, { x: ci * COLUMN_PITCH + ((si + 0.5) / list.length) * COLUMN_WIDTH, title: e.title }))
        })
        const perScene = new Map<string, number>()
        const dots: Dot[] = []
        const extra: { x: number; n: number }[] = []
        for (const t of threads) for (const b of t.beats) {
            const pos = xByEvent.get(b.eventId)
            if (!pos) continue
            const n = perScene.get(b.eventId) ?? 0
            perScene.set(b.eventId, n + 1)
            if (n >= MAX_STACK) continue
            dots.push({
                x: pos.x, y: ROW_H / 2 + [0, -STACK, STACK][n],
                threadId: t.id, thread: t.title, color: t.color ?? "var(--forge-amber)", role: b.role,
                label: `${ROLE_LABEL[b.role] ?? b.role} · ฉาก ${pos.title}`,
            })
        }
        perScene.forEach((n, id) => { if (n > MAX_STACK) extra.push({ x: xByEvent.get(id)!.x, n: n - MAX_STACK }) })
        return { dots, extra, openCount: threads.filter(threadNeedsPayoff).length }
    }, [threads, chapters, events])

    if (chapters.length === 0) return null
    const width = chapters.length * COLUMN_PITCH - 12
    const hoverDot = hoverIdx !== null ? dots[hoverIdx] : null
    const hover = hoverDot?.threadId ?? null
    const hovered = hover ? dots.filter(d => d.threadId === hover).sort((a, b) => a.x - b.x) : []

    return (
        <div style={{ width }}>
            <div className="sticky left-0 flex w-fit items-center gap-3 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">ปม</span>
                <span className="inline-flex items-center gap-1"><Mark role="seed" color="currentColor" />หว่าน</span>
                <span className="inline-flex items-center gap-1"><Mark role="reinforce" color="currentColor" />ย้ำ</span>
                <span className="inline-flex items-center gap-1"><Mark role="payoff" color="currentColor" />เฉลย</span>
                {openCount > 0 && <span className="text-[var(--forge-amber)]">ค้าง {openCount}</span>}
            </div>
            <div className="relative">
            <svg
                width={width} height={ROW_H} className="block overflow-visible"
                role="img" aria-label={`เส้นปม ${threads.length} ปม ${dots.length} จุด`}
                onMouseLeave={() => setHoverIdx(null)}
            >
                <line x1={0} x2={width} y1={ROW_H / 2} y2={ROW_H / 2} stroke="var(--border)" />
                {chapters.map((c, i) => i > 0 && (
                    <line key={c.id} x1={i * COLUMN_PITCH - 6} x2={i * COLUMN_PITCH - 6} y1={ROW_H / 2 - 4} y2={ROW_H / 2 + 4} stroke="var(--border)" />
                ))}
                {hovered.length > 1 && (
                    <polyline
                        points={hovered.map(d => `${d.x},${d.y}`).join(" ")}
                        fill="none" stroke={hovered[0].color} strokeWidth={1.5} strokeLinejoin="round"
                        className="animate-in fade-in duration-150"
                    />
                )}
                {dots.map((d, i) => (
                    <g
                        key={i} transform={`translate(${d.x} ${d.y})`}
                        className="cursor-default transition-opacity duration-150 motion-reduce:transition-none"
                        opacity={hover && hover !== d.threadId ? 0.2 : 1}
                        onMouseEnter={() => setHoverIdx(i)}
                    >
                        <title>{`${d.thread} · ${d.label}`}</title>
                        <circle r={8} fill="transparent" />
                        <Mark role={d.role} color={d.color} svg />
                    </g>
                ))}
                {extra.map((e, i) => (
                    <text key={i} x={e.x + 7} y={ROW_H / 2 - STACK - 2} fontSize={9} fill="var(--muted-foreground)">+{e.n}</text>
                ))}
            </svg>
            {/* ป้ายชื่อปมตอนชี้ — ลอยเหนือจุด (title ของ svg ขึ้นช้าและบางเบราว์เซอร์ไม่โชว์) */}
            {hoverDot && (
                <div
                    role="tooltip"
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
                    style={{ left: hoverDot.x, top: hoverDot.y - 10 }}
                >
                    <p className="flex items-center gap-1.5 font-medium">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hoverDot.color }} />
                        {hoverDot.thread}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{hoverDot.label} · {hovered.length} จุดในเรื่อง</p>
                </div>
            )}
            </div>
        </div>
    )
}

/** หว่าน = วงกลวง · ย้ำ = จุดทึบ · เฉลย = ข้าวหลามตัด — แยกด้วยรูปทรง ไม่พึ่งสีอย่างเดียว */
function Mark({ role, color, svg }: { role: string; color: string; svg?: boolean }) {
    const shape = role === "payoff"
        ? <rect x={-3.5} y={-3.5} width={7} height={7} transform="rotate(45)" fill={color} />
        : role === "reinforce"
            ? <circle r={3.5} fill={color} />
            : <circle r={3} fill="var(--background)" stroke={color} strokeWidth={1.5} />
    if (svg) return shape
    return <svg width={10} height={10} viewBox="-5 -5 10 10" aria-hidden="true">{shape}</svg>
}

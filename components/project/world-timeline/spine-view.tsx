"use client"

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { TlColumn, TlSegment } from "@/lib/world-timeline"
import { layoutSpine, spineDropAt, type SpineSide } from "@/lib/world-spine"

export type SpineCategory = "plot" | "lore" | "characters" | "factions" | "powers" | "warning"

export interface SpineEntry {
    key: string
    col: number
    side: SpineSide
    category: SpineCategory
    /** เวลาเป็นค่าประมาณ → ก้านเส้นประ */
    approx?: boolean
    node: ReactNode
}

/** สีก้าน/หมุดต่อหมวด — ความหมายไม่ได้พึ่งสีอย่างเดียว (การ์ดมีสัญลักษณ์ของตัวเองอยู่แล้ว) */
export const SPINE_COLOR: Record<SpineCategory, string> = {
    plot: "var(--forge-gold)",
    lore: "#8b5cf6",
    characters: "#10b981",
    factions: "#0ea5e9",
    powers: "#f97316",
    warning: "#ef4444",
}

const CARD_W = 168
const LEVEL_H = 52
const STEM_MIN = 30
const BAND_H = 20
const DRAG_MIME = "application/x-world-timeline"

interface Props {
    columns: TlColumn[]
    segments: TlSegment[]
    entries: SpineEntry[]
    base: number
    breakDays: number
    colLabel: (col: number) => string
    breakLabel: (days: number) => string
    dragging: boolean
    onDrop: (raw: string, col: number, mode: "on" | "before") => void
    onCreate: (col: number) => void
}

export function SpineView({ columns, segments, entries, base, breakDays, colLabel, breakLabel, dragging, onDrop, onCreate }: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [hover, setHover] = useState<{ col: number; mode: "on" | "before" } | null>(null)
    const boxRef = useRef<HTMLDivElement>(null)

    const layout = useMemo(
        () => layoutSpine(columns, entries.map(e => ({ id: e.key, col: e.col, side: e.side })), {
            base, cardW: CARD_W, breakDays, clusterMax: 3, expanded,
        }),
        [columns, entries, base, breakDays, expanded],
    )
    const byKey = useMemo(() => new Map(entries.map(e => [e.key, e])), [entries])

    const upH = STEM_MIN + Math.max(layout.levels.up, 1) * LEVEL_H
    const downH = STEM_MIN + Math.max(layout.levels.down, 1) * LEVEL_H
    const spineY = upH + 8
    const height = spineY + downH + 16
    // การ์ดชั้น L: ข้างบนนับขึ้นจากเส้น, ข้างล่างนับลง
    const cardTop = (side: SpineSide, level: number) =>
        side === "up" ? spineY - STEM_MIN - (level + 1) * LEVEL_H + 8 : spineY + STEM_MIN + level * LEVEL_H
    const stem = (side: SpineSide, level: number) =>
        side === "up"
            ? { top: cardTop("up", level) + LEVEL_H - 8, bottom: spineY }
            : { top: spineY, bottom: cardTop("down", level) }

    const xOf = (e: DragEvent) => e.clientX - (boxRef.current?.getBoundingClientRect().left ?? 0)
    const segX = (s: TlSegment) => [layout.bounds[s.start]?.[0] ?? 0, layout.bounds[s.end]?.[1] ?? layout.width]

    return (
        <div className="grid-pattern-subtle min-h-0 flex-1 overflow-auto">
            <div
                ref={boxRef}
                className="relative"
                style={{ width: Math.max(layout.width, 600), height }}
                onDragOver={dragging ? e => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    const z = spineDropAt(layout, xOf(e))
                    if (z && (hover?.col !== z.col || hover.mode !== z.mode)) setHover(z)
                } : undefined}
                onDragLeave={dragging ? e => { if (e.currentTarget === e.target) setHover(null) } : undefined}
                onDrop={dragging ? e => {
                    e.preventDefault()
                    const z = spineDropAt(layout, xOf(e))
                    setHover(null)
                    const raw = e.dataTransfer.getData(DRAG_MIME)
                    if (z && raw) onDrop(raw, z.col, z.mode)
                } : undefined}
            >
                <span className="text-technical absolute left-3 top-2 text-muted-foreground">เรื่องหลัก ↑</span>
                <span className="text-technical absolute bottom-2 left-3 text-muted-foreground">โลก · ตัวละคร ↓</span>

                {/* ── เส้นหลัก: แถบยุค ── */}
                {segments.map(s => {
                    const [l, r] = segX(s)
                    return (
                        <div
                            key={s.eraId ?? "_none"}
                            className="absolute flex items-center overflow-hidden border-y border-[var(--steel-600)] px-2 font-display text-xs font-semibold text-white"
                            style={{ left: l, width: r - l, top: spineY - BAND_H / 2, height: BAND_H, background: s.color ?? "var(--steel-600)" }}
                            title={s.name}
                        >
                            <span className="truncate drop-shadow-[0_1px_1px_rgba(0,0,0,.6)]">{s.name}</span>
                        </div>
                    )
                })}
                {layout.breaks.map(b => (
                    <div
                        key={b.x}
                        className="absolute flex -translate-x-1/2 flex-col items-center"
                        style={{ left: b.x, top: spineY - BAND_H / 2 - 4 }}
                        title={`ช่วงว่าง ${breakLabel(b.days)}`}
                    >
                        <span className="bg-background px-0.5 font-mono text-base font-bold leading-[28px] text-[var(--steel-400)]">⫽</span>
                        <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{breakLabel(b.days)}</span>
                    </div>
                ))}

                {/* ── ขีดเวลาใต้เส้น (ดับเบิลคลิก = สร้างเหตุการณ์ที่นี่) ── */}
                {layout.colX.map((x, i) => (
                    <button
                        key={i}
                        type="button"
                        className="absolute h-6 -translate-x-1/2 cursor-cell whitespace-nowrap px-1 font-mono text-[11px] tabular-nums text-muted-foreground hover:text-[var(--forge-gold)]"
                        style={{ left: x, top: spineY + BAND_H / 2 + 1 }}
                        onDoubleClick={() => onCreate(i)}
                        title={`${colLabel(i)} · ดับเบิลคลิกเพื่อสร้างเหตุการณ์ที่นี่`}
                    >
                        {colLabel(i)}
                    </button>
                ))}

                {/* ── ก้าน + การ์ด ── */}
                {layout.items.map(p => {
                    const e = byKey.get(p.id)!
                    const st = stem(p.side, p.level)
                    const color = SPINE_COLOR[e.category]
                    return (
                        <div key={p.id}>
                            <span
                                className="absolute w-0"
                                style={{ left: p.x, top: st.top, height: st.bottom - st.top, borderLeft: `1.5px ${e.approx ? "dashed" : "solid"} ${color}` }}
                                aria-hidden
                            />
                            <span
                                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
                                style={{ left: p.x, top: spineY, background: color }}
                                aria-hidden
                            />
                            <div
                                className={cn(
                                    "absolute -translate-x-1/2 bg-background",
                                    p.side === "up" ? "border-b-2" : "border-t-2",
                                )}
                                style={{ left: p.x, top: cardTop(p.side, p.level), width: CARD_W, borderColor: color }}
                            >
                                {e.node}
                            </div>
                        </div>
                    )
                })}
                {layout.clusters.map(c => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => setExpanded(s => new Set(s).add(c.key))}
                        className="chamfered-sm absolute -translate-x-1/2 border border-dashed border-[var(--steel-400)] bg-[var(--steel-800)] px-3 py-1.5 font-mono text-xs text-[var(--forge-yellow)] hover:bg-[var(--steel-600)]"
                        style={{ left: c.x, top: cardTop(c.side, c.level) }}
                        title="กางดูทั้งหมด"
                    >
                        +{c.hidden} อื่น ๆ
                    </button>
                ))}
                {expanded.size > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpanded(new Set())}
                        className="text-technical absolute right-3 top-2 text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                        ยุบกลุ่มทั้งหมด
                    </button>
                )}

                {/* ── ตัวบอกตำแหน่งตอนลาก ── */}
                {dragging && hover && (() => {
                    const x = hover.mode === "before"
                        ? (layout.colX[hover.col - 1] + layout.colX[hover.col]) / 2
                        : layout.colX[hover.col]
                    return (
                        <div className="pointer-events-none absolute inset-y-0 z-40" style={{ left: x }}>
                            <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--forge-gold)]" />
                            <span className="chamfered-sm absolute -translate-x-1/2 whitespace-nowrap bg-[var(--forge-gold)] px-2 py-0.5 text-xs font-semibold text-black" style={{ top: spineY - 40 }}>
                                {hover.mode === "before" ? `แทรกก่อน ${colLabel(hover.col)}` : `วางที่ ${colLabel(hover.col)}`}
                            </span>
                        </div>
                    )
                })()}
            </div>
        </div>
    )
}

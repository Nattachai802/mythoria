"use client"

import { useMemo } from "react"
import { Chapter } from "@/db/schema"
import { STORY_STRUCTURES, type StoryStructure } from "@/lib/story-structures"

const COLUMN_WIDTH = 260 // ต้องตรงกับ ArcStrip / ChapterColumn
const MIN_LABEL_GAP = 64 // px — ใกล้กว่านี้สลับ label ขึ้นชั้นบน กันทับ

interface Props {
    structureId: string
    chapters: Chapter[]
}

export function StructureOverlay({ structureId, chapters }: Props) {
    const structure = STORY_STRUCTURES.find(s => s.id === structureId)

    // วาง beat ตาม % บนความกว้างเต็ม (template) — ไม่ snap เข้าบท จึงไม่ชนกัน
    const markers = useMemo(() => {
        if (!structure) return []
        const totalWidth = chapters.length * COLUMN_WIDTH
        const positioned = structure.stages
            .filter(s => s.pos != null)
            .map(s => ({ stage: s, left: (s.pos! / 100) * totalWidth }))
            .sort((a, b) => a.left - b.left)

        // label ใกล้ตัวก่อนหน้าเกินไป → ดันขึ้นชั้นบน (สลับ 0/1)
        let prevLeft = -Infinity
        let prevRow = 1
        return positioned.map(m => {
            const row = m.left - prevLeft < MIN_LABEL_GAP ? (prevRow === 0 ? 1 : 0) : 0
            prevLeft = m.left
            prevRow = row
            return { ...m, row }
        })
    }, [structure, chapters.length])

    if (!structure) return null

    const totalWidth = chapters.length * COLUMN_WIDTH

    return (
        <div className="relative flex-shrink-0" style={{ width: totalWidth + 32, height: 52 }}>
            {/* เส้น template ต่อเนื่อง 0–100% */}
            <div
                className="absolute top-[38px] left-0"
                style={{
                    width: totalWidth,
                    height: 1,
                    background: "repeating-linear-gradient(to right, var(--forge-amber) 0 8px, transparent 8px 14px)",
                    opacity: 0.5,
                }}
            />
            {/* หมุด %  ที่ 0/25/50/75/100 เป็น reference เบาๆ */}
            {[0, 25, 50, 75, 100].map(pct => (
                <span
                    key={pct}
                    className="absolute top-[42px] font-technical text-[8px] text-muted-foreground tabular-nums -translate-x-1/2"
                    style={{ left: (pct / 100) * totalWidth }}
                >
                    {pct}%
                </span>
            ))}

            {/* Beat markers */}
            {markers.map(({ stage, left, row }, i) => (
                <div
                    key={i}
                    className="absolute flex flex-col items-start"
                    style={{ left, top: row === 0 ? 16 : 0, maxWidth: 150 }}
                >
                    <span className="font-technical text-[9px] uppercase tracking-[0.06em] text-[var(--forge-amber)] truncate leading-tight">
                        {stage.nameTh ?? stage.name}
                    </span>
                    {/* ก้านชี้ลงเส้น */}
                    <span
                        className="w-px bg-[var(--forge-amber)]/40"
                        style={{ height: row === 0 ? 22 : 38, marginLeft: 1 }}
                    />
                </div>
            ))}
        </div>
    )
}

// ตัวเลือกสูตร — เฉพาะแบบ positional (วาง beat ตามตำแหน่งได้)
export const POSITIONAL_STRUCTURES: StoryStructure[] = STORY_STRUCTURES.filter(s => s.positional)

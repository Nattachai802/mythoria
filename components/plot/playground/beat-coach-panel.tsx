"use client"

import { useMemo, useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Activity, Sparkles, Loader2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { analyzeBeats, collapseByBeat, type BeatCoachState } from "@/lib/beat-coach"
import { pacingLabel } from "@/lib/scene-dramatic"
import { coachScenePacing } from "@/server/beat-coach"
import type { CoachAdvice } from "@/lib/beat-coach-ai"

/** สีตามสถานะ — เทา = ปกติ/ยังไม่มีข้อมูล, อำพัน = มีอะไรให้ดู */
const NEEDS_ATTENTION: BeatCoachState[] = ["dragging", "overheated", "flat"]

const STATE_LABEL: Record<string, string> = {
    ok: "จังหวะปกติ",
    dragging: "เอื่อย",
    overheated: "เร่งค้าง",
    flat: "แบน",
    "no-data": "ยังไม่มีข้อมูล",
    insufficient: "ข้อมูลไม่พอ",
    "too-short": "สั้นเกินไป",
}

interface Props {
    novelId: string
    sceneId: string
    /** การ์ดเหตุการณ์ในฉาก (ไม่รวมโน้ต/กลุ่ม) พร้อมจังหวะที่ผู้ใช้ตั้งเอง */
    cards: { id: string; beatIndex: number; pacing: number | null }[]
}

export function BeatCoachPanel({ novelId, sceneId, cards }: Props) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    /** จังหวะที่ AI เดาให้ — ไม่เขียนทับของผู้ใช้ ไม่บันทึกลง DB */
    const [aiBeats, setAiBeats] = useState<Record<string, number>>({})
    const [aiAdvice, setAiAdvice] = useState<CoachAdvice | null>(null)

    // ค่าที่ผู้ใช้ตั้งเองชนะเสมอ — AI เติมเฉพาะช่องว่าง
    const merged = useMemo(
        () => cards.map(c => ({ ...c, pacing: c.pacing ?? aiBeats[c.id] ?? null })),
        [cards, aiBeats],
    )
    const userOnly = useMemo(() => analyzeBeats(collapseByBeat(cards)), [cards])
    const result = useMemo(() => analyzeBeats(collapseByBeat(merged)), [merged])

    const hasAi = Object.keys(aiBeats).length > 0
    const attention = NEEDS_ATTENTION.includes(result.state)

    const handleAsk = async () => {
        if (loading) return
        setLoading(true)
        try {
            const res = await coachScenePacing(sceneId, novelId)
            if (!res.success) { toast.error(res.error); return }
            setAiBeats(res.beats)
            setAiAdvice(res.advice)
            if (Object.keys(res.beats).length === 0 && !res.advice) toast.error("AI ไม่ได้ให้ข้อมูลกลับมา")
        } finally {
            setLoading(false)
        }
    }

    // แถบจังหวะย่อ — เห็นรูปทรงทั้งฉากในบรรทัดเดียว
    const bars = collapseByBeat(merged)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-8 gap-1.5 text-xs", attention && "text-[var(--forge-amber)]")}
                    title="ดูจังหวะการเล่าในฉากนี้"
                >
                    <Activity className="h-4 w-4" />
                    จังหวะ
                    {attention && <span className="h-1.5 w-1.5 rounded-full bg-[var(--forge-amber)]" />}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[320px] p-0 overflow-hidden" align="start">
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-700/60">
                    <Activity className="h-3 w-3 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[9px] uppercase tracking-widest text-zinc-300">
                        จังหวะการเล่าในฉากนี้
                    </span>
                    <span className="ml-auto font-technical text-[9px] uppercase tracking-wider text-zinc-500">
                        {STATE_LABEL[result.state] ?? result.state}
                    </span>
                </div>

                <div className="p-3 space-y-3">
                    {result.beatCount === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">ยังไม่มีการ์ดในฉากนี้</p>
                    ) : (
                        <>
                            {/* แถบรูปทรงจังหวะ */}
                            <div className="flex items-end gap-0.5 h-12">
                                {bars.map((p, i) => (
                                    <div
                                        key={i}
                                        title={p == null ? "ยังไม่ตั้งจังหวะ" : `${p}/10 · ${pacingLabel(p)}`}
                                        className={cn(
                                            "flex-1 min-w-[3px] chamfered-sm",
                                            p == null ? "bg-muted h-1.5" : "bg-[var(--forge-amber)]",
                                        )}
                                        style={p == null ? undefined : { height: `${(p / 10) * 100}%` }}
                                    />
                                ))}
                            </div>

                            <p className="text-xs leading-relaxed">{result.text}</p>

                            {result.suggestion && (
                                <p className="text-[11px] leading-relaxed text-muted-foreground border-l-2 border-[var(--forge-amber)]/40 pl-2">
                                    {result.suggestion}
                                </p>
                            )}

                            {/* ข้อมูลขาดเกินเกณฑ์ → ชวนให้ AI ช่วยอ่าน */}
                            {userOnly.needsAi && !hasAi && (
                                <div className="space-y-2 border-t pt-2.5">
                                    <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-px" />
                                        <span>ตั้งจังหวะไว้ไม่ถึงครึ่ง — สรุปจากข้อมูลเท่านี้ยังเชื่อไม่ได้</span>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="w-full h-7 gap-1.5 chamfered-sm text-xs"
                                        onClick={handleAsk}
                                        disabled={loading}
                                    >
                                        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                        ให้ AI ช่วยวิเคราะห์
                                    </Button>
                                </div>
                            )}

                            {/* ผลจาก AI */}
                            {hasAi && (
                                <div className="space-y-1.5 border-t pt-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <Sparkles className="h-3 w-3 text-[var(--forge-amber)]" />
                                        <span className="font-technical text-[9px] uppercase tracking-widest text-muted-foreground">
                                            AI อ่านให้ · เติม {Object.keys(aiBeats).length} การ์ดที่ยังไม่ได้ตั้ง
                                        </span>
                                    </div>
                                    {aiAdvice && (
                                        <>
                                            <p className="text-xs leading-relaxed">{aiAdvice.text}</p>
                                            {aiAdvice.suggestedNext && (
                                                <p className="text-[11px] leading-relaxed text-muted-foreground border-l-2 border-[var(--forge-amber)]/40 pl-2">
                                                    {aiAdvice.suggestedNext}
                                                </p>
                                            )}
                                        </>
                                    )}
                                    <p className="text-[10px] text-muted-foreground/70 italic">
                                        ค่าที่ AI เดาไม่ได้บันทึกลงการ์ด — ปิดหน้าแล้วหาย
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}

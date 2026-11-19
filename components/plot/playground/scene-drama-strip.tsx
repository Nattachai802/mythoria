"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { Character, TimelineEvent } from "@/db/schema"
import { updateTimelineEvent } from "@/server/timeline"
import { SCENE_TYPES, OUTCOMES, INTENSITIES, computeShift, decodeShift, type SceneType } from "@/lib/scene-dramatic"
import { cn } from "@/lib/utils"
import { SceneDramaticPanel } from "./scene-dramatic-panel"

const short = (l: string) => l.split(/ [(—]/)[0]

/**
 * แถบโครงดราม่า 4 ช่องบนหัวหน้าฉาก (task.md 20C) — แก้ในที่ บันทึกทีละช่องตอนออกจากช่อง
 * เป้าหมาย/อุปสรรค (ป้ายเปลี่ยนตามประเภทฉาก) · ผล (sceneOutcome) · ความแรง (valueShift = เครื่องหมายผล × ความแรง)
 * ช่องอื่น (ประเภท/โทน/pacing/POV/เหตุ-ผล/เวลา) ยังอยู่ในแผง "เพิ่มเติม" ท้ายแถบ
 */
export function SceneDramaStrip({ event, characters, events }: { event: TimelineEvent; characters: Character[]; events: TimelineEvent[] }) {
    const router = useRouter()
    const cfg = SCENE_TYPES[(event.sceneType as SceneType) || "action"] ?? SCENE_TYPES.action
    const [goal, setGoal] = useState(event.sceneGoal ?? "")
    const [conflict, setConflict] = useState(event.sceneConflict ?? "")
    const init = decodeShift(event.valueShift ?? null, event.sceneOutcome ?? null)
    const [outcome, setOutcome] = useState(event.sceneOutcome ? init.outcome : "")
    const [mag, setMag] = useState(init.mag)
    useEffect(() => {
        setGoal(event.sceneGoal ?? "")
        setConflict(event.sceneConflict ?? "")
        const d = decodeShift(event.valueShift ?? null, event.sceneOutcome ?? null)
        setOutcome(event.sceneOutcome ? d.outcome : "")
        setMag(d.mag)
    }, [event.id, event.sceneGoal, event.sceneConflict, event.sceneOutcome, event.valueShift])

    const save = async (patch: Partial<TimelineEvent>) => {
        const res = await updateTimelineEvent(event.id, patch)
        if (!res.success) { toast.error("บันทึกโครงฉากไม่สำเร็จ"); return }
        router.refresh()
    }
    const saveText = (field: "sceneGoal" | "sceneConflict", value: string) => {
        const next = value.trim() || null
        if (next !== (event[field] ?? null)) save({ [field]: next })
    }
    const pickOutcome = (v: string) => {
        const next = v === outcome ? "" : v // กดซ้ำ = ล้าง
        setOutcome(next)
        save(next ? { sceneOutcome: next, valueShift: computeShift(next, mag) } : { sceneOutcome: null, valueShift: null })
    }
    const pickMag = (m: number) => {
        setMag(m)
        if (outcome) save({ valueShift: computeShift(outcome, m) })
    }

    const shift = outcome ? computeShift(outcome, mag) : 0
    const ShiftIcon = shift > 0 ? TrendingUp : shift < 0 ? TrendingDown : Minus
    const label = "text-[11px] font-medium text-muted-foreground"
    const input = "h-8 w-full min-w-0 rounded-sm border border-input bg-transparent px-2 text-sm placeholder:text-muted-foreground hover:border-muted-foreground/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 dark:bg-input/30"
    const seg = (on: boolean) => cn("h-8 px-2 text-xs transition-colors", on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")

    return (
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b bg-background px-4 py-2">
            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                <span className={label}>{short(cfg.field1Label)}</span>
                <input value={goal} onChange={e => setGoal(e.target.value)} onBlur={() => saveText("sceneGoal", goal)}
                    onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} placeholder={cfg.field1Placeholder} className={input} />
            </label>
            <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                <span className={label}>{short(cfg.field2Label)}</span>
                <input value={conflict} onChange={e => setConflict(e.target.value)} onBlur={() => saveText("sceneConflict", conflict)}
                    onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} placeholder={cfg.field2Placeholder} className={input} />
            </label>
            {cfg.outcomeMode !== "off" && (
                <>
                    <div className="flex flex-col gap-1">
                        <span className={label}>ผลของฉาก</span>
                        <div className="flex overflow-hidden rounded-sm border border-input" role="radiogroup" aria-label="ผลของฉาก">
                            {OUTCOMES.map(o => (
                                <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value}
                                    onClick={() => pickOutcome(o.value)} className={cn(seg(outcome === o.value), outcome === o.value && o.cls)}>
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className={label}>สถานการณ์เปลี่ยนแรงแค่ไหน</span>
                        <div className="flex items-center gap-1.5">
                            <div className="flex overflow-hidden rounded-sm border border-input" role="radiogroup" aria-label="ความแรงของการเปลี่ยน">
                                {INTENSITIES.map(i => (
                                    <button key={i.mag} type="button" role="radio" aria-checked={mag === i.mag} disabled={!outcome}
                                        title={outcome ? undefined : "เลือกผลของฉากก่อน"}
                                        onClick={() => pickMag(i.mag)} className={cn(seg(!!outcome && mag === i.mag), "disabled:opacity-40")}>
                                        {i.label}
                                    </button>
                                ))}
                            </div>
                            {outcome && (
                                <ShiftIcon className={cn("h-4 w-4", shift > 0 ? "text-emerald-500" : shift < 0 ? "text-red-500" : "text-amber-500")}
                                    aria-label={`ค่าสถานการณ์ ${shift > 0 ? "+" : ""}${shift}`} />
                            )}
                        </div>
                    </div>
                </>
            )}
            <SceneDramaticPanel event={event} characters={characters} events={events} />
        </div>
    )
}

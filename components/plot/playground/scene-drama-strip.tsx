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
    // ป้ายอยู่ในกรอบเดียวกับช่อง (แถวเดียว สูงเท่ากันหมด) — แทนป้ายลอยเหนือช่องที่ทำให้แถบสูงสองชั้น
    const group = "flex h-8 items-stretch overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/25 hover:border-muted-foreground/50"
    const tag = "flex shrink-0 items-center border-r border-input bg-muted/50 px-2 text-[11px] font-medium text-muted-foreground"
    const input = "min-w-0 flex-1 bg-transparent px-2 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none"
    const seg = (on: boolean) => cn("px-2.5 text-xs transition-colors duration-150", on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground")

    return (
        <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2">
            <label className={cn(group, "min-w-[160px] flex-1")}>
                <span className={tag}>{short(cfg.field1Label)}</span>
                <input value={goal} onChange={e => setGoal(e.target.value)} onBlur={() => saveText("sceneGoal", goal)}
                    onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} placeholder={cfg.field1Placeholder} className={input} />
            </label>
            <label className={cn(group, "min-w-[160px] flex-1")}>
                <span className={tag}>{short(cfg.field2Label)}</span>
                <input value={conflict} onChange={e => setConflict(e.target.value)} onBlur={() => saveText("sceneConflict", conflict)}
                    onKeyDown={e => e.key === "Enter" && e.currentTarget.blur()} placeholder={cfg.field2Placeholder} className={input} />
            </label>
            {cfg.outcomeMode !== "off" && (
                <>
                    <div className={group} role="radiogroup" aria-label="ผลของฉาก">
                        <span className={tag}>ผล</span>
                        {OUTCOMES.map(o => (
                            <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value}
                                onClick={() => pickOutcome(o.value)} className={cn(seg(outcome === o.value), outcome === o.value && o.cls)}>
                                {o.label}
                            </button>
                        ))}
                    </div>
                    <div className={cn(group, !outcome && "opacity-60")} role="radiogroup" aria-label="สถานการณ์เปลี่ยนแรงแค่ไหน" title={outcome ? "สถานการณ์เปลี่ยนแรงแค่ไหน" : "เลือกผลของฉากก่อน"}>
                        <span className={tag}>แรง</span>
                        {INTENSITIES.map(i => (
                            <button key={i.mag} type="button" role="radio" aria-checked={mag === i.mag} disabled={!outcome}
                                onClick={() => pickMag(i.mag)} className={cn(seg(!!outcome && mag === i.mag), "disabled:pointer-events-none")}>
                                {i.label}
                            </button>
                        ))}
                        {outcome && (
                            <span className="flex items-center px-1.5 animate-in fade-in zoom-in-75 duration-200 motion-reduce:animate-none">
                                <ShiftIcon className={cn("h-4 w-4", shift > 0 ? "text-emerald-500" : shift < 0 ? "text-red-500" : "text-amber-500")}
                                    aria-label={`ค่าสถานการณ์ ${shift > 0 ? "+" : ""}${shift}`} />
                            </span>
                        )}
                    </div>
                </>
            )}
            <SceneDramaticPanel event={event} characters={characters} events={events} />
        </div>
    )
}

"use client"

import { useState, useEffect, useTransition } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Target, Swords, Drama, Loader2, CheckCircle2, XCircle, Clock, HelpCircle, Gauge } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateIdea } from "@/server/idea"
import { SCENE_TYPES, OUTCOMES, INTENSITIES, PACING_MIN, PACING_MAX, pacingLabel, computeShift, decodeShift, type SceneType } from "@/lib/scene-dramatic"

const OUTCOME_ICONS: Record<string, typeof CheckCircle2> = {
    success: CheckCircle2, failure: XCircle, ongoing: Clock, unknown: HelpCircle,
}

interface Props {
    ideaId: string
    sceneType?: string | null
    sceneTone?: string | null
    sceneGoal?: string | null
    sceneConflict?: string | null
    sceneOutcome?: string | null
    valueShift?: number | null
    pacing?: number | null
    onSaved?: (patch: Record<string, unknown>) => void
}

// โครงฉากดราม่าระดับการ์ดไอเดีย — การ์ดคือฉากย่อยภายใน playground เดียวกัน
// reuse config เดียวกับ SceneDramaticPanel (lib/scene-dramatic.ts) แต่ตัด POV/เวลา/causal chain
// ออกเพราะเป็นเรื่องระดับฉากใหญ่ ไม่ใช่การ์ดย่อย
export function IdeaDramaticPanel({ ideaId, sceneType: initialType, sceneTone: initialTone, sceneGoal, sceneConflict, sceneOutcome, valueShift, pacing: initialPacing, onSaved }: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [sceneType, setSceneType] = useState<SceneType>((initialType as SceneType) || "action")
    const [tone, setTone] = useState(initialTone ?? "")
    const [pacing, setPacing] = useState(initialPacing ?? 5)
    const [goal, setGoal] = useState(sceneGoal ?? "")
    const [conflict, setConflict] = useState(sceneConflict ?? "")
    const initial = decodeShift(valueShift ?? null, sceneOutcome ?? null)
    const [outcome, setOutcome] = useState(initial.outcome)
    const [mag, setMag] = useState(initial.mag)

    useEffect(() => {
        if (open) {
            setSceneType((initialType as SceneType) || "action")
            setTone(initialTone ?? "")
            setPacing(initialPacing ?? 5)
            setGoal(sceneGoal ?? "")
            setConflict(sceneConflict ?? "")
            const d = decodeShift(valueShift ?? null, sceneOutcome ?? null)
            setOutcome(d.outcome)
            setMag(d.mag)
        }
    }, [open, initialType, initialTone, initialPacing, sceneGoal, sceneConflict, sceneOutcome, valueShift])

    const shift = computeShift(outcome, mag)
    const typeConfig = SCENE_TYPES[sceneType]
    const hasData = !!(sceneGoal || sceneConflict || sceneOutcome || valueShift != null)

    const handleSave = () => {
        startTransition(async () => {
            const patch = {
                sceneType,
                sceneTone: tone.trim() || null,
                pacing,
                sceneGoal: goal.trim() || null,
                sceneConflict: conflict.trim() || null,
                sceneOutcome: outcome,
                valueShift: shift,
            }
            const res = await updateIdea(ideaId, patch)
            if (res.success) {
                toast.success("บันทึกโครงฉากย่อยแล้ว")
                onSaved?.(patch)
                setOpen(false)
            } else {
                toast.error(res.error || "บันทึกไม่สำเร็จ")
            }
        })
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button" variant="ghost" size="sm"
                    className={cn(
                        "h-7 text-xs gap-1 text-muted-foreground hover:text-foreground",
                        hasData && "text-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Drama className="w-3 h-3" />
                    โครงฉาก
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 overflow-hidden" align="end" onPointerDown={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                    <Drama className="h-3.5 w-3.5 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300">โครงฉากย่อย (การ์ดนี้)</span>
                </div>

                <div className="p-3 space-y-4 max-h-[min(70vh,520px)] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">ประเภทฉากย่อย</label>
                            <Select value={sceneType} onValueChange={v => setSceneType(v as SceneType)}>
                                <SelectTrigger className="h-8 text-xs chamfered-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SCENE_TYPES).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">โทน</label>
                            <Input value={tone} onChange={e => setTone(e.target.value)} placeholder={'เช่น "ตึงเครียด"'} className="h-8 text-xs chamfered-sm" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                            <span className="flex items-center gap-1.5"><Gauge className="h-3 w-3" />จังหวะการเล่า</span>
                            <span className="text-[var(--forge-amber)] font-technical tabular-nums">{pacing}/10 · {pacingLabel(pacing)}</span>
                        </label>
                        <Slider
                            min={PACING_MIN} max={PACING_MAX} step={1}
                            value={[pacing]}
                            onValueChange={([v]) => setPacing(v)}
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground/70 font-technical">
                            <span>ผ่อน — เล่าเร็ว</span>
                            <span>เร่ง — ลงรายละเอียด</span>
                        </div>
                    </div>

                    <div className="h-px bg-border/50" />

                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Target className="h-3 w-3" />{typeConfig.field1Label}
                        </label>
                        <Input value={goal} onChange={e => setGoal(e.target.value)} placeholder={typeConfig.field1Placeholder} className="h-8 text-xs chamfered-sm" />
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Swords className="h-3 w-3" />{typeConfig.field2Label}
                        </label>
                        <Input value={conflict} onChange={e => setConflict(e.target.value)} placeholder={typeConfig.field2Placeholder} className="h-8 text-xs chamfered-sm" />
                    </div>

                    {typeConfig.outcomeMode !== "off" && (
                        <>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-muted-foreground">ผลลัพธ์</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {OUTCOMES.map(o => {
                                        const Icon = OUTCOME_ICONS[o.value]
                                        const active = outcome === o.value
                                        return (
                                            <button key={o.value} type="button" onClick={() => setOutcome(o.value)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2 py-1.5 chamfered-sm border text-xs transition-colors",
                                                    active ? "border-current bg-muted " + o.cls : "border-border/60 text-muted-foreground hover:border-border"
                                                )}>
                                                <Icon className="h-3.5 w-3.5 shrink-0" />{o.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className={cn("space-y-1.5 transition-opacity", computeShift(outcome, 1) === 0 && "opacity-40 pointer-events-none")}>
                                <label className="text-[11px] font-medium text-muted-foreground">ความเข้มข้น</label>
                                <div className="flex gap-1.5">
                                    {INTENSITIES.map(it => (
                                        <button key={it.label} type="button" onClick={() => setMag(it.mag)}
                                            className={cn(
                                                "flex-1 h-7 chamfered-sm border text-[11px] transition-colors",
                                                mag === it.mag ? "border-[var(--forge-amber)]/60 bg-[var(--forge-amber)]/10 text-[var(--forge-amber)]" : "border-border/60 text-muted-foreground hover:border-border"
                                            )}>
                                            {it.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <Button type="button" size="sm" className="w-full h-8 chamfered-sm" disabled={isPending} onClick={handleSave}>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                        บันทึกโครงฉากย่อย
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

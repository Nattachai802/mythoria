"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TimelineEvent } from "@/db/schema"
import { updateTimelineEvent } from "@/server/timeline"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Target, Swords, Drama, Loader2, TrendingUp, TrendingDown, Minus, HelpCircle,
    CheckCircle2, XCircle, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// outcome → ทิศของ value-shift
const OUTCOMES = [
    { value: "success", label: "ดีขึ้น", icon: CheckCircle2, sign: 1, cls: "text-emerald-500" },
    { value: "failure", label: "แย่ลง", icon: XCircle, sign: -1, cls: "text-red-500" },
    { value: "ongoing", label: "คาราคาซัง", icon: Clock, sign: 0, cls: "text-amber-500" },
    { value: "unknown", label: "ยังไม่ชัด", icon: HelpCircle, sign: 0, cls: "text-muted-foreground" },
] as const

// ความเข้ม → magnitude
const INTENSITIES = [
    { label: "เบา", mag: 2 },
    { label: "กลาง", mag: 3 },
    { label: "หนัก", mag: 5 },
] as const

function computeShift(outcome: string, mag: number): number {
    const o = OUTCOMES.find(o => o.value === outcome)
    if (!o) return 0
    return o.sign * mag
}

// แปลง valueShift กลับเป็น outcome+mag เพื่อ pre-fill (เดาจากเครื่องหมาย)
function decodeShift(shift: number | null, storedOutcome: string | null): { outcome: string; mag: number } {
    const outcome = storedOutcome || (shift == null ? "unknown" : shift > 0 ? "success" : shift < 0 ? "failure" : "ongoing")
    const mag = shift == null ? 3 : Math.min(5, Math.max(2, Math.abs(shift) || 3))
    return { outcome, mag }
}

interface Props {
    event: TimelineEvent
}

export function SceneDramaticPanel({ event }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [goal, setGoal] = useState(event.sceneGoal ?? "")
    const [conflict, setConflict] = useState(event.sceneConflict ?? "")
    const initial = decodeShift(event.valueShift ?? null, event.sceneOutcome ?? null)
    const [outcome, setOutcome] = useState(initial.outcome)
    const [mag, setMag] = useState(initial.mag)

    useEffect(() => {
        if (open) {
            setGoal(event.sceneGoal ?? "")
            setConflict(event.sceneConflict ?? "")
            const d = decodeShift(event.valueShift ?? null, event.sceneOutcome ?? null)
            setOutcome(d.outcome)
            setMag(d.mag)
        }
    }, [open, event])

    const shift = computeShift(outcome, mag)
    const hasData = event.sceneGoal || event.sceneConflict || event.sceneOutcome || event.valueShift != null

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateTimelineEvent(event.id, {
                sceneGoal: goal.trim() || null,
                sceneConflict: conflict.trim() || null,
                sceneOutcome: outcome,
                valueShift: shift,
            })
            if (res.success) {
                toast.success("บันทึกโครงฉากแล้ว")
                setOpen(false)
                router.refresh()
            } else {
                toast.error("บันทึกไม่สำเร็จ")
            }
        })
    }

    const ShiftIcon = shift > 0 ? TrendingUp : shift < 0 ? TrendingDown : Minus
    const shiftCls = shift > 0 ? "text-emerald-500" : shift < 0 ? "text-red-500" : "text-amber-500"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 gap-1.5 chamfered-sm font-technical text-[9px] uppercase tracking-[0.08em]",
                        hasData && "border-[var(--forge-amber)]/50 text-[var(--forge-amber)]"
                    )}
                >
                    <Drama className="h-3.5 w-3.5" />
                    โครงฉากดราม่า
                    {hasData && event.valueShift != null && (
                        <span className={cn("flex items-center", shiftCls)}>
                            <ShiftIcon className="h-3 w-3" />
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                    <Drama className="h-3.5 w-3.5 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300">โครงฉากดราม่า</span>
                </div>

                <div className="p-3 space-y-3">
                    {/* Goal */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Target className="h-3 w-3" />เป้าหมายของฉาก
                        </label>
                        <Input
                            value={goal}
                            onChange={e => setGoal(e.target.value)}
                            placeholder="ตัวละครต้องการอะไรในฉากนี้"
                            className="h-8 text-xs chamfered-sm"
                        />
                    </div>

                    {/* Conflict */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Swords className="h-3 w-3" />อุปสรรค
                        </label>
                        <Input
                            value={conflict}
                            onChange={e => setConflict(e.target.value)}
                            placeholder="อะไรขวางไม่ให้สำเร็จ"
                            className="h-8 text-xs chamfered-sm"
                        />
                    </div>

                    {/* Outcome */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">ผลลัพธ์ — ฉากจบแล้วสถานการณ์</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {OUTCOMES.map(o => {
                                const Icon = o.icon
                                const active = outcome === o.value
                                return (
                                    <button
                                        key={o.value}
                                        onClick={() => setOutcome(o.value)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2 py-1.5 chamfered-sm border text-xs transition-colors",
                                            active
                                                ? "border-current bg-muted " + o.cls
                                                : "border-border/60 text-muted-foreground hover:border-border"
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                        {o.label}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Intensity — disabled ถ้า outcome ไม่มีทิศ */}
                    <div className={cn("space-y-1.5 transition-opacity", computeShift(outcome, 1) === 0 && "opacity-40 pointer-events-none")}>
                        <label className="text-[11px] font-medium text-muted-foreground">ความเข้มข้น</label>
                        <div className="flex gap-1.5">
                            {INTENSITIES.map(it => (
                                <button
                                    key={it.label}
                                    onClick={() => setMag(it.mag)}
                                    className={cn(
                                        "flex-1 h-7 chamfered-sm border text-[11px] transition-colors",
                                        mag === it.mag
                                            ? "border-[var(--forge-amber)]/60 bg-[var(--forge-amber)]/10 text-[var(--forge-amber)]"
                                            : "border-border/60 text-muted-foreground hover:border-border"
                                    )}
                                >
                                    {it.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Live value-shift preview */}
                    <div className="flex items-center justify-between px-2.5 py-2 chamfered-sm bg-muted/50 border border-border/60">
                        <span className="text-[11px] text-muted-foreground">การเปลี่ยนค่า (ป้อนเส้น tension)</span>
                        <span className={cn("flex items-center gap-1 font-display font-bold tabular-nums text-sm", shiftCls)}>
                            <ShiftIcon className="h-3.5 w-3.5" />
                            {shift > 0 ? `+${shift}` : shift}
                        </span>
                    </div>

                    <Button size="sm" className="w-full h-8 chamfered-sm" disabled={isPending} onClick={handleSave}>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                        บันทึกโครงฉาก
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TimelineEvent, Character } from "@/db/schema"
import { updateTimelineEvent } from "@/server/timeline"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import {
    Target, Swords, Drama, Loader2, TrendingUp, TrendingDown, Minus, HelpCircle,
    CheckCircle2, XCircle, Clock, Eye, GitCommitHorizontal, CalendarClock, Sparkles, Gauge,
} from "lucide-react"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { suggestSceneType } from "@/server/scene-type-suggest"
import { SCENE_TYPES, OUTCOMES, INTENSITIES, PACING_MIN, PACING_MAX, pacingLabel, computeShift, decodeShift, type SceneType } from "@/lib/scene-dramatic"

// ไอคอนต่อ outcome — แยกไว้ในไฟล์นี้เพราะ lib/scene-dramatic.ts เป็น pure data ไม่มี React
const OUTCOME_ICONS: Record<string, typeof CheckCircle2> = {
    success: CheckCircle2, failure: XCircle, ongoing: Clock, unknown: HelpCircle,
}

interface Props {
    event: TimelineEvent
    characters?: Character[]
    events?: TimelineEvent[] // ฉากทั้งเรื่อง (เรียงตามลำดับเล่า) สำหรับเลือกฉากต้นเหตุ
}

// ห่วงโซ่เหตุ-ผล (P2)
const CAUSE_KINDS = [
    { value: "therefore", label: "ดังนั้น", desc: "ฉากนี้เป็นผลต่อเนื่อง", cls: "text-emerald-500 border-emerald-500/50 bg-emerald-500/10" },
    { value: "but", label: "แต่ว่า", desc: "ฉากนี้หักเห/ขัดขวาง", cls: "text-red-500 border-red-500/50 bg-red-500/10" },
] as const

export function SceneDramaticPanel({ event, characters = [], events = [] }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const [sceneType, setSceneType] = useState<SceneType>((event.sceneType as SceneType) || "action")
    const [sceneTone, setSceneTone] = useState(event.sceneTone ?? "")
    const [pacing, setPacing] = useState(event.pacing ?? 5)
    const [goal, setGoal] = useState(event.sceneGoal ?? "")
    const [conflict, setConflict] = useState(event.sceneConflict ?? "")
    const initial = decodeShift(event.valueShift ?? null, event.sceneOutcome ?? null)
    const [outcome, setOutcome] = useState(initial.outcome)
    const [mag, setMag] = useState(initial.mag)
    const [povId, setPovId] = useState(event.povCharacterId ?? "none")
    const [causeKind, setCauseKind] = useState(event.causeKind ?? "none")
    const [causeEventId, setCauseEventId] = useState(event.causeEventId ?? "none")
    const [causeNote, setCauseNote] = useState(event.causeNote ?? "")
    const [eventDate, setEventDate] = useState(event.eventDate ?? "")
    const [isSuggesting, setIsSuggesting] = useState(false)

    useEffect(() => {
        if (open) {
            setSceneType((event.sceneType as SceneType) || "action")
            setSceneTone(event.sceneTone ?? "")
            setPacing(event.pacing ?? 5)
            setGoal(event.sceneGoal ?? "")
            setConflict(event.sceneConflict ?? "")
            const d = decodeShift(event.valueShift ?? null, event.sceneOutcome ?? null)
            setOutcome(d.outcome)
            setMag(d.mag)
            setPovId(event.povCharacterId ?? "none")
            setCauseKind(event.causeKind ?? "none")
            setCauseEventId(event.causeEventId ?? "none")
            setCauseNote(event.causeNote ?? "")
            setEventDate(event.eventDate ?? "")
        }
    }, [open, event])

    const shift = computeShift(outcome, mag)
    const hasData = event.sceneGoal || event.sceneConflict || event.sceneOutcome || event.valueShift != null || event.povCharacterId
    const typeConfig = SCENE_TYPES[sceneType]

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateTimelineEvent(event.id, {
                sceneType,
                sceneTone: sceneTone.trim() || null,
                pacing,
                sceneGoal: goal.trim() || null,
                sceneConflict: conflict.trim() || null,
                sceneOutcome: outcome,
                valueShift: shift,
                povCharacterId: povId === "none" ? null : povId,
                causeKind: causeKind === "none" ? null : causeKind,
                causeEventId: causeKind === "none" || causeEventId === "none" ? null : causeEventId,
                causeNote: causeKind === "none" ? null : (causeNote.trim() || null),
                eventDate: eventDate.trim() || null,
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

    // AI prefill — แค่เติมฟอร์ม ไม่ save เอง คนต้องกด "บันทึกโครงฉาก" เองถึงจะมีผลจริง
    const handleAiSuggest = () => {
        setIsSuggesting(true)
        startTransition(async () => {
            const res = await suggestSceneType(event.id, event.novelId)
            setIsSuggesting(false)
            if (!res.success) {
                toast.error(res.error || "แนะนำไม่สำเร็จ")
                return
            }
            const d = res.data
            setSceneType(d.sceneType)
            setGoal(d.field1)
            setConflict(d.field2)
            if (d.outcome) setOutcome(d.outcome)
            if (d.pacing != null) setPacing(d.pacing)
            toast.success("AI แนะนำแล้ว — ตรวจก่อนกดบันทึก")
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
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300 flex-1">โครงฉากดราม่า</span>
                    <Button
                        variant="ghost" size="sm"
                        className="h-6 px-1.5 gap-1 text-[10px] text-zinc-400 hover:text-[var(--forge-amber)]"
                        disabled={isSuggesting || isPending}
                        onClick={handleAiSuggest}
                        title="ให้ AI ช่วยเดา — แค่เติมฟอร์ม ไม่ save เอง"
                    >
                        {isSuggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        AI ช่วยเดา
                    </Button>
                </div>

                <div className="p-3 space-y-4 max-h-[min(70vh,600px)] overflow-y-auto">
                    {/* ประเภทฉาก + โทน — กรอบเรื่อง จัดกลุ่มเดียวกัน วางคู่กันแทนสองแถวเต็มความกว้าง */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">ประเภทฉาก</label>
                            <Select value={sceneType} onValueChange={v => setSceneType(v as SceneType)}>
                                <SelectTrigger className="h-8 text-xs chamfered-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(SCENE_TYPES).map(([k, v]) => (
                                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[11px] font-medium text-muted-foreground">โทนของฉาก</label>
                            <Input
                                value={sceneTone}
                                onChange={e => setSceneTone(e.target.value)}
                                placeholder={'เช่น "ตึงเครียด"'}
                                className="h-8 text-xs chamfered-sm"
                            />
                        </div>
                    </div>

                    {/* จังหวะการเล่า (pacing) — คนละมิติจาก outcome/valueShift (ทิศสถานการณ์) */}
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

                    {/* POV (P1) — ฉากนี้เล่าผ่านสายตาใคร */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Eye className="h-3 w-3" />มุมมอง (POV) — เล่าผ่านสายตาใคร
                        </label>
                        <Select value={povId} onValueChange={setPovId}>
                            <SelectTrigger className="h-8 text-xs chamfered-sm">
                                <SelectValue placeholder="ยังไม่กำหนด" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">— ยังไม่กำหนด —</SelectItem>
                                {characters.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* เวลาในเรื่อง (P3) — ป้ายแสดงบนเส้นเวลาจริง */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <CalendarClock className="h-3 w-3" />เวลาในเรื่อง
                        </label>
                        <Input
                            value={eventDate}
                            onChange={e => setEventDate(e.target.value)}
                            placeholder={'เช่น "ฤดูหนาวปีที่ 3", "คืนเดียวกับฉากงานเลี้ยง"'}
                            className="h-8 text-xs chamfered-sm"
                        />
                    </div>

                    {/* Causal chain (P2) — Therefore/But */}
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <GitCommitHorizontal className="h-3 w-3" />ฉากนี้ต่อจากเรื่องก่อนหน้าแบบไหน
                        </label>
                        <div className="flex gap-1.5">
                            {CAUSE_KINDS.map(k => (
                                <button
                                    key={k.value}
                                    onClick={() => setCauseKind(causeKind === k.value ? "none" : k.value)}
                                    title={k.desc}
                                    className={cn(
                                        "flex-1 h-7 chamfered-sm border text-[11px] transition-colors",
                                        causeKind === k.value ? k.cls : "border-border/60 text-muted-foreground hover:border-border"
                                    )}
                                >
                                    {k.label}
                                </button>
                            ))}
                            <button
                                onClick={() => setCauseKind("none")}
                                title={'ยังไม่ระบุ = "แล้วก็" (จุดอ่อนพล็อต)'}
                                className={cn(
                                    "flex-1 h-7 chamfered-sm border text-[11px] transition-colors",
                                    causeKind === "none"
                                        ? "text-zinc-400 border-zinc-500/50 bg-zinc-500/10"
                                        : "border-border/60 text-muted-foreground hover:border-border"
                                )}
                            >
                                แล้วก็…
                            </button>
                        </div>
                        {causeKind !== "none" && (
                            <div className="space-y-1.5 pl-1 border-l-2 border-border/40 ml-0.5">
                                <Select value={causeEventId} onValueChange={setCauseEventId}>
                                    <SelectTrigger className="h-8 text-xs chamfered-sm">
                                        <SelectValue placeholder="ฉากต้นเหตุ (ไม่บังคับ)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">— ฉากก่อนหน้า / ไม่ระบุ —</SelectItem>
                                        {events.filter(e => e.id !== event.id).map(e => (
                                            <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    value={causeNote}
                                    onChange={e => setCauseNote(e.target.value)}
                                    placeholder={causeKind === "therefore" ? "เพราะ… ดังนั้นฉากนี้จึง…" : "ทั้งที่… แต่ฉากนี้กลับ…"}
                                    className="h-8 text-xs chamfered-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="h-px bg-border/50" />

                    {/* field1 — label เปลี่ยนตามประเภทฉาก */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Target className="h-3 w-3" />{typeConfig.field1Label}
                        </label>
                        <Input
                            value={goal}
                            onChange={e => setGoal(e.target.value)}
                            placeholder={typeConfig.field1Placeholder}
                            className="h-8 text-xs chamfered-sm"
                        />
                    </div>

                    {/* field2 — label เปลี่ยนตามประเภทฉาก */}
                    <div className="space-y-1">
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Swords className="h-3 w-3" />{typeConfig.field2Label}
                        </label>
                        <Input
                            value={conflict}
                            onChange={e => setConflict(e.target.value)}
                            placeholder={typeConfig.field2Placeholder}
                            className="h-8 text-xs chamfered-sm"
                        />
                    </div>

                    {/* Outcome — ปิดสำหรับ setup, เตือนถ้ายังไม่กรอกสำหรับ climax */}
                    {typeConfig.outcomeMode !== "off" && (
                    <>
                    <div className="space-y-1.5">
                        <label className={cn(
                            "text-[11px] font-medium",
                            typeConfig.outcomeMode === "required" && outcome === "unknown"
                                ? "text-[var(--forge-amber)]"
                                : "text-muted-foreground"
                        )}>
                            ผลลัพธ์ — ฉากจบแล้วสถานการณ์
                            {typeConfig.outcomeMode === "required" && outcome === "unknown" && " (ฉากแตกหักควรมี value turn ชัดเจน)"}
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {OUTCOMES.map(o => {
                                const Icon = OUTCOME_ICONS[o.value]
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
                    </>
                    )}

                    <Button size="sm" className="w-full h-8 chamfered-sm" disabled={isPending} onClick={handleSave}>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                        บันทึกโครงฉาก
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

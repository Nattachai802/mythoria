"use client"

import type { ChapterForBoard } from "./types"
import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TimelineEvent, Chapter } from "@/db/schema"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Sprout, Repeat, Target, Plus, Trash2, AlertTriangle, Clock, Unlink, Link2, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { analyzeThread, makeEventChapterOrder } from "@/lib/plot-thread-analysis"
import { toast } from "sonner"
import {
    deleteThread, updateThread, addBeat, deleteBeat,
    type ThreadWithBeats,
} from "@/server/plot-threads"
import { pushPlotUndo, removePlotUndo } from "@/hooks/use-plot-undo-stack"
import { restorePlotUndoEntry } from "@/lib/plot-undo-restore"

const TYPES: Record<string, string> = {
    mystery: "ปริศนา",
    foreshadow: "ลางบอกเหตุ",
    chekhov: "ปืนเชคอฟ",
    character_arc: "arc ตัวละคร",
    promise: "สัญญากับผู้อ่าน",
}
const STATUS: Record<string, { label: string; cls: string }> = {
    planted: { label: "หว่านแล้ว", cls: "text-amber-500" },
    developing: { label: "กำลังสาน", cls: "text-blue-500" },
    paid: { label: "เฉลยแล้ว", cls: "text-emerald-500" },
    abandoned: { label: "ตั้งใจทิ้ง", cls: "text-muted-foreground" },
}
const ROLES: Record<string, { label: string; icon: typeof Sprout; cls: string }> = {
    seed: { label: "หว่าน", icon: Sprout, cls: "text-amber-500" },
    reinforce: { label: "ย้ำ", icon: Repeat, cls: "text-blue-500" },
    payoff: { label: "เฉลย", icon: Target, cls: "text-emerald-500" },
}


interface Props {
    novelId: string
    threads: ThreadWithBeats[]
    events: TimelineEvent[]
    chapters: ChapterForBoard[]
}

export function PlotThreadLedger({ novelId, threads, events, chapters }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)

    // คลิก beat → กระโดดไปกระดานของฉากนั้น (Go-to)
    const goto = (eventId: string) => {
        setOpen(false)
        router.push(`/dashboard/project/${novelId}/plot/${eventId}`)
    }

    // eventId → chapter order, for warnings + labels
    const chapterTitleById = useMemo(() => {
        const m = new Map<string, string>()
        chapters.forEach(c => m.set(c.id, c.title))
        return m
    }, [chapters])
    const eventById = useMemo(() => {
        const m = new Map<string, TimelineEvent>()
        events.forEach(e => m.set(e.id, e))
        return m
    }, [events])
    const maxChapterOrder = useMemo(
        () => chapters.reduce((mx, c) => Math.max(mx, c.orderIndex), 0),
        [chapters]
    )

    const eventChapterOrder = useMemo(
        () => makeEventChapterOrder(events, chapters),
        [events, chapters]
    )

    // ── L2 warnings per thread ── (ตรรกะอยู่ที่ lib/plot-thread-analysis.ts
    // เพราะรายงานรายตอนฝั่ง server ใช้ตัวเดียวกัน)
    const analyze = (t: ThreadWithBeats) => analyzeThread(t, eventChapterOrder, maxChapterOrder)

    const warnCount = threads.filter(t => {
        const a = analyze(t)
        return a.dangling || a.stale || a.orphanPayoff
    }).length

    const sceneLabel = (eventId: string) => {
        const ev = eventById.get(eventId)
        if (!ev) return "(ฉากถูกลบ)"
        const ch = ev.relatedChapterId ? chapterTitleById.get(ev.relatedChapterId) : null
        return ch ? `${ch} · ${ev.title}` : ev.title
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Link2 className="h-3.5 w-3.5" />
                    สมุดปม
                    {threads.length > 0 && (
                        <span className="tabular-nums text-muted-foreground">({threads.length})</span>
                    )}
                    {warnCount > 0 && (
                        <span className="ml-0.5 inline-flex items-center gap-0.5 text-[var(--forge-amber)]">
                            <AlertTriangle className="h-3 w-3" />{warnCount}
                        </span>
                    )}
                </Button>
            </SheetTrigger>

            <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="font-display flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-[var(--forge-gold)]" />สมุดปมเรื่อง
                    </SheetTitle>
                    <SheetDescription>
                        ติดตามปมที่หว่านไว้ — กันลืมว่าผูกอะไรไปแล้วบ้าง
                        {warnCount > 0 && <span className="text-[var(--forge-amber)] font-medium"> · {warnCount} ปมต้องดู</span>}
                    </SheetDescription>
                </SheetHeader>

                {/* List */}
                <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                        {threads.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground py-10">
                                ยังไม่มีปม — สร้างปมได้ที่การ์ดไอเดียบนกระดานพล็อต
                            </div>
                        )}
                        {threads.map(t => (
                            <ThreadRow
                                key={t.id}
                                thread={t}
                                novelId={novelId}
                                events={events}
                                analysis={analyze(t)}
                                sceneLabel={sceneLabel}
                                onGoto={goto}
                                onChanged={() => router.refresh()}
                            />
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}

function ThreadRow({
    thread, novelId, events, analysis, sceneLabel, onGoto, onChanged,
}: {
    thread: ThreadWithBeats
    novelId: string
    events: TimelineEvent[]
    analysis: { dangling: boolean; stale: boolean; orphanPayoff: boolean; gap: number | null }
    sceneLabel: (id: string) => string
    onGoto: (eventId: string) => void
    onChanged: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [adding, setAdding] = useState(false)
    const [beatEvent, setBeatEvent] = useState("")
    const [beatRole, setBeatRole] = useState("seed")

    const status = STATUS[thread.status] ?? STATUS.planted

    const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok?: string) =>
        startTransition(async () => {
            const res = await fn()
            if (res.success) { if (ok) toast.success(ok); onChanged() }
            else toast.error(res.error || "ผิดพลาด")
        })

    // ลบปม — snapshot (รวม beats ทั้งหมด) เก็บเข้าสแตกกู้คืนกลาง แทนปิด scope ไว้ใน toast เฉยๆ
    const handleDeleteThread = () => {
        const beatsSnapshot = thread.beats.map(b => ({ eventId: b.eventId, role: b.role, note: b.note }))
        startTransition(async () => {
            const res = await deleteThread(thread.id, novelId)
            if (!res.success) { toast.error(res.error || "ผิดพลาด"); return }
            onChanged()
            const entry = pushPlotUndo(novelId, {
                kind: "thread",
                label: thread.title,
                payload: {
                    title: thread.title, type: thread.type, importance: thread.importance,
                    note: thread.note, color: thread.color, beats: beatsSnapshot,
                },
            })
            toast.success(`ลบปม "${thread.title}" แล้ว`, {
                action: {
                    label: "ย้อนกลับ",
                    onClick: () => restorePlotUndoEntry(novelId, entry).then(r => {
                        if (r.success) { removePlotUndo(novelId, entry.id); onChanged() }
                    }),
                },
            })
        })
    }

    // ปลดจุดผูกปม — เก็บเข้าสแตกกู้คืนกลาง
    const handleDeleteBeat = (beat: ThreadWithBeats["beats"][number]) => {
        startTransition(async () => {
            const res = await deleteBeat(beat.id, novelId)
            if (!res.success) { toast.error(res.error || "ผิดพลาด"); return }
            onChanged()
            const entry = pushPlotUndo(novelId, {
                kind: "beat",
                label: `${thread.title} · ${sceneLabel(beat.eventId)}`,
                payload: { threadId: thread.id, eventId: beat.eventId, role: beat.role, note: beat.note },
            })
            toast.success("ปลดจุดผูกปมแล้ว", {
                action: {
                    label: "ย้อนกลับ",
                    onClick: () => restorePlotUndoEntry(novelId, entry).then(r => {
                        if (r.success) { removePlotUndo(novelId, entry.id); onChanged() }
                    }),
                },
            })
        })
    }

    return (
        <div className="chamfered-sm border border-border bg-card/50 p-3 space-y-2">
            {/* header */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: thread.color || "#f59e0b" }} />
                        <span className="font-medium text-sm truncate">{thread.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{TYPES[thread.type] ?? thread.type}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Select value={thread.status} onValueChange={(v) => run(() => updateThread(thread.id, novelId, { status: v }))}>
                        <SelectTrigger className={cn("h-7 w-[100px] text-[11px]", status.cls)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(STATUS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        disabled={isPending}
                        onClick={handleDeleteThread}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* warnings */}
            {(analysis.dangling || analysis.stale || analysis.orphanPayoff) && (
                <div className="flex flex-wrap gap-1.5">
                    {analysis.dangling && !analysis.stale && (
                        <Warn icon={Unlink} text="ยังไม่มีการเฉลย" />
                    )}
                    {analysis.stale && (
                        <Warn icon={Clock} text={`ไม่ถูกแตะ ${analysis.gap} บท`} strong />
                    )}
                    {analysis.orphanPayoff && (
                        <Warn icon={AlertTriangle} text="เฉลยลอย ไม่มีจุดหว่าน" />
                    )}
                </div>
            )}

            {/* beats */}
            <div className="space-y-1">
                {thread.beats.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">ยังไม่ได้ผูกกับฉากใด</p>
                )}
                {thread.beats.map(b => {
                    const role = ROLES[b.role] ?? ROLES.seed
                    const RoleIcon = role.icon
                    return (
                        <div key={b.id} className="flex items-center gap-2 text-xs group">
                            <RoleIcon className={cn("h-3.5 w-3.5 shrink-0", role.cls)} />
                            <span className="text-[10px] text-muted-foreground w-8 shrink-0">{role.label}</span>
                            <button
                                className="flex-1 min-w-0 truncate text-left hover:text-[var(--forge-gold)] hover:underline transition-colors"
                                onClick={() => onGoto(b.eventId)}
                                title="ไปที่ฉากนี้"
                            >
                                {sceneLabel(b.eventId)}
                            </button>
                            <button
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                onClick={() => handleDeleteBeat(b)}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* add beat */}
            {adding ? (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-border/60">
                    <Select value={beatEvent} onValueChange={setBeatEvent}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เลือกฉาก…" /></SelectTrigger>
                        <SelectContent>
                            {events.map(e => (
                                <SelectItem key={e.id} value={e.id} className="text-xs">{sceneLabel(e.id)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                        <Select value={beatRole} onValueChange={setBeatRole}>
                            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(ROLES).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" disabled={isPending || !beatEvent}
                            onClick={() => {
                                run(() => addBeat({ threadId: thread.id, eventId: beatEvent, role: beatRole, novelId }), "ผูกฉากแล้ว")
                                setBeatEvent(""); setAdding(false)
                            }}>
                            ผูก
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setAdding(false)}>
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ) : (
                <Button variant="ghost" size="sm" className="h-7 w-full text-[11px] text-muted-foreground border border-dashed border-border/60"
                    onClick={() => setAdding(true)}>
                    <Plus className="h-3 w-3 mr-1" />ผูกกับฉาก
                </Button>
            )}
        </div>
    )
}

function Warn({ icon: Icon, text, strong }: { icon: typeof Clock; text: string; strong?: boolean }) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 chamfered-sm text-[10px] border",
            strong
                ? "bg-[var(--forge-amber)]/10 text-[var(--forge-amber)] border-[var(--forge-amber)]/30"
                : "bg-muted text-muted-foreground border-border"
        )}>
            <Icon className="h-3 w-3" />{text}
        </span>
    )
}

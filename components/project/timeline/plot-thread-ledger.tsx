"use client"

import type { ChapterForBoard } from "./types"
import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import { TimelineEvent, Chapter } from "@/db/schema"
import Link from "next/link"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
    Sprout, Repeat, Target, Plus, Trash2, AlertTriangle, Clock, Unlink, Link2, X,
    ChevronRight, CheckCircle2, Circle, ListTree, TrendingDown, ArrowRight, Shuffle,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { analyzeThread, analyzeThreadNetwork, makeEventChapterOrder, type ThreadWarning } from "@/lib/plot-thread-analysis"
import { toast } from "sonner"
import {
    createThread, deleteThread, updateThread, addBeat, deleteBeat, updateBeat,
    addPoint, updatePoint, deletePoint, addLink, deleteLink,
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
const LINK_KINDS: Record<string, { label: string; icon: typeof ArrowRight }> = {
    before: { label: "ต้องเฉลยก่อน", icon: ArrowRight },
    misdirects: { label: "เป็นปมหลอกของ", icon: Shuffle },
}


interface Props {
    novelId: string
    threads: ThreadWithBeats[]
    events: TimelineEvent[]
    chapters: ChapterForBoard[]
}

/** ตรรกะร่วมของปุ่มบนกระดานกับแท็บปมเรื่อง — นับเตือนจากสูตรเดียวกัน */
function useThreadLedger({ threads, events, chapters }: Omit<Props, "novelId">) {
    const chapterTitleById = useMemo(() => new Map(chapters.map(c => [c.id, c.title])), [chapters])
    const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events])
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
    // คำเตือนเครือข่าย (ลำดับเฉลย / ปมหลอก / ประเด็นค้าง / ความตึงจืด)
    const netWarnings = useMemo(() => {
        const m = new Map<string, ThreadWarning[]>()
        analyzeThreadNetwork(threads, eventChapterOrder).forEach(w => {
            m.set(w.threadId, [...(m.get(w.threadId) ?? []), w])
        })
        return m
    }, [threads, eventChapterOrder])

    // เรียงเป็นต้นไม้: ปมแม่ตามด้วยปมลูก (เยื้องตาม depth)
    const ordered = useMemo(() => {
        const ids = new Set(threads.map(t => t.id))
        const kids = new Map<string | null, ThreadWithBeats[]>()
        threads.forEach(t => {
            const parent = t.parentThreadId && ids.has(t.parentThreadId) ? t.parentThreadId : null
            kids.set(parent, [...(kids.get(parent) ?? []), t])
        })
        const out: Array<{ thread: ThreadWithBeats; depth: number }> = []
        const seen = new Set<string>()
        const walk = (parent: string | null, depth: number) => {
            for (const t of kids.get(parent) ?? []) {
                if (seen.has(t.id)) continue
                seen.add(t.id)
                out.push({ thread: t, depth })
                walk(t.id, depth + 1)
            }
        }
        walk(null, 0)
        // กันข้อมูลวน (ไม่ควรเกิด server กันไว้แล้ว) — ที่หลุดจากต้นไม้ให้ต่อท้าย
        threads.forEach(t => { if (!seen.has(t.id)) out.push({ thread: t, depth: 0 }) })
        return out
    }, [threads])

    const warnCount = threads.filter(t => {
        const a = analyze(t)
        return a.dangling || a.stale || a.orphanPayoff || netWarnings.has(t.id)
    }).length


    const sceneLabel = (eventId: string) => {
        const ev = eventById.get(eventId)
        if (!ev) return "(ฉากถูกลบ)"
        const ch = ev.relatedChapterId ? chapterTitleById.get(ev.relatedChapterId) : null
        return ch ? `${ch} · ${ev.title}` : ev.title
    }

    return { analyze, netWarnings, ordered, warnCount, sceneLabel }
}

/** ปุ่มบนกระดาน → แท็บปมเรื่อง */
export function PlotThreadLedgerButton({ novelId, threads, events, chapters }: Props) {
    const { warnCount } = useThreadLedger({ threads, events, chapters })
    return (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Link href={`/dashboard/project/${novelId}/plot?tab=threads`}>
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
            </Link>
        </Button>
    )
}

/** แท็บ "ปมเรื่อง" ในหน้า plot */
export function PlotThreadsView({ novelId, threads, events, chapters }: Props) {
    const router = useRouter()
    const { analyze, netWarnings, ordered, warnCount, sceneLabel } = useThreadLedger({ threads, events, chapters })
    const [newTitle, setNewTitle] = useState("")
    const [isPending, startTransition] = useTransition()

    const goto = (eventId: string) => router.push(`/dashboard/project/${novelId}/plot/${eventId}`)

    const create = (e: React.FormEvent) => {
        e.preventDefault()
        const title = newTitle.trim()
        if (!title) return
        startTransition(async () => {
            const res = await createThread({ novelId, title })
            if (!res.success) { toast.error(res.error || "สร้างปมไม่สำเร็จ"); return }
            setNewTitle("")
            router.refresh()
        })
    }

    return (
        <div className="mx-auto w-full max-w-3xl space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    ปมที่หว่านไว้ทั้งเรื่อง · {threads.length} ปม
                    {warnCount > 0 && <span className="text-[var(--forge-amber)] font-medium"> · {warnCount} ปมต้องดู</span>}
                </p>
                <form onSubmit={create} className="flex gap-1.5 w-full sm:w-auto">
                    <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                        placeholder="ชื่อปมใหม่…" className="h-8 text-sm sm:w-64" aria-label="ชื่อปมใหม่" />
                    <Button type="submit" size="sm" className="h-8" disabled={isPending || !newTitle.trim()}>
                        <Plus className="h-3.5 w-3.5 mr-1" />สร้างปม
                    </Button>
                </form>
            </div>

            {threads.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-16 border border-dashed rounded-md">
                    ยังไม่มีปม — สร้างจากช่องด้านบน หรือจากเมนูการ์ดไอเดียบนกระดานพล็อต
                </div>
            )}
            <div className="space-y-3">
                {ordered.map(({ thread: t, depth }) => (
                    <ThreadRow
                        key={t.id}
                        thread={t}
                        depth={depth}
                        allThreads={threads}
                        netWarnings={netWarnings.get(t.id) ?? []}
                        novelId={novelId}
                        events={events}
                        analysis={analyze(t)}
                        sceneLabel={sceneLabel}
                        onGoto={goto}
                        onChanged={() => router.refresh()}
                    />
                ))}
            </div>
        </div>
    )
}

function ThreadRow({
    thread, depth, allThreads, netWarnings, novelId, events, analysis, sceneLabel, onGoto, onChanged,
}: {
    thread: ThreadWithBeats
    depth: number
    allThreads: ThreadWithBeats[]
    netWarnings: ThreadWarning[]
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
    const [expanded, setExpanded] = useState(false)
    const [summary, setSummary] = useState(thread.summary ?? "")
    const [newPoint, setNewPoint] = useState("")
    const [linkTo, setLinkTo] = useState("")
    const [linkKind, setLinkKind] = useState("before")

    const titleOf = (id: string) => allThreads.find(t => t.id === id)?.title ?? "(ปมถูกลบ)"
    // ปมแม่ที่เลือกได้: ไม่ใช่ตัวเองและไม่ใช่ลูกหลานตัวเอง (server กันซ้ำอีกชั้น)
    const descendants = useMemo(() => {
        const out = new Set<string>([thread.id])
        let grew = true
        while (grew) {
            grew = false
            for (const t of allThreads) {
                if (t.parentThreadId && out.has(t.parentThreadId) && !out.has(t.id)) { out.add(t.id); grew = true }
            }
        }
        return out
    }, [allThreads, thread.id])
    const openPoints = thread.points.filter(p => p.status !== "resolved").length

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
        <div className="chamfered-sm border border-border bg-card/50 p-3 space-y-2"
            style={depth ? { marginLeft: Math.min(depth, 3) * 16 } : undefined}>
            {/* header */}
            <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left flex items-start gap-1" onClick={() => setExpanded(x => !x)}
                    aria-expanded={expanded} title={expanded ? "ย่อ" : "ดูรายละเอียดปม"}>
                    <ChevronRight className={cn("h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                            {depth > 0 && <ListTree className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: thread.color || "#f59e0b" }} />
                            <span className="font-medium text-sm truncate">{thread.title}</span>
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {TYPES[thread.type] ?? thread.type}
                            {thread.points.length > 0 && ` · ประเด็น ${thread.points.length - openPoints}/${thread.points.length}`}
                        </span>
                    </span>
                </button>
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
            {(analysis.dangling || analysis.stale || analysis.orphanPayoff || netWarnings.length > 0) && (
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
                    {netWarnings.map((w, i) => (
                        <Warn key={i} strong={w.kind !== "flat_tension"} {...netWarnText(w, titleOf)} />
                    ))}
                </div>
            )}

            {!expanded && thread.summary && (
                <p className="text-[11px] text-muted-foreground line-clamp-2 whitespace-pre-line">{thread.summary}</p>
            )}
            <TensionLine thread={thread} />

            {expanded && (
                <div className="space-y-3 pt-1 border-t border-border/60">
                    {/* summary */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">ปมนี้คืออะไร</label>
                        <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3}
                            placeholder="อธิบายปม: คำถามที่ผู้อ่านจะสงสัย และความจริงเบื้องหลัง"
                            className="text-xs min-h-[60px]"
                            onBlur={() => {
                                if (summary !== (thread.summary ?? "")) run(() => updateThread(thread.id, novelId, { summary }))
                            }} />
                    </div>

                    {/* points */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">ประเด็น</label>
                        {thread.points.map(p => (
                            <div key={p.id} className="flex items-start gap-1.5 text-xs group">
                                <button className="mt-0.5 shrink-0" disabled={isPending}
                                    title={p.status === "resolved" ? "คลี่แล้ว — กดเพื่อเปิดใหม่" : "กดเมื่อคลี่ประเด็นนี้แล้ว"}
                                    onClick={() => run(() => updatePoint(p.id, novelId, { status: p.status === "resolved" ? "open" : "resolved" }))}>
                                    {p.status === "resolved"
                                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                                </button>
                                <span className={cn("flex-1 min-w-0", p.status === "resolved" && "line-through text-muted-foreground")}>{p.text}</span>
                                <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive"
                                    aria-label="ลบประเด็น"
                                    onClick={() => run(() => deletePoint(p.id, novelId))}>
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        <form className="flex gap-1.5" onSubmit={e => {
                            e.preventDefault()
                            const text = newPoint.trim()
                            if (!text) return
                            run(() => addPoint({ threadId: thread.id, novelId, text }))
                            setNewPoint("")
                        }}>
                            <Input value={newPoint} onChange={e => setNewPoint(e.target.value)} placeholder="เพิ่มประเด็น…" className="h-7 text-xs" />
                            <Button type="submit" size="sm" variant="ghost" className="h-7 px-2" disabled={isPending || !newPoint.trim()}>
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </form>
                    </div>

                    {/* parent */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">อยู่ใต้ปม</label>
                        <Select value={thread.parentThreadId ?? "none"}
                            onValueChange={v => run(() => updateThread(thread.id, novelId, { parentThreadId: v === "none" ? null : v }))}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" className="text-xs">— ปมระดับบน —</SelectItem>
                                {allThreads.filter(t => !descendants.has(t.id)).map(t => (
                                    <SelectItem key={t.id} value={t.id} className="text-xs">{t.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* links */}
                    <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">ความสัมพันธ์กับปมอื่น</label>
                        {thread.links.map(l => {
                            const k = LINK_KINDS[l.kind] ?? LINK_KINDS.before
                            const KIcon = k.icon
                            return (
                                <div key={l.id} className="flex items-center gap-1.5 text-xs group">
                                    <KIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="text-muted-foreground shrink-0">{k.label}</span>
                                    <span className="flex-1 min-w-0 truncate">{titleOf(l.toThreadId)}</span>
                                    <button className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-destructive"
                                        aria-label="ลบความสัมพันธ์"
                                        onClick={() => run(() => deleteLink(l.id, novelId))}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )
                        })}
                        {allThreads.length > 1 && (
                            <div className="flex gap-1.5">
                                <Select value={linkKind} onValueChange={setLinkKind}>
                                    <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(LINK_KINDS).map(([k, v]) => (
                                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={linkTo} onValueChange={setLinkTo}>
                                    <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue placeholder="เลือกปม…" /></SelectTrigger>
                                    <SelectContent>
                                        {allThreads.filter(t => t.id !== thread.id).map(t => (
                                            <SelectItem key={t.id} value={t.id} className="text-xs">{t.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="ghost" className="h-7 px-2" disabled={isPending || !linkTo}
                                    onClick={() => {
                                        run(() => addLink({ novelId, fromThreadId: thread.id, toThreadId: linkTo, kind: linkKind as "before" | "misdirects" }))
                                        setLinkTo("")
                                    }}>
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
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
                                {!expanded && b.pointId && (
                                    <span className="text-muted-foreground"> · {thread.points.find(p => p.id === b.pointId)?.text}</span>
                                )}
                            </button>
                            {expanded && thread.points.length > 0 && (
                                <Select value={b.pointId ?? "none"}
                                    onValueChange={v => run(() => updateBeat(b.id, novelId, { pointId: v === "none" ? null : v }))}>
                                    <SelectTrigger className="h-6 w-[90px] text-[10px] px-1.5" title="ฉากนี้ขยับประเด็นไหน"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none" className="text-xs">— ประเด็น —</SelectItem>
                                        {thread.points.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="text-xs">{p.text}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <TensionDots value={b.tension} disabled={isPending}
                                onChange={v => run(() => updateBeat(b.id, novelId, { tension: v }))} />
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

function netWarnText(w: ThreadWarning, titleOf: (id: string) => string): { icon: typeof Clock; text: string } {
    switch (w.kind) {
        case "order_violation": return { icon: ArrowRight, text: `ต้องเฉลยก่อน "${titleOf(w.otherId)}" แต่ช้ากว่า` }
        case "decoy_after_truth": return { icon: Shuffle, text: `ปมหลอกยังไม่คลี่ ทั้งที่ "${titleOf(w.otherId)}" เฉลยแล้ว` }
        case "open_points_after_payoff": return { icon: Circle, text: `เฉลยแล้ว แต่ประเด็นค้าง ${w.pointTexts.length} ข้อ` }
        case "flat_tension": return { icon: TrendingDown, text: "ความตึงไม่เพิ่มขึ้น" }
    }
}

/** ให้คะแนนความตึง 1-5 — กดจุดเดิมซ้ำเพื่อล้าง */
function TensionDots({ value, onChange, disabled }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
    return (
        <span className="flex items-center gap-0.5 shrink-0" role="group" aria-label="ความตึง">
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} disabled={disabled}
                    aria-label={`ความตึง ${n}`} aria-pressed={value === n}
                    title={value === n ? "กดอีกครั้งเพื่อล้าง" : `ความตึง ${n}/5`}
                    onClick={() => onChange(value === n ? null : n)}
                    className={cn("h-1.5 w-1.5 rounded-full transition-colors",
                        value != null && n <= value ? "bg-[var(--forge-amber)]" : "bg-muted-foreground/25 hover:bg-muted-foreground/50")} />
            ))}
        </span>
    )
}

/**
 * เส้นความตึงของปม ตามลำดับ beat ที่แสดง (beat ไม่มีคะแนนข้าม)
 * ponytail: ใช้ลำดับ beat ในลิสต์ ไม่ใช่ลำดับบท — ตัวเตือน "จืด" ใน lib เรียงตามบทอยู่แล้ว
 */
function TensionLine({ thread }: { thread: ThreadWithBeats }) {
    const pts = thread.beats.map(b => b.tension).filter((t): t is number => t != null)
    if (pts.length < 2) return null
    const w = 120, h = 20
    const d = pts.map((t, i) => `${(i / (pts.length - 1)) * w},${h - ((t - 1) / 4) * (h - 4) - 2}`).join(" ")
    return (
        <svg width={w} height={h} className="text-[var(--forge-amber)]" aria-label={`ความตึง: ${pts.join(" → ")}`}>
            <polyline points={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
        </svg>
    )
}

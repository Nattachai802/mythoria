"use client"

import type { ChapterForBoard } from "./types"
import { useState, useMemo, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { TimelineEvent } from "@/db/schema"
import Link from "next/link"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
    Sprout, Repeat, Target, Plus, Trash2, AlertTriangle, Clock, Unlink, Link2, X,
    CheckCircle2, Circle, ListTree, TrendingDown, ArrowRight, Shuffle, ArrowLeft, CalendarClock,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
    analyzeThread, analyzeThreadNetwork, makeEventChapterOrder, threadIntent,
    type ThreadWarning, type ThreadAnalysis, type ThreadProgress,
} from "@/lib/plot-thread-analysis"
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
/** เจตนาของผู้เขียน — ตัวควบคุมว่าระบบเตือนอะไร */
const INTENTS: Record<string, { label: string; hint: string; cls: string }> = {
    active: { label: "ดำเนินอยู่", hint: "เตือนตามปกติ", cls: "text-foreground" },
    on_hold: { label: "พักไว้", hint: "ยังไม่ตัดสินใจ — ไม่เตือนว่าถูกลืมหรือเลยบทเป้า", cls: "text-blue-500" },
    open_ended: { label: "ตั้งใจค้าง/ปลายเปิด", hint: "ไม่เตือนว่ายังไม่เฉลย", cls: "text-violet-500" },
    abandoned: { label: "ทิ้งแล้ว", hint: "ไม่เตือนอะไร", cls: "text-muted-foreground" },
}
/** ความคืบหน้า — คำนวณจากฉาก ผู้ใช้ไม่ต้องกด */
const PROGRESS: Record<ThreadProgress, { label: string; step: number; cls: string }> = {
    unseeded: { label: "ยังไม่หว่าน", step: 0, cls: "text-muted-foreground" },
    seeded: { label: "หว่านแล้ว", step: 1, cls: "text-amber-500" },
    developing: { label: "กำลังสาน", step: 2, cls: "text-blue-500" },
    partial: { label: "เฉลยบางส่วน", step: 3, cls: "text-teal-500" },
    paid: { label: "เฉลยครบ", step: 4, cls: "text-emerald-500" },
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
    const chapterById = useMemo(() => new Map(chapters.map(c => [c.id, c])), [chapters])
    const eventById = useMemo(() => new Map(events.map(e => [e.id, e])), [events])
    const maxChapterOrder = useMemo(
        () => chapters.reduce((mx, c) => Math.max(mx, c.orderIndex), 0),
        [chapters]
    )
    const eventChapterOrder = useMemo(
        () => makeEventChapterOrder(events, chapters),
        [events, chapters]
    )

    // ตรรกะอยู่ที่ lib/plot-thread-analysis.ts เพราะรายงานรายตอนฝั่ง server ใช้ตัวเดียวกัน
    const analyses = useMemo(() => new Map(threads.map(t => [
        t.id,
        analyzeThread(
            t, eventChapterOrder, maxChapterOrder,
            t.targetChapterId ? chapterById.get(t.targetChapterId)?.orderIndex ?? null : null,
        ),
    ])), [threads, eventChapterOrder, maxChapterOrder, chapterById])

    // คำเตือนเครือข่าย (ลำดับเฉลย / ปมหลอก / ประเด็นค้าง / ความตึงจืด)
    const netWarnings = useMemo(() => {
        const m = new Map<string, ThreadWarning[]>()
        analyzeThreadNetwork(threads, eventChapterOrder).forEach(w => {
            m.set(w.threadId, [...(m.get(w.threadId) ?? []), w])
        })
        return m
    }, [threads, eventChapterOrder])

    const warnCountOf = (t: ThreadWithBeats) => {
        const a = analyses.get(t.id)!
        const intent = threadIntent(t.status)
        // ปมที่ทิ้งแล้วไม่นับเตือนเลย
        if (intent === "abandoned") return 0
        // stale/overdue เป็นส่วนหนึ่งของ "ค้าง" อยู่แล้ว · ปมที่พักไว้ไม่นับว่าค้าง
        return [a.dangling && intent === "active", a.orphanPayoff].filter(Boolean).length
            + (netWarnings.get(t.id)?.length ?? 0)
    }

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

    const warnCount = threads.filter(t => warnCountOf(t) > 0).length

    const sceneLabel = (eventId: string) => {
        const ev = eventById.get(eventId)
        if (!ev) return "(ฉากถูกลบ)"
        const ch = ev.relatedChapterId ? chapterById.get(ev.relatedChapterId)?.title : null
        return ch ? `${ch} · ${ev.title}` : ev.title
    }

    return { analyses, netWarnings, ordered, warnCount, warnCountOf, sceneLabel, eventChapterOrder }
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

/** แท็บ "ปมเรื่อง": ลิสต์ซ้าย รายละเอียดขวา · ปมที่เลือกอยู่ใน URL (?thread=) */
export function PlotThreadsView({ novelId, threads, events, chapters }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const ledger = useThreadLedger({ threads, events, chapters })
    const { ordered, warnCount, warnCountOf } = ledger
    const [newTitle, setNewTitle] = useState("")
    const [isPending, startTransition] = useTransition()

    const base = `/dashboard/project/${novelId}/plot?tab=threads`
    const urlId = searchParams.get("thread")
    const explicit = urlId && threads.some(t => t.id === urlId) ? urlId : null
    // ไม่ได้เลือก: จอกว้างเปิดปมแรกที่มีเตือน (ไม่มีก็ปมแรก) · จอแคบโชว์ลิสต์ (ซ่อนด้วย CSS)
    const fallback = ordered.find(o => warnCountOf(o.thread) > 0)?.thread.id ?? ordered[0]?.thread.id ?? null
    const selectedId = explicit ?? fallback
    const selected = threads.find(t => t.id === selectedId) ?? null

    const select = (id: string | null) => router.replace(id ? `${base}&thread=${id}` : base, { scroll: false })

    const create = (e: React.FormEvent) => {
        e.preventDefault()
        const title = newTitle.trim()
        if (!title) return
        startTransition(async () => {
            const res = await createThread({ novelId, title })
            if (!res.success || !res.data) { toast.error(res.error || "สร้างปมไม่สำเร็จ"); return }
            setNewTitle("")
            select(res.data.id)
            router.refresh()
        })
    }

    return (
        <div className="grid h-full min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* ── ซ้าย: ลิสต์ ── (จอแคบซ่อนเมื่อเลือกปมแล้ว) */}
            <aside className={cn(
                "min-h-0 flex-col border-r border-border lg:flex",
                explicit ? "hidden" : "flex",
            )}>
                <div className="space-y-2 border-b border-border p-3">
                    <p className="text-xs text-muted-foreground">
                        {threads.length} ปม
                        {warnCount > 0 && <span className="text-[var(--forge-amber)] font-medium"> · {warnCount} ปมต้องดู</span>}
                    </p>
                    <form onSubmit={create} className="flex gap-1.5">
                        <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                            placeholder="ชื่อปมใหม่…" className="h-8 text-sm" aria-label="ชื่อปมใหม่" />
                        <Button type="submit" size="sm" className="h-8 shrink-0" disabled={isPending || !newTitle.trim()}>
                            <Plus className="h-3.5 w-3.5 mr-1" />สร้าง
                        </Button>
                    </form>
                </div>
                <nav aria-label="รายการปม" className="flex-1 overflow-y-auto p-2">
                    {threads.length === 0 && (
                        <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                            ยังไม่มีปม — ตั้งชื่อปมแรกด้านบน หรือสร้างจากเมนูการ์ดไอเดียบนกระดานพล็อต
                        </p>
                    )}
                    {ordered.map(({ thread: t, depth }) => (
                        <ThreadListItem
                            key={t.id}
                            thread={t}
                            depth={depth}
                            analysis={ledger.analyses.get(t.id)!}
                            warnings={warnCountOf(t)}
                            active={t.id === selectedId}
                            onSelect={() => select(t.id)}
                        />
                    ))}
                </nav>
            </aside>

            {/* ── ขวา: รายละเอียด ── */}
            <section className={cn("min-h-0 overflow-y-auto", explicit ? "block" : "hidden lg:block")}>
                {selected ? (
                    <ThreadDetail
                        key={selected.id}
                        thread={selected}
                        novelId={novelId}
                        allThreads={threads}
                        events={events}
                        chapters={chapters}
                        analysis={ledger.analyses.get(selected.id)!}
                        netWarnings={ledger.netWarnings.get(selected.id) ?? []}
                        sceneLabel={ledger.sceneLabel}
                        eventChapterOrder={ledger.eventChapterOrder}
                        onBack={() => select(null)}
                        onDeleted={() => select(null)}
                        onSelectThread={select}
                        onChanged={() => router.refresh()}
                    />
                ) : (
                    <p className="p-10 text-center text-sm text-muted-foreground">เลือกปมจากรายการด้านซ้าย</p>
                )}
            </section>
        </div>
    )
}

function ThreadListItem({ thread, depth, analysis, warnings, active, onSelect }: {
    thread: ThreadWithBeats
    depth: number
    analysis: ThreadAnalysis
    warnings: number
    active: boolean
    onSelect: () => void
}) {
    const intent = threadIntent(thread.status)
    const progress = PROGRESS[analysis.progress]
    const open = thread.points.filter(p => p.status !== "resolved").length
    return (
        <button
            onClick={onSelect}
            aria-current={active ? "true" : undefined}
            className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                active ? "bg-[var(--forge-gold)]/10 ring-1 ring-[var(--forge-gold)]/40" : "hover:bg-muted/60",
                intent === "abandoned" && "opacity-60",
            )}
            style={depth ? { paddingLeft: 8 + Math.min(depth, 3) * 14 } : undefined}
        >
            {depth > 0
                ? <ListTree className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
                : <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: thread.color || "#f59e0b" }} />}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{thread.title}</span>
                <span className="block text-[10px] text-muted-foreground">
                    <span className={progress.cls}>{progress.label}</span>
                    {intent !== "active" && <span className={INTENTS[intent].cls}> · {INTENTS[intent].label}</span>}
                    {thread.points.length > 0 && ` · ${thread.points.length - open}/${thread.points.length}`}
                </span>
            </span>
            {warnings > 0 && (
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-[10px] text-[var(--forge-amber)]">
                    <AlertTriangle className="h-3 w-3" />{warnings}
                </span>
            )}
        </button>
    )
}

function ThreadDetail({
    thread, novelId, allThreads, events, chapters, analysis, netWarnings, sceneLabel, eventChapterOrder,
    onBack, onDeleted, onSelectThread, onChanged,
}: {
    thread: ThreadWithBeats
    novelId: string
    allThreads: ThreadWithBeats[]
    events: TimelineEvent[]
    chapters: ChapterForBoard[]
    analysis: ThreadAnalysis
    netWarnings: ThreadWarning[]
    sceneLabel: (id: string) => string
    eventChapterOrder: (eventId: string) => number | null
    onBack: () => void
    onDeleted: () => void
    onSelectThread: (id: string) => void
    onChanged: () => void
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [adding, setAdding] = useState(false)
    const [beatEvent, setBeatEvent] = useState("")
    const [beatRole, setBeatRole] = useState("seed")
    const [summary, setSummary] = useState(thread.summary ?? "")
    const [newPoint, setNewPoint] = useState("")
    const [linkTo, setLinkTo] = useState("")
    const [linkKind, setLinkKind] = useState("before")

    const intent = threadIntent(thread.status)
    const progress = PROGRESS[analysis.progress]
    const titleOf = (id: string) => allThreads.find(t => t.id === id)?.title ?? "(ปมถูกลบ)"
    const sortedChapters = useMemo(() => [...chapters].sort((a, b) => a.orderIndex - b.orderIndex), [chapters])

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
    const children = allThreads.filter(t => t.parentThreadId === thread.id)

    // ฉากเรียงตามบท — ฉากที่หาบทไม่เจอไปท้าย
    const beats = useMemo(() => thread.beats
        .map((b, i) => ({ b, o: eventChapterOrder(b.eventId), i }))
        .sort((x, y) => (x.o ?? Infinity) - (y.o ?? Infinity) || x.i - y.i)
        .map(x => x.b), [thread.beats, eventChapterOrder])

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
            onDeleted()
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

    const showWarnings = intent !== "abandoned" &&
        (analysis.stale || analysis.orphanPayoff || analysis.overdue || (analysis.dangling && intent === "active") || netWarnings.length > 0)

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
            <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground lg:hidden">
                <ArrowLeft className="h-3.5 w-3.5" />ปมทั้งหมด
            </button>

            {/* หัว */}
            <header className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="flex items-center gap-2 text-lg font-display font-semibold">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: thread.color || "#f59e0b" }} />
                            <span className="truncate">{thread.title}</span>
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            {TYPES[thread.type] ?? thread.type}
                            {thread.parentThreadId && <> · ใต้ปม <button className="hover:underline" onClick={() => onSelectThread(thread.parentThreadId!)}>{titleOf(thread.parentThreadId)}</button></>}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label="ลบปม" disabled={isPending} onClick={handleDeleteThread}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* ความคืบหน้า (คำนวณ) */}
                <div className="space-y-1">
                    <div className="flex gap-1" aria-hidden>
                        {[1, 2, 3, 4].map(n => (
                            <span key={n} className={cn("h-1 flex-1 rounded-full",
                                n <= progress.step ? "bg-[var(--forge-gold)]" : "bg-muted")} />
                        ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        ความคืบหน้า: <span className={cn("font-medium", progress.cls)}>{progress.label}</span>
                        <span className="opacity-70"> — คำนวณจากฉากที่ผูกและประเด็นที่คลี่</span>
                    </p>
                </div>

                {/* เจตนา + บทเป้า (ผู้เขียนตั้ง) */}
                <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="เจตนาของผู้เขียน" hint={INTENTS[intent].hint}>
                        <Select value={intent} onValueChange={v => run(() => updateThread(thread.id, novelId, { status: v }))}>
                            <SelectTrigger className={cn("h-8 text-xs", INTENTS[intent].cls)}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(INTENTS).map(([k, v]) => (
                                    <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field label="ตั้งใจเฉลยภายในบท" hint="เลยบทนี้แล้วยังไม่มีฉากเฉลย = เตือน">
                        <Select value={thread.targetChapterId ?? "none"}
                            onValueChange={v => run(() => updateThread(thread.id, novelId, { targetChapterId: v === "none" ? null : v }))}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none" className="text-xs">— ไม่กำหนด —</SelectItem>
                                {sortedChapters.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                </div>

                {showWarnings && (
                    <div className="flex flex-wrap gap-1.5">
                        {analysis.dangling && intent === "active" && !analysis.stale && !analysis.overdue && (
                            <Warn icon={Unlink} text="ยังไม่มีการเฉลย" />
                        )}
                        {analysis.stale && <Warn icon={Clock} text={`ไม่ถูกแตะ ${analysis.gap} บท`} strong />}
                        {analysis.overdue && <Warn icon={CalendarClock} text="เลยบทที่ตั้งใจเฉลยแล้ว" strong />}
                        {analysis.orphanPayoff && <Warn icon={AlertTriangle} text="เฉลยลอย ไม่มีจุดหว่าน" />}
                        {netWarnings.map((w, i) => (
                            <Warn key={i} strong={w.kind !== "flat_tension"} {...netWarnText(w, titleOf)} />
                        ))}
                    </div>
                )}
            </header>

            {/* คำอธิบาย */}
            <Field label="ปมนี้คืออะไร">
                <Textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4}
                    placeholder="อธิบายปม: คำถามที่ผู้อ่านจะสงสัย และความจริงเบื้องหลัง"
                    className="text-sm"
                    onBlur={() => {
                        if (summary !== (thread.summary ?? "")) run(() => updateThread(thread.id, novelId, { summary }))
                    }} />
            </Field>

            {/* ประเด็น */}
            <Field label={`ประเด็น${thread.points.length ? ` (${thread.points.filter(p => p.status === "resolved").length}/${thread.points.length} คลี่แล้ว)` : ""}`}>
                <div className="space-y-1">
                    {thread.points.map(p => (
                        <div key={p.id} className="group flex items-start gap-2 text-sm">
                            <button className="mt-0.5 shrink-0" disabled={isPending}
                                aria-label={p.status === "resolved" ? "เปิดประเด็นใหม่" : "ติ๊กว่าคลี่แล้ว"}
                                onClick={() => run(() => updatePoint(p.id, novelId, { status: p.status === "resolved" ? "open" : "resolved" }))}>
                                {p.status === "resolved"
                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    : <Circle className="h-4 w-4 text-muted-foreground" />}
                            </button>
                            <span className={cn("min-w-0 flex-1", p.status === "resolved" && "text-muted-foreground line-through")}>{p.text}</span>
                            <button className="text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                                aria-label="ลบประเด็น" onClick={() => run(() => deletePoint(p.id, novelId))}>
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
                    <form className="flex gap-1.5 pt-1" onSubmit={e => {
                        e.preventDefault()
                        const text = newPoint.trim()
                        if (!text) return
                        run(() => addPoint({ threadId: thread.id, novelId, text }))
                        setNewPoint("")
                    }}>
                        <Input value={newPoint} onChange={e => setNewPoint(e.target.value)} placeholder="เพิ่มประเด็น…" className="h-8 text-sm" />
                        <Button type="submit" size="sm" variant="outline" className="h-8" disabled={isPending || !newPoint.trim()}>
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </form>
                </div>
            </Field>

            {/* ฉากที่ผูก */}
            <Field label={`ฉากที่ผูก (${thread.beats.length})`}>
                <TensionLine beats={beats} />
                <div className="space-y-1.5">
                    {beats.length === 0 && <p className="text-xs italic text-muted-foreground">ยังไม่ได้ผูกกับฉากใด</p>}
                    {beats.map(b => {
                        const role = ROLES[b.role] ?? ROLES.seed
                        const RoleIcon = role.icon
                        return (
                            <div key={b.id} className="group flex flex-wrap items-center gap-2 text-sm">
                                <RoleIcon className={cn("h-4 w-4 shrink-0", role.cls)} />
                                <span className="w-8 shrink-0 text-[11px] text-muted-foreground">{role.label}</span>
                                <button className="min-w-0 flex-1 truncate text-left transition-colors hover:text-[var(--forge-gold)] hover:underline"
                                    title="ไปที่ฉากนี้" onClick={() => router.push(`/dashboard/project/${novelId}/plot/${b.eventId}`)}>
                                    {sceneLabel(b.eventId)}
                                </button>
                                {thread.points.length > 0 && (
                                    <Select value={b.pointId ?? "none"}
                                        onValueChange={v => run(() => updateBeat(b.id, novelId, { pointId: v === "none" ? null : v }))}>
                                        <SelectTrigger className="h-7 w-[140px] px-2 text-[11px]" title="ฉากนี้ขยับประเด็นไหน"><SelectValue /></SelectTrigger>
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
                                <button className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                                    aria-label="ปลดฉากนี้" onClick={() => handleDeleteBeat(b)}>
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )
                    })}
                </div>
                {adding ? (
                    <div className="flex flex-col gap-1.5 pt-2 sm:flex-row">
                        <Select value={beatEvent} onValueChange={setBeatEvent}>
                            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="เลือกฉาก…" /></SelectTrigger>
                            <SelectContent>
                                {events.map(e => (
                                    <SelectItem key={e.id} value={e.id} className="text-xs">{sceneLabel(e.id)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex gap-1.5">
                            <Select value={beatRole} onValueChange={setBeatRole}>
                                <SelectTrigger className="h-8 w-[90px] text-xs"><SelectValue /></SelectTrigger>
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
                            <Button size="sm" variant="ghost" className="h-8 px-2" aria-label="ยกเลิก" onClick={() => setAdding(false)}>
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button variant="ghost" size="sm" className="mt-2 h-8 w-full border border-dashed border-border/60 text-xs text-muted-foreground"
                        onClick={() => setAdding(true)}>
                        <Plus className="mr-1 h-3.5 w-3.5" />ผูกกับฉาก
                    </Button>
                )}
            </Field>

            {/* โครงสร้าง: ปมแม่ / ปมลูก / ความสัมพันธ์ */}
            <div className="grid gap-6 sm:grid-cols-2">
                <Field label="อยู่ใต้ปม">
                    <Select value={thread.parentThreadId ?? "none"}
                        onValueChange={v => run(() => updateThread(thread.id, novelId, { parentThreadId: v === "none" ? null : v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none" className="text-xs">— ปมระดับบน —</SelectItem>
                            {allThreads.filter(t => !descendants.has(t.id)).map(t => (
                                <SelectItem key={t.id} value={t.id} className="text-xs">{t.title}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {children.length > 0 && (
                        <p className="pt-1 text-[11px] text-muted-foreground">
                            ปมย่อย: {children.map((c, i) => (
                                <span key={c.id}>{i > 0 && ", "}<button className="hover:underline" onClick={() => onSelectThread(c.id)}>{c.title}</button></span>
                            ))}
                        </p>
                    )}
                </Field>

                <Field label="ความสัมพันธ์กับปมอื่น">
                    <div className="space-y-1">
                        {thread.links.map(l => {
                            const k = LINK_KINDS[l.kind] ?? LINK_KINDS.before
                            const KIcon = k.icon
                            return (
                                <div key={l.id} className="group flex items-center gap-1.5 text-xs">
                                    <KIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                    <span className="shrink-0 text-muted-foreground">{k.label}</span>
                                    <button className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => onSelectThread(l.toThreadId)}>
                                        {titleOf(l.toThreadId)}
                                    </button>
                                    <button className="text-muted-foreground opacity-0 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                                        aria-label="ลบความสัมพันธ์" onClick={() => run(() => deleteLink(l.id, novelId))}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )
                        })}
                        {allThreads.length > 1 && (
                            <div className="flex gap-1.5">
                                <Select value={linkKind} onValueChange={setLinkKind}>
                                    <SelectTrigger className="h-8 w-[118px] text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(LINK_KINDS).map(([k, v]) => (
                                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={linkTo} onValueChange={setLinkTo}>
                                    <SelectTrigger className="h-8 min-w-0 flex-1 text-xs"><SelectValue placeholder="เลือกปม…" /></SelectTrigger>
                                    <SelectContent>
                                        {allThreads.filter(t => t.id !== thread.id).map(t => (
                                            <SelectItem key={t.id} value={t.id} className="text-xs">{t.title}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" variant="outline" className="h-8 px-2" aria-label="เพิ่มความสัมพันธ์" disabled={isPending || !linkTo}
                                    onClick={() => {
                                        run(() => addLink({ novelId, fromThreadId: thread.id, toThreadId: linkTo, kind: linkKind as "before" | "misdirects" }))
                                        setLinkTo("")
                                    }}>
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                </Field>
            </div>
        </div>
    )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
            {children}
            {hint && <p className="text-[10px] text-muted-foreground/80">{hint}</p>}
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
        <span className="flex shrink-0 items-center gap-0.5" role="group" aria-label="ความตึง">
            {[1, 2, 3, 4, 5].map(n => (
                <button key={n} disabled={disabled}
                    aria-label={`ความตึง ${n}`} aria-pressed={value === n}
                    title={value === n ? "กดอีกครั้งเพื่อล้าง" : `ความตึง ${n}/5`}
                    onClick={() => onChange(value === n ? null : n)}
                    className="grid h-5 w-3 place-items-center">
                    <span className={cn("h-2 w-2 rounded-full transition-colors",
                        value != null && n <= value ? "bg-[var(--forge-amber)]" : "bg-muted-foreground/25 hover:bg-muted-foreground/50")} />
                </button>
            ))}
        </span>
    )
}

/** เส้นความตึงตามลำดับบท (beats ส่งมาเรียงแล้ว · beat ไม่มีคะแนนข้าม) */
function TensionLine({ beats }: { beats: ThreadWithBeats["beats"] }) {
    const pts = beats.map(b => b.tension).filter((t): t is number => t != null)
    if (pts.length < 2) return null
    const w = 320, h = 56, pad = 6
    const xy = pts.map((t, i) => [pad + (i / (pts.length - 1)) * (w - pad * 2), h - pad - ((t - 1) / 4) * (h - pad * 2)])
    return (
        <svg viewBox={`0 0 ${w} ${h}`} className="mb-2 h-14 w-full max-w-sm text-[var(--forge-amber)]"
            role="img" aria-label={`ความตึงตามลำดับฉาก: ${pts.join(" → ")}`}>
            <polyline points={xy.map(p => p.join(",")).join(" ")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
            {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="currentColor" />)}
        </svg>
    )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { GanttChart, Lightbulb, Route, Star, Target, Users, X } from "lucide-react"
import type { TimelineEvent } from "@/db/schema"
import type { ThreadWithBeats } from "@/server/plot-threads"
import { updateTimelineEvent } from "@/server/timeline"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const OUTCOME_LABEL: Record<string, string> = { success: "สำเร็จ", failure: "ไม่สำเร็จ", ongoing: "ยังไม่จบ", unknown: "ยังไม่รู้" }
const ROLE_LABEL: Record<string, string> = { seed: "หว่าน", reinforce: "ย้ำ", payoff: "เฉลย" }
const PEOPLE_MAX = 8
const IDEAS_MAX = 6

interface Props {
    event: TimelineEvent
    chapterTitle: string | null
    sceneIndex: number
    threads: ThreadWithBeats[]
    onClose: () => void
    onPatched: (id: string, patch: Partial<TimelineEvent>) => void
}

/**
 * แผงข้างของฉากบนกระดาน — ดูภาพรวมฉากได้โดยไม่ต้องเปลี่ยนหน้า (task.md 20B)
 * แก้ได้แค่สรุป + สถานะพล็อตตรงนี้ · โครงดราม่า/ไอเดียแก้ในหน้าฉากเหมือนเดิม
 */
export function SceneSidePanel({ event, chapterTitle, sceneIndex, threads, onClose, onPatched }: Props) {
    const [summary, setSummary] = useState(event.description ?? "")
    const [allPeople, setAllPeople] = useState(false)
    const [allIdeas, setAllIdeas] = useState(false)
    useEffect(() => { setSummary(event.description ?? "") }, [event.id, event.description])
    useEffect(() => { setAllPeople(false); setAllIdeas(false) }, [event.id])

    const items = ((event.canvasData as any[]) || []).filter((i: any) => i?.type === "idea")
    const people = new Map<string, string>()
    for (const it of items) for (const c of it.children ?? []) {
        if (!["character", "dummy_character", "faction", "dummy_faction"].includes(c.type)) continue
        const key = c.referenceId || c.title
        if (key && !people.has(key)) people.set(key, c.title)
    }
    const peopleList = [...people.values()]
    const touched = threads
        .map(t => ({ t, roles: [...new Set(t.beats.filter(b => b.eventId === event.id).map(b => b.role))] }))
        .filter(x => x.roles.length > 0)

    const saveSummary = () => {
        const next = summary.trim()
        if (next === (event.description ?? "")) return
        onPatched(event.id, { description: next || null })
        updateTimelineEvent(event.id, { description: next || null }).then(res => {
            if (!res.success) {
                toast.error("บันทึกสรุปไม่สำเร็จ")
                onPatched(event.id, { description: event.description })
            }
        })
    }

    // ร่าง (null) / แน่นอนแล้ว — optimistic แล้วคืนค่าถ้าบันทึกพลาด เหมือนช่องสรุป
    const setPlotStatus = (v: "confirmed" | null) => {
        const prev = event.plotStatus ?? null
        if (v === prev) return
        onPatched(event.id, { plotStatus: v })
        updateTimelineEvent(event.id, { plotStatus: v }).then(res => {
            if (!res.success) {
                toast.error("บันทึกสถานะไม่สำเร็จ")
                onPatched(event.id, { plotStatus: prev })
            }
        })
    }

    const drama: [string, string | null][] = [
        ["เป้าหมาย", event.sceneGoal],
        ["อุปสรรค", event.sceneConflict],
        ["ผล", event.sceneOutcome ? OUTCOME_LABEL[event.sceneOutcome] ?? event.sceneOutcome : null],
    ]
    const hasDrama = drama.some(([, v]) => v)

    return (
        <aside
            className="flex w-[320px] shrink-0 flex-col border-l bg-background animate-in fade-in slide-in-from-right-3 duration-200 ease-out motion-reduce:animate-none"
            aria-label={`รายละเอียดฉาก ${event.title}`}
        >
            <header className="space-y-3 border-b px-4 pb-3 pt-3.5">
                <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] tabular-nums text-muted-foreground">{chapterTitle ?? "ยังไม่จัดบท"} · ฉาก {sceneIndex + 1}</p>
                        <h2 className="mt-0.5 font-display text-lg font-semibold leading-snug [text-wrap:balance]">{event.title}</h2>
                    </div>
                    <button onClick={onClose} className="-mr-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95" aria-label="ปิดแผง">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="relative grid grid-cols-2 rounded-md bg-muted p-0.5 text-xs" role="radiogroup" aria-label="สถานะพล็อตของฉาก">
                    {/* ตัวเลื่อนพื้นหลัง — ขยับด้วย transform เท่านั้น */}
                    <span
                        aria-hidden="true"
                        className={cn(
                            "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[5px] bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none",
                            event.plotStatus === "confirmed" && "translate-x-full",
                        )}
                    />
                    {([[null, "ร่าง"], ["confirmed", "แน่นอนแล้ว"]] as const).map(([v, text]) => {
                        const on = (event.plotStatus ?? null) === v
                        return (
                            <button key={text} type="button" role="radio" aria-checked={on} onClick={() => setPlotStatus(v)}
                                className={cn("relative h-7 transition-colors", on ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                                {v === "confirmed" && <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle transition-colors", on ? "bg-emerald-500" : "bg-muted-foreground/40")} />}
                                {text}
                            </button>
                        )
                    })}
                </div>
            </header>

            <div className="flex-1 divide-y overflow-y-auto text-sm">
                <section className="px-4 py-3">
                    <Textarea
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        onBlur={saveSummary}
                        placeholder="เกิดอะไรขึ้นในฉากนี้ — หนึ่งสองประโยค"
                        className="min-h-[72px] resize-none border-transparent bg-muted/50 text-sm shadow-none transition-colors focus-visible:border-input focus-visible:bg-background"
                        aria-label="สรุปฉาก"
                    />
                </section>

                <Section icon={Target} title="โครงดราม่า">
                    {hasDrama ? (
                        <ol className="relative space-y-2 border-l border-border pl-3">
                            {drama.map(([k, v]) => (
                                <li key={k} className="relative">
                                    <span className={cn("absolute -left-[16.5px] top-1.5 h-2 w-2 rounded-full border-2 border-background", v ? "bg-[var(--forge-amber)]" : "bg-muted-foreground/30")} />
                                    <p className="text-[11px] text-muted-foreground">{k}</p>
                                    <p className={cn("text-[13px] leading-snug", !v && "text-muted-foreground")}>{v || "—"}</p>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้ง · ตั้งได้ในหน้าฉาก</p>
                    )}
                </Section>

                <Section icon={Users} title="คนในฉาก" count={people.size}>
                    {people.size > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {(allPeople ? peopleList : peopleList.slice(0, PEOPLE_MAX)).map(n => (
                                <span key={n} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs animate-in fade-in duration-150">
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--steel-800)] text-[10px] font-medium text-[var(--forge-gold)]">{n.trim().replace(/^[เแโใไ]/, "").charAt(0)}</span>
                                    <span className="truncate">{n}</span>
                                </span>
                            ))}
                            {people.size > PEOPLE_MAX && (
                                <button type="button" onClick={() => setAllPeople(v => !v)} className="rounded-full px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                    {allPeople ? "ย่อ" : `+${people.size - PEOPLE_MAX}`}
                                </button>
                            )}
                        </div>
                    ) : <p className="text-xs text-muted-foreground">ยังไม่มี</p>}
                </Section>

                {touched.length > 0 && (
                    <Section icon={Route} title="ปมที่แตะ" count={touched.length}>
                        <ul className="space-y-1">
                            {touched.map(({ t, roles }) => (
                                <li key={t.id} className="flex items-center gap-2 text-xs">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color ?? "var(--forge-amber)" }} />
                                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">{roles.map(r => ROLE_LABEL[r] ?? r).join(" · ")}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>
                )}

                <Section icon={Lightbulb} title="ไอเดียในฉาก" count={items.length}>
                    {items.length > 0 ? (
                        <ol className="space-y-0.5 text-xs">
                            {(allIdeas ? items : items.slice(0, IDEAS_MAX)).map((it: any, i: number) => (
                                <li key={it.id} className="flex items-center gap-2 rounded px-1 py-0.5">
                                    <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
                                    <span className="min-w-0 flex-1 truncate">{it.title || "ไม่มีชื่อ"}</span>
                                    {it.keyMomentLabel && <Star className="h-3 w-3 shrink-0 fill-[var(--forge-amber)] text-[var(--forge-amber)]" aria-label="เหตุการณ์สำคัญ" />}
                                </li>
                            ))}
                            {items.length > IDEAS_MAX && (
                                <li>
                                    <button type="button" onClick={() => setAllIdeas(v => !v)} className="mt-1 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                                        {allIdeas ? "ย่อ" : `ดูอีก ${items.length - IDEAS_MAX} ไอเดีย`}
                                    </button>
                                </li>
                            )}
                        </ol>
                    ) : <p className="text-xs text-muted-foreground">ยังว่าง</p>}
                </Section>
            </div>

            <footer className="flex gap-2 border-t px-4 py-3">
                <Button asChild size="sm" className="flex-1">
                    <Link href={`/dashboard/project/${event.novelId}/plot/${event.id}`}>เปิดหน้าฉาก</Link>
                </Button>
                <Button asChild size="sm" variant="outline" title="ดูฉากนี้บนเส้นเวลา" aria-label="ดูฉากนี้บนเส้นเวลา">
                    <Link href={`/dashboard/project/${event.novelId}/timeline?focus=${encodeURIComponent(`scene:${event.id}`)}`}>
                        <GanttChart className="h-4 w-4" />
                    </Link>
                </Button>
            </footer>
        </aside>
    )
}

function Section({ icon: Icon, title, count, children }: { icon: React.ElementType; title: string; count?: number; children: React.ReactNode }) {
    return (
        <section className="space-y-2 px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {title}
                {count !== undefined && count > 0 && <span className="tabular-nums text-muted-foreground/70">{count}</span>}
            </h3>
            {children}
        </section>
    )
}

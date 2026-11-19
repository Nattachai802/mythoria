"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowRight, GanttChart, Star, Users, X } from "lucide-react"
import type { TimelineEvent } from "@/db/schema"
import type { ThreadWithBeats } from "@/server/plot-threads"
import { updateTimelineEvent } from "@/server/timeline"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

const OUTCOME_LABEL: Record<string, string> = { success: "สำเร็จ", failure: "ไม่สำเร็จ", ongoing: "ยังไม่จบ", unknown: "ยังไม่รู้" }

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
 * แก้ได้แค่ "เกิดอะไรขึ้น" (description) ตรงนี้ · โครงดราม่า/ไอเดียแก้ในหน้าฉากเหมือนเดิม
 */
export function SceneSidePanel({ event, chapterTitle, sceneIndex, threads, onClose, onPatched }: Props) {
    const [summary, setSummary] = useState(event.description ?? "")
    useEffect(() => { setSummary(event.description ?? "") }, [event.id, event.description])

    const items = ((event.canvasData as any[]) || []).filter((i: any) => i?.type === "idea")
    const people = new Map<string, string>()
    for (const it of items) for (const c of it.children ?? []) {
        if (!["character", "dummy_character", "faction", "dummy_faction"].includes(c.type)) continue
        const key = c.referenceId || c.title
        if (key && !people.has(key)) people.set(key, c.title)
    }
    const touched = threads.filter(t => t.beats.some(b => b.eventId === event.id))
    const hasDrama = event.sceneGoal || event.sceneConflict || event.sceneOutcome

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

    const label = "text-[11px] font-medium text-muted-foreground"
    return (
        <aside className="flex w-[320px] shrink-0 flex-col border-l bg-background" aria-label={`รายละเอียดฉาก ${event.title}`}>
            <div className="flex items-start gap-2 border-b px-4 py-3">
                <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-semibold leading-snug">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{chapterTitle ?? "ยังไม่จัดบท"} · ฉาก {sceneIndex + 1}</p>
                </div>
                <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="ปิดแผง">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
                <section className="space-y-1">
                    <p className={label}>เกิดอะไรขึ้น</p>
                    <Textarea
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                        onBlur={saveSummary}
                        placeholder="สรุปฉากนี้สั้น ๆ หนึ่งสองประโยค"
                        className="min-h-[64px] text-sm"
                        aria-label="สรุปฉาก"
                    />
                </section>

                <section className="space-y-1">
                    <p className={label}>สถานะพล็อต</p>
                    <div className="flex w-fit overflow-hidden rounded-sm border" role="radiogroup" aria-label="สถานะพล็อตของฉาก">
                        {([[null, "ร่าง"], ["confirmed", "แน่นอนแล้ว"]] as const).map(([v, text]) => {
                            const on = (event.plotStatus ?? null) === v
                            return (
                                <button key={text} type="button" role="radio" aria-checked={on} onClick={() => setPlotStatus(v)}
                                    className={`h-7 px-2.5 text-xs transition-colors ${on ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                    {text}
                                </button>
                            )
                        })}
                    </div>
                </section>

                <section className="space-y-1">
                    <p className={label}>เป้าหมาย → อุปสรรค → ผล</p>
                    {hasDrama ? (
                        <p className="text-[13px] leading-relaxed">
                            {event.sceneGoal || "—"} <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {event.sceneConflict || "—"}{" "}
                            <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {event.sceneOutcome ? OUTCOME_LABEL[event.sceneOutcome] ?? event.sceneOutcome : "—"}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">ยังไม่ได้ตั้ง · ตั้งได้ในหน้าฉาก</p>
                    )}
                </section>

                <section className="space-y-1">
                    <p className={label}><Users className="mr-1 inline h-3 w-3" />คนในฉาก {people.size > 0 && `· ${people.size}`}</p>
                    {people.size > 0 ? (
                        <div className="flex flex-wrap gap-1">
                            {[...people.values()].slice(0, 12).map(n => (
                                <span key={n} className="rounded-md border px-1.5 py-0.5 text-xs">{n}</span>
                            ))}
                            {people.size > 12 && <span className="text-xs text-muted-foreground">+{people.size - 12}</span>}
                        </div>
                    ) : <p className="text-xs text-muted-foreground">ยังไม่มี</p>}
                </section>

                {touched.length > 0 && (
                    <section className="space-y-1">
                        <p className={label}>ปมที่แตะ</p>
                        {touched.map(t => (
                            <p key={t.id} className="flex items-center gap-1.5 text-xs">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color ?? "var(--forge-amber)" }} />
                                <span className="truncate">{t.title}</span>
                            </p>
                        ))}
                    </section>
                )}

                <section className="space-y-1">
                    <p className={label}>ไอเดียในฉาก · {items.length}</p>
                    {items.length > 0 ? (
                        <ol className="space-y-0.5 text-xs">
                            {items.slice(0, 10).map((it: any) => (
                                <li key={it.id} className="flex items-center gap-1 truncate">
                                    {it.keyMomentLabel && <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="เหตุการณ์สำคัญ" />}
                                    <span className="truncate">{it.title || "ไม่มีชื่อ"}</span>
                                </li>
                            ))}
                            {items.length > 10 && <li className="text-muted-foreground">+{items.length - 10} ไอเดีย</li>}
                        </ol>
                    ) : <p className="text-xs text-muted-foreground">ยังว่าง</p>}
                </section>
            </div>

            <div className="flex gap-2 border-t px-4 py-3">
                <Button asChild size="sm" className="flex-1">
                    <Link href={`/dashboard/project/${event.novelId}/plot/${event.id}`}>เปิดหน้าฉาก</Link>
                </Button>
                <Button asChild size="sm" variant="outline" title="ดูฉากนี้บนเส้นเวลา" aria-label="ดูฉากนี้บนเส้นเวลา">
                    <Link href={`/dashboard/project/${event.novelId}/timeline?focus=${encodeURIComponent(`scene:${event.id}`)}`}>
                        <GanttChart className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        </aside>
    )
}

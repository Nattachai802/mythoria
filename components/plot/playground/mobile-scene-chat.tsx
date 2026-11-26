"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, CornerDownRight, Link2, Loader2, Reply, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChatLane { id: string; name: string; color: string }

interface Props {
    items: any[]
    lanes: ChatLane[] // สีถูก resolve มาจากกระดานแล้ว
    beatCount: number
    isSaving: boolean
    /** สร้างไอเดียใหม่ (+ เส้นจาก replyToId ถ้ามี) — คืน false ถ้าสร้างไม่สำเร็จ ข้อความในช่องจะไม่ถูกล้าง */
    onCreate: (title: string, laneId: string, beatIndex: number, replyToId: string | null) => Promise<boolean>
    onLink: (sourceId: string, targetId: string) => boolean
    onUnlink: (sourceId: string, targetId: string) => void
    renderCard: (item: any, dragDisabled?: boolean, inlineFrame?: boolean) => React.ReactNode
}

const targetOf = (l: any): string => (typeof l === "string" ? l : l?.targetId)

/**
 * หน้าฉากบนมือถือแบบห้องแชท — การ์ด = บับเบิล เรียงตามจังหวะ · เลนแรกชิดซ้าย เลนอื่นชิดขวา
 * เส้นเชื่อม = การอ้างถึง "↩ ต่อจาก X" · เพิ่มไอเดียจากช่องพิมพ์ด้านล่าง
 * ponytail: ไม่มีลาก/จัดเลน/แก้การ์ดลูกในมุมนี้ — แตะบับเบิลแล้วเปิดการ์ดเต็มใน sheet แทน
 */
export function MobileSceneChat({ items, lanes, beatCount, isSaving, onCreate, onLink, onUnlink, renderCard }: Props) {
    const [text, setText] = useState("")
    const [laneId, setLaneId] = useState(lanes[0]?.id ?? "")
    const [beat, setBeat] = useState<number | "new">("new")
    const [replyTo, setReplyTo] = useState<string | null>(null)
    const [linkFrom, setLinkFrom] = useState<string | null>(null)
    const [openId, setOpenId] = useState<string | null>(null)
    const [sending, setSending] = useState(false)
    const [flashId, setFlashId] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)
    const bubbleRefs = useRef(new Map<string, HTMLElement>())
    const prevCount = useRef(items.length)

    const laneById = useMemo(() => new Map(lanes.map((l, i) => [l.id, { ...l, index: i }])), [lanes])
    const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items])
    // เส้นขาเข้า: targetId → การ์ดต้นทาง (เส้นที่ชี้ไปการ์ดที่ไม่อยู่แล้วถูกข้ามเอง)
    const incoming = useMemo(() => {
        const m = new Map<string, any[]>()
        for (const it of items) for (const l of it.links ?? []) {
            const t = targetOf(l)
            if (!byId.has(t)) continue
            m.set(t, [...(m.get(t) ?? []), it])
        }
        return m
    }, [items, byId])

    const beats = useMemo(() => {
        const out: { beat: number; list: any[] }[] = []
        for (let b = 0; b < beatCount; b++) {
            const list = items.filter(i => i.beatIndex === b)
            if (list.length) out.push({ beat: b, list })
        }
        return out
    }, [items, beatCount])

    // เลนถูกลบไปแล้ว → กลับไปเลนแรก
    useEffect(() => { if (!laneById.has(laneId) && lanes[0]) setLaneId(lanes[0].id) }, [laneById, laneId, lanes])

    // มีการ์ดเพิ่ม → เลื่อนลงล่างสุดเหมือนแชท
    useEffect(() => {
        if (items.length > prevCount.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
        prevCount.current = items.length
    }, [items.length])

    const jumpTo = (id: string) => {
        bubbleRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" })
        setFlashId(id)
        setTimeout(() => setFlashId(f => (f === id ? null : f)), 1200)
    }

    const startReply = (id: string) => {
        const src = byId.get(id)
        setReplyTo(id)
        if (src?.laneId && laneById.has(src.laneId)) setLaneId(src.laneId)
        const nb = (typeof src?.beatIndex === "number" ? src.beatIndex : -1) + 1
        setBeat(nb >= beatCount ? "new" : nb)
        setOpenId(null)
    }

    const send = async () => {
        const t = text.trim()
        if (!t || sending || !laneId) return
        setSending(true)
        const ok = await onCreate(t, laneId, beat === "new" ? beatCount : beat, replyTo)
        setSending(false)
        if (!ok) return
        setText("")
        setReplyTo(null)
        setBeat("new")
    }

    const tapBubble = (id: string) => {
        if (linkFrom) {
            if (id !== linkFrom) onLink(linkFrom, id)
            setLinkFrom(null)
            return
        }
        setOpenId(id)
    }

    const open = openId ? byId.get(openId) : null
    const openOut = open ? (open.links ?? []).map(targetOf).filter((t: string) => byId.has(t)).map((t: string) => byId.get(t)) : []
    const openIn = open ? incoming.get(open.id) ?? [] : []
    const lane = laneById.get(laneId)

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-background">
            {linkFrom && (
                <div className="flex items-center gap-2 border-b bg-[var(--forge-amber)]/15 px-3 py-2 text-xs" role="status">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--forge-amber)]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">แตะการ์ดที่จะต่อเส้นจาก “{byId.get(linkFrom)?.title}”</span>
                    <button type="button" onClick={() => setLinkFrom(null)} className="-my-1 rounded px-2 py-1 font-medium">ยกเลิก</button>
                </div>
            )}

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3" aria-live="polite">
                {beats.length === 0 ? (
                    <p className="mt-16 text-center text-sm text-muted-foreground">ยังไม่มีไอเดียในฉากนี้<br />พิมพ์ไอเดียแรกด้านล่าง</p>
                ) : beats.map(({ beat: b, list }) => (
                    <section key={b} aria-label={`จังหวะ ${b + 1}`}>
                        <p className="sticky top-0 z-10 bg-background/95 py-2 text-center text-[11px] tabular-nums text-muted-foreground">จังหวะ {b + 1}</p>
                        <div className="space-y-1.5">
                            {list.map((it, idx) => {
                                if (it.type === "sticky-note") {
                                    return <p key={it.id} className="mx-auto max-w-[85%] py-1 text-center text-xs italic text-muted-foreground">{it.content || it.title}</p>
                                }
                                const ln = laneById.get(it.laneId)
                                const right = (ln?.index ?? 0) > 0
                                const color = ln?.color ?? "var(--forge-amber)"
                                const showName = list[idx - 1]?.laneId !== it.laneId
                                const from = incoming.get(it.id) ?? []
                                const kids: any[] = (it.children ?? []).filter((c: any) => c.type !== "sticky-note")
                                return (
                                    <div key={it.id} className={cn("flex flex-col", right ? "items-end" : "items-start")}>
                                        {showName && (
                                            <span className="mb-0.5 mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{ln?.name ?? "ไม่มีเลน"}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            ref={el => { if (el) bubbleRefs.current.set(it.id, el); else bubbleRefs.current.delete(it.id) }}
                                            onClick={() => tapBubble(it.id)}
                                            className={cn(
                                                "max-w-[80%] rounded-2xl px-3 py-2 text-left text-sm leading-snug transition-[transform,box-shadow] duration-150 active:scale-[0.98] motion-reduce:transition-none",
                                                right ? "rounded-tr-md" : "rounded-tl-md",
                                                linkFrom && linkFrom !== it.id && "ring-2 ring-[var(--forge-amber)]/60",
                                                linkFrom === it.id && "opacity-60",
                                                flashId === it.id && "ring-2 ring-foreground/40",
                                            )}
                                            style={{ background: `color-mix(in oklab, ${color} 18%, var(--background))` }}
                                        >
                                            {from.length > 0 && (
                                                <span
                                                    role="link"
                                                    tabIndex={0}
                                                    onClick={e => { e.stopPropagation(); jumpTo(from[0].id) }}
                                                    onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); jumpTo(from[0].id) } }}
                                                    className="mb-1 flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                                >
                                                    <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden />
                                                    <span className="truncate">ต่อจาก {from[0].title}</span>
                                                    {from.length > 1 && <span className="shrink-0 tabular-nums">+{from.length - 1}</span>}
                                                </span>
                                            )}
                                            <span className="block [overflow-wrap:anywhere]">{it.title || "ไม่มีชื่อ"}</span>
                                            {kids.length > 0 && (
                                                <span className="mt-1 flex flex-wrap gap-1">
                                                    {kids.slice(0, 3).map((c: any) => (
                                                        <span key={c.id} className="max-w-[8rem] truncate rounded-full bg-background/60 px-1.5 text-[11px] text-muted-foreground">{c.title}</span>
                                                    ))}
                                                    {kids.length > 3 && <span className="text-[11px] text-muted-foreground">+{kids.length - 3}</span>}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                ))}
            </div>

            {/* ช่องพิมพ์ */}
            <form
                onSubmit={e => { e.preventDefault(); send() }}
                className="space-y-1.5 border-t bg-background px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5"
            >
                {replyTo && byId.get(replyTo) && (
                    <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:animate-none">
                        <CornerDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">ต่อจาก: {byId.get(replyTo)?.title}</span>
                        <button type="button" onClick={() => setReplyTo(null)} className="-m-1 p-1" aria-label="ยกเลิกการต่อเส้น"><X className="h-3.5 w-3.5" /></button>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <label className="relative flex h-8 min-w-0 max-w-[45%] items-center gap-1.5 rounded-full border px-2.5 text-xs">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: lane?.color }} aria-hidden />
                        <span className="truncate">{lane?.name ?? "เลน"}</span>
                        <select value={laneId} onChange={e => setLaneId(e.target.value)} aria-label="เลน" className="absolute inset-0 cursor-pointer opacity-0">
                            {lanes.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </label>
                    <label className="relative flex h-8 items-center rounded-full border px-2.5 text-xs tabular-nums">
                        {beat === "new" ? `จังหวะใหม่ (${beatCount + 1})` : `จังหวะ ${beat + 1}`}
                        <select
                            value={String(beat)}
                            onChange={e => setBeat(e.target.value === "new" ? "new" : Number(e.target.value))}
                            aria-label="จังหวะ"
                            className="absolute inset-0 cursor-pointer opacity-0"
                        >
                            {Array.from({ length: beatCount }, (_, i) => <option key={i} value={i}>จังหวะ {i + 1}</option>)}
                            <option value="new">จังหวะใหม่ ({beatCount + 1})</option>
                        </select>
                    </label>
                    <span className="ml-auto text-[11px] text-muted-foreground" aria-live="polite">{isSaving ? "กำลังบันทึก…" : ""}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <input
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="พิมพ์ไอเดีย…"
                        aria-label="ไอเดียใหม่"
                        enterKeyHint="send"
                        maxLength={500}
                        className="h-10 min-w-0 flex-1 rounded-full border bg-background px-4 text-base outline-none focus-visible:border-primary"
                    />
                    <button
                        type="submit"
                        disabled={!text.trim() || sending}
                        aria-label="ส่ง"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90 disabled:opacity-40"
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                    </button>
                </div>
            </form>

            {/* แตะบับเบิล → แผงล่าง: ต่อเส้น / ดูเส้น / รายละเอียดเต็ม (คนในฉาก · โน้ต)
                ไม่ใช้ Sheet (Radix Dialog แบบ modal) — มันล็อกการแตะ/ดักโฟกัส ป๊อปอัปเลือกตัวละครข้างในเลยกดไม่ได้
                z-40 ให้ต่ำกว่าป๊อปอัป (z-50) */}
            {open && (
                <div className="fixed inset-0 z-40 flex flex-col justify-end" onKeyDown={e => { if (e.key === "Escape") setOpenId(null) }}>
                    <button type="button" aria-label="ปิด" onClick={() => setOpenId(null)} className="min-h-[15dvh] flex-1 bg-black/40 animate-in fade-in duration-200 motion-reduce:animate-none" />
                    <div role="dialog" aria-label={open.title || "ไอเดีย"} className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-lg animate-in slide-in-from-bottom duration-300 ease-out motion-reduce:animate-none">
                            <div className="sticky top-0 z-10 flex items-start gap-2 border-b bg-background px-4 pb-3 pt-4">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-base font-semibold [overflow-wrap:anywhere]">{open.title || "ไม่มีชื่อ"}</h2>
                                    <p className="text-xs text-muted-foreground">{laneById.get(open.laneId)?.name ?? "ไม่มีเลน"} · จังหวะ {(open.beatIndex ?? 0) + 1}</p>
                                </div>
                                <button type="button" onClick={() => setOpenId(null)} aria-label="ปิดแผง" className="-mr-2 -mt-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground active:bg-muted">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 px-4 py-3">
                                <button type="button" onClick={() => startReply(open.id)} className="flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm active:scale-[0.98]">
                                    <Reply className="h-4 w-4" aria-hidden />ต่อจากอันนี้
                                </button>
                                <button type="button" onClick={() => { setLinkFrom(open.id); setOpenId(null) }} className="flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm active:scale-[0.98]">
                                    <Link2 className="h-4 w-4" aria-hidden />เชื่อมกับการ์ดอื่น
                                </button>
                            </div>
                            {(openOut.length > 0 || openIn.length > 0) && (
                                <div className="space-y-1 border-t px-4 py-3">
                                    <p className="text-xs text-muted-foreground">เส้นเชื่อม</p>
                                    <ul className="divide-y">
                                        {openIn.map((s: any) => (
                                            <LinkRow key={`in-${s.id}`} label={`ต่อจาก ${s.title}`} onRemove={() => onUnlink(s.id, open.id)} />
                                        ))}
                                        {openOut.map((t: any) => (
                                            <LinkRow key={`out-${t.id}`} label={`นำไปสู่ ${t.title}`} onRemove={() => onUnlink(open.id, t.id)} />
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <div className="border-t">{renderCard(open, true, true)}</div>
                    </div>
                </div>
            )}
        </div>
    )
}

function LinkRow({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <li className="flex items-center gap-2 py-1.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <button type="button" onClick={onRemove} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground active:bg-muted" aria-label={`ลบเส้น ${label}`}>
                <X className="h-4 w-4" />
            </button>
        </li>
    )
}

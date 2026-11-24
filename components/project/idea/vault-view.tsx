"use client"

/**
 * หน้าคลังโน้ตไอเดีย (/idea) — จดเร็ว + วางเอกสาร, ค้น, กรอง, ผูกกับของจริง, ดูว่าใช้ไปที่ไหน
 * แหล่งข้อมูล = idea_vault + idea_vault_links (server/idea-vault.ts) · state รายการอยู่ในหน้าจอ แหล่งจริงคือ DB
 * รอบนี้ไม่มี AI — สรุปผู้ใช้เขียนเอง (ช่อง summarySource เตรียมไว้ให้รอบ AI)
 */

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    Archive, ArchiveRestore, Check, CheckCheck, ChevronDown, CircleCheck, CircleDashed, Clapperboard,
    CornerDownLeft, FileText, Layers, Lightbulb, Loader2, Paperclip, Pencil, Search, Sparkles, Trash2,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { IDEA_SCOPES, IDEA_SCOPE_LABEL, cleanScopes, isDocText, type IdeaScope } from "@/lib/idea-scopes"
import {
    acceptDetectedNotes, addVaultLink, createVaultNote, deleteVaultNotes, removeVaultLink, updateVaultNote,
    type VaultNoteView,
} from "@/server/idea-vault"
import { LinkChip, SCOPE_ICON, ScopeTags, ScopeToggles, VaultLinkPicker, effectiveScopes, isUsedNote } from "./vault-ui"

type Status = "unused" | "used" | "all" | "archived"
type Kind = "all" | "jot" | "doc"
type Facet = "all" | IdeaScope | "none"

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" })
function ago(d: Date | string) {
    const s = (new Date(d).getTime() - Date.now()) / 1000
    const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]]
    let v = s
    for (const [n, unit] of steps) {
        if (Math.abs(v) < n) return rtf.format(Math.round(v), unit)
        v /= n
    }
    return ""
}

const statusOk = (n: VaultNoteView, s: Status) =>
    s === "archived" ? n.isArchived : !n.isArchived && (s === "all" || (s === "used") === isUsedNote(n))
const kindOk = (n: VaultNoteView, k: Kind) => k === "all" || (k === "doc") === !!n.body
const facetOk = (n: VaultNoteView, f: Facet) => {
    if (f === "all") return true
    const sc = effectiveScopes(n)
    return f === "none" ? sc.length === 0 : sc.includes(f)
}

function Seg<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: [T, string, number][]; label: string }) {
    return (
        <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border">
            {items.map(([k, l, c]) => (
                <button
                    key={k}
                    type="button"
                    aria-pressed={value === k}
                    onClick={() => onChange(k)}
                    className={cn(
                        "h-8 px-3 text-[13px] transition-colors duration-150 motion-reduce:transition-none",
                        value === k ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50",
                    )}
                >
                    {l} <span className="text-muted-foreground tabular-nums">{c}</span>
                </button>
            ))}
        </div>
    )
}

export function VaultView({ novelId, initialNotes }: { novelId: string; initialNotes: VaultNoteView[] }) {
    const [notes, setNotes] = useState<VaultNoteView[]>(initialNotes)
    const patchLocal = (id: string, p: Partial<VaultNoteView>) => setNotes(prev => prev.map(n => (n.id === id ? { ...n, ...p } : n)))

    // ---------- ช่องจด ----------
    const [draft, setDraft] = useState("")
    const [source, setSource] = useState("")
    const [capScopes, setCapScopes] = useState<IdeaScope[]>([])
    const [capFocused, setCapFocused] = useState(false)
    const [capErr, setCapErr] = useState("")
    const [saving, setSaving] = useState(false)
    const capRef = useRef<HTMLTextAreaElement>(null)
    const doc = isDocText(draft)

    const save = async () => {
        const v = draft.trim()
        if (!v) { setCapErr("พิมพ์หรือวางข้อความก่อน"); capRef.current?.focus(); return }
        if (saving) return
        setSaving(true)
        const res = await createVaultNote({
            novelId,
            text: doc ? undefined : v,
            body: doc ? v : null,
            source: doc ? source : null,
            scopes: capScopes,
        })
        setSaving(false)
        if (!res.success) { setCapErr(res.error); return }
        if (res.isDuplicate) toast.info("มีโน้ตนี้อยู่แล้ว")
        else setNotes(prev => [res.data, ...prev])
        setDraft(""); setSource(""); setCapScopes([])
        setStatus("unused"); setFacet("all"); setKind("all"); setOpenId(res.data.id)
        if (!res.isDuplicate) toast.success("บันทึกแล้ว")
    }

    // ---------- ตัวกรอง ----------
    const [q, setQ] = useState("")
    const [status, setStatus] = useState<Status>("unused")
    const [kind, setKind] = useState<Kind>("all")
    const [facet, setFacet] = useState<Facet>("all")
    const [openId, setOpenId] = useState<string | null>(null)

    const vaultNotes = useMemo(() => notes.filter(n => !n.isDetected), [notes])
    const detected = useMemo(() => notes.filter(n => n.isDetected), [notes])
    const query = q.trim().toLowerCase()
    const qOk = (n: VaultNoteView) => !query || [n.text, n.summary, n.body, n.source].some(x => x?.toLowerCase().includes(query))
    const visible = vaultNotes.filter(n => statusOk(n, status) && kindOk(n, kind) && facetOk(n, facet) && qOk(n))
    const facetCount = (f: Facet) => vaultNotes.filter(n => statusOk(n, status) && kindOk(n, kind) && facetOk(n, f)).length

    // ---------- การกระทำบนโน้ต ----------
    const setArchived = async (n: VaultNoteView, isArchived: boolean) => {
        patchLocal(n.id, { isArchived })
        if (openId === n.id) setOpenId(null)
        const res = await updateVaultNote(n.id, { isArchived })
        if (!res.success) { patchLocal(n.id, { isArchived: !isArchived }); toast.error(res.error); return }
        if (isArchived) toast("เก็บเข้ากรุแล้ว", { action: { label: "เลิกทำ", onClick: () => setArchived(n, false) } })
    }

    const toggleScope = async (n: VaultNoteView, k: IdeaScope) => {
        const own = cleanScopes(n.scopes)
        const next = own.includes(k) ? own.filter(x => x !== k) : [...own, k]
        patchLocal(n.id, { scopes: next })
        const res = await updateVaultNote(n.id, { scopes: next })
        if (!res.success) { patchLocal(n.id, { scopes: own }); toast.error(res.error) }
    }

    const saveField = async (n: VaultNoteView, field: "text" | "summary" | "source" | "body", value: string) => {
        const prev = n[field]
        if ((prev ?? "") === value.trim()) return true
        const res = await updateVaultNote(n.id, { [field]: value })
        if (!res.success) { toast.error(res.error); return false }
        patchLocal(n.id, { text: res.data.text, summary: res.data.summary, summarySource: res.data.summarySource, source: res.data.source, body: res.data.body })
        return true
    }

    const link = async (n: VaultNoteView, o: { type: VaultNoteView["links"][number]["targetType"]; id: string; title: string; href: string }) => {
        const res = await addVaultLink(n.id, o.type, o.id)
        if (!res.success) { toast.error(res.error); return }
        patchLocal(n.id, { links: [...n.links, { id: `${o.type}:${o.id}`, targetType: o.type, targetId: o.id, relation: "about", title: o.title, href: o.href }] })
    }
    const unlink = async (n: VaultNoteView, l: VaultNoteView["links"][number]) => {
        patchLocal(n.id, { links: n.links.filter(x => x !== l) })
        const res = await removeVaultLink(n.id, l.targetType, l.targetId, "about")
        if (!res.success) { patchLocal(n.id, { links: n.links }); toast.error(res.error) }
    }

    const removeForever = async (ids: string[]) => {
        const res = await deleteVaultNotes(novelId, ids)
        if (!res.success) { toast.error(res.error); return }
        setNotes(prev => prev.filter(n => !ids.includes(n.id)))
        toast.success(`ลบแล้ว ${res.data} โน้ต`)
    }

    // ---------- รออนุมัติ ----------
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const accept = async (ids: string[]) => {
        const res = await acceptDetectedNotes(novelId, ids)
        if (!res.success) { toast.error(res.error); return }
        setNotes(prev => prev.map(n => (ids.includes(n.id) ? { ...n, isDetected: false } : n)))
        setPicked(new Set())
        toast.success(`ย้ายเข้าคลัง ${res.data} โน้ต`)
    }

    return (
        <Tabs defaultValue="vault" className="w-full">
            <TabsList className="mb-4">
                <TabsTrigger value="vault" className="gap-2"><Lightbulb className="h-4 w-4" />คลัง <span className="tabular-nums text-muted-foreground">{vaultNotes.filter(n => !n.isArchived).length}</span></TabsTrigger>
                <TabsTrigger value="detected" className="gap-2"><Sparkles className="h-4 w-4" />รออนุมัติ <span className="tabular-nums text-muted-foreground">{detected.length}</span></TabsTrigger>
            </TabsList>

            <TabsContent value="vault" className="mt-0 space-y-4">
                {/* ช่องจด */}
                <div className="rounded-xl border bg-card p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                        <label htmlFor="vault-capture" className="flex-1 text-sm text-muted-foreground">จดไอเดีย หรือวางเอกสารยาว</label>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {doc ? <><FileText className="h-3.5 w-3.5" />โหมดเอกสาร · ⌘/Ctrl+Enter บันทึก</> : <><CornerDownLeft className="h-3.5 w-3.5" />Enter บันทึก · Shift+Enter ขึ้นบรรทัด</>}
                        </span>
                    </div>
                    <Textarea
                        id="vault-capture"
                        ref={capRef}
                        value={draft}
                        rows={doc ? 8 : 1}
                        onChange={e => { setDraft(e.target.value); setCapErr("") }}
                        onFocus={() => setCapFocused(true)}
                        onKeyDown={e => {
                            if (e.key !== "Enter") return
                            if (!doc && !e.shiftKey) { e.preventDefault(); save() }
                            else if (doc && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save() }
                        }}
                        placeholder="อารันกลัวน้ำเพราะเหตุการณ์ตอนเด็ก"
                        disabled={saving}
                        aria-invalid={!!capErr}
                        aria-describedby={capErr ? "vault-capture-err" : undefined}
                        className="min-h-9 resize-none text-sm leading-relaxed"
                    />
                    {capErr && <p id="vault-capture-err" role="alert" className="mt-1.5 text-[13px] text-destructive">{capErr}</p>}
                    {doc && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground"><FileText className="h-4 w-4" />{draft.length.toLocaleString()} ตัวอักษร · บรรทัดแรกจะเป็นหัวเรื่อง</span>
                            <span className="flex-1" />
                            <Input value={source} onChange={e => setSource(e.target.value)} placeholder="มาจากไหน (ชื่อเอกสาร หรือ URL)" aria-label="แหล่งที่มา" className="h-8 w-64 text-[13px]" />
                        </div>
                    )}
                    {(capFocused || draft) && (
                        <div className="mt-3 space-y-1.5">
                            <p className="text-xs text-muted-foreground">จะใช้ที่ไหน (ไม่ต้องเลือกก็ได้)</p>
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="flex-1"><ScopeToggles value={capScopes} onToggle={k => setCapScopes(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]))} disabled={saving} /></div>
                                <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}บันทึก
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* ค้น + สถานะ + ชนิด */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[200px] flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นในหัวเรื่อง สรุป และต้นฉบับ" aria-label="ค้นหาโน้ต" className="pl-8" />
                    </div>
                    <Seg label="สถานะ" value={status} onChange={setStatus} items={[
                        ["unused", "ยังไม่ใช้", vaultNotes.filter(n => statusOk(n, "unused")).length],
                        ["used", "ใช้แล้ว", vaultNotes.filter(n => statusOk(n, "used")).length],
                        ["all", "ทั้งหมด", vaultNotes.filter(n => statusOk(n, "all")).length],
                        ["archived", "กรุ", vaultNotes.filter(n => n.isArchived).length],
                    ]} />
                    <Seg label="ชนิด" value={kind} onChange={setKind} items={[
                        ["all", "ทุกแบบ", vaultNotes.filter(n => statusOk(n, status)).length],
                        ["jot", "โน้ตสั้น", vaultNotes.filter(n => statusOk(n, status) && !n.body).length],
                        ["doc", "เอกสาร", vaultNotes.filter(n => statusOk(n, status) && !!n.body).length],
                    ]} />
                </div>

                <div className="grid gap-4 md:grid-cols-[170px_minmax(0,1fr)]">
                    {/* หมวด */}
                    <nav aria-label="กรองตามที่ใช้" className="flex flex-row gap-1 overflow-x-auto md:flex-col">
                        {([["all", Layers, "ทุกที่"], ...IDEA_SCOPES.map(k => [k, SCOPE_ICON[k], IDEA_SCOPE_LABEL[k]] as const), ["none", CircleDashed, "ยังไม่ระบุ"]] as const).map(([k, Icon, label]) => (
                            <button
                                key={k}
                                type="button"
                                aria-pressed={facet === k}
                                onClick={() => setFacet(k as Facet)}
                                className={cn(
                                    "flex h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors duration-150 motion-reduce:transition-none",
                                    facet === k ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <Icon className="h-4 w-4" aria-hidden />
                                <span className="flex-1">{label}</span>
                                <span className="text-xs tabular-nums text-muted-foreground">{facetCount(k as Facet)}</span>
                            </button>
                        ))}
                    </nav>

                    {/* รายการ */}
                    <div className="overflow-hidden rounded-xl border bg-card">
                        {visible.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <Lightbulb className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
                                <p className="mt-2 text-sm">{vaultNotes.length === 0 ? "เริ่มจดไอเดียแรก" : "ไม่มีโน้ตในมุมนี้"}</p>
                                <p className="mt-0.5 text-[13px] text-muted-foreground">{vaultNotes.length === 0 ? "นึกอะไรได้ก็จดไว้ก่อน แล้วค่อยติดแท็กว่าจะใช้ที่ไหน" : "ลองเปลี่ยนตัวกรอง หรือจดไอเดียของหมวดนี้"}</p>
                                <Button variant="outline" size="sm" className="mt-3" onClick={() => capRef.current?.focus()}>จดไอเดีย</Button>
                            </div>
                        ) : visible.map(n => (
                            <NoteRow
                                key={n.id}
                                note={n}
                                novelId={novelId}
                                open={openId === n.id}
                                onToggle={() => setOpenId(id => (id === n.id ? null : n.id))}
                                onScope={k => toggleScope(n, k)}
                                onSave={(f, v) => saveField(n, f, v)}
                                onLink={o => link(n, o)}
                                onUnlink={l => unlink(n, l)}
                                onArchive={a => setArchived(n, a)}
                                onDelete={() => removeForever([n.id])}
                            />
                        ))}
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="detected" className="mt-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="flex-1 text-sm text-muted-foreground">ชื่อที่ AI สกัดได้จากเนื้อเรื่อง — อนุมัติแล้วจะเข้าคลัง</p>
                    <Button variant="outline" size="sm" onClick={() => setPicked(picked.size === detected.length ? new Set() : new Set(detected.map(n => n.id)))} disabled={detected.length === 0}>
                        {picked.size === detected.length && detected.length > 0 ? "ยกเลิกที่เลือก" : "เลือกทั้งหมด"}
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => accept([...picked])} disabled={picked.size === 0}><CheckCheck className="h-4 w-4" />อนุมัติ {picked.size || ""}</Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" disabled={picked.size === 0}><Trash2 className="h-4 w-4" />ลบ {picked.size || ""}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>ลบ {picked.size} รายการถาวร?</AlertDialogTitle>
                                <AlertDialogDescription>ลบออกจากคลังแล้วกู้คืนไม่ได้</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                <AlertDialogAction onClick={() => { removeForever([...picked]); setPicked(new Set()) }}>ลบ</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <div className="overflow-hidden rounded-xl border bg-card">
                    {detected.length === 0 ? (
                        <p className="px-4 py-10 text-center text-sm text-muted-foreground">ไม่มีรายการรออนุมัติ</p>
                    ) : detected.map(n => (
                        <label key={n.id} className="flex cursor-pointer items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/40">
                            <Checkbox
                                checked={picked.has(n.id)}
                                onCheckedChange={c => setPicked(s => { const x = new Set(s); if (c) x.add(n.id); else x.delete(n.id); return x })}
                            />
                            <span className="flex-1 text-sm">{n.text}</span>
                            <ScopeTags scopes={effectiveScopes(n)} />
                            <button type="button" onClick={e => { e.preventDefault(); accept([n.id]) }} className="rounded px-2 py-1 text-xs text-primary hover:bg-primary/10">อนุมัติ</button>
                        </label>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
    )
}

function NoteRow({ note: n, novelId, open, onToggle, onScope, onSave, onLink, onUnlink, onArchive, onDelete }: {
    note: VaultNoteView
    novelId: string
    open: boolean
    onToggle: () => void
    onScope: (k: IdeaScope) => void
    onSave: (f: "text" | "summary" | "source" | "body", v: string) => Promise<boolean>
    onLink: (o: { type: VaultNoteView["links"][number]["targetType"]; id: string; title: string; href: string }) => void
    onUnlink: (l: VaultNoteView["links"][number]) => void
    onArchive: (archived: boolean) => void
    onDelete: () => void
}) {
    const about = n.links.filter(l => l.relation === "about")
    const usedIn = n.links.filter(l => l.relation === "used_in")
    const [editText, setEditText] = useState<string | null>(null)
    const [editBody, setEditBody] = useState<string | null>(null)
    const [summary, setSummary] = useState(n.summary ?? "")
    const [source, setSource] = useState(n.source ?? "")

    return (
        <div className={cn("border-b last:border-b-0 transition-colors duration-150 motion-reduce:transition-none", open ? "bg-muted/40" : "hover:bg-muted/30")}>
            <button type="button" onClick={onToggle} aria-expanded={open} className="block w-full px-3 py-2.5 text-left">
                <div className="flex items-start gap-2">
                    {n.body ? <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forge-amber)]" aria-hidden />}
                    <p className="flex-1 text-sm leading-relaxed">{n.text}</p>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{ago(n.createdAt)}</span>
                </div>
                {n.summary && !open && <p className="ml-6 mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{n.summary}</p>}
                <div className="ml-6 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <ScopeTags scopes={effectiveScopes(n)} />
                    {about.length > 0 && <span className="text-xs text-muted-foreground">· {about.map(l => l.title).join(", ")}</span>}
                    {usedIn.length > 0 && <span className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><CircleCheck className="h-3.5 w-3.5" aria-hidden />ใช้แล้ว {usedIn.length} ที่</span>}
                </div>
            </button>

            {open && (
                <div className="ml-9 mr-3 space-y-4 border-t pb-3 pt-3">
                    {editText !== null ? (
                        <div className="flex gap-2">
                            <Input value={editText} onChange={e => setEditText(e.target.value)} aria-label="ข้อความโน้ต" autoFocus
                                onKeyDown={async e => { if (e.key === "Enter") { if (await onSave("text", editText)) setEditText(null) } else if (e.key === "Escape") setEditText(null) }} />
                            <Button size="sm" onClick={async () => { if (await onSave("text", editText)) setEditText(null) }}>บันทึก</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditText(null)}>ยกเลิก</Button>
                        </div>
                    ) : null}

                    <section className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">จะใช้ที่ไหน</p>
                        <ScopeToggles value={cleanScopes(n.scopes)} onToggle={onScope} />
                    </section>

                    <section className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">ผูกกับ</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {about.map(l => <LinkChip key={l.id} type={l.targetType} title={l.title} href={l.href} onRemove={() => onUnlink(l)} />)}
                            <VaultLinkPicker novelId={novelId} exclude={new Set(about.map(l => `${l.targetType}:${l.targetId}`))} onPick={o => onLink(o)} />
                        </div>
                    </section>

                    <section className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">ใช้ไปแล้วที่</p>
                        {usedIn.length === 0 ? (
                            <p className="text-[13px] text-muted-foreground">ยังไม่ได้ใช้ — ลากจากถาดไอเดียบนกระดานพล็อตลงบทได้</p>
                        ) : (
                            <ul className="space-y-1">
                                {usedIn.map(l => (
                                    <li key={l.id}>
                                        <a href={l.href ?? "#"} className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"><Clapperboard className="h-3.5 w-3.5" aria-hidden />{l.title}</a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className="space-y-1.5">
                        <label htmlFor={`sum-${n.id}`} className="text-xs text-muted-foreground">สรุป (ไม่บังคับ)</label>
                        <Textarea id={`sum-${n.id}`} value={summary} onChange={e => setSummary(e.target.value)} onBlur={() => onSave("summary", summary)}
                            rows={2} placeholder="สรุปสั้น ๆ ว่าไอเดียนี้คืออะไร" className="text-[13px] leading-relaxed" />
                    </section>

                    {n.body !== null && (
                        <section className="space-y-1.5">
                            <div className="flex items-center gap-2">
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                <Input value={source} onChange={e => setSource(e.target.value)} onBlur={() => onSave("source", source)}
                                    placeholder="มาจากไหน (ชื่อเอกสาร หรือ URL)" aria-label="แหล่งที่มา" className="h-8 text-[13px]" />
                            </div>
                            {editBody !== null ? (
                                <div className="space-y-2">
                                    <Textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={10} aria-label="ต้นฉบับ" className="text-[13px] leading-relaxed" />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => setEditBody(null)}>ยกเลิก</Button>
                                        <Button size="sm" onClick={async () => { if (await onSave("body", editBody)) setEditBody(null) }}>บันทึกต้นฉบับ</Button>
                                    </div>
                                </div>
                            ) : (
                                <details className="group">
                                    <summary className="flex cursor-pointer list-none items-center gap-1 text-[13px] text-primary">
                                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                                        ดูต้นฉบับ ({(n.body ?? "").length.toLocaleString()} ตัวอักษร)
                                    </summary>
                                    <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                                    <Button size="sm" variant="ghost" className="mt-1 h-7 gap-1 text-xs" onClick={() => setEditBody(n.body ?? "")}><Pencil className="h-3 w-3" />แก้ต้นฉบับ</Button>
                                </details>
                            )}
                        </section>
                    )}

                    <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditText(n.text)}><Pencil className="h-3.5 w-3.5" />แก้ข้อความ</Button>
                        {n.isArchived ? (
                            <>
                                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onArchive(false)}><ArchiveRestore className="h-3.5 w-3.5" />เอาออกจากกรุ</Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="outline" className="gap-1.5 text-destructive"><Trash2 className="h-3.5 w-3.5" />ลบถาวร</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>ลบโน้ตนี้ถาวร?</AlertDialogTitle>
                                            <AlertDialogDescription>กู้คืนไม่ได้ · การ์ดในฉากที่เคยคัดลอกจากโน้ตนี้ยังอยู่</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                            <AlertDialogAction onClick={onDelete}>ลบ</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </>
                        ) : (
                            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onArchive(true)}><Archive className="h-3.5 w-3.5" />เก็บเข้ากรุ</Button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


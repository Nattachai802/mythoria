"use client"

/**
 * แผงนำเข้าเอกสารเข้าคลังไอเดีย — อ่านไฟล์ใน browser (ไฟล์ไม่ถูกอัปโหลด/ไม่ถูกเก็บ) เหลือแค่ข้อความดิบลง idea_vault.body
 * txt/md = file.text() · docx = mammoth (raw text) · pdf = pdfjs (ชั้นข้อความ — ไม่มี OCR)
 * state ทั้งหมดอยู่ในแผง ปิด/รีเฟรช = หาย (ถามก่อนทิ้งถ้ามีข้อความ)
 */

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Check, FileText, FileUp, Loader2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { headlineOf, type IdeaScope, type VaultLinkTarget } from "@/lib/idea-scopes"
import { createVaultNote, type VaultNoteView } from "@/server/idea-vault"
import { LinkChip, ScopeToggles, VaultLinkPicker } from "./vault-ui"

export const IMPORT_ACCEPT = ".txt,.md,.markdown,.docx,.pdf"
const MAX_CHARS = 200_000 // ตรงกับ MAX_BODY ใน server/idea-vault.ts
const MAX_FILE_MB = 30 // ponytail: กัน browser ค้างตอนอ่านไฟล์ยักษ์ — ปรับได้ถ้าเจอไฟล์จริงที่ใหญ่กว่านี้

type ReadState = { kind: "idle" } | { kind: "reading" } | { kind: "ok"; msg: string } | { kind: "warn"; msg: string } | { kind: "error"; msg: string }

const clean = (s: string) => s.normalize("NFC").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()

async function extractText(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (ext === "txt" || ext === "md" || ext === "markdown") return file.text()
    if (ext === "docx") {
        const mammoth = await import("mammoth")
        const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        return r.value
    }
    if (ext === "pdf") {
        const pdfjs = await import("pdfjs-dist")
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
        const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
        const doc = await task.promise
        const pages: string[] = []
        for (let i = 1; i <= doc.numPages; i++) {
            const c = await (await doc.getPage(i)).getTextContent()
            pages.push(c.items.map(it => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""))
        }
        await task.destroy()
        return pages.join("\n\n")
    }
    throw new Error("UNSUPPORTED")
}

type PickedLink = { targetType: VaultLinkTarget; targetId: string; title: string }

export function VaultImportSheet({ novelId, open, onClose, initialText, initialFile, onSaved }: {
    novelId: string
    open: boolean
    onClose: () => void
    initialText?: string
    initialFile?: File
    onSaved: (note: VaultNoteView) => void
}) {
    const [body, setBody] = useState(initialText ?? "")
    const [title, setTitle] = useState(initialText ? headlineOf(initialText) : "")
    const [titleTouched, setTitleTouched] = useState(false)
    const [source, setSource] = useState("")
    const [summary, setSummary] = useState("")
    const [scopes, setScopes] = useState<IdeaScope[]>([])
    const [links, setLinks] = useState<PickedLink[]>([])
    const [read, setRead] = useState<ReadState>({ kind: "idle" })
    const [fileName, setFileName] = useState("")
    const [dragOver, setDragOver] = useState(false)
    const [err, setErr] = useState("")
    const [saving, setSaving] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const loadFile = async (file: File) => {
        setErr("")
        if (file.size > MAX_FILE_MB * 1024 * 1024) { setRead({ kind: "error", msg: `ไฟล์ใหญ่เกิน ${MAX_FILE_MB}MB` }); return }
        setFileName(file.name)
        setRead({ kind: "reading" })
        try {
            const text = clean(await extractText(file))
            if (!text) {
                setRead({ kind: "warn", msg: file.name.toLowerCase().endsWith(".pdf") ? "ไม่พบข้อความในไฟล์นี้ — อาจเป็นภาพสแกน (ยังไม่รองรับ OCR)" : "ไฟล์นี้ไม่มีข้อความ" })
                return
            }
            setBody(text)
            if (!titleTouched) setTitle(headlineOf(text))
            if (!source.trim()) setSource(file.name)
            setRead(text.length > MAX_CHARS
                ? { kind: "warn", msg: `อ่านได้ ${text.length.toLocaleString()} ตัวอักษร — เกินเพดาน ตัดบางส่วนออกก่อนบันทึก` }
                : { kind: "ok", msg: `อ่านได้ ${text.length.toLocaleString()} ตัวอักษร · ไฟล์ไม่ถูกอัปโหลด` })
        } catch (e) {
            const name = (e as { name?: string; message?: string })?.name
            const msg = (e as Error)?.message === "UNSUPPORTED" ? "รับเฉพาะ txt, md, docx, pdf"
                : name === "PasswordException" ? "PDF นี้ล็อกรหัสไว้ — ปลดล็อกก่อนแล้วลองใหม่"
                : "อ่านไฟล์ไม่ได้ — ไฟล์อาจเสีย"
            setRead({ kind: "error", msg })
        }
    }

    // ไฟล์ที่ลากมาวางที่กล่องจด — อ่านทันทีที่แผงเปิด
    // setTimeout + cleanup = StrictMode เรียก effect สองรอบก็อ่านไฟล์ครั้งเดียว
    useEffect(() => {
        if (!initialFile) return
        const t = setTimeout(() => loadFile(initialFile))
        return () => clearTimeout(t)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const dirty = body.trim() !== "" || summary.trim() !== ""
    const tryClose = () => {
        if (saving) return
        if (dirty && !window.confirm("ทิ้งเอกสารนี้? ข้อความที่ยังไม่บันทึกจะหาย")) return
        onClose()
    }

    const over = body.length > MAX_CHARS
    const save = async () => {
        if (!body.trim()) { setErr("ยังไม่มีข้อความ — เลือกไฟล์หรือวางข้อความก่อน"); return }
        if (over) { setErr(`ยาวเกิน ${MAX_CHARS.toLocaleString()} ตัวอักษร — ตัดออกหรือแบ่งเป็นหลายโน้ต`); return }
        setSaving(true)
        const res = await createVaultNote({
            novelId,
            text: title.trim() || undefined,
            body,
            summary,
            source,
            scopes,
            links: links.map(({ targetType, targetId }) => ({ targetType, targetId })),
        })
        setSaving(false)
        if (!res.success) { setErr(res.error); return }
        toast.success("บันทึกเอกสารลงคลังแล้ว")
        onSaved(res.data)
    }

    return (
        <Sheet open={open} onOpenChange={o => { if (!o) tryClose() }}>
            <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-4xl">
                <SheetHeader className="border-b px-5 py-3">
                    <SheetTitle className="flex items-center gap-2 text-base"><FileUp className="h-4 w-4" aria-hidden />นำเข้าเอกสาร</SheetTitle>
                    <SheetDescription className="text-xs">txt, md, docx, pdf — อ่านในเครื่อง เก็บเฉพาะข้อความ ไม่เก็บไฟล์</SheetDescription>
                </SheetHeader>

                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                    {/* ช่องวางไฟล์ */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f) }}
                        className={cn("flex items-center gap-3 rounded-lg border border-dashed px-3 py-2.5", dragOver && "border-primary bg-muted")}
                    >
                        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                        <div className="min-w-0 flex-1" aria-live="polite">
                            <p className="truncate text-sm">{fileName || "ลากไฟล์มาวางตรงนี้ หรือพิมพ์/วางข้อความด้านล่าง"}</p>
                            {read.kind === "reading" && <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />กำลังอ่านไฟล์…</p>}
                            {read.kind === "ok" && <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400"><Check className="h-3 w-3" />{read.msg}</p>}
                            {read.kind === "warn" && <p className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3 w-3" />{read.msg}</p>}
                            {read.kind === "error" && <p role="alert" className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />{read.msg}</p>}
                        </div>
                        <input ref={fileRef} type="file" accept={IMPORT_ACCEPT} className="sr-only" tabIndex={-1}
                            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = "" }} />
                        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={read.kind === "reading"}>
                            {fileName ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}
                        </Button>
                    </div>

                    <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                        <div className="flex min-h-[320px] flex-col">
                            <label htmlFor="import-body" className="mb-1 text-xs text-muted-foreground">ข้อความ (แก้ได้ · วางเองก็ได้)</label>
                            <Textarea id="import-body" value={body} onChange={e => { setBody(e.target.value); setErr(""); if (!titleTouched) setTitle(headlineOf(e.target.value)) }}
                                className="min-h-[320px] flex-1 resize-none font-mono text-[13px] leading-relaxed" />
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="import-title" className="mb-1 block text-xs text-muted-foreground">หัวเรื่อง</label>
                                <Input id="import-title" value={title} onChange={e => { setTitle(e.target.value); setTitleTouched(true) }} maxLength={500} placeholder="เติมจากบรรทัดแรกให้" className="text-[13px]" />
                            </div>
                            <div>
                                <label htmlFor="import-source" className="mb-1 block text-xs text-muted-foreground">แหล่งที่มา</label>
                                <Input id="import-source" value={source} onChange={e => setSource(e.target.value)} placeholder="ชื่อเอกสาร หรือ URL" className="text-[13px]" />
                            </div>
                            <div>
                                <label htmlFor="import-summary" className="mb-1 block text-xs text-muted-foreground">สรุป (ไม่บังคับ)</label>
                                <Textarea id="import-summary" value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="เอกสารนี้ว่าด้วยอะไร — การ์ดในฉากจะใช้ข้อความนี้" className="text-[13px]" />
                            </div>
                            <div>
                                <p className="mb-1 text-xs text-muted-foreground">จะใช้ที่ไหน</p>
                                <ScopeToggles value={scopes} onToggle={k => setScopes(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]))} disabled={saving} />
                            </div>
                            <div>
                                <p className="mb-1 text-xs text-muted-foreground">ผูกกับ</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {links.map(l => (
                                        <LinkChip key={`${l.targetType}:${l.targetId}`} type={l.targetType} title={l.title} href={null}
                                            onRemove={() => setLinks(ls => ls.filter(x => !(x.targetType === l.targetType && x.targetId === l.targetId)))} />
                                    ))}
                                    <VaultLinkPicker novelId={novelId} label="ผูก" exclude={new Set(links.map(l => `${l.targetType}:${l.targetId}`))}
                                        onPick={o => setLinks(ls => [...ls, { targetType: o.type, targetId: o.id, title: o.title }])} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
                    <span className={cn("flex-1 text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
                        {body.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} ตัวอักษร
                    </span>
                    {err && <p role="alert" className="w-full text-[13px] text-destructive md:order-first md:w-auto">{err}</p>}
                    <Button variant="ghost" onClick={tryClose} disabled={saving}>ยกเลิก</Button>
                    <Button onClick={save} disabled={saving || read.kind === "reading"} className="gap-1.5">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}บันทึกลงคลัง
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}

"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Check, ChevronDown, ChevronRight, Upload, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { extractBible, applyBibleProposals } from "@/server/bible-import"
import type { Proposal } from "@/server/assistant"

export function BibleImportView({ novelId }: { novelId: string }) {
    const router = useRouter()
    const [markdown, setMarkdown] = useState("")
    const [extracting, setExtracting] = useState(false)
    const [importing, setImporting] = useState(false)
    const [proposals, setProposals] = useState<Proposal[] | null>(null)
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [isDragging, setIsDragging] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const readFile = useCallback((file: File) => {
        if (!file.name.match(/\.(md|txt)$/i)) {
            toast.error("รองรับเฉพาะไฟล์ .md และ .txt")
            return
        }
        const reader = new FileReader()
        reader.onload = (e) => {
            const text = e.target?.result as string
            setMarkdown(text)
            setFileName(file.name)
            toast.success(`โหลด "${file.name}" สำเร็จ`)
        }
        reader.readAsText(file, "utf-8")
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        const file = e.dataTransfer.files[0]
        if (file) readFile(file)
    }, [readFile])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) readFile(file)
        e.target.value = ""
    }

    const handleExtract = async () => {
        if (!markdown.trim()) { toast.error("วางเอกสาร Story Bible ก่อน"); return }
        setExtracting(true)
        setProposals(null)
        const res = await extractBible(markdown)
        setExtracting(false)
        if (!res.success || !res.proposals) { toast.error(res.error || "สกัดไม่สำเร็จ"); return }
        if (res.proposals.length === 0) { toast.error("ไม่พบ entity ในเอกสาร"); return }
        setProposals(res.proposals)
        setSelected(new Set(res.proposals.map((_, i) => i))) // เลือกทั้งหมดเป็น default
        toast.success(`สกัดได้ ${res.proposals.length} รายการ จาก ${res.stats?.sections} หัวข้อ`)
    }

    const handleImport = async () => {
        if (!proposals) return
        const picked = proposals.filter((_, i) => selected.has(i))
        if (picked.length === 0) { toast.error("เลือกอย่างน้อย 1 รายการ"); return }
        setImporting(true)
        const res = await applyBibleProposals(novelId, picked)
        setImporting(false)
        if (res.created > 0) {
            toast.success(`สร้างแล้ว ${res.created} รายการ${res.failed ? ` · พลาด ${res.failed}` : ""}`)
            router.refresh()
            // เอารายการที่สร้างสำเร็จออก (เก็บที่พลาดไว้ให้เห็น)
            if (res.failed === 0) { setProposals(null); setMarkdown("") }
        } else {
            toast.error(res.errors[0] || "สร้างไม่สำเร็จ")
        }
    }

    const toggle = (i: number) =>
        setSelected(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })

    // group by entityType
    const groups: Record<string, { noun: string; items: { p: Proposal; idx: number }[] }> = {}
    proposals?.forEach((p, idx) => {
        const g = groups[p.entityType] ?? (groups[p.entityType] = { noun: p.noun, items: [] })
        g.items.push({ p, idx })
    })

    const toggleGroup = (type: string, items: number[]) => {
        const allOn = items.every(i => selected.has(i))
        setSelected(prev => {
            const n = new Set(prev)
            items.forEach(i => allOn ? n.delete(i) : n.add(i))
            return n
        })
    }

    return (
        <div className="space-y-4">
            {!proposals && (
                <>
                    {/* Drop Zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 cursor-pointer transition-colors",
                            isDragging
                                ? "border-primary bg-primary/5"
                                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                        )}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".md,.txt"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
                        <div className="text-center">
                            <p className="text-sm font-medium">
                                {isDragging ? "วางไฟล์ที่นี่" : "ลากไฟล์มาวาง หรือคลิกเพื่อเลือก"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">รองรับ .md และ .txt</p>
                        </div>
                        {fileName && (
                            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
                                <FileText className="h-3.5 w-3.5" />
                                {fileName}
                            </div>
                        )}
                    </div>

                    <div className="relative flex items-center gap-3">
                        <div className="flex-1 border-t" />
                        <span className="text-xs text-muted-foreground">หรือวางข้อความโดยตรง</span>
                        <div className="flex-1 border-t" />
                    </div>

                    <Textarea
                        value={markdown}
                        onChange={e => { setMarkdown(e.target.value); setFileName(null) }}
                        placeholder="วางเอกสาร Story Bible (markdown) ที่นี่… แบ่งหัวข้อด้วย ## — AI จะสกัด ตัวละคร ตระกูล ผี ของ พลัง ปม ออกมาให้ review ก่อนสร้าง"
                        className="min-h-[180px] font-mono text-xs"
                    />
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            สกัดอย่างเดียว — ไม่แต่งเพิ่ม · ยืนยันทีละรายการก่อนเขียนเสมอ
                        </p>
                        <Button onClick={handleExtract} disabled={extracting || !markdown.trim()}>
                            {extracting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
                            {extracting ? "กำลังสกัด…" : "สกัด entity"}
                        </Button>
                    </div>
                </>
            )}

            {proposals && (
                <>
                    <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b">
                        <div className="text-sm">
                            <span className="font-medium">{selected.size}</span>
                            <span className="text-muted-foreground"> / {proposals.length} รายการที่จะสร้าง</span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setProposals(null) }}>
                                กลับไปแก้เอกสาร
                            </Button>
                            <Button onClick={handleImport} disabled={importing || selected.size === 0}>
                                {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                                สร้าง {selected.size} รายการ
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {Object.entries(groups).map(([type, g]) => {
                            const idxs = g.items.map(it => it.idx)
                            const isCollapsed = collapsed.has(type)
                            const allOn = idxs.every(i => selected.has(i))
                            return (
                                <div key={type} className="border rounded-lg overflow-hidden">
                                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                                        <button onClick={() => setCollapsed(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n })}>
                                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </button>
                                        <span className="font-medium text-sm flex-1">{g.noun}</span>
                                        <span className="text-xs text-muted-foreground">{idxs.filter(i => selected.has(i)).length}/{g.items.length}</span>
                                        <button onClick={() => toggleGroup(type, idxs)} className="text-xs text-muted-foreground hover:text-foreground">
                                            {allOn ? "เอาออกหมด" : "เลือกหมด"}
                                        </button>
                                    </div>
                                    {!isCollapsed && (
                                        <div className="divide-y">
                                            {g.items.map(({ p, idx }) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => toggle(idx)}
                                                    className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-muted/30"
                                                >
                                                    <span className={cn(
                                                        "mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                                        selected.has(idx) ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                                                    )}>
                                                        {selected.has(idx) && <Check className="h-3 w-3" />}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium text-sm">{p.title}</div>
                                                        {p.details.length > 0 && (
                                                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                                {p.details.map(d => `${d.label}: ${d.value}`).join(" · ")}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

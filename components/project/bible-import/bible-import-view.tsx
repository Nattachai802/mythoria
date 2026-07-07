"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sparkles, Check, ChevronDown, ChevronRight, Upload } from "lucide-react"
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
                    <Textarea
                        value={markdown}
                        onChange={e => setMarkdown(e.target.value)}
                        placeholder="วางเอกสาร Story Bible (markdown) ที่นี่… แบ่งหัวข้อด้วย ## — AI จะสกัด ตัวละคร ตระกูล ผี ของ พลัง ปม ออกมาให้ review ก่อนสร้าง"
                        className="min-h-[280px] font-mono text-xs"
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

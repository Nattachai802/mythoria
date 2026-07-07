"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { WorldSystem, WorldSystemEntry } from "@/db/schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, ChevronDown, ChevronRight, Network, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
    createWorldSystem, updateWorldSystem, deleteWorldSystem,
} from "@/server/world-systems"

const CATEGORIES: Record<string, string> = {
    rank: "บันได (ยศ)",
    hierarchy: "ลำดับชั้น",
    taxonomy: "จำแนก",
    org: "องค์กร",
    ruleset: "กฎ",
    process: "กระบวนการ",
}

// คอลัมน์ + ตัวอย่างเริ่มต้นต่อหมวด — เริ่มใช้ได้เลยไม่ต้องเจอหน้าจอเปล่า
const CATEGORY_PRESET: Record<string, { hint: string; attrKeys: string[]; example: string }> = {
    rank: { hint: "เช่น ยศ, เลเวล, ขั้นการฝึก — เรียงจากต่ำไปสูง", attrKeys: ["EN", "ระดับ"], example: "ชั้นเบิกเนตร" },
    hierarchy: { hint: "เช่น ลำดับชั้นผี, สายบังคับบัญชา", attrKeys: ["ลักษณะ", "ระดับ"], example: "สัมภเวสี" },
    taxonomy: { hint: "เช่น ธาตุ, เผ่าพันธุ์, อาชีพ, ประเภท", attrKeys: ["ประเภท", "จุดเด่น"], example: "ธาตุไฟ" },
    org: { hint: "เช่น ตระกูล, สำนัก, ชมรม, กิลด์", attrKeys: ["หัวหน้า", "สมาชิก"], example: "สุริยรังสรรค์" },
    ruleset: { hint: "เช่น กฎการใช้พลัง, ข้อจำกัด", attrKeys: ["เงื่อนไข", "ผล"], example: "ไฟย้อนกลับ" },
    process: { hint: "เช่น ขั้นตอนปราบผี, พิธีกรรม — เรียงเป็นขั้น", attrKeys: ["ผู้ทำ", "ผล"], example: "รับแจ้งเหตุ" },
}

interface Props {
    systems: WorldSystem[]
    novelId: string
    onRefresh?: () => void
}

export function SystemsView({ systems, novelId, onRefresh }: Props) {
    const router = useRouter()
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState("")
    const [newCategory, setNewCategory] = useState("rank")

    const refresh = () => (onRefresh ? onRefresh() : router.refresh())

    const handleCreate = async () => {
        if (!newName.trim()) { toast.error("ใส่ชื่อระบบก่อน"); return }
        const ordered = newCategory === "rank" || newCategory === "hierarchy" || newCategory === "process"
        const preset = CATEGORY_PRESET[newCategory]
        const res = await createWorldSystem({
            novelId, name: newName.trim(), category: newCategory, ordered,
            attrKeys: preset?.attrKeys ?? [],
            entries: [{ label: "", order: 0, note: "", attrs: {} }], // แถวแรกว่างให้พิมพ์ได้ทันที
        })
        if (res.success) { setNewName(""); setCreating(false); toast.success("เพิ่มระบบแล้ว"); refresh() }
        else toast.error(res.error || "ผิดพลาด")
    }

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{systems.length} ระบบ</span>
                {!creating && (
                    <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />เพิ่มระบบ
                    </Button>
                )}
            </div>

            {creating && (
                <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
                    <div className="flex gap-2 items-center">
                        <Input
                            autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleCreate()}
                            placeholder="ชื่อระบบ… เช่น ยศ กปธ." className="h-9 flex-1"
                        />
                        <Select value={newCategory} onValueChange={setNewCategory}>
                            <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleCreate}>เพิ่ม</Button>
                        <Button size="sm" variant="ghost" onClick={() => setCreating(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {CATEGORY_PRESET[newCategory]?.hint}
                        {CATEGORY_PRESET[newCategory] && (
                            <span className="ml-1">· คอลัมน์เริ่มต้น: {CATEGORY_PRESET[newCategory].attrKeys.join(", ")}</span>
                        )}
                    </p>
                </div>
            )}

            {systems.length === 0 && !creating && (
                <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-lg mb-1">ยังไม่มีระบบ</p>
                    <p className="text-sm">เก็บ ยศ · ลำดับชั้น · taxonomy · องค์กร ที่ไม่ใช่ตัวละคร/สถานที่เดี่ยวๆ</p>
                </div>
            )}

            <div className="space-y-2">
                {systems.map(sys => (
                    <SystemCard key={sys.id} system={sys} novelId={novelId} onChanged={refresh} />
                ))}
            </div>
        </div>
    )
}

function SystemCard({ system, novelId, onChanged }: { system: WorldSystem; novelId: string; onChanged: () => void }) {
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [addingCol, setAddingCol] = useState(false)
    const [newCol, setNewCol] = useState("")
    const [desc, setDesc] = useState(system.description ?? "")
    const [attrKeys, setAttrKeys] = useState<string[]>((system.attrKeys as string[]) ?? [])
    const [entries, setEntries] = useState<WorldSystemEntry[]>((system.entries as WorldSystemEntry[]) ?? [])

    const dirty =
        desc !== (system.description ?? "") ||
        JSON.stringify(attrKeys) !== JSON.stringify(system.attrKeys ?? []) ||
        JSON.stringify(entries) !== JSON.stringify(system.entries ?? [])

    const save = async () => {
        setSaving(true)
        const res = await updateWorldSystem(system.id, novelId, { description: desc, attrKeys, entries })
        setSaving(false)
        if (res.success) { toast.success("บันทึกแล้ว"); onChanged() }
        else toast.error(res.error || "ผิดพลาด")
    }

    const del = async () => {
        const res = await deleteWorldSystem(system.id, novelId)
        if (res.success) { toast.success("ลบแล้ว"); onChanged() }
        else toast.error(res.error || "ผิดพลาด")
    }

    const addEntry = () =>
        setEntries(prev => [...prev, { label: "", order: prev.length, note: "", attrs: {} }])
    const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i))
    const setEntry = (i: number, patch: Partial<WorldSystemEntry>) =>
        setEntries(prev => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
    const setAttr = (i: number, key: string, val: string) =>
        setEntries(prev => prev.map((e, idx) => (idx === i ? { ...e, attrs: { ...e.attrs, [key]: val } } : e)))

    const addColumn = () => {
        const name = newCol.trim()
        if (name && !attrKeys.includes(name)) setAttrKeys(prev => [...prev, name])
        setNewCol("")
        setAddingCol(false)
    }
    const removeColumn = (key: string) => {
        setAttrKeys(prev => prev.filter(k => k !== key))
        setEntries(prev => prev.map(e => {
            const { [key]: _drop, ...rest } = e.attrs
            return { ...e, attrs: rest }
        }))
    }

    return (
        <div className="border rounded-lg bg-card/50">
            {/* header */}
            <div className="flex items-center gap-2 p-3">
                <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <Network className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{system.name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {CATEGORIES[system.category] ?? system.category}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{entries.length} รายการ</span>
                </button>
                {dirty && (
                    <Button size="sm" className="h-7" disabled={saving} onClick={save}>บันทึก</Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={del}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {open && (
                <div className="border-t p-3 space-y-3">
                    <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="คำอธิบายระบบ…" className="h-8 text-sm" />

                    {/* entries table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="text-[11px] text-muted-foreground text-left">
                                    {system.ordered && <th className="w-6 py-1 font-normal">#</th>}
                                    <th className="py-1 font-normal min-w-[120px]">รายการ</th>
                                    {attrKeys.map(k => (
                                        <th key={k} className="py-1 font-normal min-w-[90px]">
                                            <span className="inline-flex items-center gap-1">
                                                {k}
                                                <button onClick={() => removeColumn(k)} className="text-muted-foreground hover:text-destructive">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        </th>
                                    ))}
                                    <th className="w-28 py-1 font-normal">
                                        {addingCol ? (
                                            <input
                                                autoFocus value={newCol}
                                                onChange={e => setNewCol(e.target.value)}
                                                onKeyDown={e => { if (e.key === "Enter") addColumn(); if (e.key === "Escape") { setNewCol(""); setAddingCol(false) } }}
                                                onBlur={addColumn}
                                                placeholder="ชื่อคอลัมน์"
                                                className="w-24 bg-background border rounded px-1.5 py-0.5 text-xs outline-none"
                                            />
                                        ) : (
                                            <button onClick={() => setAddingCol(true)} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
                                                <Plus className="h-3 w-3" />คอลัมน์
                                            </button>
                                        )}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e, i) => (
                                    <tr key={i} className="border-t border-border/50 group">
                                        {system.ordered && <td className="py-1 pr-1 text-muted-foreground tabular-nums text-xs">{i + 1}</td>}
                                        <td className="py-1 pr-2">
                                            <input
                                                value={e.label} onChange={ev => setEntry(i, { label: ev.target.value })}
                                                placeholder="ชื่อรายการ"
                                                className="w-full bg-transparent border-0 outline-none focus:bg-muted/50 rounded px-1 py-0.5"
                                            />
                                        </td>
                                        {attrKeys.map(k => (
                                            <td key={k} className="py-1 pr-2">
                                                <input
                                                    value={e.attrs[k] ?? ""} onChange={ev => setAttr(i, k, ev.target.value)}
                                                    className="w-full bg-transparent border-0 outline-none focus:bg-muted/50 rounded px-1 py-0.5 text-muted-foreground"
                                                />
                                            </td>
                                        ))}
                                        <td className="py-1 text-right">
                                            <button onClick={() => removeEntry(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <Button size="sm" variant="ghost" className="h-7 text-xs w-full border border-dashed" onClick={addEntry}>
                        <Plus className="h-3 w-3 mr-1" />เพิ่มรายการ
                    </Button>
                </div>
            )}
        </div>
    )
}

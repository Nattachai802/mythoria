"use client"

import { useState, useTransition, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Users, User, Plus, Check, Shield, Loader2, UserCheck, UsersRound, Search,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { upsertSceneElementDetail } from "@/server/scene-element-details"
import { getNovelDummyParticipants, getNearbyParticipants, type SceneDummies, type NearbyParticipants } from "@/server/timeline"
import {
    PARTICIPANT_KINDS, PARTICIPANT_KEYS, PARTICIPANT_TYPES, kindOf, isDummyType as isDummyKind,
    flattenSystemEntries, type ParticipantKindKey,
} from "@/lib/participant-types"
import { SceneElementDetails } from "@/db/schema"

export const ROLES = [
    { value: "protagonist", label: "ตัวหลัก/ผู้ร่วมมือ", cls: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { value: "antagonist", label: "ฝ่ายตรงข้าม", cls: "text-red-500 bg-red-500/10 border-red-500/20" },
    { value: "witness", label: "ผู้เห็นเหตุการณ์", cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { value: "victim", label: "ผู้รับเคราะห์/เหยื่อ", cls: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
]


interface Props {
    ideaItem: any // canvas item ที่เป็น idea (มี children)
    sceneId: string
    novelId: string
    characters: any[]
    factions: any[]
    powers?: any[]
    items?: any[]
    entities?: any[]
    worldSystems?: any[]
    onAddChild: (ideaId: string, child: any) => void
    onDetailSaved: (detail: SceneElementDetails) => void
}

export function SceneParticipantsPanel({
    ideaItem, sceneId, novelId, characters, factions, powers = [], items = [], entities = [], worldSystems = [],
    onAddChild, onDetailSaved,
}: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Add form
    const [partType, setPartType] = useState<ParticipantKindKey | "dummy_character" | "dummy_faction">("character")
    const [selectedEntityId, setSelectedEntityId] = useState("")
    const [dummyName, setDummyName] = useState("")
    const [action, setAction] = useState("")
    const [role, setRole] = useState("protagonist")
    const [showAllPicks, setShowAllPicks] = useState(false)



    // รายการให้เลือกตามชนิดที่เลือกอยู่ — ที่เดียว กันหลุดเวลาเพิ่มชนิดใหม่
    // แหล่งข้อมูลของแต่ละชนิด — ที่เดียว เพิ่มชนิดใหม่แก้ตรงนี้จุดเดียว
    const SOURCES: Record<string, any[]> = {
        character: characters, faction: factions, entity: entities,
        power: powers, item: items,
        // ระบบโลกผูก "ระดับ" ไม่ใช่ตัวระบบ (ดู lib/participant-types.ts)
        system: flattenSystemEntries(worldSystems),
    }
    const entityList = (t: string) => SOURCES[t] ?? []

    const participants = (ideaItem.children || []).filter((c: any) => PARTICIPANT_TYPES.includes(c.type))
    const isDummyType = isDummyKind(partType)
    const cfg = kindOf(partType)

    // dummy จากฉากอื่นในนิยาย (จัดกลุ่มตามฉาก) — ไว้ reuse: เลือกฉาก → เลือก dummy
    const [dummyScenes, setDummyScenes] = useState<SceneDummies[]>([])
    useEffect(() => {
        if (!open) return
        getNovelDummyParticipants(novelId).then(res => { if (res.success) setDummyScenes(res.data) })
    }, [open, novelId])

    // ผู้เข้าร่วมที่ควรเสนอให้กดเร็ว — 2 ฉากก่อนหน้ามาก่อน แล้วค่อยความถี่ทั้งเล่ม
    const [nearby, setNearby] = useState<NearbyParticipants>({ recentIds: [], recentDummyTitles: [], frequentIds: [] })
    useEffect(() => {
        if (!open) return
        getNearbyParticipants(novelId, sceneId).then(res => { if (res.success) setNearby(res.data) })
    }, [open, novelId, sceneId])

    // จัดอันดับสองชั้น: อยู่ใน 2 ฉากก่อนหน้า (ใกล้สุดก่อน) → ใช้บ่อยทั้งเล่ม → ที่เหลือ
    // เติมด้วยตัวที่ยังไม่เคยใช้จนครบ 8 เพื่อให้นิยายใหม่ที่ยังไม่มีสถิติไม่เจอแถวว่าง
    const quickPicks = (() => {
        if (isDummyType) return []
        const list = entityList(partType)
        const recent = new Map(nearby.recentIds.map((id, i) => [id, i]))
        const frequent = new Map(nearby.frequentIds.map((id, i) => [id, i]))
        const rank = (id: string) =>
            recent.has(id) ? recent.get(id)! : 1000 + (frequent.get(id) ?? 999)
        return [...list]
            .sort((a, b) => rank(a.id) - rank(b.id))
            .slice(0, 8)
            .map(e => ({ ...e, isRecent: recent.has(e.id) }))
    })()

    // dummy นับคนละทาง — elementId ของ dummy เป็น uuid ใหม่ทุกครั้งที่กดเพิ่ม นับจากตารางไม่ได้
    // ต้องนับจาก "ชื่อ" ว่าโผล่ในกี่ฉาก (dummyScenes เก็บชื่อไม่ซ้ำต่อฉากมาให้แล้ว)
    const dummyQuickPicks = (() => {
        if (!isDummyType) return []
        const uses = new Map<string, number>()
        for (const s of dummyScenes) {
            for (const d of s.dummies) {
                if (d.type !== partType) continue
                uses.set(d.title, (uses.get(d.title) ?? 0) + 1)
            }
        }
        const recent = new Map(nearby.recentDummyTitles.map((t, i) => [t, i]))
        return [...uses.entries()]
            .map(([title, scenes]) => ({ title, scenes, isRecent: recent.has(title) }))
            .sort((a, b) =>
                (recent.get(a.title) ?? 1000 + (999 - a.scenes)) - (recent.get(b.title) ?? 1000 + (999 - b.scenes))
                || a.title.localeCompare(b.title))
            .slice(0, 8)
    })()

    const handleAdd = (entity?: { id: string; name: string }) => {
        let title = ""
        let referenceId: string | null = null
        if (!isDummyType) {
            const pickedId = entity?.id ?? selectedEntityId
            if (!pickedId) {
                toast.error("กรุณาเลือกรายการก่อน")
                return
            }
            const list = entityList(partType)
            title = entity?.name ?? list.find(e => e.id === pickedId)?.name ?? ""
            referenceId = pickedId
            if (participants.some((p: any) => p.referenceId === pickedId)) {
                toast.error("มีผู้เข้าร่วมนี้ในไอเดียแล้ว")
                return
            }
        } else {
            if (!dummyName.trim()) {
                toast.error("กรุณากรอกชื่อ Dummy")
                return
            }
            title = dummyName.trim()
        }

        const child = {
            id: crypto.randomUUID(),
            type: partType,
            referenceId,
            title,
            content: "",
            role,
        }

        startTransition(async () => {
            onAddChild(ideaItem.id, child)

            // บันทึก role/action/outcome ลง scene_element_details
            const res = await upsertSceneElementDetail({
                sceneId,
                elementType: partType,
                elementId: referenceId || child.id,
                canvasItemId: ideaItem.id,
                action: action.trim() || undefined,
                role,
                novelId,
            })
            if (res.success && res.data) {
                onDetailSaved(res.data)
                toast.success("เพิ่มผู้เข้าร่วมแล้ว")
            } else {
                toast.error(res.error || "บันทึกรายละเอียดไม่สำเร็จ")
            }

            setDummyName("")
            setSelectedEntityId("")
            setAction("")
        })
    }

    /** ยกชื่อชั่วคราวจากฉากอื่นมาหลายชื่อในครั้งเดียว — ใช้บทบาทที่เลือกไว้ในฟอร์ม, ยังไม่ใส่ action */
    const handleAddMany = (titles: string[]) => {
        const existing = new Set(participants.map((p: any) => p.title))
        const fresh = titles.filter(t => !existing.has(t))
        if (fresh.length === 0) {
            toast.error("ชื่อที่เลือกอยู่ในไอเดียนี้แล้ว")
            return
        }

        // ponytail: เพิ่มลง state ให้ครบก่อนใน tick เดียว (React batch ให้) แล้วค่อย await ยิง DB
        // ถ้าสลับ onAddChild กับ await ในลูป transition จะถูก replay แล้ว prev.map() คืน array ใหม่ทุกรอบ
        // → items เปลี่ยน identity ทุก render → effect ที่ผูกกับ items วนจน React ตัดที่ 50 (#185)
        const children = fresh.map(title => ({
            id: crypto.randomUUID(),
            type: partType,
            referenceId: null,
            title,
            content: "",
            role,
        }))
        children.forEach(child => onAddChild(ideaItem.id, child))

        startTransition(async () => {
            let saved = 0
            for (const child of children) {
                const res = await upsertSceneElementDetail({
                    sceneId,
                    elementType: partType,
                    elementId: child.id,
                    canvasItemId: ideaItem.id,
                    role,
                    novelId,
                })
                if (res.success && res.data) {
                    onDetailSaved(res.data)
                    saved++
                }
            }

            if (saved === fresh.length) toast.success(`เพิ่ม ${saved} รายชื่อแล้ว`)
            else toast.warning(`เพิ่มได้ ${saved} จาก ${fresh.length} รายชื่อ`)
        })
    }

    const Chip = ({ already, recent, label, tip, onClick }: { already: boolean; recent: boolean; label: string; tip: string; onClick: () => void }) => (
                        <button
                            type="button"
                            disabled={already || isPending}
                            onClick={onClick}
                            title={already ? "อยู่ในไอเดียนี้แล้ว" : tip}
                            className={cn(
                                "chamfered-sm border px-2 py-1 text-[11px] max-w-[150px] inline-flex items-center gap-1 min-h-[26px] transition-colors",
                                already
                                    ? "border-transparent bg-muted/40 text-muted-foreground/60 cursor-default"
                                    : recent
                                        ? "border-[var(--forge-amber)]/60 bg-amber-500/15 text-foreground hover:bg-amber-500/25"
                                        : "border-border bg-card hover:border-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                            )}
                        >
                            {already ? <Check className="w-2.5 h-2.5 shrink-0" /> : <Plus className="w-2.5 h-2.5 shrink-0" />}
                            <span className="truncate">{label}</span>
                        </button>
                    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="เพิ่มตัวละคร / กลุ่มฝ่าย / พลัง / ของ เข้าไอเดียนี้"
                    className={cn(
                        // เข้าชุดกับปุ่ม "เพิ่มโน้ต" ในไดอะล็อกเดียวกัน — เส้นประ เต็มความกว้าง มีป้ายกำกับ
                        // (เดิมเป็นปุ่มไอคอนสี่เหลี่ยมลอยเดี่ยว ไม่มีป้าย เดาไม่ออกว่ากดแล้วเพิ่มอะไร)
                        "flex w-full items-center justify-center gap-1 rounded-md border border-dashed px-2 py-1.5 text-xs transition-colors min-h-[34px] pointer-coarse:min-h-[44px]",
                        "border-[var(--forge-amber)]/30 text-[var(--forge-amber)]/80 hover:border-[var(--forge-amber)]/50 hover:bg-amber-500/5 hover:text-[var(--forge-amber)]"
                    )}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Plus className="w-3 h-3" />
                    {participants.length > 0 ? `เพิ่มผู้เข้าร่วม (${participants.length})` : "เพิ่มผู้เข้าร่วม"}
                </button>
            </PopoverTrigger>
            <PopoverContent
                // ตัวไดอะล็อกไอเดียเป็นแผงชิดขอบขวา — ออกซ้ายจึงไม่บังตัวเอง
                // ถ้าซ้ายไม่พอ Radix พลิกไปขวาเองอัตโนมัติ
                side="left"
                align="start"
                sideOffset={8}
                className="w-[340px] p-0 overflow-hidden flex flex-col max-h-[var(--radix-popover-content-available-height)]"
                collisionPadding={12}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Header — ชื่อไอเดียแยกบรรทัด ไม่โดนตัด */}
                <div className="shrink-0 flex items-start gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                    <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--forge-amber)]" />
                    <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-100">เพิ่มผู้เข้าร่วม</p>
                        <p className="truncate text-[11px] text-zinc-400" title={ideaItem.title}>
                            ไอเดีย: {ideaItem.title}{participants.length > 0 ? ` · มีแล้ว ${participants.length}` : ""}
                        </p>
                    </div>
                </div>

                <div className="p-4 space-y-4 flex-1 min-h-0 overflow-y-auto">
                    {/* ชนิด — เห็นครบทุกตัวเลือก ไม่ต้องเปิด dropdown */}
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground/80">ชนิด</p>
                        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="ชนิดผู้เข้าร่วม">
                            {[...PARTICIPANT_KEYS.map(k => ({ v: k as typeof partType, l: PARTICIPANT_KINDS[k].label })), { v: "dummy_character" as const, l: "ชั่วคราว" }].map(o => {
                                const on = o.v === "dummy_character" ? isDummyType : partType === o.v
                                return (
                                    <button
                                        key={o.v}
                                        type="button"
                                        role="radio"
                                        aria-checked={on}
                                        onClick={() => { if (!on) { setPartType(o.v); setSelectedEntityId("") } }}
                                        className={cn(
                                            "chamfered-sm border px-1 py-1 text-[11px] min-h-[28px] w-full text-center truncate transition-colors cursor-pointer",
                                            on
                                                ? "border-[var(--forge-amber)] bg-[var(--forge-amber)]/15 text-foreground font-medium"
                                                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
                                        )}
                                    >
                                        {o.l}
                                    </button>
                                )
                            })}
                        </div>
                        {isDummyType && (
                            <div className="flex gap-3 text-[11px]">
                                {([["dummy_character", "ตัวละคร"], ["dummy_faction", "กลุ่มฝ่าย"]] as const).map(([v, l]) => (
                                    <label key={v} className="inline-flex cursor-pointer items-center gap-1">
                                        <input type="radio" name="dummy-kind" className="accent-[var(--forge-amber)]"
                                            checked={partType === v} onChange={() => setPartType(v)} />
                                        {l}ชั่วคราว
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ใช้บ่อย — กดครั้งเดียวเพิ่มเลยด้วยบทบาทที่ตั้งไว้ด้านล่าง */}
                    {(dummyQuickPicks.length > 0 || quickPicks.length > 0) && (
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">{isDummyType ? "ชื่อชั่วคราวที่ใช้บ่อย" : (cfg?.quickPickLabel ?? "ใช้บ่อย")}</p>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <span className="h-2 w-2 rounded-sm bg-amber-500/40 border border-[var(--forge-amber)]/60" />อยู่ในฉากก่อนหน้า
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {dummyQuickPicks.slice(0, showAllPicks ? undefined : 6).map(d => (
                                    <Chip key={d.title} label={d.title} recent={d.isRecent}
                                        already={participants.some((p: any) => p.title === d.title)}
                                        tip={`เพิ่ม ${d.title} (เคยใช้ ${d.scenes} ฉาก)`}
                                        onClick={() => handleAddMany([d.title])} />
                                ))}
                                {quickPicks.slice(0, showAllPicks ? undefined : 6).map(e => (
                                    <Chip key={e.id} label={e.name} recent={e.isRecent}
                                        already={participants.some((p: any) => p.referenceId === e.id)}
                                        tip={`เพิ่ม ${e.name} เข้าไอเดีย`}
                                        onClick={() => handleAdd({ id: e.id, name: e.name })} />
                                ))}
                                {Math.max(dummyQuickPicks.length, quickPicks.length) > 6 && (
                                    <button type="button" onClick={() => setShowAllPicks(v => !v)}
                                        className="px-1.5 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
                                        {showAllPicks ? "ย่อ" : `+${Math.max(dummyQuickPicks.length, quickPicks.length) - 6} อื่น ๆ`}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground/80">ชื่อ</p>
                        {!isDummyType ? (
                            <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                <SelectTrigger className="h-8 w-full text-xs" aria-label="ชื่อ">
                                    <SelectValue placeholder={cfg?.pickPlaceholder ?? "เลือก..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {entityList(partType).map(e => (
                                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="flex gap-1.5">
                                <Input
                                    value={dummyName}
                                    onChange={e => setDummyName(e.target.value)}
                                    onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
                                    placeholder={partType === "dummy_character" ? "เช่น ทหารยาม, ชายสวมผ้าคลุม" : "เช่น กองกำลังไม่ทราบชื่อ"}
                                    aria-label="ชื่อชั่วคราว"
                                    className="h-8 text-xs flex-1"
                                />
                                <ReuseDummyPicker
                                    scenes={dummyScenes}
                                    partType={partType}
                                    currentSceneId={sceneId}
                                    existingTitles={new Set(participants.map((p: any) => p.title))}
                                    onAddMany={handleAddMany}
                                />
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5 min-w-0">
                            <p className="text-xs font-medium text-foreground/80">บทบาท</p>
                            <Select value={role} onValueChange={setRole}>
                                <SelectTrigger className="h-8 w-full text-xs [&>span]:truncate" aria-label="บทบาท">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map(r => (
                                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 min-w-0">
                            <p className="text-xs font-medium text-foreground/80 truncate">{cfg?.actionLabel ?? "ทำอะไรในซีนนี้"}</p>
                            <Input
                                value={action}
                                onChange={e => setAction(e.target.value)}
                                placeholder={cfg?.actionPlaceholder || "เช่น ขวางทางเข้า"}
                                aria-label={cfg?.actionLabel ?? "ทำอะไรในซีนนี้"}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
                </div>
                <div className="border-t border-border p-3 shrink-0">
                    <Button size="sm" className="w-full h-9 gap-1.5 chamfered-sm text-sm" onClick={() => handleAdd()} disabled={isPending}>
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        เพิ่มเข้าไอเดีย
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ยก dummy ที่เคยใช้ในฉากอื่น: รวมทุกชื่อไม่ซ้ำ + ค้นหา + ติ๊กได้หลายชื่อในครั้งเดียว
function ReuseDummyPicker({ scenes, partType, currentSceneId, existingTitles, onAddMany }: {
    scenes: SceneDummies[]
    partType: string
    currentSceneId: string
    existingTitles: Set<string>
    onAddMany: (titles: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const label = partType === "dummy_faction" ? "กลุ่มฝ่าย" : "ตัวละคร"
    const Icon = partType === "dummy_faction" ? Shield : User

    // ชื่อไม่ซ้ำจากฉากอื่น พร้อมรายชื่อฉากที่เคยโผล่ — ใช้มากสุดขึ้นก่อน
    const all = (() => {
        const map = new Map<string, string[]>()
        for (const s of scenes) {
            if (s.sceneId === currentSceneId) continue
            for (const d of s.dummies) {
                if (d.type !== partType) continue
                const list = map.get(d.title) ?? []
                if (!list.includes(s.sceneTitle)) list.push(s.sceneTitle)
                map.set(d.title, list)
            }
        }
        return [...map.entries()]
            .map(([title, sceneTitles]) => ({ title, sceneTitles }))
            .sort((a, b) => b.sceneTitles.length - a.sceneTitles.length || a.title.localeCompare(b.title))
    })()
    const term = q.trim().toLowerCase()
    const shown = term ? all.filter(d => d.title.toLowerCase().includes(term)) : all
    const selectable = shown.filter(d => !existingTitles.has(d.title))
    const allShownPicked = selectable.length > 0 && selectable.every(d => picked.has(d.title))

    const reset = () => { setQ(""); setPicked(new Set()) }
    const toggle = (title: string) => setPicked(prev => {
        const next = new Set(prev)
        if (next.has(title)) next.delete(title)
        else next.add(title)
        return next
    })
    const toggleShown = () => setPicked(prev => {
        const next = new Set(prev)
        selectable.forEach(d => allShownPicked ? next.delete(d.title) : next.add(d.title))
        return next
    })
    const confirm = () => {
        onAddMany(Array.from(picked))
        reset()
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    title={"เลือก" + label + "ชั่วคราวที่เคยใช้ในฉากอื่น (หลายชื่อได้)"}
                    aria-label={"เลือก" + label + "ชั่วคราวที่เคยใช้"}
                >
                    <UsersRound className="w-3.5 h-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="border-b bg-muted/40 px-3 py-2">
                    <p className="text-xs font-medium">{label}ชั่วคราวที่เคยใช้</p>
                    <p className="text-[11px] text-muted-foreground">ติ๊กได้หลายชื่อ แล้วเพิ่มทีเดียว</p>
                </div>

                {all.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                        ยังไม่มี{label}ชั่วคราวในฉากอื่น
                    </p>
                ) : (
                    <>
                        <div className="relative border-b p-2">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                autoFocus
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder={"ค้นหา" + label + "…"}
                                aria-label={"ค้นหา" + label + "ชั่วคราว"}
                                className="h-8 pl-7 text-xs"
                            />
                        </div>
                        <div className="max-h-[260px] overflow-y-auto py-1">
                            {shown.length === 0 ? (
                                <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">ไม่พบ “{q}”</p>
                            ) : shown.map(d => {
                                const already = existingTitles.has(d.title)
                                return (
                                    <label
                                        key={d.title}
                                        className={cn(
                                            "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                                            already ? "opacity-50" : "cursor-pointer hover:bg-muted",
                                        )}
                                        title={already ? "อยู่ในไอเดียนี้แล้ว" : "เคยอยู่ใน: " + d.sceneTitles.join(", ")}
                                    >
                                        <Checkbox
                                            checked={already || picked.has(d.title)}
                                            disabled={already}
                                            onCheckedChange={() => toggle(d.title)}
                                            className="shrink-0"
                                        />
                                        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate">{d.title}</span>
                                            <span className="block truncate text-[10px] text-muted-foreground">
                                                {d.sceneTitles.length > 1 ? d.sceneTitles.length + " ฉาก · " : ""}{d.sceneTitles[0]}
                                            </span>
                                        </span>
                                        {already && <span className="shrink-0 text-[10px] text-muted-foreground">เพิ่มแล้ว</span>}
                                    </label>
                                )
                            })}
                        </div>
                        <div className="flex items-center gap-2 border-t p-2">
                            {selectable.length > 1 && (
                                <button
                                    onClick={toggleShown}
                                    className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                    {allShownPicked ? "ล้าง" : term ? "เลือกที่ค้นเจอ" : "เลือกทั้งหมด"}
                                </button>
                            )}
                            <Button size="sm" className="h-7 flex-1 text-xs" disabled={picked.size === 0} onClick={confirm}>
                                {picked.size === 0 ? "เลือกชื่อที่จะเพิ่ม" : "เพิ่ม " + picked.size + " ชื่อเข้าไอเดีย"}
                            </Button>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    )
}

// ปุ่มแปลง dummy → ตัวจริง: เลือกตัวละคร/กลุ่มฝ่ายจริงที่มีอยู่ แล้วแปลงทั้งฉาก
export function PromoteDummyButton({ dummy, characters, factions, onPromote }: {
    dummy: any
    characters: any[]
    factions: any[]
    onPromote: (dummy: any, realId: string, scope?: "scene" | "all") => void
}) {
    const isFaction = dummy.type === "dummy_faction"
    const list = isFaction ? factions : characters
    const [sel, setSel] = useState("")
    const [open, setOpen] = useState(false)
    const label = isFaction ? "กลุ่มฝ่าย" : "ตัวละคร"

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    // แสดงตลอด ไม่ซ่อนหลัง hover — เป็นทางเดียวที่แปลง dummy เป็นตัวจริงได้
                    // (และ group ของแถวในไดอะล็อกไอเดียชื่อ group/item ใช้ group-hover: เฉย ๆ ไม่ติด)
                    className="shrink-0 rounded p-0.5 text-emerald-600/70 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                    title="แปลงเป็นตัวละคร/กลุ่มฝ่ายจริง"
                    aria-label="แปลงเป็นตัวจริง"
                >
                    <UserCheck className="w-3.5 h-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-2.5 space-y-2" onClick={e => e.stopPropagation()}>
                <p className="text-[11px] text-muted-foreground leading-snug">
                    แปลง <span className="font-medium text-foreground">“{dummy.title}”</span> เป็น{label}จริง (ทั้งฉาก)
                </p>
                {list.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic py-1">ยังไม่มี{label}จริง — สร้างก่อน</p>
                ) : (
                    <>
                        <Select value={sel} onValueChange={setSel}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder={`เลือก${label}…`} /></SelectTrigger>
                            <SelectContent>
                                {list.map(e => (
                                    <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <div className="flex flex-col gap-1">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 w-full text-xs"
                                disabled={!sel}
                                onClick={() => { onPromote(dummy, sel, "scene"); setOpen(false); setSel("") }}
                            >
                                <Check className="w-3.5 h-3.5 mr-1" />เฉพาะฉากนี้
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 w-full text-xs"
                                disabled={!sel}
                                onClick={() => { onPromote(dummy, sel, "all"); setOpen(false); setSel("") }}
                            >
                                <Check className="w-3.5 h-3.5 mr-1" />ทุกฉากในนิยาย
                            </Button>
                        </div>
                    </>
                )}
            </PopoverContent>
        </Popover>
    )
}

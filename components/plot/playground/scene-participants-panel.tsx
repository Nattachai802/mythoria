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
    Users, User, Plus, Check, Shield, Loader2, UserCheck, UsersRound, ChevronLeft,
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
                {/* Header */}
                <div className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-700/60">
                    <Users className="h-3 w-3 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[9px] uppercase tracking-widest text-zinc-300 truncate">
                        เพิ่มผู้เข้าร่วม: {ideaItem.title}
                    </span>
                </div>

                <div className="p-2 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
                    {/* Add Form */}
                    <div className="bg-muted/30 p-2 rounded border border-border/40 space-y-1.5">

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 min-w-0">
                                <Select value={partType} onValueChange={(v: any) => { setPartType(v); setSelectedEntityId("") }}>
                                    <SelectTrigger className="h-8 w-full text-xs border-steel-800 [&>span]:truncate">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PARTICIPANT_KEYS.map(k => (
                                            <SelectItem key={k} value={k}>{PARTICIPANT_KINDS[k].selectLabel}</SelectItem>
                                        ))}
                                        <SelectItem value="dummy_character">ตัวละครชั่วคราว (Dummy)</SelectItem>
                                        <SelectItem value="dummy_faction">กลุ่มฝ่ายชั่วคราว (Dummy)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 min-w-0">
                                <Select value={role} onValueChange={setRole}>
                                    <SelectTrigger className="h-8 w-full text-xs border-steel-800 [&>span]:truncate">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map(r => (
                                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ชิปกดเร็วของ dummy — นับตามชื่อว่าเคยโผล่ในกี่ฉาก (ดู dummyQuickPicks) */}
                        {dummyQuickPicks.length > 0 && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-technical text-muted-foreground uppercase">
                                    ชื่อชั่วคราวที่ใช้บ่อย
                                </label>
                                <div className="flex flex-wrap gap-1">
                                    {dummyQuickPicks.map(d => {
                                        const already = participants.some((p: any) => p.title === d.title)
                                        return (
                                            <button
                                                key={d.title}
                                                type="button"
                                                disabled={already || isPending}
                                                onClick={() => handleAddMany([d.title])}
                                                title={already
                                                    ? "อยู่ในไอเดียนี้แล้ว"
                                                    : `เพิ่ม ${d.title}${d.isRecent ? " · อยู่ในฉากก่อนหน้า" : ""} (เคยใช้ ${d.scenes} ฉาก)`}
                                                className={cn(
                                                    "chamfered-sm border px-2 py-1 text-[11px] max-w-[150px] inline-flex items-center gap-1 min-h-[26px] transition-colors",
                                                    already
                                                        ? "border-border/40 bg-muted/30 text-muted-foreground/50 cursor-default"
                                                        : d.isRecent
                                                            ? "border-dashed border-[var(--forge-amber)]/50 bg-amber-500/5 text-foreground hover:border-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                                                            : "border-dashed border-border bg-muted/20 hover:border-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                                                )}
                                            >
                                                {already ? <Check className="w-2.5 h-2.5 shrink-0" /> : <Plus className="w-2.5 h-2.5 shrink-0" />}
                                                <span className="truncate">{d.title}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ชิปกดเร็ว — ใช้บ่อยอยู่ซ้ายสุด กดครั้งเดียวเพิ่มเลยด้วยบทบาท/action ที่ตั้งไว้ในฟอร์ม */}
                        {quickPicks.length > 0 && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-technical text-muted-foreground uppercase">
                                    {cfg?.quickPickLabel ?? "ใช้บ่อย"}
                                </label>
                                <div className="flex flex-wrap gap-1">
                                    {quickPicks.map(e => {
                                        const already = participants.some((p: any) => p.referenceId === e.id)
                                        return (
                                            <button
                                                key={e.id}
                                                type="button"
                                                disabled={already || isPending}
                                                onClick={() => handleAdd({ id: e.id, name: e.name })}
                                                title={already
                                                    ? "อยู่ในไอเดียนี้แล้ว"
                                                    : `เพิ่ม ${e.name} เข้าไอเดีย${e.isRecent ? " · อยู่ในฉากก่อนหน้า" : ""}`}
                                                className={cn(
                                                    "chamfered-sm border px-2 py-1 text-[11px] max-w-[150px] inline-flex items-center gap-1 min-h-[26px] transition-colors",
                                                    already
                                                        ? "border-border/40 bg-muted/30 text-muted-foreground/50 cursor-default"
                                                        : e.isRecent
                                                            ? "border-[var(--forge-amber)]/50 bg-amber-500/5 text-foreground hover:border-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                                                            : "border-border bg-card hover:border-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                                                )}
                                            >
                                                {already ? <Check className="w-2.5 h-2.5 shrink-0" /> : <Plus className="w-2.5 h-2.5 shrink-0" />}
                                                <span className="truncate">{e.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-technical text-muted-foreground uppercase">ชื่อผู้ร่วมไอเดีย</label>
                            {!isDummyType ? (
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800">
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
                                        placeholder={partType === "dummy_character" ? "เช่น ทหารยาม, ชายสวมผ้าคลุม" : "เช่น กองกำลังไม่ทราบชื่อ"}
                                        className="h-8 text-xs chamfered-sm flex-1"
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

                        <div className="space-y-1">
                            <label className="text-[10px] font-technical text-muted-foreground uppercase">{cfg?.actionLabel ?? "ทำอะไรในซีนนี้"}</label>
                            <Input
                                value={action}
                                onChange={e => setAction(e.target.value)}
                                placeholder={cfg?.actionPlaceholder ?? ""}
                                className="h-8 text-xs chamfered-sm"
                            />
                        </div>

                        <Button size="sm" variant="outline" className="w-full h-8 gap-1 chamfered-sm text-xs" onClick={() => handleAdd()} disabled={isPending}>
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            เพิ่มเข้าไอเดีย
                        </Button>
                    </div>

                </div>
            </PopoverContent>
        </Popover>
    )
}

// ยก dummy จากฉากอื่น: เลือกฉากก่อน → โชว์ dummy ในฉากนั้น → คลิกเพื่อใส่ชื่อ (UI ของเราเอง)
function ReuseDummyPicker({ scenes, partType, currentSceneId, existingTitles, onAddMany }: {
    scenes: SceneDummies[]
    partType: string
    currentSceneId: string
    existingTitles: Set<string>
    onAddMany: (titles: string[]) => void
}) {
    const [open, setOpen] = useState(false)
    const [sceneId, setSceneId] = useState<string | null>(null)
    const [picked, setPicked] = useState<Set<string>>(new Set())
    const label = partType === "dummy_faction" ? "กลุ่มฝ่าย" : "ตัวละคร"

    // ฉากอื่นที่มีชื่อชั่วคราวชนิดเดียวกับที่กำลังเพิ่ม
    const usableScenes = scenes.filter(s => s.sceneId !== currentSceneId && s.dummies.some(d => d.type === partType))
    const selected = usableScenes.find(s => s.sceneId === sceneId)
    const dummies = selected ? selected.dummies.filter(d => d.type === partType) : []
    const selectable = dummies.filter(d => !existingTitles.has(d.title))

    const reset = () => { setSceneId(null); setPicked(new Set()) }

    const toggle = (title: string) => {
        setPicked(prev => {
            const next = new Set(prev)
            if (next.has(title)) next.delete(title)
            else next.add(title)
            return next
        })
    }

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
                    className="h-7 w-7 shrink-0"
                    title={"ยก" + label + "ชั่วคราวที่เคยใช้ในฉากอื่นมาใช้ซ้ำ"}
                    aria-label={"ยก" + label + "ชั่วคราวจากฉากอื่น"}
                >
                    <UsersRound className="w-3.5 h-3.5" />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                    {selected && (
                        <button
                            onClick={reset}
                            className="text-muted-foreground hover:text-foreground"
                            title="กลับไปเลือกฉาก"
                            aria-label="กลับไปเลือกฉาก"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    )}
                    <div className="min-w-0">
                        <p className="truncate text-xs font-medium">
                            {selected ? selected.sceneTitle : "ยก" + label + "ชั่วคราวจากฉากอื่น"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {selected ? "เลือกได้หลายชื่อพร้อมกัน" : "เลือกฉากที่จะยกมาก่อน"}
                        </p>
                    </div>
                </div>

                {usableScenes.length === 0 ? (
                    <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
                        ยังไม่มี{label}ชั่วคราวในฉากอื่น
                    </p>
                ) : !selected ? (
                    // ขั้น 1: เลือกฉาก
                    <div className="max-h-[240px] overflow-y-auto py-1">
                        {usableScenes.map(s => {
                            const n = s.dummies.filter(d => d.type === partType).length
                            return (
                                <button
                                    key={s.sceneId}
                                    onClick={() => setSceneId(s.sceneId)}
                                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
                                >
                                    <span className="truncate">{s.sceneTitle}</span>
                                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{n}</span>
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    // ขั้น 2: ติ๊กชื่อในฉากนั้น — หลายชื่อพร้อมกันได้
                    <>
                        <div className="max-h-[240px] overflow-y-auto py-1">
                            {dummies.map(d => {
                                const already = existingTitles.has(d.title)
                                return (
                                    <label
                                        key={d.title}
                                        className={cn(
                                            "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors",
                                            already ? "opacity-50" : "cursor-pointer hover:bg-muted",
                                        )}
                                        title={already ? "อยู่ในไอเดียนี้แล้ว" : undefined}
                                    >
                                        <Checkbox
                                            checked={picked.has(d.title)}
                                            disabled={already}
                                            onCheckedChange={() => toggle(d.title)}
                                            className="shrink-0"
                                        />
                                        {partType === "dummy_faction"
                                            ? <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                            : <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                        <span className="truncate">{d.title}</span>
                                        {already && (
                                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">เพิ่มแล้ว</span>
                                        )}
                                    </label>
                                )
                            })}
                        </div>

                        <div className="flex items-center gap-2 border-t p-2">
                            {selectable.length > 1 && (
                                <button
                                    onClick={() => setPicked(
                                        picked.size === selectable.length ? new Set() : new Set(selectable.map(d => d.title))
                                    )}
                                    className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                    {picked.size === selectable.length ? "ล้าง" : "ทั้งฉาก"}
                                </button>
                            )}
                            <Button size="sm" className="h-7 flex-1 text-xs" disabled={picked.size === 0} onClick={confirm}>
                                {picked.size === 0 ? "เลือกชื่อที่จะยกมา" : "เพิ่ม " + picked.size + " ชื่อเข้าไอเดีย"}
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

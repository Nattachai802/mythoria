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
    Users, User, Trash2, Plus, Check, Shield, Loader2, Route, UserCheck, UsersRound, ChevronLeft,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { upsertSceneElementDetail, deleteSceneElementDetail } from "@/server/scene-element-details"
import { getNovelDummyParticipants, type SceneDummies } from "@/server/timeline"
import { SceneElementDetails } from "@/db/schema"
import { CharacterThroughLine } from "./character-through-line"

export const ROLES = [
    { value: "protagonist", label: "ตัวหลัก/ผู้ร่วมมือ", cls: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { value: "antagonist", label: "ฝ่ายตรงข้าม", cls: "text-red-500 bg-red-500/10 border-red-500/20" },
    { value: "witness", label: "ผู้เห็นเหตุการณ์", cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { value: "victim", label: "ผู้รับเคราะห์/เหยื่อ", cls: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
]

const PARTICIPANT_TYPES = ["character", "faction", "dummy_character", "dummy_faction"]

interface Props {
    ideaItem: any // canvas item ที่เป็น idea (มี children)
    sceneId: string
    novelId: string
    characters: any[]
    factions: any[]
    elementDetails?: Map<string, SceneElementDetails>
    onAddChild: (ideaId: string, child: any) => void
    onPromoteDummy?: (dummy: any, realId: string, scope?: "scene" | "all") => void
    onRemoveChild: (childId: string) => void
    onDetailSaved: (detail: SceneElementDetails) => void
}

// key format ต้องตรงกับ playground-board: canvasItemId-elementType-elementId
const detailKey = (ideaId: string, child: any) =>
    `${ideaId}-${child.type}-${child.referenceId || child.refId || child.id}`

export function SceneParticipantsPanel({
    ideaItem, sceneId, novelId, characters, factions,
    elementDetails, onAddChild, onPromoteDummy, onRemoveChild, onDetailSaved,
}: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Add form
    const [partType, setPartType] = useState<"character" | "faction" | "dummy_character" | "dummy_faction">("character")
    const [selectedEntityId, setSelectedEntityId] = useState("")
    const [dummyName, setDummyName] = useState("")
    const [action, setAction] = useState("")
    const [role, setRole] = useState("protagonist")

    // Inline edit
    const [editingChildId, setEditingChildId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ action: "", role: "protagonist" })

    // Through-line viewer (B)
    const [throughLine, setThroughLine] = useState<{ type: "character" | "faction"; id: string; name: string } | null>(null)

    const participants = (ideaItem.children || []).filter((c: any) => PARTICIPANT_TYPES.includes(c.type))
    const isDummyType = partType === "dummy_character" || partType === "dummy_faction"

    // dummy จากฉากอื่นในนิยาย (จัดกลุ่มตามฉาก) — ไว้ reuse: เลือกฉาก → เลือก dummy
    const [dummyScenes, setDummyScenes] = useState<SceneDummies[]>([])
    useEffect(() => {
        if (!open) return
        getNovelDummyParticipants(novelId).then(res => { if (res.success) setDummyScenes(res.data) })
    }, [open, novelId])

    const handleAdd = () => {
        let title = ""
        let referenceId: string | null = null
        if (!isDummyType) {
            if (!selectedEntityId) {
                toast.error("กรุณาเลือกตัวละครหรือกลุ่มฝ่าย")
                return
            }
            const list = partType === "character" ? characters : factions
            title = list.find(e => e.id === selectedEntityId)?.name || ""
            referenceId = selectedEntityId
            if (participants.some((p: any) => p.referenceId === selectedEntityId)) {
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

    const handleDelete = (child: any) => {
        startTransition(async () => {
            onRemoveChild(child.id)
            const detail = elementDetails?.get(detailKey(ideaItem.id, child))
            if (detail) {
                await deleteSceneElementDetail(detail.id, novelId, sceneId)
            }
            toast.success("ลบผู้เข้าร่วมแล้ว")
        })
    }

    const startEdit = (child: any) => {
        const detail = elementDetails?.get(detailKey(ideaItem.id, child))
        setEditingChildId(child.id)
        setEditForm({
            action: detail?.action || "",
            role: detail?.role || child.role || "protagonist",
        })
    }

    const saveEdit = (child: any) => {
        startTransition(async () => {
            const detail = elementDetails?.get(detailKey(ideaItem.id, child))
            const res = await upsertSceneElementDetail({
                id: detail?.id,
                sceneId,
                elementType: child.type,
                elementId: child.referenceId || child.refId || child.id,
                canvasItemId: ideaItem.id,
                action: editForm.action.trim() || undefined,
                role: editForm.role,
                // คงค่า field ที่ panel นี้ไม่ได้แก้ (แก้ผ่าน dialog ดินสอ)
                how: detail?.how || undefined,
                goal: detail?.goal || undefined,
                outcome: detail?.outcome || undefined,
                notes: detail?.notes || undefined,
                novelId,
            })
            if (res.success && res.data) {
                onDetailSaved(res.data)
                setEditingChildId(null)
                toast.success("อัปเดตข้อมูลผู้เข้าร่วมแล้ว")
            } else {
                toast.error("อัปเดตไม่สำเร็จ")
            }
        })
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-5 px-1 text-[8px] font-technical uppercase gap-0.5 shrink-0",
                        participants.length > 0
                            ? "text-[var(--forge-amber)] hover:text-[var(--forge-amber)]"
                            : "text-muted-foreground hover:text-primary"
                    )}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <Users className="w-2.5 h-2.5" />
                    ผู้เข้าร่วม ({participants.length})
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[300px] p-0 overflow-hidden"
                align="start"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-zinc-900 border-b border-zinc-700/60">
                    <Users className="h-3 w-3 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[9px] uppercase tracking-widest text-zinc-300 truncate">
                        ผู้เข้าร่วม: {ideaItem.title}
                    </span>
                </div>

                <div className="p-2 space-y-2.5 max-h-[65vh] overflow-y-auto">
                    {/* Add Form */}
                    <div className="bg-muted/30 p-2 rounded border border-border/40 space-y-1.5">
                        <span className="text-[9px] uppercase tracking-wide text-muted-foreground font-technical font-semibold flex items-center gap-1">
                            <Plus className="w-3 h-3 text-[var(--forge-amber)]" /> เพิ่มผู้ร่วมไอเดีย
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 min-w-0">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">ประเภท</label>
                                <Select value={partType} onValueChange={(v: any) => { setPartType(v); setSelectedEntityId("") }}>
                                    <SelectTrigger className="h-7 w-full text-xs border-steel-800 [&>span]:truncate">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="character">ตัวละครจริง</SelectItem>
                                        <SelectItem value="faction">กลุ่มฝ่ายจริง</SelectItem>
                                        <SelectItem value="dummy_character">ตัวละครชั่วคราว (Dummy)</SelectItem>
                                        <SelectItem value="dummy_faction">กลุ่มฝ่ายชั่วคราว (Dummy)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 min-w-0">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">บทบาท</label>
                                <Select value={role} onValueChange={setRole}>
                                    <SelectTrigger className="h-7 w-full text-xs border-steel-800 [&>span]:truncate">
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

                        <div className="space-y-1">
                            <label className="text-[9px] font-technical text-muted-foreground uppercase">ชื่อผู้ร่วมไอเดีย</label>
                            {!isDummyType ? (
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger className="h-7 text-xs border-steel-800">
                                        <SelectValue placeholder={partType === "character" ? "เลือกตัวละคร..." : "เลือกกลุ่มฝ่าย..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(partType === "character" ? characters : factions).map(e => (
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
                                        className="h-7 text-xs chamfered-sm flex-1"
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
                            <label className="text-[9px] font-technical text-muted-foreground uppercase">ทำอะไรในซีนนี้</label>
                            <Input
                                value={action}
                                onChange={e => setAction(e.target.value)}
                                placeholder="เช่น ลอบโจมตีเพื่อชิงหลักฐาน แต่ถูกจับได้"
                                className="h-7 text-xs chamfered-sm"
                            />
                        </div>

                        <Button size="sm" className="w-full h-7 gap-1 chamfered-sm text-xs" onClick={handleAdd} disabled={isPending}>
                            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            เพิ่มเข้าไอเดีย
                        </Button>
                    </div>

                    {/* Participants List */}
                    <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-technical font-semibold">
                            รายชื่อผู้เข้าร่วม ({participants.length})
                        </span>

                        {participants.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6 bg-muted/10 rounded border border-dashed border-border/40">
                                ยังไม่มีผู้เข้าร่วมในไอเดียนี้
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {participants.map((child: any) => {
                                    const detail = elementDetails?.get(detailKey(ideaItem.id, child))
                                    const isEditing = editingChildId === child.id
                                    const currentRole = ROLES.find(r => r.value === (detail?.role || child.role)) || ROLES[0]
                                    const isDummy = child.type === "dummy_character" || child.type === "dummy_faction"
                                    const isFaction = child.type === "faction" || child.type === "dummy_faction"
                                    const TypeIcon = isFaction ? Shield : User

                                    return (
                                        <div
                                            key={child.id}
                                            className={cn(
                                                "p-2.5 rounded border text-xs relative group transition-colors",
                                                isDummy ? "border-dashed border-border bg-muted/40" : "border-border bg-card"
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <TypeIcon className={cn("w-3.5 h-3.5 shrink-0", isDummy ? "text-muted-foreground" : isFaction ? "text-emerald-500" : "text-blue-500")} />
                                                    <span className="font-semibold text-foreground truncate">
                                                        {child.title}
                                                        {isDummy && <span className="text-[8px] text-muted-foreground ml-1">(Dummy)</span>}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className={cn("px-1.5 py-0.5 rounded-[3px] text-[8px] font-technical uppercase border tracking-wider", currentRole.cls)}>
                                                        {currentRole.label}
                                                    </span>
                                                    {!isDummy && child.referenceId && (
                                                        <button
                                                            onClick={() => setThroughLine({
                                                                type: isFaction ? "faction" : "character",
                                                                id: child.referenceId,
                                                                name: child.title,
                                                            })}
                                                            className="text-muted-foreground hover:text-[var(--forge-amber)] p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="ดูเส้นเรื่องข้ามฉาก"
                                                        >
                                                            <Route className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {isDummy && onPromoteDummy && (
                                                        <PromoteDummyButton
                                                            dummy={child}
                                                            characters={characters}
                                                            factions={factions}
                                                            onPromote={onPromoteDummy}
                                                        />
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(child)}
                                                        className="text-muted-foreground hover:text-red-500 p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="ลบ"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {isEditing ? (
                                                <div className="space-y-2 mt-2 pt-2 border-t border-border/40">
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-technical text-muted-foreground uppercase">ทำอะไรในซีนนี้</label>
                                                        <Input
                                                            value={editForm.action}
                                                            onChange={e => setEditForm({ ...editForm, action: e.target.value })}
                                                            placeholder="เช่น ลอบโจมตีเพื่อชิงหลักฐาน แต่ถูกจับได้"
                                                            className="h-6 text-xs py-0 px-1 border-steel-800"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] font-technical text-muted-foreground uppercase">บทบาท</label>
                                                        <Select value={editForm.role} onValueChange={v => setEditForm({ ...editForm, role: v })}>
                                                            <SelectTrigger className="h-6 text-xs border-steel-800">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {ROLES.map(r => (
                                                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingChildId(null)}>
                                                            ยกเลิก
                                                        </Button>
                                                        <Button size="sm" className="h-6 text-[10px] gap-0.5" onClick={() => saveEdit(child)} disabled={isPending}>
                                                            <Check className="w-3 h-3" /> บันทึก
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-[11px] text-muted-foreground space-y-1 mt-1 cursor-pointer hover:bg-muted/10 p-1 rounded transition-colors"
                                                    onClick={() => startEdit(child)}
                                                    title="คลิกเพื่อแก้ไข"
                                                >
                                                    {detail?.action ? (
                                                        <div>{detail.action}</div>
                                                    ) : (
                                                        <span className="text-[10px] italic text-muted-foreground/60">
                                                            คลิกเพื่อเพิ่มว่าทำอะไรในซีนนี้...
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>

            {throughLine && (
                <CharacterThroughLine
                    open={!!throughLine}
                    onOpenChange={(o) => !o && setThroughLine(null)}
                    novelId={novelId}
                    elementType={throughLine.type}
                    elementId={throughLine.id}
                    elementName={throughLine.name}
                    currentSceneId={sceneId}
                />
            )}
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
function PromoteDummyButton({ dummy, characters, factions, onPromote }: {
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
                    className="text-muted-foreground hover:text-emerald-500 p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                    title="แปลงเป็นตัวจริง"
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

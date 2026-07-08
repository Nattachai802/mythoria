"use client"

import { useState, useTransition } from "react"
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
    Users, User, Trash2, Plus, Check, Shield, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { upsertSceneElementDetail, deleteSceneElementDetail } from "@/server/scene-element-details"
import { SceneElementDetails } from "@/db/schema"

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
    onRemoveChild: (childId: string) => void
    onDetailSaved: (detail: SceneElementDetails) => void
}

// key format ต้องตรงกับ playground-board: canvasItemId-elementType-elementId
const detailKey = (ideaId: string, child: any) =>
    `${ideaId}-${child.type}-${child.referenceId || child.refId || child.id}`

export function SceneParticipantsPanel({
    ideaItem, sceneId, novelId, characters, factions,
    elementDetails, onAddChild, onRemoveChild, onDetailSaved,
}: Props) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    // Add form
    const [partType, setPartType] = useState<"character" | "faction" | "dummy_character" | "dummy_faction">("character")
    const [selectedEntityId, setSelectedEntityId] = useState("")
    const [dummyName, setDummyName] = useState("")
    const [action, setAction] = useState("")
    const [outcome, setOutcome] = useState("")
    const [role, setRole] = useState("protagonist")

    // Inline edit
    const [editingChildId, setEditingChildId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ action: "", outcome: "", role: "protagonist" })

    const participants = (ideaItem.children || []).filter((c: any) => PARTICIPANT_TYPES.includes(c.type))
    const isDummyType = partType === "dummy_character" || partType === "dummy_faction"

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
                outcome: outcome.trim() || undefined,
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
            setOutcome("")
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
            outcome: detail?.outcome || "",
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
                outcome: editForm.outcome.trim() || undefined,
                role: editForm.role,
                // คงค่า field ที่ panel นี้ไม่ได้แก้ (แก้ผ่าน dialog ดินสอ)
                how: detail?.how || undefined,
                goal: detail?.goal || undefined,
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
                className="w-[380px] p-0 overflow-hidden"
                align="start"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                    <Users className="h-3.5 w-3.5 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300 truncate">
                        ผู้เข้าร่วม: {ideaItem.title}
                    </span>
                </div>

                <div className="p-3 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Add Form */}
                    <div className="bg-muted/30 p-2.5 rounded border border-border/40 space-y-2.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-technical font-semibold flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-[var(--forge-amber)]" /> เพิ่มผู้ร่วมไอเดีย
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1 min-w-0">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">ประเภท</label>
                                <Select value={partType} onValueChange={(v: any) => { setPartType(v); setSelectedEntityId("") }}>
                                    <SelectTrigger className="h-8 w-full text-xs border-steel-800 [&>span]:truncate">
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

                        <div className="space-y-1">
                            <label className="text-[9px] font-technical text-muted-foreground uppercase">ชื่อผู้ร่วมไอเดีย</label>
                            {!isDummyType ? (
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800">
                                        <SelectValue placeholder={partType === "character" ? "เลือกตัวละคร..." : "เลือกกลุ่มฝ่าย..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(partType === "character" ? characters : factions).map(e => (
                                            <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={dummyName}
                                    onChange={e => setDummyName(e.target.value)}
                                    placeholder={partType === "dummy_character" ? "เช่น ทหารยาม, ชายสวมผ้าคลุม" : "เช่น กองกำลังไม่ทราบชื่อ"}
                                    className="h-8 text-xs chamfered-sm"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">การกระทำ (Action)</label>
                                <Input
                                    value={action}
                                    onChange={e => setAction(e.target.value)}
                                    placeholder="เช่น ลอบโจมตี, เจรจา"
                                    className="h-8 text-xs chamfered-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">ผลที่เกิดขึ้น (Outcome)</label>
                                <Input
                                    value={outcome}
                                    onChange={e => setOutcome(e.target.value)}
                                    placeholder="เช่น พ่ายแพ้, ได้ข้อมูลลับ"
                                    className="h-8 text-xs chamfered-sm"
                                />
                            </div>
                        </div>

                        <Button size="sm" className="w-full h-8 gap-1 chamfered-sm text-xs" onClick={handleAdd} disabled={isPending}>
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
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-technical text-muted-foreground uppercase">Action</label>
                                                            <Input
                                                                value={editForm.action}
                                                                onChange={e => setEditForm({ ...editForm, action: e.target.value })}
                                                                className="h-6 text-xs py-0 px-1 border-steel-800"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[8px] font-technical text-muted-foreground uppercase">Outcome</label>
                                                            <Input
                                                                value={editForm.outcome}
                                                                onChange={e => setEditForm({ ...editForm, outcome: e.target.value })}
                                                                className="h-6 text-xs py-0 px-1 border-steel-800"
                                                            />
                                                        </div>
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
                                                    {(detail?.action || detail?.outcome) ? (
                                                        <>
                                                            {detail?.action && (
                                                                <div>
                                                                    <span className="font-semibold text-muted-foreground">ทำ:</span> {detail.action}
                                                                </div>
                                                            )}
                                                            {detail?.outcome && (
                                                                <div>
                                                                    <span className="font-semibold text-muted-foreground">เกิด:</span> {detail.outcome}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px] italic text-muted-foreground/60">
                                                            คลิกเพื่อเพิ่มการกระทำ/ผลลัพธ์...
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
        </Popover>
    )
}

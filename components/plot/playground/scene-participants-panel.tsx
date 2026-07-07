"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
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
    Users, User, Crown, Trash2, Plus, Check, X, Shield,
    Swords, HelpCircle, Loader2, Sparkles
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { addSceneParticipant, updateSceneParticipant, deleteSceneParticipant } from "@/server/timeline"

// Define TypeScript interfaces for our props
interface SceneParticipantWithRelations {
    id: string
    eventId: string
    novelId: string
    characterId: string | null
    factionId: string | null
    dummyName: string | null
    dummyType: string | null
    action: string | null
    outcome: string | null
    role: string | null
    character?: { id: string; name: string } | null
    faction?: { id: string; name: string } | null
}

interface Props {
    eventId: string
    novelId: string
    characters: any[]
    factions: any[]
    initialParticipants: SceneParticipantWithRelations[]
}

const ROLES = [
    { value: "protagonist", label: "ตัวหลัก/ผู้ร่วมมือ", cls: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { value: "antagonist", label: "ฝ่ายตรงข้าม", cls: "text-red-500 bg-red-500/10 border-red-500/20" },
    { value: "witness", label: "ผู้เห็นเหตุการณ์", cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { value: "victim", label: "ผู้รับเคราะห์/เหยื่อ", cls: "text-purple-500 bg-purple-500/10 border-purple-500/20" },
]

export function SceneParticipantsPanel({ eventId, novelId, characters, factions, initialParticipants }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [participants, setParticipants] = useState<SceneParticipantWithRelations[]>(initialParticipants)

    // Form states
    const [partType, setPartType] = useState<"character" | "faction" | "dummy_char" | "dummy_fact">("character")
    const [selectedEntityId, setSelectedEntityId] = useState<string>("")
    const [dummyName, setDummyName] = useState("")
    const [action, setAction] = useState("")
    const [outcome, setOutcome] = useState("")
    const [role, setRole] = useState("protagonist")

    // Editing states
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState({ action: "", outcome: "", dummyName: "" })

    // Sync with initialParticipants prop changes
    useEffect(() => {
        setParticipants(initialParticipants)
    }, [initialParticipants])

    const handleAdd = () => {
        if (partType === "character" || partType === "faction") {
            if (!selectedEntityId) {
                toast.error("กรุณาเลือกตัวละครหรือกลุ่มฝ่าย")
                return
            }
        } else {
            if (!dummyName.trim()) {
                toast.error("กรุณากรอกชื่อ Dummy")
                return
            }
        }

        startTransition(async () => {
            const payload = {
                eventId,
                novelId,
                characterId: partType === "character" ? selectedEntityId : null,
                factionId: partType === "faction" ? selectedEntityId : null,
                dummyName: (partType === "dummy_char" || partType === "dummy_fact") ? dummyName.trim() : null,
                dummyType: partType === "dummy_char" ? "character" : partType === "dummy_fact" ? "faction" : null,
                action: action.trim() || null,
                outcome: outcome.trim() || null,
                role,
            }

            const res = await addSceneParticipant(payload)
            if (res.success && res.data) {
                toast.success("เพิ่มผู้เข้าร่วมแล้ว")
                
                // Construct mock relation for immediate UI render before revalidation
                let entityName = ""
                if (partType === "character") {
                    entityName = characters.find(c => c.id === selectedEntityId)?.name || ""
                } else if (partType === "faction") {
                    entityName = factions.find(f => f.id === selectedEntityId)?.name || ""
                }

                const newPart: SceneParticipantWithRelations = {
                    ...res.data,
                    character: partType === "character" ? { id: selectedEntityId, name: entityName } : null,
                    faction: partType === "faction" ? { id: selectedEntityId, name: entityName } : null,
                }

                setParticipants(prev => [...prev, newPart])

                // Reset form
                setDummyName("")
                setSelectedEntityId("")
                setAction("")
                setOutcome("")
                router.refresh()
            } else {
                toast.error(res.error || "ไม่สามารถเพิ่มได้")
            }
        })
    }

    const handleDelete = (id: string) => {
        startTransition(async () => {
            const res = await deleteSceneParticipant(id, novelId, eventId)
            if (res.success) {
                setParticipants(prev => prev.filter(p => p.id !== id))
                toast.success("ลบผู้เข้าร่วมแล้ว")
                router.refresh()
            } else {
                toast.error("ลบไม่สำเร็จ")
            }
        })
    }

    const startEdit = (p: SceneParticipantWithRelations) => {
        setEditingId(p.id)
        setEditForm({
            action: p.action || "",
            outcome: p.outcome || "",
            dummyName: p.dummyName || "",
        })
    }

    const saveEdit = (id: string) => {
        startTransition(async () => {
            const res = await updateSceneParticipant(id, editForm, novelId, eventId)
            if (res.success) {
                setParticipants(prev => prev.map(p => {
                    if (p.id === id) {
                        return {
                            ...p,
                            action: editForm.action.trim() || null,
                            outcome: editForm.outcome.trim() || null,
                            dummyName: p.dummyName ? (editForm.dummyName.trim() || p.dummyName) : null
                        }
                    }
                    return p
                }))
                setEditingId(null)
                toast.success("อัปเดตข้อมูลผู้เข้าร่วมแล้ว")
                router.refresh()
            } else {
                toast.error("อัปเดตไม่สำเร็จ")
            }
        })
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-8 gap-1.5 chamfered-sm font-technical text-[9px] uppercase tracking-[0.08em]",
                        participants.length > 0 && "border-[var(--forge-amber)]/50 text-[var(--forge-amber)]"
                    )}
                >
                    <Users className="h-3.5 w-3.5" />
                    ผู้เข้าร่วมฉาก ({participants.length})
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0 overflow-hidden" align="start">
                {/* Header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                    <Users className="h-3.5 w-3.5 text-[var(--forge-amber)]" />
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300">
                        ผู้เข้าร่วมและการกระทำในฉาก
                    </span>
                </div>

                <div className="p-3 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* Add Form */}
                    <div className="bg-muted/30 p-2.5 rounded border border-border/40 space-y-2.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-technical font-semibold flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5 text-[var(--forge-amber)]" /> เพิ่มผู้ร่วมฉาก
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                            {/* Type Select */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">ประเภท</label>
                                <Select value={partType} onValueChange={(v: any) => { setPartType(v); setSelectedEntityId("") }}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="character">ตัวละครจริง</SelectItem>
                                        <SelectItem value="faction">กลุ่มฝ่ายจริง</SelectItem>
                                        <SelectItem value="dummy_char">ตัวละครชั่วคราว (Dummy)</SelectItem>
                                        <SelectItem value="dummy_fact">กลุ่มฝ่ายชั่วคราว (Dummy)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Role Select */}
                            <div className="space-y-1">
                                <label className="text-[9px] font-technical text-muted-foreground uppercase">บทบาท</label>
                                <Select value={role} onValueChange={setRole}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ROLES.map(r => (
                                            <SelectItem key={r.value} value={r.value}>
                                                {r.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Entity Selector or Dummy Input */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-technical text-muted-foreground uppercase">ชื่อผู้ร่วมฉาก</label>
                            {partType === "character" ? (
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800">
                                        <SelectValue placeholder="เลือกตัวละคร..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {characters.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : partType === "faction" ? (
                                <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
                                    <SelectTrigger className="h-8 text-xs border-steel-800">
                                        <SelectValue placeholder="เลือกกลุ่มฝ่าย..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {factions.map(f => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={dummyName}
                                    onChange={e => setDummyName(e.target.value)}
                                    placeholder={partType === "dummy_char" ? "เช่น ทหารยาม, ชายสวมผ้าคลุม" : "เช่น กองกำลังไม่ทราบชื่อ"}
                                    className="h-8 text-xs chamfered-sm"
                                />
                            )}
                        </div>

                        {/* Action & Outcome Inputs */}
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
                            เพิ่มเข้าฉาก
                        </Button>
                    </div>

                    {/* Participants List */}
                    <div className="space-y-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-technical font-semibold">
                            รายชื่อผู้เข้าร่วม ({participants.length})
                        </span>

                        {participants.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6 bg-muted/10 rounded border border-dashed border-border/40">
                                ยังไม่มีผู้เข้าร่วมในฉากนี้
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {participants.map(p => {
                                    const isEditing = editingId === p.id
                                    const currentRole = ROLES.find(r => r.value === p.role) || ROLES[0]
                                    
                                    // Resolve name & type icon
                                    let displayName = p.dummyName || ""
                                    let isDummy = !!p.dummyName
                                    let isFaction = p.factionId || p.dummyType === "faction"

                                    if (p.characterId && p.character) displayName = p.character.name
                                    else if (p.factionId && p.faction) displayName = p.faction.name

                                    const TypeIcon = isFaction ? Shield : User

                                    return (
                                        <div
                                            key={p.id}
                                            className={cn(
                                                "p-2.5 rounded border text-xs relative group transition-colors",
                                                isDummy ? "border-dashed border-zinc-800 bg-zinc-950/20" : "border-border bg-card"
                                            )}
                                        >
                                            {/* Top row: Name, Icon, Role Badge, Delete btn */}
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <TypeIcon className={cn("w-3.5 h-3.5", isDummy ? "text-muted-foreground" : isFaction ? "text-emerald-500" : "text-blue-500")} />
                                                    {isEditing && p.dummyName ? (
                                                        <Input
                                                            value={editForm.dummyName}
                                                            onChange={e => setEditForm({ ...editForm, dummyName: e.target.value })}
                                                            className="h-6 text-xs w-28 py-0 px-1 border-steel-800"
                                                        />
                                                    ) : (
                                                        <span className="font-semibold text-zinc-200">
                                                            {displayName}
                                                            {isDummy && <span className="text-[8px] text-muted-foreground ml-1">(Dummy)</span>}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {/* Role Badge */}
                                                    <span className={cn("px-1.5 py-0.5 rounded-[3px] text-[8px] font-technical uppercase border tracking-wider", currentRole.cls)}>
                                                        {currentRole.label}
                                                    </span>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => handleDelete(p.id)}
                                                        className="text-muted-foreground hover:text-red-500 p-0.5 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="ลบ"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Details: Action / Outcome */}
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
                                                    <div className="flex justify-end gap-1.5">
                                                        <Button size="xs" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>
                                                            ยกเลิก
                                                        </Button>
                                                        <Button size="xs" className="h-6 text-[10px] gap-0.5" onClick={() => saveEdit(p.id)} disabled={isPending}>
                                                            <Check className="w-3 h-3" /> บันทึก
                                                        </Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-[11px] text-muted-foreground space-y-1 mt-1 cursor-pointer hover:bg-muted/10 p-1 rounded transition-colors"
                                                    onClick={() => startEdit(p)}
                                                    title="คลิกเพื่อแก้ไข"
                                                >
                                                    {(p.action || p.outcome) ? (
                                                        <>
                                                            {p.action && (
                                                                <div>
                                                                    <span className="font-semibold text-zinc-400">ทำ:</span> {p.action}
                                                                </div>
                                                            )}
                                                            {p.outcome && (
                                                                <div>
                                                                    <span className="font-semibold text-zinc-400">เกิด:</span> {p.outcome}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-[10px] italic text-muted-foreground/60 flex items-center gap-0.5">
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

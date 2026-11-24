"use client"

import { useState } from "react"
import { toast } from "sonner"
import { GripVertical, Lightbulb, MoreHorizontal, X } from "lucide-react"
import { createVaultNote, type VaultNoteView } from "@/server/idea-vault"
import { cn } from "@/lib/utils"
import { effectiveScopes } from "@/components/project/idea/vault-ui"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** ชนิดข้อมูลตอนลากไอเดียแบบ native — ตัวพิมพ์เล็กล้วน เพราะเบราว์เซอร์ลดเป็นพิมพ์เล็กใน dataTransfer.types */
export const IDEA_DRAG_TYPE = "application/x-mythoria-idea"

interface Props {
    novelId: string
    notes: VaultNoteView[]
    chapters: { id: string; title: string }[]
    onAdded: (note: VaultNoteView) => void
    onPlace: (ideaId: string, chapterId: string) => void
    onClose: () => void
}

/**
 * ถาดไอเดีย (task.md 20D) — จดเร็ว ยังไม่ต้องเป็นฉาก/ปม/lore
 * แหล่งข้อมูล = คลังโน้ต (idea_vault) ที่ยังไม่ถูกใช้ · ลากลงคอลัมน์บท หรือเลือกบทจากเมนู ⋯ = สร้างฉากใหม่ในบทนั้น
 * (คัดลอกเป็นการ์ด — โน้ตยังอยู่ในคลัง) · ค่าเริ่มต้นแสดงเฉพาะโน้ตแท็กพล็อต/ฉาก หรือยังไม่ระบุแท็ก
 */
export function IdeaTray({ novelId, notes, chapters, onAdded, onPlace, onClose }: Props) {
    const [draft, setDraft] = useState("")
    const [saving, setSaving] = useState(false)
    const [all, setAll] = useState(false)
    const plotish = (n: VaultNoteView) => {
        const sc = effectiveScopes(n)
        return sc.length === 0 || sc.includes("plot") || sc.includes("scene")
    }
    const ideas = all ? notes : notes.filter(plotish)

    const add = async () => {
        const title = draft.trim()
        if (!title || saving) return
        setSaving(true)
        const res = await createVaultNote({ text: title, novelId, scopes: ["plot"] })
        setSaving(false)
        if (!res.success) { toast.error(res.error); return }
        if (res.isDuplicate) toast.info("มีโน้ตนี้อยู่แล้ว")
        else onAdded(res.data)
        setDraft("")
    }

    return (
        <aside className="flex w-[260px] shrink-0 flex-col border-r bg-background animate-in fade-in slide-in-from-left-3 duration-200 ease-out motion-reduce:animate-none" aria-label="ถาดไอเดีย">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <Lightbulb className="h-4 w-4 text-[var(--forge-amber)]" />
                <p className="flex-1 text-sm font-semibold">ถาดไอเดีย <span className="font-normal text-muted-foreground">· {ideas.length}</span></p>
                <a href={`/dashboard/project/${novelId}/idea`} className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">เปิดคลัง</a>
                <button onClick={onClose} className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90" aria-label="ปิดถาดไอเดีย">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="border-b p-3">
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
                    placeholder="จดไอเดียแล้วกด Enter"
                    disabled={saving}
                    className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30 dark:bg-input/30"
                    aria-label="จดไอเดียใหม่"
                />
                <div role="group" aria-label="แสดงโน้ต" className="mt-2 inline-flex overflow-hidden rounded-md border text-[11px]">
                    {([[false, "พล็อต/ฉาก"], [true, "ทั้งหมด"]] as const).map(([v, l]) => (
                        <button key={l} type="button" aria-pressed={all === v} onClick={() => setAll(v)}
                            className={cn("h-6 px-2 transition-colors", all === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/50")}>{l}</button>
                    ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">ลากลงคอลัมน์บท = สร้างฉาก (โน้ตยังอยู่ในคลัง)</p>
            </div>
            <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
                {ideas.length === 0 && (
                    <li className="px-2 py-6 text-center text-xs text-muted-foreground">{all ? "ยังไม่มีโน้ตที่รอใช้" : "ไม่มีโน้ตแท็กพล็อต/ฉากที่รอใช้"}</li>
                )}
                {ideas.map(idea => (
                    <li
                        key={idea.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData(IDEA_DRAG_TYPE, idea.id); e.dataTransfer.effectAllowed = "copy" }}
                        className="group flex cursor-grab items-start gap-1.5 rounded-md border bg-card px-2 py-1.5 text-sm transition-[border-color,box-shadow,translate] duration-150 active:cursor-grabbing hover:-translate-y-px hover:border-[var(--forge-amber)]/50 hover:shadow-sm motion-reduce:transition-none"
                    >
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                        <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 leading-snug">{idea.text}</p>
                            {(idea.summary || idea.body) && <p className="line-clamp-1 text-xs text-muted-foreground">{idea.summary || idea.body}</p>}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`วาง “${idea.text}” ลงบท`}>
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                                <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">ทำเป็นฉากในบท</DropdownMenuLabel>
                                {chapters.length === 0 && <DropdownMenuItem disabled>ยังไม่มีบท</DropdownMenuItem>}
                                {chapters.map(c => (
                                    <DropdownMenuItem key={c.id} onSelect={() => onPlace(idea.id, c.id)}>{c.title}</DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </li>
                ))}
            </ul>
        </aside>
    )
}

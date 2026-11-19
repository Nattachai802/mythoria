"use client"

import { useState } from "react"
import { toast } from "sonner"
import { GripVertical, Lightbulb, MoreHorizontal, X } from "lucide-react"
import type { Idea } from "@/db/schema"
import { createIdea } from "@/server/idea"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** ชนิดข้อมูลตอนลากไอเดียแบบ native — ตัวพิมพ์เล็กล้วน เพราะเบราว์เซอร์ลดเป็นพิมพ์เล็กใน dataTransfer.types */
export const IDEA_DRAG_TYPE = "application/x-mythoria-idea"

interface Props {
    novelId: string
    ideas: Idea[]
    chapters: { id: string; title: string }[]
    onAdded: (idea: Idea) => void
    onPlace: (ideaId: string, chapterId: string) => void
    onClose: () => void
}

/**
 * ถาดไอเดีย (task.md 20D) — จดเร็ว ยังไม่ต้องเป็นฉาก/ปม/lore
 * แหล่งข้อมูล = ตาราง ideas ที่ยังไม่ถูกวางที่ไหน (isUsed = false) · ลากลงคอลัมน์บท หรือเลือกบทจากเมนู ⋯ = สร้างฉากใหม่ในบทนั้น
 */
export function IdeaTray({ novelId, ideas, chapters, onAdded, onPlace, onClose }: Props) {
    const [draft, setDraft] = useState("")
    const [saving, setSaving] = useState(false)

    const add = async () => {
        const title = draft.trim()
        if (!title || saving) return
        setSaving(true)
        const res = await createIdea({ title, novelId })
        setSaving(false)
        if (!res.success || !res.data) { toast.error("จดไอเดียไม่สำเร็จ"); return }
        if ((res as { isDuplicate?: boolean }).isDuplicate) toast.info("มีไอเดียชื่อนี้อยู่แล้ว")
        else onAdded(res.data as Idea)
        setDraft("")
    }

    return (
        <aside className="flex w-[260px] shrink-0 flex-col border-r bg-background" aria-label="ถาดไอเดีย">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <Lightbulb className="h-4 w-4 text-[var(--forge-amber)]" />
                <p className="flex-1 text-sm font-semibold">ถาดไอเดีย <span className="font-normal text-muted-foreground">· {ideas.length}</span></p>
                <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="ปิดถาดไอเดีย">
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
                <p className="mt-1.5 text-[11px] text-muted-foreground">ลากไอเดียลงคอลัมน์บทเพื่อทำเป็นฉาก</p>
            </div>
            <ul className="flex-1 space-y-1.5 overflow-y-auto p-2">
                {ideas.length === 0 && (
                    <li className="px-2 py-6 text-center text-xs text-muted-foreground">ยังไม่มีไอเดียที่รอวาง</li>
                )}
                {ideas.map(idea => (
                    <li
                        key={idea.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData(IDEA_DRAG_TYPE, idea.id); e.dataTransfer.effectAllowed = "copy" }}
                        className="group flex cursor-grab items-start gap-1.5 rounded-md border bg-card px-2 py-1.5 text-sm active:cursor-grabbing hover:border-[var(--forge-amber)]/50"
                    >
                        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                        <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 leading-snug">{idea.title}</p>
                            {idea.content && <p className="line-clamp-1 text-xs text-muted-foreground">{idea.content}</p>}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`วาง “${idea.title}” ลงบท`}>
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

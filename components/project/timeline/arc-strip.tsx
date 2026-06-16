"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Chapter } from "@/db/schema"
import type { StoryArc } from "@/db/schema"
import { createArc, updateArc, deleteArc } from "@/server/story-arcs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Check, Clapperboard } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const COLUMN_WIDTH = 260

// สีที่เข้ากับ palette ฟิล์ม — warm amber, ember, teal, indigo ฯลฯ
const ARC_COLORS = [
    "#f59e0b", // forge amber
    "#fb923c", // ember
    "#f43f5e", // crimson
    "#a78bfa", // lavender
    "#6366f1", // indigo
    "#22d3ee", // cyan
    "#34d399", // emerald
    "#facc15", // gold
    "#e879f9", // fuchsia
    "#94a3b8", // slate muted
]

interface ArcStripProps {
    novelId: string
    chapters: Chapter[]
    arcs: StoryArc[]
}

export function ArcStrip({ novelId, chapters, arcs }: ArcStripProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [addOpen, setAddOpen] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newColor, setNewColor] = useState(ARC_COLORS[0])
    const [newStart, setNewStart] = useState<string>("")
    const [newEnd, setNewEnd] = useState<string>("")

    const totalWidth = chapters.length * COLUMN_WIDTH
    const chapterIndexById = new Map(chapters.map((c, i) => [c.id, i]))

    const getArcPosition = (arc: StoryArc) => {
        const startIdx = arc.startChapterId ? (chapterIndexById.get(arc.startChapterId) ?? 0) : 0
        const endIdx = arc.endChapterId ? (chapterIndexById.get(arc.endChapterId) ?? chapters.length - 1) : chapters.length - 1
        return {
            left: startIdx * COLUMN_WIDTH,
            width: (endIdx - startIdx + 1) * COLUMN_WIDTH,
        }
    }

    const handleCreate = () => {
        if (!newTitle.trim()) { toast.error("ใส่ชื่อ arc ก่อน"); return }
        startTransition(async () => {
            const res = await createArc({
                novelId,
                title: newTitle.trim(),
                color: newColor,
                startChapterId: newStart || undefined,
                endChapterId: newEnd || undefined,
            })
            if (res.success) {
                setNewTitle(""); setNewStart(""); setNewEnd("")
                setAddOpen(false)
                toast.success("เพิ่ม arc แล้ว")
                router.refresh()
            } else {
                toast.error(res.error || "ผิดพลาด")
            }
        })
    }

    return (
        <div className="relative flex-shrink-0 flex items-center" style={{ width: totalWidth + 32, height: 40 }}>
            {/* Ruler background strip — เหมือน editing timeline */}
            <div className="absolute inset-y-1 left-0 right-8 bg-zinc-900/60 dark:bg-zinc-950/80 border border-zinc-700/40" style={{ clipPath: "polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)" }} />

            {/* Track center line — สี amber อ่อน */}
            <div
                className="absolute left-0 right-8"
                style={{ top: "50%", height: 1, background: "repeating-linear-gradient(to right, #f59e0b44 0px, #f59e0b44 6px, transparent 6px, transparent 12px)" }}
            />

            {/* Chapter tick marks — เหมือน frame count markers */}
            {chapters.map((_, i) => (
                <div key={i} className="absolute flex flex-col items-center gap-0.5" style={{ left: i * COLUMN_WIDTH + 1 }}>
                    <div className="w-px bg-zinc-500/60" style={{ height: 10, marginTop: 6 }} />
                    <span className="font-technical text-[7px] text-zinc-600 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                </div>
            ))}

            {/* Arc bands */}
            {arcs.map(arc => {
                const { left, width } = getArcPosition(arc)
                return (
                    <ArcBand
                        key={arc.id}
                        arc={arc}
                        novelId={novelId}
                        chapters={chapters}
                        left={left}
                        width={width}
                        onChanged={() => router.refresh()}
                    />
                )
            })}

            {/* Add button — splice marker style */}
            <Popover open={addOpen} onOpenChange={setAddOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            "absolute right-0 top-1/2 -translate-y-1/2",
                            "h-7 w-7 flex items-center justify-center",
                            "chamfered-sm border border-dashed border-zinc-600/60 bg-zinc-900/80",
                            "text-zinc-500 hover:text-[var(--forge-amber)] hover:border-[var(--forge-amber)]/50",
                            "transition-colors duration-150"
                        )}
                        title="เพิ่ม story arc"
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0 overflow-hidden" align="end">
                    {/* Popover header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                        <Clapperboard className="h-3.5 w-3.5 text-[var(--forge-amber)]" />
                        <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300">เพิ่ม Story Arc</span>
                    </div>
                    <div className="p-3 space-y-2.5">
                        <Input
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleCreate()}
                            placeholder="เช่น Act I · การตั้งต้น"
                            className="h-8 text-xs chamfered-sm"
                            autoFocus
                        />
                        <div className="flex gap-1.5 flex-wrap">
                            {ARC_COLORS.map(c => (
                                <button
                                    key={c}
                                    className="h-5 w-5 rounded-sm transition-transform hover:scale-110 flex items-center justify-center"
                                    style={{
                                        background: c,
                                        outline: newColor === c ? `2px solid ${c}` : "none",
                                        outlineOffset: 2,
                                    }}
                                    onClick={() => setNewColor(c)}
                                >
                                    {newColor === c && <Check className="h-2.5 w-2.5 text-black/70" />}
                                </button>
                            ))}
                        </div>
                        <Select value={newStart} onValueChange={setNewStart}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เริ่มจากบท…" /></SelectTrigger>
                            <SelectContent>
                                {chapters.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={newEnd} onValueChange={setNewEnd}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ถึงบท…" /></SelectTrigger>
                            <SelectContent>
                                {chapters.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button size="sm" className="w-full h-8 chamfered-sm" disabled={isPending || !newTitle.trim()} onClick={handleCreate}>
                            <Plus className="h-3.5 w-3.5 mr-1" />เพิ่ม Arc
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}

function ArcBand({ arc, novelId, chapters, left, width, onChanged }: {
    arc: StoryArc
    novelId: string
    chapters: Chapter[]
    left: number
    width: number
    onChanged: () => void
}) {
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [title, setTitle] = useState(arc.title)
    const [color, setColor] = useState(arc.color)
    const [startId, setStartId] = useState(arc.startChapterId ?? "")
    const [endId, setEndId] = useState(arc.endChapterId ?? "")

    const run = (fn: () => Promise<{ success: boolean; error?: string }>) =>
        startTransition(async () => {
            const res = await fn()
            if (res.success) { setOpen(false); onChanged() }
            else toast.error(res.error || "ผิดพลาด")
        })

    const handleSave = () => run(() =>
        updateArc(arc.id, novelId, {
            title: title.trim() || arc.title,
            color,
            startChapterId: startId || null,
            endChapterId: endId || null,
        })
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {/* Arc band — chamfered, colored tape on ruler */}
                <button
                    className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 chamfered-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
                    style={{
                        left: left + 2,
                        width: width - 8,
                        height: 22,
                        background: `${arc.color}18`,
                        border: `1px solid ${arc.color}55`,
                        // เส้นบนสุดทึบกว่า — เหมือน colored tape edge
                        borderTop: `2px solid ${arc.color}cc`,
                    }}
                >
                    {/* Left splice mark */}
                    <span className="h-3 w-0.5 shrink-0 rounded-full" style={{ background: arc.color }} />
                    <span
                        className="font-technical text-[9px] uppercase tracking-[0.1em] truncate"
                        style={{ color: arc.color }}
                    >
                        {arc.title}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 overflow-hidden" align="start">
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border-b border-zinc-700/60">
                    <span className="h-2 w-2 chamfered-sm shrink-0" style={{ background: arc.color }} />
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-300 truncate">{arc.title}</span>
                </div>
                <div className="p-3 space-y-2.5">
                    <Input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="h-8 text-xs chamfered-sm font-medium"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                        {ARC_COLORS.map(c => (
                            <button
                                key={c}
                                className="h-5 w-5 chamfered-sm transition-transform hover:scale-110 flex items-center justify-center"
                                style={{
                                    background: c,
                                    outline: color === c ? `2px solid ${c}` : "none",
                                    outlineOffset: 2,
                                }}
                                onClick={() => setColor(c)}
                            >
                                {color === c && <Check className="h-2.5 w-2.5 text-black/70" />}
                            </button>
                        ))}
                    </div>
                    <Select value={startId} onValueChange={setStartId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="เริ่มจากบท…" /></SelectTrigger>
                        <SelectContent>
                            {chapters.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={endId} onValueChange={setEndId}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="ถึงบท…" /></SelectTrigger>
                        <SelectContent>
                            {chapters.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                        <Button size="sm" className="h-8 flex-1 chamfered-sm" disabled={isPending} onClick={handleSave}>บันทึก</Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground hover:text-destructive"
                            disabled={isPending} onClick={() => run(() => deleteArc(arc.id, novelId))}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

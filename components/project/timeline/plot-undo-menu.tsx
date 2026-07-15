"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Undo2, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePlotUndoStack } from "@/hooks/use-plot-undo-stack"
import { restorePlotUndoEntry } from "@/lib/plot-undo-restore"

const KIND_LABEL: Record<string, string> = {
    arc: "Arc",
    thread: "ปม",
    beat: "จุดผูกปม",
    scene: "ฉาก",
}

interface Props {
    novelId: string
}

// รายการ "กู้คืนล่าสุด" (สูงสุด 3) — เก็บใน sessionStorage รอด navigation แต่ทนกว่า toast ที่หายไปใน ~4 วิ
export function PlotUndoMenu({ novelId }: Props) {
    const { stack, remove } = usePlotUndoStack(novelId)
    const [isPending, startTransition] = useTransition()
    const [open, setOpen] = useState(false)
    const router = useRouter()

    if (stack.length === 0) return null

    const handleRestore = (id: string) => {
        const entry = stack.find(e => e.id === id)
        if (!entry) return
        startTransition(async () => {
            const res = await restorePlotUndoEntry(novelId, entry)
            if (res.success) {
                remove(id)
                toast.success(`กู้คืน "${entry.label}" แล้ว`)
                router.refresh()
                if (entry.kind === "scene" && res.sceneId) {
                    router.push(`/dashboard/project/${novelId}/plot/${res.sceneId}`)
                }
            } else {
                toast.error(res.error || "กู้คืนไม่สำเร็จ")
            }
        })
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Undo2 className="h-3.5 w-3.5" />
                    กู้คืนล่าสุด
                    <span className="ml-0.5 inline-flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-muted text-[10px] font-bold tabular-nums">
                        {stack.length}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-2 space-y-1">
                <span className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground px-1">
                    ลบล่าสุด (เก็บสูงสุด 3 รายการ)
                </span>
                {stack.map(entry => (
                    <div key={entry.id} className="flex items-center gap-2 p-1.5 rounded chamfered-sm border border-border/50 bg-card/50">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-xs truncate">{entry.label}</p>
                            <span className="text-[9px] text-muted-foreground">{KIND_LABEL[entry.kind] ?? entry.kind}</span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" disabled={isPending} onClick={() => handleRestore(entry.id)}>
                            กู้คืน
                        </Button>
                        <button onClick={() => remove(entry.id)} className="text-muted-foreground hover:text-foreground shrink-0" title="ทิ้งถาวร">
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ))}
            </PopoverContent>
        </Popover>
    )
}

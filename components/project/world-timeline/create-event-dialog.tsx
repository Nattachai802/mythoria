"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pick } from "./pick"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createWorldEvent, type DropTarget } from "@/server/world-timeline"
import type { EraYear } from "@/lib/world-calendar"

interface Props {
    novelId: string
    open: boolean
    onOpenChange: (open: boolean) => void
    /** สร้าง ณ ช่องที่ดับเบิลคลิก — null = ให้เลือกยุคเอง (ยังไม่มีเวลา) */
    target: DropTarget | null
    targetLabel: string | null
    eras: EraYear[]
}

const NO_ERA = "_none"

/** เหตุการณ์ในโลกเก็บเป็น lore ชนิด "event" — แก้เนื้อหาต่อได้ในหน้า Lore */
export function CreateEventDialog({ novelId, open, onOpenChange, target, targetLabel, eras }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [title, setTitle] = useState("")
    const [eraId, setEraId] = useState(NO_ERA)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            setTitle("")
            setError(null)
            setEraId(eras[eras.length - 1]?.id ?? NO_ERA)
        }
    }, [open, eras])

    const submit = () => {
        if (!title.trim()) {
            setError("ตั้งชื่อเหตุการณ์ก่อน")
            return
        }
        startTransition(async () => {
            const res = await createWorldEvent(novelId, title, target ?? (eraId === NO_ERA ? null : { eraId, day: null }))
            if (!res.success) {
                toast.error(res.error ?? "สร้างไม่สำเร็จ")
                return
            }
            toast.success(`สร้าง "${title.trim()}" แล้ว`)
            onOpenChange(false)
            router.refresh()
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>เหตุการณ์ใหม่</DialogTitle>
                    <DialogDescription>
                        {targetLabel ? `วางที่ ${targetLabel}` : "บันทึกเป็น lore ชนิดเหตุการณ์ ใส่เวลาได้ทีหลังโดยกดที่ตัวมันบนเส้นเวลา"}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Input
                            autoFocus
                            placeholder="การล่มสลายของหอคอยเหนือ"
                            value={title}
                            onChange={e => { setTitle(e.target.value); setError(null) }}
                            onKeyDown={e => { if (e.key === "Enter") submit() }}
                            aria-label="ชื่อเหตุการณ์"
                            aria-invalid={!!error}
                        />
                        {error && <p className="text-xs text-destructive">{error}</p>}
                    </div>
                    {!target && (
                        <Pick
                            ariaLabel="ยุค" className="w-full"
                            value={eraId}
                            onChange={setEraId}
                            options={[...eras.map(e => ({ value: e.id, label: e.name })), { value: NO_ERA, label: "ยังไม่ระบุยุค (ไปอยู่ในถาด)" }]}
                        />
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
                    <Button onClick={submit} disabled={isPending}>{isPending ? "กำลังสร้าง…" : "สร้าง"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

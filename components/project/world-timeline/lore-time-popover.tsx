"use client"

import { useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { setLoreWorldTime } from "@/server/world-timeline"
import { eraForYear, fromDay, type EraYear, type TimePrecision, type WorldCalendar } from "@/lib/world-calendar"

interface Props {
    novelId: string
    loreId: string
    title: string
    calendar: WorldCalendar
    eras: EraYear[]
    /** เวลาที่ตั้งไว้แล้ว (เลขวัน + ความละเอียด) — null = ยังไม่ตั้ง */
    current: { day: number; precision: TimePrecision } | null
    children: ReactNode
}

const PRECISION_LABEL: Record<TimePrecision, string> = { year: "รู้แค่ปี", month: "ถึงเดือน", day: "ถึงวัน" }
const ABSOLUTE = "_abs"

/**
 * ตั้งเวลาของ lore — กรอกเป็น "ปีของยุค" (คนเขียนคิดแบบนี้) แล้วแปลงเป็นปีสัมบูรณ์ตอนบันทึก
 * ยุคที่ยังไม่ตั้งปีเริ่มเลือกไม่ได้ เพราะแปลงเป็นปีสัมบูรณ์ไม่ได้ → ให้กรอกปีสัมบูรณ์แทน
 */
export function LoreTimePopover({ novelId, loreId, title, calendar, eras, current, children }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const datedEras = eras.filter(e => e.startYear != null)

    const init = () => {
        const t = current ? fromDay(calendar, current.day) : null
        const era = t ? eraForYear(datedEras, t.year) : datedEras[datedEras.length - 1] ?? null
        return {
            eraId: era?.id ?? ABSOLUTE,
            year: t ? String(era ? t.year - era.startYear! + 1 : t.year) : "",
            month: t?.month ?? 1,
            day: t?.day ?? 1,
            precision: current?.precision ?? ("year" as TimePrecision),
        }
    }
    const [form, setForm] = useState(init)
    const era = datedEras.find(e => e.id === form.eraId) ?? null

    const save = (clear = false) => {
        const y = Number(form.year)
        if (!clear && (form.year.trim() === "" || !Number.isFinite(y))) {
            toast.error("กรอกปีก่อน")
            return
        }
        startTransition(async () => {
            const res = await setLoreWorldTime(loreId, clear ? null : {
                year: era ? era.startYear! + y - 1 : y,
                month: form.month,
                day: form.day,
                precision: form.precision,
            })
            if (!res.success) {
                toast.error(res.error ?? "บันทึกไม่สำเร็จ")
                return
            }
            setOpen(false)
            router.refresh()
        })
    }

    return (
        <Popover open={open} onOpenChange={o => { if (o) setForm(init()); setOpen(o) }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80 space-y-3 text-sm">
                <div>
                    <p className="truncate font-medium" title={title}>{title}</p>
                    <p className="text-xs text-muted-foreground">เกิดขึ้นเมื่อไหร่ในโลก</p>
                </div>

                <div className="flex gap-1">
                    {(Object.keys(PRECISION_LABEL) as TimePrecision[]).map(p => (
                        <Button
                            key={p} size="sm" variant={form.precision === p ? "secondary" : "ghost"}
                            onClick={() => setForm(f => ({ ...f, precision: p }))}
                        >
                            {PRECISION_LABEL[p]}
                        </Button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">ปี</span>
                    <Input
                        type="number" className="w-24" value={form.year} autoFocus
                        onChange={e => setForm(f => ({ ...f, year: e.target.value }))}
                        onKeyDown={e => { if (e.key === "Enter") save() }}
                    />
                    <select
                        className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                        value={form.eraId}
                        onChange={e => setForm(f => ({ ...f, eraId: e.target.value }))}
                        aria-label="นับปีตามยุค"
                    >
                        {datedEras.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        <option value={ABSOLUTE}>ปีต่อเนื่องของโลก</option>
                    </select>
                </div>

                {form.precision !== "year" && (
                    <div className="flex items-center gap-2">
                        <select
                            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                            value={form.month}
                            onChange={e => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                            aria-label="เดือน"
                        >
                            {calendar.months.map((m, i) => <option key={i} value={i + 1}>{m.name}</option>)}
                        </select>
                        {form.precision === "day" && (
                            <>
                                <span className="text-xs text-muted-foreground">วันที่</span>
                                <Input type="number" min={1} className="w-20" value={form.day}
                                    onChange={e => setForm(f => ({ ...f, day: Number(e.target.value) || 1 }))} />
                            </>
                        )}
                    </div>
                )}

                {eras.length > datedEras.length && (
                    <p className="text-xs text-muted-foreground">ยุคที่ยังไม่ตั้งปีเริ่มเลือกไม่ได้ ตั้งได้ที่ปุ่ม "ปฏิทินโลก"</p>
                )}

                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/project/${novelId}/worldbuilding`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                        เปิดหน้า Lore
                    </Link>
                    <span className="flex-1" />
                    {current && <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={isPending}>ล้างเวลา</Button>}
                    <Button size="sm" onClick={() => save()} disabled={isPending}>{isPending ? "กำลังบันทึก…" : "บันทึก"}</Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

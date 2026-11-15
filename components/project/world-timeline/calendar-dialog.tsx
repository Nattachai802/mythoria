"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { saveWorldCalendar } from "@/server/world-timeline"
import { yearLength, type EraYear, type WorldCalendar } from "@/lib/world-calendar"

interface Props {
    novelId: string
    calendar: WorldCalendar
    eras: EraYear[]
}

const num = (v: string) => (v.trim() === "" ? null : Number(v))

export function CalendarDialog({ novelId, calendar, eras }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [months, setMonths] = useState(calendar.months)
    const [anchor, setAnchor] = useState(calendar.anchor)
    const [eraYears, setEraYears] = useState<Record<string, string>>(
        () => Object.fromEntries(eras.map(e => [e.id, e.startYear == null ? "" : String(e.startYear)])),
    )

    // เปิดใหม่ทุกครั้ง = เริ่มจากค่าที่บันทึกไว้ ไม่ค้างค่าที่พิมพ์แล้วกดยกเลิก
    const reset = () => {
        setMonths(calendar.months)
        setAnchor(calendar.anchor)
        setEraYears(Object.fromEntries(eras.map(e => [e.id, e.startYear == null ? "" : String(e.startYear)])))
    }

    const changed = JSON.stringify(months) !== JSON.stringify(calendar.months)
    const save = () => {
        startTransition(async () => {
            const res = await saveWorldCalendar(
                novelId,
                { months, anchor },
                Object.fromEntries(Object.entries(eraYears).map(([id, v]) => [id, num(v)])),
            )
            if (!res.success) {
                toast.error(res.error ?? "บันทึกไม่สำเร็จ")
                return
            }
            toast.success("บันทึกปฏิทินแล้ว")
            setOpen(false)
            router.refresh()
        })
    }

    return (
        <Dialog open={open} onOpenChange={o => { if (o) reset(); setOpen(o) }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <CalendarDays className="size-4" /> ปฏิทินโลก
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>ปฏิทินของโลก</DialogTitle>
                    <DialogDescription>
                        ใช้วางยุค lore และฉากบนแกนเวลาเดียวกัน ทุกปียาวเท่ากัน ({yearLength({ months, anchor })} วัน)
                    </DialogDescription>
                </DialogHeader>

                <section className="space-y-2">
                    <h3 className="text-sm font-medium">เดือน</h3>
                    {months.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
                            <Input
                                value={m.name}
                                onChange={e => setMonths(ms => ms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                                aria-label={`ชื่อเดือนที่ ${i + 1}`}
                            />
                            <Input
                                type="number" min={1} max={400} className="w-20"
                                value={m.days}
                                onChange={e => setMonths(ms => ms.map((x, j) => (j === i ? { ...x, days: Number(e.target.value) || 1 } : x)))}
                                aria-label={`จำนวนวันของเดือนที่ ${i + 1}`}
                            />
                            <span className="text-xs text-muted-foreground">วัน</span>
                            <Button
                                variant="ghost" size="icon" disabled={months.length <= 1}
                                onClick={() => setMonths(ms => ms.filter((_, j) => j !== i))}
                                aria-label={`ลบเดือนที่ ${i + 1}`}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>
                    ))}
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setMonths(ms => [...ms, { name: `เดือน ${ms.length + 1}`, days: 30 }])}>
                        <Plus className="size-4" /> เพิ่มเดือน
                    </Button>
                    {changed && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            เปลี่ยนจำนวนเดือนหรือวัน: lore ที่ตั้งเวลาไว้แล้วจะแสดงเป็นวันที่ต่างไปจากที่กรอก (ลำดับก่อน/หลังยังเหมือนเดิม)
                        </p>
                    )}
                </section>

                <section className="space-y-2">
                    <h3 className="text-sm font-medium">ปีที่ 1 ของแต่ละยุค</h3>
                    {eras.length === 0 ? (
                        <p className="text-xs text-muted-foreground">ยังไม่มียุค สร้างได้ในหน้าสร้างโลก แท็บ Lore</p>
                    ) : eras.map(e => (
                        <label key={e.id} className="flex items-center gap-2 text-sm">
                            <span className="flex-1 truncate">{e.name}</span>
                            <span className="text-xs text-muted-foreground">เริ่มที่ปี</span>
                            <Input
                                type="number" className="w-28" placeholder="ยังไม่ตั้ง"
                                value={eraYears[e.id] ?? ""}
                                onChange={ev => setEraYears(y => ({ ...y, [e.id]: ev.target.value }))}
                            />
                        </label>
                    ))}
                    <p className="text-xs text-muted-foreground">นับปีต่อเนื่องทั้งโลก ติดลบได้ เช่น ยุคแรกเริ่มปี −1000 ยุคเพลิงเริ่มปี 1</p>
                </section>

                <section className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Day 1 ของฉาก</h3>
                        <Switch
                            checked={anchor != null}
                            onCheckedChange={on => setAnchor(on ? { year: 1, month: 1, day: 1 } : null)}
                            aria-label="ผูกวันที่ของฉากกับปฏิทินโลก"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        ฉากที่ตั้ง "Day N" ไว้บนกระดานพล็อต จะถูกวางบนแกนเวลาจริงนับจากวันนี้
                    </p>
                    {anchor && (
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-xs text-muted-foreground">ปี</span>
                            <Input type="number" className="w-24" value={anchor.year}
                                onChange={e => setAnchor({ ...anchor, year: Number(e.target.value) || 0 })} />
                            <select
                                className="h-9 rounded-md border bg-background px-2 text-sm"
                                value={anchor.month}
                                onChange={e => setAnchor({ ...anchor, month: Number(e.target.value) })}
                                aria-label="เดือนของ Day 1"
                            >
                                {months.map((m, i) => <option key={i} value={i + 1}>{m.name}</option>)}
                            </select>
                            <span className="text-xs text-muted-foreground">วันที่</span>
                            <Input type="number" min={1} className="w-20" value={anchor.day}
                                onChange={e => setAnchor({ ...anchor, day: Number(e.target.value) || 1 })} />
                        </div>
                    )}
                </section>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                    <Button onClick={save} disabled={isPending}>{isPending ? "กำลังบันทึก…" : "บันทึก"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

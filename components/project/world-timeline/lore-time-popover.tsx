"use client"

import { useState, useTransition, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { setLoreStoryline, setLoreWorldTime } from "@/server/world-timeline"
import { deleteLoreEntry, updateLoreEntry } from "@/server/lore"
import { eraForYear, fromDay, type EraYear, type TimePrecision, type WorldCalendar } from "@/lib/world-calendar"

interface Props {
    novelId: string
    loreId: string
    title: string
    calendar: WorldCalendar
    eras: EraYear[]
    /** เวลาที่ตั้งไว้แล้ว (เลขวัน + ความละเอียด) — null = ยังไม่ตั้ง */
    current: { day: number; precision: TimePrecision } | null
    /** storyline ปัจจุบัน: ผู้เกี่ยวข้อง / สถานที่ / ฉากที่เล่า */
    links: Links
    options: StorylineOptions
    children: ReactNode
}

export interface Links { characterIds: string[]; locationIds: string[]; sceneIds: string[] }
export interface StorylineOptions {
    characters: { id: string; name: string }[]
    locations: { id: string; name: string }[]
    scenes: { id: string; name: string }[]
}

const LINK_GROUPS: { key: keyof Links; opt: keyof StorylineOptions; label: string; empty: string }[] = [
    { key: "characterIds", opt: "characters", label: "ใครเกี่ยวข้อง", empty: "ยังไม่มีตัวละคร" },
    { key: "locationIds", opt: "locations", label: "เกิดที่ไหน", empty: "ยังไม่มีสถานที่" },
    { key: "sceneIds", opt: "scenes", label: "ฉากที่เล่าให้เห็น (ไม่เลือก = เกิดนอกจอ)", empty: "ยังไม่มีฉาก" },
]

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(x => b.includes(x))

const PRECISION_LABEL: Record<TimePrecision, string> = { year: "รู้แค่ปี", month: "ถึงเดือน", day: "ถึงวัน" }
const ABSOLUTE = "_abs"

/**
 * ตั้งเวลาของ lore — กรอกเป็น "ปีของยุค" (คนเขียนคิดแบบนี้) แล้วแปลงเป็นปีสัมบูรณ์ตอนบันทึก
 * ยุคที่ยังไม่ตั้งปีเริ่มเลือกไม่ได้ เพราะแปลงเป็นปีสัมบูรณ์ไม่ได้ → ให้กรอกปีสัมบูรณ์แทน
 */
export function LoreTimePopover({ novelId, loreId, title, calendar, eras, current, links, options, children }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [name, setName] = useState(title)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [picked, setPicked] = useState<Links>(links)
    const togglePick = (key: keyof Links, id: string) =>
        setPicked(p => ({ ...p, [key]: p[key].includes(id) ? p[key].filter(x => x !== id) : [...p[key], id] }))
    const linksChanged = LINK_GROUPS.some(g => !sameSet(picked[g.key], links[g.key]))
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
        // ไม่กรอกปี = ไม่แตะเวลา (แก้แค่ชื่อ/ผู้เกี่ยวข้อง)
        const skipTime = !clear && form.year.trim() === ""
        if (skipTime && name.trim() === title && !linksChanged) {
            toast.error("กรอกปีก่อน")
            return
        }
        if (!clear && !skipTime && !Number.isFinite(y)) {
            toast.error("ปีไม่ถูกต้อง")
            return
        }
        startTransition(async () => {
            const newName = name.trim()
            if (newName && newName !== title) {
                const renamed = await updateLoreEntry(loreId, { title: newName.slice(0, 200) })
                if (!renamed.success) {
                    toast.error("เปลี่ยนชื่อไม่สำเร็จ")
                    return
                }
            }
            if (linksChanged) {
                const linked = await setLoreStoryline(loreId, picked)
                if (!linked.success) {
                    toast.error(linked.error ?? "บันทึกผู้เกี่ยวข้องไม่สำเร็จ")
                    return
                }
            }
            if (skipTime) {
                setOpen(false)
                router.refresh()
                return
            }
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

    const remove = () => {
        startTransition(async () => {
            const res = await deleteLoreEntry(loreId)
            if (!res.success) {
                toast.error("ลบไม่สำเร็จ")
                return
            }
            toast.success(`ลบ "${title}" แล้ว`)
            setConfirmDelete(false)
            setOpen(false)
            router.refresh()
        })
    }

    return (
        <>
        <Popover open={open} onOpenChange={o => { if (o) { setForm(init()); setName(title); setPicked(links) } setOpen(o) }}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80 space-y-3 text-sm">
                <div className="space-y-1">
                    <Input value={name} onChange={e => setName(e.target.value)} aria-label="ชื่อ lore" className="font-medium" />
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
                        type="number" className="w-24" value={form.year}
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

                <details className="rounded-md border px-2 py-1.5">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                        storyline · {picked.characterIds.length} คน · {picked.sceneIds.length ? `${picked.sceneIds.length} ฉาก` : "นอกจอ"}
                    </summary>
                    <div className="mt-2 space-y-2">
                        {LINK_GROUPS.map(g => (
                            <fieldset key={g.key} className="space-y-1">
                                <legend className="text-xs font-medium">{g.label}</legend>
                                <div className="max-h-28 space-y-0.5 overflow-y-auto">
                                    {options[g.opt].length === 0 && <p className="text-xs text-muted-foreground">{g.empty}</p>}
                                    {options[g.opt].map(o => (
                                        <label key={o.id} className="flex items-center gap-2 text-xs">
                                            <input type="checkbox" checked={picked[g.key].includes(o.id)} onChange={() => togglePick(g.key, o.id)} />
                                            <span className="truncate">{o.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        ))}
                    </div>
                </details>

                {eras.length > datedEras.length && (
                    <p className="text-xs text-muted-foreground">ยุคที่ยังไม่ตั้งปีเริ่มเลือกไม่ได้ ตั้งได้ที่ปุ่ม "ปฏิทินโลก"</p>
                )}

                <div className="flex items-center gap-2">
                    <Link href={`/dashboard/project/${novelId}/worldbuilding`} className="text-xs text-muted-foreground underline-offset-2 hover:underline">
                        เปิดหน้า Lore
                    </Link>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)} disabled={isPending}>
                        ลบ
                    </Button>
                    <span className="flex-1" />
                    {current && <Button size="sm" variant="ghost" onClick={() => save(true)} disabled={isPending}>ล้างเวลา</Button>}
                    <Button size="sm" onClick={() => save()} disabled={isPending}>{isPending ? "กำลังบันทึก…" : "บันทึก"}</Button>
                </div>
            </PopoverContent>
        </Popover>
        <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>ลบ "{title}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                        lore นี้จะหายจากทุกหน้า รวมถึงหน้า Lore ด้วย และกู้คืนไม่ได้ ถ้าแค่อยากเอาออกจากแกน ให้กด "ล้างเวลา" แทน
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction onClick={e => { e.preventDefault(); remove() }} disabled={isPending}>ลบถาวร</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}

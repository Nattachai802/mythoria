"use client"

/**
 * ชิ้นส่วน UI ที่คลังโน้ตไอเดียใช้ร่วมกัน (หน้า /idea, แท็บในหน้า entity, ถาดบนกระดาน)
 * ป้ายแสดงผล (ScopeTags) หน้าตาต่างจากปุ่มเปิดปิด (ScopeToggles) โดยตั้งใจ — กันสับสนว่าอันไหนกดได้
 */

import { useEffect, useState } from "react"
import { Clapperboard, CircleDashed, Flag, Globe, MapPin, Plus, Route, User, X, Zap, BookOpen, type LucideIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { IDEA_SCOPES, IDEA_SCOPE_LABEL, SCOPE_OF_TARGET, cleanScopes, type IdeaScope, type VaultLinkTarget } from "@/lib/idea-scopes"
import { searchVaultTargets, type VaultNoteView } from "@/server/idea-vault"

export const SCOPE_ICON: Record<IdeaScope, LucideIcon> = {
    character: User, faction: Flag, location: MapPin, power: Zap, worldbuilding: Globe, plot: Route, scene: Clapperboard,
}

export const TARGET_ICON: Record<VaultLinkTarget, LucideIcon> = {
    character: User, faction: Flag, location: MapPin, power: Zap, lore: BookOpen, timelineEvent: Clapperboard,
}

const TARGET_LABEL: Record<VaultLinkTarget, string> = {
    character: "ตัวละคร", faction: "ฝ่าย", location: "สถานที่", power: "พลัง", lore: "Lore", timelineEvent: "ฉาก",
}

/** scope ที่แสดง = ที่ติดเอง ∪ ที่ได้จากชนิดของ entity ที่ผูกไว้ */
export function effectiveScopes(note: Pick<VaultNoteView, "scopes" | "links">): IdeaScope[] {
    const s = new Set(cleanScopes(note.scopes))
    for (const l of note.links) {
        if (l.relation !== "about") continue
        const fromTarget = SCOPE_OF_TARGET[l.targetType]
        if (fromTarget) s.add(fromTarget)
    }
    return IDEA_SCOPES.filter(k => s.has(k))
}

export const isUsedNote = (note: Pick<VaultNoteView, "links">) => note.links.some(l => l.relation === "used_in")

export function ScopeTags({ scopes, className }: { scopes: IdeaScope[]; className?: string }) {
    if (scopes.length === 0) {
        return (
            <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground/80", className)}>
                <CircleDashed className="h-3 w-3" aria-hidden /> ยังไม่ระบุที่ใช้
            </span>
        )
    }
    return (
        <span className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground", className)}>
            {scopes.map(k => {
                const Icon = SCOPE_ICON[k]
                return <span key={k} className="inline-flex items-center gap-1"><Icon className="h-3 w-3" aria-hidden />{IDEA_SCOPE_LABEL[k]}</span>
            })}
        </span>
    )
}

export function ScopeToggles({ value, onToggle, disabled }: { value: IdeaScope[]; onToggle: (k: IdeaScope) => void; disabled?: boolean }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {IDEA_SCOPES.map(k => {
                const Icon = SCOPE_ICON[k]
                const on = value.includes(k)
                return (
                    <button
                        key={k}
                        type="button"
                        disabled={disabled}
                        aria-pressed={on}
                        onClick={() => onToggle(k)}
                        className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-150 active:scale-[0.97] motion-reduce:transition-none",
                            on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden />{IDEA_SCOPE_LABEL[k]}
                    </button>
                )
            })}
        </div>
    )
}

type Option = Awaited<ReturnType<typeof searchVaultTargets>>[number]

/** ค้นแล้วเลือกตัวละคร/ฝ่าย/สถานที่/พลัง/lore เพื่อผูก — exclude = ที่ผูกอยู่แล้ว */
export function VaultLinkPicker({ novelId, exclude, onPick, label = "ผูกตัวละคร ฝ่าย สถานที่" }: {
    novelId: string
    exclude: Set<string>
    onPick: (o: Option) => void
    label?: string
}) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const [opts, setOpts] = useState<Option[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        let alive = true
        setLoading(true)
        const t = setTimeout(async () => {
            const res = await searchVaultTargets(novelId, q)
            if (alive) { setOpts(res); setLoading(false) }
        }, 200) // debounce ระหว่างพิมพ์
        return () => { alive = false; clearTimeout(t) }
    }, [open, q, novelId])

    const visible = opts.filter(o => !exclude.has(`${o.type}:${o.id}`))
    const groups = (Object.keys(TARGET_LABEL) as VaultLinkTarget[])
        .map(t => [t, visible.filter(o => o.type === t)] as const)
        .filter(([, list]) => list.length > 0)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground">
                    <Plus className="h-3.5 w-3.5" aria-hidden />{label}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="ค้นชื่อ" value={q} onValueChange={setQ} />
                    <CommandList>
                        <CommandEmpty>{loading ? "กำลังค้น…" : "ไม่พบชื่อนี้ในนิยาย"}</CommandEmpty>
                        {groups.map(([type, list]) => {
                            const Icon = TARGET_ICON[type]
                            return (
                                <CommandGroup key={type} heading={TARGET_LABEL[type]}>
                                    {list.map(o => (
                                        <CommandItem key={o.id} value={`${o.type}:${o.id}`} onSelect={() => { onPick(o); setOpen(false); setQ("") }}>
                                            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                                            <span className="truncate">{o.title}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )
                        })}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function LinkChip({ type, title, href, onRemove }: { type: VaultLinkTarget; title: string; href: string | null; onRemove?: () => void }) {
    const Icon = TARGET_ICON[type]
    return (
        <span className="inline-flex h-7 items-center gap-1 rounded-md bg-muted pl-2 pr-1 text-xs">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {href ? <a href={href} className="hover:underline">{title}</a> : title}
            {onRemove && (
                <button type="button" onClick={onRemove} className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`ถอด ${title}`}>
                    <X className="h-3 w-3" aria-hidden />
                </button>
            )}
        </span>
    )
}

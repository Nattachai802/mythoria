"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { NovelActions } from "@/components/dashboard/novel-actions"
import { BookOpen, PenTool } from "lucide-react"

export interface ShelfNovel {
    id: string
    title: string
    description: string | null
    wordCount: number
    chaptersCount: number
    status: string
    updatedAt: string // ISO
}

// Spine geometry
const SPINE_H = 208
const ROW_GAP = 28
const MIN_W = 48
const MAX_W = 96

// On-brand binding tones (dark, carry light text). Deterministic per novel.
const BINDINGS = [
    "oklch(0.24 0.03 250)", // carbon steel
    "oklch(0.30 0.07 255)", // steel blue
    "oklch(0.32 0.09 42)",  // copper
    "oklch(0.30 0.06 160)", // patina
    "oklch(0.31 0.10 25)",  // oxblood
    "oklch(0.33 0.08 70)",  // dark amber
]

const STATUS: Record<string, { label: string; color: string }> = {
    draft: { label: "ฉบับร่าง", color: "oklch(0.60 0.02 250)" },
    in_progress: { label: "กำลังเขียน", color: "var(--forge-gold)" },
    completed: { label: "เขียนจบ", color: "var(--chart-4)" },
    published: { label: "เผยแพร่แล้ว", color: "var(--chart-3)" },
    archived: { label: "เก็บเข้าคลัง", color: "oklch(0.50 0.01 250)" },
}

function hashIndex(id: string, mod: number) {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
    return h % mod
}

function spineWidth(wordCount: number) {
    // 0 คำ → MIN, ~120k คำ → MAX
    const t = Math.min(1, wordCount / 120000)
    return Math.round(MIN_W + t * (MAX_W - MIN_W))
}

function BookSpine({ novel }: { novel: ShelfNovel }) {
    const router = useRouter()
    const [opening, setOpening] = useState(false)
    const href = `/dashboard/project/${novel.id}`

    const binding = BINDINGS[hashIndex(novel.id, BINDINGS.length)]
    const status = STATUS[novel.status] ?? STATUS.draft
    const width = spineWidth(novel.wordCount)
    const updated = new Date(novel.updatedAt).toLocaleDateString("th-TH", {
        day: "numeric", month: "short", year: "numeric",
    })

    const handleOpen = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // let modifier / middle clicks open a new tab normally
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        if (opening) return
        const reduce = typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (reduce) {
            router.push(href)
            return
        }
        setOpening(true)
        // pull the book off the shelf, then navigate
        setTimeout(() => router.push(href), 300)
    }

    return (
        <div
            className={`group relative shrink-0 transition-transform duration-300 ease-out hover:-translate-y-3 focus-within:-translate-y-3 motion-reduce:transform-none ${opening ? "z-30" : ""}`}
            style={{ width }}
        >
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                        href={href}
                        onClick={handleOpen}
                        aria-disabled={opening}
                        className={`relative block chamfered-sm overflow-hidden noise-texture outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-[var(--forge-gold)] transition-[transform,opacity,box-shadow] duration-300 ease-out ${
                            opening
                                ? "-translate-y-6 scale-110 opacity-0 pointer-events-none [box-shadow:0_0_24px_oklch(0.75_0.18_85_/_0.6)]"
                                : ""
                        }`}
                        style={{ height: SPINE_H, background: binding }}
                    >
                        {/* headband — status color */}
                        <div className="absolute top-0 inset-x-0 h-1.5 z-10" style={{ background: status.color }} />
                        {/* subtle binding seams */}
                        <div className="absolute top-3 inset-x-1 h-px bg-white/10 z-10" />
                        <div className="absolute bottom-9 inset-x-1 h-px bg-white/10 z-10" />

                        {/* vertical title */}
                        <div className="absolute inset-x-0 top-1.5 bottom-8 z-10 flex items-center justify-center">
                            <span className="inline-block max-w-[150px] -rotate-90 whitespace-nowrap overflow-hidden text-ellipsis font-display font-semibold text-[13px] tracking-tight text-white/90">
                                {novel.title}
                            </span>
                        </div>

                        {/* foot plate — chapter count */}
                        <div className="absolute bottom-0 inset-x-0 h-8 z-10 flex items-center justify-center border-t border-white/10 bg-black/15">
                            <span className="font-technical text-[10px] tabular-nums text-white/70">
                                {novel.chaptersCount} บท
                            </span>
                        </div>
                    </Link>
                </TooltipTrigger>

                <TooltipContent side="top" sideOffset={12} className="w-64 p-0 overflow-hidden border-border">
                    <div className="p-3 space-y-2">
                        <h3 className="font-display font-semibold text-sm leading-tight text-balance">{novel.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                            {novel.description || "ยังไม่มีคำอธิบาย"}
                        </p>
                        <div className="flex items-center gap-4 text-xs pt-0.5">
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <BookOpen className="h-3 w-3" />
                                <span className="tabular-nums font-medium text-foreground">{novel.chaptersCount}</span> บท
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <PenTool className="h-3 w-3" />
                                <span className="tabular-nums font-medium text-foreground">{novel.wordCount.toLocaleString()}</span> คำ
                            </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-border/60">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                                {status.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">แก้ไข {updated}</span>
                        </div>
                    </div>
                </TooltipContent>
            </Tooltip>

            {/* actions — sibling of the link so clicks don't navigate */}
            <div className="absolute top-1 right-0.5 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <NovelActions novelId={novel.id} novelTitle={novel.title} />
            </div>
        </div>
    )
}

export function Bookshelf({ novels }: { novels: ShelfNovel[] }) {
    // Forged-steel ledge drawn once per wrapped row via a repeating background.
    const period = SPINE_H + ROW_GAP
    const shelfBg = `repeating-linear-gradient(to bottom,
        transparent 0px,
        transparent ${SPINE_H}px,
        oklch(0.62 0.02 255) ${SPINE_H}px,
        oklch(0.62 0.02 255) ${SPINE_H + 1.5}px,
        oklch(0.42 0.02 255) ${SPINE_H + 1.5}px,
        oklch(0.42 0.02 255) ${SPINE_H + 6}px,
        oklch(0.18 0.02 255) ${SPINE_H + 6}px,
        oklch(0.18 0.02 255) ${SPINE_H + 9}px,
        transparent ${SPINE_H + 9}px,
        transparent ${period}px)`

    const beamBg = "linear-gradient(to bottom, oklch(0.64 0.02 255), oklch(0.44 0.02 255) 55%, oklch(0.26 0.02 255))"

    return (
        <TooltipProvider delayDuration={120}>
            {/* Steel cabinet frame */}
            <div className="chamfered-lg border-2 border-[oklch(0.46_0.02_255)]/55 bg-card/30">
                {/* top beam (cornice) */}
                <div className="h-2.5" style={{ background: beamBg }} />
                <div className="h-px hazard-stripe-subtle" />

                {/* recessed interior */}
                <div className="relative px-3 pt-4 pb-2 bg-muted/40 [box-shadow:inset_0_2px_10px_oklch(0_0_0_/_0.22)]">
                    <div
                        className="flex flex-wrap items-start gap-x-3"
                        style={{ rowGap: ROW_GAP, backgroundImage: shelfBg }}
                    >
                        {novels.map((novel) => (
                            <BookSpine key={novel.id} novel={novel} />
                        ))}
                    </div>
                </div>

                {/* base beam */}
                <div className="h-2" style={{ background: beamBg }} />
            </div>
        </TooltipProvider>
    )
}

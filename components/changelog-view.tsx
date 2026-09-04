"use client"

import { useEffect, useState } from "react"
import { Sparkles, Wrench, Bug, Trash2, History } from "lucide-react"
import { CHANGELOG, CHANGE_KINDS, CHANGE_KIND_LABEL, CURRENT_VERSION, type ChangeKind } from "@/lib/changelog"
import { readSeenVersion, markSeen } from "@/lib/changelog-seen"
import { cn } from "@/lib/utils"

const KIND_ICON: Record<ChangeKind, typeof Sparkles> = {
    added: Sparkles,
    changed: Wrench,
    fixed: Bug,
    removed: Trash2,
}

const KIND_CLS: Record<ChangeKind, string> = {
    added: "text-[var(--forge-amber)]",
    changed: "text-blue-500",
    fixed: "text-emerald-500",
    removed: "text-muted-foreground",
}

export function ChangelogView() {
    // อ่านค่าเดิมก่อน แล้วค่อยทำเครื่องหมายว่าอ่านแล้ว — ไม่งั้นป้าย "ใหม่" หายตั้งแต่ยังไม่ทันเห็น
    const [seenBefore, setSeenBefore] = useState<string | null>(null)
    useEffect(() => {
        setSeenBefore(readSeenVersion())
        markSeen(CURRENT_VERSION)
        // แจ้ง sidebar ในแท็บเดียวกันให้เอาจุดแดงออกทันที (storage event ยิงข้ามแท็บเท่านั้น)
        window.dispatchEvent(new Event("mythoria:changelog-seen"))
    }, [])

    return (
        <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-center gap-3 mb-1">
                <History className="h-5 w-5 text-[var(--forge-amber)]" />
                <h1 className="font-display text-2xl font-semibold">มีอะไรใหม่</h1>
                <span className="font-technical text-[10px] uppercase tracking-widest text-muted-foreground border px-2 py-1 chamfered-sm">
                    v{CURRENT_VERSION}
                </span>
            </div>
            <p className="text-sm text-muted-foreground mb-8">บันทึกการเปลี่ยนแปลงของ Mythoria ทุกรุ่น ใหม่สุดอยู่บนสุด</p>

            <div className="space-y-10">
                {CHANGELOG.map(release => {
                    // "ใหม่" = รุ่นที่ออกหลังจากครั้งล่าสุดที่ผู้ใช้เปิดหน้านี้
                    const isUnread = seenBefore !== null && seenBefore !== release.version && release.version === CURRENT_VERSION
                    return (
                        <section key={release.version}>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4 pb-2 border-b">
                                <h2 className="font-display text-lg font-semibold">v{release.version}</h2>
                                <span className="text-sm text-muted-foreground">{release.title}</span>
                                <span className="ml-auto font-technical text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                                    {release.date}
                                </span>
                                {isUnread && (
                                    <span className="font-technical text-[9px] uppercase tracking-widest text-[var(--forge-amber)] border border-[var(--forge-amber)]/40 bg-amber-500/10 px-1.5 py-0.5 chamfered-sm">
                                        ใหม่
                                    </span>
                                )}
                            </div>

                            <div className="space-y-5">
                                {CHANGE_KINDS.map(kind => {
                                    const items = release.entries.filter(e => e.kind === kind)
                                    if (items.length === 0) return null
                                    const Icon = KIND_ICON[kind]
                                    return (
                                        <div key={kind}>
                                            <div className={cn("flex items-center gap-1.5 mb-2", KIND_CLS[kind])}>
                                                <Icon className="h-3.5 w-3.5" />
                                                <span className="font-technical text-[10px] uppercase tracking-widest">
                                                    {CHANGE_KIND_LABEL[kind]}
                                                </span>
                                            </div>
                                            <ul className="space-y-2.5 pl-5">
                                                {items.map((item, i) => (
                                                    <li key={i} className="text-sm leading-relaxed">
                                                        <span className="text-foreground">{item.text}</span>
                                                        {item.detail && (
                                                            <span className="block text-[13px] text-muted-foreground mt-0.5">
                                                                {item.detail}
                                                            </span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )
                })}
            </div>
        </div>
    )
}

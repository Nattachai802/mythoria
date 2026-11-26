"use client"

import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import type { TimelineEvent } from "@/db/schema"
import type { ChapterForBoard } from "./types"
import { CreateSceneDialog } from "./create-scene-dialog"
import { cn } from "@/lib/utils"

interface Props {
    novelId: string
    chapters: ChapterForBoard[] // sorted
    events: TimelineEvent[]
}

/**
 * กระดานพล็อตบนมือถือ — รายการห้องแชท: หัวบท sticky · ฉากละแถว แตะแล้วเข้าห้องแชทของฉาก
 * ponytail: ไม่มีลากเรียง/เส้นปม/ถาดไอเดียบนจอแคบ — จัดโครงหนักทำบนคอม
 */
export function MobileSceneList({ novelId, chapters, events }: Props) {
    return (
        <div className="h-full overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {chapters.map(c => {
                const list = events.filter(e => e.relatedChapterId === c.id).sort((a, b) => a.orderIndex - b.orderIndex)
                return (
                    <section key={c.id} aria-label={c.title}>
                        <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-muted/95 py-1 pl-4 pr-1 backdrop-blur-sm">
                            <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{c.title}</h2>
                            <span className="text-[11px] tabular-nums text-muted-foreground">{list.length} ฉาก</span>
                            <CreateSceneDialog
                                novelId={novelId}
                                chapterId={c.id}
                                trigger={
                                    <button type="button" className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground active:bg-background" aria-label={`เพิ่มฉากใน ${c.title}`}>
                                        <Plus className="h-4 w-4" />
                                    </button>
                                }
                            />
                        </div>
                        {list.length === 0 ? (
                            <p className="border-b px-4 py-3 text-xs text-muted-foreground">ยังไม่มีฉาก</p>
                        ) : (
                            <ul>
                                {list.map(e => {
                                    const ideas = ((e.canvasData as any[]) || []).filter(i => i?.type === "idea").length
                                    const confirmed = e.plotStatus === "confirmed"
                                    return (
                                        <li key={e.id} className="border-b">
                                            <Link href={`/dashboard/project/${novelId}/plot/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted">
                                                <span
                                                    className={cn("h-2 w-2 shrink-0 rounded-full", confirmed ? "bg-emerald-500" : "border border-muted-foreground/50")}
                                                    aria-label={confirmed ? "พล็อตแน่นอนแล้ว" : "ร่าง"}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-medium">{e.title}</span>
                                                    <span className={cn("block truncate text-xs", e.description ? "text-muted-foreground" : "text-muted-foreground/70")}>
                                                        {e.description?.split("\n")[0] || "ยังไม่มีสรุป"}
                                                    </span>
                                                </span>
                                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-label={`ไอเดีย ${ideas}`}>{ideas}</span>
                                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        )}
                    </section>
                )
            })}
        </div>
    )
}

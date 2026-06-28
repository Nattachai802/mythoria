"use client"

import { useState } from "react"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { STORY_STRUCTURES, COMPLEXITY_LABEL, type StoryStructure } from "@/lib/story-structures"

const COMPLEXITY_CLS: Record<StoryStructure["complexity"], string> = {
    Low: "text-emerald-500 border-emerald-500/30",
    Medium: "text-amber-500 border-amber-500/30",
    High: "text-rose-500 border-rose-500/30",
}

export function StoryStructureCheatSheet() {
    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState<StoryStructure | null>(null)

    return (
        <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(null) }}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <BookOpen className="h-3.5 w-3.5" />
                    โครงเรื่อง
                </Button>
            </SheetTrigger>

            <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
                {selected ? (
                    <StructureDetail structure={selected} onBack={() => setSelected(null)} />
                ) : (
                    <>
                        <SheetHeader className="p-4 border-b">
                            <SheetTitle className="font-display flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-[var(--forge-gold)]" />
                                คลังโครงเรื่อง
                            </SheetTitle>
                            <SheetDescription>
                                สูตรจังหวะเรื่อง {STORY_STRUCTURES.length} แบบไว้อ้างอิง — เลือกอันที่เข้ากับแนวของคุณ
                            </SheetDescription>
                        </SheetHeader>
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-4 space-y-2">
                                {STORY_STRUCTURES.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => setSelected(s)}
                                        className="w-full text-left chamfered-sm border border-border bg-card/50 p-3 hover:border-[var(--forge-gold)]/50 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-sm">{s.nameTh}</span>
                                            <Badge variant="outline" className={cn("text-[10px] shrink-0", COMPLEXITY_CLS[s.complexity])}>
                                                {COMPLEXITY_LABEL[s.complexity]}
                                            </Badge>
                                        </div>
                                        <div className="text-[11px] text-muted-foreground mt-0.5">{s.nameEn}</div>
                                        <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{s.description}</div>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {s.genres.slice(0, 3).map(g => (
                                                <span key={g} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 chamfered-sm">{g}</span>
                                            ))}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

function StructureDetail({ structure, onBack }: { structure: StoryStructure; onBack: () => void }) {
    return (
        <>
            <SheetHeader className="p-4 border-b">
                <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 w-fit">
                    <ChevronLeft className="h-3.5 w-3.5" />กลับ
                </button>
                <SheetTitle className="font-display">{structure.nameTh}</SheetTitle>
                <SheetDescription>{structure.nameEn} · {structure.coreFocus}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">{structure.description}</p>

                    <div className="flex flex-wrap gap-1">
                        {structure.genres.map(g => (
                            <span key={g} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 chamfered-sm">{g}</span>
                        ))}
                    </div>

                    <div className="space-y-2">
                        <div className="font-technical text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                            {structure.positional ? "จังหวะตามตำแหน่ง" : "ขั้นตอน"}
                        </div>
                        {structure.stages.map((st, i) => (
                            <div key={i} className="flex gap-3">
                                <div className="flex flex-col items-center pt-0.5 shrink-0 w-10">
                                    {st.pos != null ? (
                                        <span className="text-[11px] font-bold tabular-nums text-[var(--forge-amber)]">{st.pos}%</span>
                                    ) : (
                                        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{i + 1}</span>
                                    )}
                                </div>
                                <div className="flex-1 pb-2 border-b border-border/40">
                                    <div className="text-sm font-medium">
                                        {st.nameTh ?? st.name}
                                        {st.nameTh && <span className="text-[10px] text-muted-foreground ml-1.5">{st.name}</span>}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{st.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </ScrollArea>
        </>
    )
}

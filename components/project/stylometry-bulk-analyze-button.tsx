"use client"

import { useState } from "react"
import { Loader2, Check, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

interface Note {
    id: string
    title: string
    linkedToChapterId?: string | null
}

interface Chapter {
    id: string
    title: string
}

interface Props {
    novelId: string
    notes: Note[]
    chapters: Chapter[]
    totalNotesCount: number
    analyzedCount: number
}

// Quill pen with a waveform being drawn beneath — represents stylometric analysis
function QuillWriter() {
    return (
        <div className="quill-writer">
            <div className="quill-body">
                <div className="quill-shaft" />
                <div className="quill-barbs barbs-left" />
                <div className="quill-barbs barbs-right" />
                <div className="quill-nib" />
            </div>
            <svg className="quill-wave" viewBox="0 0 36 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M0 5 Q4.5 1 9 5 Q13.5 9 18 5 Q22.5 1 27 5 Q31.5 9 36 5"
                    stroke="hsl(223, 10%, 45%)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    className="wave-path"
                />
            </svg>
            <style jsx>{`
                .quill-writer {
                    width: 2em;
                    height: 2.4em;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 0.25em;
                    flex-shrink: 0;
                }
                .quill-body {
                    position: relative;
                    width: 1.2em;
                    height: 1.5em;
                    transform: rotate(-30deg);
                    transform-origin: bottom center;
                }
                .quill-shaft {
                    position: absolute;
                    left: 50%;
                    top: 0;
                    bottom: 0.3em;
                    width: 0.12em;
                    transform: translateX(-50%);
                    background: linear-gradient(
                        to bottom,
                        hsl(40, 15%, 75%) 0%,
                        hsl(40, 15%, 55%) 100%
                    );
                    border-radius: 0.06em;
                }
                .quill-barbs {
                    position: absolute;
                    top: 0.1em;
                    bottom: 0.5em;
                    width: 0.45em;
                    border-radius: 0.5em 0 0 0.5em;
                    background: linear-gradient(
                        to bottom,
                        hsl(40, 20%, 82%) 0%,
                        hsl(40, 15%, 65%) 100%
                    );
                }
                .barbs-left  { right: 50%; transform-origin: right center; transform: skewY(8deg); }
                .barbs-right {
                    left: 50%;
                    border-radius: 0 0.5em 0.5em 0;
                    background: linear-gradient(
                        to bottom,
                        hsl(40, 20%, 78%) 0%,
                        hsl(40, 15%, 60%) 100%
                    );
                    transform-origin: left center;
                    transform: skewY(-8deg);
                }
                .quill-nib {
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0;
                    height: 0;
                    border-left: 0.15em solid transparent;
                    border-right: 0.15em solid transparent;
                    border-top: 0.35em solid hsl(223, 10%, 30%);
                }
                .quill-wave {
                    width: 2em;
                    height: 0.65em;
                    overflow: visible;
                }
                .wave-path {
                    stroke-dasharray: 48;
                    stroke-dashoffset: 48;
                    animation: draw-wave 2.4s ease-in-out infinite;
                }
                @keyframes draw-wave {
                    0%    { stroke-dashoffset: 48; opacity: 0.3; }
                    10%   { opacity: 1; }
                    65%   { stroke-dashoffset: 0; opacity: 1; }
                    85%   { stroke-dashoffset: 0; opacity: 0; }
                    100%  { stroke-dashoffset: 48; opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .wave-path { animation: none; stroke-dashoffset: 0; opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}

export function StylometryBulkAnalyzeButton({ novelId, notes, chapters, totalNotesCount, analyzedCount }: Props) {
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [open, setOpen] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const router = useRouter()

    const handleToggleAll = () => {
        if (selectedIds.size === notes.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(notes.map(n => n.id)))
        }
    }

    const handleToggleNote = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedIds(next)
    }

    const handleAnalyzeSelected = async () => {
        const idsArray = Array.from(selectedIds)
        if (idsArray.length === 0) {
            toast.error("กรุณาเลือกอย่างน้อย 1 รายการ")
            return
        }

        setIsAnalyzing(true)
        setProgress(0)
        let successCount = 0

        for (let i = 0; i < idsArray.length; i++) {
            try {
                const res = await fetch(`/api/novel/${novelId}/note/${idsArray[i]}/stylometry`, {
                    method: 'POST'
                })
                if (res.ok) {
                    successCount++
                }
            } catch (e) {
                console.error("Failed to analyze unit:", idsArray[i], e)
            }
            setProgress(Math.round(((i + 1) / idsArray.length) * 100))
        }

        setIsAnalyzing(false)
        if (successCount === idsArray.length) {
            toast.success("วิเคราะห์รายการที่เลือกเสร็จสิ้น!")
        } else {
            toast.warning(`วิเคราะห์สำเร็จ ${successCount}/${idsArray.length} รายการ`)
        }
        
        setOpen(false)
        router.refresh()
    }

    // Grouping notes by chapter
    const unlinkedNotes = notes.filter(n => !n.linkedToChapterId)
    const notesByChapter = chapters.map(ch => ({
        ...ch,
        notes: notes.filter(n => n.linkedToChapterId === ch.id)
    })).filter(ch => ch.notes.length > 0)

    return (
        <div className="flex items-center gap-2.5 px-3 py-2">
            <QuillWriter />
            <span className="flex-1 text-xs font-medium">วิเคราะห์ลีลาการเขียน</span>
            <Dialog open={open} onOpenChange={(val) => !isAnalyzing && setOpen(val)}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={notes.length === 0}
                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
                >
                    {notes.length === 0 && analyzedCount > 0 ? "ครบแล้ว" : `เลือก (${notes.length}) →`}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>เครื่องมือวิเคราะห์ลีลาการเขียน</DialogTitle>
                    <DialogDescription>
                        {notes.length === 0 ? "คุณได้วิเคราะห์โน้ตที่มีทั้งหมดครบถ้วนแล้ว!" : `เลือกโน้ตที่เพิ่งแต่งใหม่หรือยังไม่ได้วิเคราะห์ (${notes.length} รายการ)`}
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-muted/30 p-3 rounded-md text-[11px] mb-2">
                    <div className="flex justify-between mb-1">
                        <span>ความคืบหน้าการวิเคราะห์รวม:</span>
                        <span className="font-semibold text-primary">{analyzedCount} / {totalNotesCount} โน้ต</span>
                    </div>
                    <Progress value={(analyzedCount / totalNotesCount) * 100} className="h-1" />
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-xs font-medium text-muted-foreground">
                        {notes.length === 0 ? "ไม่มีรายการใหม่" : `เลือกแล้ว ${selectedIds.size} รายการ`}
                    </span>
                    {notes.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleToggleAll} className="h-7 text-[10px]">
                            {selectedIds.size === notes.length ? "ไม่เลือกเลย" : "เลือกทั้งหมด"}
                        </Button>
                    )}
                </div>

                <ScrollArea className="h-[250px] mt-2 pr-4">
                    <div className="space-y-4">
                        {notesByChapter.map(ch => (
                            <div key={ch.id} className="space-y-2">
                                <div className="flex items-center gap-2 text-xs font-semibold text-primary/80 sticky top-0 bg-background py-1">
                                    <ChevronRight className="h-3 w-3" />
                                    {ch.title}
                                </div>
                                <div className="pl-4 space-y-2">
                                    {ch.notes.map(note => (
                                        <div key={note.id} className="flex items-center space-x-2">
                                            <Checkbox 
                                                id={note.id} 
                                                checked={selectedIds.has(note.id)}
                                                onCheckedChange={() => handleToggleNote(note.id)}
                                            />
                                            <label 
                                                htmlFor={note.id}
                                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer line-clamp-1"
                                            >
                                                {note.title}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        {notesByChapter.length === 0 && (
                            <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
                                <div className="p-3 rounded-full bg-emerald-500/10 mb-3">
                                    <Check className="h-6 w-6 text-emerald-600" />
                                </div>
                                <p className="text-sm text-muted-foreground font-medium">ทุกอย่างพร้อมแล้ว!</p>
                                <p className="text-xs text-muted-foreground/70">วิเคราะห์ข้อมูลครบทุกตอนที่ผูกกับ Chapter แล้วครับ</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                {isAnalyzing && (
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-xs">
                            <span className="animate-pulse flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                กำลังประมวลผล...
                            </span>
                            <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                    </div>
                )}

                <DialogFooter className="mt-4">
                    <Button 
                        onClick={handleAnalyzeSelected} 
                        disabled={isAnalyzing || selectedIds.size === 0}
                        className="w-full"
                    >
                        {isAnalyzing ? "กำลังประมวลผล..." : "เริ่มวิเคราะห์รายการที่เลือก"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </div>
    )
}

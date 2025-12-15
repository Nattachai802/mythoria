"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Trash2, Maximize2, Minimize2, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { updateNote, deleteNote } from "@/server/note"
import { checkWordCountSufficiency, WordCountStatus } from "@/server/word-check"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { NoteCastDeck } from "@/components/project/note-cast-deck"
import { ExtractionStatus } from "@/components/project/extraction-status"
import { CharacterStateEditor } from "@/components/project/character-state-editor"
import { PlotHoleChecker } from "@/components/project/plot-hole-checker"

import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

/**
 * A4 Page Configuration
 * 
 * Based on standard A4 paper with default margins:
 * - A4 size: 21cm × 29.7cm
 * - Standard margins: 2.54cm (1 inch) on all sides
 * - Usable area: ~15.9cm × 24.6cm
 * - With 12pt font and 1.5 line-height: ~32-35 lines per page
 * 
 * For Thai text (which tends to have more characters per word):
 * - Approximately 400-500 words per A4 page
 * 
 * We use LINES_PER_PAGE = 35 as the standard
 */
const LINES_PER_PAGE = 35;

interface NoteEditorProps {
    note: any
    novelId: string
}

export function NoteEditor({ note, novelId }: NoteEditorProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [title, setTitle] = useState(note.title)
    const [content, setContent] = useState(note.content?.text || "")
    const [isFocusMode, setIsFocusMode] = useState(false)
    const [wordStatus, setWordStatus] = useState<WordCountStatus | null>(null)

    const currentDataRef = useRef({ title, content })
    const lastSavedDataRef = useRef({ title: note.title, content: note.content?.text || "" })

    // Word count calculation
    const wordCount = useMemo(() => {
        const text = content
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .trim();

        if (!text) return 0;

        if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
            try {
                const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
                let count = 0;
                for (const segment of segmenter.segment(text)) {
                    if (segment.isWordLike) {
                        count++;
                    }
                }
                return count;
            } catch (e) {
                // Fallback if something goes wrong
            }
        }

        return text.replace(/\s+/g, ' ').trim().split(' ').length;
    }, [content]);

    /**
     * Line count calculation
     * 
     * Logic: Count the number of <p>, <br>, <li>, and header tags in the HTML
     * Each of these represents a "line" in the visual output
     * 
     * Additional logic:
     * - Long paragraphs wrap, so we estimate wrapping based on character count
     * - Approximately 60-80 characters per line in A4 (assuming Thai text)
     */
    const lineCount = useMemo(() => {
        if (!content) return 0;

        // Count explicit line breaks and block elements
        const blockTags = content.match(/<(p|br|li|h[1-6])[^>]*>/gi) || [];
        let lines = blockTags.length;

        // Estimate wrapped lines based on content length
        // Remove HTML tags to get plain text
        const plainText = content
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();

        // Approximately 50 Thai characters or 70 English characters per line
        // Using 55 as a middle ground
        const CHARS_PER_LINE = 55;
        const estimatedWrapLines = Math.max(0, Math.floor(plainText.length / CHARS_PER_LINE) - lines);

        lines += estimatedWrapLines;

        // Minimum 1 line if there's any content
        return Math.max(plainText.length > 0 ? 1 : 0, lines);
    }, [content]);

    /**
     * Page count calculation
     * Based on lines per page (A4 standard)
     */
    const pageCount = useMemo(() => {
        return Math.max(1, Math.ceil(lineCount / LINES_PER_PAGE));
    }, [lineCount]);

    /**
     * Current page (based on cursor position - simplified: based on content proportion)
     * For now, we just show total pages. Could be enhanced with cursor tracking.
     */
    const currentPage = useMemo(() => {
        // Simplified: just return last page for now
        // A more advanced implementation would track cursor position
        return pageCount;
    }, [pageCount]);

    useEffect(() => {
        currentDataRef.current = { title, content }
    }, [title, content])

    // Check word count sufficiency (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            try {
                const status = await checkWordCountSufficiency(
                    novelId,
                    note.linkedToChapterId,
                    wordCount
                );
                setWordStatus(status);
            } catch (error) {
                console.error("Word check failed:", error);
            }
        }, 1000); // Debounce 1 second

        return () => clearTimeout(timeoutId);
    }, [novelId, note.linkedToChapterId, wordCount]);

    useEffect(() => {
        const interval = setInterval(async () => {
            const current = currentDataRef.current
            const last = lastSavedDataRef.current

            if (current.title !== last.title || current.content !== last.content) {
                console.log("Auto-saving...")
                try {
                    await updateNote(note.id, {
                        title: current.title,
                        content: { text: current.content }
                    })
                    lastSavedDataRef.current = current
                    toast.success("Auto-saved", { duration: 1000 })
                } catch (error) {
                    console.error("Auto-save failed", error)
                }
            }
        }, 20000)
        return () => clearInterval(interval)
    }, [note.id])

    async function handleSave() {
        setLoading(true)
        try {
            const result = await updateNote(note.id, {
                title,
                content: { text: content }
            })
            if (result.success) {
                toast.success("Saved successfully")
                router.refresh()
            } else {
                toast.error("Failed to save")
            }
        } catch (error) {
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete() {
        try {
            const result = await deleteNote(note.id)
            if (result.success) {
                toast.success("Note deleted")
                router.push(`/dashboard/project/${novelId}`)
                router.refresh()
            }
        } catch (error) {
            toast.error("Failed to delete")
        }
    }

    const modules = useMemo(() => ({
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['clean']
        ],
        clipboard: {
            // Preserve line breaks and paragraph structure when pasting
            matchVisual: false,
        },
    }), [])

    return (
        <div className={cn(
            "flex flex-col gap-4 transition-all duration-300 bg-background",
            isFocusMode
                ? "fixed inset-0 z-50 p-4 md:p-8 h-screen w-screen"
                : "h-[calc(100vh-4rem)]"
        )}>
            {/* Header - Clean Design */}
            <div className={cn(
                "flex flex-col gap-2 border-b pb-3 transition-all duration-300",
                isFocusMode && "max-w-4xl mx-auto w-full"
            )}>
                {/* Row 1: Back + Title + Actions */}
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="shrink-0 -ml-2" asChild>
                        <Link href={`/dashboard/project/${novelId}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>

                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="flex-1 text-lg font-semibold border-none shadow-none focus-visible:ring-0 px-0 h-auto bg-transparent"
                        placeholder="Untitled Note"
                    />

                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFocusMode(!isFocusMode)}
                            title={isFocusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
                        >
                            {isFocusMode ? (
                                <Minimize2 className="h-4 w-4" />
                            ) : (
                                <Maximize2 className="h-4 w-4" />
                            )}
                        </Button>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your note.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <Button variant="ghost" size="icon" onClick={handleSave} disabled={loading}>
                            <Save className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Row 2: Stats bar - Minimal */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                    {/* Word/Line/Page stats - Collapsed */}
                    <div className="flex items-center gap-2">
                        <span>{wordCount.toLocaleString()} คำ</span>
                        <span className="opacity-30">·</span>
                        <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3 opacity-50" />
                            {pageCount}
                        </span>
                    </div>

                    {/* Progress - Only show if linked to chapter */}
                    {wordStatus && (
                        <div className="flex items-center gap-2">
                            <div className={cn(
                                "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                                wordStatus.hasEnoughWords
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-amber-600 dark:text-amber-400"
                            )}>
                                {wordStatus.hasEnoughWords ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                    <AlertCircle className="h-3 w-3" />
                                )}
                                <span>{wordStatus.percentComplete}%</span>
                            </div>
                            <Progress
                                value={Math.min(100, wordStatus.percentComplete)}
                                className={cn(
                                    "w-16 h-1",
                                    wordStatus.hasEnoughWords
                                        ? "[&>div]:bg-emerald-500"
                                        : "[&>div]:bg-amber-500"
                                )}
                            />
                        </div>
                    )}

                    {/* Extraction Status - Subtle */}
                    <ExtractionStatus noteId={note.id} />

                    {/* Plot Hole Checker */}
                    <div className="ml-auto">
                        <PlotHoleChecker
                            novelId={novelId}
                            noteId={note.id}
                            content={content}
                        />
                    </div>
                </div>
            </div>

            {!isFocusMode && (
                <div className="shrink-0 flex gap-4">
                    <div className="flex-1">
                        <NoteCastDeck
                            noteId={note.id}
                            novelId={novelId}
                            linkedChapterId={note.linkedToChapterId}
                            content={content}
                        />
                    </div>
                    <div className="w-80 shrink-0">
                        <CharacterStateEditor noteId={note.id} />
                    </div>
                </div>
            )}

            <div className={cn(
                "flex-1 h-full overflow-hidden flex flex-col transition-all duration-300",
                isFocusMode && "max-w-4xl mx-auto w-full"
            )}>
                <ReactQuill
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    className="h-full flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-container]:text-base"
                    placeholder="Start writing your scene..."
                />
            </div>
        </div>
    )
}
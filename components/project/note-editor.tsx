"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Trash2, Maximize2, Minimize2, FileText, CheckCircle2, AlertCircle, PanelRightClose, PanelRightOpen, AlignCenter, Cloud, CloudOff, Loader2 } from "lucide-react"
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

/**
 * A4 Page Configuration
 */
const LINES_PER_PAGE = 35;

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

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
    const [isTypewriterMode, setIsTypewriterMode] = useState(true)
    const [showSidebar, setShowSidebar] = useState(true)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
    const [showZenControls, setShowZenControls] = useState(false)
    const [wordStatus, setWordStatus] = useState<WordCountStatus | null>(null)

    const editorContainerRef = useRef<HTMLDivElement>(null)
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

    const lineCount = useMemo(() => {
        if (!content) return 0;
        const blockTags = content.match(/<(p|br|li|h[1-6])[^>]*>/gi) || [];
        let lines = blockTags.length;
        const plainText = content
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim();
        const CHARS_PER_LINE = 55;
        const estimatedWrapLines = Math.max(0, Math.floor(plainText.length / CHARS_PER_LINE) - lines);
        lines += estimatedWrapLines;
        return Math.max(plainText.length > 0 ? 1 : 0, lines);
    }, [content]);

    const pageCount = useMemo(() => {
        return Math.max(1, Math.ceil(lineCount / LINES_PER_PAGE));
    }, [lineCount]);

    // Track unsaved changes
    useEffect(() => {
        currentDataRef.current = { title, content }
        const last = lastSavedDataRef.current
        if (title !== last.title || content !== last.content) {
            setSaveStatus('unsaved')
        }
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
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [novelId, note.linkedToChapterId, wordCount]);

    // Auto-save with subtle indicator
    useEffect(() => {
        const interval = setInterval(async () => {
            const current = currentDataRef.current
            const last = lastSavedDataRef.current

            if (current.title !== last.title || current.content !== last.content) {
                setSaveStatus('saving')
                try {
                    await updateNote(note.id, {
                        title: current.title,
                        content: { text: current.content }
                    })
                    lastSavedDataRef.current = { ...current }
                    setSaveStatus('saved')
                } catch (error) {
                    console.error("Auto-save failed", error)
                    setSaveStatus('error')
                }
            }
        }, 20000)
        return () => clearInterval(interval)
    }, [note.id])

    // Typewriter mode: center the current line
    useEffect(() => {
        if (!isTypewriterMode) return

        const handleSelectionChange = () => {
            try {
                const container = editorContainerRef.current?.querySelector('.ql-editor')
                if (!container) return

                const selection = window.getSelection()
                if (!selection || selection.rangeCount === 0) return

                const range = selection.getRangeAt(0)
                const rect = range.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()

                // Calculate scroll position to center the cursor
                const cursorOffsetInContainer = rect.top - containerRect.top + container.scrollTop
                const centerOffset = container.clientHeight / 2
                const targetScroll = cursorOffsetInContainer - centerOffset

                container.scrollTo({
                    top: Math.max(0, targetScroll),
                    behavior: 'smooth'
                })
            } catch (e) {
                // Ignore errors from selection API
            }
        }

        // Debounced handler
        let timeout: NodeJS.Timeout
        const debouncedHandler = () => {
            clearTimeout(timeout)
            timeout = setTimeout(handleSelectionChange, 50)
        }

        document.addEventListener('selectionchange', debouncedHandler)
        return () => {
            document.removeEventListener('selectionchange', debouncedHandler)
            clearTimeout(timeout)
        }
    }, [isTypewriterMode])

    // Zen mode: show controls on mouse near top
    useEffect(() => {
        if (!isFocusMode) return

        const handleMouseMove = (e: MouseEvent) => {
            setShowZenControls(e.clientY < 80)
        }

        document.addEventListener('mousemove', handleMouseMove)
        return () => document.removeEventListener('mousemove', handleMouseMove)
    }, [isFocusMode])

    async function handleSave() {
        setLoading(true)
        setSaveStatus('saving')
        try {
            const result = await updateNote(note.id, {
                title,
                content: { text: content }
            })
            if (result.success) {
                lastSavedDataRef.current = { title, content }
                setSaveStatus('saved')
                toast.success("Saved successfully")
                router.refresh()
            } else {
                setSaveStatus('error')
                toast.error("Failed to save")
            }
        } catch (error) {
            setSaveStatus('error')
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
        toolbar: isFocusMode ? false : [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['clean']
        ],
        clipboard: {
            matchVisual: false,
        },
    }), [isFocusMode])

    // Save status indicator component
    const SaveStatusIndicator = () => {
        const statusConfig = {
            saved: { icon: Cloud, text: 'Saved', className: 'text-muted-foreground/50' },
            saving: { icon: Loader2, text: 'Saving...', className: 'text-muted-foreground animate-pulse' },
            unsaved: { icon: CloudOff, text: 'Unsaved', className: 'text-amber-500/70' },
            error: { icon: CloudOff, text: 'Error', className: 'text-destructive/70' },
        }
        const config = statusConfig[saveStatus]
        const Icon = config.icon

        return (
            <span className={cn("flex items-center gap-1 text-xs transition-all duration-300", config.className)}>
                <Icon className={cn("h-3 w-3", saveStatus === 'saving' && "animate-spin")} />
                <span className="hidden sm:inline">{config.text}</span>
            </span>
        )
    }

    return (
        <TooltipProvider>
            <div className={cn(
                "flex flex-col gap-4 transition-all duration-300 bg-background",
                isFocusMode
                    ? "fixed inset-0 z-50 p-0 h-screen w-screen"
                    : "h-[calc(100vh-4rem)]"
            )}>
                {/* Header - Hidden in Zen Mode, shows on hover */}
                <div className={cn(
                    "flex flex-col gap-2 border-b pb-3 transition-all duration-300",
                    isFocusMode && "fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm px-4 py-2 border-b",
                    isFocusMode && !showZenControls && "opacity-0 -translate-y-full pointer-events-none",
                    isFocusMode && showZenControls && "opacity-100 translate-y-0",
                    !isFocusMode && "px-0"
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
                            {/* Save Status */}
                            <SaveStatusIndicator />

                            {/* Typewriter Mode Toggle */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={isTypewriterMode ? "secondary" : "ghost"}
                                        size="icon"
                                        onClick={() => setIsTypewriterMode(!isTypewriterMode)}
                                    >
                                        <AlignCenter className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isTypewriterMode ? "Disable" : "Enable"} Typewriter Mode</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Focus/Zen Mode Toggle */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsFocusMode(!isFocusMode)}
                                    >
                                        {isFocusMode ? (
                                            <Minimize2 className="h-4 w-4" />
                                        ) : (
                                            <Maximize2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isFocusMode ? "Exit Zen Mode" : "Enter Zen Mode"}</p>
                                </TooltipContent>
                            </Tooltip>

                            {/* Sidebar Toggle (only outside focus mode) */}
                            {!isFocusMode && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setShowSidebar(!showSidebar)}
                                        >
                                            {showSidebar ? (
                                                <PanelRightClose className="h-4 w-4" />
                                            ) : (
                                                <PanelRightOpen className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>{showSidebar ? "Hide" : "Show"} Side Panel</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

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

                    {/* Row 2: Stats bar - Minimal (hidden in zen mode) */}
                    {!isFocusMode && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
                            <div className="flex items-center gap-2">
                                <span>{wordCount.toLocaleString()} คำ</span>
                                <span className="opacity-30">·</span>
                                <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3 opacity-50" />
                                    {pageCount}
                                </span>
                            </div>

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

                            <ExtractionStatus noteId={note.id} />

                            <div className="ml-auto">
                                <PlotHoleChecker
                                    novelId={novelId}
                                    noteId={note.id}
                                    content={content}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Main content area */}
                <div className={cn(
                    "flex-1 flex gap-4 overflow-hidden transition-all duration-300",
                    isFocusMode && "pt-0"
                )}>
                    {/* Editor */}
                    <div
                        ref={editorContainerRef}
                        className={cn(
                            "flex-1 h-full overflow-hidden flex flex-col transition-all duration-300",
                            isFocusMode && "max-w-4xl mx-auto w-full px-2 md:px-4 pt-4"
                        )}
                    >
                        <ReactQuill
                            theme="snow"
                            value={content}
                            onChange={setContent}
                            modules={modules}
                            className={cn(
                                "h-full flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-container]:text-base",
                                isFocusMode && "[&>.ql-toolbar]:hidden [&>.ql-container]:border-none [&>.ql-editor]:text-lg [&>.ql-editor]:leading-relaxed"
                            )}
                            placeholder="Start writing your scene..."
                        />
                    </div>

                    {/* Collapsible Sidebar */}
                    {!isFocusMode && (
                        <div className={cn(
                            "shrink-0 flex flex-col gap-4 overflow-hidden transition-all duration-300 ease-in-out",
                            showSidebar ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"
                        )}>
                            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                                <NoteCastDeck
                                    noteId={note.id}
                                    novelId={novelId}
                                    linkedChapterId={note.linkedToChapterId}
                                    content={content}
                                />
                                <CharacterStateEditor noteId={note.id} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </TooltipProvider>
    )
}
"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Save, ArrowLeft, Trash2, Maximize2, Minimize2, FileText, CheckCircle2, AlertCircle, PanelRightClose, PanelRightOpen, AlignCenter, Cloud, CloudOff, Loader2, ChevronLeft, ChevronRight, X, MoreHorizontal, Sparkles, History, BarChart, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { updateNote, deleteNote, getOrCreateNextNote, getPreviousNote } from "@/server/note"
import { createNoteVersion } from "@/server/version-history"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
// Static imports (always needed)
import { ExtractionStatus } from "@/components/project/extraction-status"
import { DriveSyncButton } from "@/components/project/drive-sync-button"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

// Dynamic imports — only loaded when user opens panels/sidebar
const NoteCastDeck = dynamic(() => import("@/components/project/note-cast-deck").then(m => ({ default: m.NoteCastDeck })), { ssr: false })
const CharacterStateEditor = dynamic(() => import("@/components/project/character-state-editor").then(m => ({ default: m.CharacterStateEditor })), { ssr: false })
const PlotHoleChecker = dynamic(() => import("@/components/project/plot-hole-checker").then(m => ({ default: m.PlotHoleChecker })), { ssr: false })
const VersionHistoryPanel = dynamic(() => import("@/components/project/version-history-panel").then(m => ({ default: m.VersionHistoryPanel })), { ssr: false })
const NoteSummaryButton = dynamic(() => import("@/components/project/note-summary-button").then(m => ({ default: m.NoteSummaryButton })), { ssr: false })
const AIReviewPanel = dynamic(() => import("@/components/project/ai-review-panel").then(m => ({ default: m.AIReviewPanel })), { ssr: false })
const NotePlotPanel = dynamic(() => import("@/components/project/note-plot-panel").then(m => ({ default: m.NotePlotPanel })), { ssr: false })
const NoteReferencePanel = dynamic(() => import("@/components/project/note-reference-panel").then(m => ({ default: m.NoteReferencePanel })), { ssr: false })

import "react-quill-new/dist/quill.bubble.css";
import "react-quill-new/dist/quill.snow.css";
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

// A4 page: ~1500 characters (including spaces) per page
const CHARS_PER_PAGE = 1500;

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
    const [showSidebar, setShowSidebar] = useState(false)
    const [showReference, setShowReference] = useState(false)
    const [referenceWidth, setReferenceWidth] = useState(400)
    const [isDragging, setIsDragging] = useState(false)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
    const [showZenControls, setShowZenControls] = useState(false)
    const [wordStatus, setWordStatus] = useState<WordCountStatus | null>(null)
    const [isNavigating, setIsNavigating] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const editorContainerRef = useRef<HTMLDivElement>(null)
    const currentDataRef = useRef({ title, content })
    const lastSavedDataRef = useRef({ title: note.title, content: note.content?.text || "" })

    // Document statistics calculation
    const stats = useMemo(() => {
        if (!content) return { words: 0, charsWithSpaces: 0, charsWithoutSpaces: 0, pages: 1 };

        const plainText = content
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();

        const charsWithSpaces = plainText.length;
        const plainTextNoSpace = plainText.replace(/\s+/g, '');
        const charsWithoutSpaces = plainTextNoSpace.length;

        let words = 0;
        if (plainText) {
            if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
                try {
                    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
                    for (const segment of segmenter.segment(plainText)) {
                        if (segment.isWordLike) {
                            words++;
                        }
                    }
                } catch (e) {
                    words = plainText.split(' ').filter(Boolean).length;
                }
            } else {
                words = plainText.split(' ').filter(Boolean).length;
            }
        }

        // ประเมินหน้ากระดาษ A4 มาตรฐาน (ประมาณ 1500 ตัวอักษรรวมช่องว่าง ต่อ 1 หน้า แบบไม่แน่นเกินไปเหมาะกับนิยาย)
        const charsPerPage = 1500;
        const pages = Math.max(1, Math.ceil(charsWithSpaces / charsPerPage));

        return { words, charsWithSpaces, charsWithoutSpaces, pages };
    }, [content]);

    const wordCount = stats.words;
    const pageCount = stats.pages;

    // Track unsaved changes
    useEffect(() => {
        currentDataRef.current = { title, content }
        const last = lastSavedDataRef.current
        if (title !== last.title || content !== last.content) {
            setSaveStatus('unsaved')
        }
    }, [title, content])

    // Resizer logic
    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    useEffect(() => {
        if (!isDragging) return

        const handleMouseMove = (e: MouseEvent) => {
            // Constrain width between 250px and 60% of window width
            const newWidth = Math.max(250, Math.min(e.clientX, window.innerWidth * 0.6))
            setReferenceWidth(newWidth)
        }
        
        const handleMouseUp = () => {
            setIsDragging(false)
        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
        
        // Disable text selection while dragging
        document.body.style.userSelect = 'none'
        
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.userSelect = ''
        }
    }, [isDragging])

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
                    // บันทึก version (auto-save)
                    const currentWordCount = current.content
                        .replace(/<[^>]*>/g, ' ')
                        .replace(/&nbsp;/g, ' ')
                        .trim()
                        .split(/\s+/).length
                    await createNoteVersion(note.id, current.title, { text: current.content }, currentWordCount, "auto")
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

    // Manual save function
    const manualSave = useCallback(async () => {
        const current = currentDataRef.current
        const last = lastSavedDataRef.current

        if (current.title === last.title && current.content === last.content) {
            toast.info("ไม่มีการเปลี่ยนแปลง")
            return
        }

        setSaveStatus('saving')
        try {
            await updateNote(note.id, {
                title: current.title,
                content: { text: current.content }
            })
            // บันทึก version (manual save)
            const currentWordCount = current.content
                .replace(/<[^>]*>/g, ' ')
                .replace(/&nbsp;/g, ' ')
                .trim()
                .split(/\s+/).length
            await createNoteVersion(note.id, current.title, { text: current.content }, currentWordCount, "manual")
            lastSavedDataRef.current = { ...current }
            setSaveStatus('saved')
            toast.success("บันทึกแล้ว!")
        } catch (error) {
            console.error("Manual save failed", error)
            setSaveStatus('error')
            toast.error("บันทึกไม่สำเร็จ")
        }
    }, [note.id])

    // Navigate to next note (or create one if not exists)
    // Server action return redirectUrl → client ทำ SPA navigation เอง (เร็วกว่า server redirect)
    const handleNextNote = async () => {
        console.log("[NextNote] Button clicked!", { noteId: note.id, novelId, linkedToChapterId: note.linkedToChapterId })
        setIsNavigating(true)
        try {
            // Timeout 10s เพื่อไม่ให้ค้างตลอด
            console.log("[NextNote] Calling getOrCreateNextNote...")
            const result = await Promise.race([
                getOrCreateNextNote(note.id, novelId, note.linkedToChapterId ?? null),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("timeout")), 10000)
                )
            ])
            console.log("[NextNote] Server action result:", JSON.stringify(result))
            if (result.success && result.redirectUrl) {
                console.log("[NextNote] Navigating to:", result.redirectUrl)
                router.push(result.redirectUrl)
            } else {
                console.log("[NextNote] No redirectUrl or failed:", result.message)
                toast.error(result.message || "ไม่สามารถไปตอนถัดไปได้")
                setIsNavigating(false)
            }
        } catch (error) {
            console.error("[NextNote] Error:", error)
            toast.error(error instanceof Error && error.message === "timeout"
                ? "ประมวลผลนานเกินไป กรุณาลองใหม่"
                : "เกิดข้อผิดพลาด")
            setIsNavigating(false)
        }
    }

    // Navigate to previous note in the same chapter
    const handlePrevNote = async () => {
        setIsNavigating(true)
        try {
            const result = await Promise.race([
                getPreviousNote(note.id, novelId, note.linkedToChapterId ?? null),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("timeout")), 10000)
                )
            ])
            if (result.success && result.redirectUrl) {
                router.push(result.redirectUrl)
            } else {
                toast.info(result.message || "ไม่มีตอนก่อนหน้า")
                setIsNavigating(false)
            }
        } catch (error) {
            console.error("[PrevNote] Error:", error)
            toast.error(error instanceof Error && error.message === "timeout"
                ? "ประมวลผลนานเกินไป กรุณาลองใหม่"
                : "เกิดข้อผิดพลาด")
            setIsNavigating(false)
        }
    }

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            await manualSave();
            
            const res = await fetch(`/api/novel/${novelId}/note/${note.id}/stylometry`, {
                method: 'POST',
            });
            const data = await res.json();
            
            if (data.success) {
                toast.success("วิเคราะห์อารมณ์และลีลาการเขียนสำเร็จ");
            } else {
                toast.error(data.error || "เกิดข้อผิดพลาดในการวิเคราะห์");
            }
        } catch (e) {
            toast.error("เชื่อมต่อระบบวิเคราะห์ล้มเหลว");
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Keyboard shortcuts - Ctrl+S to save
    useKeyboardShortcuts({
        onSave: manualSave,
    })

    // Typewriter mode: center the current line
    useEffect(() => {
        if (!isTypewriterMode) return

        let lastInteraction = 'keyboard'

        const handleMouseDown = () => {
            lastInteraction = 'mouse'
        }

        const handleKeyDown = () => {
            lastInteraction = 'keyboard'
        }

        const handleSelectionChange = () => {
            // ไม่ทำการเลื่อนหน้าจอหากมาจากการคลิกเมาส์
            if (lastInteraction === 'mouse') return

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

        document.addEventListener('mousedown', handleMouseDown)
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('selectionchange', debouncedHandler)
        
        return () => {
            document.removeEventListener('mousedown', handleMouseDown)
            document.removeEventListener('keydown', handleKeyDown)
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
                // บันทึก version (manual save)
                await createNoteVersion(note.id, title, { text: content }, wordCount, "manual")
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
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['clean']
        ],
        clipboard: {
            matchVisual: true,
        },
    }), [])

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
                "flex flex-col transition-all duration-300 bg-background",
                isFocusMode
                    ? "fixed inset-0 z-50 p-0 h-screen w-screen"
                    : "h-[calc(100vh-4rem)]"
            )}>
                {/* Single Header Row — Title + Stats + Actions */}
                <div className={cn(
                    "flex items-center gap-2 border-b px-2 py-1.5 transition-all duration-300 shrink-0",
                    isFocusMode && "fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b",
                    isFocusMode && !showZenControls && "opacity-0 -translate-y-full pointer-events-none",
                    isFocusMode && showZenControls && "opacity-100 translate-y-0"
                )}>
                    {/* Left: Previous Note + Title */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={handlePrevNote}
                                disabled={isNavigating}
                            >
                                {isNavigating ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>ตอนก่อนหน้า</p>
                        </TooltipContent>
                    </Tooltip>

                    <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="flex-1 text-sm font-semibold border-none shadow-none focus-visible:ring-0 focus-visible:border-b-primary px-1 h-7 bg-transparent min-w-[120px] max-w-[300px] border-b border-b-transparent hover:border-b-muted-foreground/30 focus:border-b-primary transition-colors"
                        placeholder="Untitled Note"
                    />

                    {/* Center: Stats (inline, compact) */}
                    {!isFocusMode && (
                        <div className="hidden sm:flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1.5 cursor-help hover:text-foreground/70 transition-colors">
                                        <span>{wordCount.toLocaleString()} คำ</span>
                                        <span className="opacity-30">·</span>
                                        <FileText className="h-3 w-3 opacity-50" />
                                        <span>{pageCount}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent align="center" className="flex flex-col gap-1 text-xs">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">ตัวอักษร (รวมช่องว่าง):</span>
                                        <span className="font-semibold">{stats.charsWithSpaces.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">ตัวอักษร (ไม่รวมช่องว่าง):</span>
                                        <span className="font-semibold">{stats.charsWithoutSpaces.toLocaleString()}</span>
                                    </div>
                                </TooltipContent>
                            </Tooltip>

                            {wordStatus && (
                                <div className="flex items-center gap-1.5">
                                    <div className={cn(
                                        "flex items-center gap-1",
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
                                            "w-12 h-1",
                                            wordStatus.hasEnoughWords
                                                ? "[&>div]:bg-emerald-500"
                                                : "[&>div]:bg-amber-500"
                                        )}
                                    />
                                </div>
                            )}

                            <ExtractionStatus noteId={note.id} />
                        </div>
                    )}

                    {/* Right: Action buttons */}
                    <div className="flex items-center gap-0.5 shrink-0">
                        <SaveStatusIndicator />

                        {/* More Options Menu (Less frequently used actions) */}
                        {!isFocusMode && (
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-56 p-2 space-y-1">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        ตัวเลือกเพิ่มเติม
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Button 
                                            variant="ghost" 
                                            className="w-full justify-start h-8 px-2 text-xs font-normal"
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing}
                                        >
                                            <BarChart className="h-4 w-4 mr-2" />
                                            {isAnalyzing ? "กำลังวิเคราะห์..." : "วิเคราะห์ลีลาการเขียน"}
                                        </Button>
                                        
                                        {/* Plot Hole Checker is a component with its own Collapsible, fits well here */}
                                        <div className="px-1">
                                            <PlotHoleChecker
                                                novelId={novelId}
                                                noteId={note.id}
                                                content={content}
                                            />
                                        </div>

                                        <NoteSummaryButton
                                            noteId={note.id}
                                            novelId={novelId}
                                            initialSummary={note.summary}
                                        >
                                            <Button variant="ghost" className="w-full justify-start h-8 px-2 text-xs font-normal">
                                                <Sparkles className="h-4 w-4 mr-2" />
                                                สรุปตอน (AI Summary)
                                            </Button>
                                        </NoteSummaryButton>

                                        <VersionHistoryPanel noteId={note.id} novelId={novelId}>
                                            <Button variant="ghost" className="w-full justify-start h-8 px-2 text-xs font-normal">
                                                <History className="h-4 w-4 mr-2" />
                                                ประวัติการแก้ไข
                                            </Button>
                                        </VersionHistoryPanel>

                                        <DriveSyncButton noteId={note.id} novelId={novelId} />

                                        <div className="h-px bg-border my-1 mx-2" />

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" className="w-full justify-start h-8 px-2 text-xs font-normal text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    ลบตอนนี้
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
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={showReference ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setShowReference(!showReference)}
                                >
                                    <BookOpen className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{showReference ? "ปิดหน้าต่างอ้างอิง" : "เปิดหน้าต่างอ้างอิง"}</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isTypewriterMode ? "secondary" : "ghost"}
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setIsTypewriterMode(!isTypewriterMode)}
                                >
                                    <AlignCenter className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isTypewriterMode ? "ปิด Typewriter Mode" : "เปิด Typewriter Mode"}</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setIsFocusMode(!isFocusMode)}
                                >
                                    {isFocusMode ? (
                                        <Minimize2 className="h-3.5 w-3.5" />
                                    ) : (
                                        <Maximize2 className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isFocusMode ? "ออก Zen Mode" : "เข้า Zen Mode"}</p>
                            </TooltipContent>
                        </Tooltip>

                        {!isFocusMode && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setShowSidebar(!showSidebar)}
                                    >
                                        {showSidebar ? (
                                            <PanelRightClose className="h-3.5 w-3.5" />
                                        ) : (
                                            <PanelRightOpen className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{showSidebar ? "ซ่อน Sidebar" : "เปิด Sidebar"}</p>
                                </TooltipContent>
                            </Tooltip>
                        )}



                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={handleNextNote}
                                    disabled={isNavigating}
                                >
                                    {isNavigating ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>ตอนถัดไป</p>
                            </TooltipContent>
                        </Tooltip>

                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave} disabled={loading}>
                            <Save className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Main content area — Editor takes full width */}
                <div className={cn(
                    "flex-1 overflow-hidden relative transition-all duration-300 bg-muted flex",
                    isFocusMode && "pt-0",
                    isDragging && "cursor-col-resize"
                )}>
                    {/* Reference Panel */}
                    {!isFocusMode && showReference && (
                        <>
                            <div 
                                className="hidden sm:flex flex-col bg-background relative z-0 shrink-0 transition-none"
                                style={{ width: referenceWidth }}
                            >
                                <NoteReferencePanel novelId={novelId} currentNoteId={note.id} linkedChapterId={note.linkedToChapterId} />
                            </div>
                            
                            {/* Resizer Handle */}
                            <div 
                                className={cn(
                                    "hidden sm:flex w-1.5 bg-border hover:bg-primary/50 cursor-col-resize z-10 transition-colors shrink-0",
                                    isDragging && "bg-primary"
                                )}
                                onMouseDown={handleDragStart}
                            />
                        </>
                    )}

                    {/* Editor — always full width */}
                    <div
                        ref={editorContainerRef}
                        className={cn(
                            "h-full overflow-hidden flex flex-col transition-all duration-300 w-full flex-1 bg-background shadow-md",
                            !showReference && "max-w-3xl mx-auto",
                            isFocusMode && "!max-w-4xl px-4 md:px-8 pt-4 shadow-none bg-transparent"
                        )}
                    >
                        <ReactQuill
                            theme="bubble"
                            value={content}
                            onChange={setContent}
                            modules={modules}
                            className={cn(
                                "h-full flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-container]:text-base [&>.ql-container]:border-none",
                                "[&>.ql-editor]:px-6 [&>.ql-editor]:py-6 sm:[&>.ql-editor]:px-10",
                                isFocusMode && "[&>.ql-editor]:text-lg [&>.ql-editor]:leading-relaxed [&>.ql-editor]:px-4 sm:[&>.ql-editor]:px-12"
                            )}
                            placeholder="Start writing your scene..."
                        />
                    </div>

                    {/* Sidebar Overlay — slides over content from the right */}
                    {!isFocusMode && (
                        <>
                            {/* Backdrop */}
                            {showSidebar && (
                                <div
                                    className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-10 transition-opacity duration-300"
                                    onClick={() => setShowSidebar(false)}
                                />
                            )}
                            {/* Drawer */}
                            <div className={cn(
                                "absolute top-0 right-0 h-full w-80 bg-background border-l shadow-xl z-20 transition-transform duration-300 ease-in-out flex flex-col",
                                showSidebar ? "translate-x-0" : "translate-x-full"
                            )}>
                                {/* Drawer header */}
                                <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
                                    <span className="text-xs font-medium text-muted-foreground">Side Panel</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => setShowSidebar(false)}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                                {/* Drawer content */}
                                <div className="flex-1 overflow-y-auto space-y-4 p-3">
                                    <NoteCastDeck
                                        noteId={note.id}
                                        novelId={novelId}
                                        linkedChapterId={note.linkedToChapterId}
                                        content={content}
                                    />
                                    <NotePlotPanel
                                        noteId={note.id}
                                        novelId={novelId}
                                        linkedChapterId={note.linkedToChapterId}
                                    />
                                    <CharacterStateEditor noteId={note.id} />
                                    <AIReviewPanel noteId={note.id} novelId={novelId} />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </TooltipProvider>
    )
}
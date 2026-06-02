"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { format } from "date-fns";
import dynamic from "next/dynamic";
import {
    History,
    ArrowLeft,
    FileText,
    CheckCircle2,
    AlertCircle,
    X,
    Save,
    PlusCircle,
    Trash2,
    Loader2,
    Check,
    AlertTriangle,
    PenTool,
    PanelLeftClose,
    PanelLeftOpen,
    PanelRightClose,
    PanelRightOpen
} from "lucide-react";
import { NoteReferencePanel } from "@/components/project/note-reference-panel";
import { SpellCheckButton } from "@/components/project/spell-check-button";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateNote, updateNoteStatus } from "@/server/note";
import { createNoteVersion, getNoteVersions } from "@/server/version-history";
import { NOTE_STATUS_CONFIG, NoteStatus } from "@/lib/note-constants";
import { VersionHistoryPanel } from "@/components/project/version-history-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { diff_match_patch } from "diff-match-patch";
import { GitCompare, BookOpen, ChevronUp, ChevronDown, Plus, ArrowUp, ArrowDown, Search, Eye, EyeOff, Bookmark } from "lucide-react";

import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false }) as any;

// Framer Motion variants for paragraph transition
const slideVariants = {
    enter: (direction: "up" | "down") => ({
        y: direction === "down" ? 40 : -40,
        opacity: 0,
    }),
    center: {
        y: 0,
        opacity: 1,
    },
    exit: (direction: "up" | "down") => ({
        y: direction === "down" ? -40 : 40,
        opacity: 0,
    }),
};

// Helper functions for paragraph rewrite mode
function parseHtmlToParagraphs(html: string): string[] {
    if (!html) return [];
    if (typeof window === "undefined") return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const pElements = Array.from(doc.querySelectorAll("p, div, li"));
    if (pElements.length > 0) {
        return pElements.map(el => el.textContent || "");
    }
    // Fallback split by double newlines or single newlines
    return html.split(/\n+/).map(text => text.trim());
}

function safeHtmlReplace(html: string, findText: string, replaceText: string): string {
    if (!findText) return html;
    const escaped = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<!<[^>]*)(${escaped})(?![^<>]*>)`, 'g');
    return html.replace(regex, replaceText);
}

function getWordDiffHtml(oldText: string, newText: string): string {
    if (!oldText && !newText) return "";
    const dmp = new diff_match_patch();
    const diffs = dmp.diff_main(oldText || "", newText || "");
    dmp.diff_cleanupSemantic(diffs);

    return diffs.map(([op, text]) => {
        const escapedText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        if (op === -1) {
            return `<del class="bg-red-500/10 dark:bg-red-500/[0.05] text-red-500 dark:text-red-400 line-through decoration-red-500/30 px-0.5 rounded mx-0.5">${escapedText}</del>`;
        } else if (op === 1) {
            return `<ins class="bg-emerald-500/10 dark:bg-emerald-500/[0.05] text-emerald-600 dark:text-emerald-400 no-underline decoration-emerald-500/30 px-0.5 rounded mx-0.5">${escapedText}</ins>`;
        }
        return escapedText;
    }).join("");
}

function rebuildParagraphsToHtml(paragraphs: string[]): string {
    return paragraphs.map(p => `<p>${p}</p>`).join("");
}

interface AuditIssue {
    id: string;
    novelId: string;
    noteId: string;
    level: "developmental" | "line" | "proofreading";
    category: "plot_hole" | "character_state" | "tell_vs_show" | "spelling" | "redundancy";
    startIndex: number;
    endIndex: number;
    flaggedText: string;
    issueDescription: string;
    suggestedText: string | null;
    suggestionNotes: string | null;
    status: "unresolved" | "resolved";
    createdAt: string;
}

interface RewriteWorkspaceProps {
    initialNote: any;
    novelId: string;
}

export function RewriteWorkspace({ initialNote, novelId }: RewriteWorkspaceProps) {
    const router = useRouter();
    const [note, setNote] = useState(initialNote);
    const [title, setTitle] = useState(initialNote.title);
    const [content, setContent] = useState(initialNote.content?.text || "");
    const [status, setStatus] = useState<NoteStatus>(initialNote.status || "draft");
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");

    // Sidebar list of issues
    const [issues, setIssues] = useState<AuditIssue[]>([]);
    const [loadingIssues, setLoadingIssues] = useState(true);
    const [levelFilter, setLevelFilter] = useState<string>("all");
    const [issuesKey, setIssuesKey] = useState(0);

    // Selected text selection in Quill
    const [selectionRange, setSelectionRange] = useState<{ index: number; length: number } | null>(null);
    const [selectedText, setSelectedText] = useState("");

    // New issue form states
    const [newLevel, setNewLevel] = useState<"developmental" | "line" | "proofreading">("proofreading");
    const [newCategory, setNewCategory] = useState<string>("spelling");
    const [newDescription, setNewDescription] = useState("");
    const [newSuggestedText, setNewSuggestedText] = useState("");
    const [newSuggestionNotes, setNewSuggestionNotes] = useState("");

    // UI Panels toggle
    const [showReference, setShowReference] = useState(false);
    const [showAuditor, setShowAuditor] = useState(true);
    const [showSearchPanel, setShowSearchPanel] = useState(false);
    const [findText, setFindText] = useState("");
    const [replaceText, setReplaceText] = useState("");

    // Left Reference Resizer State
    const [referenceWidth, setReferenceWidth] = useState(360);
    const [isDraggingLeft, setIsDraggingLeft] = useState(false);

    // Right Auditor Resizer State
    const [auditorWidth, setAuditorWidth] = useState(340);
    const [isDraggingRight, setIsDraggingRight] = useState(false);

    // Handle Left Drag
    const handleLeftDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDraggingLeft(true);
    };

    useEffect(() => {
        if (!isDraggingLeft) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(260, Math.min(e.clientX, window.innerWidth * 0.45));
            setReferenceWidth(newWidth);
        };
        const handleMouseUp = () => setIsDraggingLeft(false);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none';
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDraggingLeft]);

    // Handle Right Drag
    const handleRightDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDraggingRight(true);
    };

    useEffect(() => {
        if (!isDraggingRight) return;
        const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(260, Math.min(window.innerWidth - e.clientX, window.innerWidth * 0.45));
            setAuditorWidth(newWidth);
        };
        const handleMouseUp = () => setIsDraggingRight(false);

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = 'none';
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
        };
    }, [isDraggingRight]);

    const quillRef = useRef<any>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const lastSavedContent = useRef(initialNote.content?.text || "");
    const lastSavedTitle = useRef(initialNote.title || "");
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Paragraph Rewrite Mode States
    const [isParagraphMode, setIsParagraphMode] = useState(false);
    const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
    const [editingParagraphs, setEditingParagraphs] = useState<string[]>([]);
    const [originalParagraphs, setOriginalParagraphs] = useState<string[]>([]);
    const [showDiff, setShowDiff] = useState(true);
    const [bookmarks, setBookmarks] = useState<number[]>(initialNote.content?.bookmarks || []);
    const lastSavedBookmarks = useRef<number[]>(initialNote.content?.bookmarks || []);

    const toggleBookmark = (index: number) => {
        setBookmarks(prev => {
            const exists = prev.includes(index);
            const next = exists ? prev.filter(i => i !== index) : [...prev, index];
            setSaveStatus("unsaved");
            return next;
        });
    };

    const [transitionDirection, setTransitionDirection] = useState<"up" | "down">("down");

    const navigateParagraph = (newIndex: number) => {
        if (activeParagraphIndex !== null) {
            setTransitionDirection(newIndex > activeParagraphIndex ? "down" : "up");
        }
        setActiveParagraphIndex(newIndex);
    };

    const leftParagraphRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const rightParagraphRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
    const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

    const adjustTextareaHeight = () => {
        const textarea = activeTextareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    };

    useEffect(() => {
        if (isParagraphMode) {
            adjustTextareaHeight();
        }
    }, [activeParagraphIndex, editingParagraphs, isParagraphMode]);

    useEffect(() => {
        if (isParagraphMode && activeParagraphIndex !== null) {
            const leftEl = leftParagraphRefs.current[activeParagraphIndex];
            if (leftEl) {
                leftEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            const rightEl = rightParagraphRefs.current[activeParagraphIndex];
            if (rightEl) {
                rightEl.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }
    }, [activeParagraphIndex, isParagraphMode]);

    // Versions state
    const [noteVersions, setNoteVersions] = useState<any[]>([]);
    const [selectedCompareVersionId, setSelectedCompareVersionId] = useState<string>("latest");
    const [loadingCompareVersion, setLoadingCompareVersion] = useState(false);

    // Fetch note versions for comparison dropdown
    useEffect(() => {
        const loadVersionsList = async () => {
            try {
                const res = await getNoteVersions(note.id);
                if (res.success && res.versions) {
                    setNoteVersions(res.versions);
                }
            } catch (e) {
                console.error("Failed to load versions list:", e);
            }
        };
        loadVersionsList();
    }, [note.id]);

    // Handle compare version selection changes
    const handleCompareVersionChange = async (val: string) => {
        setSelectedCompareVersionId(val);
        if (val === "latest") {
            const parsed = parseHtmlToParagraphs(initialNote.content?.text || "");
            setOriginalParagraphs(parsed);
            return;
        }

        setLoadingCompareVersion(true);
        try {
            const selectedVer = noteVersions.find(v => v.id === val);
            if (selectedVer) {
                const text = typeof selectedVer.content === 'object'
                    ? selectedVer.content?.text || ''
                    : selectedVer.content;
                const parsed = parseHtmlToParagraphs(text);
                setOriginalParagraphs(parsed);
            }
        } catch (e) {
            toast.error("ล้มเหลวในการโหลดเวอร์ชันสำหรับเปรียบเทียบ");
        } finally {
            setLoadingCompareVersion(false);
        }
    };

    // Global Keyboard Shortcuts Listener
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // 1. ค้นหาและแทนที่ (Cmd+F / Ctrl+F)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
                e.preventDefault();
                setShowSearchPanel(prev => !prev);
            }

            // 2. สลับโหมดเกลาย่อหน้า (Alt+P / Option+P)
            if (e.altKey && e.key.toLowerCase() === "p") {
                e.preventDefault();
                setIsParagraphMode(prev => {
                    const nextMode = !prev;
                    if (nextMode) {
                        const parsedEdit = parseHtmlToParagraphs(content);
                        setEditingParagraphs(parsedEdit);
                        if (originalParagraphs.length === 0) {
                            const parsedOrig = parseHtmlToParagraphs(initialNote.content?.text || "");
                            setOriginalParagraphs(parsedOrig);
                        }
                        setTransitionDirection("down");
                        setActiveParagraphIndex(0);
                    }
                    return nextMode;
                });
            }

            // คีย์ลัดเฉพาะตอนอยู่ในโหมดเกลาย่อหน้า
            if (!isParagraphMode) return;

            // 3. นำทางย่อหน้าก่อนหน้า (Cmd + ArrowUp / Ctrl + ArrowUp)
            if ((e.ctrlKey || e.metaKey) && e.key === "ArrowUp") {
                e.preventDefault();
                if (activeParagraphIndex !== null && activeParagraphIndex > 0) {
                    navigateParagraph(activeParagraphIndex - 1);
                }
            }

            // 4. นำทางย่อหน้าถัดไป (Cmd + ArrowDown / Ctrl + ArrowDown)
            if ((e.ctrlKey || e.metaKey) && e.key === "ArrowDown") {
                e.preventDefault();
                if (activeParagraphIndex !== null && activeParagraphIndex < editingParagraphs.length - 1) {
                    navigateParagraph(activeParagraphIndex + 1);
                }
            }

            // 5. สลับเปิด/ปิด Word Diff (Alt+D / Option+D)
            if (e.altKey && e.key.toLowerCase() === "d") {
                e.preventDefault();
                setShowDiff(prev => !prev);
            }

            // 6. เพิ่มย่อหน้าว่างใหม่ด้านล่าง (Alt+N / Option+N)
            if (e.altKey && e.key.toLowerCase() === "n") {
                e.preventDefault();
                if (activeParagraphIndex !== null) {
                    handleInsertParagraph(activeParagraphIndex);
                }
            }

            // 7. สลับมาร์กบุ๊กมาร์ก (Alt+B / Option+B)
            if (e.altKey && e.key.toLowerCase() === "b") {
                e.preventDefault();
                if (activeParagraphIndex !== null) {
                    toggleBookmark(activeParagraphIndex);
                }
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [isParagraphMode, activeParagraphIndex, editingParagraphs.length, content, originalParagraphs, initialNote.content?.text, bookmarks]);

    // Get count of findText matches in the document
    const getMatchCount = useMemo(() => {
        if (!findText) return 0;
        const escaped = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escaped, 'gi');
        if (isParagraphMode) {
            return editingParagraphs.reduce((acc, p) => acc + (p.match(regex) || []).length, 0);
        } else {
            const plainText = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
            return (plainText.match(regex) || []).length;
        }
    }, [findText, isParagraphMode, editingParagraphs, content]);

    // Handle Replace All
    const handleReplaceAll = () => {
        if (!findText) return;

        if (isParagraphMode) {
            const escaped = findText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escaped, 'g');
            const updated = editingParagraphs.map(p => p.replace(regex, replaceText));
            setEditingParagraphs(updated);
            const newHtml = rebuildParagraphsToHtml(updated);
            setContent(newHtml);
            setSaveStatus("unsaved");
            toast.success(`แทนที่คำสำเร็จทั้งหมด ${getMatchCount} จุด`);
        } else {
            const newHtml = safeHtmlReplace(content, findText, replaceText);
            setContent(newHtml);
            setSaveStatus("unsaved");
            toast.success(`แทนที่คำสำเร็จทั้งหมด ${getMatchCount} จุด`);
        }
    };

    // Update paragraph text
    const handleUpdateParagraph = (index: number, newText: string) => {
        const updated = [...editingParagraphs];
        updated[index] = newText;
        setEditingParagraphs(updated);

        // Sync back to content html string
        const newHtml = rebuildParagraphsToHtml(updated);
        setContent(newHtml);
        if (newHtml !== lastSavedContent.current) {
            setSaveStatus("unsaved");
        }
    };

    // Insert a blank paragraph below index
    const handleInsertParagraph = (index: number) => {
        const updatedEdit = [...editingParagraphs];
        updatedEdit.splice(index + 1, 0, "");
        setEditingParagraphs(updatedEdit);

        const updatedOrig = [...originalParagraphs];
        updatedOrig.splice(index + 1, 0, "");
        setOriginalParagraphs(updatedOrig);

        // Shift bookmarks
        const updatedBookmarks = bookmarks.map(bIdx => bIdx > index ? bIdx + 1 : bIdx);
        setBookmarks(updatedBookmarks);

        const newHtml = rebuildParagraphsToHtml(updatedEdit);
        setContent(newHtml);
        setSaveStatus("unsaved");

        setActiveParagraphIndex(index + 1);
        toast.success("เพิ่มย่อหน้าใหม่เรียบร้อย");
    };

    // Delete paragraph at index
    const handleDeleteParagraph = (index: number) => {
        if (editingParagraphs.length <= 1) {
            toast.error("ไม่สามารถลบย่อหน้าเดียวที่เหลืออยู่ได้");
            return;
        }

        const updatedEdit = [...editingParagraphs];
        updatedEdit.splice(index, 1);
        setEditingParagraphs(updatedEdit);

        const updatedOrig = [...originalParagraphs];
        updatedOrig.splice(index, 1);
        setOriginalParagraphs(updatedOrig);

        // Shift and filter bookmarks
        const updatedBookmarks = bookmarks
            .filter(bIdx => bIdx !== index)
            .map(bIdx => bIdx > index ? bIdx - 1 : bIdx);
        setBookmarks(updatedBookmarks);

        const newHtml = rebuildParagraphsToHtml(updatedEdit);
        setContent(newHtml);
        setSaveStatus("unsaved");

        const newIdx = index === 0 ? 0 : index - 1;
        setActiveParagraphIndex(newIdx);
        toast.success("ลบย่อหน้าเรียบร้อย");
    };

    // Move paragraph up or down
    const handleMoveParagraph = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= editingParagraphs.length) return;

        const updatedEdit = [...editingParagraphs];
        const tempEdit = updatedEdit[index];
        updatedEdit[index] = updatedEdit[targetIndex];
        updatedEdit[targetIndex] = tempEdit;
        setEditingParagraphs(updatedEdit);

        const updatedOrig = [...originalParagraphs];
        const tempOrig = updatedOrig[index];
        updatedOrig[index] = updatedOrig[targetIndex];
        updatedOrig[targetIndex] = tempOrig;
        setOriginalParagraphs(updatedOrig);

        // Swap bookmark indices if affected
        const updatedBookmarks = bookmarks.map(bIdx => {
            if (bIdx === index) return targetIndex;
            if (bIdx === targetIndex) return index;
            return bIdx;
        });
        setBookmarks(updatedBookmarks);

        const newHtml = rebuildParagraphsToHtml(updatedEdit);
        setContent(newHtml);
        setSaveStatus("unsaved");

        setActiveParagraphIndex(targetIndex);
        toast.success(direction === "up" ? "ย้ายย่อหน้าขึ้นแล้ว" : "ย้ายย่อหน้าลงแล้ว");
    };

    // Auto-align paragraph arrays if content changes externally
    useEffect(() => {
        if (!isParagraphMode && content) {
            const parsed = parseHtmlToParagraphs(content);
            setEditingParagraphs(parsed);
        }
    }, [content, isParagraphMode]);

    // Re-map spelling issues' index จาก server-offset → Quill index จริง
    // (background spell check ไม่มี Quill จึงเก็บ offset แบบ plain text — ต้อง map ใหม่ฝั่ง client)
    const remapSpellingIssues = (rawIssues: AuditIssue[]): AuditIssue[] => {
        const editor = quillRef.current?.getEditor();
        const fullText: string = editor ? editor.getText() : "";
        if (!fullText) return rawIssues; // editor ยังไม่พร้อม — ใช้ค่าเดิมไปก่อน

        // แยก spelling ออกมา เรียงตามลำดับพบ (startIndex จาก server) แล้วเดิน sequential search
        const spelling = rawIssues
            .filter(i => i.category === "spelling")
            .sort((a, b) => a.startIndex - b.startIndex);
        const others = rawIssues.filter(i => i.category !== "spelling");

        let pointer = 0;
        const remapped = spelling.map(issue => {
            const idx = fullText.indexOf(issue.flaggedText, pointer);
            if (idx === -1) return issue; // หาไม่เจอ (content เปลี่ยน) — คงค่าเดิม
            pointer = idx + issue.flaggedText.length;
            return { ...issue, startIndex: idx, endIndex: idx + issue.flaggedText.length };
        });

        return [...others, ...remapped];
    };

    // Fetch existing issues
    useEffect(() => {
        const fetchIssues = async () => {
            setLoadingIssues(true);
            try {
                const res = await fetch(`/api/novel/${novelId}/note/${note.id}/audit-issues`);
                const data = await res.json();
                if (data.success) {
                    setIssues(remapSpellingIssues(data.issues || []));
                }
            } catch (e) {
                console.error("Failed to load issues:", e);
            } finally {
                setLoadingIssues(false);
            }
        };
        fetchIssues();
    }, [novelId, note.id, issuesKey]);

    // Handle selection change in Quill safely
    const handleSelectionChange = (range: any, source: any, editor: any) => {
        if (range && range.length > 0) {
            const quill = quillRef.current?.getEditor();
            if (quill) {
                setSelectionRange({ index: range.index, length: range.length });
                setSelectedText(quill.getText(range.index, range.length));
            }
        }
    };

    // Save note contents
    const handleSaveNote = async () => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        setSaveStatus("saving");
        try {
            const res = await updateNote(note.id, {
                title,
                content: { text: content, bookmarks }
            });
            if (res.success) {
                const wordCount = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().split(/\s+/).length;
                await createNoteVersion(note.id, title, { text: content, bookmarks }, wordCount, "manual");
                lastSavedContent.current = content;
                lastSavedTitle.current = title;
                lastSavedBookmarks.current = bookmarks;
                setSaveStatus("saved");
                toast.success("บันทึกเนื้อหาเรียบร้อย");

                // Refresh version history list
                try {
                    const verRes = await getNoteVersions(note.id);
                    if (verRes.success && verRes.versions) {
                        setNoteVersions(verRes.versions);
                    }
                } catch (err) {
                    console.error("Failed to reload versions list:", err);
                }
            } else {
                setSaveStatus("error");
            }
        } catch (e) {
            setSaveStatus("error");
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    // Auto-save logic
    useEffect(() => {
        const hasContentChanged = content !== lastSavedContent.current;
        const hasTitleChanged = title !== lastSavedTitle.current;
        const hasBookmarksChanged = JSON.stringify(bookmarks) !== JSON.stringify(lastSavedBookmarks.current);

        if (!hasContentChanged && !hasTitleChanged && !hasBookmarksChanged) return;

        setSaveStatus("unsaved");

        const timer = setTimeout(() => {
            const autoSave = async () => {
                setSaveStatus("saving");
                try {
                    const res = await updateNote(note.id, {
                        title,
                        content: { text: content, bookmarks }
                    });
                    if (res.success) {
                        const wordCount = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().split(/\s+/).length;
                        await createNoteVersion(note.id, title, { text: content, bookmarks }, wordCount, "auto");
                        lastSavedContent.current = content;
                        lastSavedTitle.current = title;
                        lastSavedBookmarks.current = bookmarks;
                        setSaveStatus("saved");

                        // Refresh version history in background
                        try {
                            const verRes = await getNoteVersions(note.id);
                            if (verRes.success && verRes.versions) {
                                setNoteVersions(verRes.versions);
                            }
                        } catch (err) {
                            console.error("Failed to reload versions list on auto save:", err);
                        }
                    } else {
                        setSaveStatus("error");
                    }
                } catch (e) {
                    setSaveStatus("error");
                    console.error("Auto save failed:", e);
                }
            };
            autoSave();
        }, 1500);

        autoSaveTimerRef.current = timer;

        return () => {
            clearTimeout(timer);
            autoSaveTimerRef.current = null;
        };
    }, [content, title, note.id]);

    // Change note status
    const handleStatusChange = async (newStatus: NoteStatus) => {
        setStatus(newStatus);
        try {
            const res = await updateNoteStatus(note.id, newStatus);
            if (res.success) {
                toast.success(`เปลี่ยนสถานะเป็น: ${NOTE_STATUS_CONFIG[newStatus].label}`);
                router.refresh();

                // ตั้งสถานะ "รอพิสูจน์อักษร" → trigger background spell check (server-side)
                if (newStatus === "proofreading") {
                    toast.info("เริ่มตรวจคำผิดอัตโนมัติเบื้องหลัง — สถานะจะเปลี่ยนเป็น 'รอตรวจสอบ' เมื่อเสร็จ");
                    fetch(`/api/novel/${novelId}/note/${note.id}/spell-check-trigger`, {
                        method: "POST",
                    }).catch(() => toast.error("เริ่มตรวจคำผิดไม่สำเร็จ"));
                }
            }
        } catch (e) {
            toast.error("เปลี่ยนสถานะไม่สำเร็จ");
        }
    };

    // Create a new manual issue
    const handleAddIssue = async () => {
        if (!selectionRange || !selectedText.trim()) {
            toast.error("กรุณาเลือกข้อความใน Editor ก่อนทำการเพิ่มจุดตรวจทาน");
            return;
        }
        if (!newDescription.trim()) {
            toast.error("กรุณากรอกคำอธิบายปัญหา");
            return;
        }

        try {
            const res = await fetch(`/api/novel/${novelId}/note/${note.id}/audit-issues`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    level: newLevel,
                    category: newCategory,
                    startIndex: selectionRange.index,
                    endIndex: selectionRange.index + selectionRange.length,
                    flaggedText: selectedText,
                    issueDescription: newDescription,
                    suggestedText: newLevel === "proofreading" ? newSuggestedText : null,
                    suggestionNotes: newLevel !== "proofreading" ? newSuggestionNotes : null
                })
            });
            const data = await res.json();
            if (data.success && data.issue) {
                setIssues(prev => [...prev, data.issue]);
                toast.success("เพิ่มจุดตรวจทานเรียบร้อย");

                // Clear form
                setSelectedText("");
                setSelectionRange(null);
                setNewDescription("");
                setNewSuggestedText("");
                setNewSuggestionNotes("");
            }
        } catch (e) {
            toast.error("บันทึกประเด็นล้มเหลว");
        }
    };

    // Delete issue
    const handleDeleteIssue = async (issueId: string) => {
        try {
            const res = await fetch(`/api/novel/${novelId}/note/${note.id}/audit-issues/${issueId}`, {
                method: "DELETE"
            });
            const data = await res.json();
            if (data.success) {
                setIssues(prev => prev.filter(i => i.id !== issueId));
                toast.success("ลบจุดตรวจทานแล้ว");
            }
        } catch (e) {
            toast.error("ลบล้มเหลว");
        }
    };

    // Auto-fix Proofreading Issue with Shifting Offset
    const handleAutoFix = async (issue: AuditIssue) => {
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = null;
        }

        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();

        const length = issue.endIndex - issue.startIndex;
        const replacement = issue.suggestedText || "";

        // 1. Apply replacement in Quill
        editor.deleteText(issue.startIndex, length);
        editor.insertText(issue.startIndex, replacement);

        // Compute offset shifting
        const offset = replacement.length - length;
        const updatedHtml = editor.root.innerHTML;

        // Update content local state
        setContent(updatedHtml);
        setSaveStatus("saving");

        try {
            // 2. Save note change in DB
            await updateNote(note.id, {
                content: { text: updatedHtml }
            });
            lastSavedContent.current = updatedHtml;
            lastSavedTitle.current = title;
            setSaveStatus("saved");

            // 3. Delete issue from DB
            await fetch(`/api/novel/${novelId}/note/${note.id}/audit-issues/${issue.id}`, {
                method: "DELETE"
            });

            // 4. Update state and shift offsets of other issues
            setIssues(prevIssues =>
                prevIssues
                    .map(i => {
                        if (i.id === issue.id) return null;
                        if (i.startIndex > issue.startIndex) {
                            return {
                                ...i,
                                startIndex: i.startIndex + offset,
                                endIndex: i.endIndex + offset
                            };
                        }
                        return i;
                    })
                    .filter((i): i is AuditIssue => i !== null)
            );

            toast.success("แก้ไขคำผิดอัตโนมัติสำเร็จ");
        } catch (e) {
            setSaveStatus("error");
            toast.error("บันทึกข้อมูลล้มเหลว");
        }
    };

    // Select text range in editor
    const handleSelectIssueRange = (issue: AuditIssue) => {
        if (!quillRef.current) return;
        const editor = quillRef.current.getEditor();
        editor.focus();
        editor.setSelection(issue.startIndex, issue.endIndex - issue.startIndex);
        toast.info(`เน้นข้อความประเด็น: "${issue.flaggedText}"`);
    };

    // Group notes by chapter
    // Group notes by chapter - removed as we now use NoteReferencePanel

    const filteredIssues = useMemo(() => {
        if (levelFilter === "all") return issues;
        return issues.filter(i => i.level === levelFilter);
    }, [issues, levelFilter]);

    const modules = useMemo(() => ({
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
        ],
    }), []);

    const idx = activeParagraphIndex ?? 0;

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-background border border-steel-800 rounded-lg overflow-hidden mt-2 shadow-md noise-texture relative">
            {/* Header section */}
            <div className="flex items-center justify-between border-b border-steel-800 px-4 py-3 bg-muted/20 shrink-0 relative">
                {/* Tech line indicator */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary via-forge-amber to-transparent" />
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                        <Link href={`/dashboard/project/${novelId}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <Input
                        value={title}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            setSaveStatus("unsaved");
                        }}
                        className="text-sm font-semibold font-display border border-transparent shadow-none focus-visible:ring-0 px-3 py-1 h-8 bg-transparent hover:bg-muted/30 hover:border-steel-800/40 focus:bg-background focus:border-steel-800 rounded-md transition-all duration-200 max-w-[240px]"
                        placeholder="Note Title"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {/* Status Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hidden sm:inline">สถานะ:</span>
                        <Select value={status} onValueChange={(val) => handleStatusChange(val as NoteStatus)}>
                            <SelectTrigger className="w-[120px] h-8 text-xs border-steel-800 bg-background/50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(NOTE_STATUS_CONFIG).map(([key, config]) => (
                                    <SelectItem key={key} value={key} className="text-xs">
                                        <span className={cn("font-medium", config.color)}>
                                            {config.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Mode Toggle Button */}
                    <Button
                        variant={isParagraphMode ? "secondary" : "outline"}
                        size="sm"
                        className="h-8 text-xs font-mono tracking-wide gap-1.5 border-steel-800"
                        onClick={() => {
                            if (!isParagraphMode) {
                                const parsedEdit = parseHtmlToParagraphs(content);
                                setEditingParagraphs(parsedEdit);
                                if (originalParagraphs.length === 0) {
                                    const parsedOrig = parseHtmlToParagraphs(initialNote.content?.text || "");
                                    setOriginalParagraphs(parsedOrig);
                                }
                                setTransitionDirection("down");
                                setActiveParagraphIndex(0);
                            }
                            setIsParagraphMode(!isParagraphMode);
                        }}
                    >
                        <GitCompare className="h-3.5 w-3.5 text-amber-500" />
                        <span className="hidden sm:inline">{isParagraphMode ? "โหมดปกติ" : "โหมดเกลาทีละย่อหน้า"}</span>
                    </Button>

                    {isParagraphMode && (
                        <Button
                            variant={showDiff ? "secondary" : "outline"}
                            size="sm"
                            className="h-8 text-xs font-mono tracking-wide gap-1.5 border-steel-800"
                            onClick={() => setShowDiff(!showDiff)}
                            title={showDiff ? "ซ่อนการเปรียบเทียบคำ" : "แสดงการเปรียบเทียบคำ"}
                        >
                            {showDiff ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5 text-amber-500" />}
                            <span className="hidden sm:inline">{showDiff ? "ซ่อน Diff" : "แสดง Diff"}</span>
                        </Button>
                    )}

                    <VersionHistoryPanel noteId={note.id} novelId={novelId}>
                        <Button variant="outline" size="sm" className="h-8 text-xs font-mono tracking-wide gap-1.5 border-steel-800">
                            <History className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">ประวัติเวอร์ชัน</span>
                        </Button>
                    </VersionHistoryPanel>

                    {/* Left Panel Toggle */}
                    <Button
                        variant={showReference ? "secondary" : "outline"}
                        size="icon"
                        className="h-8 w-8 border-steel-800"
                        onClick={() => setShowReference(!showReference)}
                        title={showReference ? "ซ่อนแผงอ้างอิง" : "แสดงแผงอ้างอิง"}
                    >
                        {showReference ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
                    </Button>

                    {/* Find & Replace Toggle */}
                    <Button
                        variant={showSearchPanel ? "secondary" : "outline"}
                        size="icon"
                        className="h-8 w-8 border-steel-800"
                        onClick={() => setShowSearchPanel(!showSearchPanel)}
                        title="ค้นหาและแทนที่ (Cmd+F)"
                    >
                        <Search className="h-4 w-4" />
                    </Button>

                    {/* Right Panel Toggle */}
                    <Button
                        variant={showAuditor ? "secondary" : "outline"}
                        size="icon"
                        className="h-8 w-8 border-steel-800"
                        onClick={() => setShowAuditor(!showAuditor)}
                        title={showAuditor ? "ซ่อนแผงตรวจทาน" : "แสดงแผงตรวจทาน"}
                    >
                        {showAuditor ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </Button>

                    <Button
                        onClick={handleSaveNote}
                        size="sm"
                        variant={saveStatus === "unsaved" ? "forge" : "default"}
                        className={cn(
                            "h-8 text-xs gap-1.5 transition-all duration-200",
                            saveStatus === "unsaved" && "animate-forge-pulse"
                        )}
                    >
                        {saveStatus === "saving" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        บันทึก
                    </Button>
                </div>
            </div>

            {/* Find & Replace Panel Bar */}
            {showSearchPanel && (
                <div className="border-b border-steel-800 bg-muted/15 px-6 py-2.5 flex items-center justify-between gap-4 animate-in slide-in-from-top duration-200">
                    <div className="flex items-center gap-3 flex-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-muted-foreground font-semibold">ค้นหา:</span>
                            <Input
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                placeholder="คำค้นหา..."
                                className="h-8 text-xs bg-steel-900 border-steel-800 focus-visible:ring-forge-amber/40 focus-visible:border-forge-amber/60 w-44 sm:w-56"
                            />
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-muted-foreground font-semibold">แทนที่ด้วย:</span>
                            <Input
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                placeholder="คำที่จะแทนที่..."
                                className="h-8 text-xs bg-steel-900 border-steel-800 focus-visible:ring-forge-amber/40 focus-visible:border-forge-amber/60 w-44 sm:w-56"
                            />
                        </div>
                        {findText && (
                            <span className="text-[10px] font-mono bg-steel-900 border border-steel-800 text-muted-foreground px-2 py-1 rounded">
                                พบ {getMatchCount} จุด
                            </span>
                        )}
                        <Button
                            size="sm"
                            variant={getMatchCount > 0 ? "forge" : "outline"}
                            disabled={getMatchCount === 0}
                            onClick={handleReplaceAll}
                            className="h-8 text-xs font-semibold gap-1.5"
                        >
                            <GitCompare className="h-3 w-3" />
                            แทนที่ทั้งหมด
                        </Button>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                            setShowSearchPanel(false);
                            setFindText("");
                            setReplaceText("");
                        }}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Split 3-column layout */}
            <div className={cn(
                "flex flex-1 overflow-hidden",
                (isDraggingLeft || isDraggingRight) && "cursor-col-resize"
            )}>
                {/* Column 1: Left Reference Panel */}
                {showReference && (
                    <div
                        className="border-r border-steel-800/60 overflow-hidden shrink-0 hidden md:block transition-none"
                        style={{ width: referenceWidth }}
                    >
                        <NoteReferencePanel
                            novelId={novelId}
                            currentNoteId={note.id}
                            linkedChapterId={note.linkedToChapterId}
                        />
                    </div>
                )}

                {/* Left Resizer Handle */}
                {showReference && (
                    <div
                        className={cn(
                            "hidden md:flex w-1 bg-steel-800/60 hover:bg-primary/55 cursor-col-resize z-10 transition-colors shrink-0",
                            isDraggingLeft && "bg-primary"
                        )}
                        onMouseDown={handleLeftDragStart}
                    />
                )}

                {/* Column 2: Center Editor / Paragraph Rewrite Workspace */}
                {isParagraphMode ? (
                    <div className="flex-1 h-full flex flex-col overflow-hidden bg-background relative">
                        {/* Visual Progress Bar at the top of workspace */}
                        <div className="h-[2.5px] bg-steel-800/80 w-full shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-amber-500 to-forge-amber transition-all duration-300"
                                style={{ width: `${(((activeParagraphIndex ?? 0) + 1) / (editingParagraphs.length || 1)) * 100}%` }}
                            />
                        </div>
                        {/* Upper split area */}
                        <div className="flex-1 flex flex-row overflow-hidden divide-x divide-steel-800/60">
                            {/* Left Pane: Single Original Paragraph */}
                            <div className="flex-1 h-full flex flex-col min-w-[320px] overflow-hidden bg-muted/5">
                                <div className="px-4 h-14 border-b border-steel-800/60 bg-muted/20 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                                        <BookOpen className="h-3.5 w-3.5 text-amber-500" />
                                        ย่อหน้าต้นฉบับดั้งเดิม
                                    </span>

                                    <Select value={selectedCompareVersionId} onValueChange={handleCompareVersionChange}>
                                        <SelectTrigger className="w-[180px] h-7 text-xs border-steel-800 bg-background/50">
                                            <SelectValue placeholder="เลือกเวอร์ชันเปรียบเทียบ" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="latest" className="text-xs">
                                                ต้นร่างปัจจุบัน (ที่เซฟล่าสุด)
                                            </SelectItem>
                                            {noteVersions.map((v) => (
                                                <SelectItem key={v.id} value={v.id} className="text-xs">
                                                    Version {v.versionNumber} ({v.saveType === 'manual' ? 'Manual' : 'Auto'})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 max-w-2xl mx-auto w-full relative">
                                    <div className="absolute top-4 left-6 text-xs font-mono text-muted-foreground/35 select-none font-bold">
                                        ORIGINAL CONTEXT PANEL
                                    </div>
                                    <div className="space-y-4 pt-6 w-full pb-32">
                                        {originalParagraphs.map((para, i) => {
                                            const isActive = i === idx;
                                            const distance = Math.abs(i - idx);
                                            if (distance > 3) return null;

                                            return (
                                                <div
                                                    key={i}
                                                    ref={(el) => { leftParagraphRefs.current[i] = el; }}
                                                    className={cn(
                                                        "transition-all duration-500 ease-in-out py-3",
                                                        isActive ? "opacity-100 scale-100" : "opacity-45"
                                                    )}
                                                >
                                                    {isActive ? (
                                                        <div className="space-y-2 w-full">
                                                            <div className="text-[10px] font-mono text-amber-500/70 font-bold uppercase select-none">
                                                                ย่อหน้าที่ {i + 1} (ดั้งเดิม)
                                                            </div>
                                                            {loadingCompareVersion ? (
                                                                <div className="flex justify-center items-center py-4">
                                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                                </div>
                                                            ) : (
                                                                <p className="text-[17px] leading-loose tracking-wide text-foreground/85 font-sans whitespace-pre-wrap italic border-l-2 border-amber-500/50 pl-5 py-3 bg-amber-500/5 rounded-r-lg">
                                                                    {para || <span className="text-muted-foreground/30">[ย่อหน้าว่าง]</span>}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm leading-relaxed text-muted-foreground italic pl-5 flex items-center gap-1.5">
                                                            {bookmarks.includes(i) && <Bookmark className="h-3 w-3 text-amber-500 fill-amber-500/80 shrink-0" />}
                                                            <span>[{i + 1}] {para}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Right Pane: Editable Textarea & Diff Preview */}
                            <div className="flex-1 h-full flex flex-col min-w-[320px] overflow-hidden bg-background">
                                <div className="px-4 h-14 border-b border-steel-800/60 bg-muted/20 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                                        <PenTool className="h-3.5 w-3.5 text-amber-500" />
                                        การปรับปรุงภาษาและเกลาสำนวน
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-muted-foreground hidden sm:inline">ย้ายไปยัง:</span>
                                        <Select
                                            value={activeParagraphIndex !== null ? String(activeParagraphIndex) : undefined}
                                            onValueChange={(val) => navigateParagraph(Number(val))}
                                        >
                                            <SelectTrigger className="w-[180px] h-7 text-xs border-steel-800 bg-background/50 hover:bg-background/80 hover:border-steel-700 transition-colors">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                {editingParagraphs.map((para, i) => (
                                                    <SelectItem key={i} value={String(i)} className="text-xs">
                                                        <div className="flex items-center justify-between w-[150px] gap-2">
                                                            <span className="truncate">
                                                                {i + 1}. {para ? para.substring(0, 18) + "..." : "[ย่อหน้าว่าง]"}
                                                            </span>
                                                            {bookmarks.includes(i) && (
                                                                <Bookmark className="h-3 w-3 text-amber-500 fill-current shrink-0" />
                                                            )}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
                                    <div className="space-y-4 w-full pb-32">
                                        {editingParagraphs.map((para, i) => {
                                            const isActive = i === idx;
                                            const distance = Math.abs(i - idx);
                                            if (distance > 3) return null;

                                            return (
                                                <div
                                                    key={i}
                                                    ref={(el) => { rightParagraphRefs.current[i] = el; }}
                                                    onClick={!isActive ? () => navigateParagraph(i) : undefined}
                                                    className={cn(
                                                        "transition-all duration-300 ease-in-out py-3 w-full group",
                                                        isActive ? "opacity-100" : "opacity-45 cursor-pointer hover:bg-muted/5 hover:opacity-85 rounded-lg px-3 -mx-3"
                                                    )}
                                                >
                                                    <div className="flex items-start w-full gap-3">
                                                        {/* Text/Editing Card Column */}
                                                        <div className="flex-1 min-w-0">
                                                            {isActive ? (
                                                                <div className="space-y-2 w-full border-l-2 border-amber-500/70 pl-4 py-1 flex flex-col justify-between">
                                                                    <div className="flex justify-between items-center opacity-60 select-none mb-1">
                                                                        <label className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">
                                                                            พิมพ์เกลาข้อความในกล่องนี้:
                                                                        </label>
                                                                        <span className="text-[10px] font-mono text-muted-foreground/50">
                                                                            (ย่อหน้าที่ {i + 1})
                                                                        </span>
                                                                    </div>
                                                                    <textarea
                                                                        ref={activeTextareaRef}
                                                                        value={para || ""}
                                                                        onChange={(e) => {
                                                                            handleUpdateParagraph(i, e.target.value);
                                                                            e.target.style.height = "auto";
                                                                            e.target.style.height = `${e.target.scrollHeight}px`;
                                                                        }}
                                                                        className="w-full bg-transparent border-0 border-none shadow-none focus:ring-0 focus-visible:ring-0 focus:outline-none resize-none text-foreground text-[17px] leading-loose tracking-wide overflow-hidden mb-2"
                                                                        placeholder="เริ่มต้นเขียนหรือเกลาเนื้อหาบทนี้..."
                                                                        autoFocus
                                                                        onKeyDown={(e) => {
                                                                            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                                                                e.preventDefault();
                                                                                if (i < editingParagraphs.length - 1) {
                                                                                    navigateParagraph(i + 1);
                                                                                } else {
                                                                                    setIsParagraphMode(false);
                                                                                    setActiveParagraphIndex(null);
                                                                                    toast.success("เกลาเนื้อหาครบทุกย่อหน้าแล้ว");
                                                                                }
                                                                            }
                                                                        }}
                                                                    />

                                                                    {/* Word Diff Box inside active card */}
                                                                    {showDiff && originalParagraphs[i] !== editingParagraphs[i] && (
                                                                        <div className="space-y-1.5 mt-4 pt-3 border-t border-steel-800/40 w-full">
                                                                            <label className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground/60 uppercase">
                                                                                เปรียบเทียบการเปลี่ยนแปลง (Word Diff):
                                                                            </label>
                                                                            <div className="p-4 rounded-xl border border-steel-800/60 bg-muted/5 text-[15px] leading-relaxed tracking-wide whitespace-pre-wrap min-h-[80px] shadow-xs">
                                                                                <div
                                                                                    dangerouslySetInnerHTML={{
                                                                                        __html: getWordDiffHtml(
                                                                                            originalParagraphs[i] || "",
                                                                                            editingParagraphs[i] || ""
                                                                                        )
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Mini Navigation & Actions in bottom-right corner */}
                                                                    <div className="flex justify-end items-center select-none pt-1">
                                                                        <div className="flex items-center gap-1.5 bg-muted/60 border border-steel-800/80 px-2 py-0.5 rounded shadow-sm">
                                                                            <span className="text-[10px] font-mono text-muted-foreground font-semibold mr-1">
                                                                                ย่อหน้าที่ {i + 1}
                                                                            </span>
                                                                            {/* Navigation section */}
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                disabled={i === 0}
                                                                                onClick={() => navigateParagraph(i - 1)}
                                                                                className="h-5 w-5 rounded hover:bg-steel-800 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                                                                title="ย่อหน้าก่อนหน้า"
                                                                            >
                                                                                <ChevronUp className="h-3 w-3" />
                                                                            </Button>
                                                                            {i === editingParagraphs.length - 1 ? (
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="forge"
                                                                                    onClick={() => {
                                                                                        setIsParagraphMode(false);
                                                                                        setActiveParagraphIndex(null);
                                                                                        toast.success("เกลาเนื้อหาครบทุกย่อหน้าแล้ว");
                                                                                    }}
                                                                                    className="h-5 text-[9px] px-1.5 font-semibold font-mono tracking-wider ml-0.5"
                                                                                >
                                                                                    เสร็จสิ้น
                                                                                </Button>
                                                                            ) : (
                                                                                <Button
                                                                                    size="icon"
                                                                                    variant="ghost"
                                                                                    onClick={() => navigateParagraph(i + 1)}
                                                                                    className="h-5 w-5 rounded hover:bg-steel-800 text-muted-foreground hover:text-foreground"
                                                                                    title="ย่อหน้าถัดไป"
                                                                                >
                                                                                    <ChevronDown className="h-3 w-3" />
                                                                                </Button>
                                                                            )}

                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => toggleBookmark(i)}
                                                                                className={cn(
                                                                                    "h-5 w-5 rounded hover:bg-steel-800 transition-colors",
                                                                                    bookmarks.includes(i) ? "text-amber-500 hover:text-amber-400" : "text-muted-foreground hover:text-foreground"
                                                                                )}
                                                                                title={bookmarks.includes(i) ? "ยกเลิกที่คั่นหน้า" : "คั่นหน้านี้"}
                                                                            >
                                                                                <Bookmark className={cn("h-3.5 w-3.5", bookmarks.includes(i) && "fill-current")} />
                                                                            </Button>

                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => setShowDiff(!showDiff)}
                                                                                className="h-5 w-5 rounded hover:bg-steel-800 text-muted-foreground hover:text-foreground"
                                                                                title={showDiff ? "ซ่อนการเปรียบเทียบคำ (Word Diff)" : "แสดงการเปรียบเทียบคำ (Word Diff)"}
                                                                            >
                                                                                {showDiff ? (
                                                                                    <Eye className="h-3 w-3 text-amber-500" />
                                                                                ) : (
                                                                                    <EyeOff className="h-3 w-3 text-muted-foreground/50" />
                                                                                )}
                                                                            </Button>

                                                                            {/* Vertical Divider */}
                                                                            <div className="w-[1px] h-3.5 bg-steel-800/80 mx-1" />

                                                                            {/* Add / Delete Operations */}
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                onClick={() => handleInsertParagraph(i)}
                                                                                className="h-5 w-5 rounded hover:bg-steel-800 text-muted-foreground hover:text-foreground"
                                                                                title="เพิ่มย่อหน้าเปล่าด้านล่าง"
                                                                            >
                                                                                <Plus className="h-3 w-3 text-emerald-500" />
                                                                            </Button>
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                disabled={editingParagraphs.length <= 1}
                                                                                onClick={() => handleDeleteParagraph(i)}
                                                                                className="h-5 w-5 rounded hover:bg-steel-800 text-muted-foreground hover:text-red-500 disabled:opacity-40"
                                                                                title="ลบย่อหน้านี้"
                                                                            >
                                                                                <Trash2 className="h-3 w-3 text-red-500" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm leading-relaxed text-muted-foreground pl-4">
                                                                    [{i + 1}] {para || <span className="text-muted-foreground/30 italic">[ย่อหน้าว่าง]</span>}
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Vertical Swap Position Arrows Stack on the Right (Visible always for active, on hover for inactive) */}
                                                        <div className={cn(
                                                            "flex flex-col gap-1 items-center justify-center pt-2 select-none shrink-0 transition-opacity duration-200",
                                                            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                        )}>
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                disabled={i === 0}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMoveParagraph(i, "up");
                                                                }}
                                                                className="h-7 w-7 rounded border-steel-800 hover:bg-steel-800 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                                                title="ย้ายย่อหน้าขึ้น"
                                                            >
                                                                <ArrowUp className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="icon"
                                                                variant="outline"
                                                                disabled={i === editingParagraphs.length - 1}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMoveParagraph(i, "down");
                                                                }}
                                                                className="h-7 w-7 rounded border-steel-800 hover:bg-steel-800 text-muted-foreground hover:text-foreground disabled:opacity-40"
                                                                title="ย้ายย่อหน้าลง"
                                                            >
                                                                <ArrowDown className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}


                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Footer */}
                        <div className="h-12 border-t border-steel-800 bg-muted/15 shrink-0 px-6 flex items-center justify-between relative">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-mono text-muted-foreground/80">
                                    ย่อหน้าที่ <strong className="text-foreground">{(activeParagraphIndex ?? 0) + 1}</strong> จาก <strong className="text-foreground">{editingParagraphs.length}</strong>
                                </span>
                                <span className="hidden md:inline text-[10px] font-mono text-muted-foreground/50">
                                    • กดยืนยันบันทึกด้วย Ctrl + Enter
                                </span>
                            </div>

                            {/* Bookmarks list & navigation */}
                            <div className="flex items-center gap-2 overflow-x-auto max-w-[55%] py-1">
                                <Bookmark className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <span className="text-xs text-muted-foreground shrink-0 font-medium">ที่คั่นหน้า:</span>
                                {bookmarks.length === 0 ? (
                                    <span className="text-xs text-muted-foreground/50 italic">
                                        ยังไม่มีที่คั่นหน้า (กด Alt+B เพื่อคั่นหน้า)
                                    </span>
                                ) : (
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
                                        {[...bookmarks].sort((a, b) => a - b).map((bIdx) => (
                                            <Badge
                                                key={bIdx}
                                                variant="outline"
                                                onClick={() => navigateParagraph(bIdx)}
                                                className={cn(
                                                    "cursor-pointer hover:bg-steel-800 text-[10px] font-mono border-amber-500/30 text-amber-500 hover:text-amber-400 gap-1 px-1.5 py-0.5 transition-colors shrink-0",
                                                    bIdx === activeParagraphIndex && "bg-amber-500/10 border-amber-500/60"
                                                )}
                                            >
                                                ย่อหน้าที่ {bIdx + 1}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div ref={editorContainerRef} className="flex-1 h-full flex flex-col bg-background relative overflow-hidden">
                        <ReactQuill
                            ref={quillRef}
                            theme="snow"
                            value={content}
                            onChange={(val) => {
                                setContent(val);
                                if (val !== lastSavedContent.current) setSaveStatus("unsaved");
                            }}
                            onChangeSelection={handleSelectionChange}
                            modules={modules}
                            className="h-full flex flex-col [&>.ql-toolbar]:border-t-0 [&>.ql-toolbar]:border-x-0 [&>.ql-toolbar]:border-b [&>.ql-toolbar]:bg-background [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-container]:border-none [&>.ql-container]:bg-muted/20 [&>.ql-editor]:bg-background [&>.ql-editor]:shadow-md [&>.ql-editor]:border [&>.ql-editor]:border-steel-800/30 [&>.ql-editor]:rounded-lg [&>.ql-editor]:my-8 [&>.ql-editor]:mx-auto [&>.ql-editor]:max-w-3xl [&>.ql-editor]:w-[calc(100%-4rem)] [&>.ql-editor]:p-8 [&>.ql-editor]:text-base [&>.ql-editor]:leading-relaxed"
                            placeholder="เริ่มต้นเขียนหรือเกลาเนื้อหาบทนี้..."
                        />
                    </div>
                )}

                {/* Right Resizer Handle */}
                {showAuditor && !isParagraphMode && (
                    <div
                        className={cn(
                            "hidden md:flex w-1 bg-steel-800/60 hover:bg-primary/55 cursor-col-resize z-10 transition-colors shrink-0",
                            isDraggingRight && "bg-primary"
                        )}
                        onMouseDown={handleRightDragStart}
                    />
                )}

                {/* Column 3: Right Auditor Panel */}
                {showAuditor && !isParagraphMode && (
                    <div
                        className="shrink-0 bg-card/40 flex flex-col h-full relative noise-texture-strong"
                        style={{ width: auditorWidth }}
                    >
                        {/* Header of Auditor */}
                        <div className="p-4 border-b border-steel-800 bg-muted/30 flex flex-col gap-3 shrink-0">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono font-bold tracking-widest text-primary uppercase flex items-center gap-1.5">
                                    <PenTool className="h-3.5 w-3.5 text-amber-500 animate-forge-pulse" />
                                    มาร์คกิ้งจุดที่ผิด
                                </span>
                                {issues.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] border-steel-600 font-mono">
                                        {issues.length} รายการ
                                    </Badge>
                                )}
                            </div>
                            <SpellCheckButton
                                novelId={novelId}
                                noteId={note.id}
                                getPlainText={() => {
                                    const editor = quillRef.current?.getEditor();
                                    return editor ? editor.getText() : "";
                                }}
                                onComplete={() => setIssuesKey(k => k + 1)}
                            />

                            {/* Filter buttons */}
                            <div className="grid grid-cols-4 gap-1 p-0.5 bg-muted/80 rounded-md border border-steel-800">
                                {["all", "developmental", "line", "proofreading"].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setLevelFilter(f)}
                                        className={cn(
                                            "text-[9px] font-mono tracking-wide py-1 px-1 rounded-sm transition-all uppercase font-medium",
                                            levelFilter === f
                                                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {f === "all" ? "ALL" : f === "developmental" ? "ร้ายแรง" : f === "line" ? "กลาง" : "น้อย"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content area: list of issues + add issue form */}
                        <div className="flex-1 p-3 space-y-4 overflow-y-auto">
                            {/* Selected text / Add issue form */}
                            {selectedText ? (
                                <div className="p-4 border border-steel-800 rounded-lg bg-card/60 backdrop-blur-xs shadow-md space-y-4 relative overflow-hidden">
                                    {/* Technical Corner Accents */}
                                    <div className="absolute top-0 right-0 w-8 h-[2px] bg-primary" />
                                    <div className="absolute top-0 right-0 w-[2px] h-8 bg-primary" />

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-mono tracking-wider font-bold text-foreground flex items-center gap-1.5">
                                            <PlusCircle className="h-4 w-4 text-primary" />
                                            มาร์กประเด็นคำแนะนำ
                                        </span>
                                        <Button variant="ghost" size="icon" onClick={() => { setSelectedText(""); setSelectionRange(null); }} className="h-6 w-6 rounded-md hover:bg-muted">
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1 uppercase">ข้อความที่เลือก</label>
                                            <div className="text-xs p-2.5 bg-muted/60 dark:bg-zinc-900/60 rounded-md border border-steel-800 font-mono italic max-h-[80px] overflow-y-auto break-all text-amber-500/90 leading-relaxed">
                                                "{selectedText}"
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1 uppercase">ระดับความสำคัญ</label>
                                            <Select value={newLevel} onValueChange={(val: any) => {
                                                setNewLevel(val);
                                                if (val === "proofreading") setNewCategory("spelling");
                                                else if (val === "line") setNewCategory("tell_vs_show");
                                                else setNewCategory("plot_hole");
                                            }}>
                                                <SelectTrigger className="w-full h-8 text-xs border-steel-800 bg-background/50 hover:bg-background/80 hover:border-steel-700 focus:ring-1 focus:ring-forge-amber/40 focus:border-forge-amber/60 transition-all">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="developmental" className="text-xs text-red-500 font-medium">ร้ายแรง</SelectItem>
                                                    <SelectItem value="line" className="text-xs text-amber-500 font-medium">กลาง</SelectItem>
                                                    <SelectItem value="proofreading" className="text-xs text-green-500 dark:text-green-400 font-medium">น้อย</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {newLevel === "proofreading" ? (
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">คำที่ต้องการเปลี่ยนแทนที่ (Auto-fix)</label>
                                                <Input
                                                    value={newSuggestedText}
                                                    onChange={(e) => setNewSuggestedText(e.target.value)}
                                                    placeholder="สะกดคำที่ถูกต้อง..."
                                                    className="text-xs h-8 bg-background border-steel-800 hover:border-steel-700 focus-visible:ring-1 focus-visible:ring-forge-amber/40 focus-visible:border-forge-amber/60 transition-all"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">คำแนะนำแนวทางแก้ไข</label>
                                                <Input
                                                    value={newSuggestionNotes}
                                                    onChange={(e) => setNewSuggestionNotes(e.target.value)}
                                                    placeholder="แนวทางการเกลาสำนวน..."
                                                    className="text-xs h-8 bg-background border-steel-800 hover:border-steel-700 focus-visible:ring-1 focus-visible:ring-forge-amber/40 focus-visible:border-forge-amber/60 transition-all"
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">รายละเอียดข้อบกพร่อง</label>
                                            <Textarea
                                                value={newDescription}
                                                onChange={(e) => setNewDescription(e.target.value)}
                                                placeholder="ระบุข้อผิดพลาดหรือปัญหาตรรกะ..."
                                                className="text-xs min-h-[60px] bg-background border-steel-800 hover:border-steel-700 focus-visible:ring-1 focus-visible:ring-forge-amber/40 focus-visible:border-forge-amber/60 transition-all"
                                            />
                                        </div>

                                        <Button onClick={handleAddIssue} size="default" className="w-full text-sm h-11 font-semibold tracking-wide chamfered-sm">
                                            บันทึกจุดตรวจทาน
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[11px] text-muted-foreground text-center py-3 bg-muted/20 border border-dashed border-steel-800 rounded-lg">
                                    เคล็ดลับ: ลากคลุมข้อความใน Editor ซ้าย เพื่อเริ่มมาร์กสะกดผิดหรือตรรกะโหว่
                                </div>
                            )}

                            {/* Audit Issues list */}
                            {loadingIssues ? (
                                <div className="flex justify-center items-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : filteredIssues.length === 0 ? (
                                <div className="text-center py-8 text-xs text-muted-foreground">
                                    <Check className="h-8 w-8 text-green-500 mx-auto mb-2 opacity-50" />
                                    <p>ไม่พบรายการที่ยังไม่ถูกแก้ไข</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredIssues.map((issue) => {
                                        const isDev = issue.level === "developmental";
                                        const isLine = issue.level === "line";
                                        const isProof = issue.level === "proofreading";

                                        return (
                                            <div
                                                key={issue.id}
                                                onClick={() => handleSelectIssueRange(issue)}
                                                className={cn(
                                                    "p-3.5 rounded-lg border bg-background/50 hover:bg-background/95 transition-all cursor-pointer space-y-3 relative group",
                                                    isDev && "border-red-500/15 hover:border-red-500/30 bg-red-500/[0.01] hover:shadow-[0_2px_8px_rgba(239,68,68,0.04)]",
                                                    isLine && "border-amber-500/15 hover:border-amber-500/30 bg-amber-500/[0.01] hover:shadow-[0_2px_8px_rgba(245,158,11,0.04)]",
                                                    isProof && "border-green-500/15 hover:border-green-500/30 bg-green-500/[0.01] hover:shadow-[0_2px_8px_rgba(34,197,94,0.04)]"
                                                )}
                                            >

                                                <div className="flex items-start justify-between gap-1">
                                                    <div className="flex flex-wrap gap-1">
                                                        <span
                                                            className={cn(
                                                                "text-[9px] font-mono tracking-wider px-2 py-0.5 rounded font-bold uppercase",
                                                                isDev && "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                                                                isLine && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                                                                isProof && "bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20"
                                                            )}
                                                        >
                                                            {isDev ? "ร้ายแรง" : isLine ? "กลาง" : "น้อย"}
                                                        </span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteIssue(issue.id);
                                                        }}
                                                        className="h-5 w-5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>

                                                <div className="text-xs font-mono italic text-muted-foreground bg-muted/30 dark:bg-zinc-900/40 p-2 rounded border border-steel-800 break-all leading-normal relative pl-6">
                                                    <span className="absolute left-2 top-1 text-lg text-muted-foreground/30 font-serif">“</span>
                                                    {issue.flaggedText}
                                                </div>

                                                <p className="text-xs text-foreground font-medium px-1">
                                                    {issue.issueDescription}
                                                </p>

                                                {isLine && issue.suggestionNotes && (
                                                    <div className="text-[10px] leading-normal text-amber-600 dark:text-amber-400 bg-amber-500/5 p-2 rounded border border-amber-500/10 font-sans">
                                                        <span className="font-semibold">แนะนำเกลา:</span> {issue.suggestionNotes}
                                                    </div>
                                                )}
                                                {isDev && issue.suggestionNotes && (
                                                    <div className="text-[10px] leading-normal text-red-600 dark:text-red-400 bg-red-500/5 p-2 rounded border border-red-500/10 font-sans">
                                                        <span className="font-semibold">แนะนำแก้ตรรกะ:</span> {issue.suggestionNotes}
                                                    </div>
                                                )}

                                                {isProof && (
                                                    <div className="flex items-center justify-between gap-2 pt-1 px-1">
                                                        <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                            <span>แก้เป็น:</span>
                                                            <span className="font-mono bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 border border-emerald-500/20 rounded text-[11px]">
                                                                {issue.suggestedText === "" ? "[ลบออก]" : issue.suggestedText}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAutoFix(issue);
                                                            }}
                                                            className="h-6 text-[10px] font-bold border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/20 hover:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 rounded-md"
                                                        >
                                                            <Check className="h-3 w-3 mr-1" />
                                                            Auto-fix
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

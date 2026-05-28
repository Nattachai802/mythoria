"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { GitCompare, BookOpen } from "lucide-react";

import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

// Helper functions for paragraph rewrite mode
function parseHtmlToParagraphs(html: string): string[] {
    if (!html) return [];
    if (typeof window === "undefined") return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const pElements = Array.from(doc.querySelectorAll("p, div, li"));
    if (pElements.length > 0) {
        return pElements.map(el => el.textContent || "").filter(text => text.trim() !== "");
    }
    // Fallback split by double newlines or single newlines
    return html.split(/\n+/).map(text => text.trim()).filter(text => text !== "");
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
            return `<del class="bg-red-500/20 text-red-500 line-through px-0.5 rounded mx-0.5">${escapedText}</del>`;
        } else if (op === 1) {
            return `<ins class="bg-green-500/20 text-green-500 no-underline px-0.5 rounded mx-0.5">${escapedText}</ins>`;
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

    // Paragraph Rewrite Mode States
    const [isParagraphMode, setIsParagraphMode] = useState(false);
    const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
    const [editingParagraphs, setEditingParagraphs] = useState<string[]>([]);
    const [originalParagraphs, setOriginalParagraphs] = useState<string[]>([]);
    
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

    // Auto-align paragraph arrays if content changes externally
    useEffect(() => {
        if (!isParagraphMode && content) {
            const parsed = parseHtmlToParagraphs(content);
            setEditingParagraphs(parsed);
        }
    }, [content, isParagraphMode]);

    // Fetch existing issues
    useEffect(() => {
        const fetchIssues = async () => {
            setLoadingIssues(true);
            try {
                const res = await fetch(`/api/novel/${novelId}/note/${note.id}/audit-issues`);
                const data = await res.json();
                if (data.success) {
                    setIssues(data.issues || []);
                }
            } catch (e) {
                console.error("Failed to load issues:", e);
            } finally {
                setLoadingIssues(false);
            }
        };
        fetchIssues();
    }, [novelId, note.id]);

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
        setSaveStatus("saving");
        try {
            const res = await updateNote(note.id, {
                title,
                content: { text: content }
            });
            if (res.success) {
                const wordCount = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim().split(/\s+/).length;
                await createNoteVersion(note.id, title, { text: content }, wordCount, "manual");
                lastSavedContent.current = content;
                setSaveStatus("saved");
                toast.success("บันทึกเนื้อหาเรียบร้อย");
            } else {
                setSaveStatus("error");
            }
        } catch (e) {
            setSaveStatus("error");
            toast.error("เกิดข้อผิดพลาดในการบันทึก");
        }
    };

    // Change note status
    const handleStatusChange = async (newStatus: NoteStatus) => {
        setStatus(newStatus);
        try {
            const res = await updateNoteStatus(note.id, newStatus);
            if (res.success) {
                toast.success(`เปลี่ยนสถานะเป็น: ${NOTE_STATUS_CONFIG[newStatus].label}`);
                router.refresh();
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
                        className="text-sm font-semibold font-display border-none shadow-none focus-visible:ring-0 px-2 py-1 h-8 bg-muted/40 hover:bg-muted/80 focus:bg-background rounded-md transition-colors max-w-[240px]"
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
                                setActiveParagraphIndex(0);
                            }
                            setIsParagraphMode(!isParagraphMode);
                        }}
                    >
                        <GitCompare className="h-3.5 w-3.5 text-amber-500" />
                        <span className="hidden sm:inline">{isParagraphMode ? "โหมดปกติ" : "โหมดเกลาทีละย่อหน้า"}</span>
                    </Button>

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
                        {/* Upper split area */}
                        <div className="flex-1 flex flex-row overflow-hidden divide-x divide-steel-800/60">
                            {/* Left Pane: Single Original Paragraph */}
                            <div className="flex-1 h-full flex flex-col min-w-[320px] overflow-hidden bg-muted/5">
                                <div className="p-4 border-b border-steel-800/60 bg-muted/20 flex items-center justify-between shrink-0">
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

                                <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-center max-w-2xl mx-auto w-full relative">
                                    <div className="absolute top-4 left-6 text-xs font-mono text-muted-foreground/35 select-none font-bold">
                                        ORIGINAL PARAGRAPH #{(activeParagraphIndex ?? 0) + 1}
                                    </div>
                                    {loadingCompareVersion ? (
                                        <div className="flex justify-center items-center py-8">
                                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : (
                                        <p className="text-lg leading-relaxed tracking-wide text-foreground/80 font-sans whitespace-pre-wrap italic border-l-2 border-amber-500/20 pl-4 py-2">
                                            {originalParagraphs[activeParagraphIndex ?? 0] || (
                                                <span className="text-muted-foreground/30">[ย่อหน้าว่างในประวัติเวอร์ชันนี้]</span>
                                            )}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Right Pane: Editable Textarea & Diff Preview */}
                            <div className="flex-1 h-full flex flex-col min-w-[320px] overflow-hidden bg-background">
                                <div className="p-4 border-b border-steel-800/60 bg-muted/20 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                                        <PenTool className="h-3.5 w-3.5 text-amber-500" />
                                        การปรับปรุงภาษาและเกลาสำนวน
                                    </span>
                                    <span className="text-[10px] font-mono text-muted-foreground bg-steel-900 border border-steel-800 px-2 py-0.5 rounded-sm">
                                        FOCUS EDITING
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col max-w-2xl mx-auto w-full">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">
                                                พิมพ์เกลาข้อความในกล่องนี้:
                                            </label>
                                            <span className="text-[10px] font-mono text-muted-foreground/50">
                                                (ดัชนีย่อหน้า #{(activeParagraphIndex ?? 0) + 1})
                                            </span>
                                        </div>
                                        <textarea
                                            value={editingParagraphs[activeParagraphIndex ?? 0] || ""}
                                            onChange={(e) => handleUpdateParagraph(activeParagraphIndex ?? 0, e.target.value)}
                                            className="w-full min-h-[160px] p-4 text-base bg-muted/10 border border-steel-800 rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 resize-y text-foreground leading-relaxed outline-none transition-all duration-200 shadow-inner"
                                            placeholder="เริ่มต้นเขียนหรือเกลาเนื้อหาบทนี้..."
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                                    e.preventDefault();
                                                    const idx = activeParagraphIndex ?? 0;
                                                    if (idx < editingParagraphs.length - 1) {
                                                        setActiveParagraphIndex(idx + 1);
                                                    } else {
                                                        setIsParagraphMode(false);
                                                        setActiveParagraphIndex(null);
                                                        toast.success("เกลาเนื้อหาครบทุกย่อหน้าแล้ว");
                                                    }
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Real-time Diff Preview Box */}
                                    {originalParagraphs[activeParagraphIndex ?? 0] !== editingParagraphs[activeParagraphIndex ?? 0] && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-mono font-bold tracking-wider text-muted-foreground uppercase">
                                                เปรียบเทียบการเปลี่ยนแปลง (Word Diff):
                                            </label>
                                            <div className="p-4 rounded-lg border border-steel-800 bg-muted/10 text-sm leading-relaxed tracking-wide whitespace-pre-wrap min-h-[80px]">
                                                <div 
                                                    dangerouslySetInnerHTML={{ 
                                                        __html: getWordDiffHtml(
                                                            originalParagraphs[activeParagraphIndex ?? 0] || "", 
                                                            editingParagraphs[activeParagraphIndex ?? 0] || ""
                                                        ) 
                                                    }} 
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Navigation Footer */}
                        <div className="h-16 border-t border-steel-800 bg-muted/15 shrink-0 px-6 flex items-center justify-between relative">
                            {/* Visual Progress Bar */}
                            <div className="absolute top-0 left-0 h-[2px] bg-amber-500 transition-all duration-300" 
                                 style={{ width: `${(((activeParagraphIndex ?? 0) + 1) / (editingParagraphs.length || 1)) * 100}%` }} 
                            />
                            
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-mono text-muted-foreground/80">
                                    ย่อหน้าที่ <strong className="text-foreground">{(activeParagraphIndex ?? 0) + 1}</strong> จาก <strong className="text-foreground">{editingParagraphs.length}</strong>
                                </span>
                                <span className="hidden md:inline text-[10px] font-mono text-muted-foreground/50">
                                    • กดยืนยันบันทึกด้วย Ctrl + Enter
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={(activeParagraphIndex ?? 0) === 0}
                                    onClick={() => {
                                        const idx = activeParagraphIndex ?? 0;
                                        setActiveParagraphIndex(idx - 1);
                                    }}
                                    className="h-8 text-xs px-4"
                                >
                                    ก่อนหน้า
                                </Button>
                                
                                {(activeParagraphIndex ?? 0) < editingParagraphs.length - 1 ? (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            const idx = activeParagraphIndex ?? 0;
                                            setActiveParagraphIndex(idx + 1);
                                        }}
                                        className="h-8 text-xs px-4 hover:border-amber-500/50 hover:bg-amber-500/5"
                                    >
                                        ถัดไป
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="forge"
                                        onClick={() => {
                                            setIsParagraphMode(false);
                                            setActiveParagraphIndex(null);
                                            toast.success("เกลาเนื้อหาครบทุกย่อหน้าแล้ว");
                                        }}
                                        className="h-8 text-xs px-4 font-semibold"
                                    >
                                        เสร็จสิ้น
                                    </Button>
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
                                    ตรวจแก้ด้วยตนเอง
                                </span>
                                {issues.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] border-steel-600 font-mono">
                                        {issues.length} รายการ
                                    </Badge>
                                )}
                            </div>

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
                                        {f === "all" ? "ALL" : f === "developmental" ? "พล็อต" : f === "line" ? "สำนวน" : "คำผิด"}
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
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1 uppercase">ระดับประเด็น</label>
                                                <Select value={newLevel} onValueChange={(val: any) => {
                                                    setNewLevel(val);
                                                    if (val === "proofreading") setNewCategory("spelling");
                                                    else if (val === "line") setNewCategory("tell_vs_show");
                                                    else setNewCategory("plot_hole");
                                                }}>
                                                    <SelectTrigger className="h-8 text-xs border-steel-800 bg-background/50">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="developmental" className="text-xs text-red-500 font-medium">ตรรกะ (แดง)</SelectItem>
                                                        <SelectItem value="line" className="text-xs text-amber-500 font-medium">สำนวน (เหลือง)</SelectItem>
                                                        <SelectItem value="proofreading" className="text-xs text-blue-500 font-medium">คำผิด (น้ำเงิน)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1 uppercase">หมวดหมู่</label>
                                                <Select value={newCategory} onValueChange={setNewCategory}>
                                                    <SelectTrigger className="h-8 text-xs border-steel-800 bg-background/50">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {newLevel === "developmental" && (
                                                            <>
                                                                <SelectItem value="plot_hole" className="text-xs">พล็อตโหว่</SelectItem>
                                                                <SelectItem value="character_state" className="text-xs">สถานะตัวละคร</SelectItem>
                                                            </>
                                                        )}
                                                        {newLevel === "line" && (
                                                            <>
                                                                <SelectItem value="tell_vs_show" className="text-xs">Tell vs Show</SelectItem>
                                                            </>
                                                        )}
                                                        {newLevel === "proofreading" && (
                                                            <>
                                                                <SelectItem value="spelling" className="text-xs">คำสะกดผิด</SelectItem>
                                                                <SelectItem value="redundancy" className="text-xs">คำฟุ่มเฟือย</SelectItem>
                                                            </>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {newLevel === "proofreading" ? (
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">คำที่ต้องการเปลี่ยนแทนที่ (Auto-fix)</label>
                                                <Input
                                                    value={newSuggestedText}
                                                    onChange={(e) => setNewSuggestedText(e.target.value)}
                                                    placeholder="สะกดคำที่ถูกต้อง..."
                                                    className="text-xs h-8 bg-background border-steel-800"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">คำแนะนำแนวทางแก้ไข</label>
                                                <Input
                                                    value={newSuggestionNotes}
                                                    onChange={(e) => setNewSuggestionNotes(e.target.value)}
                                                    placeholder="แนวทางการเกลาสำนวน..."
                                                    className="text-xs h-8 bg-background border-steel-800"
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <label className="text-[9px] font-mono tracking-wider text-muted-foreground block mb-1">รายละเอียดข้อบกพร่อง</label>
                                            <Textarea
                                                value={newDescription}
                                                onChange={(e) => setNewDescription(e.target.value)}
                                                placeholder="ระบุข้อผิดพลาดหรือปัญหาตรรกะ..."
                                                className="text-xs min-h-[60px] bg-background border-steel-800"
                                            />
                                        </div>

                                        <Button onClick={handleAddIssue} size="default" className="w-full text-sm h-11 font-semibold tracking-wide chamfered-sm">
                                            บันทึกจุดตรวจทาน
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[11px] text-muted-foreground text-center py-3 bg-muted/20 border border-dashed border-steel-800 rounded-lg">
                                    เคล็ดลับ: ลากคลุมข้อความใน Editor ซ้าย เพื่อเริ่มมาร์กประเด็นสะกดผิดหรือพล็อตโหว่
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
                                                    "p-3.5 rounded-lg border bg-background/50 hover:bg-background/90 transition-all cursor-pointer space-y-3 relative group",
                                                    isDev && "border-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_10px_rgba(239,68,68,0.1)]",
                                                    isLine && "border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_10px_rgba(245,158,11,0.1)]",
                                                    isProof && "border-blue-500/20 hover:border-blue-500/40 hover:shadow-[0_0_10px_rgba(59,130,246,0.1)]"
                                                )}
                                            >
                                                {/* Tech accent bar */}
                                                <div className={cn(
                                                    "absolute top-0 left-0 w-[3px] h-full rounded-l-lg",
                                                    isDev && "bg-red-500",
                                                    isLine && "bg-amber-500",
                                                    isProof && "bg-blue-500"
                                                )} />

                                                <div className="flex items-start justify-between gap-1">
                                                    <div className="flex flex-wrap gap-1">
                                                        <span
                                                            className={cn(
                                                                "text-[9px] font-mono tracking-wider px-2 py-0.5 rounded font-bold uppercase",
                                                                isDev && "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
                                                                isLine && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                                                                isProof && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                                            )}
                                                        >
                                                            {issue.category.replace("_", " ")}
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
                                                        <span className="font-semibold">แนะนำแก้พล็อต:</span> {issue.suggestionNotes}
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

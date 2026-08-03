"use client";

import { useState, useMemo, useEffect } from "react";
import { Idea } from "@/db/schema";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Lightbulb,
    BookOpen,
    Sparkles,
    Check,
    X,
    Loader2,
    Trash2,
    Pencil,
    Save,
    CheckCircle2,
    Plus,
    CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { updateIdea, deleteIdea, acceptMultipleIdeas } from "@/server/idea";
import { toast } from "sonner";

interface IdeasViewProps {
    ideas: Idea[];
    novelId: string;
    chapters?: { id: string; title: string }[];
}

// PRODUCT.md ข้อ 4 "Thai-first clarity" — หมวดที่ผู้ใช้ต้องเลือกเองต้องอ่านออกโดยไม่ต้องรู้อังกฤษ
const CATEGORY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    plot:          { label: "โครงเรื่อง",  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", dot: "bg-purple-500" },
    character:     { label: "ตัวละคร",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",         dot: "bg-blue-500" },
    worldbuilding: { label: "สร้างโลก",    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",     dot: "bg-green-500" },
    subplot:       { label: "ปมย่อย",      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",     dot: "bg-amber-500" },
    general:       { label: "ทั่วไป",      color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",            dot: "bg-gray-400" },
};

function getCat(category: string | null | undefined) {
    return CATEGORY_CONFIG[category ?? "general"] ?? CATEGORY_CONFIG.general;
}

export function IdeasView({ ideas, novelId, chapters = [] }: IdeasViewProps) {
    const router = useRouter();

    /**
     * หน้านี้คือ "ของที่พร้อมหยิบไปใช้" ไม่ใช่คลังของเก่า
     * ไอเดียที่ถูกลากไปวางในฉากบนหน้า Plot แล้ว (isUsed) จึงหายออกจากรายการ
     * — เหมือนที่ resource-sidebar ของ Plot กรอง !item.isUsed อยู่แล้ว
     * ยังเปิดดูย้อนหลังได้ด้วยปุ่มสลับ เผื่ออยากรู้ว่าไอเดียเก่าไปอยู่ไหน
     */
    const [showUsed, setShowUsed] = useState(false);

    const availableIdeas = useMemo(() => ideas.filter(i => !i.isDetected && !i.isUsed), [ideas]);
    const usedIdeas = useMemo(() => ideas.filter(i => !i.isDetected && i.isUsed), [ideas]);
    const normalIdeas = showUsed ? usedIdeas : availableIdeas;
    const detectedIdeas = useMemo(() => ideas.filter(i => i.isDetected), [ideas]);

    const totalTracked = availableIdeas.length + usedIdeas.length;
    const usedPercent = totalTracked > 0 ? Math.round((usedIdeas.length / totalTracked) * 100) : 0;

    // ── Search + Filter ─────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const filteredIdeas = useMemo(() => {
        return normalIdeas.filter(idea => {
            if (categoryFilter && (idea.category || "general") !== categoryFilter) return false;
            const q = searchQuery.toLowerCase().trim();
            if (!q) return true;
            if (idea.title.toLowerCase().includes(q)) return true;
            if (Array.isArray(idea.tags) && (idea.tags as string[]).some(t => t.toLowerCase().includes(q))) return true;
            if (typeof idea.content === "string" && idea.content.toLowerCase().includes(q)) return true;
            return false;
        });
    }, [normalIdeas, searchQuery, categoryFilter]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const idea of normalIdeas) {
            const cat = idea.category || "general";
            counts[cat] = (counts[cat] ?? 0) + 1;
        }
        return counts;
    }, [normalIdeas]);

    // ── Selected idea ────────────────────────────────────────
    const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);

    const selectedIdea = useMemo(
        () => normalIdeas.find(i => i.id === selectedIdeaId) ?? null,
        [normalIdeas, selectedIdeaId]
    );

    /**
     * เลือกรายการแรกให้อัตโนมัติเมื่อ "ของที่เลือกอยู่ไม่อยู่ในรายการที่เห็น" —
     * ครอบทั้งตอนเปิดหน้าครั้งแรก ตอนสลับโหมด และตอนลบรายการที่เลือกอยู่ทิ้ง
     * (เดิม effect นี้มี dependency ว่าง ทำงานแค่ตอน mount → สลับโหมดแล้วแพนขวาว่างค้าง)
     */
    useEffect(() => {
        if (filteredIdeas.length === 0) {
            if (selectedIdeaId !== null) setSelectedIdeaId(null);
            return;
        }
        if (!filteredIdeas.some(i => i.id === selectedIdeaId)) {
            setSelectedIdeaId(filteredIdeas[0].id);
        }
    }, [filteredIdeas, selectedIdeaId]);

    /** สลับระหว่าง "พร้อมใช้" กับ "คลังที่ใช้ไปแล้ว" — ล้างตัวกรองด้วย ไม่งั้นคำค้นเก่าค้างข้ามโหมด */
    const switchMode = (next: boolean) => {
        setShowUsed(next);
        setSearchQuery("");
        setCategoryFilter(null);
        setIsEditing(false);
    };

    /** ลูกศรขึ้น/ลง เลื่อนรายการโดยไม่ต้องละมือจากคีย์บอร์ด (PRODUCT.md: keyboard สำคัญกับ power user) */
    const moveSelection = (delta: number) => {
        if (filteredIdeas.length === 0) return;
        const i = filteredIdeas.findIndex(x => x.id === selectedIdeaId);
        const next = Math.min(Math.max((i < 0 ? 0 : i) + delta, 0), filteredIdeas.length - 1);
        setSelectedIdeaId(filteredIdeas[next].id);
    };

    // ── Inline edit state ────────────────────────────────────
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");
    const [editTags, setEditTags] = useState("");
    const [editCategory, setEditCategory] = useState("general");
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Sync form when selection changes
    useEffect(() => {
        if (selectedIdea) {
            setEditTitle(selectedIdea.title);
            setEditContent(typeof selectedIdea.content === "string" ? selectedIdea.content : "");
            setEditTags(Array.isArray(selectedIdea.tags) ? (selectedIdea.tags as string[]).join(", ") : "");
            setEditCategory(selectedIdea.category || "general");
            setIsEditing(false);
        }
    }, [selectedIdea?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSave = async () => {
        if (!selectedIdea) return;
        if (!editTitle.trim()) {
            toast.error("กรุณาใส่ชื่อไอเดีย");
            return;
        }
        setIsSaving(true);
        const tagsArray = editTags ? editTags.split(",").map(t => t.trim()).filter(Boolean) : [];
        const result = await updateIdea(selectedIdea.id, {
            title: editTitle,
            content: editContent,
            tags: tagsArray,
            category: editCategory,
        });
        if (result.success) {
            toast.success("บันทึกเรียบร้อย");
            setIsEditing(false);
            router.refresh();
        } else {
            // เก็บค่าที่พิมพ์ไว้ในฟอร์มเสมอ — ผู้ใช้จะได้ไม่ต้องพิมพ์ใหม่ตอนกดลองใหม่
            toast.error(result.error || "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", {
                action: { label: "ลองใหม่", onClick: () => handleSave() },
            });
        }
        setIsSaving(false);
    };

    // ยืนยันด้วย AlertDialog ชุดเดียวกับที่ปุ่ม "ลบทั้งหมด" ใช้ — เดิมเรียก confirm() ของเบราว์เซอร์
    // ซึ่ง theme ไม่ได้ ฟอนต์ไม่ตรงกับแอป และปุ่มเป็นภาษาของระบบปฏิบัติการ
    const handleDelete = async () => {
        if (!selectedIdea) return;
        const title = selectedIdea.title;
        setIsDeleting(true);
        const result = await deleteIdea(selectedIdea.id);
        if (result.success) {
            toast.success(`ลบ "${title}" แล้ว`);
            setSelectedIdeaId(null);
            router.refresh();
        } else {
            toast.error(result.error || "ลบไม่สำเร็จ ลองใหม่อีกครั้ง", {
                action: { label: "ลองใหม่", onClick: () => handleDelete() },
            });
        }
        setIsDeleting(false);
    };

    // ── Detected ideas ───────────────────────────────────────
    const [processingIds, setProcessingIds] = useState<Record<string, "accept" | "reject" | null>>({});

    const handleAccept = async (ideaId: string, title: string) => {
        setProcessingIds(prev => ({ ...prev, [ideaId]: "accept" }));
        try {
            const res = await updateIdea(ideaId, { isDetected: false });
            if (res.success) {
                toast.success(`เพิ่ม "${title}" เข้าคลังเรียบร้อย`);
                router.refresh();
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาด");
            }
        } catch {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setProcessingIds(prev => ({ ...prev, [ideaId]: null }));
        }
    };

    const handleReject = async (ideaId: string, title: string) => {
        setProcessingIds(prev => ({ ...prev, [ideaId]: "reject" }));
        try {
            const res = await deleteIdea(ideaId);
            if (res.success) {
                toast.success(`ละทิ้งไอเดีย "${title}" เรียบร้อย`);
                router.refresh();
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาด");
            }
        } catch {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setProcessingIds(prev => ({ ...prev, [ideaId]: null }));
        }
    };

    const [isBulkAccepting, setIsBulkAccepting] = useState(false);

    const handleAcceptAll = async () => {
        if (detectedIdeas.length === 0) return;
        setIsBulkAccepting(true);
        const ids = detectedIdeas.map(i => i.id);
        const res = await acceptMultipleIdeas(ids, novelId);
        if (res.success) {
            toast.success(`รับ ${res.count} ไอเดียเข้าคลังเรียบร้อย`);
            router.refresh();
        } else {
            toast.error(res.error || "เกิดข้อผิดพลาด");
        }
        setIsBulkAccepting(false);
    };

    const bubbles = useMemo(() => {
        if (detectedIdeas.length === 0) return [];
        return detectedIdeas.map((idea, index) => {
            const count = detectedIdeas.length;
            const colsCount = Math.ceil(Math.sqrt(count)) || 1;
            const rowsCount = Math.ceil(count / colsCount) || 1;
            const col = index % colsCount;
            const row = Math.floor(index / colsCount);
            const leftStep = 90 / colsCount;
            const topStep = 80 / rowsCount;
            const leftBase = col * leftStep + 5;
            const topBase = row * topStep + 10;
            const jitterLeft = (Math.random() * (leftStep * 0.4)) - (leftStep * 0.2);
            const jitterTop = (Math.random() * (topStep * 0.4)) - (topStep * 0.2);
            return {
                idea,
                left: Math.max(5, Math.min(85, leftBase + jitterLeft)),
                top: Math.max(10, Math.min(80, topBase + jitterTop)),
                duration: 10 + (index % 5) * 2,
                delay: -(index * 1.5),
                animationPattern: (index % 4) + 1,
                scale: 0.9 + (index % 3) * 0.05,
            };
        });
    }, [detectedIdeas]);

    const containerHeight = useMemo(() => {
        const rows = Math.ceil(detectedIdeas.length / 4);
        return `${Math.max(400, rows * 160 + 120)}px`;
    }, [detectedIdeas]);

    const chapterMap = useMemo(
        () => Object.fromEntries(chapters.map(ch => [ch.id, ch])),
        [chapters]
    );

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="space-y-4">
            <Tabs defaultValue="ideas" className="w-full">
                {/* แท็บ + ตัวชี้ความคืบหน้า — ปุ่มสลับคลังต้องอยู่นอก TabsList
                    เพราะ TabsList render เป็น role="tablist" ซึ่งลูกต้องเป็น role="tab" เท่านั้น */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <TabsList className="bg-muted/50 p-1 flex w-fit gap-1">
                        <TabsTrigger value="ideas" className="flex items-center gap-2 h-11 md:h-9 data-[state=active]:bg-background">
                            <Lightbulb className="w-4 h-4" />
                            <span>พร้อมใช้ ({availableIdeas.length})</span>
                        </TabsTrigger>
                        <TabsTrigger value="detected" className="flex items-center gap-2 h-11 md:h-9 data-[state=active]:bg-background relative">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <span>AI ตรวจพบ ({detectedIdeas.length})</span>
                            {detectedIdeas.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {/* ไอเดียที่ถูกใช้แล้วคือหลักฐานว่าระบบทำงาน ไม่ใช่ของที่ต้องซ่อน — แสดงเป็นความคืบหน้า */}
                    {usedIdeas.length > 0 && (
                        <button
                            type="button"
                            onClick={() => switchMode(!showUsed)}
                            aria-pressed={showUsed}
                            className={cn(
                                "group flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                                showUsed
                                    ? "border-primary/40 bg-primary/5"
                                    : "border-transparent hover:border-border hover:bg-muted/40"
                            )}
                        >
                            <div className="min-w-[9rem]">
                                <p className="text-xs font-medium">
                                    ใช้ไปแล้ว {usedIdeas.length} จาก {totalTracked}
                                </p>
                                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                                        style={{ width: `${usedPercent}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-xs text-muted-foreground group-hover:text-foreground">
                                {showUsed ? "← กลับ" : "ดูคลัง"}
                            </span>
                        </button>
                    )}
                </div>

                {/* กฎที่ทำให้ไอเดียหายจากรายการ ต้องมองเห็นได้ตลอด ไม่ใช่ซ่อนใน title tooltip
                    (tooltip ไม่ขึ้นบน touch ไม่ขึ้นตอนโฟกัสคีย์บอร์ด และหายไปพร้อมหน้าว่าง) */}
                <p className="mb-4 text-xs text-muted-foreground">
                    ไอเดียจะย้ายเข้าคลัง &ldquo;ใช้ไปแล้ว&rdquo; อัตโนมัติเมื่อถูกวางลงในฉากบนหน้า Plot
                </p>

                {/* ── Split-pane view ── */}
                <TabsContent value="ideas" className="mt-0">
                    {normalIdeas.length === 0 ? (
                        <EmptyState novelId={novelId} usedCount={showUsed ? 0 : usedIdeas.length} />
                    ) : (
                        <div className={cn(
                            "flex flex-col md:flex-row border rounded-xl overflow-hidden bg-card",
                            "h-[70vh] min-h-[26rem] md:h-[35rem]",
                            // สัญญาณคงที่ว่ากำลังอยู่ในคลัง ไม่ใช่รายการที่พร้อมใช้ — กัน mode error
                            showUsed && "border-primary/40 ring-1 ring-primary/15"
                        )}>
                            {/* Left: compact list — จอแคบซ่อนเมื่อเปิดรายละเอียดอยู่ */}
                            <div className={cn(
                                "w-full md:w-60 flex-shrink-0 border-b md:border-b-0 md:border-r flex-col min-h-0",
                                selectedIdea ? "hidden md:flex" : "flex"
                            )}>
                                {showUsed && (
                                    <div className="flex items-center gap-1.5 bg-primary/5 px-2.5 py-1.5 text-xs text-primary border-b">
                                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                                        คลังที่ใช้ไปแล้ว
                                    </div>
                                )}
                                {/* Search + Filter */}
                                <div className="px-2.5 py-2 border-b space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="ค้นหา..."
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            className="pl-8 h-8 text-sm"
                                        />
                                    </div>
                                    {/* Category filters */}
                                    <div className="flex flex-wrap gap-1">
                                        <button
                                            onClick={() => setCategoryFilter(null)}
                                            className={cn(
                                                "text-xs px-2 py-0.5 rounded-full border transition-colors",
                                                categoryFilter === null
                                                    ? "bg-foreground text-background border-foreground"
                                                    : "border-border text-muted-foreground hover:border-foreground/50"
                                            )}
                                        >
                                            ทั้งหมด
                                        </button>
                                        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                                            const count = categoryCounts[key];
                                            if (!count) return null;
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
                                                    className={cn(
                                                        "text-xs px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1",
                                                        categoryFilter === key
                                                            ? cfg.color + " border-transparent"
                                                            : "border-border text-muted-foreground hover:border-foreground/50"
                                                    )}
                                                >
                                                    <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                                                    {cfg.label}
                                                    <span className="opacity-60">{count}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {(searchQuery || categoryFilter) && (
                                        <p className="text-xs text-muted-foreground px-0.5">
                                            พบ {filteredIdeas.length} จาก {normalIdeas.length}
                                        </p>
                                    )}
                                </div>

                                {/* List */}
                                <div
                                    className="flex-1 overflow-y-auto"
                                    onKeyDown={e => {
                                        if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(1); }
                                        if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(-1); }
                                    }}
                                >
                                    {filteredIdeas.length === 0 ? (
                                        <p className="p-4 text-center text-sm text-muted-foreground">ไม่พบไอเดียที่ตรงกัน</p>
                                    ) : (
                                        filteredIdeas.map(idea => {
                                            const cat = getCat(idea.category);
                                            const isSelected = idea.id === selectedIdeaId;
                                            return (
                                                <button
                                                    key={idea.id}
                                                    onClick={() => setSelectedIdeaId(idea.id)}
                                                    className={cn(
                                                        "w-full text-left px-3 py-3 md:py-2.5 min-h-[44px] md:min-h-0 border-b last:border-b-0 transition-colors flex items-start gap-2.5",
                                                        isSelected
                                                            ? "bg-primary/8 border-l-2 border-l-primary"
                                                            : "hover:bg-muted/50 border-l-2 border-l-transparent"
                                                    )}
                                                >
                                                    <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", cat.dot)} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate leading-snug">
                                                            {idea.title}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                            {idea.isUsed && (
                                                                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5 leading-none">
                                                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                                                    อยู่ในฉากแล้ว
                                                                </span>
                                                            )}
                                                            {Array.isArray(idea.tags) && (idea.tags as string[]).slice(0, 2).map((tag, i) => (
                                                                <span key={i} className="text-xs text-muted-foreground truncate max-w-[70px] leading-none">
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* New idea button */}
                                <div className="p-2.5 border-t">
                                    <CreateIdeaDialog
                                        novelId={novelId}
                                        trigger={
                                            // ปุ่มหลักของหน้าอยู่ที่หัวหน้าแล้ว อันนี้เป็นทางลัดในบริบทรายการ
                                            // จึงใช้น้ำหนักเบากว่าและคำต่างกัน ไม่ให้ดูเหมือนปุ่มหลักซ้ำสองที่
                                            <Button size="sm" variant="ghost" className="w-full h-10 md:h-8 text-xs gap-1 text-muted-foreground">
                                                <Plus className="w-3.5 h-3.5" />
                                                เพิ่มไอเดียลงรายการนี้
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>

                            {/* Right: detail + inline edit — จอแคบแสดงเต็มพื้นที่แทนรายการ */}
                            <div className={cn(
                                "flex-1 flex-col min-w-0 min-h-0",
                                selectedIdea ? "flex" : "hidden md:flex"
                            )}>
                                {selectedIdea ? (
                                    <>
                                        {/* Header */}
                                        <div className="px-4 py-3 border-b flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                {/* ทางกลับรายการสำหรับจอแคบ ที่นั่นรายการถูกซ่อนอยู่ */}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedIdeaId(null)}
                                                    className="md:hidden mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground min-h-[44px] -my-2"
                                                >
                                                    ← กลับไปที่รายการ
                                                </button>
                                                {isEditing ? (
                                                    <Input
                                                        value={editTitle}
                                                        onChange={e => setEditTitle(e.target.value)}
                                                        className="font-semibold h-7 py-1 text-sm border-dashed"
                                                    />
                                                ) : (
                                                    <h2 className="text-base font-semibold leading-snug">{selectedIdea.title}</h2>
                                                )}

                                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                    {isEditing ? (
                                                        <Select value={editCategory} onValueChange={setEditCategory}>
                                                            <SelectTrigger className="h-6 text-xs w-auto px-2 py-0">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="general">ทั่วไป</SelectItem>
                                                                <SelectItem value="plot">โครงเรื่อง</SelectItem>
                                                                <SelectItem value="character">ตัวละคร</SelectItem>
                                                                <SelectItem value="worldbuilding">สร้างโลก</SelectItem>
                                                                <SelectItem value="subplot">ปมย่อย</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <Badge variant="secondary" className={cn("text-xs", getCat(selectedIdea.category).color)}>
                                                            {getCat(selectedIdea.category).label}
                                                        </Badge>
                                                    )}

                                                    {selectedIdea.linkedChapterId && chapterMap[selectedIdea.linkedChapterId] && (
                                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/50">
                                                            <BookOpen className="w-3 h-3 mr-1" />
                                                            {chapterMap[selectedIdea.linkedChapterId].title}
                                                        </Badge>
                                                    )}

                                                    {selectedIdea.isUsed && (
                                                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400">
                                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                                            อยู่ในฉากแล้ว
                                                        </Badge>
                                                    )}

                                                    {Array.isArray(selectedIdea.tags) && (selectedIdea.tags as string[]).map((tag, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs">#{tag}</Badge>
                                                    ))}

                                                    <span className="text-xs text-muted-foreground ml-auto">
                                                        {new Date(selectedIdea.createdAt).toLocaleDateString("th-TH", {
                                                            day: "numeric",
                                                            month: "short",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                {isEditing ? (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="h-8">
                                                            ยกเลิก
                                                        </Button>
                                                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8 gap-1.5">
                                                            {isSaving
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Save className="w-3.5 h-3.5" />}
                                                            บันทึก
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8 gap-1.5">
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            แก้ไข
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    disabled={isDeleting}
                                                                    aria-label={`ลบไอเดีย ${selectedIdea.title}`}
                                                                    className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                >
                                                                    {isDeleting
                                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                        : <Trash2 className="w-3.5 h-3.5" />}
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>ลบไอเดียนี้?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        &ldquo;{selectedIdea.title}&rdquo; จะถูกลบถาวร กู้คืนไม่ได้
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={handleDelete}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        ลบ
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
                                            {isEditing && (
                                                <Input
                                                    value={editTags}
                                                    onChange={e => setEditTags(e.target.value)}
                                                    placeholder="Tags (คั่นด้วยจุลภาค เช่น action, twist)"
                                                    className="h-7 text-xs"
                                                />
                                            )}
                                            {isEditing ? (
                                                <Textarea
                                                    value={editContent}
                                                    onChange={e => setEditContent(e.target.value)}
                                                    placeholder="เนื้อหาของไอเดีย..."
                                                    className="flex-1 min-h-[200px] resize-none text-sm leading-relaxed"
                                                />
                                            ) : (
                                                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                                                    {typeof selectedIdea.content === "string" && selectedIdea.content
                                                        ? selectedIdea.content
                                                        : <span className="text-muted-foreground italic">ยังไม่มีเนื้อหา — กด แก้ไข เพื่อเพิ่ม</span>
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                                        <Lightbulb className="w-10 h-10 mb-3 opacity-20" />
                                        <p className="text-sm">เลือกไอเดียจากรายการทางซ้ายเพื่อดูรายละเอียด</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </TabsContent>

                {/* ── Detected ideas tab ── */}
                <TabsContent value="detected" className="mt-0 focus-visible:outline-none">
                    {detectedIdeas.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 border rounded-xl border-dashed bg-card/50">
                            <div className="p-4 rounded-full bg-muted/50 mb-4">
                                <Sparkles className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold mb-2">ไม่มีไอเดียที่ตรวจพบใหม่</h3>
                            <p className="text-muted-foreground text-center max-w-sm">
                                ไอเดียใหม่จะถูกตรวจพบโดยอัตโนมัติเมื่อคุณใช้ AI สกัดเนื้อหาจากหน้าข้อมูล Lore
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <style dangerouslySetInnerHTML={{__html: `
                                @keyframes float-pattern-1 {
                                    0% { transform: translate(0px, 0px) rotate(0deg); }
                                    33% { transform: translate(5px, -5px) rotate(0.5deg); }
                                    66% { transform: translate(-3px, 5px) rotate(-0.5deg); }
                                    100% { transform: translate(0px, 0px) rotate(0deg); }
                                }
                                @keyframes float-pattern-2 {
                                    0% { transform: translate(0px, 0px) rotate(0deg); }
                                    40% { transform: translate(-5px, -6px) rotate(-0.5deg); }
                                    70% { transform: translate(6px, 3px) rotate(0.5deg); }
                                    100% { transform: translate(0px, 0px) rotate(0deg); }
                                }
                                @keyframes float-pattern-3 {
                                    0% { transform: translate(0px, 0px) rotate(0deg); }
                                    50% { transform: translate(5px, 5px) rotate(0.5deg); }
                                    100% { transform: translate(0px, 0px) rotate(0deg); }
                                }
                                @keyframes float-pattern-4 {
                                    0% { transform: translate(0px, 0px) rotate(0deg); }
                                    30% { transform: translate(-4px, 4px) rotate(-0.5deg); }
                                    70% { transform: translate(6px, -3px) rotate(0.5deg); }
                                    100% { transform: translate(0px, 0px) rotate(0deg); }
                                }
                            `}} />

                            <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between gap-4">
                                <p className="text-sm text-muted-foreground">
                                    💡 <strong>Idea Pool:</strong> คลิกชื่อไอเดียเพื่อดูรายละเอียด กด ✓ เพื่อรับเข้าคลัง หรือ ✕ เพื่อละทิ้ง
                                </p>
                                <Button
                                    size="sm"
                                    onClick={handleAcceptAll}
                                    disabled={isBulkAccepting}
                                    className="shrink-0 gap-1.5"
                                >
                                    {isBulkAccepting
                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        : <CheckCheck className="w-3.5 h-3.5" />}
                                    รับทั้งหมด ({detectedIdeas.length})
                                </Button>
                            </div>

                            <div
                                className="relative w-full overflow-hidden rounded-2xl border bg-muted/5 border-dashed"
                                style={{ height: containerHeight }}
                            >
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                    {bubbles.map((b, idx) => {
                                        if (idx < bubbles.length - 1) {
                                            const nextB = bubbles[idx + 1];
                                            return (
                                                <line
                                                    key={`chain-${idx}`}
                                                    x1={`${b.left}%`} y1={`${b.top}%`}
                                                    x2={`${nextB.left}%`} y2={`${nextB.top}%`}
                                                    className="stroke-muted-foreground/30 dark:stroke-muted-foreground/15"
                                                    strokeWidth="1.5"
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                    {bubbles.length > 3 && bubbles.map((b, idx) => {
                                        if (idx % 3 === 0 && idx + 2 < bubbles.length) {
                                            const targetB = bubbles[idx + 2];
                                            return (
                                                <line
                                                    key={`cross-${idx}`}
                                                    x1={`${b.left}%`} y1={`${b.top}%`}
                                                    x2={`${targetB.left}%`} y2={`${targetB.top}%`}
                                                    className="stroke-primary/20 dark:stroke-primary/10"
                                                    strokeWidth="1.5"
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                </svg>

                                {bubbles.map((b) => {
                                    const isCharacter = b.idea.category === "character";
                                    const isWorld = b.idea.category === "worldbuilding";
                                    return (
                                        <div
                                            key={b.idea.id}
                                            className="absolute hover:[animation-play-state:paused] transition-all duration-300 hover:scale-[1.08] z-10"
                                            style={{
                                                left: `${b.left}%`,
                                                top: `${b.top}%`,
                                                animation: `float-pattern-${b.animationPattern} ${b.duration}s ease-in-out infinite`,
                                                animationDelay: `${b.delay}s`,
                                            }}
                                        >
                                            <div
                                                className={cn(
                                                    "-translate-x-1/2 -translate-y-1/2 w-36 rounded-lg border p-2 flex flex-col items-center gap-1.5 text-center relative overflow-hidden group hover:shadow-md transition-all duration-300 bg-background/95 backdrop-blur-sm",
                                                    isCharacter
                                                        ? "border-blue-200/80 hover:border-blue-400 dark:border-blue-800/60"
                                                        : isWorld
                                                            ? "border-emerald-200/80 hover:border-emerald-400 dark:border-emerald-800/60"
                                                            : "border-purple-200/80 hover:border-purple-400 dark:border-purple-800/60"
                                                )}
                                                style={{ transform: `scale(${b.scale})` }}
                                            >
                                                <h4
                                                    className="font-semibold text-xs leading-snug line-clamp-2 px-1 select-none text-foreground/90 group-hover:text-foreground transition-colors break-words max-w-[120px] cursor-pointer"
                                                    title={b.idea.title}
                                                >
                                                    {b.idea.title}
                                                </h4>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        disabled={!!processingIds[b.idea.id]}
                                                        onClick={() => handleAccept(b.idea.id, b.idea.title)}
                                                        className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
                                                        title="รับไอเดียนี้"
                                                    >
                                                        {processingIds[b.idea.id] === "accept"
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <Check className="w-3 h-3 text-green-600 dark:text-green-400" />}
                                                    </button>
                                                    <button
                                                        disabled={!!processingIds[b.idea.id]}
                                                        onClick={() => handleReject(b.idea.id, b.idea.title)}
                                                        className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
                                                        title="ปฏิเสธไอเดียนี้"
                                                    >
                                                        {processingIds[b.idea.id] === "reject"
                                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                                            : <X className="w-3 h-3 text-red-500 dark:text-red-400" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

/**
 * แยกสองกรณีที่หน้าตาเหมือนกันแต่ความหมายคนละเรื่อง:
 * "ยังไม่เคยมีไอเดีย" (เพิ่งเริ่ม) vs "ใช้ไปหมดแล้ว" (ทำงานได้ดีจนของหมด)
 * กรณีหลังเป็นข่าวดี ไม่ควรขึ้นข้อความชวนหดหู่แบบเดียวกัน
 */
function EmptyState({ novelId, usedCount }: { novelId: string; usedCount: number }) {
    const usedEverything = usedCount > 0;

    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 mb-4">
                <Sparkles className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
                {usedEverything ? "ใช้ไอเดียไปหมดแล้ว" : "ยังไม่มีไอเดีย"}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
                {usedEverything
                    ? `ไอเดียทั้ง ${usedCount} อันถูกวางลงในฉากบนหน้า Plot แล้ว — ถึงเวลาไปเก็บของใหม่`
                    : "ที่นี่คือกองวัตถุดิบที่รอถูกหยิบไปใช้ เก็บไอเดียที่นึกออกระหว่างวันไว้ก่อน แล้วค่อยเลือกตอนวางพล็อต"}
            </p>
            <CreateIdeaDialog novelId={novelId} />
            <p className="text-xs text-muted-foreground mt-4">
                หรือส่งเข้ามาทางบอท Discord แล้วกด &ldquo;Sync Discord&rdquo; ด้านบน
            </p>
        </div>
    );
}

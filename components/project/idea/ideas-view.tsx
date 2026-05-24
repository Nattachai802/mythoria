"use client";

import { useState, useMemo, memo } from "react";
import { Idea } from "@/db/schema";
import { IdeaCard } from "./idea-card";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Search,
    LayoutGrid,
    List,
    Lightbulb,
    BookOpen,
    Calendar,
    Tag,
    ChevronRight,
    Sparkles,
    Check,
    X,
    Loader2,
    Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditIdeaDialog } from "./edit-idea-dialog";
import { useRouter } from "next/navigation";
import { updateIdea, deleteIdea, deleteMultipleIdeas } from "@/server/idea";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";


interface IdeasViewProps {
    ideas: Idea[];
    novelId: string;
    chapters?: { id: string; title: string }[];
}

// Memoized IdeaCard for better performance
const MemoizedIdeaCard = memo(IdeaCard);

export function IdeasView({ ideas, novelId, chapters = [] }: IdeasViewProps) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [processingIds, setProcessingIds] = useState<Record<string, 'accept' | 'reject' | null>>({});

    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIdeaIds, setSelectedIdeaIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmDeleteDialogOpen, setConfirmDeleteDialogOpen] = useState(false);

    const handleToggleSelect = (ideaId: string) => {
        setSelectedIdeaIds(prev => {
            const next = new Set(prev);
            if (next.has(ideaId)) {
                next.delete(ideaId);
            } else {
                next.add(ideaId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIdeaIds.size === filteredIdeas.length) {
            setSelectedIdeaIds(new Set());
        } else {
            setSelectedIdeaIds(new Set(filteredIdeas.map(idea => idea.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIdeaIds.size === 0) return;
        setIsDeleting(true);
        try {
            const res = await deleteMultipleIdeas(Array.from(selectedIdeaIds), novelId);
            if (res.success) {
                toast.success(`ลบ ${res.count} ไอเดียที่เลือกเรียบร้อยแล้ว`);
                setSelectedIdeaIds(new Set());
                setIsSelectMode(false);
                router.refresh();
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาดในการลบไอเดีย");
            }
        } catch (e) {
            toast.error("เกิดข้อผิดพลาดในการลบไอเดีย");
        } finally {
            setIsDeleting(false);
            setConfirmDeleteDialogOpen(false);
        }
    };


    const normalIdeas = useMemo(() => {
        return ideas.filter((idea) => !idea.isDetected);
    }, [ideas]);

    const detectedIdeas = useMemo(() => {
        return ideas.filter((idea) => idea.isDetected);
    }, [ideas]);

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
            
            const left = Math.max(5, Math.min(85, leftBase + jitterLeft));
            const top = Math.max(10, Math.min(80, topBase + jitterTop));
            
            const duration = 10 + (index % 5) * 2; // 10s to 18s
            const delay = -(index * 1.5);
            const animationPattern = (index % 4) + 1; // 1 to 4
            const scale = 0.9 + (index % 3) * 0.05;

            return {
                idea,
                left,
                top,
                duration,
                delay,
                animationPattern,
                scale
            };
        });
    }, [detectedIdeas]);

    const containerHeight = useMemo(() => {
        const rows = Math.ceil(detectedIdeas.length / 4);
        return `${Math.max(400, rows * 160 + 120)}px`;
    }, [detectedIdeas]);

    const handleAccept = async (ideaId: string, title: string) => {
        setProcessingIds(prev => ({ ...prev, [ideaId]: 'accept' }));
        try {
            const res = await updateIdea(ideaId, { isDetected: false });
            if (res.success) {
                toast.success(`เพิ่ม "${title}" เข้าคลังไอเดียเรียบร้อยแล้ว`);
                router.refresh();
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาด");
            }
        } catch (e) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setProcessingIds(prev => ({ ...prev, [ideaId]: null }));
        }
    };

    const handleReject = async (ideaId: string, title: string) => {
        setProcessingIds(prev => ({ ...prev, [ideaId]: 'reject' }));
        try {
            const res = await deleteIdea(ideaId);
            if (res.success) {
                toast.success(`ละทิ้งไอเดีย "${title}" เรียบร้อยแล้ว`);
                router.refresh();
            } else {
                toast.error(res.error || "เกิดข้อผิดพลาด");
            }
        } catch (e) {
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setProcessingIds(prev => ({ ...prev, [ideaId]: null }));
        }
    };

    // Memoized filtered ideas - show all ideas (used ones will be grayed out)
    const filteredIdeas = useMemo(() => {
        // Filter by search query only (no longer hiding used ideas)
        return normalIdeas.filter((idea) => {
            const query = searchQuery.toLowerCase().trim();
            if (!query) return true;

            if (idea.title.toLowerCase().includes(query)) return true;

            if (Array.isArray(idea.tags)) {
                if ((idea.tags as string[]).some(tag => tag.toLowerCase().includes(query))) {
                    return true;
                }
            }

            if (typeof idea.content === 'string' && idea.content.toLowerCase().includes(query)) {
                return true;
            }

            return false;
        });
    }, [normalIdeas, searchQuery]);

    // Get chapter info for idea
    const getChapterInfo = (idea: Idea) => {
        if (!idea.linkedChapterId) return null;
        return chapters.find(ch => ch.id === idea.linkedChapterId);
    };

    // Category colors
    const getCategoryColor = (category: string | null) => {
        switch (category) {
            case "plot": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
            case "character": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
            case "worldbuilding": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "subplot": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
            default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
        }
    };

    const getCategoryLabel = (category: string | null) => {
        switch (category) {
            case "plot": return "Plot";
            case "character": return "Character";
            case "worldbuilding": return "World";
            case "subplot": return "Subplot";
            default: return "General";
        }
    };

    return (
        <div className="space-y-6">
            {/* Search and Selection Bar */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ค้นหาไอเดีย..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {searchQuery && (
                        <Badge variant="secondary" className="shrink-0">
                            พบ {filteredIdeas.length} จาก {normalIdeas.length}
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isSelectMode ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                            >
                                {selectedIdeaIds.size === filteredIdeas.length ? "ยกเลิกการเลือกทั้งหมด" : "เลือกทั้งหมด"}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={selectedIdeaIds.size === 0 || isDeleting}
                                onClick={() => setConfirmDeleteDialogOpen(true)}
                                className="flex items-center gap-1.5"
                            >
                                {isDeleting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                ลบที่เลือก ({selectedIdeaIds.size})
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsSelectMode(false);
                                    setSelectedIdeaIds(new Set());
                                }}
                            >
                                ยกเลิก
                            </Button>
                        </>
                    ) : (
                        normalIdeas.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsSelectMode(true)}
                                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                            >
                                <Check className="w-4 h-4" />
                                เลือกจัดการไอเดีย
                            </Button>
                        )
                    )}
                </div>
            </div>

            {/* Tabs Views */}
            <Tabs defaultValue="grid" className="w-full">
                <TabsList className="mb-4 bg-muted/50 p-1 flex w-fit gap-1">
                    <TabsTrigger value="grid" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <LayoutGrid className="w-4 h-4" />
                        <span className="hidden sm:inline">Grid ({normalIdeas.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <List className="w-4 h-4" />
                        <span className="hidden sm:inline">List</span>
                    </TabsTrigger>
                    <TabsTrigger value="detected" className="flex items-center gap-2 data-[state=active]:bg-background relative">
                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                        <span>Idea Detect ({detectedIdeas.length})</span>
                        {detectedIdeas.length > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* Grid View */}
                <TabsContent value="grid" className="mt-0">
                    {filteredIdeas.length === 0 ? (
                        <EmptyState searchQuery={searchQuery} novelId={novelId} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredIdeas.map((idea) => {
                                const isSelected = selectedIdeaIds.has(idea.id);
                                return (
                                    <MemoizedIdeaCard
                                        key={idea.id}
                                        idea={idea}
                                        novelId={novelId}
                                        chapterInfo={getChapterInfo(idea)}
                                        isSelectMode={isSelectMode}
                                        isSelected={isSelected}
                                        onToggleSelect={handleToggleSelect}
                                    />
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* List View */}
                <TabsContent value="list" className="mt-0">
                    {filteredIdeas.length === 0 ? (
                        <EmptyState searchQuery={searchQuery} novelId={novelId} />
                    ) : (
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                                        {isSelectMode && <TableHead className="w-[50px]"></TableHead>}
                                        <TableHead className="w-[300px]">Title</TableHead>
                                        <TableHead className="w-[100px]">Category</TableHead>
                                        <TableHead className="w-[150px]">Tags</TableHead>
                                        <TableHead className="w-[150px]">Chapter</TableHead>
                                        <TableHead className="w-[100px]">Date</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredIdeas.map((idea) => {
                                        const chapterInfo = getChapterInfo(idea);
                                        const isSelected = selectedIdeaIds.has(idea.id);
                                        return (
                                            <TableRow
                                                key={idea.id}
                                                className={cn(
                                                    "cursor-pointer hover:bg-muted/50 transition-colors",
                                                    isSelected && "bg-primary/5 hover:bg-primary/10"
                                                )}
                                                onClick={() => {
                                                    if (isSelectMode) {
                                                        handleToggleSelect(idea.id);
                                                    } else {
                                                        setSelectedIdea(idea);
                                                        setEditDialogOpen(true);
                                                    }
                                                }}
                                            >
                                                {isSelectMode && (
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={() => handleToggleSelect(idea.id)}
                                                        />
                                                    </TableCell>
                                                )}
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                                                            <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-medium truncate">{idea.title}</p>
                                                            {idea.content && (
                                                                <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                                                                    {typeof idea.content === 'string'
                                                                        ? idea.content.substring(0, 50)
                                                                        : ''}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={cn("text-xs", getCategoryColor(idea.category))}
                                                    >
                                                        {getCategoryLabel(idea.category)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1 flex-wrap">
                                                        {Array.isArray(idea.tags) && (idea.tags as string[]).slice(0, 2).map((tag, i) => (
                                                            <Badge key={i} variant="outline" className="text-xs">
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                        {Array.isArray(idea.tags) && (idea.tags as string[]).length > 2 && (
                                                            <Badge variant="outline" className="text-xs">
                                                                +{(idea.tags as string[]).length - 2}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {chapterInfo ? (
                                                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                            <BookOpen className="w-3 h-3" />
                                                            <span className="truncate max-w-[100px]">{chapterInfo.title}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Calendar className="w-3 h-3" />
                                                        {new Date(idea.createdAt).toLocaleDateString('th-TH', {
                                                            day: 'numeric',
                                                            month: 'short'
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </TabsContent>

                {/* Detected Ideas View */}
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

                            <div className="p-4 rounded-xl border bg-muted/20">
                                <p className="text-sm text-muted-foreground">
                                    💡 <strong>Idea Pool:</strong> คลังสะสมไอเดียที่ตรวจพบจากการเขียนเนื้อหา Lore คุณสามารถคลิกที่ฟองสบู่ไอเดียใดๆ เพื่อเข้าไปดูรายละเอียดหรือแก้ไขข้อมูลได้ทันที
                                </p>
                            </div>

                            {/* Floating Idea Pool Field */}
                            <div 
                                className="relative w-full overflow-hidden rounded-2xl border bg-muted/5 border-dashed"
                                style={{ height: containerHeight }}
                            >
                                {/* Connection Lines SVG */}
                                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                    {bubbles.map((b, idx) => {
                                        if (idx < bubbles.length - 1) {
                                            const nextB = bubbles[idx + 1];
                                            return (
                                                <line
                                                    key={`chain-${idx}`}
                                                    x1={`${b.left}%`}
                                                    y1={`${b.top}%`}
                                                    x2={`${nextB.left}%`}
                                                    y2={`${nextB.top}%`}
                                                    className="stroke-muted-foreground/30 dark:stroke-muted-foreground/15"
                                                    strokeWidth="1.5"
                                                />
                                            );
                                        }
                                        return null;
                                    })}
                                    
                                    {/* Add a few cross-connections for more network-like structure */}
                                    {bubbles.length > 3 && bubbles.map((b, idx) => {
                                        if (idx % 3 === 0 && idx + 2 < bubbles.length) {
                                            const targetB = bubbles[idx + 2];
                                            return (
                                                <line
                                                    key={`cross-${idx}`}
                                                    x1={`${b.left}%`}
                                                    y1={`${b.top}%`}
                                                    x2={`${targetB.left}%`}
                                                    y2={`${targetB.top}%`}
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
                                                onClick={() => {
                                                    setSelectedIdea(b.idea);
                                                    setEditDialogOpen(true);
                                                }}
                                                className={cn(
                                                    "-translate-x-1/2 -translate-y-1/2 w-32 h-11 rounded-lg border p-2 flex items-center justify-center text-center relative overflow-hidden group hover:shadow-md transition-all duration-300 cursor-pointer bg-background/95 backdrop-blur-sm",
                                                    isCharacter
                                                        ? "border-blue-200/80 hover:border-blue-400 text-blue-900 dark:border-blue-800/60 dark:text-blue-200"
                                                        : isWorld
                                                            ? "border-emerald-200/80 hover:border-emerald-400 text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-200"
                                                            : "border-purple-200/80 hover:border-purple-400 text-purple-900 dark:border-purple-800/60 dark:text-purple-200"
                                                )}
                                                style={{
                                                    transform: `scale(${b.scale})`
                                                }}
                                            >
                                                {/* Idea Title */}
                                                <h4 className="font-semibold text-xs leading-snug line-clamp-2 px-1 select-none text-foreground/90 group-hover:text-foreground transition-colors break-words max-w-[110px]">
                                                    {b.idea.title}
                                                </h4>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Edit Dialog */}
            {selectedIdea && (
                <EditIdeaDialog
                    idea={selectedIdea}
                    open={editDialogOpen}
                    onOpenChange={(open) => {
                        setEditDialogOpen(open);
                        if (!open) setSelectedIdea(null);
                    }}
                />
            )}

            {/* Confirmation Dialog for Batch Deletion */}
            <AlertDialog open={confirmDeleteDialogOpen} onOpenChange={setConfirmDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>คุณแน่ใจหรือไม่ว่าต้องการลบไอเดียที่เลือก?</AlertDialogTitle>
                        <AlertDialogDescription>
                            การดำเนินการนี้จะลบไอเดียจำนวน {selectedIdeaIds.size} รายการอย่างถาวรและไม่สามารถกู้คืนได้
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteSelected();
                            }}
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                        >
                            ยืนยันการลบ
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// Helper Tag Chip component for Detected Ideas
function IdeaTagChip({
    idea,
    onAccept,
    onReject,
    isProcessing,
    isWorld
}: {
    idea: Idea;
    onAccept: (id: string, title: string) => void;
    onReject: (id: string, title: string) => void;
    isProcessing: 'accept' | 'reject' | null | undefined;
    isWorld?: boolean;
}) {
    const isAccepting = isProcessing === 'accept';
    const isRejecting = isProcessing === 'reject';
    const isDisabled = !!isProcessing;

    return (
        <div
            className={cn(
                "inline-flex items-center gap-1.5 pl-3.5 pr-1 py-1 rounded-full border text-sm font-medium shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.02]",
                isWorld
                    ? "bg-emerald-50/50 text-emerald-800 border-emerald-200 hover:border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50"
                    : "bg-blue-50/50 text-blue-800 border-blue-200 hover:border-blue-300 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/50"
            )}
        >
            <span className="truncate max-w-[180px]" title={idea.title}>
                {idea.title}
            </span>
            <div className="flex items-center gap-0.5 ml-1">
                <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDisabled}
                    onClick={() => onAccept(idea.id, idea.title)}
                    className={cn(
                        "h-6 w-6 rounded-full p-0 transition-colors cursor-pointer",
                        isWorld
                            ? "hover:bg-emerald-200/50 hover:text-emerald-900 dark:hover:bg-emerald-900/40"
                            : "hover:bg-blue-200/50 hover:text-blue-900 dark:hover:bg-blue-900/40"
                    )}
                >
                    {isAccepting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    )}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    disabled={isDisabled}
                    onClick={() => onReject(idea.id, idea.title)}
                    className="h-6 w-6 rounded-full p-0 transition-colors cursor-pointer hover:bg-red-100 hover:text-red-900 dark:hover:bg-red-950/40"
                >
                    {isRejecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <X className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                    )}
                </Button>
            </div>
        </div>
    );
}

// Empty state component
function EmptyState({ searchQuery, novelId }: { searchQuery: string; novelId: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="p-4 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 mb-4">
                <Sparkles className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "ไม่พบไอเดียที่ตรงกัน" : "ยังไม่มีไอเดีย"}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
                {searchQuery
                    ? `ไม่พบไอเดียที่ตรงกับ "${searchQuery}"`
                    : "เริ่มต้นสร้างไอเดียแรกของคุณเพื่อจัดเก็บแรงบันดาลใจ"}
            </p>
            {!searchQuery && <CreateIdeaDialog novelId={novelId} />}
        </div>
    );
}

"use client";

import { useState, useMemo, memo } from "react";
import { Idea } from "@/db/schema";
import { IdeaCard } from "./idea-card";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EditIdeaDialog } from "./edit-idea-dialog";

interface IdeasViewProps {
    ideas: Idea[];
    novelId: string;
    chapters?: { id: string; title: string }[];
}

// Memoized IdeaCard for better performance
const MemoizedIdeaCard = memo(IdeaCard);

export function IdeasView({ ideas, novelId, chapters = [] }: IdeasViewProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    // Memoized filtered ideas
    const filteredIdeas = useMemo(() => {
        return ideas.filter((idea) => {
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
    }, [ideas, searchQuery]);

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
            {/* Search Bar */}
            <div className="flex items-center gap-4">
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
                        พบ {filteredIdeas.length} จาก {ideas.length}
                    </Badge>
                )}
            </div>

            {/* Tabs Views */}
            <Tabs defaultValue="grid" className="w-full">
                <TabsList className="mb-4 bg-muted/50 p-1">
                    <TabsTrigger value="grid" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <LayoutGrid className="w-4 h-4" />
                        <span className="hidden sm:inline">Grid</span>
                    </TabsTrigger>
                    <TabsTrigger value="list" className="flex items-center gap-2 data-[state=active]:bg-background">
                        <List className="w-4 h-4" />
                        <span className="hidden sm:inline">List</span>
                    </TabsTrigger>
                </TabsList>

                {/* Grid View */}
                <TabsContent value="grid" className="mt-0">
                    {filteredIdeas.length === 0 ? (
                        <EmptyState searchQuery={searchQuery} novelId={novelId} />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredIdeas.map((idea) => (
                                <MemoizedIdeaCard
                                    key={idea.id}
                                    idea={idea}
                                    novelId={novelId}
                                    chapterInfo={getChapterInfo(idea)}
                                />
                            ))}
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
                                        return (
                                            <TableRow
                                                key={idea.id}
                                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                                onClick={() => {
                                                    setSelectedIdea(idea);
                                                    setEditDialogOpen(true);
                                                }}
                                            >
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

"use client";

import { useState } from "react";
import { Idea } from "@/db/schema";
import { IdeaCard } from "./idea-card";
import { CreateIdeaDialog } from "./create-idea-dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface IdeasViewProps {
    ideas: Idea[];
    novelId: string;
    chapters?: { id: string; title: string }[];
}

export function IdeasView({ ideas, novelId, chapters = [] }: IdeasViewProps) {
    const [searchQuery, setSearchQuery] = useState("");

    // Filter ideas by search query
    const filteredIdeas = ideas.filter((idea) => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        // Search in title
        if (idea.title.toLowerCase().includes(query)) return true;

        // Search in tags
        if (Array.isArray(idea.tags)) {
            if ((idea.tags as string[]).some(tag => tag.toLowerCase().includes(query))) {
                return true;
            }
        }

        // Search in content (basic search)
        if (typeof idea.content === 'string' && idea.content.toLowerCase().includes(query)) {
            return true;
        }

        return false;
    });

    // Get chapter info for idea
    const getChapterInfo = (idea: Idea) => {
        if (!idea.linkedChapterId) return null;
        return chapters.find(ch => ch.id === idea.linkedChapterId);
    };

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="ค้นหาไอเดีย..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Results count */}
            {searchQuery && (
                <p className="text-sm text-muted-foreground">
                    พบ {filteredIdeas.length} ไอเดีย
                    {filteredIdeas.length !== ideas.length && ` (จาก ${ideas.length})`}
                </p>
            )}

            {/* Ideas Grid */}
            {filteredIdeas.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                        {searchQuery
                            ? `ไม่พบไอเดียที่ตรงกับ "${searchQuery}"`
                            : "ยังไม่มีไอเดีย สร้างไอเดียแรกเลย!"}
                    </p>
                    {!searchQuery && <CreateIdeaDialog novelId={novelId} />}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredIdeas.map((idea) => (
                        <IdeaCard
                            key={idea.id}
                            idea={idea}
                            novelId={novelId}
                            chapterInfo={getChapterInfo(idea)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

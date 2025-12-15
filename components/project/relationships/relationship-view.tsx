"use client";

import { useState, useEffect } from "react";
import { RelationshipMatrix } from "./relationship-matrix";
import { RelationshipBoard } from "./relationship-board";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Grid3X3, Share2 } from "lucide-react";
import { getChapters } from "@/server/chapter";
import { getCharactersInChapter } from "@/server/chapter-characters";

interface RelationshipViewProps {
    novelId: string;
    initialCharacters: any[];
    initialRelationships: any[];
    initialFactions: any[];
}

export function RelationshipView({
    novelId,
    initialCharacters,
    initialRelationships,
    initialFactions,
}: RelationshipViewProps) {
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>("all");
    const [chapterCharacterIds, setChapterCharacterIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    // Fetch chapters
    useEffect(() => {
        async function fetchChapters() {
            const result = await getChapters(novelId);
            if (result.success && result.chapters) {
                setChapters(result.chapters);
            }
        }
        fetchChapters();
    }, [novelId]);

    // Fetch characters in selected chapter
    useEffect(() => {
        async function fetchChapterCharacters() {
            if (selectedChapter === "all") {
                setChapterCharacterIds(new Set());
                return;
            }

            setIsLoading(true);
            const result = await getCharactersInChapter(selectedChapter);
            if (result.success && result.data) {
                const charIds = new Set(result.data.map((cc: any) => cc.character.id));
                setChapterCharacterIds(charIds);
            }
            setIsLoading(false);
        }

        fetchChapterCharacters();
    }, [selectedChapter]);

    // Filter characters and relationships
    const filteredCharacters = selectedChapter === "all"
        ? initialCharacters
        : initialCharacters.filter(char => chapterCharacterIds.has(char.id));

    const filteredRelationships = selectedChapter === "all"
        ? initialRelationships
        : initialRelationships.filter(rel =>
            chapterCharacterIds.has(rel.sourceCharacterId) &&
            chapterCharacterIds.has(rel.targetCharacterId)
        );

    return (
        <>
            {/* Chapter Filter */}
            {chapters.length > 0 && (
                <div className="mb-4 flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
                    <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select chapter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Chapters</SelectItem>
                            {chapters.map((chapter) => (
                                <SelectItem key={chapter.id} value={chapter.id}>
                                    Chapter {chapter.orderIndex}: {chapter.title}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selectedChapter !== "all" && (
                        <span className="text-sm text-muted-foreground">
                            ({filteredCharacters.length} character{filteredCharacters.length !== 1 ? 's' : ''})
                        </span>
                    )}
                </div>
            )}

            {isLoading ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            ) : filteredCharacters.length < 2 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">
                        {selectedChapter === "all"
                            ? "Need at least 2 characters to view relationships."
                            : "Need at least 2 characters in this chapter to view relationships."}
                    </p>
                </div>
            ) : (
                <Tabs defaultValue="graph" className="w-full">
                    <div className="flex items-center justify-between mb-4">
                        <TabsList>
                            <TabsTrigger value="graph" className="flex items-center gap-2">
                                <Share2 className="w-4 h-4" />
                                Graph View
                            </TabsTrigger>
                            <TabsTrigger value="matrix" className="flex items-center gap-2">
                                <Grid3X3 className="w-4 h-4" />
                                Matrix View
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="graph" className="mt-0">
                        <RelationshipBoard
                            characters={filteredCharacters}
                            relationships={filteredRelationships}
                            factions={initialFactions}
                            novelId={novelId}
                        />
                    </TabsContent>

                    <TabsContent value="matrix" className="mt-0">
                        <RelationshipMatrix
                            characters={filteredCharacters}
                            relationships={filteredRelationships}
                        />
                    </TabsContent>
                </Tabs>
            )}
        </>
    );
}

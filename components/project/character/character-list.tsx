"use client";

import { useState, useEffect } from "react";
import { CharacterCard } from "./character-card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getChapters } from "@/server/chapter";
import { getCharactersInChapter } from "@/server/chapter-characters";

interface CharacterListProps {
    novelId: string;
    initialCharacters: any[];
}

export function CharacterList({ novelId, initialCharacters }: CharacterListProps) {
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>("all");
    const [chapterCharacterIds, setChapterCharacterIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);

    // Fetch chapters on mount
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

    // Filter characters based on selection
    const filteredCharacters = selectedChapter === "all"
        ? initialCharacters
        : initialCharacters.filter(char => chapterCharacterIds.has(char.id));

    return (
        <>
            {/* Chapter Filter */}
            {chapters.length > 0 && (
                <div className="mb-6 flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
                    <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Select chapter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Characters</SelectItem>
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

            {/* Character Grid */}
            {isLoading ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            ) : filteredCharacters.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">
                        {selectedChapter === "all"
                            ? "No characters yet."
                            : "No characters appear in this chapter."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredCharacters.map((character) => (
                        <CharacterCard
                            key={character.id}
                            character={character}
                            novelId={novelId}
                        />
                    ))}
                </div>
            )}
        </>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { getChapters } from "@/server/chapter";
import { getCharactersInChapter } from "@/server/chapter-characters";
import { User } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface LocationCharactersProps {
    locationId: string;
    novelId: string;
}

export function LocationCharacters({ locationId, novelId }: LocationCharactersProps) {
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>("all");
    const [charactersInChapter, setCharactersInChapter] = useState<any[]>([]);
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
                setCharactersInChapter([]);
                return;
            }

            setIsLoading(true);
            const result = await getCharactersInChapter(selectedChapter);
            if (result.success && result.data) {
                setCharactersInChapter(result.data);
            }
            setIsLoading(false);
        }

        fetchChapterCharacters();
    }, [selectedChapter]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>Characters Present</CardTitle>
                    {chapters.length > 0 && (
                        <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select chapter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Select a chapter</SelectItem>
                                {chapters.map((chapter) => (
                                    <SelectItem key={chapter.id} value={chapter.id}>
                                        Ch. {chapter.orderIndex}: {chapter.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {chapters.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No chapters created yet.
                    </p>
                ) : selectedChapter === "all" ? (
                    <p className="text-muted-foreground text-sm">
                        Select a chapter to see which characters are present in this location.
                    </p>
                ) : isLoading ? (
                    <p className="text-muted-foreground text-sm">Loading...</p>
                ) : charactersInChapter.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                        No characters appear in this chapter.
                    </p>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">
                                {charactersInChapter.length} character{charactersInChapter.length !== 1 ? 's' : ''}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                in this chapter
                            </span>
                        </div>
                        <div className="grid gap-3">
                            {charactersInChapter.map((cc) => (
                                <Link
                                    key={cc.character.id}
                                    href={`/dashboard/project/${novelId}/characters/${cc.character.id}`}
                                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                                >
                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                                        {cc.character.image ? (
                                            <img
                                                src={cc.character.image}
                                                alt={cc.character.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">{cc.character.name}</p>
                                        {cc.role && (
                                            <p className="text-xs text-muted-foreground truncate">
                                                Role: {cc.role}
                                            </p>
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

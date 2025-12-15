"use client";

import { useState, useEffect, useMemo } from "react";
import { Character, Chapter } from "@/db/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, X, Users } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addCharacterToChapter, removeCharacterFromChapter, getCharactersInChapter } from "@/server/chapter-characters";
import { getCharactersByNovelId } from "@/server/character";
import { getAllFactionsWithMembers } from "@/server/factions";
import { cn } from "@/lib/utils";

interface CastDeckProps {
    chapterId: string;
    novelId: string;
    chapterOrderIndex: number;
}

interface CastMember {
    id: string; // chapter_character id
    character: Character;
    role?: string;
    notes?: string;
}

export function CastDeck({ chapterId, novelId, chapterOrderIndex }: CastDeckProps) {
    const [cast, setCast] = useState<CastMember[]>([]);
    const [allCharacters, setAllCharacters] = useState<Character[]>([]);
    const [factions, setFactions] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = async () => {
        const [castResult, charsResult, factionsResult] = await Promise.all([
            getCharactersInChapter(chapterId),
            getCharactersByNovelId(novelId),
            getAllFactionsWithMembers(novelId)
        ]);

        if (castResult.success && castResult.data) {
            setCast(castResult.data as CastMember[]);
        }
        if (charsResult.success && charsResult.data) {
            setAllCharacters(charsResult.data);
        }
        if (factionsResult.success && factionsResult.data) {
            setFactions(factionsResult.data);
        }
    };

    useEffect(() => {
        fetchData();
    }, [chapterId, novelId]);

    const handleAddCharacter = async (characterId: string) => {
        const result = await addCharacterToChapter({
            chapterId,
            characterId,
            novelId,
            role: "Cameo" // Default role
        });

        if (result.success) {
            toast.success("Character added to cast");
            fetchData();
            setIsOpen(false);
        } else {
            toast.error(result.error);
        }
    };

    const handleRemoveCharacter = async (id: string) => {
        const result = await removeCharacterFromChapter(id, novelId, chapterId);
        if (result.success) {
            toast.success("Character removed from cast");
            fetchData();
        } else {
            toast.error(result.error);
        }
    };

    // Helper to determine faction color for a character in this chapter
    const getCharacterFactionColor = (characterId: string) => {
        // Find all factions this character belongs to
        // Then filter by timeline (start/end chapter)

        // Note: This is a simplified logic. 
        // In a real app, we need to compare chapter orderIndex. 
        // For now, let's assume if they are in a faction, they are in it.
        // Or we can try to use the relation data if available.

        for (const faction of factions) {
            const membership = faction.members.find((m: any) => m.characterId === characterId);
            if (membership) {
                // Check timeline constraints if they exist
                // Ideally we need to fetch chapter details for start/end chapters to compare orderIndex
                // For now, let's simply return the first matching faction color
                return faction.color || "#ccc";
            }
        }
        return "transparent";
    };

    const availableCharacters = allCharacters.filter(
        c => !cast.some(member => member.character.id === c.id)
    );

    return (
        <div className="w-full border-b border-white/10 bg-black/20 backdrop-blur-md">
            <div className="container flex h-14 items-center gap-4 px-6 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cast Deck</span>
                    <Badge variant="outline" className="rounded-md border-primary/30 bg-primary/10 px-1.5 py-0 text-[10px] text-primary font-mono">
                        {cast.length}
                    </Badge>
                </div>

                <div className="flex items-center -space-x-3 hover:space-x-1 transition-all duration-300">
                    {cast.map((member) => (
                        <TooltipProvider key={member.id}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="group relative z-0 hover:z-10 transition-all duration-300 hover:scale-110">
                                        <div
                                            className="h-9 w-9 rounded-full ring-2 ring-background transition-all shadow-lg"
                                            style={{
                                                borderColor: getCharacterFactionColor(member.character.id),
                                                boxShadow: `0 0 10px -2px ${getCharacterFactionColor(member.character.id)}`
                                            }}
                                        >
                                            <Avatar className="h-full w-full border-2 border-transparent">
                                                <AvatarImage src={member.character.image || undefined} className="object-cover" />
                                                <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground font-bold">
                                                    {member.character.name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        {/* Quick Remove Button - appear on hover */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveCharacter(member.id);
                                            }}
                                            className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-white shadow-md hover:bg-red-600 transition-colors"
                                        >
                                            <X className="h-2.5 w-2.5" />
                                        </button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="border-border/50 bg-popover/90 backdrop-blur-md">
                                    <div className="flex flex-col gap-1">
                                        <p className="font-bold text-sm text-primary">{member.character.name}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getCharacterFactionColor(member.character.id) }} />
                                            <span>{member.role || "Character"}</span>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ))}

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full bg-muted/20 hover:bg-primary/20 text-muted-foreground hover:text-primary transition-all ml-4 border border-dashed border-white/20 hover:border-primary/50"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="p-0 gap-0 overflow-hidden border-border/50 bg-background/80 backdrop-blur-xl sm:max-w-[400px]">
                            <DialogHeader className="px-4 py-3 border-b border-border/50 bg-muted/20">
                                <DialogTitle className="text-sm font-medium">Add to Cast</DialogTitle>
                            </DialogHeader>
                            <Command className="bg-transparent">
                                <CommandInput placeholder="Search characters..." className="border-none focus:ring-0" />
                                <CommandList className="p-2">
                                    <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                                        No characters found.
                                    </CommandEmpty>
                                    <CommandGroup>
                                        {availableCharacters.map((char) => (
                                            <CommandItem
                                                key={char.id}
                                                onSelect={() => handleAddCharacter(char.id)}
                                                className="flex items-center gap-3 rounded-md px-2 py-2 aria-selected:bg-primary/10 aria-selected:text-primary cursor-pointer"
                                            >
                                                <Avatar className="h-8 w-8 border border-white/10">
                                                    <AvatarImage src={char.image || undefined} />
                                                    <AvatarFallback className="text-xs">{char.name[0]}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">{char.name}</span>
                                                    <span className="text-[10px] text-muted-foreground line-clamp-1">{char.role || "No role"}</span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
        </div>
    );
}

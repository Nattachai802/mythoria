"use client"

import { useState, useEffect, useTransition, useMemo, useCallback } from "react"
import { Plus, X, Users, ChevronDown, ChevronUp, Sparkles, Pin, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { getCharactersByNovelId } from "@/server/character"
import { getNoteCharacters, addCharacterToNote, removeCharacterFromNote } from "@/server/note-character"
import { cn } from "@/lib/utils"
import { scanForCharacters, SuggestedCharacter, debounce } from "@/lib/entity-scanner"

interface NoteCastDeckProps {
    noteId: string
    novelId: string
    linkedChapterId?: string | null
    content?: string // HTML content from editor for scanning
}

interface CharacterOption {
    id: string
    name: string
    role: string
    image?: string | null
    aliases?: unknown
}

interface NoteCharacterItem {
    id: string
    characterId: string
    role?: string | null
    character: CharacterOption
}

export function NoteCastDeck({ noteId, novelId, linkedChapterId, content = "" }: NoteCastDeckProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isExpanded, setIsExpanded] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [allCharacters, setAllCharacters] = useState<CharacterOption[]>([])
    const [noteCharacters, setNoteCharacters] = useState<NoteCharacterItem[]>([])
    const [loading, setLoading] = useState(true)
    const [suggestedCharacters, setSuggestedCharacters] = useState<SuggestedCharacter[]>([])
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

    // Load characters on mount
    useEffect(() => {
        async function loadData() {
            setLoading(true)
            try {
                const [allCharsResult, noteCharsResult] = await Promise.all([
                    getCharactersByNovelId(novelId),
                    getNoteCharacters(noteId)
                ])

                if (allCharsResult.success && allCharsResult.data) {
                    setAllCharacters(allCharsResult.data as CharacterOption[])
                }

                if (noteCharsResult.success && noteCharsResult.characters) {
                    setNoteCharacters(noteCharsResult.characters as NoteCharacterItem[])
                }
            } catch (error) {
                console.error("Failed to load characters:", error)
            } finally {
                setLoading(false)
            }
        }

        loadData()
    }, [novelId, noteId])

    // Scan content for character mentions (debounced)
    const performScan = useCallback(() => {
        if (!content || allCharacters.length === 0) {
            setSuggestedCharacters([])
            return
        }

        const confirmedIds = noteCharacters.map(nc => nc.characterId)
        const suggestions = scanForCharacters(
            content,
            allCharacters,
            confirmedIds,
            0.7 // Confidence threshold
        )

        // Filter out dismissed characters
        const filteredSuggestions = suggestions.filter(s => !dismissedIds.has(s.characterId))
        setSuggestedCharacters(filteredSuggestions)
    }, [content, allCharacters, noteCharacters, dismissedIds])

    // Debounced scan
    const debouncedScan = useMemo(
        () => debounce(performScan, 500),
        [performScan]
    )

    // Trigger scan when content changes
    useEffect(() => {
        debouncedScan()
    }, [content, debouncedScan])

    // Characters not yet added to this note
    const availableCharacters = allCharacters.filter(
        char => !noteCharacters.some(nc => nc.characterId === char.id)
    )

    async function handleAddCharacter(characterId: string) {
        startTransition(async () => {
            const result = await addCharacterToNote(noteId, characterId, "Cast")
            if (result.success) {
                const character = allCharacters.find(c => c.id === characterId)
                if (character) {
                    setNoteCharacters(prev => [...prev, {
                        id: result.noteCharacter?.id || "",
                        characterId,
                        role: "Cast",
                        character
                    }])
                }
                // Remove from suggestions and dismissed
                setSuggestedCharacters(prev => prev.filter(s => s.characterId !== characterId))
                setDismissedIds(prev => {
                    const newSet = new Set(prev)
                    newSet.delete(characterId)
                    return newSet
                })
                toast.success("Character added to cast")
                setIsOpen(false)
            } else {
                toast.error(result.message || "Failed to add character")
            }
        })
    }

    async function handleRemoveCharacter(characterId: string) {
        startTransition(async () => {
            const result = await removeCharacterFromNote(noteId, characterId)
            if (result.success) {
                setNoteCharacters(prev => prev.filter(nc => nc.characterId !== characterId))
                toast.success("Character removed from cast")
            } else {
                toast.error(result.message || "Failed to remove character")
            }
        })
    }

    function handlePinSuggested(characterId: string) {
        handleAddCharacter(characterId)
    }

    function handleDismissSuggested(characterId: string) {
        setDismissedIds(prev => new Set([...prev, characterId]))
        setSuggestedCharacters(prev => prev.filter(s => s.characterId !== characterId))
    }

    if (loading) {
        return (
            <div className="border rounded-lg p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-8 w-24 rounded-full" />
                </div>
            </div>
        )
    }

    return (
        <div className="border rounded-lg bg-card">
            {/* Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-t-lg"
            >
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Cast Deck</span>
                    <Badge variant="secondary" className="text-xs">
                        {noteCharacters.length}
                    </Badge>
                    {suggestedCharacters.length > 0 && (
                        <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {suggestedCharacters.length} detected
                        </Badge>
                    )}
                </div>
                {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="p-3 pt-0 border-t space-y-4">
                    {linkedChapterId ? (
                        <p className="text-xs text-muted-foreground">

                        </p>
                    ) : (
                        <p className="text-xs text-amber-500">
                            ⚠️ Link this note to a chapter to enable character tracking.
                        </p>
                    )}

                    {/* Confirmed Character list */}
                    <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
                            Confirmed Cast
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {noteCharacters.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-1">
                                    No characters added yet.
                                </p>
                            ) : (
                                noteCharacters.map(nc => (
                                    <Badge
                                        key={nc.characterId}
                                        variant="outline"
                                        className="pl-2 pr-1 py-1 flex items-center gap-1 group hover:border-destructive/50 transition-colors"
                                    >
                                        <span className="text-sm">{nc.character.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            ({nc.character.role})
                                        </span>
                                        <button
                                            onClick={() => handleRemoveCharacter(nc.characterId)}
                                            disabled={isPending}
                                            className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 group-hover:text-destructive transition-colors"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Suggested Characters (Auto-detected) */}
                    {suggestedCharacters.length > 0 && (
                        <div>
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-amber-500" />
                                Detected in Text
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {suggestedCharacters.map(suggestion => {
                                    const character = allCharacters.find(c => c.id === suggestion.characterId)
                                    if (!character) return null

                                    return (
                                        <TooltipProvider key={suggestion.characterId}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "pl-2 pr-1 py-1 flex items-center gap-1 transition-all",
                                                            "border-dashed border-amber-500/30 bg-amber-500/5",
                                                            "opacity-70 hover:opacity-100"
                                                        )}
                                                    >
                                                        <span className="text-sm">{character.name}</span>
                                                        <span className="text-[10px] text-amber-500 font-mono">
                                                            {Math.round(suggestion.confidence * 100)}%
                                                        </span>
                                                        {/* Pin button */}
                                                        <button
                                                            onClick={() => handlePinSuggested(suggestion.characterId)}
                                                            disabled={isPending}
                                                            className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                                                            title="Pin to cast"
                                                        >
                                                            <Pin className="h-3 w-3" />
                                                        </button>
                                                        {/* Dismiss button */}
                                                        <button
                                                            onClick={() => handleDismissSuggested(suggestion.characterId)}
                                                            disabled={isPending}
                                                            className="p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                                                            title="Dismiss"
                                                        >
                                                            <EyeOff className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">
                                                    <p className="text-xs">
                                                        Matched: "<span className="font-mono">{suggestion.matchedText}</span>"
                                                    </p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Add character popover */}
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={isPending || availableCharacters.length === 0}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Character
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search characters..." />
                                <CommandList>
                                    <CommandEmpty>No characters found.</CommandEmpty>
                                    <CommandGroup>
                                        <ScrollArea className="h-48">
                                            {availableCharacters.map(char => (
                                                <CommandItem
                                                    key={char.id}
                                                    value={char.name}
                                                    onSelect={() => handleAddCharacter(char.id)}
                                                    className="cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                                            {char.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm">{char.name}</span>
                                                            <span className="text-xs text-muted-foreground capitalize">
                                                                {char.role}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </CommandItem>
                                            ))}
                                        </ScrollArea>
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                </div>
            )}
        </div>
    )
}

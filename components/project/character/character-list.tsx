"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CharacterSheet } from "./character-sheet";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreVertical, Pencil, Trash2, User, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { deleteCharacter } from "@/server/character";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 8;
const EDGE_HOVER_DELAY = 800; // ms before auto-navigating

const ROLE_CONFIG = {
    protagonist: { label: "Main", color: "bg-amber-500/90" },
    antagonist: { label: "Villain", color: "bg-red-500/90" },
    supporting: { label: "Support", color: "bg-emerald-500/90" },
    minor: { label: "Minor", color: "bg-zinc-500/90" },
};

interface CharacterListProps {
    novelId: string;
    initialCharacters: any[];
}

export function CharacterList({ novelId, initialCharacters }: CharacterListProps) {
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>("all");
    const [chapterCharacterIds, setChapterCharacterIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedCharForAction, setSelectedCharForAction] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [hoveringEdge, setHoveringEdge] = useState<"left" | "right" | null>(null);
    const [slideOffset, setSlideOffset] = useState(0);
    const [slideTransition, setSlideTransition] = useState(true);
    const [isSliding, setIsSliding] = useState(false);
    const edgeHoverTimer = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

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

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE));
    const currentPageCharacters = filteredCharacters.slice(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE
    );

    // Reset page and expanded index when filter changes
    useEffect(() => {
        setExpandedIndex(0);
        setCurrentPage(0);
    }, [selectedChapter, filteredCharacters.length]);

    const goToPage = useCallback((page: number) => {
        if (isSliding || page === currentPage) return;
        if (page < 0 || page >= totalPages) return;

        const goingRight = page > currentPage;
        setIsSliding(true);

        // Phase 1: Slide current content out
        setSlideTransition(true);
        setSlideOffset(goingRight ? -105 : 105);

        setTimeout(() => {
            // Phase 2: Swap content & jump to opposite side (no transition)
            setSlideTransition(false);
            setCurrentPage(page);
            setExpandedIndex(0);
            setSlideOffset(goingRight ? 105 : -105);

            // Phase 3: Wait for paint, then slide in
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setSlideTransition(true);
                    setSlideOffset(0);

                    setTimeout(() => {
                        setIsSliding(false);
                    }, 420);
                });
            });
        }, 380);
    }, [isSliding, currentPage, totalPages]);

    const selectedChar = currentPageCharacters[expandedIndex] || currentPageCharacters[0];

    const handleDelete = async () => {
        if (!selectedCharForAction) return;
        setIsDeleting(true);
        const result = await deleteCharacter(selectedCharForAction.id);
        if (result.success) {
            toast.success("Character deleted successfully");
            setIsDeleteOpen(false);
        } else {
            toast.error(result.error || "Failed to delete character");
        }
        setIsDeleting(false);
    };

    const getRoleConfig = (role: string) => {
        return ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.minor;
    };

    // Edge hover auto-pagination
    const clearEdgeTimer = useCallback(() => {
        if (edgeHoverTimer.current) {
            clearTimeout(edgeHoverTimer.current);
            edgeHoverTimer.current = null;
        }
        setHoveringEdge(null);
    }, []);

    const handleEdgeEnter = useCallback((direction: "left" | "right") => {
        const canGo = direction === "left" ? currentPage > 0 : currentPage < totalPages - 1;
        if (!canGo || isSliding) return;

        setHoveringEdge(direction);
        clearEdgeTimer();
        setHoveringEdge(direction); // re-set after clear

        edgeHoverTimer.current = setTimeout(() => {
            goToPage(direction === "left" ? currentPage - 1 : currentPage + 1);
            setHoveringEdge(null);
        }, EDGE_HOVER_DELAY);
    }, [currentPage, totalPages, isSliding, goToPage, clearEdgeTimer]);

    const handleEdgeLeave = useCallback(() => {
        clearEdgeTimer();
    }, [clearEdgeTimer]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (edgeHoverTimer.current) clearTimeout(edgeHoverTimer.current);
        };
    }, []);

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

            {/* Character Display */}
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
                <>
                    {/* ===== Expandable Accordion Gallery (Desktop) ===== */}
                    <div
                        className="relative rounded-2xl overflow-hidden hidden md:block shadow-2xl"
                        style={{ height: "70vh", minHeight: "500px" }}
                    >
                        {/* Animated Blurred Background */}
                        <div
                            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
                            style={{
                                backgroundImage: selectedChar?.image
                                    ? `url(${selectedChar.image})`
                                    : "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
                                backgroundRepeat: "no-repeat",
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                                filter: "blur(40px) brightness(0.4)",
                            }}
                        />
                        <div className="absolute inset-0 bg-black/50" />

                        {/* Panels Container (with slide animation) */}
                        <div
                            className="relative z-10 flex w-full h-full gap-2 p-3"
                            style={{
                                transform: `translateX(${slideOffset}%)`,
                                transition: slideTransition
                                    ? "transform 380ms cubic-bezier(0.4, 0, 0.2, 1)"
                                    : "none",
                            }}
                        >
                            {currentPageCharacters.map((character, index) => {
                                const isExpanded = expandedIndex === index;
                                const roleConfig = getRoleConfig(character.role);

                                return (
                                    <div
                                        key={character.id}
                                        onClick={() => setExpandedIndex(index)}
                                        className={cn(
                                            "relative h-full rounded-2xl overflow-hidden cursor-pointer group/panel",
                                            "transition-[flex] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
                                            isExpanded ? "flex-[6]" : "flex-[1] hover:flex-[1.5]",
                                            "min-w-[48px]"
                                        )}
                                        style={{ willChange: "flex-grow" }}
                                    >
                                        {/* Character Image */}
                                        {character.image ? (
                                            <img
                                                src={character.image}
                                                alt={character.name}
                                                className={cn(
                                                    "absolute inset-0 w-full h-full object-cover",
                                                    isExpanded ? "object-top" : "object-center"
                                                )}
                                            />
                                        ) : (
                                            <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
                                                <User className={cn(
                                                    "text-zinc-500 transition-all duration-500",
                                                    isExpanded ? "w-20 h-20" : "w-8 h-8"
                                                )} />
                                            </div>
                                        )}

                                        {/* Gradient Overlays */}
                                        <div className={cn(
                                            "absolute inset-0",
                                            isExpanded
                                                ? "bg-gradient-to-t from-black/90 via-black/20 to-transparent"
                                                : "bg-gradient-to-t from-black/80 via-black/30 to-black/10"
                                        )} />

                                        {/* Role Badge - Top Left (expanded) */}
                                        <div className={cn(
                                            "absolute top-3 left-3 transition-opacity duration-300",
                                            isExpanded ? "opacity-100" : "opacity-0"
                                        )}>
                                            <Badge className={cn(
                                                "text-[11px] font-semibold text-white border-0 shadow-lg",
                                                roleConfig.color
                                            )}>
                                                {roleConfig.label}
                                            </Badge>
                                        </div>

                                        {/* Action Menu - Top Right (expanded) */}
                                        <div className={cn(
                                            "absolute top-3 right-3 z-20 transition-opacity duration-300",
                                            isExpanded
                                                ? "opacity-100"
                                                : "opacity-0 pointer-events-none"
                                        )}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 bg-black/50 hover:bg-black/70 text-white rounded-full"
                                                    >
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedCharForAction(character);
                                                        setIsSheetOpen(true);
                                                    }}>
                                                        <Pencil className="h-4 w-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedCharForAction(character);
                                                            setIsDeleteOpen(true);
                                                        }}
                                                        className="text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Expanded: Character Info Overlay */}
                                        <div className={cn(
                                            "absolute bottom-0 left-0 right-0 p-6 transition-opacity duration-400",
                                            isExpanded
                                                ? "opacity-100"
                                                : "opacity-0 pointer-events-none"
                                        )}>
                                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-1.5 drop-shadow-lg">
                                                {character.name}
                                            </h2>

                                            {/* Meta info */}
                                            <div className="flex items-center gap-3 text-white/50 text-sm mb-3 flex-wrap">
                                                {character.age && <span>Age {character.age}</span>}
                                                {character.gender && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-white/30" />
                                                        <span>{character.gender}</span>
                                                    </>
                                                )}
                                                {character.species && (
                                                    <>
                                                        <span className="w-1 h-1 rounded-full bg-white/30" />
                                                        <span>{character.species}</span>
                                                    </>
                                                )}
                                            </div>

                                            {/* Description */}
                                            {character.description && (
                                                <p className="text-white/60 text-sm leading-relaxed line-clamp-2 mb-5 max-w-xl">
                                                    {character.description}
                                                </p>
                                            )}

                                            {/* Action Buttons */}
                                            <Button
                                                size="sm"
                                                className="bg-white/15 hover:bg-white/25 text-white border border-white/20 hover:border-white/40"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    router.push(`/dashboard/project/${novelId}/characters/${character.id}`);
                                                }}
                                            >
                                                <Eye className="h-4 w-4 mr-2" />
                                                View Details
                                            </Button>
                                        </div>

                                        {/* Collapsed: Vertical Character Name */}
                                        <div className={cn(
                                            "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                                            isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
                                        )}>
                                            <span
                                                className="text-white font-semibold text-sm drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] tracking-wider select-none"
                                                style={{
                                                    writingMode: "vertical-rl",
                                                    textOrientation: "mixed",
                                                }}
                                            >
                                                {character.name}
                                            </span>
                                        </div>

                                        {/* Collapsed: Bottom role indicator dot */}
                                        <div className={cn(
                                            "absolute bottom-3 left-1/2 -translate-x-1/2 transition-opacity duration-300",
                                            isExpanded ? "opacity-0 pointer-events-none" : "opacity-100"
                                        )}>
                                            <div className={cn(
                                                "w-2 h-2 rounded-full shadow-lg",
                                                roleConfig.color
                                            )} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ===== Page Navigation Arrows ===== */}
                        {totalPages > 1 && (
                            <>
                                {/* Left Edge Hover Zone */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 w-16 z-20 pointer-events-none"
                                    style={{ display: currentPage === 0 ? "none" : "block" }}
                                >
                                    <div
                                        className="absolute inset-0 pointer-events-auto cursor-pointer"
                                        onMouseEnter={() => handleEdgeEnter("left")}
                                        onMouseLeave={handleEdgeLeave}
                                        onClick={(e) => { e.stopPropagation(); goToPage(currentPage - 1); }}
                                    />
                                    {/* Glow indicator */}
                                    <div className={cn(
                                        "absolute inset-0 transition-opacity duration-300",
                                        "bg-gradient-to-r from-white/15 to-transparent",
                                        hoveringEdge === "left" ? "opacity-100" : "opacity-0"
                                    )} />
                                    {/* Chevron icon */}
                                    <div className={cn(
                                        "absolute left-3 top-1/2 -translate-y-1/2 transition-opacity duration-300",
                                        hoveringEdge === "left" ? "opacity-100 animate-pulse" : "opacity-0"
                                    )}>
                                        <ChevronLeft className="h-6 w-6 text-white drop-shadow-lg" />
                                    </div>
                                </div>

                                {/* Right Edge Hover Zone */}
                                <div
                                    className="absolute right-0 top-0 bottom-0 w-16 z-20 pointer-events-none"
                                    style={{ display: currentPage >= totalPages - 1 ? "none" : "block" }}
                                >
                                    <div
                                        className="absolute inset-0 pointer-events-auto cursor-pointer"
                                        onMouseEnter={() => handleEdgeEnter("right")}
                                        onMouseLeave={handleEdgeLeave}
                                        onClick={(e) => { e.stopPropagation(); goToPage(currentPage + 1); }}
                                    />
                                    {/* Glow indicator */}
                                    <div className={cn(
                                        "absolute inset-0 transition-opacity duration-300",
                                        "bg-gradient-to-l from-white/15 to-transparent",
                                        hoveringEdge === "right" ? "opacity-100" : "opacity-0"
                                    )} />
                                    {/* Chevron icon */}
                                    <div className={cn(
                                        "absolute right-3 top-1/2 -translate-y-1/2 transition-opacity duration-300",
                                        hoveringEdge === "right" ? "opacity-100 animate-pulse" : "opacity-0"
                                    )}>
                                        <ChevronRight className="h-6 w-6 text-white drop-shadow-lg" />
                                    </div>
                                </div>



                                {/* Page Indicator Dots */}
                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5">
                                    {Array.from({ length: totalPages }).map((_, i) => (
                                        <button
                                            key={i}
                                            onClick={(e) => { e.stopPropagation(); goToPage(i); }}
                                            className={cn(
                                                "rounded-full transition-all duration-300",
                                                currentPage === i
                                                    ? "w-6 h-2 bg-white"
                                                    : "w-2 h-2 bg-white/40 hover:bg-white/60"
                                            )}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* ===== Mobile Grid Fallback ===== */}
                    <div className="grid grid-cols-2 gap-4 md:hidden">
                        {filteredCharacters.map((character) => (
                            <CharacterCard
                                key={character.id}
                                character={character}
                                novelId={novelId}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Edit Sheet */}
            {selectedCharForAction && (
                <CharacterSheet
                    character={selectedCharForAction}
                    novelId={novelId}
                    open={isSheetOpen}
                    onOpenChange={setIsSheetOpen}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Character</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{selectedCharForAction?.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

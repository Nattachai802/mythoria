"use client";

import { useEffect, useState } from "react";
import { getCharacterRelationships, deleteCharacterRelationship } from "@/server/character";
import { getCharacterFactions, removeCharacterFromFaction } from "@/server/factions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, User, ArrowLeftRight, ArrowRight, ArrowLeft } from "lucide-react";
import { AddRelationshipDialog } from "./add-relationship-dialog";
import { ManageFactionDialog } from "./manage-faction-dialog";
import { RELATIONSHIP_COLORS } from "./relationship-constants";
import { Badge } from "@/components/ui/badge";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { getChapters } from "@/server/chapter";
import { getCharactersInChapter } from "@/server/chapter-characters";

interface CharacterRelationshipsProps {
    characterId: string;
    novelId: string;
}

export function CharacterRelationships({ characterId, novelId }: CharacterRelationshipsProps) {
    const [relationships, setRelationships] = useState<any[]>([]);
    const [factions, setFactions] = useState<any[]>([]);
    const [chapters, setChapters] = useState<any[]>([]);
    const [selectedChapter, setSelectedChapter] = useState<string>("all");
    const [chapterCharacters, setChapterCharacters] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isFactionAddOpen, setIsFactionAddOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleteFactionId, setDeleteFactionId] = useState<string | null>(null);

    const fetchData = async () => {
        const [relResult, facResult, chapResult] = await Promise.all([
            getCharacterRelationships(characterId),
            getCharacterFactions(characterId),
            getChapters(novelId)
        ]);

        if (relResult.success && relResult.data) {
            setRelationships(relResult.data);
        }
        if (facResult.success && facResult.data) {
            setFactions(facResult.data);
        }
        if (chapResult.success && chapResult.chapters) {
            setChapters(chapResult.chapters);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        setIsLoading(true);
        fetchData();
    }, [characterId]);

    // Fetch characters in selected chapter
    useEffect(() => {
        async function fetchChapterCharacters() {
            if (selectedChapter === "all") {
                setChapterCharacters(new Set());
                return;
            }

            const result = await getCharactersInChapter(selectedChapter);
            if (result.success && result.data) {
                const charIds = new Set(result.data.map((cc: any) => cc.character.id));
                setChapterCharacters(charIds);
            }
        }

        fetchChapterCharacters();
    }, [selectedChapter]);

    const handleDelete = async () => {
        if (!deleteId) return;

        const result = await deleteCharacterRelationship(deleteId);
        if (result.success) {
            toast.success("Relationship removed");
            fetchData();
        } else {
            toast.error("Failed to remove relationship");
        }
        setDeleteId(null);
    };

    const handleRemoveFaction = async () => {
        if (!deleteFactionId) return;

        const result = await removeCharacterFromFaction(deleteFactionId, novelId);
        if (result.success) {
            toast.success("Removed from faction");
            fetchData();
        } else {
            toast.error("Failed to remove from faction");
        }
        setDeleteFactionId(null);
    };

    return (
        <>
            <div className="space-y-6">
                {/* Factions Section */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Factions & Groups</CardTitle>
                            <Button onClick={() => setIsFactionAddOpen(true)} size="sm" variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Join Faction
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-2 text-muted-foreground">Loading...</div>
                        ) : factions.length === 0 ? (
                            <div className="text-center py-4 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                                <p>Not belonging to any faction.</p>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-3">
                                {factions.map((membership) => (
                                    <div key={membership.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                        <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center font-bold text-primary">
                                            {membership.faction.name.charAt(0)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold">{membership.faction.name}</span>
                                            <span className="text-xs text-muted-foreground">{membership.role || "Member"}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 ml-1 text-muted-foreground hover:text-red-500"
                                            onClick={() => setDeleteFactionId(membership.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <CardTitle>Relationships</CardTitle>
                                {chapters.length > 0 && (
                                    <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Filter by chapter" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Chapters</SelectItem>
                                            {chapters.map((chapter) => (
                                                <SelectItem key={chapter.id} value={chapter.id}>
                                                    Ch. {chapter.orderIndex}: {chapter.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <Button onClick={() => setIsAddOpen(true)} size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Relationship
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="text-center py-4 text-muted-foreground">Loading relationships...</div>
                        ) : relationships.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                <p>No relationships defined yet.</p>
                                <Button variant="link" onClick={() => setIsAddOpen(true)}>
                                    Add your first relationship
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {relationships
                                    .filter((rel) => {
                                        // If "all" or no chapter selected, show all
                                        if (selectedChapter === "all") return true;
                                        // Otherwise, only show if the related character is in the selected chapter
                                        return chapterCharacters.has(rel.character.id);
                                    })
                                    .length === 0 ? (
                                    <div className="col-span-2 text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                        {selectedChapter === "all" ? (
                                            <p>No relationships defined yet.</p>
                                        ) : (
                                            <p>No relationships found for characters in this chapter.</p>
                                        )}
                                    </div>
                                ) : (
                                    relationships
                                        .filter((rel) => {
                                            if (selectedChapter === "all") return true;
                                            return chapterCharacters.has(rel.character.id);
                                        })
                                        .map((rel) => (
                                            <div
                                                key={rel.id}
                                                className="flex items-start gap-3 p-3 rounded-lg border bg-card text-card-foreground shadow-sm"
                                            >
                                                <Link href={`/dashboard/project/${novelId}/characters/${rel.character.id}`} className="shrink-0">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
                                                        {rel.character.image ? (
                                                            <img
                                                                src={rel.character.image}
                                                                alt={rel.character.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <User className="h-6 w-6 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </Link>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <Link href={`/dashboard/project/${novelId}/characters/${rel.character.id}`} className="hover:underline">
                                                            <span className="font-medium">{rel.character.name}</span>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                                            onClick={() => setDeleteId(rel.id)}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>

                                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                                        <Badge
                                                            className={`${RELATIONSHIP_COLORS[rel.relationshipType] || "bg-gray-500"
                                                                } hover:${RELATIONSHIP_COLORS[rel.relationshipType] || "bg-gray-500"}`}
                                                        >
                                                            {rel.relationshipType}
                                                        </Badge>

                                                        {/* Direction Indicator */}
                                                        <div className="text-xs text-muted-foreground flex items-center" title={rel.isSource ? "You view them as..." : "They view you as..."}>
                                                            {rel.isSource ? (
                                                                <ArrowRight className="w-3 h-3 mr-1" />
                                                            ) : (
                                                                <ArrowLeft className="w-3 h-3 mr-1" />
                                                            )}
                                                            {rel.isSource ? "Outgoing" : "Incoming"}
                                                        </div>
                                                    </div>

                                                    {rel.description && (
                                                        <p className="text-sm text-muted-foreground break-words line-clamp-2">
                                                            {rel.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <AddRelationshipDialog
                    novelId={novelId}
                    sourceCharacterId={characterId}
                    open={isAddOpen}
                    onOpenChange={setIsAddOpen}
                    onSuccess={fetchData}
                />

                <ManageFactionDialog
                    novelId={novelId}
                    characterId={characterId}
                    open={isFactionAddOpen}
                    onOpenChange={setIsFactionAddOpen}
                    onSuccess={fetchData}
                />

                <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Remove Relationship</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to remove this relationship?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                Remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <AlertDialog open={!!deleteFactionId} onOpenChange={(open) => !open && setDeleteFactionId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Leave Faction</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to leave this faction?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRemoveFaction} className="bg-red-600 hover:bg-red-700">
                                Leave
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
}

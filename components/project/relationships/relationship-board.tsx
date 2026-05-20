"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { Character } from "@/db/schema";
import { Loader2 } from "lucide-react";

const RelationshipFlow = dynamic(
    () => import("./relationship-flow").then(m => ({ default: m.RelationshipFlow })),
    { ssr: false, loading: () => <div className="flex items-center justify-center h-96"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> }
);
import { Button } from "@/components/ui/button";
import { Plus, Trash2, RefreshCw, Users, UserPlus } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createCharacterRelationship, deleteCharacterRelationship, getAllCharacterRelationships } from "@/server/character";
import { createFaction, addCharacterToFaction, deleteFaction, getAllFactionsWithMembers, removeCharacterFromFaction } from "@/server/factions";
import { RELATIONSHIP_TYPES } from "@/components/project/character/relationship-constants";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

interface RelationshipBoardProps {
    characters: Character[];
    relationships: any[];
    factions: any[];
    novelId: string;
}

export function RelationshipBoard({
    characters: initialCharacters,
    relationships: initialRelationships,
    factions: initialFactions,
    novelId
}: RelationshipBoardProps) {
    const [relationships, setRelationships] = useState(initialRelationships);
    const [factions, setFactions] = useState(initialFactions);
    const [isAddRelOpen, setIsAddRelOpen] = useState(false);
    const [isDeleteRelOpen, setIsDeleteRelOpen] = useState(false);
    const [selectedRelationship, setSelectedRelationship] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Faction dialogs
    const [isCreateFactionOpen, setIsCreateFactionOpen] = useState(false);
    const [isAssignFactionOpen, setIsAssignFactionOpen] = useState(false);
    const [isDeleteFactionOpen, setIsDeleteFactionOpen] = useState(false);
    const [selectedFaction, setSelectedFaction] = useState<any>(null);

    // Relationship form state
    const [sourceId, setSourceId] = useState("");
    const [targetId, setTargetId] = useState("");
    const [relType, setRelType] = useState("Friend");
    const [description, setDescription] = useState("");

    // Faction form state
    const [factionName, setFactionName] = useState("");
    const [factionType, setFactionType] = useState("");
    const [factionColor, setFactionColor] = useState("#3b82f6");
    const [assignCharId, setAssignCharId] = useState("");
    const [assignFactionId, setAssignFactionId] = useState("");
    const [assignRole, setAssignRole] = useState("Member");

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        const [relResult, facResult] = await Promise.all([
            getAllCharacterRelationships(novelId),
            getAllFactionsWithMembers(novelId)
        ]);
        if (relResult.success && relResult.data) {
            setRelationships(relResult.data);
        }
        if (facResult.success && facResult.data) {
            setFactions(facResult.data);
        }
        setIsLoading(false);
    }, [novelId]);

    // Relationship handlers
    const handleCreateRelationship = async () => {
        if (!sourceId || !targetId) {
            toast.error("Please select both characters");
            return;
        }
        if (sourceId === targetId) {
            toast.error("Cannot create relationship with self");
            return;
        }

        setIsLoading(true);
        const result = await createCharacterRelationship({
            novelId,
            sourceCharacterId: sourceId,
            targetCharacterId: targetId,
            type: relType,
            description: description || undefined,
        });

        if (result.success) {
            toast.success("Relationship created");
            await refreshData();
            setIsAddRelOpen(false);
            resetRelForm();
        } else {
            toast.error(result.error || "Failed to create relationship");
        }
        setIsLoading(false);
    };

    const handleDeleteRelationship = async () => {
        if (!selectedRelationship) return;

        setIsLoading(true);
        const result = await deleteCharacterRelationship(selectedRelationship.id);
        if (result.success) {
            toast.success("Relationship deleted");
            await refreshData();
        } else {
            toast.error("Failed to delete relationship");
        }
        setIsDeleteRelOpen(false);
        setSelectedRelationship(null);
        setIsLoading(false);
    };

    // Faction handlers
    const handleCreateFaction = async () => {
        if (!factionName.trim()) {
            toast.error("Please enter a faction name");
            return;
        }

        setIsLoading(true);
        const result = await createFaction({
            name: factionName,
            type: factionType || undefined,
            color: factionColor,
            novelId,
        });

        if (result.success) {
            toast.success("Faction created");
            await refreshData();
            setIsCreateFactionOpen(false);
            resetFactionForm();
        } else {
            toast.error(result.error || "Failed to create faction");
        }
        setIsLoading(false);
    };

    const handleAssignToFaction = async () => {
        if (!assignCharId || !assignFactionId) {
            toast.error("Please select character and faction");
            return;
        }

        setIsLoading(true);
        const result = await addCharacterToFaction({
            characterId: assignCharId,
            factionId: assignFactionId,
            role: assignRole || undefined,
            novelId,
        });

        if (result.success) {
            toast.success("Character assigned to faction");
            await refreshData();
            setIsAssignFactionOpen(false);
            resetAssignForm();
        } else {
            toast.error(result.error || "Failed to assign character");
        }
        setIsLoading(false);
    };

    const handleDeleteFaction = async () => {
        if (!selectedFaction) return;

        setIsLoading(true);
        const result = await deleteFaction(selectedFaction.id);
        if (result.success) {
            toast.success("Faction deleted");
            await refreshData();
        } else {
            toast.error("Failed to delete faction");
        }
        setIsDeleteFactionOpen(false);
        setSelectedFaction(null);
        setIsLoading(false);
    };

    const resetRelForm = () => {
        setSourceId("");
        setTargetId("");
        setRelType("Friend");
        setDescription("");
    };

    const resetFactionForm = () => {
        setFactionName("");
        setFactionType("");
        setFactionColor("#3b82f6");
    };

    const resetAssignForm = () => {
        setAssignCharId("");
        setAssignFactionId("");
        setAssignRole("Member");
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Relationship Actions */}
                    <Button onClick={() => setIsAddRelOpen(true)} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Relationship
                    </Button>

                    {relationships.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Relationship
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-64 max-h-80 overflow-y-auto">
                                <DropdownMenuLabel>Select to Delete</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {relationships.map((rel) => {
                                    const source = initialCharacters.find(c => c.id === rel.sourceCharacterId);
                                    const target = initialCharacters.find(c => c.id === rel.targetCharacterId);
                                    return (
                                        <DropdownMenuItem
                                            key={rel.id}
                                            onClick={() => {
                                                setSelectedRelationship(rel);
                                                setIsDeleteRelOpen(true);
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {source?.name || "?"} → {target?.name || "?"}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {rel.type}
                                                </span>
                                            </div>
                                        </DropdownMenuItem>
                                    );
                                })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    <Separator orientation="vertical" className="h-6 mx-1" />

                    {/* Faction Actions */}
                    <Button onClick={() => setIsCreateFactionOpen(true)} size="sm" variant="secondary">
                        <Users className="w-4 h-4 mr-2" />
                        Create Faction
                    </Button>

                    <Button onClick={() => setIsAssignFactionOpen(true)} size="sm" variant="secondary">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Assign to Faction
                    </Button>

                    {factions.length > 0 && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Faction
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                                <DropdownMenuLabel>Select Faction</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {factions.map((fac) => (
                                    <DropdownMenuItem
                                        key={fac.id}
                                        onClick={() => {
                                            setSelectedFaction(fac);
                                            setIsDeleteFactionOpen(true);
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-3 h-3 rounded-full"
                                                style={{ backgroundColor: fac.color || '#ccc' }}
                                            />
                                            {fac.name}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                <Button variant="ghost" size="sm" onClick={refreshData} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Graph */}
            <RelationshipFlow
                characters={initialCharacters}
                relationships={relationships}
                factions={factions}
                novelId={novelId}
                onRelationshipCreated={refreshData}
            />

            {/* Add Relationship Dialog */}
            <Dialog open={isAddRelOpen} onOpenChange={setIsAddRelOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Relationship</DialogTitle>
                        <DialogDescription>
                            Define a new relationship between two characters.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Source Character</Label>
                                <Select value={sourceId} onValueChange={setSourceId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select character" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {initialCharacters.map((char) => (
                                            <SelectItem key={char.id} value={char.id}>
                                                {char.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Target Character</Label>
                                <Select value={targetId} onValueChange={setTargetId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select character" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {initialCharacters
                                            .filter(c => c.id !== sourceId)
                                            .map((char) => (
                                                <SelectItem key={char.id} value={char.id}>
                                                    {char.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Relationship Type</Label>
                            <Select value={relType} onValueChange={setRelType}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {RELATIONSHIP_TYPES.map((type) => (
                                        <SelectItem key={type} value={type}>
                                            {type}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Description (Optional)</Label>
                            <Textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Describe the relationship..."
                                rows={2}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddRelOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateRelationship} disabled={isLoading}>
                            {isLoading ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Faction Dialog */}
            <Dialog open={isCreateFactionOpen} onOpenChange={setIsCreateFactionOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Faction</DialogTitle>
                        <DialogDescription>
                            Create a new faction or group for characters.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Faction Name *</Label>
                            <Input
                                value={factionName}
                                onChange={(e) => setFactionName(e.target.value)}
                                placeholder="e.g. The Night Watch, House Stark"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Type (Optional)</Label>
                            <Input
                                value={factionType}
                                onChange={(e) => setFactionType(e.target.value)}
                                placeholder="e.g. Guild, Kingdom, Family"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="color"
                                    value={factionColor}
                                    onChange={(e) => setFactionColor(e.target.value)}
                                    className="w-16 h-10 p-1 cursor-pointer"
                                />
                                <Input
                                    value={factionColor}
                                    onChange={(e) => setFactionColor(e.target.value)}
                                    placeholder="#3b82f6"
                                    className="flex-1"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateFactionOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateFaction} disabled={isLoading}>
                            {isLoading ? "Creating..." : "Create Faction"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign to Faction Dialog */}
            <Dialog open={isAssignFactionOpen} onOpenChange={setIsAssignFactionOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Character to Faction</DialogTitle>
                        <DialogDescription>
                            Add a character to an existing faction.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Character</Label>
                            <Select value={assignCharId} onValueChange={setAssignCharId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select character" />
                                </SelectTrigger>
                                <SelectContent>
                                    {initialCharacters.map((char) => (
                                        <SelectItem key={char.id} value={char.id}>
                                            {char.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Faction</Label>
                            <Select value={assignFactionId} onValueChange={setAssignFactionId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select faction" />
                                </SelectTrigger>
                                <SelectContent>
                                    {factions.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            No factions yet. Create one first!
                                        </div>
                                    ) : (
                                        factions.map((fac) => (
                                            <SelectItem key={fac.id} value={fac.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: fac.color || '#ccc' }}
                                                    />
                                                    {fac.name}
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Role in Faction</Label>
                            <Input
                                value={assignRole}
                                onChange={(e) => setAssignRole(e.target.value)}
                                placeholder="e.g. Leader, Member, Captain"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignFactionOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAssignToFaction} disabled={isLoading || factions.length === 0}>
                            {isLoading ? "Assigning..." : "Assign"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Relationship Confirmation */}
            <AlertDialog open={isDeleteRelOpen} onOpenChange={setIsDeleteRelOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Relationship</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this relationship? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteRelationship}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isLoading}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Faction Confirmation */}
            <AlertDialog open={isDeleteFactionOpen} onOpenChange={setIsDeleteFactionOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Faction</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{selectedFaction?.name}"?
                            All members will be removed from this faction.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteFaction}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isLoading}
                        >
                            Delete Faction
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}


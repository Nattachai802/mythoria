"use client";

import { useEffect, useState } from "react";
import { Character } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RELATIONSHIP_COLORS } from "@/components/project/character/relationship-constants";
import { User } from "lucide-react";

interface RelationshipBoardProps {
    characters: Character[];
    relationships: any[];
}

export function RelationshipMatrix({ characters, relationships }: RelationshipBoardProps) {
    // We can filter by "Chapter" here later if we add that metadata
    const [selectedChapter, setSelectedChapter] = useState<string>("all");

    // Helper to find relationship between two characters
    const getRelationship = (sourceId: string, targetId: string) => {
        if (sourceId === targetId) return null;

        // Find direct relationship (Source -> Target)
        return relationships.find(r =>
            r.sourceCharacterId === sourceId && r.targetCharacterId === targetId
        );
    };

    return (
        <Card className="min-w-full overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Relationship Matrix</CardTitle>
                <div className="w-[200px]">
                    <Select value={selectedChapter} onValueChange={setSelectedChapter} disabled>
                        <SelectTrigger>
                            <SelectValue placeholder="Select Chapter" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Current (Global)</SelectItem>
                            {/* Pro Feature: Chapters would go here */}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="w-full h-[600px] rounded-md border">
                    <div className="min-w-max p-4">
                        <table className="border-collapse w-full">
                            <thead>
                                <tr>
                                    <th className="p-2 border-b bg-muted/50 text-left min-w-[150px] sticky top-0 left-0 z-20 bg-background">
                                        Source \ Target
                                    </th>
                                    {characters.map(char => (
                                        <th key={char.id} className="p-2 border-b min-w-[120px] text-center sticky top-0 bg-background z-10">
                                            <div className="flex flex-col items-center gap-1">
                                                <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                                                    {char.image ? (
                                                        <img src={char.image} alt={char.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <User className="w-4 h-4 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-xs font-medium truncate max-w-[100px]">{char.name}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {characters.map(source => (
                                    <tr key={source.id} className="hover:bg-muted/20">
                                        <td className="p-2 border-r font-medium sticky left-0 bg-background z-10">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-muted overflow-hidden shrink-0">
                                                    {source.image ? (
                                                        <img src={source.image} alt={source.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <User className="w-3 h-3 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm truncate max-w-[120px]">{source.name}</span>
                                            </div>
                                        </td>
                                        {characters.map(target => {
                                            const rel = getRelationship(source.id, target.id);

                                            if (source.id === target.id) {
                                                return <td key={target.id} className="p-2 border bg-muted/50" />;
                                            }

                                            return (
                                                <td key={target.id} className="p-2 border text-center h-[80px] align-middle">
                                                    {rel ? (
                                                        <TooltipProvider delayDuration={0}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex flex-col items-center gap-1 cursor-help">
                                                                        <Badge
                                                                            className={`${RELATIONSHIP_COLORS[rel.type] || "bg-gray-500"} text-[10px] px-1.5 h-5 truncate max-w-[100px]`}
                                                                        >
                                                                            {rel.type}
                                                                        </Badge>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <div className="text-xs max-w-[200px]">
                                                                        <p className="font-semibold">{rel.type}</p>
                                                                        {rel.description && <p className="text-muted-foreground">{rel.description}</p>}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ) : (
                                                        <span className="text-muted-foreground/20 text-xl">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Pencil, User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { EditCharacterDialog } from "@/components/project/character/edit-character-dialog";
import { CharacterRelationships } from "@/components/project/character/character-relationships";
import { CharacterJourney } from "@/components/project/character/character-journey";
import { Character } from "@/db/schema";

interface CharacterDetailContentProps {
    character: Character;
    novelId: string;
}

export function CharacterDetailContent({
    character,
    novelId
}: CharacterDetailContentProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    return (
        <>
            <div className="p-8 max-w-5xl mx-auto">
                <div className="mb-6">
                    <Link href={`/dashboard/project/${novelId}/characters`}>
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Characters
                        </Button>
                    </Link>

                    <div className="flex items-start gap-6">
                        <div className="w-48 h-64 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                            {character.image ? (
                                <img
                                    src={character.image}
                                    alt={character.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <User className="w-24 h-24 text-muted-foreground" />
                                </div>
                            )}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-4xl font-bold">{character.name}</h1>
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <Badge>{character.role}</Badge>
                                        {/* Display aliases as subtle tags */}
                                        {Array.isArray(character.aliases) && (character.aliases as string[]).length > 0 ? (
                                            <>
                                                <span className="text-muted-foreground">•</span>
                                                {(character.aliases as string[]).map((alias: string, index: number) => (
                                                    <Badge key={index} variant="secondary" className="text-xs font-normal">
                                                        {String(alias)}
                                                    </Badge>
                                                ))}
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <Button onClick={() => setEditDialogOpen(true)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            </div>

                            {character.description && (
                                <p className="text-muted-foreground mt-4">
                                    {character.description}
                                </p>
                            )}

                            <div className="grid grid-cols-3 gap-4 mt-6">
                                {character.age && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Age</p>
                                        <p className="font-medium">{character.age}</p>
                                    </div>
                                )}
                                {character.gender && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Gender</p>
                                        <p className="font-medium">{character.gender}</p>
                                    </div>
                                )}
                                {character.species && (
                                    <div>
                                        <p className="text-sm text-muted-foreground">Species</p>
                                        <p className="font-medium">{character.species}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <Separator className="my-8" />

                <div className="space-y-6">
                    {character.appearance && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Appearance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{character.appearance}</p>
                            </CardContent>
                        </Card>
                    )}

                    {character.personality && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Personality</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{character.personality}</p>
                            </CardContent>
                        </Card>
                    )}

                    {character.backstory && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Backstory</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{character.backstory}</p>
                            </CardContent>
                        </Card>
                    )}

                    {(character.goals || character.motivation || character.conflict) && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Character Depth</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {character.goals && (
                                    <div>
                                        <h4 className="font-semibold mb-2">Goals</h4>
                                        <p className="whitespace-pre-wrap text-muted-foreground">
                                            {character.goals}
                                        </p>
                                    </div>
                                )}
                                {character.motivation && (
                                    <div>
                                        <h4 className="font-semibold mb-2">Motivation</h4>
                                        <p className="whitespace-pre-wrap text-muted-foreground">
                                            {character.motivation}
                                        </p>
                                    </div>
                                )}
                                {character.conflict && (
                                    <div>
                                        <h4 className="font-semibold mb-2">Conflict</h4>
                                        <p className="whitespace-pre-wrap text-muted-foreground">
                                            {character.conflict}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {(character.strengths || character.weaknesses) && (
                        <div className="grid grid-cols-2 gap-6">
                            {character.strengths && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Strengths</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="whitespace-pre-wrap">{character.strengths}</p>
                                    </CardContent>
                                </Card>
                            )}
                            {character.weaknesses && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Weaknesses</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="whitespace-pre-wrap">{character.weaknesses}</p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    <CharacterRelationships characterId={character.id} novelId={novelId} />

                    {/* AI-Extracted Journey */}
                    <Card>
                        <CardHeader>
                            <CardTitle>เส้นทางการเดินทาง (AI)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <CharacterJourney characterId={character.id} novelId={novelId} />
                        </CardContent>
                    </Card>
                </div>
            </div>

            <EditCharacterDialog
                character={character}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />
        </>
    );
}

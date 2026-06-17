"use client";

import { useState } from "react";
import { Idea } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { EditIdeaDialog } from "@/components/project/idea/edit-idea-dialog";
import { Lightbulb, Plus, Calendar, Tag, Sparkles } from "lucide-react";

interface CharacterIdeasTabProps {
    characterId: string;
    characterName: string;
    novelId: string;
    ideas: Idea[];
}

export function CharacterIdeasTab({
    characterId,
    characterName,
    novelId,
    ideas = []
}: CharacterIdeasTabProps) {
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    // Filter ideas that are linked to this character
    const linkedIdeas = ideas.filter(idea => {
        if (!idea.linkedCharacterIds) return false;
        const ids = Array.isArray(idea.linkedCharacterIds)
            ? idea.linkedCharacterIds
            : [];
        return ids.includes(characterId);
    });

    const getCategoryColor = (category: string | null) => {
        switch (category) {
            case "character": return "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400";
            case "power": return "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400";
            case "lore": return "border-[var(--forge-gold)]/40 bg-[var(--forge-gold)]/15 text-[var(--forge-amber)]";
            case "plot": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
            default: return "border-zinc-400/30 bg-zinc-400/10 text-zinc-600 dark:text-zinc-300";
        }
    };

    return (
        <div className="space-y-4">
            {linkedIdeas.length > 0 && (
                <div className="flex justify-end">
                    <Button onClick={() => setCreateDialogOpen(true)} size="sm" variant="outline" className="chamfered-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        ไอเดียใหม่
                    </Button>
                </div>
            )}

            {/* Ideas List */}
            {linkedIdeas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 chamfered border border-dashed border-border bg-card/40 text-center">
                    <Sparkles className="w-9 h-9 text-[var(--forge-gold)]/50 mb-3" />
                    <h4 className="font-display font-semibold mb-1.5">ยังไม่มีไอเดียสำหรับ {characterName}</h4>
                    <p className="text-sm text-muted-foreground max-w-sm mb-4">
                        บันทึกไอเดียหรือโน้ตที่เกี่ยวกับตัวละครนี้ไว้ที่นี่
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)} variant="outline" className="chamfered-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        สร้างไอเดียแรก
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {linkedIdeas.map((idea) => (
                        <div
                            key={idea.id}
                            className="chamfered border border-border bg-card/50 p-4 cursor-pointer transition-colors hover:border-[var(--forge-gold)]/40"
                            onClick={() => {
                                setSelectedIdea(idea);
                                setEditDialogOpen(true);
                            }}
                        >
                            <div className="flex items-start gap-3">
                                <div className="p-2 chamfered-sm bg-[var(--forge-gold)]/15 shrink-0">
                                    <Lightbulb className="w-4 h-4 text-[var(--forge-amber)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4 className="font-display font-semibold line-clamp-1">
                                            {idea.title || "ไม่มีชื่อ"}
                                        </h4>
                                        <Badge variant="outline" className={`chamfered-sm shrink-0 ${getCategoryColor(idea.category)}`}>
                                            {idea.category || "ทั่วไป"}
                                        </Badge>
                                    </div>

                                    {idea.content && (
                                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                            {typeof idea.content === 'string' ? idea.content : ''}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(idea.createdAt).toLocaleDateString('th-TH', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </div>
                                        {Array.isArray(idea.tags) && (idea.tags as string[]).length > 0 && (
                                            <div className="flex items-center gap-1">
                                                <Tag className="w-3 h-3" />
                                                {(idea.tags as string[]).slice(0, 2).join(', ')}
                                                {(idea.tags as string[]).length > 2 && ` +${(idea.tags as string[]).length - 2}`}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <CreateIdeaDialog
                novelId={novelId}
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                defaultLinkedCharacterIds={[characterId]}
                defaultCategory="character"
            />

            {/* Edit Dialog */}
            {selectedIdea && (
                <EditIdeaDialog
                    idea={selectedIdea}
                    open={editDialogOpen}
                    onOpenChange={(open) => {
                        setEditDialogOpen(open);
                        if (!open) setSelectedIdea(null);
                    }}
                />
            )}
        </div>
    );
}

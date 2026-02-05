"use client";

import { useState } from "react";
import { Idea } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { EditIdeaDialog } from "@/components/project/idea/edit-idea-dialog";
import { Lightbulb, Plus, Calendar, Tag, Sparkles } from "lucide-react";

type EntityType = "character" | "power" | "location" | "lore";

interface EntityIdeasTabProps {
    entityType: EntityType;
    entityId: string;
    entityName: string;
    novelId: string;
    ideas: Idea[];
}

export function EntityIdeasTab({
    entityType,
    entityId,
    entityName,
    novelId,
    ideas = []
}: EntityIdeasTabProps) {
    const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    // Get the appropriate linked field name based on entity type
    const getLinkedFieldName = (): keyof Idea => {
        switch (entityType) {
            case "character":
                return "linkedCharacterIds";
            case "power":
                return "linkedPowerIds";
            case "location":
                return "linkedLocationIds";
            case "lore":
                return "linkedLoreIds";
            default:
                return "linkedCharacterIds";
        }
    };

    // Filter ideas that are linked to this entity
    const linkedField = getLinkedFieldName();
    const linkedIdeas = ideas.filter(idea => {
        const linkedIds = idea[linkedField];
        if (!linkedIds) return false;
        const ids = Array.isArray(linkedIds) ? linkedIds : [];
        return ids.includes(entityId);
    });

    // Get default linked IDs for creation
    const getDefaultLinkedIds = () => {
        switch (entityType) {
            case "character":
                return { linkedCharacterIds: [entityId] };
            case "power":
                return { linkedPowerIds: [entityId] };
            case "location":
                return { linkedLocationIds: [entityId] };
            case "lore":
                return { linkedLoreIds: [entityId] };
            default:
                return {};
        }
    };

    const getCategoryColor = (category: string | null) => {
        switch (category) {
            case "character": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
            case "power": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
            case "lore": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
            case "location": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
            case "plot": return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400";
            default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
        }
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Ideas & Notes</h3>
                    <p className="text-sm text-muted-foreground">
                        Scratchpad สำหรับ {entityName}
                    </p>
                </div>
                {/* Show button only when there are ideas */}
                {linkedIdeas.length > 0 && (
                    <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Idea
                    </Button>
                )}
            </div>

            {/* Ideas List */}
            {linkedIdeas.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="p-4 rounded-full bg-muted mb-4">
                            <Sparkles className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h4 className="font-semibold mb-2">ยังไม่มีไอเดีย</h4>
                        <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                            เริ่มบันทึกไอเดียหรือโน้ตสำหรับ {entityName}
                        </p>
                        <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
                            <Plus className="w-4 h-4 mr-2" />
                            สร้างไอเดียแรก
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {linkedIdeas.map((idea) => (
                        <Card
                            key={idea.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => {
                                setSelectedIdea(idea);
                                setEditDialogOpen(true);
                            }}
                        >
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 shrink-0">
                                        <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h4 className="font-semibold line-clamp-1">
                                                {idea.title || "Untitled"}
                                            </h4>
                                            <Badge
                                                variant="secondary"
                                                className={getCategoryColor(idea.category)}
                                            >
                                                {idea.category || "general"}
                                            </Badge>
                                        </div>

                                        {idea.content && (
                                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                                {typeof idea.content === 'string'
                                                    ? idea.content
                                                    : ''}
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
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create Dialog */}
            <CreateIdeaDialog
                novelId={novelId}
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                defaultCategory={entityType}
                {...getDefaultLinkedIds()}
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

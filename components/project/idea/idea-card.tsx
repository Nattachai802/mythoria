"use client";

import { Idea } from "@/db/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MoreVertical, Pencil, Trash2, Lightbulb, BookOpen, Eye, CheckCircle2 } from "lucide-react";
import { deleteIdea } from "@/server/idea";
import { useState } from "react";
import { toast } from "sonner";
import { EditIdeaDialog } from "./edit-idea-dialog";

interface IdeaCardProps {
    idea: Idea;
    novelId: string;
    chapterInfo?: { id: string; title: string } | null;
}

export function IdeaCard({ idea, novelId, chapterInfo }: IdeaCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${idea.title}"?`)) {
            return;
        }

        setIsDeleting(true);
        const result = await deleteIdea(idea.id);

        if (result.success) {
            toast.success("Idea deleted successfully");
        } else {
            toast.error(result.error || "Failed to delete idea");
            setIsDeleting(false);
        }
    };

    const getPlainText = (content: any) => {
        if (typeof content === 'string') return content;
        return JSON.stringify(content).substring(0, 150);
    };

    const getFullContent = (content: any) => {
        if (typeof content === 'string') return content;
        return JSON.stringify(content, null, 2);
    };

    return (
        <>
            <Card
                className={`group hover:shadow-lg transition-all cursor-pointer ${idea.isUsed
                        ? 'opacity-60 bg-muted/50 border-dashed'
                        : ''
                    }`}
                onClick={() => setViewDialogOpen(true)}
            >
                <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className="mt-1">
                                <Lightbulb className="w-5 h-5 text-yellow-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className={`font-semibold text-lg truncate ${idea.isUsed ? 'text-muted-foreground' : ''}`}>
                                        {idea.title}
                                    </h3>
                                    {idea.isUsed && (
                                        <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200 shrink-0">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            ใช้แล้ว
                                        </Badge>
                                    )}
                                </div>

                                {/* Tags */}
                                <div className="flex gap-1 mt-2 flex-wrap">
                                    {/* Chapter Usage Badge */}
                                    {chapterInfo && (
                                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            <BookOpen className="w-3 h-3 mr-1" />
                                            ใช้ใน: {chapterInfo.title}
                                        </Badge>
                                    )}

                                    {/* User Tags */}
                                    {Array.isArray(idea.tags) && (idea.tags as string[]).map((tag, index) => (
                                        <Badge key={index} variant="secondary" className="text-xs">
                                            {tag}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setViewDialogOpen(true); }}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Full
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditDialogOpen(true); }}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                    disabled={isDeleting}
                                    className="text-red-600"
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>

                <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                        {getPlainText(idea.content)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {new Date(idea.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                        })}
                    </p>
                </CardContent>
            </Card>

            {/* View Full Dialog */}
            <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-yellow-500" />
                            {idea.title}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Tags */}
                    <div className="flex gap-1 flex-wrap">
                        {chapterInfo && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                <BookOpen className="w-3 h-3 mr-1" />
                                ใช้ใน: {chapterInfo.title}
                            </Badge>
                        )}
                        {Array.isArray(idea.tags) && (idea.tags as string[]).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                                {tag}
                            </Badge>
                        ))}
                    </div>

                    {/* Full Content */}
                    <div className="prose prose-sm max-w-none mt-4">
                        <div className="whitespace-pre-wrap text-sm leading-relaxed break-all">
                            {getFullContent(idea.content)}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                        <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                            Close
                        </Button>
                        <Button onClick={() => { setViewDialogOpen(false); setEditDialogOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <EditIdeaDialog
                idea={idea}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />
        </>
    );
}

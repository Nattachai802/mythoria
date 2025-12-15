"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, StickyNote, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CreateNoteDialog } from "@/components/project/create-note-dialog";
import { ChapterActions } from "@/components/project/chapter-actions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NOTES_PER_PAGE = 10;
const LINES_PER_PAGE = 35;
const CHARS_PER_LINE = 55;

/**
 * Calculate page count for a note's content
 */
function calculatePageCount(content: { text?: string } | null): number {
    if (!content?.text) return 0;

    const htmlContent = content.text;

    // Count explicit line breaks and block elements
    const blockTags = htmlContent.match(/<(p|br|li|h[1-6])[^>]*>/gi) || [];
    let lines = blockTags.length;

    // Get plain text
    const plainText = htmlContent
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

    // Estimate wrapped lines
    const estimatedWrapLines = Math.max(0, Math.floor(plainText.length / CHARS_PER_LINE) - lines);
    lines += estimatedWrapLines;

    // Minimum 1 line if there's content
    lines = Math.max(plainText.length > 0 ? 1 : 0, lines);

    return Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
}

interface ChapterRowProps {
    chapter: any;
    chapterNotes: any[];
    wordCount: number;
    novelId: string;
    index: number;
}

export function ChapterRow({
    chapter,
    chapterNotes,
    wordCount,
    novelId,
    index
}: ChapterRowProps) {
    const [currentPage, setCurrentPage] = useState(1);

    // Pagination logic
    const totalPages = Math.ceil(chapterNotes.length / NOTES_PER_PAGE);
    const startIndex = (currentPage - 1) * NOTES_PER_PAGE;
    const endIndex = startIndex + NOTES_PER_PAGE;
    const visibleNotes = chapterNotes.slice(startIndex, endIndex);
    const hasMorePages = totalPages > 1;

    // Calculate total plot holes for this chapter
    const totalPlotHoles = chapterNotes.reduce((sum, note) => sum + (note.plotHoleCount || 0), 0);

    return (
        <Collapsible className="group/chapter">
            <div className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {/* Chapter Number */}
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0">
                    {index}
                </div>

                {/* Expand Toggle */}
                {chapterNotes.length > 0 && (
                    <CollapsibleTrigger className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground shrink-0">
                        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/chapter:rotate-90" />
                    </CollapsibleTrigger>
                )}

                {/* Chapter Title */}
                <Link
                    href={`/dashboard/project/${novelId}/chapter/${chapter.id}`}
                    className="flex-1 min-w-0"
                >
                    <span className="font-medium hover:text-primary transition-colors truncate block">
                        {chapter.title}
                    </span>
                </Link>

                {/* Plot Hole Badge for Chapter */}
                {totalPlotHoles > 0 && (
                    <Tooltip>
                        <TooltipTrigger>
                            <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {totalPlotHoles}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            {totalPlotHoles} plot hole{totalPlotHoles > 1 ? 's' : ''} ในบทนี้
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Word Count */}
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {wordCount.toLocaleString()} words
                </span>

                {/* Notes Badge */}
                {chapterNotes.length > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                        {chapterNotes.length} notes
                    </Badge>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <CreateNoteDialog
                        novelId={novelId}
                        chapterId={chapter.id}
                        trigger={
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Add Note">
                                <Plus className="h-3 w-3" />
                            </Button>
                        }
                    />
                    <ChapterActions chapter={chapter} />
                </div>
            </div>

            {/* Notes Sublist */}
            {chapterNotes.length > 0 && (
                <CollapsibleContent className="border-l-2 border-muted ml-[52px] pl-4 pb-2">
                    {visibleNotes.map((note: any) => {
                        const pageCount = calculatePageCount(note.content);
                        const hasPlotHoles = (note.plotHoleCount || 0) > 0;
                        const isChecked = !!note.plotHoleCheckedAt;

                        return (
                            <Link
                                key={note.id}
                                href={`/dashboard/project/${novelId}/note/${note.id}`}
                                className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group/note"
                            >
                                <StickyNote className="h-3 w-3 shrink-0" />
                                <span className="truncate flex-1">{note.title}</span>

                                {/* Plot Hole Indicator */}
                                {hasPlotHoles ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="flex items-center gap-1 text-xs text-amber-500">
                                                <AlertTriangle className="h-3 w-3" />
                                                {note.plotHoleCount}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            พบ {note.plotHoleCount} plot hole
                                        </TooltipContent>
                                    </Tooltip>
                                ) : isChecked ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>ตรวจสอบแล้ว ไม่พบปัญหา</TooltipContent>
                                    </Tooltip>
                                ) : null}

                                {/* Page count indicator */}
                                <span className="flex items-center gap-1 text-xs opacity-60 group-hover/note:opacity-100 transition-opacity">
                                    <FileText className="h-3 w-3" />
                                    {pageCount} pg
                                </span>
                            </Link>
                        );
                    })}

                    {/* Pagination Controls */}
                    {hasMorePages && (
                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-muted">
                            <span className="text-xs text-muted-foreground">
                                {startIndex + 1}-{Math.min(endIndex, chapterNotes.length)} of {chapterNotes.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    <ChevronLeft className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground px-1">
                                    {currentPage}/{totalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CollapsibleContent>
            )}
        </Collapsible>
    );
}


"use client"

import { useState } from "react"
import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Chapter } from "@/db/schema"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
// Import Dialog ที่เราจะสร้างในขั้นตอนถัดไป
import { EditChapterDialog } from "./edit-chapter-dialog"
import { DeleteChapterDialog } from "./delete-chapter-dialog"

interface ChapterActionsProps {
    chapter: Chapter
}

export function ChapterActions({ chapter }: ChapterActionsProps) {
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-3.5 w-3.5" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setShowEditDialog(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                        onSelect={() => setShowDeleteDialog(true)}
                        className="text-destructive focus:text-destructive"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* ใส่ Dialog ไว้ตรงนี้ เพื่อให้ State ควบคุมการเปิดปิดได้ */}
            <EditChapterDialog 
                chapter={chapter} 
                open={showEditDialog} 
                onOpenChange={setShowEditDialog} 
            />

            <DeleteChapterDialog 
                chapter={chapter} 
                open={showDeleteDialog} 
                onOpenChange={setShowDeleteDialog} 
            />
        </>
    )
}
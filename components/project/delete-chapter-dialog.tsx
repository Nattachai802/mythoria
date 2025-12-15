"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteChapter } from "@/server/chapter"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Chapter } from "@/db/schema"

interface DeleteChapterDialogProps {
    chapter: Chapter
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DeleteChapterDialog({ chapter, open, onOpenChange }: DeleteChapterDialogProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const onDelete = () => {
        startTransition(async () => {
            const result = await deleteChapter(chapter.id)
            if (result.success) {
                toast.success("Chapter deleted")
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error("Failed to delete")
            }
        })
    }

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete "{chapter.title}".
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => { e.preventDefault(); onDelete(); }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isPending}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
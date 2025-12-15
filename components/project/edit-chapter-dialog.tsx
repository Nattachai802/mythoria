"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateChapter } from "@/server/chapter" // ตรวจสอบ path ให้ตรงกับไฟล์ server action ของคุณ
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Chapter } from "@/db/schema"

interface EditChapterDialogProps {
    chapter: Chapter
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EditChapterDialog({ chapter, open, onOpenChange }: EditChapterDialogProps) {
    const router = useRouter()
    const [title, setTitle] = useState(chapter.title)
    const [isPending, startTransition] = useTransition()

    // Update title state when chapter prop changes
    useEffect(() => {
        setTitle(chapter.title)
    }, [chapter])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        startTransition(async () => {
            const result = await updateChapter(chapter.id, { title })
            if (result.success) {
                toast.success("Chapter updated")
                onOpenChange(false)
                router.refresh()
            } else {
                toast.error("Failed to update")
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit Chapter</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={isPending}>Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
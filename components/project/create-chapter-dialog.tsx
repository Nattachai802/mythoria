"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { createChapter } from "@/server/chapter" // สังเกต path sever (ตามที่คุณใช้)
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateChapterDialogProps {
    novelId: string
}

export function CreateChapterDialog({ novelId }: CreateChapterDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [isPending, startTransition] = useTransition()

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim()) {
            toast.error("Please enter a chapter title")
            return
        }

        startTransition(async () => {
            const result = await createChapter(novelId, title)

            if (result.success && result.chapter) {
                toast.success("Chapter created successfully")
                setOpen(false)
                setTitle("")
                router.refresh()
                // ไม่ redirect ไปหน้าอื่น ให้อยู่หน้าเดิม
            } else {
                toast.error(result.message || "Failed to create chapter")
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Chapter
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Chapter</DialogTitle>
                        <DialogDescription>
                            Give your chapter a title to get started. You can change this later.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="title" className="text-right">
                                Title
                            </Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. The Beginning"
                                className="col-span-3"
                                disabled={isPending}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
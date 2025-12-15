"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createTimelineEvent } from "@/server/timeline"
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
import { Textarea } from "@/components/ui/textarea"

interface CreateSceneDialogProps {
    novelId: string
    chapterId: string
    trigger?: React.ReactNode
}

export function CreateSceneDialog({ novelId, chapterId, trigger }: CreateSceneDialogProps) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [isPending, startTransition] = useTransition()

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim()) {
            toast.error("Please enter a scene title")
            return
        }

        startTransition(async () => {
            const result = await createTimelineEvent({
                novelId,
                relatedChapterId: chapterId,
                title,
                description,
                orderIndex: 0 // Server calculates correct index
            })

            if (result.success) {
                toast.success("Scene created successfully")
                setOpen(false)
                setTitle("")
                setDescription("")
                router.refresh()
            } else {
                toast.error(result.error || "Failed to create scene")
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground hover:text-primary">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Scene
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={onSubmit}>
                    <DialogHeader>
                        <DialogTitle>Create New Scene</DialogTitle>
                        <DialogDescription>
                            Add a new scene to this chapter.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Hero meets Villain"
                                disabled={isPending}
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Brief description of what happens..."
                                disabled={isPending}
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

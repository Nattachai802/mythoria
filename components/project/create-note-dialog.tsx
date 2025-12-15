"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createNote } from "@/server/note"
import { toast } from "sonner"

interface CreateNoteDialogProps {
    novelId: string
    chapterId?: string
    trigger?: React.ReactNode
}

export function CreateNoteDialog({ novelId, chapterId, trigger }: CreateNoteDialogProps) {
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    async function handleCreate() {
        if (loading) return
        setLoading(true)

        try {
            const result = await createNote({
                title: "Untitled Note",
                content: { text: "" }, // Default empty content
                novelId,
                linkedToChapterId: chapterId,
                type: "general"
            })

            if (result.success) {
                toast.success("Note created successfully")
                router.refresh()
            } else {
                toast.error(result.message)
            }
        } catch (error) {
            toast.error("Something went wrong")
        } finally {
            setLoading(false)
        }
    }

    if (trigger) {
        return (
            <div onClick={handleCreate} className="cursor-pointer">
                {trigger}
            </div>
        )
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-5 text-[10px] ml-auto px-2"
            onClick={handleCreate}
            disabled={loading}
        >
            <Plus className="mr-1 h-2.5 w-2.5" />
            {loading ? "Adding..." : "Add"}
        </Button>
    )
}

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Sparkles, BookType, AlignLeft, FileInput } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { createNovel } from "@/server/novel"
import { toast } from "sonner"

export function CreateProjectButton({ userId }: { userId: string }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [importBible, setImportBible] = useState(false)
    const router = useRouter()

    async function onSubmit(formData: FormData) {
        setLoading(true)
        const title = formData.get("title") as string
        const description = formData.get("description") as string
        const genre = formData.get("genre") as string

        if (!title) {
            toast.error("Please enter a title")
            setLoading(false)
            return
        }

        const result = await createNovel({
            title,
            description,
            genre: genre || "fantasy",
            userId,
            status: "draft",
            visibility: "private",
        })

        if (result.success) {
            toast.success("Project created successfully")
            setOpen(false)
            // เตรียมข้อมูลจาก Story Bible → พาไปหน้า import ต่อ (reuse flow เดิม)
            if (importBible && result.novel) {
                router.push(`/dashboard/project/${result.novel.id}/import-bible`)
            } else {
                router.refresh()
            }
        } else {
            toast.error(result.message)
        }
        setLoading(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:shadow-md">
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] gap-6">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold tracking-tight">Create Project</DialogTitle>
                    <DialogDescription>
                        Begin your storytelling journey. Fill in the details below.
                    </DialogDescription>
                </DialogHeader>
                <form action={onSubmit} className="grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                            <BookType className="w-3.5 h-3.5 text-muted-foreground" />
                            Title
                        </Label>
                        <Input
                            id="title"
                            name="title"
                            placeholder="e.g. The Lost Kingdom"
                            className="h-10"
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="genre" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
                            Genre
                        </Label>
                        <Input
                            id="genre"
                            name="genre"
                            placeholder="e.g. Fantasy, Sci-Fi"
                            className="h-10"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                            <AlignLeft className="w-3.5 h-3.5 text-muted-foreground" />
                            Description
                        </Label>
                        <textarea
                            id="description"
                            name="description"
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                            placeholder="Briefly describe your story..."
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => setImportBible(v => !v)}
                        className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${importBible ? "border-primary bg-primary/5" : "border-input hover:bg-muted/40"}`}
                    >
                        <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border ${importBible ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                            {importBible && <span className="h-1.5 w-1.5 rounded-sm bg-primary-foreground" />}
                        </span>
                        <span className="flex-1">
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                                <FileInput className="h-3.5 w-3.5 text-muted-foreground" />
                                เตรียมข้อมูลจาก Story Bible
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                มีเอกสารไบเบิลอยู่แล้ว? สร้างเสร็จจะพาไปสกัดตัวละคร/ตระกูล/ผี/ระบบ ให้อัตโนมัติ
                            </span>
                        </span>
                    </button>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Project"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Save } from "lucide-react";
import { updateNovel } from "@/server/novel";

interface EditProjectDialogProps {
    novelId: string;
    initialTitle: string;
    initialDescription: string;
    trigger?: React.ReactNode;
}

export function EditProjectDialog({
    novelId,
    initialTitle,
    initialDescription,
    trigger,
}: EditProjectDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState(initialTitle);
    const [description, setDescription] = useState(initialDescription);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Title is required");
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await updateNovel(novelId, {
                title: title.trim(),
                description: description.trim() || null,
            });

            if (result.success) {
                toast.success("Project updated successfully");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(result.message || "Failed to update project");
            }
        } catch (error) {
            console.error("Update error:", error);
            toast.error("An error occurred while updating");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen) {
            // Reset form when opening
            setTitle(initialTitle);
            setDescription(initialDescription);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Details
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Project</DialogTitle>
                    <DialogDescription>
                        Update your project's title and description
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Project Title</Label>
                        <Input
                            id="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter project title"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Enter project description"
                            rows={4}
                            disabled={isSubmitting}
                        />
                        <p className="text-sm text-muted-foreground">
                            A brief summary of your project
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            <Save className="h-4 w-4 mr-2" />
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Note } from "@/db/schema";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateIdea } from "@/server/idea";
import { toast } from "sonner";

const ideaSchema = z.object({
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    tags: z.string().optional(),
});

type IdeaFormData = z.infer<typeof ideaSchema>;

interface EditIdeaDialogProps {
    idea: Note;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditIdeaDialog({ idea, open, onOpenChange }: EditIdeaDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getContentString = (content: any): string => {
        if (typeof content === 'string') return content;
        return '';
    };

    const getTagsString = (tags: any): string => {
        if (Array.isArray(tags)) return tags.join(', ');
        return '';
    };

    const form = useForm<IdeaFormData>({
        resolver: zodResolver(ideaSchema),
        defaultValues: {
            title: idea.title,
            content: getContentString(idea.content),
            tags: getTagsString(idea.tags),
        },
    });

    // Reset form when idea changes
    useEffect(() => {
        if (open) {
            form.reset({
                title: idea.title,
                content: getContentString(idea.content),
                tags: getTagsString(idea.tags),
            });
        }
    }, [idea, open]);

    const onSubmit = async (data: IdeaFormData) => {
        setIsSubmitting(true);

        // Convert tags string to array
        const tagsArray = data.tags
            ? data.tags.split(",").map(tag => tag.trim()).filter(Boolean)
            : [];

        const result = await updateIdea(idea.id, {
            title: data.title,
            content: data.content,
            tags: tagsArray,
        });

        if (result.success) {
            toast.success("Idea updated successfully");
            onOpenChange(false);
        } else {
            toast.error(result.error || "Failed to update idea");
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Idea</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Idea title" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Content *</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Describe your idea..."
                                            className="min-h-[200px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tags</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="tag1, tag2, tag3"
                                            {...field}
                                        />
                                    </FormControl>
                                    <p className="text-xs text-muted-foreground">
                                        Separate tags with commas
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

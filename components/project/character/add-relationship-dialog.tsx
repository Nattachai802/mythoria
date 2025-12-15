"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createCharacterRelationship, getCharactersByNovelId } from "@/server/character";
import { toast } from "sonner";
import { Character } from "@/db/schema";
import { RELATIONSHIP_TYPES } from "./relationship-constants";

const relationshipSchema = z.object({
    targetCharacterId: z.string().min(1, "Please select a character"),
    type: z.string().min(1, "Type is required"),
    description: z.string().optional(),
});

type RelationshipFormData = z.infer<typeof relationshipSchema>;

interface AddRelationshipDialogProps {
    novelId: string;
    sourceCharacterId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function AddRelationshipDialog({
    novelId,
    sourceCharacterId,
    open,
    onOpenChange,
    onSuccess,
}: AddRelationshipDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [characters, setCharacters] = useState<Character[]>([]);

    const form = useForm<RelationshipFormData>({
        resolver: zodResolver(relationshipSchema),
        defaultValues: {
            targetCharacterId: "",
            type: "Friend",
            description: "",
        },
    });

    useEffect(() => {
        if (open) {
            const fetchCharacters = async () => {
                const result = await getCharactersByNovelId(novelId);
                if (result.success && result.data) {
                    // Filter out the current character (cannot have relationship with self)
                    setCharacters(result.data.filter((c) => c.id !== sourceCharacterId));
                }
            };
            fetchCharacters();
            form.reset();
        }
    }, [open, novelId, sourceCharacterId, form]);

    const onSubmit = async (data: RelationshipFormData) => {
        setIsSubmitting(true);
        const result = await createCharacterRelationship({
            novelId,
            sourceCharacterId,
            targetCharacterId: data.targetCharacterId,
            type: data.type,
            description: data.description,
        });

        if (result.success) {
            toast.success("Relationship added successfully");
            onOpenChange(false);
            onSuccess?.();
        } else {
            toast.error(result.error || "Failed to add relationship");
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Relationship</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="targetCharacterId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Related Character</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a character" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {characters.length === 0 ? (
                                                <div className="p-2 text-sm text-muted-foreground text-center">No other characters found</div>
                                            ) : (
                                                characters.map((char) => (
                                                    <SelectItem key={char.id} value={char.id}>
                                                        {char.name}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Relationship Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {RELATIONSHIP_TYPES.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {type}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Childhood friends" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-2 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Adding..." : "Add Relationship"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

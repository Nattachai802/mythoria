"use client";

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateLocation } from "@/server/locations";
import { toast } from "sonner";
import { Location } from "@/db/schema";

const locationSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    parentLocationId: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface EditLocationDialogProps {
    location: Location;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditLocationDialog({
    location,
    open,
    onOpenChange,
}: EditLocationDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<LocationFormData>({
        resolver: zodResolver(locationSchema),
        defaultValues: {
            name: location.name,
            type: location.type || "",
            description: location.description || "",
            image: location.image || "",
            parentLocationId: location.parentLocationId || "",
        },
    });

    // Reset form when location changes
    useEffect(() => {
        form.reset({
            name: location.name,
            type: location.type || "",
            description: location.description || "",
            image: location.image || "",
            parentLocationId: location.parentLocationId || "",
        });
    }, [location, form]);

    const onSubmit = async (data: LocationFormData) => {
        setIsSubmitting(true);
        const result = await updateLocation(location.id, data);

        if (result.success) {
            toast.success("Location updated successfully");
            onOpenChange(false);
        } else {
            toast.error(result.error || "Failed to update location");
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Location</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Location name" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="city">City</SelectItem>
                                            <SelectItem value="country">Country</SelectItem>
                                            <SelectItem value="building">Building</SelectItem>
                                            <SelectItem value="forest">Forest</SelectItem>
                                            <SelectItem value="mountain">Mountain</SelectItem>
                                            <SelectItem value="ocean">Ocean</SelectItem>
                                            <SelectItem value="desert">Desert</SelectItem>
                                            <SelectItem value="village">Village</SelectItem>
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
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Describe this location..."
                                            className="min-h-[150px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Image URL</FormLabel>
                                    <FormControl>
                                        <Input placeholder="https://..." {...field} />
                                    </FormControl>
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

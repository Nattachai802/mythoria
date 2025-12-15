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
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
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
import { Plus } from "lucide-react";
import { createLocation, getLocationsByNovelId, validateLocationDepth } from "@/server/locations";
import { toast } from "sonner";

const locationSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    parentLocationId: z.string().optional(),
});

type LocationFormData = z.infer<typeof locationSchema>;

interface CreateLocationDialogProps {
    novelId: string;
}

export function CreateLocationDialog({ novelId }: CreateLocationDialogProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [locations, setLocations] = useState<any[]>([]);
    const [validParents, setValidParents] = useState<any[]>([]);

    const form = useForm<LocationFormData>({
        resolver: zodResolver(locationSchema),
        defaultValues: {
            name: "",
            type: "",
            description: "",
            image: "",
            parentLocationId: "",
        },
    });

    // Fetch locations when dialog opens
    useEffect(() => {
        if (open) {
            fetchLocations();
        }
    }, [open]);

    const fetchLocations = async () => {
        const result = await getLocationsByNovelId(novelId);
        if (result.success && result.data) {
            setLocations(result.data);
            // Filter locations that can be parents (not at max depth)
            const canBeParents = result.data.filter((loc: any) => {
                // Calculate depth
                let depth = 0;
                let current = loc;
                while (current.parentLocationId && depth < 3) {
                    current = result.data.find((l: any) => l.id === current.parentLocationId);
                    if (!current) break;
                    depth++;
                }
                return depth < 2; // Can only be parent if depth is 0 or 1
            });
            setValidParents(canBeParents);
        }
    };

    const onSubmit = async (data: LocationFormData) => {
        // Validate depth if parent is selected
        if (data.parentLocationId) {
            const validation = await validateLocationDepth(data.parentLocationId);
            if (!validation.valid) {
                toast.error(validation.error || "Cannot add sub-location here");
                return;
            }
        }

        setIsSubmitting(true);
        const result = await createLocation({
            ...data,
            novelId,
        });

        if (result.success) {
            toast.success("Location created successfully");
            setOpen(false);
            form.reset();
        } else {
            toast.error(result.error || "Failed to create location");
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Location
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Location</DialogTitle>
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
                            name="parentLocationId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Parent Location (Optional)</FormLabel>
                                    <Select
                                        onValueChange={(value) => field.onChange(value === 'none' ? '' : value)}
                                        defaultValue={field.value || 'none'}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="None (Root location)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">None (Root location)</SelectItem>
                                            {validParents.map((loc) => (
                                                <SelectItem key={loc.id} value={loc.id}>
                                                    {loc.name}
                                                    {loc.parentLocation && ` (in ${loc.parentLocation.name})`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Select a parent to create a sub-location (max 3 levels)
                                    </FormDescription>
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                onClick={() => setOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Creating..." : "Create Location"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

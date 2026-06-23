"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";
import { createFaction, getFactionsByNovelId, addCharacterToFaction } from "@/server/factions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const assignSchema = z.object({
    factionId: z.string().min(1, "Please select a faction"),
    role: z.string().optional(),
});

const createSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.string().optional(),
    role: z.string().optional(), // Role in the new faction
});

interface ManageFactionDialogProps {
    novelId: string;
    characterId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function ManageFactionDialog({
    novelId,
    characterId,
    open,
    onOpenChange,
    onSuccess,
}: ManageFactionDialogProps) {
    const [activeTab, setActiveTab] = useState("join");
    const [factions, setFactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const assignForm = useForm<z.infer<typeof assignSchema>>({
        resolver: zodResolver(assignSchema),
        defaultValues: {
            factionId: "",
            role: "Member",
        },
    });

    const createForm = useForm<z.infer<typeof createSchema>>({
        resolver: zodResolver(createSchema),
        defaultValues: {
            name: "",
            type: "Group",
            role: "Leader",
        },
    });

    useEffect(() => {
        if (open) {
            const fetchFactions = async () => {
                setIsLoading(true);
                const result = await getFactionsByNovelId(novelId);
                if (result.success && result.data) {
                    setFactions(result.data);
                }
                setIsLoading(false);
            };
            fetchFactions();
            assignForm.reset();
            createForm.reset();
        }
    }, [open, novelId, assignForm, createForm]);

    const onAssignSubmit = async (data: z.infer<typeof assignSchema>) => {
        setIsSubmitting(true);
        const result = await addCharacterToFaction({
            factionId: data.factionId,
            characterId,
            role: data.role,
            novelId,
        });

        if (result.success) {
            toast.success("Joined faction successfully");
            onOpenChange(false);
            onSuccess?.();
            console.log("Joined faction");
        } else {
            toast.error(result.error || "Failed to join faction");
        }
        setIsSubmitting(false);
    };

    const onCreateSubmit = async (data: z.infer<typeof createSchema>) => {
        setIsSubmitting(true);
        // 1. Create Faction
        const factionResult = await createFaction({
            name: data.name,
            type: data.type,
            novelId,
        });

        if (factionResult.success && factionResult.data) {
            // 2. Add Character to new Faction
            const joinResult = await addCharacterToFaction({
                factionId: factionResult.data.id,
                characterId,
                role: data.role,
                novelId,
            });

            if (joinResult.success) {
                toast.success("Faction created and joined");
                onOpenChange(false);
                onSuccess?.();
            } else {
                toast.error("Faction created but failed to join");
                // Refresh list at least
                onSuccess?.();
            }
        } else {
            toast.error(factionResult.error || "Failed to create faction");
        }
        setIsSubmitting(false);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[425px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Manage Faction</SheetTitle>
                    <SheetDescription>
                        Assign this character to a faction or create a new one.
                    </SheetDescription>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="join">Join Existing</TabsTrigger>
                        <TabsTrigger value="create">Create New</TabsTrigger>
                    </TabsList>

                    <TabsContent value="join">
                        <Form {...assignForm}>
                            <form onSubmit={assignForm.handleSubmit(onAssignSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={assignForm.control}
                                    name="factionId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Faction</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger disabled={isLoading}>
                                                        <SelectValue placeholder={isLoading ? "Loading..." : "Select a faction"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {factions.length === 0 ? (
                                                        <div className="p-2 text-sm text-center text-muted-foreground">
                                                            No factions found. Create one first!
                                                        </div>
                                                    ) : (
                                                        factions.map((f) => (
                                                            <SelectItem key={f.id} value={f.id}>
                                                                {f.name}
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
                                    control={assignForm.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Role in Faction</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. Member, Commander" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <SheetFooter>
                                    <Button type="submit" disabled={isSubmitting || factions.length === 0}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Join Faction
                                    </Button>
                                </SheetFooter>
                            </form>
                        </Form>
                    </TabsContent>

                    <TabsContent value="create">
                        <Form {...createForm}>
                            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={createForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Faction Name</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. The Night Watch" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={createForm.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Type</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. Guild, Kingdom, Family" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={createForm.control}
                                    name="role"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Initial Role</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="e.g. Founder, Leader" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <SheetFooter>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create & Join
                                    </Button>
                                </SheetFooter>
                            </form>
                        </Form>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}

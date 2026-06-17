"use client";

import { useState } from "react";
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
import { Plus, Zap, X } from "lucide-react";
import { createPower } from "@/server/power";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const powerSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    type: z.string().default("special"),
    rarity: z.string().default("common"),
    maxLevel: z.coerce.number().min(1).max(100).default(10),
    icon: z.string().optional(),
    color: z.string().optional(),
    limitations: z.array(z.string()).optional(),
});

type PowerFormData = z.infer<typeof powerSchema>;

interface CreatePowerDialogProps {
    novelId: string;
    trigger?: React.ReactNode;
}

const powerTypes = [
    { value: "elemental", label: "🔥 Elemental" },
    { value: "physical", label: "💪 Physical" },
    { value: "mental", label: "🧠 Mental" },
    { value: "support", label: "💚 Support" },
    { value: "special", label: "✨ Special" },
];

const rarityOptions = [
    { value: "common", label: "Common", color: "#64748b" },
    { value: "rare", label: "Rare", color: "#3b82f6" },
    { value: "epic", label: "Epic", color: "#a855f7" },
    { value: "legendary", label: "Legendary", color: "#f59e0b" },
];

export function CreatePowerDialog({ novelId, trigger }: CreatePowerDialogProps) {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PowerFormData>({
        resolver: zodResolver(powerSchema) as any,
        defaultValues: {
            name: "",
            description: "",
            type: "special",
            rarity: "common",
            maxLevel: 10,
            icon: "",
            color: "#3b82f6",
            limitations: [],
        },
    });

    const [newLimitation, setNewLimitation] = useState("");

    const onSubmit = async (data: PowerFormData) => {
        setIsSubmitting(true);

        const result = await createPower({
            ...data,
            novelId,
        });

        if (result.success) {
            toast.success("Power created successfully");
            setOpen(false);
            form.reset();
        } else {
            toast.error(result.error || "Failed to create power");
        }
        setIsSubmitting(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="chamfered-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        สร้างพลังใหม่
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Create New Power
                    </DialogTitle>
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
                                        <Input placeholder="Fire Manipulation" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
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
                                                {powerTypes.map((type) => (
                                                    <SelectItem key={type.value} value={type.value}>
                                                        {type.label}
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
                                name="rarity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rarity</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select rarity" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {rarityOptions.map((rarity) => (
                                                    <SelectItem key={rarity.value} value={rarity.value}>
                                                        <span style={{ color: rarity.color }}>★</span> {rarity.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="maxLevel"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Max Level</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={1} max={100} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="color"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Theme Color</FormLabel>
                                        <FormControl>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="color"
                                                    className="w-12 h-10 p-1 cursor-pointer"
                                                    {...field}
                                                />
                                                <Input
                                                    placeholder="#3b82f6"
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    className="flex-1"
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="icon"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Icon (Emoji)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="🔥 or ⚡" {...field} />
                                    </FormControl>
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
                                            placeholder="Describe this power..."
                                            className="min-h-[80px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Limitations Field */}
                        <FormField
                            control={form.control}
                            name="limitations"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>ข้อจำกัดของพลัง (Limitations)</FormLabel>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="เช่น ใช้ได้เฉพาะตอนกลางคืน"
                                                value={newLimitation}
                                                onChange={(e) => setNewLimitation(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        if (newLimitation.trim()) {
                                                            field.onChange([...(field.value || []), newLimitation.trim()]);
                                                            setNewLimitation("");
                                                        }
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => {
                                                    if (newLimitation.trim()) {
                                                        field.onChange([...(field.value || []), newLimitation.trim()]);
                                                        setNewLimitation("");
                                                    }
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {field.value && field.value.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {field.value.map((limitation, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="secondary"
                                                        className="flex items-center gap-1"
                                                    >
                                                        <span>⚠️ {limitation}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newLimitations = field.value?.filter((_, i) => i !== index);
                                                                field.onChange(newLimitations);
                                                            }}
                                                            className="ml-1 hover:bg-muted rounded-full"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
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
                                {isSubmitting ? "Creating..." : "Create Power"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

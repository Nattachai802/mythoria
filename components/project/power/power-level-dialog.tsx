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
import { Plus, X } from "lucide-react";
import { addPowerLevel, updatePowerLevel } from "@/server/power";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PowerLevel } from "@/db/schema";

const powerLevelSchema = z.object({
    level: z.coerce.number().min(1, "Level must be at least 1"),
    name: z.string().optional(),
    description: z.string().optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
    changes: z.array(z.string()).optional(),
    powerBoost: z.coerce.number().optional(),
    cooldown: z.coerce.number().optional(),
    manaCost: z.coerce.number().optional(),
});

type PowerLevelFormData = z.infer<typeof powerLevelSchema>;

interface PowerLevelDialogProps {
    powerId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingLevel?: PowerLevel | null;
    nextLevel?: number;
    onSuccess?: () => void;
}

export function PowerLevelDialog({
    powerId,
    open,
    onOpenChange,
    editingLevel,
    nextLevel = 1,
    onSuccess,
}: PowerLevelDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newPro, setNewPro] = useState("");
    const [newCon, setNewCon] = useState("");
    const [newChange, setNewChange] = useState("");

    const isEditing = !!editingLevel;

    const form = useForm<PowerLevelFormData>({
        resolver: zodResolver(powerLevelSchema) as any,
        defaultValues: {
            level: editingLevel?.level || nextLevel,
            name: editingLevel?.name || "",
            description: editingLevel?.description || "",
            pros: (editingLevel?.pros as string[]) || [],
            cons: (editingLevel?.cons as string[]) || [],
            changes: ((editingLevel as any)?.changes as string[]) || [],
            powerBoost: editingLevel?.powerBoost || undefined,
            cooldown: editingLevel?.cooldown || undefined,
            manaCost: editingLevel?.manaCost || undefined,
        },
    });

    // Reset form when dialog opens with new data
    const handleOpenChange = (newOpen: boolean) => {
        if (newOpen) {
            form.reset({
                level: editingLevel?.level || nextLevel,
                name: editingLevel?.name || "",
                description: editingLevel?.description || "",
                pros: (editingLevel?.pros as string[]) || [],
                cons: (editingLevel?.cons as string[]) || [],
                changes: ((editingLevel as any)?.changes as string[]) || [],
                powerBoost: editingLevel?.powerBoost || undefined,
                cooldown: editingLevel?.cooldown || undefined,
                manaCost: editingLevel?.manaCost || undefined,
            });
            setNewPro("");
            setNewCon("");
            setNewChange("");
        }
        onOpenChange(newOpen);
    };

    const onSubmit = async (data: PowerLevelFormData) => {
        setIsSubmitting(true);

        try {
            if (isEditing && editingLevel) {
                const result = await updatePowerLevel(editingLevel.id, {
                    name: data.name,
                    description: data.description,
                    pros: data.pros,
                    cons: data.cons,
                    changes: data.changes,
                    powerBoost: data.powerBoost,
                    cooldown: data.cooldown,
                    manaCost: data.manaCost,
                });

                if (result.success) {
                    toast.success("Level updated successfully");
                    onOpenChange(false);
                    onSuccess?.();
                } else {
                    toast.error(result.error || "Failed to update level");
                }
            } else {
                const result = await addPowerLevel({
                    powerId,
                    level: data.level,
                    name: data.name,
                    description: data.description,
                    pros: data.pros,
                    cons: data.cons,
                    changes: data.changes,
                    powerBoost: data.powerBoost,
                    cooldown: data.cooldown,
                    manaCost: data.manaCost,
                });

                if (result.success) {
                    toast.success("Level added successfully");
                    onOpenChange(false);
                    form.reset();
                    onSuccess?.();
                } else {
                    toast.error(result.error || "Failed to add level");
                }
            }
        } catch (error) {
            toast.error("An error occurred");
        }

        setIsSubmitting(false);
    };

    const addItem = (
        field: "pros" | "cons" | "changes",
        value: string,
        setValue: (val: string) => void
    ) => {
        if (value.trim()) {
            const currentValue = form.getValues(field) || [];
            form.setValue(field, [...currentValue, value.trim()]);
            setValue("");
        }
    };

    const removeItem = (field: "pros" | "cons" | "changes", index: number) => {
        const currentValue = form.getValues(field) || [];
        form.setValue(
            field,
            currentValue.filter((_, i) => i !== index)
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? `Edit Level ${editingLevel.level}` : "Add Power Level"}
                    </DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="level"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Level *</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={1}
                                                {...field}
                                                disabled={isEditing}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>ชื่อระดับ</FormLabel>
                                        <FormControl>
                                            <Input placeholder="เช่น Novice, Master" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>คำอธิบาย</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="อธิบายความสามารถที่ระดับนี้..."
                                            className="min-h-[60px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Changes - สิ่งที่เปลี่ยนแปลงจากเลเวลก่อน */}
                        <FormField
                            control={form.control}
                            name="changes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        <span className="text-blue-600">🔄</span> การเปลี่ยนแปลง
                                    </FormLabel>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="เช่น เพิ่มระยะโจมตี 2 เท่า"
                                                value={newChange}
                                                onChange={(e) => setNewChange(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addItem("changes", newChange, setNewChange);
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => addItem("changes", newChange, setNewChange)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {field.value && field.value.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {field.value.map((item, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="outline"
                                                        className="flex items-center gap-1 text-blue-600 border-blue-200 bg-blue-50"
                                                    >
                                                        <span>↑ {item}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem("changes", index)}
                                                            className="ml-1 hover:bg-blue-100 rounded-full"
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

                        {/* Pros */}
                        <FormField
                            control={form.control}
                            name="pros"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        <span className="text-emerald-600">✓</span> ข้อดี
                                    </FormLabel>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="เพิ่มข้อดี..."
                                                value={newPro}
                                                onChange={(e) => setNewPro(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addItem("pros", newPro, setNewPro);
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => addItem("pros", newPro, setNewPro)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {field.value && field.value.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {field.value.map((pro, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="outline"
                                                        className="flex items-center gap-1 text-emerald-600 border-emerald-200 bg-emerald-50"
                                                    >
                                                        <span>✓ {pro}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem("pros", index)}
                                                            className="ml-1 hover:bg-emerald-100 rounded-full"
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

                        {/* Cons */}
                        <FormField
                            control={form.control}
                            name="cons"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        <span className="text-red-600">✗</span> ข้อเสีย
                                    </FormLabel>
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="เพิ่มข้อเสีย..."
                                                value={newCon}
                                                onChange={(e) => setNewCon(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addItem("cons", newCon, setNewCon);
                                                    }
                                                }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => addItem("cons", newCon, setNewCon)}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        {field.value && field.value.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {field.value.map((con, index) => (
                                                    <Badge
                                                        key={index}
                                                        variant="outline"
                                                        className="flex items-center gap-1 text-red-600 border-red-200 bg-red-50"
                                                    >
                                                        <span>✗ {con}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem("cons", index)}
                                                            className="ml-1 hover:bg-red-100 rounded-full"
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

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting
                                    ? "Saving..."
                                    : isEditing
                                        ? "Update Level"
                                        : "Add Level"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

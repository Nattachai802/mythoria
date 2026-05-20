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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateLocation, getLocationsByNovelId, validateLocationDepth } from "@/server/locations";
import { toast } from "sonner";
import { Location } from "@/db/schema";
import { X, Plus, Sparkles, AlertTriangle, MapPin, Users, Gem, Lock } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";

const locationSchema = z.object({
    name: z.string().min(1, "Name is required"),
    type: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    parentLocationId: z.string().optional(),
    // Immersive fields
    atmosphere: z.string().optional(),
    climate: z.string().optional(),
    inhabitants: z.string().optional(),
    secrets: z.string().optional(),
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
    const [allLocations, setAllLocations] = useState<any[]>([]);
    const [validParents, setValidParents] = useState<any[]>([]);
    const [highlights, setHighlights] = useState<string[]>((location as any).highlights || []);
    const [landmarks, setLandmarks] = useState<string[]>((location as any).landmarks || []);
    const [dangers, setDangers] = useState<string[]>((location as any).dangers || []);
    const [resources, setResources] = useState<string[]>((location as any).resources || []);

    const [newHighlight, setNewHighlight] = useState("");
    const [newLandmark, setNewLandmark] = useState("");
    const [newDanger, setNewDanger] = useState("");
    const [newResource, setNewResource] = useState("");

    const form = useForm<LocationFormData>({
        resolver: zodResolver(locationSchema),
        defaultValues: {
            name: location.name,
            type: location.type || "",
            description: location.description || "",
            image: location.image || "",
            parentLocationId: location.parentLocationId || "",
            atmosphere: (location as any).atmosphere || "",
            climate: (location as any).climate || "",
            inhabitants: (location as any).inhabitants || "",
            secrets: (location as any).secrets || "",
        },
    });

    // Fetch locations in the same project to populate Parent Location list
    useEffect(() => {
        if (open && location.novelId) {
            fetchLocations();
        }
    }, [open, location.novelId]);

    const fetchLocations = async () => {
        const result = await getLocationsByNovelId(location.novelId);
        if (result.success && result.data) {
            setAllLocations(result.data);
            
            // Build a list of descendants to prevent circular reference
            const descendants = new Set<string>();
            const getDescendants = (locId: string) => {
                const children = result.data.filter((l: any) => l.parentLocationId === locId);
                children.forEach((child: any) => {
                    descendants.add(child.id);
                    getDescendants(child.id);
                });
            };
            getDescendants(location.id);

            // Filter parent locations that are valid (not self, not descendants, parent depth < 2)
            const canBeParents = result.data.filter((loc: any) => {
                if (loc.id === location.id) return false;
                if (descendants.has(loc.id)) return false;

                let depth = 0;
                let current = loc;
                while (current.parentLocationId && depth < 3) {
                    current = result.data.find((l: any) => l.id === current.parentLocationId);
                    if (!current) break;
                    depth++;
                }
                return depth < 2;
            });
            setValidParents(canBeParents);
        }
    };

    // Reset form when location changes
    useEffect(() => {
        form.reset({
            name: location.name,
            type: location.type || "",
            description: location.description || "",
            image: location.image || "",
            parentLocationId: location.parentLocationId || "",
            atmosphere: (location as any).atmosphere || "",
            climate: (location as any).climate || "",
            inhabitants: (location as any).inhabitants || "",
            secrets: (location as any).secrets || "",
        });
        setHighlights((location as any).highlights || []);
        setLandmarks((location as any).landmarks || []);
        setDangers((location as any).dangers || []);
        setResources((location as any).resources || []);
    }, [location, form]);

    const addToList = (list: string[], setList: (v: string[]) => void, value: string, setValue: (v: string) => void) => {
        if (value.trim()) {
            setList([...list, value.trim()]);
            setValue("");
        }
    };

    const removeFromList = (list: string[], setList: (v: string[]) => void, index: number) => {
        setList(list.filter((_, i) => i !== index));
    };

    const onSubmit = async (data: LocationFormData) => {
        // Validate hierarchy depth when parentLocationId is changed
        if (data.parentLocationId && data.parentLocationId !== location.parentLocationId) {
            const validation = await validateLocationDepth(data.parentLocationId);
            if (!validation.valid) {
                toast.error(validation.error || "Cannot add sub-location here");
                return;
            }

            // Calculate the max depth of the current location's subtree
            const getSubtreeDepth = (locId: string): number => {
                const children = allLocations.filter((l: any) => l.parentLocationId === locId);
                if (children.length === 0) return 0;
                let maxChildDepth = 0;
                for (const child of children) {
                    maxChildDepth = Math.max(maxChildDepth, getSubtreeDepth(child.id));
                }
                return 1 + maxChildDepth;
            };

            // Calculate candidate parent's depth
            let parentDepth = 0;
            let current = allLocations.find(l => l.id === data.parentLocationId);
            while (current && current.parentLocationId) {
                current = allLocations.find(l => l.id === current.parentLocationId);
                parentDepth++;
            }

            const totalSubtreeDepth = parentDepth + 1 + getSubtreeDepth(location.id);
            if (totalSubtreeDepth > 2) {
                toast.error("การเปลี่ยนสถานที่หลักจะทำให้ระดับชั้นของกลุ่มสถานที่ย่อยเกินขีดจำกัดสูงสุด (3 ระดับ)");
                return;
            }
        }

        setIsSubmitting(true);
        const result = await updateLocation(location.id, {
            ...data,
            highlights: highlights.length > 0 ? highlights : undefined,
            landmarks: landmarks.length > 0 ? landmarks : undefined,
            dangers: dangers.length > 0 ? dangers : undefined,
            resources: resources.length > 0 ? resources : undefined,
        } as any);

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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Location</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <Tabs defaultValue="basic" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="basic">ข้อมูลพื้นฐาน</TabsTrigger>
                                <TabsTrigger value="immersive">บรรยากาศ</TabsTrigger>
                                <TabsTrigger value="details">รายละเอียด</TabsTrigger>
                            </TabsList>

                            {/* Basic Tab */}
                            <TabsContent value="basic" className="space-y-4 mt-4">
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
                                                value={field.value || 'none'}
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
                                                Select a parent to make this a sub-location (max 3 levels)
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
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="city">🏙️ City</SelectItem>
                                                    <SelectItem value="country">🗺️ Country</SelectItem>
                                                    <SelectItem value="building">🏛️ Building</SelectItem>
                                                    <SelectItem value="forest">🌲 Forest</SelectItem>
                                                    <SelectItem value="mountain">⛰️ Mountain</SelectItem>
                                                    <SelectItem value="ocean">🌊 Ocean</SelectItem>
                                                    <SelectItem value="desert">🏜️ Desert</SelectItem>
                                                    <SelectItem value="village">🏘️ Village</SelectItem>
                                                    <SelectItem value="dungeon">🏰 Dungeon</SelectItem>
                                                    <SelectItem value="cave">🕳️ Cave</SelectItem>
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
                                                    className="min-h-[100px]"
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
                                            <FormLabel>Location Image</FormLabel>
                                            <FormControl>
                                                <ImageUpload
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    folder="locations"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>

                            {/* Immersive Tab */}
                            <TabsContent value="immersive" className="space-y-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="atmosphere"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4" />
                                                บรรยากาศ
                                            </FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="เงียบสงบ มีหมอกบางๆ ลอยอยู่ตลอดเวลา..."
                                                    className="min-h-[80px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>อารมณ์และความรู้สึกของสถานที่</FormDescription>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="climate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>🌡️ สภาพอากาศ</FormLabel>
                                            <FormControl>
                                                <Input placeholder="หนาวเย็น หิมะตกตลอดปี" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* Highlights */}
                                <div className="space-y-2">
                                    <FormLabel className="flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-yellow-500" />
                                        จุดเด่น
                                    </FormLabel>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newHighlight}
                                            onChange={(e) => setNewHighlight(e.target.value)}
                                            placeholder="เช่น ต้นไม้ยักษ์พันปี"
                                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToList(highlights, setHighlights, newHighlight, setNewHighlight))}
                                        />
                                        <Button type="button" size="icon" onClick={() => addToList(highlights, setHighlights, newHighlight, setNewHighlight)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {highlights.map((item, i) => (
                                            <Badge key={i} variant="secondary" className="gap-1">
                                                ✨ {item}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(highlights, setHighlights, i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                {/* Landmarks */}
                                <div className="space-y-2">
                                    <FormLabel className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-blue-500" />
                                        จุดสังเกต
                                    </FormLabel>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newLandmark}
                                            onChange={(e) => setNewLandmark(e.target.value)}
                                            placeholder="เช่น หอคอยโบราณ"
                                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToList(landmarks, setLandmarks, newLandmark, setNewLandmark))}
                                        />
                                        <Button type="button" size="icon" onClick={() => addToList(landmarks, setLandmarks, newLandmark, setNewLandmark)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {landmarks.map((item, i) => (
                                            <Badge key={i} variant="outline" className="gap-1">
                                                📍 {item}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(landmarks, setLandmarks, i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </TabsContent>

                            {/* Details Tab */}
                            <TabsContent value="details" className="space-y-4 mt-4">
                                {/* Dangers */}
                                <div className="space-y-2">
                                    <FormLabel className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                        อันตราย
                                    </FormLabel>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newDanger}
                                            onChange={(e) => setNewDanger(e.target.value)}
                                            placeholder="เช่น มอนสเตอร์เร่ร่อน"
                                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToList(dangers, setDangers, newDanger, setNewDanger))}
                                        />
                                        <Button type="button" size="icon" variant="destructive" onClick={() => addToList(dangers, setDangers, newDanger, setNewDanger)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {dangers.map((item, i) => (
                                            <Badge key={i} variant="destructive" className="gap-1">
                                                ⚠️ {item}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(dangers, setDangers, i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="inhabitants"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Users className="h-4 w-4" />
                                                ผู้อาศัย
                                            </FormLabel>
                                            <FormControl>
                                                <Input placeholder="ชนเผ่าเอลฟ์และคนแคระ" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                {/* Resources */}
                                <div className="space-y-2">
                                    <FormLabel className="flex items-center gap-2">
                                        <Gem className="h-4 w-4 text-emerald-500" />
                                        ทรัพยากร
                                    </FormLabel>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newResource}
                                            onChange={(e) => setNewResource(e.target.value)}
                                            placeholder="เช่น แร่หายาก"
                                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToList(resources, setResources, newResource, setNewResource))}
                                        />
                                        <Button type="button" size="icon" onClick={() => addToList(resources, setResources, newResource, setNewResource)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {resources.map((item, i) => (
                                            <Badge key={i} className="gap-1 bg-emerald-500">
                                                💎 {item}
                                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeFromList(resources, setResources, i)} />
                                            </Badge>
                                        ))}
                                    </div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="secrets"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Lock className="h-4 w-4 text-purple-500" />
                                                ความลับ
                                            </FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="มีทางลับสู่โลกใต้ดินซ่อนอยู่..."
                                                    className="min-h-[80px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>ข้อมูลลึกลับที่ตัวละครอาจค้นพบ</FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                        </Tabs>

                        <div className="flex justify-end gap-2 pt-4 border-t">
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

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Palette,
    Trash2,
    Loader2,
    Plus,
    Tag,
    Layers,
    Scissors,
    Shirt,
    Gem,
    FolderHeart,
    HelpCircle,
    Info,
} from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CharacterDesignBoardProps {
    characterId: string;
    novelId: string;
}

interface DesignElement {
    id: string;
    type: string;
    value: string;
    name: string | null;
    notes: string | null;
}

const DEFAULT_CATEGORIES = [
    { value: "hairstyle", label: "ทรงผม", icon: <Scissors className="w-3.5 h-3.5" /> },
    { value: "clothing", label: "เสื้อผ้า / เครื่องแต่งกาย", icon: <Shirt className="w-3.5 h-3.5" /> },
    { value: "accessory", label: "เครื่องประดับ", icon: <Gem className="w-3.5 h-3.5" /> },
    { value: "other", label: "อื่นๆ (เช่น อาวุธ, อารมณ์)", icon: <HelpCircle className="w-3.5 h-3.5" /> },
];

export function CharacterDesignBoard({ characterId, novelId }: CharacterDesignBoardProps) {
    const [elements, setElements] = useState<DesignElement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");

    // Dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [refType, setRefType] = useState<"image" | "color">("image");

    // Form states
    const [imageUrl, setImageUrl] = useState("");
    const [imageName, setImageName] = useState("");
    const [imageCategory, setImageCategory] = useState("other");
    const [customCategory, setCustomCategory] = useState("");
    const [imageNotes, setImageNotes] = useState("");

    const [colorHex, setColorHex] = useState("#3b82f6");
    const [colorName, setColorName] = useState("");
    const [colorNotes, setColorNotes] = useState("");

    useEffect(() => {
        fetchElements();
    }, [characterId]);

    const fetchElements = async () => {
        try {
            const res = await fetch(`/api/novels/${novelId}/characters/${characterId}/design`);
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            setElements(data);
        } catch (error) {
            console.error(error);
            toast.error("ดึงข้อมูล Design Board ไม่สำเร็จ");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddElement = async (type: string, value: string, name?: string | null, notes?: string | null) => {
        try {
            const res = await fetch(`/api/novels/${novelId}/characters/${characterId}/design`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, value, name, notes }),
            });
            if (!res.ok) throw new Error("Failed to add");
            const newElement = await res.json();
            setElements([...elements, newElement]);
            toast.success("เพิ่มข้อมูลสำเร็จ");
        } catch (error) {
            console.error(error);
            toast.error("เพิ่มข้อมูลไม่สำเร็จ");
        }
    };

    const handleDeleteElement = async (id: string) => {
        try {
            const res = await fetch(`/api/novels/${novelId}/characters/${characterId}/design?elementId=${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to delete");
            setElements(elements.filter((el) => el.id !== id));
            toast.success("ลบข้อมูลสำเร็จ");
        } catch (error) {
            console.error(error);
            toast.error("ลบข้อมูลไม่สำเร็จ");
        }
    };

    const handleSubmitImage = async () => {
        if (!imageUrl) {
            toast.error("กรุณาอัปโหลดรูปภาพหรือระบุ URL รูปภาพ");
            return;
        }

        const finalCategory = imageCategory === "custom" ? customCategory.trim() : imageCategory;
        const resolvedCategory = finalCategory !== "" ? finalCategory : "other";

        await handleAddElement(resolvedCategory, imageUrl, imageName || null, imageNotes || null);

        // Reset
        setImageUrl("");
        setImageName("");
        setImageCategory("other");
        setCustomCategory("");
        setImageNotes("");
        setIsAddOpen(false);
    };

    const handleSubmitColor = async () => {
        if (!colorHex) {
            toast.error("กรุณาเลือกโทนสี");
            return;
        }

        await handleAddElement("color", colorHex, colorName || null, colorNotes || null);

        // Reset
        setColorHex("#3b82f6");
        setColorName("");
        setColorNotes("");
        setIsAddOpen(false);
    };

    // Helper functions for labels
    const getCategoryLabel = (type: string) => {
        const found = DEFAULT_CATEGORIES.find(c => c.value === type);
        if (found) return found.label;
        if (type === "color") return "โทนสี";
        return type; // Custom category label
    };

    const getCategoryBadgeClass = (type: string) => {
        switch (type) {
            case "hairstyle": return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
            case "clothing": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
            case "accessory": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
            case "color": return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20";
            default: return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
        }
    };

    // Extract unique categories (except color) for tabs
    const uniqueCategories = Array.from(new Set(elements.map(e => e.type))).filter(t => t !== "color");

    // Dynamic Filter lists
    const filterTabs = [
        { value: "all", label: "ทั้งหมด" },
        { value: "color", label: "โทนสี" },
        ...uniqueCategories.map(cat => ({
            value: cat,
            label: getCategoryLabel(cat)
        }))
    ];

    // Filtered elements to display
    const filteredElements = elements.filter(el => {
        if (activeFilter === "all") return true;
        return el.type === activeFilter;
    });

    const displayColors = filteredElements.filter(el => el.type === "color");
    const displayImages = filteredElements.filter(el => el.type !== "color");

    if (isLoading) {
        return (
            <div className="py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card/50 p-5 chamfered border border-border">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <FolderHeart className="w-6 h-6 text-primary" />
                        Visual Moodboard
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        รวบรวมเรฟเฟอเรนซ์ภาพถ่าย อารมณ์ อาวุธ โทนสี หรือเครื่องแต่งกายของตัวละครอย่างไร้ขีดจำกัด
                    </p>
                </div>

                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="shadow-md shrink-0 gap-1.5 transition-all hover:scale-[1.02]">
                            <Plus className="w-4 h-4" /> เพิ่มเรฟเฟอเรนซ์
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Plus className="w-5 h-5 text-primary" />
                                เพิ่มข้อมูลเรฟเฟอเรนซ์ใหม่
                            </DialogTitle>
                        </DialogHeader>

                        {/* Reference Type Selector */}
                        <div className="grid grid-cols-2 gap-2 p-1 bg-muted chamfered-sm text-sm mb-4">
                            <button
                                type="button"
                                onClick={() => setRefType("image")}
                                className={cn(
                                    "py-2 rounded-md font-medium transition-all",
                                    refType === "image" ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                อัปโหลดรูปภาพ
                            </button>
                            <button
                                type="button"
                                onClick={() => setRefType("color")}
                                className={cn(
                                    "py-2 rounded-md font-medium transition-all",
                                    refType === "color" ? "bg-background shadow-xs text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                โทนสี / Color Swatch
                            </button>
                        </div>

                        {/* Form for Image Reference */}
                        {refType === "image" ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">อัปโหลดรูปภาพเรฟเฟอเรนซ์</Label>
                                    <div className="flex justify-center p-1 bg-muted/20 border border-dashed chamfered-sm">
                                        <ImageUpload
                                            folder={`novels/${novelId}/characters/${characterId}/design`}
                                            onChange={setImageUrl}
                                            value={imageUrl}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="image-name" className="text-sm font-semibold">ชื่อเรฟเฟอเรนซ์ (Optional)</Label>
                                    <Input
                                        id="image-name"
                                        placeholder="เช่น ดาบศักดิ์สิทธิ์, ชุดเกราะหลัก"
                                        value={imageName}
                                        onChange={(e) => setImageName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">หมวดหมู่ (Optional)</Label>
                                    <Select value={imageCategory} onValueChange={setImageCategory}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="เลือกหมวดหมู่" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DEFAULT_CATEGORIES.map(cat => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    <span className="flex items-center gap-2">
                                                        {cat.icon}
                                                        {cat.label}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="custom">
                                                <span className="flex items-center gap-2 text-primary font-medium">
                                                    <Tag className="w-3.5 h-3.5" />
                                                    + กำหนดหมวดหมู่เอง (Custom)
                                                </span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {imageCategory === "custom" && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        <Label htmlFor="custom-category" className="text-sm font-semibold text-primary">ชื่อหมวดหมู่ที่ต้องการกำหนดเอง</Label>
                                        <Input
                                            id="custom-category"
                                            placeholder="เช่น อาวุธ, แววตา, ท่าทางตัวละคร"
                                            value={customCategory}
                                            onChange={(e) => setCustomCategory(e.target.value)}
                                            className="border-primary/40 focus-visible:ring-primary/30"
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="image-notes" className="text-sm font-semibold">บันทึกเพิ่มเติม (Optional)</Label>
                                    <Textarea
                                        id="image-notes"
                                        placeholder="รายละเอียดเพิ่มเติมของรูปภาพ..."
                                        value={imageNotes}
                                        onChange={(e) => setImageNotes(e.target.value)}
                                        rows={3}
                                    />
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button type="button" onClick={handleSubmitImage} className="w-full">
                                        บันทึกเรฟเฟอเรนซ์รูปภาพ
                                    </Button>
                                </DialogFooter>
                            </div>
                        ) : (
                            /* Form for Color Swatch */
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">เลือกโทนสี</Label>
                                    <div className="flex gap-3 items-center">
                                        <Input
                                            type="color"
                                            value={colorHex}
                                            onChange={(e) => setColorHex(e.target.value)}
                                            className="w-16 h-12 p-1 cursor-pointer shrink-0"
                                        />
                                        <Input
                                            value={colorHex}
                                            onChange={(e) => setColorHex(e.target.value)}
                                            className="font-mono uppercase"
                                            placeholder="#FFFFFF"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="color-name" className="text-sm font-semibold">ชื่อเรียกสี (Optional)</Label>
                                    <Input
                                        id="color-name"
                                        placeholder="เช่น สีผมตอนใช้เวท, แดงชาด"
                                        value={colorName}
                                        onChange={(e) => setColorName(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="color-notes" className="text-sm font-semibold">บันทึกเพิ่มเติม (Optional)</Label>
                                    <Textarea
                                        id="color-notes"
                                        placeholder="ระบุว่าสีนี้ใช้ในส่วนไหนของตัวละคร..."
                                        value={colorNotes}
                                        onChange={(e) => setColorNotes(e.target.value)}
                                        rows={3}
                                    />
                                </div>

                                <DialogFooter className="pt-2">
                                    <Button type="button" onClick={handleSubmitColor} className="w-full">
                                        บันทึกโทนสี
                                    </Button>
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>

            {/* Filter Navigation Bar */}
            {elements.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-border/30">
                    {filterTabs.map((tab) => (
                        <Button
                            key={tab.value}
                            variant={activeFilter === tab.value ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveFilter(tab.value)}
                            className={cn(
                                "rounded-full px-4 text-xs font-medium shrink-0",
                                activeFilter === tab.value ? "shadow-xs" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab.label}
                            <Badge className="ml-1.5 bg-black/10 text-current hover:bg-black/15 dark:bg-white/10 dark:hover:bg-white/15 px-1.5 py-0 h-4 border-none text-[10px]">
                                {tab.value === "all"
                                    ? elements.length
                                    : elements.filter(e => e.type === tab.value).length
                                }
                            </Badge>
                        </Button>
                    ))}
                </div>
            )}

            {/* Main Content Area */}
            {elements.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-20 bg-muted/15 rounded-3xl border border-dashed p-8">
                    <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                        <Palette className="w-8 h-8 text-primary/60" />
                    </div>
                    <h3 className="text-lg font-bold">ยังไม่มีเรฟเฟอเรนซ์ดีไซน์</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mt-2">
                        สร้างแรงบันดาลใจด้วยการอัปโหลดภาพ หรือบันทึกโทนสีของตัวละคร {characterId.slice(0, 4)} เพื่อช่วยไกด์ตอนแต่งนิยาย
                    </p>
                    <Button onClick={() => setIsAddOpen(true)} variant="outline" className="mt-5 gap-1.5">
                        <Plus className="w-4 h-4" /> เพิ่มเรฟเฟอเรนซ์แรก
                    </Button>
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-300">
                    {/* Color Swatches - Display inside a beautiful flex box if there are colors */}
                    {displayColors.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-md font-bold flex items-center gap-1.5 text-pink-500">
                                <Palette className="w-4 h-4" />
                                พาเลทโทนสี ({displayColors.length})
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {displayColors.map((color) => (
                                    <div
                                        key={color.id}
                                        className="group relative bg-card/50 border border-border chamfered p-3 flex items-center gap-4 transition-colors hover:border-[var(--forge-gold)]/40"
                                    >
                                        <div
                                            className="w-12 h-12 chamfered-sm border border-black/10 shrink-0 transition-transform duration-300 group-hover:scale-105"
                                            style={{ backgroundColor: color.value }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate text-foreground/90">
                                                {color.name || "Unnamed Color"}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground font-mono uppercase">
                                                {color.value}
                                            </p>
                                            {color.notes && (
                                                <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5" title={color.notes}>
                                                    {color.notes}
                                                </p>
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteElement(color.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Image references - Display inside a premium Pinterest-style moodboard grid */}
                    {displayImages.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-md font-bold flex items-center gap-1.5 text-primary">
                                <Layers className="w-4 h-4" />
                                รูปภาพและดีไซน์เรฟเฟอเรนซ์ ({displayImages.length})
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                {displayImages.map((img) => (
                                    <div
                                        key={img.id}
                                        className="group relative aspect-[3/4] chamfered overflow-hidden border border-border bg-muted transition-colors duration-300 hover:border-[var(--forge-gold)]/40"
                                    >
                                        {/* Image */}
                                        <img
                                            src={img.value}
                                            alt={img.name || "Design Reference"}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            loading="lazy"
                                        />

                                        {/* Default Gradient Title Overlay (Always visible when not hovered) */}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pt-12 text-white transition-opacity duration-300 group-hover:opacity-0">
                                            <p className="text-sm font-semibold truncate leading-none">
                                                {img.name || "ไม่ได้ตั้งชื่อ"}
                                            </p>
                                            <span className="text-[10px] text-white/70 mt-1.5 inline-block">
                                                {getCategoryLabel(img.type)}
                                            </span>
                                        </div>

                                        {/* Hover Details Overlay with premium backdrop-blur */}
                                        <div className="absolute inset-0 bg-black/70 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 p-5 flex flex-col justify-between text-white">
                                            {/* Top Metadata */}
                                            <div className="space-y-3">
                                                <Badge className={cn("border-none text-[10px] uppercase font-bold tracking-wider px-2 py-0.5", getCategoryBadgeClass(img.type))}>
                                                    {getCategoryLabel(img.type)}
                                                </Badge>

                                                <div className="space-y-1.5">
                                                    <h4 className="text-base font-bold leading-tight line-clamp-2">
                                                        {img.name || "ไม่ได้ตั้งชื่อ"}
                                                    </h4>
                                                    {img.notes && (
                                                        <p className="text-xs text-slate-200/90 leading-relaxed font-light line-clamp-5 whitespace-pre-wrap">
                                                            {img.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Bottom Action Button */}
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDeleteElement(img.id)}
                                                className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 active:scale-[0.98] transition-transform"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                ลบเรฟเฟอเรนซ์
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

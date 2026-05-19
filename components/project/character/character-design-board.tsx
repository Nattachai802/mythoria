"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Shirt, Scissors, Gem, Trash2, Loader2, Plus } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CharacterDesignBoardProps {
    characterId: string;
    novelId: string;
}

interface DesignElement {
    id: string;
    type: "color" | "hairstyle" | "clothing" | "accessory" | "other";
    value: string;
    name: string | null;
}

export function CharacterDesignBoard({ characterId, novelId }: CharacterDesignBoardProps) {
    const [elements, setElements] = useState<DesignElement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Color picker state
    const [newColorHex, setNewColorHex] = useState("#000000");
    const [newColorName, setNewColorName] = useState("");
    const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);

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

    const handleAddElement = async (type: string, value: string, name?: string) => {
        try {
            const res = await fetch(`/api/novels/${novelId}/characters/${characterId}/design`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type, value, name }),
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

    const handleAddColor = () => {
        if (!newColorHex) return;
        handleAddElement("color", newColorHex, newColorName);
        setIsColorPopoverOpen(false);
        setNewColorName("");
        setNewColorHex("#000000");
    };

    const handleImageUpload = (type: string) => (url: string) => {
        if (url) {
            handleAddElement(type, url);
        }
    };

    const colors = elements.filter(e => e.type === "color");
    const hairstyles = elements.filter(e => e.type === "hairstyle");
    const clothings = elements.filter(e => e.type === "clothing");
    const accessories = elements.filter(e => e.type === "accessory");

    if (isLoading) {
        return <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Palette className="w-6 h-6 text-primary" />
                        Design Board
                    </h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        รวบรวมเรฟเฟอเรนซ์โทนสี เสื้อผ้า ทรงผม และเครื่องประดับของตัวละคร
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Color Palette Section */}
                <Card className="md:col-span-4 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Palette className="w-5 h-5 text-pink-500" />
                            Color Palette
                        </CardTitle>
                        <Popover open={isColorPopoverOpen} onOpenChange={setIsColorPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                    <Plus className="w-4 h-4" /> เพิ่มสี
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64" align="end">
                                <div className="space-y-4">
                                    <h4 className="font-medium text-sm">เพิ่มโทนสีใหม่</h4>
                                    <div className="space-y-2">
                                        <Label className="text-xs">เลือกสี</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="color"
                                                value={newColorHex}
                                                onChange={(e) => setNewColorHex(e.target.value)}
                                                className="w-12 h-8 p-1 cursor-pointer"
                                            />
                                            <Input
                                                value={newColorHex}
                                                onChange={(e) => setNewColorHex(e.target.value)}
                                                className="h-8 text-xs font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">ชื่อเรียกสี (Optional)</Label>
                                        <Input
                                            placeholder="เช่น Crimson Red"
                                            value={newColorName}
                                            onChange={(e) => setNewColorName(e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                    <Button onClick={handleAddColor} className="w-full h-8 text-xs">บันทึกสี</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </CardHeader>
                    <CardContent>
                        {colors.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีโทนสี</p>
                        ) : (
                            <div className="flex flex-wrap gap-4">
                                {colors.map((color) => (
                                    <div key={color.id} className="group relative flex flex-col items-center gap-2">
                                        <div 
                                            className="w-16 h-16 rounded-full shadow-md border-2 border-background ring-1 ring-border transition-transform group-hover:scale-110"
                                            style={{ backgroundColor: color.value }}
                                            title={color.name || color.value}
                                        />
                                        <div className="text-center">
                                            <p className="text-xs font-medium max-w-[80px] truncate">{color.name || "Untitled"}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">{color.value}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleDeleteElement(color.id)}
                                            className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Hairstyle Section */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Scissors className="w-5 h-5 text-orange-500" />
                            Hairstyle
                        </CardTitle>
                        <ImageUpload 
                            folder={`novels/${novelId}/characters/${characterId}/design`}
                            onChange={handleImageUpload("hairstyle")}
                            trigger={
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                    <Plus className="w-4 h-4" /> เพิ่มรูป
                                </Button>
                            }
                        />
                    </CardHeader>
                    <CardContent>
                        {hairstyles.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-md border border-dashed">ยังไม่มี Reference ทรงผม</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {hairstyles.map((img) => (
                                    <div key={img.id} className="group relative aspect-square rounded-md overflow-hidden bg-muted border">
                                        <img src={img.value} alt="Hairstyle" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button variant="destructive" size="icon" onClick={() => handleDeleteElement(img.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Clothing Section */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shirt className="w-5 h-5 text-blue-500" />
                            Clothing
                        </CardTitle>
                        <ImageUpload 
                            folder={`novels/${novelId}/characters/${characterId}/design`}
                            onChange={handleImageUpload("clothing")}
                            trigger={
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                    <Plus className="w-4 h-4" /> เพิ่มรูป
                                </Button>
                            }
                        />
                    </CardHeader>
                    <CardContent>
                        {clothings.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-md border border-dashed">ยังไม่มี Reference เสื้อผ้า</p>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                {clothings.map((img) => (
                                    <div key={img.id} className="group relative aspect-[3/4] rounded-md overflow-hidden bg-muted border">
                                        <img src={img.value} alt="Clothing" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button variant="destructive" size="icon" onClick={() => handleDeleteElement(img.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Accessories Section */}
                <Card className="md:col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Gem className="w-5 h-5 text-emerald-500" />
                            Accessories
                        </CardTitle>
                        <ImageUpload 
                            folder={`novels/${novelId}/characters/${characterId}/design`}
                            onChange={handleImageUpload("accessory")}
                            trigger={
                                <Button variant="ghost" size="sm" className="h-8 gap-1">
                                    <Plus className="w-4 h-4" /> เพิ่มรูป
                                </Button>
                            }
                        />
                    </CardHeader>
                    <CardContent>
                        {accessories.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-md border border-dashed">ยังไม่มี Reference เครื่องประดับ</p>
                        ) : (
                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
                                {accessories.map((img) => (
                                    <div key={img.id} className="group relative flex-none w-32 h-32 rounded-md overflow-hidden bg-muted border">
                                        <img src={img.value} alt="Accessory" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button variant="destructive" size="icon" onClick={() => handleDeleteElement(img.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

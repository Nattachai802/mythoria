"use client";

import { useState } from "react";
import { User, Camera, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";

export type CharacterRole = "protagonist" | "antagonist" | "supporting" | "minor";

interface CharacterIdentityCardProps {
    name: string;
    role: CharacterRole;
    age?: string;
    gender?: string;
    species?: string;
    image?: string;
    aliases?: string[];
    isEditing?: boolean;
    isGeneratingAliases?: boolean;
    onNameChange?: (value: string) => void;
    onRoleChange?: (value: CharacterRole) => void;
    onAgeChange?: (value: string) => void;
    onGenderChange?: (value: string) => void;
    onSpeciesChange?: (value: string) => void;
    onImageChange?: (value: string) => void;
    onAliasAdd?: (alias: string) => void;
    onAliasRemove?: (alias: string) => void;
    onNameBlur?: () => void;
    className?: string;
}

const ROLE_COLORS: Record<CharacterRole, string> = {
    protagonist: "bg-amber-500/20 text-amber-700 border-amber-500/50",
    antagonist: "bg-red-500/20 text-red-700 border-red-500/50",
    supporting: "bg-blue-500/20 text-blue-700 border-blue-500/50",
    minor: "bg-slate-500/20 text-slate-700 border-slate-500/50",
};

const ROLE_LABELS: Record<CharacterRole, string> = {
    protagonist: "ตัวเอก",
    antagonist: "ตัวร้าย",
    supporting: "ตัวรอง",
    minor: "ตัวประกอบ",
};

export function CharacterIdentityCard({
    name,
    role,
    age,
    gender,
    species,
    image,
    aliases = [],
    isEditing = false,
    isGeneratingAliases = false,
    onNameChange,
    onRoleChange,
    onAgeChange,
    onGenderChange,
    onSpeciesChange,
    onImageChange,
    onAliasAdd,
    onAliasRemove,
    onNameBlur,
    className,
}: CharacterIdentityCardProps) {
    const [aliasInput, setAliasInput] = useState("");

    const handleAddAlias = () => {
        if (aliasInput.trim() && onAliasAdd) {
            onAliasAdd(aliasInput.trim());
            setAliasInput("");
        }
    };

    return (
        <div
            className={cn(
                "relative rounded-xl border bg-gradient-to-br from-card to-muted/30 p-6 shadow-sm",
                className
            )}
        >
            {/* Avatar & Core Identity */}
            <div className="flex gap-6">
                {/* Avatar Section */}
                <div className="relative flex-shrink-0">
                    <div className="w-32 h-40 rounded-lg overflow-hidden bg-muted border-2 border-dashed border-muted-foreground/30">
                        {image ? (
                            <img
                                src={image}
                                alt={name || "Character"}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <User className="w-12 h-12 text-muted-foreground/50" />
                            </div>
                        )}
                    </div>
                    {isEditing && (
                        <div className="absolute -bottom-2 -right-2">
                            <ImageUpload
                                value={image}
                                onChange={onImageChange}
                                folder="characters"
                                trigger={
                                    <Button
                                        size="icon"
                                        variant="secondary"
                                        className="h-8 w-8 rounded-full shadow-md"
                                    >
                                        <Camera className="h-4 w-4" />
                                    </Button>
                                }
                            />
                        </div>
                    )}
                </div>

                {/* Identity Info */}
                <div className="flex-1 space-y-4">
                    {/* Name */}
                    {isEditing ? (
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">ชื่อ</Label>
                            <Input
                                value={name}
                                onChange={(e) => onNameChange?.(e.target.value)}
                                onBlur={onNameBlur}
                                placeholder="ชื่อตัวละคร"
                                className="text-xl font-bold h-auto py-1"
                            />
                        </div>
                    ) : (
                        <h2 className="text-2xl font-bold">{name || "—"}</h2>
                    )}

                    {/* Role Badge */}
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <Select value={role} onValueChange={(v) => onRoleChange?.(v as CharacterRole)}>
                                <SelectTrigger className="w-[140px] h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="protagonist">ตัวเอก</SelectItem>
                                    <SelectItem value="antagonist">ตัวร้าย</SelectItem>
                                    <SelectItem value="supporting">ตัวรอง</SelectItem>
                                    <SelectItem value="minor">ตัวประกอบ</SelectItem>
                                </SelectContent>
                            </Select>
                        ) : (
                            <Badge className={cn("border", ROLE_COLORS[role])}>
                                {ROLE_LABELS[role]}
                            </Badge>
                        )}
                    </div>

                    {/* Quick Stats */}
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        {isEditing ? (
                            <>
                                <div className="flex items-center gap-2">
                                    <Label className="text-muted-foreground text-xs w-10">อายุ</Label>
                                    <Input
                                        value={age || ""}
                                        onChange={(e) => onAgeChange?.(e.target.value)}
                                        placeholder="25"
                                        className="h-7 w-20"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-muted-foreground text-xs w-10">เพศ</Label>
                                    <Input
                                        value={gender || ""}
                                        onChange={(e) => onGenderChange?.(e.target.value)}
                                        placeholder="ชาย/หญิง"
                                        className="h-7 w-24"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-muted-foreground text-xs w-10">เผ่า</Label>
                                    <Input
                                        value={species || ""}
                                        onChange={(e) => onSpeciesChange?.(e.target.value)}
                                        placeholder="มนุษย์, เอลฟ์"
                                        className="h-7 w-28"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {age && (
                                    <div>
                                        <span className="text-muted-foreground">อายุ: </span>
                                        <span className="font-medium">{age}</span>
                                    </div>
                                )}
                                {gender && (
                                    <div>
                                        <span className="text-muted-foreground">เพศ: </span>
                                        <span className="font-medium">{gender}</span>
                                    </div>
                                )}
                                {species && (
                                    <div>
                                        <span className="text-muted-foreground">เผ่า: </span>
                                        <span className="font-medium">{species}</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Aliases Section */}
            <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 mb-2">
                    <Label className="text-xs text-muted-foreground">ชื่ออื่น / Aliases</Label>
                    {isGeneratingAliases && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {aliases.map((alias, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs font-normal gap-1"
                        >
                            {alias}
                            {isEditing && onAliasRemove && (
                                <button
                                    type="button"
                                    onClick={() => onAliasRemove(alias)}
                                    className="ml-1 hover:text-destructive"
                                >
                                    ×
                                </button>
                            )}
                        </Badge>
                    ))}
                    {isEditing && (
                        <Input
                            value={aliasInput}
                            onChange={(e) => setAliasInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddAlias();
                                }
                            }}
                            placeholder="+ เพิ่มชื่อ"
                            className="h-6 w-28 text-xs"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    CharacterIdentityCard,
    CharacterRole,
} from "./character-identity-card";
import { CharacterDossier } from "./character-dossier";
import { CharacterRelationships } from "./character-relationships";
import { CharacterPowerManager } from "./character-power-manager";
import { createCharacter, updateCharacter } from "@/server/character";
import { generateThaiAliases } from "@/server/ai";
import { toast } from "sonner";
import { Loader2, Save, Eye, Pencil } from "lucide-react";
import { Character } from "@/db/schema";

interface CharacterSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    character?: Character | null; // null = create mode
    novelId: string;
    onSaved?: (character: Character) => void;
}

interface CharacterFormData {
    name: string;
    role: CharacterRole;
    age: string;
    gender: string;
    species: string;
    image: string;
    aliases: string[];
    description: string;
    appearance: string;
    personality: string;
    backstory: string;
    goals: string;
    motivation: string;
    conflict: string;
    strengths: string;
    weaknesses: string;
}

const DEFAULT_FORM_DATA: CharacterFormData = {
    name: "",
    role: "supporting",
    age: "",
    gender: "",
    species: "",
    image: "",
    aliases: [],
    description: "",
    appearance: "",
    personality: "",
    backstory: "",
    goals: "",
    motivation: "",
    conflict: "",
    strengths: "",
    weaknesses: "",
};

export function CharacterSheet({
    open,
    onOpenChange,
    character,
    novelId,
    onSaved,
}: CharacterSheetProps) {
    const isCreateMode = !character;
    const [isEditing, setIsEditing] = useState(isCreateMode);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingAliases, setIsGeneratingAliases] = useState(false);
    const [formData, setFormData] = useState<CharacterFormData>(DEFAULT_FORM_DATA);

    // Reset form when character changes or modal opens
    useEffect(() => {
        if (open) {
            if (character) {
                setFormData({
                    name: character.name || "",
                    role: (character.role as CharacterRole) || "supporting",
                    age: character.age || "",
                    gender: character.gender || "",
                    species: character.species || "",
                    image: character.image || "",
                    aliases: (character.aliases as string[]) || [],
                    description: character.description || "",
                    appearance: character.appearance || "",
                    personality: character.personality || "",
                    backstory: character.backstory || "",
                    goals: character.goals || "",
                    motivation: character.motivation || "",
                    conflict: character.conflict || "",
                    strengths: character.strengths || "",
                    weaknesses: character.weaknesses || "",
                });
                setIsEditing(false);
            } else {
                setFormData(DEFAULT_FORM_DATA);
                setIsEditing(true);
            }
        }
    }, [character, open]);

    const updateField = useCallback(<K extends keyof CharacterFormData>(
        field: K,
        value: CharacterFormData[K]
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    }, []);

    const handleNameBlur = async () => {
        if (!formData.name || isGeneratingAliases) return;

        setIsGeneratingAliases(true);
        try {
            const generatedAliases = await generateThaiAliases(formData.name);
            if (generatedAliases && generatedAliases.length > 0) {
                const newAliases = generatedAliases.filter(
                    (a) => !formData.aliases.includes(a)
                );
                if (newAliases.length > 0) {
                    updateField("aliases", [...formData.aliases, ...newAliases]);
                    toast.success(`เพิ่มชื่อ: ${newAliases.join(", ")}`);
                }
            }
        } catch (error) {
            console.error("Auto-generate aliases failed", error);
        } finally {
            setIsGeneratingAliases(false);
        }
    };

    const handleAddAlias = (alias: string) => {
        if (!formData.aliases.includes(alias)) {
            updateField("aliases", [...formData.aliases, alias]);
        }
    };

    const handleRemoveAlias = (alias: string) => {
        updateField(
            "aliases",
            formData.aliases.filter((a) => a !== alias)
        );
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error("กรุณาระบุชื่อตัวละคร");
            return;
        }

        setIsSaving(true);

        try {
            let result;
            if (isCreateMode) {
                result = await createCharacter({
                    ...formData,
                    novelId,
                });
            } else {
                result = await updateCharacter(character!.id, formData);
            }

            if (result.success) {
                toast.success(isCreateMode ? "สร้างตัวละครสำเร็จ" : "บันทึกสำเร็จ");
                onSaved?.(result.data as Character);
                if (isCreateMode) {
                    onOpenChange(false);
                } else {
                    setIsEditing(false);
                }
            } else {
                toast.error(result.error || "เกิดข้อผิดพลาด");
            }
        } catch (error) {
            console.error("Save error:", error);
            toast.error("เกิดข้อผิดพลาด");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-2xl lg:max-w-3xl p-0 flex flex-col"
            >
                {/* Header */}
                <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="text-xl">
                                {isCreateMode ? "สร้างตัวละครใหม่" : formData.name || "ตัวละคร"}
                            </SheetTitle>
                            <SheetDescription>
                                {isCreateMode
                                    ? "กรอกข้อมูลพื้นฐานเพื่อสร้างตัวละคร"
                                    : "ดูและแก้ไขข้อมูลตัวละคร"}
                            </SheetDescription>
                        </div>
                        {!isCreateMode && (
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-muted-foreground" />
                                <Switch
                                    checked={isEditing}
                                    onCheckedChange={setIsEditing}
                                    id="edit-mode"
                                />
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                                <Label htmlFor="edit-mode" className="sr-only">
                                    Toggle Edit Mode
                                </Label>
                            </div>
                        )}
                    </div>
                </SheetHeader>

                {/* Content - using native overflow for proper scrolling */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                    <div className="space-y-6 pb-4">
                        {/* Identity Card */}
                        <CharacterIdentityCard
                            name={formData.name}
                            role={formData.role}
                            age={formData.age}
                            gender={formData.gender}
                            species={formData.species}
                            image={formData.image}
                            aliases={formData.aliases}
                            isEditing={isEditing}
                            isGeneratingAliases={isGeneratingAliases}
                            onNameChange={(v) => updateField("name", v)}
                            onRoleChange={(v) => updateField("role", v)}
                            onAgeChange={(v) => updateField("age", v)}
                            onGenderChange={(v) => updateField("gender", v)}
                            onSpeciesChange={(v) => updateField("species", v)}
                            onImageChange={(v) => updateField("image", v)}
                            onAliasAdd={handleAddAlias}
                            onAliasRemove={handleRemoveAlias}
                            onNameBlur={handleNameBlur}
                        />

                        <Separator />

                        {/* Dossier */}
                        <CharacterDossier
                            description={formData.description}
                            appearance={formData.appearance}
                            personality={formData.personality}
                            backstory={formData.backstory}
                            goals={formData.goals}
                            motivation={formData.motivation}
                            conflict={formData.conflict}
                            strengths={formData.strengths}
                            weaknesses={formData.weaknesses}
                            isEditing={isEditing}
                            onDescriptionChange={(v) => updateField("description", v)}
                            onAppearanceChange={(v) => updateField("appearance", v)}
                            onPersonalityChange={(v) => updateField("personality", v)}
                            onBackstoryChange={(v) => updateField("backstory", v)}
                            onGoalsChange={(v) => updateField("goals", v)}
                            onMotivationChange={(v) => updateField("motivation", v)}
                            onConflictChange={(v) => updateField("conflict", v)}
                            onStrengthsChange={(v) => updateField("strengths", v)}
                            onWeaknessesChange={(v) => updateField("weaknesses", v)}
                            relationshipSlot={
                                !isCreateMode && character ? (
                                    <CharacterRelationships
                                        characterId={character.id}
                                        novelId={novelId}
                                    />
                                ) : undefined
                            }
                            powerSlot={
                                !isCreateMode && character ? (
                                    <CharacterPowerManager
                                        characterId={character.id}
                                        novelId={novelId}
                                    />
                                ) : undefined
                            }
                        />
                    </div>
                </div>

                {/* Footer */}
                <SheetFooter className="px-6 py-4 border-t bg-background">
                    <div className="flex w-full justify-between items-center">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {isEditing ? "ยกเลิก" : "ปิด"}
                        </Button>
                        {isEditing && (
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        {isCreateMode ? "สร้างตัวละคร" : "บันทึก"}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

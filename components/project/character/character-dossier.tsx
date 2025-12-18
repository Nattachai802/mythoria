"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    ScrollText,
    Sparkles,
    Target,
    Users,
    Swords,
} from "lucide-react";

interface CharacterDossierProps {
    // Description tab
    description?: string;
    appearance?: string;
    personality?: string;
    backstory?: string;
    // Depth tab
    goals?: string;
    motivation?: string;
    conflict?: string;
    strengths?: string;
    weaknesses?: string;
    // Edit mode
    isEditing?: boolean;
    onDescriptionChange?: (value: string) => void;
    onAppearanceChange?: (value: string) => void;
    onPersonalityChange?: (value: string) => void;
    onBackstoryChange?: (value: string) => void;
    onGoalsChange?: (value: string) => void;
    onMotivationChange?: (value: string) => void;
    onConflictChange?: (value: string) => void;
    onStrengthsChange?: (value: string) => void;
    onWeaknessesChange?: (value: string) => void;
    // Slots for external content
    relationshipSlot?: React.ReactNode;
    powerSlot?: React.ReactNode;
    className?: string;
}

interface DossierFieldProps {
    label: string;
    value?: string;
    placeholder: string;
    isEditing?: boolean;
    onChange?: (value: string) => void;
    minHeight?: string;
}

function DossierField({
    label,
    value,
    placeholder,
    isEditing,
    onChange,
    minHeight = "100px",
}: DossierFieldProps) {
    if (isEditing) {
        return (
            <div className="space-y-2">
                <Label className="text-sm font-medium">{label}</Label>
                <Textarea
                    value={value || ""}
                    onChange={(e) => onChange?.(e.target.value)}
                    placeholder={placeholder}
                    className={cn("resize-none", `min-h-[${minHeight}]`)}
                    style={{ minHeight }}
                />
            </div>
        );
    }

    if (!value) return null;

    return (
        <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">{label}</h4>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{value}</p>
        </div>
    );
}

export function CharacterDossier({
    description,
    appearance,
    personality,
    backstory,
    goals,
    motivation,
    conflict,
    strengths,
    weaknesses,
    isEditing = false,
    onDescriptionChange,
    onAppearanceChange,
    onPersonalityChange,
    onBackstoryChange,
    onGoalsChange,
    onMotivationChange,
    onConflictChange,
    onStrengthsChange,
    onWeaknessesChange,
    relationshipSlot,
    powerSlot,
    className,
}: CharacterDossierProps) {
    const [activeTab, setActiveTab] = useState("description");

    // Check if tabs have content (for view mode)
    const hasDescriptionContent = isEditing || description || appearance || personality || backstory;
    const hasDepthContent = isEditing || goals || motivation || conflict || strengths || weaknesses;

    return (
        <div className={cn("flex-1", className)}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start bg-muted/50 rounded-lg p-1">
                    <TabsTrigger value="description" className="gap-2">
                        <ScrollText className="h-4 w-4" />
                        <span className="hidden sm:inline">ข้อมูลทั่วไป</span>
                    </TabsTrigger>
                    <TabsTrigger value="depth" className="gap-2">
                        <Target className="h-4 w-4" />
                        <span className="hidden sm:inline">มิติตัวละคร</span>
                    </TabsTrigger>
                    {relationshipSlot && (
                        <TabsTrigger value="relationships" className="gap-2">
                            <Users className="h-4 w-4" />
                            <span className="hidden sm:inline">ความสัมพันธ์</span>
                        </TabsTrigger>
                    )}
                    {powerSlot && (
                        <TabsTrigger value="powers" className="gap-2">
                            <Swords className="h-4 w-4" />
                            <span className="hidden sm:inline">พลัง</span>
                        </TabsTrigger>
                    )}
                </TabsList>

                {/* Description Tab */}
                <TabsContent value="description" className="mt-4 space-y-6">
                    {hasDescriptionContent ? (
                        <>
                            <DossierField
                                label="คำอธิบาย"
                                value={description}
                                placeholder="อธิบายตัวละครโดยสังเขป..."
                                isEditing={isEditing}
                                onChange={onDescriptionChange}
                            />
                            <DossierField
                                label="รูปลักษณ์"
                                value={appearance}
                                placeholder="ลักษณะภายนอก หน้าตา การแต่งกาย..."
                                isEditing={isEditing}
                                onChange={onAppearanceChange}
                            />
                            <DossierField
                                label="บุคลิกภาพ"
                                value={personality}
                                placeholder="นิสัยใจคอ ลักษณะเด่น..."
                                isEditing={isEditing}
                                onChange={onPersonalityChange}
                            />
                            <DossierField
                                label="ปูมหลัง"
                                value={backstory}
                                placeholder="ประวัติความเป็นมา..."
                                isEditing={isEditing}
                                onChange={onBackstoryChange}
                                minHeight="150px"
                            />
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>ยังไม่มีข้อมูล</p>
                        </div>
                    )}
                </TabsContent>

                {/* Depth Tab */}
                <TabsContent value="depth" className="mt-4 space-y-6">
                    {hasDepthContent ? (
                        <>
                            <DossierField
                                label="เป้าหมาย"
                                value={goals}
                                placeholder="ตัวละครต้องการอะไร?"
                                isEditing={isEditing}
                                onChange={onGoalsChange}
                            />
                            <DossierField
                                label="แรงจูงใจ"
                                value={motivation}
                                placeholder="ทำไมถึงต้องการสิ่งนั้น?"
                                isEditing={isEditing}
                                onChange={onMotivationChange}
                            />
                            <DossierField
                                label="ความขัดแย้ง"
                                value={conflict}
                                placeholder="อุปสรรคภายในหรือภายนอก..."
                                isEditing={isEditing}
                                onChange={onConflictChange}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-green-500/30 bg-green-50/50 dark:bg-green-950/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-green-700 dark:text-green-400">
                                            จุดแข็ง
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {isEditing ? (
                                            <Textarea
                                                value={strengths || ""}
                                                onChange={(e) => onStrengthsChange?.(e.target.value)}
                                                placeholder="ความสามารถพิเศษ ข้อดี..."
                                                className="resize-none min-h-[80px] bg-transparent border-green-200"
                                            />
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap">
                                                {strengths || "—"}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="border-red-500/30 bg-red-50/50 dark:bg-red-950/20">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-red-700 dark:text-red-400">
                                            จุดอ่อน
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        {isEditing ? (
                                            <Textarea
                                                value={weaknesses || ""}
                                                onChange={(e) => onWeaknessesChange?.(e.target.value)}
                                                placeholder="ข้อจำกัด จุดอ่อน..."
                                                className="resize-none min-h-[80px] bg-transparent border-red-200"
                                            />
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap">
                                                {weaknesses || "—"}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>ยังไม่มีข้อมูลเชิงลึก</p>
                        </div>
                    )}
                </TabsContent>

                {/* Relationships Tab */}
                {relationshipSlot && (
                    <TabsContent value="relationships" className="mt-4">
                        {relationshipSlot}
                    </TabsContent>
                )}

                {/* Powers Tab */}
                {powerSlot && (
                    <TabsContent value="powers" className="mt-4">
                        {powerSlot}
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

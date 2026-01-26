"use client";

import { useState, useMemo } from "react";
import { Download, FileText, Loader2, FileCode2, Users, User, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Character } from "@/db/schema";

interface ExportCharacterDialogProps {
    characters: Character[];
    novelTitle: string;
    /** If provided, only this character will be exported (single mode) */
    singleCharacter?: Character;
    trigger?: React.ReactNode;
}

type ExportFormat = "json" | "markdown";
type ExportMode = "single" | "selected" | "all";

const ROLE_LABELS: Record<string, string> = {
    protagonist: "ตัวเอก",
    antagonist: "ตัวร้าย",
    supporting: "ตัวรอง",
    minor: "ตัวประกอบ",
};

/**
 * Convert character to Markdown format
 */
function characterToMarkdown(character: Character): string {
    const lines: string[] = [];

    lines.push(`# ${character.name}`);
    lines.push("");

    // Basic Info
    const basicInfo: string[] = [];
    if (character.role) basicInfo.push(`**บทบาท:** ${ROLE_LABELS[character.role] || character.role}`);
    if (character.age) basicInfo.push(`**อายุ:** ${character.age}`);
    if (character.gender) basicInfo.push(`**เพศ:** ${character.gender}`);
    if (character.species) basicInfo.push(`**เผ่าพันธุ์:** ${character.species}`);

    if (basicInfo.length > 0) {
        lines.push("## ข้อมูลพื้นฐาน");
        lines.push(basicInfo.join(" | "));
        lines.push("");
    }

    // Aliases
    if (character.aliases && Array.isArray(character.aliases) && (character.aliases as string[]).length > 0) {
        lines.push("## ชื่อเรียกอื่น");
        lines.push((character.aliases as string[]).join(", "));
        lines.push("");
    }

    // Description
    if (character.description) {
        lines.push("## คำอธิบาย");
        lines.push(character.description);
        lines.push("");
    }

    // Appearance
    if (character.appearance) {
        lines.push("## รูปลักษณ์");
        lines.push(character.appearance);
        lines.push("");
    }

    // Personality
    if (character.personality) {
        lines.push("## บุคลิกภาพ");
        lines.push(character.personality);
        lines.push("");
    }

    // Backstory
    if (character.backstory) {
        lines.push("## ปูมหลัง");
        lines.push(character.backstory);
        lines.push("");
    }

    // Goals & Motivation
    if (character.goals || character.motivation || character.conflict) {
        lines.push("## มิติตัวละคร");
        if (character.goals) {
            lines.push(`### เป้าหมาย`);
            lines.push(character.goals);
            lines.push("");
        }
        if (character.motivation) {
            lines.push(`### แรงจูงใจ`);
            lines.push(character.motivation);
            lines.push("");
        }
        if (character.conflict) {
            lines.push(`### ความขัดแย้ง`);
            lines.push(character.conflict);
            lines.push("");
        }
    }

    // Strengths & Weaknesses
    if (character.strengths || character.weaknesses) {
        if (character.strengths) {
            lines.push("## จุดแข็ง");
            lines.push(character.strengths);
            lines.push("");
        }
        if (character.weaknesses) {
            lines.push("## จุดอ่อน");
            lines.push(character.weaknesses);
            lines.push("");
        }
    }

    lines.push("---");
    lines.push("");

    return lines.join("\n");
}

/**
 * Convert character to clean JSON format for export
 */
function characterToExportJson(character: Character): Record<string, any> {
    return {
        id: character.id,
        name: character.name,
        role: character.role,
        roleLabel: ROLE_LABELS[character.role] || character.role,
        age: character.age,
        gender: character.gender,
        species: character.species,
        aliases: character.aliases,
        description: character.description,
        appearance: character.appearance,
        personality: character.personality,
        backstory: character.backstory,
        goals: character.goals,
        motivation: character.motivation,
        conflict: character.conflict,
        strengths: character.strengths,
        weaknesses: character.weaknesses,
        image: character.image,
        createdAt: character.createdAt,
        updatedAt: character.updatedAt,
    };
}

export function ExportCharacterDialog({
    characters,
    novelTitle,
    singleCharacter,
    trigger,
}: ExportCharacterDialogProps) {
    const [open, setOpen] = useState(false);
    const [format, setFormat] = useState<ExportFormat>("json");
    const [mode, setMode] = useState<ExportMode>(singleCharacter ? "single" : "all");
    const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(
        new Set(characters.map((c) => c.id))
    );
    const [isExporting, setIsExporting] = useState(false);

    // Determine which characters to export based on mode
    const charactersToExport = useMemo(() => {
        if (singleCharacter) {
            return [singleCharacter];
        }
        switch (mode) {
            case "single":
                return characters.slice(0, 1); // First character only
            case "selected":
                return characters.filter((c) => selectedCharacters.has(c.id));
            case "all":
            default:
                return characters;
        }
    }, [mode, characters, selectedCharacters, singleCharacter]);

    // Toggle character selection
    function toggleCharacter(characterId: string) {
        setSelectedCharacters((prev) => {
            const next = new Set(prev);
            if (next.has(characterId)) {
                next.delete(characterId);
            } else {
                next.add(characterId);
            }
            return next;
        });
    }

    // Select/Deselect all
    function toggleAll() {
        if (selectedCharacters.size === characters.length) {
            setSelectedCharacters(new Set());
        } else {
            setSelectedCharacters(new Set(characters.map((c) => c.id)));
        }
    }

    // Generate and download file
    async function handleExport() {
        if (charactersToExport.length === 0) {
            toast.error("กรุณาเลือกอย่างน้อย 1 ตัวละคร");
            return;
        }

        setIsExporting(true);
        try {
            let content: string;
            let filename: string;
            let mimeType: string;

            if (format === "json") {
                const exportData = {
                    exportedAt: new Date().toISOString(),
                    novelTitle,
                    characterCount: charactersToExport.length,
                    characters: charactersToExport.map(characterToExportJson),
                };
                content = JSON.stringify(exportData, null, 2);
                filename = `${novelTitle.replace(/[^a-zA-Z0-9ก-๙]/g, "_")}_characters.json`;
                mimeType = "application/json;charset=utf-8";
            } else {
                // Markdown
                let markdown = `# ${novelTitle} - รายชื่อตัวละคร\n\n`;
                markdown += `**จำนวนตัวละคร:** ${charactersToExport.length}\n\n`;
                markdown += `**วันที่ Export:** ${new Date().toLocaleDateString("th-TH")}\n\n`;
                markdown += "---\n\n";

                for (const character of charactersToExport) {
                    markdown += characterToMarkdown(character);
                }

                content = markdown;
                filename = `${novelTitle.replace(/[^a-zA-Z0-9ก-๙]/g, "_")}_characters.md`;
                mimeType = "text/markdown;charset=utf-8";
            }

            // Download file
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Export ${charactersToExport.length} ตัวละครสำเร็จ!`);
            setOpen(false);
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Export ไม่สำเร็จ");
        } finally {
            setIsExporting(false);
        }
    }

    // If singleCharacter is provided, simplify the UI
    const isSingleMode = !!singleCharacter;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={cn("max-w-md", !isSingleMode && mode === "selected" && "max-w-lg")}>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Export ตัวละคร
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Format selection */}
                    <div className="space-y-2">
                        <Label>รูปแบบไฟล์</Label>
                        <div className="flex gap-2">
                            <Button
                                variant={format === "json" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormat("json")}
                                className="flex-1"
                            >
                                <FileCode2 className="h-4 w-4 mr-1" />
                                JSON
                            </Button>
                            <Button
                                variant={format === "markdown" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormat("markdown")}
                                className="flex-1"
                            >
                                <FileText className="h-4 w-4 mr-1" />
                                Markdown
                            </Button>
                        </div>
                    </div>

                    {/* Mode selection (only if not single character mode) */}
                    {!isSingleMode && (
                        <div className="space-y-3">
                            <Label>ตัวเลือก Export</Label>
                            <div className="flex gap-2">
                                <Button
                                    variant={mode === "all" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setMode("all")}
                                    className="flex-1"
                                >
                                    <Users className="h-4 w-4 mr-1" />
                                    ทั้งหมด ({characters.length})
                                </Button>
                                <Button
                                    variant={mode === "selected" ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setMode("selected")}
                                    className="flex-1"
                                >
                                    <CheckSquare className="h-4 w-4 mr-1" />
                                    เลือกเอง
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Character selection (only when mode is "selected") */}
                    {!isSingleMode && mode === "selected" && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>เลือกตัวละคร</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={toggleAll}
                                >
                                    {selectedCharacters.size === characters.length
                                        ? "ยกเลิกทั้งหมด"
                                        : "เลือกทั้งหมด"}
                                </Button>
                            </div>
                            <ScrollArea className="h-[200px] border rounded-md p-2">
                                <div className="space-y-1">
                                    {characters.map((character) => (
                                        <div
                                            key={character.id}
                                            className="flex items-center space-x-2 py-1.5 px-1 rounded hover:bg-muted/50"
                                        >
                                            <Checkbox
                                                id={character.id}
                                                checked={selectedCharacters.has(character.id)}
                                                onCheckedChange={() => toggleCharacter(character.id)}
                                            />
                                            <Label
                                                htmlFor={character.id}
                                                className="text-sm cursor-pointer flex-1 flex items-center gap-2"
                                            >
                                                {character.image ? (
                                                    <img
                                                        src={character.image}
                                                        alt={character.name}
                                                        className="w-6 h-6 rounded-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                                                        <User className="w-3 h-3 text-muted-foreground" />
                                                    </div>
                                                )}
                                                <span>{character.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({ROLE_LABELS[character.role] || character.role})
                                                </span>
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <p className="text-xs text-muted-foreground">
                                เลือก {selectedCharacters.size} / {characters.length} ตัวละคร
                            </p>
                        </div>
                    )}

                    {/* Preview info */}
                    {isSingleMode && singleCharacter && (
                        <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                            {singleCharacter.image ? (
                                <img
                                    src={singleCharacter.image}
                                    alt={singleCharacter.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                    <User className="w-5 h-5 text-muted-foreground" />
                                </div>
                            )}
                            <div>
                                <p className="font-medium">{singleCharacter.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {ROLE_LABELS[singleCharacter.role] || singleCharacter.role}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Export button */}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || charactersToExport.length === 0}
                        className="w-full"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                กำลัง Export...
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4 mr-2" />
                                Export {format === "json" ? "JSON" : "Markdown"}{" "}
                                ({charactersToExport.length} ตัวละคร)
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

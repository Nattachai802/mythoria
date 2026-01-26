"use client";

import { useState, useEffect, useMemo } from "react";
import { Copy, Check, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Chapter {
    id: string;
    title: string;
    orderIndex: number;
}

interface Note {
    id: string;
    title: string;
    content: { text?: string } | null;
    linkedToChapterId: string | null;
}

interface PublishAssistantProps {
    chapters: Chapter[];
    notes: Note[];
    novelTitle: string;
    trigger?: React.ReactNode;
}

/**
 * แปลง HTML content เป็น plain text
 */
function htmlToPlainText(html: string, keepSpacing: boolean): string {
    if (!html) return "";

    let text = html;

    // แปลง block elements เป็น line breaks
    if (keepSpacing) {
        // คงวรรค - เว้นบรรทัดระหว่าง paragraphs
        text = text
            .replace(/<\/p>/gi, "\n\n")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/div>/gi, "\n\n")
            .replace(/<\/li>/gi, "\n");
    } else {
        // ไม่คงวรรค - เว้นบรรทัดเดียว
        text = text
            .replace(/<\/p>/gi, "\n")
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<\/div>/gi, "\n")
            .replace(/<\/li>/gi, "\n");
    }

    // ลบ HTML tags ที่เหลือ
    text = text.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Clean up excessive whitespace
    if (keepSpacing) {
        text = text.replace(/\n{3,}/g, "\n\n"); // Max 2 newlines
    } else {
        text = text.replace(/\n{2,}/g, "\n"); // Max 1 newline
    }

    return text.trim();
}

export function PublishAssistant({
    chapters,
    notes,
    novelTitle,
    trigger,
}: PublishAssistantProps) {
    const [open, setOpen] = useState(false);
    const [selectedChapterId, setSelectedChapterId] = useState<string>("");
    const [keepSpacing, setKeepSpacing] = useState(true);
    const [copied, setCopied] = useState(false);

    // จัดกลุ่ม notes ตาม chapter
    const notesByChapter = useMemo(() => {
        const map = new Map<string, Note[]>();
        for (const note of notes) {
            if (note.linkedToChapterId) {
                const existing = map.get(note.linkedToChapterId) || [];
                existing.push(note);
                map.set(note.linkedToChapterId, existing);
            }
        }
        return map;
    }, [notes]);

    // Notes ของ chapter ที่เลือก
    const selectedNotes = useMemo(() => {
        if (!selectedChapterId) return [];
        return notesByChapter.get(selectedChapterId) || [];
    }, [selectedChapterId, notesByChapter]);

    // รวม content ของ notes ทั้งหมด
    const formattedContent = useMemo(() => {
        if (selectedNotes.length === 0) return "";

        const contents = selectedNotes
            .map((note) => {
                const html = note.content?.text || "";
                return htmlToPlainText(html, keepSpacing);
            })
            .filter(Boolean);

        if (keepSpacing) {
            return contents.join("\n\n---\n\n");
        } else {
            return contents.join("\n---\n");
        }
    }, [selectedNotes, keepSpacing]);

    // Chapter ที่เลือก
    const selectedChapter = useMemo(() => {
        return chapters.find((c) => c.id === selectedChapterId);
    }, [selectedChapterId, chapters]);

    // Copy to clipboard
    async function handleCopy() {
        if (!formattedContent) return;

        try {
            await navigator.clipboard.writeText(formattedContent);
            setCopied(true);
            toast.success("คัดลอกแล้ว!");
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast.error("ไม่สามารถคัดลอกได้");
        }
    }

    // Reset copied state when content changes
    useEffect(() => {
        setCopied(false);
    }, [formattedContent]);

    // เลือก chapter แรกเป็น default
    useEffect(() => {
        if (open && chapters.length > 0 && !selectedChapterId) {
            setSelectedChapterId(chapters[0].id);
        }
    }, [open, chapters, selectedChapterId]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Publish Assistant
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Publish Assistant
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                    {/* Controls */}
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Chapter selector */}
                        <div className="flex-1 min-w-[200px]">
                            <Label className="text-sm mb-1.5 block">เลือกบท</Label>
                            <Select
                                value={selectedChapterId}
                                onValueChange={setSelectedChapterId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกบท..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {chapters.map((chapter) => (
                                        <SelectItem key={chapter.id} value={chapter.id}>
                                            บทที่ {chapter.orderIndex}: {chapter.title}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Spacing toggle */}
                        <div className="flex items-center gap-2 pb-1">
                            <Switch
                                id="keep-spacing"
                                checked={keepSpacing}
                                onCheckedChange={setKeepSpacing}
                            />
                            <Label htmlFor="keep-spacing" className="text-sm cursor-pointer">
                                {keepSpacing ? "คงวรรค" : "ไม่คงวรรค"}
                            </Label>
                        </div>
                    </div>

                    {/* Info */}
                    {selectedChapter && (
                        <div className="text-xs text-muted-foreground">
                            {selectedNotes.length} notes • {formattedContent.length.toLocaleString()} ตัวอักษร
                        </div>
                    )}

                    {/* Preview */}
                    <div className="flex-1 min-h-0">
                        <Label className="text-sm mb-1.5 block">Preview</Label>
                        <ScrollArea className="h-[300px] border rounded-md p-3 bg-muted/30">
                            {formattedContent ? (
                                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                                    {formattedContent}
                                </pre>
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    {selectedChapterId
                                        ? "ไม่มี notes ในบทนี้"
                                        : "กรุณาเลือกบท"}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Copy button */}
                    <Button
                        onClick={handleCopy}
                        disabled={!formattedContent}
                        className="w-full"
                    >
                        {copied ? (
                            <>
                                <Check className="h-4 w-4 mr-2" />
                                คัดลอกแล้ว!
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy to Clipboard
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

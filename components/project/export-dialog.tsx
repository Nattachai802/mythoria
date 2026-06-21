"use client";

import { useState, useMemo } from "react";
import { Download, FileText, Loader2, FileType, Book } from "lucide-react";
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
    createdAt?: string | Date;
}

interface ExportDialogProps {
    chapters: Chapter[];
    notes: Note[];
    novelTitle: string;
    authorName?: string;
    coverImage?: string | null;
    trigger?: React.ReactNode;
}

type ExportFormat = "pdf" | "txt" | "epub";

/**
 * escape อักขระพิเศษสำหรับ XHTML (ePub เป็น XML strict)
 */
function escapeXml(s: string): string {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * แปลง note (HTML) → XHTML paragraphs สำหรับ ePub
 * ใช้ logic เดียวกับ PDF path: plain text → split \n\n → <p>
 */
function noteToXhtml(title: string | undefined, html: string): string {
    const heading = title ? `<h3>${escapeXml(title)}</h3>` : "";
    const text = htmlToPlainText(html);
    const paragraphs = text
        .split("\n\n")
        .filter(Boolean)
        .map((p) => `<p>${escapeXml(p).replace(/\n/g, "<br/>")}</p>`)
        .join("");
    return heading + paragraphs;
}

/**
 * แปลง HTML content เป็น plain text
 */
function htmlToPlainText(html: string): string {
    if (!html) return "";

    let text = html;
    text = text
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]*>/g, "");

    text = text
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"');

    text = text.replace(/\n{3,}/g, "\n\n");

    return text.trim();
}

export function ExportDialog({
    chapters,
    notes,
    novelTitle,
    authorName,
    coverImage,
    trigger,
}: ExportDialogProps) {
    const [open, setOpen] = useState(false);
    const [format, setFormat] = useState<ExportFormat>("txt");
    const [selectedChapters, setSelectedChapters] = useState<Set<string>>(
        new Set(chapters.map((c) => c.id))
    );
    const [isExporting, setIsExporting] = useState(false);

    // จัดกลุ่ม notes ตาม chapter
    const notesByChapter = useMemo(() => {
        const map = new Map<string, Note[]>();
        
        // เรียงลำดับ notes ตามวันที่สร้าง (เก่าสุดไปใหม่สุด)
        const sortedNotes = [...notes].sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateA - dateB;
        });

        for (const note of sortedNotes) {
            if (note.linkedToChapterId) {
                const existing = map.get(note.linkedToChapterId) || [];
                existing.push(note);
                map.set(note.linkedToChapterId, existing);
            }
        }
        return map;
    }, [notes]);

    // Toggle chapter selection
    function toggleChapter(chapterId: string) {
        setSelectedChapters((prev) => {
            const next = new Set(prev);
            if (next.has(chapterId)) {
                next.delete(chapterId);
            } else {
                next.add(chapterId);
            }
            return next;
        });
    }

    // Select/Deselect all
    function toggleAll() {
        if (selectedChapters.size === chapters.length) {
            setSelectedChapters(new Set());
        } else {
            setSelectedChapters(new Set(chapters.map((c) => c.id)));
        }
    }

    // Generate content for export
    function generateContent(): string {
        const sortedChapters = [...chapters]
            .filter((c) => selectedChapters.has(c.id))
            .sort((a, b) => a.orderIndex - b.orderIndex);

        let content = `${novelTitle}\n${"=".repeat(novelTitle.length)}\n\n`;

        for (const chapter of sortedChapters) {
            content += `\n\n${"─".repeat(40)}\n`;
            content += `บทที่ ${chapter.orderIndex}: ${chapter.title}\n`;
            content += `${"─".repeat(40)}\n\n`;

            const chapterNotes = notesByChapter.get(chapter.id) || [];
            for (const note of chapterNotes) {
                if (note.title) {
                    content += `\n[ ${note.title} ]\n`;
                }
                const text = note.content?.text || "";
                content += htmlToPlainText(text);
                content += "\n\n";
            }
        }

        return content.trim();
    }

    // Export as TXT
    function exportAsTxt() {
        const content = generateContent();
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${novelTitle.replace(/[^a-zA-Z0-9ก-๙]/g, "_")}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Export as PDF (using browser print)
    async function exportAsPdf() {
        // Create a new window with styled content
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("กรุณาอนุญาต popup เพื่อ export PDF");
            return;
        }

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${novelTitle}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Sarabun', sans-serif;
            font-size: 11pt;
            line-height: 1.8;
            padding: 2cm;
            max-width: 21cm;
            margin: 0 auto;
            color: #1a1a1a;
        }
        
        .cover-page {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            page-break-after: always;
            text-align: center;
        }

        h1 {
            font-size: 24pt;
            text-align: center;
            font-weight: 700;
        }
        
        .chapter-title {
            font-size: 18pt;
            font-weight: 700;
            margin-top: 1.5cm;
            margin-bottom: 0.5cm;
            page-break-before: always;
            border-bottom: 2px solid #333;
            padding-bottom: 0.3cm;
            text-align: center;
        }
        
        .note-title {
            font-size: 15pt;
            font-weight: 700;
            margin-top: 1cm;
            margin-bottom: 0.5cm;
            color: #444;
            text-decoration: underline;
            text-underline-offset: 4px;
        }
        
        .note-container {
            margin-bottom: 1.5cm;
        }
        
        p {
            text-indent: 2em;
            margin-bottom: 0.5em;
            text-align: justify;
        }
        
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="cover-page">
        <h1>${novelTitle}</h1>
        ${authorName ? `<div style="margin-top: 1cm; font-size: 14pt; color: #444;">โดย ${authorName}</div>` : ''}
    </div>
    ${(() => {
                const sortedChapters = [...chapters]
                    .filter((c) => selectedChapters.has(c.id))
                    .sort((a, b) => a.orderIndex - b.orderIndex);

                return sortedChapters.map((chapter) => {
                    const chapterNotes = notesByChapter.get(chapter.id) || [];
                    const notesHtml = chapterNotes
                        .map((note) => {
                            const noteTitle = note.title ? `<div class="note-title">${note.title}</div>` : '';
                            const text = htmlToPlainText(note.content?.text || "");
                            const paragraphs = text
                                .split("\n\n")
                                .filter(Boolean)
                                .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
                                .join("");
                            return `<div class="note-container">${noteTitle}${paragraphs}</div>`;
                        })
                        .join("");

                    return `
                <div class="chapter-title">บทที่ ${chapter.orderIndex}: ${chapter.title}</div>
                ${notesHtml}
            `;
                }).join("");
            })()}
</body>
</html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        // Wait for fonts to load then print
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
            }, 500);
        };
    }

    // Export as ePub (client-side, reuse chapter/note grouping)
    async function exportAsEpub() {
        // dynamic import: browser bundle (bundles jszip), keep out of SSR + initial chunk
        const { default: epub } = await import("epub-gen-memory/bundle");

        const sortedChapters = [...chapters]
            .filter((c) => selectedChapters.has(c.id))
            .sort((a, b) => a.orderIndex - b.orderIndex);

        const epubChapters = sortedChapters.map((chapter) => {
            const chapterNotes = notesByChapter.get(chapter.id) || [];
            const body = chapterNotes
                .map((n) => noteToXhtml(n.title, n.content?.text || ""))
                .join("");
            return {
                title: `บทที่ ${chapter.orderIndex}: ${chapter.title}`,
                content: body || "<p></p>",
            };
        });

        const baseOptions = {
            title: novelTitle,
            author: authorName || "ไม่ระบุผู้เขียน",
            lang: "th",
        };

        let blob: Blob;
        try {
            blob = await epub(
                coverImage ? { ...baseOptions, cover: coverImage } : baseOptions,
                epubChapters,
            );
        } catch (e) {
            // cover fetch (CORS) อาจล้ม → ลองใหม่แบบไม่มีปก
            if (coverImage) {
                blob = await epub(baseOptions, epubChapters);
                toast.warning("ใส่ภาพปกไม่สำเร็จ — export แบบไม่มีปกแทน");
            } else {
                throw e;
            }
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${novelTitle.replace(/[^a-zA-Z0-9ก-๙]/g, "_")}.epub`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Handle export
    async function handleExport() {
        if (selectedChapters.size === 0) {
            toast.error("กรุณาเลือกอย่างน้อย 1 บท");
            return;
        }

        setIsExporting(true);
        try {
            if (format === "txt") {
                exportAsTxt();
                toast.success("Export สำเร็จ!");
            } else if (format === "pdf") {
                await exportAsPdf();
                toast.success("กรุณา Save as PDF จาก Print dialog");
            } else if (format === "epub") {
                await exportAsEpub();
                toast.success("Export ePub สำเร็จ!");
            }
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Export ไม่สำเร็จ");
        } finally {
            setIsExporting(false);
        }
    }

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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Book className="h-5 w-5" />
                        Export Novel
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Format selection */}
                    <div className="space-y-2">
                        <Label>Format</Label>
                        <div className="flex gap-2">
                            <Button
                                variant={format === "txt" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormat("txt")}
                                className="flex-1"
                            >
                                <FileText className="h-4 w-4 mr-1" />
                                TXT
                            </Button>
                            <Button
                                variant={format === "pdf" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormat("pdf")}
                                className="flex-1"
                            >
                                <FileType className="h-4 w-4 mr-1" />
                                PDF
                            </Button>
                            <Button
                                variant={format === "epub" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setFormat("epub")}
                                className="flex-1"
                            >
                                <Book className="h-4 w-4 mr-1" />
                                ePub
                            </Button>
                        </div>
                    </div>

                    {/* Chapter selection */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label>เลือกบท</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={toggleAll}
                            >
                                {selectedChapters.size === chapters.length
                                    ? "ยกเลิกทั้งหมด"
                                    : "เลือกทั้งหมด"}
                            </Button>
                        </div>
                        <ScrollArea className="h-[200px] border rounded-md p-2">
                            <div className="space-y-1">
                                {chapters
                                    .sort((a, b) => a.orderIndex - b.orderIndex)
                                    .map((chapter) => (
                                        <div
                                            key={chapter.id}
                                            className="flex items-center space-x-2 py-1"
                                        >
                                            <Checkbox
                                                id={chapter.id}
                                                checked={selectedChapters.has(chapter.id)}
                                                onCheckedChange={() => toggleChapter(chapter.id)}
                                            />
                                            <Label
                                                htmlFor={chapter.id}
                                                className="text-sm cursor-pointer flex-1"
                                            >
                                                บทที่ {chapter.orderIndex}: {chapter.title}
                                            </Label>
                                        </div>
                                    ))}
                            </div>
                        </ScrollArea>
                        <p className="text-xs text-muted-foreground">
                            เลือก {selectedChapters.size} / {chapters.length} บท
                        </p>
                    </div>

                    {/* Export button */}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting || selectedChapters.size === 0}
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
                                Export {format.toUpperCase()}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, BarChart3 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { updateChapter } from "@/server/chapter";
import { CastDeck } from "./cast-deck";
import { cn } from "@/lib/utils";

import "react-quill-new/dist/quill.snow.css";
const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

interface ChapterEditorProps {
    chapter: any;
    novelId: string;
}

/**
 * Count words in text, supporting Thai language using Intl.Segmenter
 */
function countWords(htmlContent: string): number {
    const text = htmlContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();

    if (!text) return 0;

    // Try to use Intl.Segmenter for Thai text if available
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
        try {
            const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
            let count = 0;
            for (const segment of segmenter.segment(text)) {
                if (segment.isWordLike) {
                    count++;
                }
            }
            return count;
        } catch (e) {
            // Fallback below
        }
    }

    // Fallback: Split by whitespace
    return text.replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 0).length;
}

export function ChapterEditor({ chapter, novelId }: ChapterEditorProps) {
    const router = useRouter();
    const [title, setTitle] = useState(chapter.title);
    const [content, setContent] = useState(chapter.content?.text || ""); // Assuming content structure
    const [isSaving, setIsSaving] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Calculate word count
    const wordCount = useMemo(() => countWords(content), [content]);

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateChapter(chapter.id, {
            title,
            content: { text: content },
            wordCount: wordCount
        });

        if (result.success) {
            toast.success("Saved successfully");
            router.refresh();
        } else {
            toast.error("Failed to save");
        }
        setIsSaving(false);
    };

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        try {
            // Save first to get latest content
            await handleSave();
            
            const res = await fetch(`/api/novel/${novelId}/chapter/${chapter.id}/stylometry`, {
                method: 'POST',
            });
            const data = await res.json();
            
            if (data.success) {
                toast.success("วิเคราะห์อารมณ์และลีลาการเขียนสำเร็จ");
                console.log("Stylometry metrics:", data.data);
            } else {
                toast.error(data.error || "เกิดข้อผิดพลาดในการวิเคราะห์");
            }
        } catch (e) {
            toast.error("เชื่อมต่อระบบวิเคราะห์ล้มเหลว");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const modules = useMemo(() => ({
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['clean']
        ],
    }), []);

    return (
        <div className="flex flex-col h-[calc(100vh-2rem)] gap-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`/dashboard/project/${novelId}`}>
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-lg font-bold border-none shadow-none focus-visible:ring-0 px-0 h-auto p-0"
                            placeholder="Chapter Title"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                        {wordCount.toLocaleString()} words
                    </div>
                    <Button variant="outline" onClick={handleAnalyze} disabled={isAnalyzing || isSaving} className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200">
                        <BarChart3 className="h-4 w-4 mr-2" />
                        {isAnalyzing ? "กำลังวิเคราะห์..." : "วิเคราะห์ลีลาการเขียน"}
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || isAnalyzing}>
                        <Save className="h-4 w-4 mr-2" />
                        {isSaving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            {/* Cast Deck */}
            <div className="border rounded-lg bg-muted/30">
                <CastDeck
                    chapterId={chapter.id}
                    novelId={novelId}
                    chapterOrderIndex={chapter.orderIndex}
                />
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden flex flex-col border rounded-lg bg-background">
                <ReactQuill
                    theme="snow"
                    value={content}
                    onChange={setContent}
                    modules={modules}
                    className="h-full flex flex-col [&>.ql-container]:flex-1 [&>.ql-container]:overflow-y-auto [&>.ql-container]:text-base [&>.ql-toolbar]:border-t-0 [&>.ql-toolbar]:border-x-0 [&>.ql-container]:border-x-0 [&>.ql-container]:border-b-0"
                    placeholder="Start writing your chapter..."
                />
            </div>
        </div>
    );
}


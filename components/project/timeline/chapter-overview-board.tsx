"use client";

import { Button } from "@/components/ui/button";
import { Download, Clapperboard } from "lucide-react";
import { toast } from "sonner";
import type { ThreadWithBeats } from "@/server/plot-threads";
import { ChapterRecapButton } from "./chapter-recap-panel";
import { PacingLine } from "./pacing-line";

// ความกว้าง/gap ต่อ "ช่องฉาก" หนึ่งช่องบนเส้นจังหวะ — ไม่มีการ์ดแสดงจริงในบอร์ดนี้แล้ว
// (ตัด StoryboardFrame/MiniPoster ออกตามที่ผู้ใช้ขอ ให้เปิดมาเป็นกราฟไปเลย) ค่านี้คุมแค่ระยะห่างจุดบนกราฟ
export const CARD_WIDTH = 215;
export const CARD_GAP = 14;

// ----------------------------------------------------------------------
// Main Board — หน้านี้ตอนนี้คือกราฟจังหวะเต็มจอล้วน (ตัด pan/zoom/การ์ดฉากออกหมดตามที่ขอ)
// ----------------------------------------------------------------------
interface ChapterOverviewBoardProps {
    novelId: string;
    chapterId: string;
    chapterTitle: string;
    events: any[];
    threads?: ThreadWithBeats[];
    initialChapterRecap?: string | null;
}

export function ChapterOverviewBoard({ novelId, chapterId, chapterTitle, events, initialChapterRecap }: ChapterOverviewBoardProps) {
    const handleExportAll = () => {
        const exportData = {
            exportedAt: new Date().toISOString(),
            chapterTitle,
            totalScenes: events.length,
            scenes: events.map((event, index) => ({
                sceneNumber: index + 1,
                sceneId: event.id,
                sceneTitle: event.title,
                goal: event.sceneGoal,
                conflict: event.sceneConflict,
                outcome: event.sceneOutcome,
                valueShift: event.valueShift,
                items: ((event.canvasData as any[]) || []).map((item: any) => ({
                    id: item.id, type: item.type, title: item.title, content: item.content,
                })),
            })),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const safeTitle = chapterTitle.replace(/[^a-zA-Z0-9ก-๙]/g, "_").substring(0, 50);
        a.download = `chapter-${safeTitle}-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Export สำเร็จ! (${events.length} scenes)`);
    };

    return (
        <div className="w-full h-full flex flex-col bg-white">
            {/* Header */}
            <div className="h-16 shrink-0 bg-white border-b border-zinc-200 flex items-center px-6 justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    <Clapperboard className="h-5 w-5 text-[var(--forge-amber)] shrink-0" />
                    <h2 className="font-display font-semibold text-lg text-zinc-900 truncate">{chapterTitle}</h2>
                    <span className="font-technical text-[10px] uppercase tracking-widest text-zinc-500 border border-zinc-300 px-2 py-1 rounded-full shrink-0">
                        {events.length} scenes
                    </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <ChapterRecapButton novelId={novelId} chapterId={chapterId} initialRecap={initialChapterRecap} />
                    <Button variant="outline" size="sm" onClick={handleExportAll}
                        className="h-9 gap-1.5 chamfered-sm font-technical text-[9px] uppercase tracking-[0.08em]">
                        <Download className="h-3.5 w-3.5" />export
                    </Button>
                </div>
            </div>

            {/* กราฟจังหวะ — เต็มพื้นที่ที่เหลือ */}
            <div className="flex-1 min-h-0">
                {events.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-400 font-technical uppercase tracking-widest text-sm">
                        ยังไม่มีฉากในบทนี้
                    </div>
                ) : (
                    <PacingLine events={events} novelId={novelId} chapterId={chapterId} chapterTitle={chapterTitle} />
                )}
            </div>
        </div>
    );
}

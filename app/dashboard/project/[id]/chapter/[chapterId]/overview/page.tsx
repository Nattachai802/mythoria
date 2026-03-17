
import { getChapterOverview } from "@/server/chapter-overview";
import { getChapter } from "@/server/chapter";
import { ChapterOverviewBoard } from "@/components/project/timeline/chapter-overview-board";

export default async function ChapterOverviewPage({ params }: { params: Promise<{ id: string, chapterId: string }> }) {
    const { chapterId } = await params;

    // Fetch Data Parallelly
    const [overviewData, chapterData] = await Promise.all([
        getChapterOverview(chapterId),
        getChapter(chapterId)
    ]);

    if (!chapterData.success || !chapterData.chapter) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-800">Chapter not found</h1>
                    <p className="text-slate-500">The requested chapter details could not be loaded.</p>
                </div>
            </div>
        );
    }

    const events = overviewData.success ? overviewData.events : [];

    return (
        <div className="h-screen w-full overflow-hidden">
            <ChapterOverviewBoard
                chapterTitle={chapterData.chapter.title}
                events={events}
            />
        </div>
    );
}

import { notFound } from "next/navigation";
import { getChapter } from "@/server/chapter";
import { getNovelById } from "@/server/novel";
import { ChapterEditor } from "@/components/project/chapter/chapter-editor";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface ChapterPageProps {
    params: Promise<{
        id: string; // novelId
        chapterId: string;
    }>;
}

export default async function ChapterPage({ params }: ChapterPageProps) {
    const { id: novelId, chapterId } = await params;

    const [result, novelResult] = await Promise.all([
        getChapter(chapterId),
        getNovelById(novelId)
    ]);

    if (!result.success || !result.chapter) {
        notFound();
    }

    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-6 h-full">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[{ label: result.chapter.title }]}
            />
            <ChapterEditor chapter={result.chapter} novelId={novelId} />
        </div>
    );
}

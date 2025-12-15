import { notFound } from "next/navigation"
import { getNovelById } from "@/server/novel"
import { getTimeLineEvents } from "@/server/timeline"
import { TimelineBoard } from "@/components/project/timeline/timeline-board" // ชื่อ Component ยังใช้ TimelineBoard ได้ หรือจะเปลี่ยนเป็น PlotBoard ก็ได้
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"

type Props = {
    params: Promise<{ id: string }>
}

export default async function PlotPage({ params }: Props) {
    const { id } = await params // ดึง id จาก URL /project/[id]/plot

    const [novelResult, eventsResult] = await Promise.all([
        getNovelById(id),
        getTimeLineEvents(id)
    ])

    if (!novelResult.success || !novelResult.novel) {
        notFound()
    }

    const novel = novelResult.novel
    const events = eventsResult.events || []

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div>
                    <ProjectBreadcrumb
                        novelId={id}
                        novelTitle={novel.title}
                        items={[{ label: "Plot Board" }]}
                    />
                    <h1 className="text-lg font-semibold">Plot Board</h1> {/* เปลี่ยนชื่อ Title */}
                    <p className="text-sm text-muted-foreground">
                        Manage your plot and events for "{novel.title}"
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-muted/10">
                <TimelineBoard
                    novelId={novel.id}
                    chapters={novel.chapters}
                    initialEvents={events}
                />
            </div>
        </div>
    )
}
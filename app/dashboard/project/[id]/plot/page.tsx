import { notFound } from "next/navigation"
import { getNovelForPlot } from "@/server/novel"
import { getTimeLineEvents } from "@/server/timeline"
import { getCharactersByNovelId } from "@/server/character"
import { getLocationsByNovelId } from "@/server/locations"
import { getThreadsByNovelId } from "@/server/plot-threads"
import { getArcsByNovelId } from "@/server/story-arcs"
import { getErasByNovelId } from "@/server/eras"
import { TimelineBoard } from "@/components/project/timeline/timeline-board"
import { PLOT_HEADER_SLOT_ID } from "@/components/project/timeline/types"
import { PlotThreadsView } from "@/components/project/timeline/plot-thread-ledger"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"
import { PlotPageTabs } from "@/components/plot/analysis/plot-page-tabs"

type Props = {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tab?: string }>
}

export default async function PlotPage({ params, searchParams }: Props) {
    const { id } = await params
    const { tab } = await searchParams
    // ?tab=analysis เดิมถูกถอดแล้ว — ลิงก์เก่าตกมาที่กระดาน
    const isThreadsTab = tab === "threads"

    const [novelResult, eventsResult, charactersResult, locationsResult, threadsResult, arcsResult, erasResult] = await Promise.all([
        getNovelForPlot(id),
        getTimeLineEvents(id),
        getCharactersByNovelId(id),
        getLocationsByNovelId(id),
        getThreadsByNovelId(id),
        getArcsByNovelId(id),
        getErasByNovelId(id),
    ])

    if (!novelResult.success || !novelResult.novel) {
        notFound()
    }

    const novel = novelResult.novel
    const events = eventsResult.events || []
    const characters = charactersResult.data || []
    const locations = locationsResult.data || []
    const threads = threadsResult.data || []
    const arcs = arcsResult.data || []
    const eras = erasResult.success ? erasResult.data : []

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Header — แถวเดียว: breadcrumb + แท็บ ซ้าย · เครื่องมือกระดานขวา (TimelineBoard portal เข้า slot) */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 pt-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
                    <div className="pb-2">
                        <ProjectBreadcrumb
                            novelId={id}
                            novelTitle={novel.title}
                            items={[{ label: "กระดานพล็อต" }]}
                        />
                    </div>
                    <PlotPageTabs
                        novelId={id}
                        activeTab={isThreadsTab ? "threads" : "board"}
                        threads={threads}
                        events={events}
                        chapters={novel.chapters}
                    />
                </div>
                <div id={PLOT_HEADER_SLOT_ID} className="pb-2" />
            </div>

            {/* Content — ตาม tab */}
            {isThreadsTab ? (
                <div className="flex-1 min-h-0 overflow-hidden">
                    <PlotThreadsView
                        novelId={novel.id}
                        threads={threads}
                        events={events}
                        chapters={novel.chapters}
                    />
                </div>
            ) : (
                <div className="flex-1 overflow-hidden bg-muted/10">
                    <TimelineBoard
                        novelId={novel.id}
                        chapters={novel.chapters}
                        initialEvents={events}
                        characters={characters}
                        locations={locations}
                        threads={threads}
                        arcs={arcs}
                        eras={eras}
                        timelineEpoch={novel.timelineEpoch}
                    />
                </div>
            )}
        </div>
    )
}

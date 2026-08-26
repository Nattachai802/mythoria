import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getNovelForPlot } from "@/server/novel"
import { getTimeLineEvents } from "@/server/timeline"
import { getCharactersByNovelId } from "@/server/character"
import { getLocationsByNovelId } from "@/server/locations"
import { getThreadsByNovelId } from "@/server/plot-threads"
import { getArcsByNovelId } from "@/server/story-arcs"
import { getErasByNovelId } from "@/server/eras"
import { getPlotAnalysis, getAllEchoFindings } from "@/server/plot-analysis"
import { TimelineBoard } from "@/components/project/timeline/timeline-board"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"
import { PlotPageTabs } from "@/components/plot/analysis/plot-page-tabs"
import { PlotAnalysisPanel } from "@/components/plot/analysis/plot-analysis-panel"

type Props = {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tab?: string }>
}

export default async function PlotPage({ params, searchParams }: Props) {
    const { id } = await params
    const { tab } = await searchParams
    const isAnalysisTab = tab === "analysis"

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
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex flex-col gap-1 pb-0">
                    <ProjectBreadcrumb
                        novelId={id}
                        novelTitle={novel.title}
                        items={[{ label: "กระดานพล็อต" }]}
                    />
                    <h1 className="text-lg font-display font-semibold">กระดานพล็อต</h1>
                </div>
                <PlotPageTabs novelId={id} activeTab={isAnalysisTab ? "analysis" : "board"} />
            </div>

            {/* Content — ตาม tab */}
            {isAnalysisTab ? (
                <div className="flex-1 overflow-y-auto" style={{ padding: "24px 24px 40px" }}>
                    <Suspense fallback={<AnalysisLoading />}>
                        <PlotAnalysisTabServer novelId={id} />
                    </Suspense>
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

function AnalysisLoading() {
    return (
        <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-technical)", fontSize: 13, color: "var(--muted-foreground)" }}>
                กำลังวิเคราะห์…
            </p>
        </div>
    )
}

// Server component ที่เรียก getPlotAnalysis ตรงๆ (static import)
async function PlotAnalysisTabServer({ novelId }: { novelId: string }) {
    const [result, echoFindings] = await Promise.all([
        getPlotAnalysis(novelId),
        getAllEchoFindings(novelId),
    ])

    if (!result.success) {
        return (
            <p style={{ fontFamily: "var(--font-technical)", fontSize: 13, color: "var(--destructive)" }}>
                {result.error}
            </p>
        )
    }

    // echoFindings = ผล Echo Score เก่าจาก plot_findings จัดกลุ่มตาม sceneId
    // (แถวที่รันก่อนหน้านี้อาจไม่มี meta การ์ด — panel รับได้เพราะ fallback ที่ loader)
    return (
        <PlotAnalysisPanel
            novelId={novelId}
            report={result.report}
            verdicts={result.verdicts}
            echoFindings={echoFindings}
        />
    )
}
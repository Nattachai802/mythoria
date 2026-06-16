import { notFound } from "next/navigation"
import { getNovelById } from "@/server/novel"
import { getTimeLineEvents } from "@/server/timeline"
import { getCharactersByNovelId } from "@/server/character"
import { getLocationsByNovelId } from "@/server/locations"
import { getThreadsByNovelId } from "@/server/plot-threads"
import { getArcsByNovelId } from "@/server/story-arcs"
import { TimelineBoard } from "@/components/project/timeline/timeline-board"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"

type Props = {
    params: Promise<{ id: string }>
}

export default async function PlotPage({ params }: Props) {
    const { id } = await params

    const [novelResult, eventsResult, charactersResult, locationsResult, threadsResult, arcsResult] = await Promise.all([
        getNovelById(id),
        getTimeLineEvents(id),
        getCharactersByNovelId(id),
        getLocationsByNovelId(id),
        getThreadsByNovelId(id),
        getArcsByNovelId(id),
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

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div>
                    <ProjectBreadcrumb
                        novelId={id}
                        novelTitle={novel.title}
                        items={[{ label: "กระดานพล็อต" }]}
                    />
                    <h1 className="text-lg font-display font-semibold">กระดานพล็อต</h1>
                    <p className="text-sm text-muted-foreground">
                        วางโครงเรื่องและฉากของ &ldquo;{novel.title}&rdquo;
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-muted/10">
                <TimelineBoard
                    novelId={novel.id}
                    chapters={novel.chapters}
                    initialEvents={events}
                    characters={characters}
                    locations={locations}
                    threads={threads}
                    arcs={arcs}
                />
            </div>
        </div>
    )
}
import { getTimelineEventById, getTimeLineEvents, getNovelBoardChapters } from "@/server/timeline";
import { getCharactersByNovelId } from "@/server/character";
import { getLocationsByNovelId } from "@/server/locations";
import { getIdeasByNovelId } from "@/server/idea";
import { getChapters } from "@/server/chapter";
import { getNovelByIdSimple } from "@/server/novel";
import { getThreadsByNovelId } from "@/server/plot-threads";
import { getFactionsByNovelId } from "@/server/factions";
import { getEchoFindings } from "@/server/plot-analysis";
import { getSceneRecap } from "@/server/plot-recap";
import { getTonePresets } from "@/server/tone-presets";
import { PlaygroundBoard } from "@/components/plot/playground/playground-board";
import { SceneNavigator } from "@/components/plot/playground/scene-navigator";
import { SceneDramaticPanel } from "@/components/plot/playground/scene-dramatic-panel";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { notFound } from "next/navigation";

interface PlotPlaygroundPageProps {
  params: Promise<{
    id: string;
    eventId: string;
  }>;
  searchParams: Promise<{ action?: string }>;
}

export default async function PlotPlaygroundPage({
  params,
  searchParams,
}: PlotPlaygroundPageProps) {
  const { id: novelId, eventId } = await params;
  const { action } = await searchParams;

  // Fetch all necessary data in parallel
  const [eventRes, charactersRes, locationsRes, ideasRes, eventsRes, chaptersRes, novelRes, threadsRes, factionsRes, boardChaptersRes, echoRes, toneRes, sceneRecap] = await Promise.all([
    getTimelineEventById(eventId),
    getCharactersByNovelId(novelId),
    getLocationsByNovelId(novelId),
    getIdeasByNovelId(novelId),
    getTimeLineEvents(novelId),
    getChapters(novelId),
    getNovelByIdSimple(novelId),
    getThreadsByNovelId(novelId),
    getFactionsByNovelId(novelId),
    getNovelBoardChapters(novelId),
    getEchoFindings(novelId, eventId),
    getTonePresets(),
    getSceneRecap(novelId, eventId),
  ]);

  if (!eventRes.success || !eventRes.event) {
    return notFound();
  }

  // Parse canvas data if it exists, otherwise empty array
  const initialCanvasData = eventRes.event.canvasData || [];
  const novelTitle = novelRes.novel?.title || "Project";
  const initialEchoFindings = echoRes.success ? echoRes.findings : [];

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      <div className="border-b bg-background p-4 flex flex-col gap-2">
        <ProjectBreadcrumb
          novelId={novelId}
          novelTitle={novelTitle}
          items={[
            { label: "Plot Board", href: `/dashboard/project/${novelId}/plot` },
            { label: eventRes.event.title }
          ]}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <SceneNavigator
            novelId={novelId}
            currentEvent={eventRes.event}
            events={eventsRes.events || []}
            chapters={chaptersRes.chapters || []}
          />
          <SceneDramaticPanel event={eventRes.event} characters={charactersRes.data || []} events={eventsRes.events || []} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <PlaygroundBoard
          eventId={eventId}
          novelId={novelId}
          event={eventRes.event}
          initialItems={initialCanvasData as any[]}
          boardChapters={boardChaptersRes.data || []}
          characters={charactersRes.data || []}
          locations={locationsRes.data || []}
          ideas={ideasRes.data || []}
          threads={threadsRes.data || []}
          factions={factionsRes.data || []}
          tonePresets={toneRes.data || []}
          initialEchoFindings={initialEchoFindings}
          initialSceneRecap={sceneRecap}
        />
      </div>
    </div>
  );
}

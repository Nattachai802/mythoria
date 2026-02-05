import { getTimelineEventById, getTimeLineEvents } from "@/server/timeline";
import { getCharactersByNovelId } from "@/server/character";
import { getLocationsByNovelId } from "@/server/locations";
import { getIdeasByNovelId } from "@/server/idea";
import { getChapters } from "@/server/chapter";
import { getNovelById } from "@/server/novel";
import { PlaygroundBoard } from "@/components/plot/playground/playground-board";
import { SceneNavigator } from "@/components/plot/playground/scene-navigator";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { notFound } from "next/navigation";

interface PlotPlaygroundPageProps {
  params: Promise<{
    id: string;
    eventId: string;
  }>;
}

export default async function PlotPlaygroundPage({
  params,
}: PlotPlaygroundPageProps) {
  const { id: novelId, eventId } = await params;

  /* console.log removed */
  const fs = require('fs');
  const path = require('path');
  const logPath = path.join(process.cwd(), 'debug-event.log');
  fs.appendFileSync(logPath, `[Page] PlotPlaygroundPage params: novelId=${novelId}, eventId=${eventId}\n`);

  // Fetch all necessary data in parallel
  const [eventRes, charactersRes, locationsRes, ideasRes, eventsRes, chaptersRes, novelRes] = await Promise.all([
    getTimelineEventById(eventId),
    getCharactersByNovelId(novelId),
    getLocationsByNovelId(novelId),
    getIdeasByNovelId(novelId),
    getTimeLineEvents(novelId),
    getChapters(novelId),
    getNovelById(novelId),
  ]);

  if (!eventRes.success || !eventRes.event) {
    fs.appendFileSync(logPath, `[Page] 404 trigger: success=${eventRes.success}, hasEvent=${!!eventRes.event}\n`);
    return notFound();
  }

  // Parse canvas data if it exists, otherwise empty array
  const initialCanvasData = eventRes.event.canvasData || [];
  const novelTitle = novelRes.novel?.title || "Project";

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
        <SceneNavigator
          novelId={novelId}
          currentEvent={eventRes.event}
          events={eventsRes.events || []}
          chapters={chaptersRes.chapters || []}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <PlaygroundBoard
          eventId={eventId}
          novelId={novelId}
          initialItems={initialCanvasData as any[]}
          characters={charactersRes.data || []}
          locations={locationsRes.data || []}
          ideas={ideasRes.data || []}
        />
      </div>
    </div>
  );
}
import { getTimelineEventById, getTimeLineEvents, getNovelBoardChapters } from "@/server/timeline";
import { getCharactersByNovelId } from "@/server/character";
import { getLocationsByNovelId } from "@/server/locations";
import { getIdeasByNovelId } from "@/server/idea";
import { getChapters } from "@/server/chapter";
import { getNovelByIdSimple } from "@/server/novel";
import { getThreadsByNovelId } from "@/server/plot-threads";
import { getFactionsByNovelId } from "@/server/factions";
import { getPowersByNovelId } from "@/server/power";
import { getItemsByNovelId } from "@/server/items";
import { getEntitiesByNovelId } from "@/server/entities";
import { getWorldSystemsByNovelId } from "@/server/world-systems";
import { getEchoFindings } from "@/server/plot-analysis";
import { getSceneRecap } from "@/server/plot-recap";
import { getTonePresets } from "@/server/tone-presets";
import { getParticipantLinks } from "@/server/participant-links";
import { PlaygroundBoard } from "@/components/plot/playground/playground-board";
import { SceneNavigator } from "@/components/plot/playground/scene-navigator";
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
  const [eventRes, charactersRes, locationsRes, ideasRes, eventsRes, chaptersRes, novelRes, threadsRes, factionsRes, boardChaptersRes, echoRes, toneRes, sceneRecap, powersRes, itemsRes, entitiesRes, systemsRes, participantLinks] = await Promise.all([
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
    getPowersByNovelId(novelId),
    getItemsByNovelId(novelId),
    getEntitiesByNovelId(novelId),
    getWorldSystemsByNovelId(novelId),
    getParticipantLinks(novelId),
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
      {/* header แถวเดียว — SceneNavigator มีปุ่มย้อนกลับในตัวอยู่แล้ว ไม่ต้องมี breadcrumb เต็มซ้ำอีกชั้น
          โครงฉากดราม่าย้ายไปอยู่ในทูลบาร์กระดาน เพราะเป็นข้อมูลอ้างอิง ไม่ใช่ของที่ต้องเห็นตลอด */}
      <div className="border-b bg-background px-4 py-2 flex items-center gap-3">
        <SceneNavigator
          novelId={novelId}
          currentEvent={eventRes.event}
          events={eventsRes.events || []}
          chapters={chaptersRes.chapters || []}
        />
        <span className="truncate text-xs text-muted-foreground" title={novelTitle}>
          {novelTitle}
        </span>
      </div>

      <div className="flex-1 overflow-hidden">
        <PlaygroundBoard
          eventId={eventId}
          novelId={novelId}
          event={eventRes.event}
          sceneEvents={eventsRes.events || []}
          initialItems={initialCanvasData as any[]}
          boardChapters={boardChaptersRes.data || []}
          characters={charactersRes.data || []}
          ideas={ideasRes.data || []}
          threads={threadsRes.data || []}
          factions={factionsRes.data || []}
          powers={powersRes.data || []}
          items={itemsRes.data || []}
          entities={entitiesRes.data || []}
          worldSystems={systemsRes.data || []}
          tonePresets={toneRes.data || []}
          initialEchoFindings={initialEchoFindings}
          participantLinks={participantLinks}
          initialSceneRecap={sceneRecap}
        />
      </div>
    </div>
  );
}

import { getIdeasByNovelId } from "@/server/idea";
import { getChapters } from "@/server/chapter";
import { getNovelByIdSimple } from "@/server/novel";
import { syncDiscordIdeas } from "@/server/discord-sync";
import { CreateIdeaDialog } from "@/components/project/idea/create-idea-dialog";
import { IdeasView } from "@/components/project/idea/ideas-view";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { DiscordSyncButton } from "@/components/project/idea/discord-sync-button";
import { DeleteAllIdeasButton } from "@/components/project/idea/delete-all-ideas-button";

interface IdeasPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function IdeasPage({ params }: IdeasPageProps) {
  const { id: novelId } = await params;

  // Sync Discord ideas เฉพาะตอนเข้าหน้านี้แทน (ย้ายมาจาก layout)
  const [ideasResult, chaptersResult, novelResult, syncResult] = await Promise.all([
    getIdeasByNovelId(novelId, true),
    getChapters(novelId),
    getNovelByIdSimple(novelId),
    syncDiscordIdeas(novelId),
  ]);

  if (syncResult.synced > 0) {
    console.log(`[Discord sync] Synced ${syncResult.synced} ideas`);
  }

  if (!ideasResult.success) {
    return (
      <div className="p-8">
        <p className="text-red-500">Error loading ideas: {ideasResult.error}</p>
      </div>
    );
  }

  const ideas = ideasResult.data || [];
  const activeIdeasCount = ideas.filter(idea => !idea.isDetected).length;
  const chapters = chaptersResult.success
    ? (chaptersResult.chapters || []).map(ch => ({ id: ch.id, title: ch.title }))
    : [];
  const novelTitle = novelResult.novel?.title || "Project";

  return (
    <div className="p-8">
      <ProjectBreadcrumb
        novelId={novelId}
        novelTitle={novelTitle}
        items={[{ label: "Ideas" }]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Ideas</h1>
          <p className="text-muted-foreground mt-1">
            Your creative idea vault
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DeleteAllIdeasButton novelId={novelId} ideaCount={activeIdeasCount} />
          <DiscordSyncButton novelId={novelId} />
          <CreateIdeaDialog novelId={novelId} />
        </div>
      </div>

      <IdeasView
        ideas={ideas}
        novelId={novelId}
        chapters={chapters}
      />
    </div>
  );
}
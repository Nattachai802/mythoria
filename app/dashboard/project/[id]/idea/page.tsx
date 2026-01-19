import { getIdeasByNovelId } from "@/server/idea";
import { getChapters } from "@/server/chapter";
import { getNovelById } from "@/server/novel";
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

  const [ideasResult, chaptersResult, novelResult] = await Promise.all([
    getIdeasByNovelId(novelId),
    getChapters(novelId),
    getNovelById(novelId),
  ]);

  if (!ideasResult.success) {
    return (
      <div className="p-8">
        <p className="text-red-500">Error loading ideas: {ideasResult.error}</p>
      </div>
    );
  }

  const ideas = ideasResult.data || [];
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
          <DeleteAllIdeasButton novelId={novelId} ideaCount={ideas.length} />
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
import { getCharactersByNovelId } from "@/server/character";
import { getNovelById } from "@/server/novel";
import { CreateCharacterButton } from "@/components/project/character/create-character-button";
import { CharacterList } from "@/components/project/character/character-list";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { AIAnalysisButton } from "@/components/project/character/ai-analysis-button";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Network } from "lucide-react";

interface CharactersPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CharactersPage({ params }: CharactersPageProps) {
  const { id: novelId } = await params;
  const [result, novelResult] = await Promise.all([
    getCharactersByNovelId(novelId),
    getNovelById(novelId)
  ]);

  if (!result.success) {
    return (
      <div className="p-8">
        <p className="text-red-500">Error loading characters: {result.error}</p>
      </div>
    );
  }

  const characters = result.data || [];
  const novelTitle = novelResult.novel?.title || "Project";

  return (
    <div className="p-8">
      <ProjectBreadcrumb
        novelId={novelId}
        novelTitle={novelTitle}
        items={[{ label: "Characters" }]}
      />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Characters</h1>
          <p className="text-muted-foreground mt-1">
            Manage your novel's characters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AIAnalysisButton novelId={novelId} />
          <Link href={`/dashboard/project/${novelId}/relationships`}>
            <Button variant="outline">
              <Network className="w-4 h-4 mr-2" />
              Relationship Board
            </Button>
          </Link>
          <CreateCharacterButton novelId={novelId} />
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No characters yet. Create your first character!
          </p>
          <CreateCharacterButton novelId={novelId} />
        </div>
      ) : (
        <CharacterList novelId={novelId} initialCharacters={characters} />
      )}
    </div>
  );
}


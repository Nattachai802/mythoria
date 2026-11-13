import { getCharactersByNovelId } from "@/server/character";
import { getAllFactionsWithMembers, getFactionRelationships, getFactionStatusPresets, getMembershipsByNovel } from "@/server/factions";
import { getIdeasByNovelId } from "@/server/idea";
import { getWorldSystemsByNovelId } from "@/server/world-systems";
import { FactionsContent } from "@/components/project/factions/factions-content";
import { cn } from "@/lib/utils";
import { getNovelByIdSimple } from "@/server/novel";
import { CreateCharacterButton } from "@/components/project/character/create-character-button";
import { CharacterList } from "@/components/project/character/character-list";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { AIAnalysisButton } from "@/components/project/character/ai-analysis-button";
import { ExportCharacterDialog } from "@/components/project/character/export-character-dialog";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Network } from "lucide-react";

interface CharactersPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{ view?: string }>;
}

/** ตัวละครและฝ่าย — หน้าเดียว 2 มุมมอง (?view=factions) · /factions redirect มาที่นี่ */
export default async function CharactersPage({ params, searchParams }: CharactersPageProps) {
  const { id: novelId } = await params;
  const view = (await searchParams).view === "factions" ? "factions" : "characters";
  const [result, novelResult, factionsResult, membershipsResult] = await Promise.all([
    getCharactersByNovelId(novelId),
    getNovelByIdSimple(novelId),
    getAllFactionsWithMembers(novelId),
    getMembershipsByNovel(novelId),
  ]);
  const factionList = factionsResult.data || [];

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

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">ตัวละครและฝ่าย</h1>
          <p className="text-muted-foreground mt-1">
            ตัวละคร กลุ่ม และตระกูลใน &ldquo;{novelTitle}&rdquo;
          </p>
        </div>
        {view === "characters" && <div className="flex items-center gap-2">
          <AIAnalysisButton novelId={novelId} />
          {characters.length > 0 && (
            <ExportCharacterDialog
              characters={characters}
              novelTitle={novelTitle}
            />
          )}
          <Link href={`/dashboard/project/${novelId}/relationships`}>
            <Button variant="outline">
              <Network className="w-4 h-4 mr-2" />
              Relationship Board
            </Button>
          </Link>
          <CreateCharacterButton novelId={novelId} />
        </div>}
      </div>

      <nav className="flex gap-6 border-b border-border mb-6" aria-label="มุมมอง">
        {([["characters", `ตัวละคร · ${characters.length}`], ["factions", `ฝ่าย · ${factionList.length}`]] as const).map(([v, label]) => (
          <Link key={v} href={v === "factions" ? "?view=factions" : "?"} scroll={false} aria-current={view === v ? "page" : undefined}
            className={cn("-mb-px py-2 text-sm border-b-2 transition-colors duration-200",
              view === v ? "border-[var(--forge-gold)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        ))}
      </nav>

      {view === "factions" ? (
        <FactionsTab novelId={novelId} characters={characters} factions={factionList} />
      ) : characters.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No characters yet. Create your first character!
          </p>
          <CreateCharacterButton novelId={novelId} />
        </div>
      ) : (
        <CharacterList novelId={novelId} initialCharacters={characters}
          factions={factionList.map((f) => ({ id: f.id, name: f.name, color: f.color }))}
          memberships={membershipsResult.data || []} />
      )}
    </div>
  );
}


/** แท็บฝ่าย = FactionsContent เดิมทั้งก้อน (บอร์ดสถานะ / tree / ความสัมพันธ์ฝ่าย) */
async function FactionsTab({ novelId, characters, factions }: {
  novelId: string;
  characters: Awaited<ReturnType<typeof getCharactersByNovelId>>["data"];
  factions: NonNullable<Awaited<ReturnType<typeof getAllFactionsWithMembers>>["data"]>;
}) {
  const [relsResult, presetsResult, ideasResult, systemsResult] = await Promise.all([
    getFactionRelationships(novelId),
    getFactionStatusPresets(novelId),
    getIdeasByNovelId(novelId),
    getWorldSystemsByNovelId(novelId),
  ]);
  return (
    // ponytail: FactionsContent ออกแบบให้เต็มจอ — ให้กรอบสูงคงที่แทนการรื้อ layout ข้างใน
    <div className="h-[calc(100vh-16rem)] min-h-[32rem] -mx-8 border-t border-border bg-muted/10 overflow-hidden">
      <FactionsContent
        novelId={novelId}
        initialFactions={factions}
        initialRelationships={relsResult.data || []}
        characters={characters || []}
        initialStatusPresets={presetsResult.data || []}
        ideas={ideasResult.data || []}
        systems={systemsResult.data || []}
      />
    </div>
  );
}

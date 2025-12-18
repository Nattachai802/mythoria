import { getCharacterById } from "@/server/character";
import { getNovelById } from "@/server/novel";
import { notFound } from "next/navigation";
import { CharacterDetailContent } from "@/components/project/character/character-detail-content";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface CharacterDetailPageProps {
    params: Promise<{
        id: string;
        characterId: string;
    }>;
}

export default async function CharacterDetailPage({
    params,
}: CharacterDetailPageProps) {
    const { id: novelId, characterId } = await params;

    const [result, novelResult] = await Promise.all([
        getCharacterById(characterId),
        getNovelById(novelId)
    ]);

    if (!result.success || !result.data) {
        notFound();
    }

    const character = result.data;
    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-8">
            <div className="relative z-10">
                <ProjectBreadcrumb
                    novelId={novelId}
                    novelTitle={novelTitle}
                    items={[
                        { label: "Characters", href: `/dashboard/project/${novelId}/characters` },
                        { label: character.name }
                    ]}
                />
            </div>
            <CharacterDetailContent character={character} novelId={novelId} />
        </div>
    );
}
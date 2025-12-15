import { getCharactersByNovelId, getAllCharacterRelationships } from "@/server/character";
import { getAllFactionsWithMembers } from "@/server/factions";
import { getNovelById } from "@/server/novel";
import { RelationshipView } from "@/components/project/relationships/relationship-view";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface RelationshipsPageProps {
    params: Promise<{ id: string }>;
}

export default async function RelationshipsPage({ params }: RelationshipsPageProps) {
    const { id: novelId } = await params;

    const [charactersResult, relationshipsResult, factionsResult, novelResult] = await Promise.all([
        getCharactersByNovelId(novelId),
        getAllCharacterRelationships(novelId),
        getAllFactionsWithMembers(novelId),
        getNovelById(novelId)
    ]);

    if (!charactersResult.success || !relationshipsResult.success) {
        return (
            <div className="p-8">
                <p className="text-red-500">Error loading data.</p>
            </div>
        );
    }

    const characters = charactersResult.data || [];
    const relationships = relationshipsResult.data || [];
    const factions = factionsResult.data || [];
    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-8 space-y-6">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[
                    { label: "Characters", href: `/dashboard/project/${novelId}/characters` },
                    { label: "Relationship Board" }
                ]}
            />

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Relationship Board</h1>
                <p className="text-muted-foreground">
                    Analyze how all your characters relate to one another.
                </p>
            </div>

            <RelationshipView
                novelId={novelId}
                initialCharacters={characters}
                initialRelationships={relationships}
                initialFactions={factions}
            />
        </div>
    );
}

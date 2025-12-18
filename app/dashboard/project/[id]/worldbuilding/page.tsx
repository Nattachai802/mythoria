import { getItemsByNovelId } from "@/server/items";
import { getLoreEntriesByNovelId } from "@/server/lore";
import { getLoreGroupsByNovelId } from "@/server/lore-groups";
import { getErasByNovelId } from "@/server/eras";
import { getEntitiesByNovelId } from "@/server/entities";
import { getLocationConnections } from "@/server/location-connections";
import { getNovelById } from "@/server/novel";
import { WorldBuildingContent } from "@/components/project/worldbuilding/worldbuilding-content";
import { notFound } from "next/navigation";

export default async function WorldBuildingPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    const novelResult = await getNovelById(id);
    if (!novelResult.success || !novelResult.novel) {
        notFound();
    }

    const [itemsResult, loreResult, loreGroupsResult, erasResult, entitiesResult, connectionsResult] = await Promise.all([
        getItemsByNovelId(id),
        getLoreEntriesByNovelId(id),
        getLoreGroupsByNovelId(id),
        getErasByNovelId(id),
        getEntitiesByNovelId(id),
        getLocationConnections(id),
    ]);

    return (
        <WorldBuildingContent
            novelId={id}
            novel={novelResult.novel}
            items={itemsResult.data || []}
            loreEntries={loreResult.data || []}
            loreGroups={loreGroupsResult.data || []}
            eras={erasResult.data || []}
            entities={entitiesResult.data || []}
            connections={connectionsResult.success ? connectionsResult.data || [] : []}
        />
    );
}



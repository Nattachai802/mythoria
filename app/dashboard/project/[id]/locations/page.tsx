import { getLocationsByNovelId } from "@/server/locations";
import { getLocationConnections } from "@/server/location-connections";
import { getNovelById } from "@/server/novel";
import { CreateLocationDialog } from "@/components/project/location/create-location-dialog";
import { LocationsView } from "@/components/project/location/locations-view";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface LocationsPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function LocationsPage({ params }: LocationsPageProps) {
    const { id: novelId } = await params;

    const [locationsResult, connectionsResult, novelResult] = await Promise.all([
        getLocationsByNovelId(novelId),
        getLocationConnections(novelId),
        getNovelById(novelId),
    ]);

    if (!locationsResult.success) {
        return (
            <div className="p-8">
                <p className="text-red-500">Error loading locations: {locationsResult.error}</p>
            </div>
        );
    }

    const locations = locationsResult.data || [];
    const connections = connectionsResult.success ? connectionsResult.data || [] : [];
    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-8">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[{ label: "Locations" }]}
            />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Locations</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your novel's locations and their connections
                    </p>
                </div>
                <CreateLocationDialog novelId={novelId} />
            </div>

            {locations.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                        No locations yet. Create your first location!
                    </p>
                    <CreateLocationDialog novelId={novelId} />
                </div>
            ) : (
                <LocationsView
                    locations={locations}
                    connections={connections}
                    novelId={novelId}
                />
            )}
        </div>
    );
}

import { getLocationById } from "@/server/locations";
import { getNovelById } from "@/server/novel";
import { getIdeasByNovelId } from "@/server/idea";
import { notFound } from "next/navigation";
import { LocationDetailContent } from "@/components/project/location/location-detail-content";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface LocationDetailPageProps {
    params: Promise<{
        id: string;
        locationId: string;
    }>;
}

export default async function LocationDetailPage({
    params,
}: LocationDetailPageProps) {
    const { id: novelId, locationId } = await params;

    const [result, novelResult, ideasResult] = await Promise.all([
        getLocationById(locationId),
        getNovelById(novelId),
        getIdeasByNovelId(novelId),
    ]);

    if (!result.success || !result.data) {
        notFound();
    }

    const location = result.data;
    const novelTitle = novelResult.novel?.title || "Project";
    const ideas = ideasResult.success ? ideasResult.data : [];

    return (
        <div className="p-8">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[
                    { label: "World Building", href: `/dashboard/project/${novelId}/worldbuilding` },
                    { label: location.name }
                ]}
            />
            <LocationDetailContent
                location={location}
                novelId={novelId}
                ideas={ideas}
            />
        </div>
    );
}

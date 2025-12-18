import { getPowerById } from "@/server/power";
import { getNovelById } from "@/server/novel";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { PowerDetailView } from "@/components/project/power/power-detail-view";
import { notFound } from "next/navigation";

interface PowerDetailPageProps {
    params: Promise<{
        id: string;
        powerId: string;
    }>;
}

export default async function PowerDetailPage({ params }: PowerDetailPageProps) {
    const { id: novelId, powerId } = await params;

    const [powerResult, novelResult] = await Promise.all([
        getPowerById(powerId),
        getNovelById(novelId),
    ]);

    if (!powerResult.success || !powerResult.data) {
        notFound();
    }

    const power = powerResult.data;
    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-8">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[
                    { label: "Powers", href: `/dashboard/project/${novelId}/powers` },
                    { label: power.name }
                ]}
            />

            <PowerDetailView
                power={power}
                novelId={novelId}
            />
        </div>
    );
}

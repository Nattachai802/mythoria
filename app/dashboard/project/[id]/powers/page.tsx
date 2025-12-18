import { getPowersByNovelId } from "@/server/power";
import { getNovelById } from "@/server/novel";
import { CreatePowerDialog } from "@/components/project/power/create-power-dialog";
import { PowersView } from "@/components/project/power/powers-view";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface PowersPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function PowersPage({ params }: PowersPageProps) {
    const { id: novelId } = await params;

    const [powersResult, novelResult] = await Promise.all([
        getPowersByNovelId(novelId),
        getNovelById(novelId),
    ]);

    if (!powersResult.success) {
        return (
            <div className="p-8">
                <p className="text-red-500">Error loading powers: {powersResult.error}</p>
            </div>
        );
    }

    const powers = powersResult.data || [];
    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-8">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[{ label: "Powers" }]}
            />

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Powers</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage abilities and powers in your story
                    </p>
                </div>
                <CreatePowerDialog novelId={novelId} />
            </div>

            <PowersView
                powers={powers}
                novelId={novelId}
            />
        </div>
    );
}

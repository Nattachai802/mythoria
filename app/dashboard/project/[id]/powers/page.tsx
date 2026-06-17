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
        <div className="p-8 space-y-6">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[{ label: "ระบบพลัง" }]}
            />

            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-display font-bold tracking-tight">ระบบพลัง</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--forge-gold)] opacity-75 animate-forge-pulse" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--forge-gold)]" />
                        </span>
                        <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            พลังและความสามารถในโลกนิยาย
                        </span>
                    </div>
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

import { getNovelById } from "@/server/novel";
import { WorldGraph } from "@/components/project/world-graph";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

interface WorldGraphPageProps {
    params: Promise<{ id: string }>;
}

export default async function WorldGraphPage({ params }: WorldGraphPageProps) {
    const { id: novelId } = await params;
    const novelResult = await getNovelById(novelId);
    const novelTitle = novelResult.novel?.title || "Project";

    return (
        <div className="p-8 space-y-6">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[{ label: "World Graph" }]}
            />

            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">World Graph</h1>
                <p className="text-muted-foreground">
                    กราฟทั้งโลก — ทุก entity และเส้นเชื่อมจาก Context Fabric (คลิก node เพื่อไปหน้านั้น)
                </p>
            </div>

            <WorldGraph novelId={novelId} height={680} />
        </div>
    );
}

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
        <div className="p-6 md:p-8 space-y-6">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novelTitle}
                items={[{ label: "World Graph" }]}
            />

            <div className="flex items-start gap-3">
                <span className="mt-1.5 h-8 w-1 bg-[var(--forge-gold)] chamfered-sm shrink-0" aria-hidden />
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]">
                        World Graph
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-2xl">
                        แผนที่ความเชื่อมโยงทั้งเรื่อง — ตัวละคร สถานที่ ตำนาน และปม
                        ถักทอกันผ่าน Context Fabric · <span className="text-foreground/70">ชี้โหนดเพื่อไฮไลต์เพื่อนบ้าน คลิกเพื่อเปิดหน้านั้น</span>
                    </p>
                </div>
            </div>

            <WorldGraph novelId={novelId} height={680} />
        </div>
    );
}

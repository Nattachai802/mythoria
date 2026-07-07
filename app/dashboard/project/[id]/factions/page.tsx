import { notFound } from "next/navigation";
import { getNovelById } from "@/server/novel";
import { getAllFactionsWithMembers, getFactionRelationships, getFactionStatusPresets } from "@/server/factions";
import { getCharactersByNovelId } from "@/server/character";
import { FactionsContent } from "@/components/project/factions/factions-content";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";

type Props = { params: Promise<{ id: string }> };

export default async function FactionsPage({ params }: Props) {
    const { id } = await params;

    const [novelResult, factionsResult, relsResult, charactersResult, presetsResult] = await Promise.all([
        getNovelById(id),
        getAllFactionsWithMembers(id),
        getFactionRelationships(id),
        getCharactersByNovelId(id),
        getFactionStatusPresets(id),
    ]);

    if (!novelResult.success || !novelResult.novel) {
        notFound();
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div>
                    <ProjectBreadcrumb
                        novelId={id}
                        novelTitle={novelResult.novel.title}
                        items={[{ label: "ฝ่าย/ตระกูล" }]}
                    />
                    <h1 className="text-lg font-display font-semibold">ฝ่าย / ตระกูล</h1>
                    <p className="text-sm text-muted-foreground">
                        องค์กร กลุ่ม และตระกูลใน &ldquo;{novelResult.novel.title}&rdquo;
                    </p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden bg-muted/10">
                <FactionsContent
                    novelId={id}
                    initialFactions={factionsResult.data || []}
                    initialRelationships={relsResult.data || []}
                    characters={charactersResult.data || []}
                    initialStatusPresets={presetsResult.data || []}
                />
            </div>
        </div>
    );
}

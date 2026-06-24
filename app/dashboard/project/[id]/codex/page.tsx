import { StoryCodex } from "@/components/project/story-codex";

type Props = { params: Promise<{ id: string }> };

export default async function CodexPage({ params }: Props) {
    const { id } = await params;
    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-2xl font-display font-bold tracking-tight">Story Codex</h1>
                <p className="text-sm text-muted-foreground">
                    คลังเรื่องที่เชื่อมโยงกันอัตโนมัติ — เดินสำรวจตัวละคร สถานที่ พลัง และความสัมพันธ์
                </p>
            </div>
            <StoryCodex novelId={id} />
        </div>
    );
}

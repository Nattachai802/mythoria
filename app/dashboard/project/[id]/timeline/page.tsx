import { notFound } from "next/navigation"
import { getNovelForPlot } from "@/server/novel"
import { getWorldTimelineInput } from "@/server/world-timeline"
import { buildWorldTimeline } from "@/lib/world-timeline"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"
import { WorldTimelineBoard } from "@/components/project/world-timeline/world-timeline-board"

type Props = { params: Promise<{ id: string }> }

// เส้นเวลาโลก เฟส 1 — อ่านอย่างเดียว · แผนเต็ม docs/treatment-timeline-plan.md
export default async function WorldTimelinePage({ params }: Props) {
    const { id } = await params
    const [novelResult, input] = await Promise.all([getNovelForPlot(id), getWorldTimelineInput(id)])
    if (!novelResult.success || !novelResult.novel) notFound()

    const novel = novelResult.novel
    const timeline = buildWorldTimeline(input)

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col">
            <div className="border-b px-6 pt-4 pb-3">
                <ProjectBreadcrumb novelId={id} novelTitle={novel.title} items={[{ label: "เส้นเวลา" }]} />
                <h1 className="font-display text-lg font-semibold">เส้นเวลา</h1>
                <p className="text-xs text-muted-foreground">
                    โลกเกิดอะไรขึ้นเมื่อไหร่ เรียงตามยุคและลำดับเวลาจริง ไม่ใช่ลำดับที่เล่า · ของที่มี ≈ วางตามบท เป็นตำแหน่งประมาณ
                </p>
            </div>
            <WorldTimelineBoard novelId={id} timeline={timeline} timelineEpoch={novel.timelineEpoch ?? null} />
        </div>
    )
}

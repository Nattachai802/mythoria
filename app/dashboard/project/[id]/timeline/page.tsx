import { notFound } from "next/navigation"
import { getNovelForPlot } from "@/server/novel"
import { getTreatmentReport, getWorldTimelineData } from "@/server/world-timeline"
import { buildWorldTimeline } from "@/lib/world-timeline"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"
import { WorldTimelineBoard } from "@/components/project/world-timeline/world-timeline-board"

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ focus?: string }> }

// เส้นเวลาโลก (เฟส 2A: ปฏิทิน + เวลาของ lore) · แผนเต็ม docs/treatment-timeline-plan.md
export default async function WorldTimelinePage({ params, searchParams }: Props) {
    const { id } = await params
    const { focus } = await searchParams
    // ponytail: getTreatmentReport โหลดข้อมูลเส้นเวลาซ้ำอีกรอบ — ถ้าหน้านี้ช้าค่อยส่ง data เข้าไปแทน
    const [novelResult, data, report] = await Promise.all([
        getNovelForPlot(id), getWorldTimelineData(id),
        getTreatmentReport(id).catch(() => ({ findings: [], failed: [] })),
    ])
    if (!novelResult.success || !novelResult.novel) notFound()

    const novel = novelResult.novel
    const timeline = buildWorldTimeline(data.input)
    const loreLinks = Object.fromEntries(data.input.lore.map(l => [l.id, {
        characterIds: l.characterIds,
        locationIds: [...new Set([...(l.locationId ? [l.locationId] : []), ...l.locationIds])],
        sceneIds: l.sceneIds,
    }]))
    const options = {
        characters: data.input.characters,
        locations: data.input.locations,
        scenes: data.input.scenes.map(sc => ({ id: sc.id, name: sc.title })),
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col">
            <div className="border-b px-6 pt-4 pb-3">
                <ProjectBreadcrumb novelId={id} novelTitle={novel.title} items={[{ label: "เส้นเวลา" }]} />
                <h1 className="font-display text-lg font-semibold">เส้นเวลา</h1>
                <p className="text-xs text-muted-foreground">
                    โลกเกิดอะไรขึ้นเมื่อไหร่ เรียงตามยุคและเวลาจริง ไม่ใช่ลำดับที่เล่า · ของที่มี ≈ วางตามบท เป็นตำแหน่งประมาณ
                </p>
            </div>
            <WorldTimelineBoard novelId={id} timeline={timeline} timelineEpoch={novel.timelineEpoch ?? null}
                calendar={data.calendar}
                eraYears={data.eraYears}
                loreLinks={loreLinks}
                options={options}
                focus={focus ?? null}
                findings={report.findings}
            />
        </div>
    )
}

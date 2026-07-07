import { notFound } from "next/navigation"
import { getNovelById } from "@/server/novel"
import { BibleImportView } from "@/components/project/bible-import/bible-import-view"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"

type Props = { params: Promise<{ id: string }> }

export default async function ImportBiblePage({ params }: Props) {
    const { id } = await params
    const novelResult = await getNovelById(id)
    if (!novelResult.success || !novelResult.novel) notFound()
    const novel = novelResult.novel

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            <div className="px-6 py-4 border-b bg-background/95 backdrop-blur">
                <ProjectBreadcrumb
                    novelId={id}
                    novelTitle={novel.title}
                    items={[{ label: "นำเข้า Story Bible" }]}
                />
                <h1 className="text-lg font-display font-semibold">นำเข้า Story Bible</h1>
                <p className="text-sm text-muted-foreground">
                    วางเอกสารไบเบิล → AI สกัดเป็นตัวละคร ตระกูล ผี ของ พลัง ปม → ตรวจแล้วสร้างเข้า &ldquo;{novel.title}&rdquo;
                </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto">
                    <BibleImportView novelId={id} />
                </div>
            </div>
        </div>
    )
}

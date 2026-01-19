import { ReactNode } from "react"
import { notFound } from "next/navigation"
import { getNovelById } from "@/server/novel"
import { ProjectSidebar } from "@/components/project-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { syncDiscordIdeas } from '@/server/discord-sync';


type Props = {
    params: Promise<{ id: string }>
    children: ReactNode
}

export default async function ProjectLayout({ params, children }: Props) {
    const { id } = await params

    // Query ข้อมูล novel
    const result = await getNovelById(id)

    try {
        const syncResult = await syncDiscordIdeas(id)
        if (syncResult.synced > 0) {
            console.log(`[Discord sync] Synced ${syncResult.synced} ideas`)

        }
    } catch (err) {
        console.error('[Discord sync] Error:', err);
    }

    // ถ้าไม่เจอให้แสดง 404
    if (!result.success || !result.novel) {
        notFound()
    }

    return (
        <SidebarProvider defaultOpen={false}>
            <ProjectSidebar
                projectId={id}
                projectTitle={result.novel.title}
            />
            <SidebarInset>
                <div className="flex flex-1 flex-col gap-4 p-4">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
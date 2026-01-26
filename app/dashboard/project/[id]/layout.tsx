import { ReactNode } from "react"
import { notFound } from "next/navigation"
import { getNovelByIdSimple } from "@/server/novel"
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


type Props = {
    params: Promise<{ id: string }>
    children: ReactNode
}

export default async function ProjectLayout({ params, children }: Props) {
    const { id } = await params

    // Query ข้อมูล novel แบบ simple (ใช้แค่ title สำหรับ sidebar)
    const result = await getNovelByIdSimple(id)

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
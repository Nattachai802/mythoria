"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BookOpen,
    Users,
    MapPin,
    ScrollText,
    LayoutDashboard,
    Settings,
    ArrowLeft,
    ChevronRight,
    FileText,
    MessageSquareText,
    Zap,
    Globe,
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
    SidebarSeparator,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ModeToggle } from "@/components/mode-toggle"
import { Chapter } from "@/db/schema"

interface ProjectSidebarProps {
    projectId: string
    projectTitle?: string
    chapters?: Chapter[]
}

export function ProjectSidebar({ projectId, projectTitle, chapters = [] }: ProjectSidebarProps) {
    const pathname = usePathname()

    const navItems = [
        { title: "Overview", href: `/dashboard/project/${projectId}`, icon: LayoutDashboard },
        { title: "Plot", href: `/dashboard/project/${projectId}/plot`, icon: ScrollText },
        { title: "Characters", href: `/dashboard/project/${projectId}/characters`, icon: Users },
        { title: "Ideas", href: `/dashboard/project/${projectId}/idea`, icon: MessageSquareText },
        { title: "World Building", href: `/dashboard/project/${projectId}/worldbuilding`, icon: Globe },
        { title: "Powers", href: `/dashboard/project/${projectId}/powers`, icon: Zap },
    ]

    const publishedChapters = chapters.filter(c => c.status === "published")
    const draftChapters = chapters.filter(c => c.status === "draft")

    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-md">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <Link href="/dashboard">
                                <div className="flex aspect-square size-8 items-center justify-center">
                                    <ArrowLeft className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none">
                                    <span className="font-semibold">Back to Dashboard</span>
                                    <span className="">{projectTitle || "Project"}</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarSeparator className="mx-0" />
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Project Menu</SidebarGroupLabel>
                    <SidebarMenu>
                        {navItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={
                                        item.href === `/dashboard/project/${projectId}`
                                            ? pathname === item.href
                                            : pathname?.startsWith(item.href)
                                    }
                                >
                                    <Link href={item.href}>
                                        <item.icon />
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarGroup>

                {/* Chapters Section */}
                {chapters.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Chapters</SidebarGroupLabel>
                        <SidebarMenu>
                            {publishedChapters.length > 0 && (
                                <Collapsible defaultOpen className="group/collapsible">
                                    <SidebarMenuItem>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton tooltip="Published">
                                                <BookOpen />
                                                <span>Published</span>
                                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {publishedChapters.map((chapter) => (
                                                    <SidebarMenuSubItem key={chapter.id}>
                                                        <SidebarMenuSubButton asChild isActive={pathname === `/dashboard/project/${projectId}/chapter/${chapter.id}`}>
                                                            <Link href={`/dashboard/project/${projectId}/chapter/${chapter.id}`}>
                                                                <FileText className="h-4 w-4" />
                                                                <span>{chapter.title}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </SidebarMenuItem>
                                </Collapsible>
                            )}

                            {draftChapters.length > 0 && (
                                <Collapsible defaultOpen className="group/collapsible">
                                    <SidebarMenuItem>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton tooltip="Drafts">
                                                <ScrollText />
                                                <span>Drafts</span>
                                                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <SidebarMenuSub>
                                                {draftChapters.map((chapter) => (
                                                    <SidebarMenuSubItem key={chapter.id}>
                                                        <SidebarMenuSubButton asChild isActive={pathname === `/dashboard/project/${projectId}/chapter/${chapter.id}`}>
                                                            <Link href={`/dashboard/project/${projectId}/chapter/${chapter.id}`}>
                                                                <FileText className="h-4 w-4" />
                                                                <span>{chapter.title}</span>
                                                            </Link>
                                                        </SidebarMenuSubButton>
                                                    </SidebarMenuSubItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </SidebarMenuItem>
                                </Collapsible>
                            )}
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <ModeToggle />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

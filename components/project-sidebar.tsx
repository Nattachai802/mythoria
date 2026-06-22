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
    BarChart3,
    Share2,
    Keyboard,
} from "lucide-react"
import { useKeyboardShortcutsContext } from "@/components/keyboard-shortcuts-provider"

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
    const { openHelp } = useKeyboardShortcutsContext()

    // จัดกลุ่ม nav 3 โซน ลด cognitive load (เขียน / สร้างโลก / วิเคราะห์)
    const navGroups = [
        {
            label: "เขียน",
            items: [
                { title: "Overview", href: `/dashboard/project/${projectId}`, icon: LayoutDashboard },
                { title: "Plot", href: `/dashboard/project/${projectId}/plot`, icon: ScrollText },
                { title: "Ideas", href: `/dashboard/project/${projectId}/idea`, icon: MessageSquareText },
            ],
        },
        {
            label: "สร้างโลก",
            items: [
                { title: "Characters", href: `/dashboard/project/${projectId}/characters`, icon: Users },
                { title: "World Building", href: `/dashboard/project/${projectId}/worldbuilding`, icon: Globe },
                { title: "Powers", href: `/dashboard/project/${projectId}/powers`, icon: Zap },
                { title: "World Graph", href: `/dashboard/project/${projectId}/graph`, icon: Share2 },
            ],
        },
        {
            label: "วิเคราะห์",
            items: [
                { title: "Analytics", href: `/dashboard/project/${projectId}/analytics`, icon: BarChart3 },
            ],
        },
    ]

    const publishedChapters = chapters.filter(c => c.status === "published")
    const draftChapters = chapters.filter(c => c.status === "draft")

    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild size="lg">
                            <Link href="/dashboard">
                                <div className="flex aspect-square size-8 items-center justify-center">
                                    <ArrowLeft className="size-4" />
                                </div>
                                <div className="flex flex-col gap-0.5 leading-none overflow-hidden">
                                    <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Back to Dashboard</span>
                                    <span className="font-display font-semibold text-sm truncate">{projectTitle || "Project"}</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <div className="h-[2px] mx-2 hazard-stripe-subtle" />
            </SidebarHeader>
            <SidebarSeparator className="mx-0" />
            <SidebarContent>
                {navGroups.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel className="font-technical text-[9px] tracking-[0.2em] uppercase">{group.label}</SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => (
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
                ))}

                {/* Chapters Section */}
                {chapters.length > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="font-technical text-[9px] tracking-[0.2em] uppercase">Chapters</SidebarGroupLabel>
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
                                                        <SidebarMenuSubButton asChild className="cursor-default hover:bg-transparent text-muted-foreground">
                                                            <span>
                                                                <FileText className="h-4 w-4" />
                                                                <span>{chapter.title}</span>
                                                            </span>
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
                                                        <SidebarMenuSubButton asChild className="cursor-default hover:bg-transparent text-muted-foreground">
                                                            <span>
                                                                <FileText className="h-4 w-4" />
                                                                <span>{chapter.title}</span>
                                                            </span>
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
                        <SidebarMenuButton onClick={openHelp} tooltip="คีย์ลัด (?)">
                            <Keyboard />
                            <span>คีย์ลัด</span>
                            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border font-mono">?</kbd>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <ModeToggle />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

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
    Shield,
    FileInput,
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
import { cn } from "@/lib/utils"

interface ProjectSidebarProps {
    projectId: string
    projectTitle?: string
    chapters?: Chapter[]
    /** นิยายมีเนื้อหาแล้วหรือยัง (wordCount > 0) — earned disclosure ของ nav ขั้นสูง */
    hasContent?: boolean
}

export function ProjectSidebar({ projectId, projectTitle, chapters = [], hasContent = true }: ProjectSidebarProps) {
    const pathname = usePathname()
    const { openHelp } = useKeyboardShortcutsContext()

    // จัดกลุ่ม nav 3 โซน ลด cognitive load (เขียน / สร้างโลก / วิเคราะห์)
    // earned disclosure: ซ่อนกลุ่ม "วิเคราะห์" จนกว่ามีเนื้อหา (ว่างเปล่าตอน 0 คำไม่มีอะไรให้ดู)
    // เข้าถึงได้เสมอผ่าน Cmd+K — ไม่ใช่การตัดฟีเจอร์
    const allNavGroups = [
        {
            label: "เขียน",
            items: [
                { title: "ภาพรวม", href: `/dashboard/project/${projectId}`, icon: LayoutDashboard },
                { title: "โครงเรื่อง", href: `/dashboard/project/${projectId}/plot`, icon: ScrollText },
                { title: "ไอเดีย", href: `/dashboard/project/${projectId}/idea`, icon: MessageSquareText },
            ],
        },
        {
            label: "สร้างโลก",
            items: [
                { title: "ตัวละคร", href: `/dashboard/project/${projectId}/characters`, icon: Users },
                { title: "กลุ่มอำนาจ", href: `/dashboard/project/${projectId}/factions`, icon: Shield },
                { title: "สร้างโลก", href: `/dashboard/project/${projectId}/worldbuilding`, icon: Globe },
                { title: "ระบบพลัง", href: `/dashboard/project/${projectId}/powers`, icon: Zap },
                { title: "แผนผังโลก", href: `/dashboard/project/${projectId}/graph`, icon: Share2 },
                { title: "นำเข้าไบเบิล", href: `/dashboard/project/${projectId}/import-bible`, icon: FileInput },
            ],
        },
        {
            label: "วิเคราะห์",
            items: [
                { title: "สถิติ", href: `/dashboard/project/${projectId}/analytics`, icon: BarChart3 },
            ],
        },
    ]

    // สถานะ active ของ shadcn เป็นแคปซูลมนเรืองแสง ซึ่งไม่ใช่ภาษาของแอปนี้ — ที่อื่นใช้มุมตัด
    // สีแบน forge-gold ไม่มี glow แถวที่เลือกอยู่จึงควรอ่านเหมือน "แผ่นเหล็กที่ถูกตี" ไม่ใช่ปุ่มเรืองแสง
    // ไอคอนถอยไปเป็นพื้นหลัง (10 แถว 10 ไอคอนสีเท่ากัน = พื้นผิว ไม่ใช่สัญญาณ) เหลือแค่ตัว active ที่ติดสี
    // ยังต้องมีไอคอนอยู่เพราะ Sidebar เป็น collapsible="icon" ตัดทิ้งแล้วโหมดยุบพัง
    const navButton = cn(
        "rounded-none transition-colors",
        "[&>svg]:size-3.5 [&>svg]:text-muted-foreground/60 [&>svg]:transition-colors",
        "hover:[&>svg]:text-muted-foreground",
        "data-[active=true]:bg-[var(--forge-gold)]/12",
        "data-[active=true]:text-foreground",
        "data-[active=true]:border-l-2 data-[active=true]:border-[var(--forge-gold)]",
        "data-[active=true]:shadow-none",
        "data-[active=true]:[&>svg]:text-[var(--forge-gold)]",
    )

    const navGroups = hasContent
        ? allNavGroups
        : allNavGroups.filter((g) => g.label !== "วิเคราะห์")

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
                                    <span className="font-technical text-[10px] tracking-[0.05em] text-muted-foreground">กลับไปชั้นหนังสือ</span>
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
                        <SidebarGroupLabel className="font-technical text-[10px] tracking-[0.05em] text-muted-foreground/70">{group.label}</SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        className={navButton}
                                        tooltip={item.title}
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
                        <SidebarGroupLabel className="font-technical text-[10px] tracking-[0.05em] text-muted-foreground/70">ตอน</SidebarGroupLabel>
                        <SidebarMenu>
                            {publishedChapters.length > 0 && (
                                <Collapsible defaultOpen className="group/collapsible">
                                    <SidebarMenuItem>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton tooltip="เผยแพร่แล้ว" className={navButton}>
                                                <BookOpen />
                                                <span>เผยแพร่แล้ว</span>
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
                                            <SidebarMenuButton tooltip="ฉบับร่าง" className={navButton}>
                                                <ScrollText />
                                                <span>ฉบับร่าง</span>
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
                        <SidebarMenuButton onClick={openHelp} tooltip="คีย์ลัด (?)" className={navButton}>
                            <Keyboard />
                            <span>คีย์ลัด</span>
                            <kbd className="ml-auto px-1.5 py-0.5 text-[10px] bg-muted rounded border border-border font-mono">?</kbd>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <ModeToggle variant="ghost" className="w-full justify-start rounded-none size-8 px-2 [&>svg]:size-3.5 [&>svg]:text-muted-foreground/60" />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    )
}

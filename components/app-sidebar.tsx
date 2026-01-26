"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  BookOpenText,
  LayoutDashboard,
  Settings,
  BarChart3,
  LogOut,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { authClient } from "@/lib/auth-client"
import { ModeToggle } from "@/components/mode-toggle"

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await authClient.signOut()
    router.push("/")
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/80 backdrop-blur-md">
      <SidebarHeader className="pb-4 pt-6">
        <div className="flex items-center gap-3 px-2 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {/* Logo with industrial glow */}
          <div className="relative flex aspect-square size-10 items-center justify-center rounded-sm bg-primary/20 text-primary shadow-[0_0_20px_-3px_var(--primary)] ring-1 ring-primary/50 transition-all overflow-hidden">
            <img
              src="/Gemini_Generated_Image_o3cvbro3cvbro3cv.png"
              alt="Mythoria Logo"
              className="h-full w-full object-cover"
            />
            {/* Corner accent */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-primary/50" />
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-primary/50" />
          </div>
          {/* Brand text with industrial styling */}
          <div className="flex flex-col gap-0.5 overflow-hidden transition-all group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="font-display font-bold tracking-[0.15em] text-lg text-primary text-glow-gold">MYTHORIA</span>
            <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground font-mono">[ STORY ARCHITECT ]</span>
          </div>
        </div>
        {/* Hazard stripe accent */}
        <div className="mt-3 h-[2px] mx-2 hazard-stripe-subtle group-data-[collapsible=icon]:hidden" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.title}
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
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ModeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

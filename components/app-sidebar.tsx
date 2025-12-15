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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar/50 backdrop-blur-md">
      <SidebarHeader className="pb-4 pt-6">
        <div className="flex items-center gap-3 px-2 transition-all group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="relative flex aspect-square size-10 items-center justify-center rounded-lg bg-primary/20 text-primary shadow-[0_0_15px_-3px_var(--color-primary)] ring-1 ring-primary/50 transition-all">
            <img
              src="/Gemini_Generated_Image_o3cvbro3cvbro3cv.png"
              alt="Mythoria Logo"
              className="h-full w-full object-cover rounded-lg"
            />
          </div>
          <div className="flex flex-col gap-1 overflow-hidden transition-all group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="font-bold tracking-wider text-lg bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">MYTHORIA</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Story Architect</span>
          </div>
        </div>
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
                  className="hover:bg-primary/10 hover:text-primary data-[active=true]:bg-primary/20 data-[active=true]:text-primary data-[active=true]:shadow-[0_0_10px_-5px_var(--color-primary)] transition-all duration-300"
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

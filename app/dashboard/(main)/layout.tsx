import { ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <main className="flex flex-1 flex-col gap-4 p-4">
        {children}
      </main>
    </SidebarProvider>
  )
}

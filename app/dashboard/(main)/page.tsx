import { headers } from "next/headers"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getNovelsByUserId } from "@/server/novel"
import { PageWrapper } from "@/components/page-warpper"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, MoreVertical, PenTool } from "lucide-react"
import { CreateProjectButton } from "@/components/dashboard/create-project-button"
import { NovelActions } from "@/components/dashboard/novel-actions"

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return <div>Not authenticated</div>
  }

  const { novels } = await getNovelsByUserId(session.user.id)

  return (
    <PageWrapper breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Projects</h1>
          <p className="text-muted-foreground">
            Manage your novels and writing projects.
          </p>
        </div>
        <CreateProjectButton userId={session.user.id} />
      </div>

      {novels && novels.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {novels.map((novel) => (
            <Card key={novel.id} className="group relative overflow-hidden transition-all hover:shadow-md">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-1">{novel.title}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {novel.description || "No description"}
                    </CardDescription>
                  </div>
                  <div className="relative z-10">
                    <NovelActions novelId={novel.id} novelTitle={novel.title} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{novel.chapters?.length || 0} Chapters</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PenTool className="h-4 w-4" />
                    <span>{novel.wordCount.toLocaleString()} Words</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/50 p-4">
                <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
                  <span className="capitalize px-2 py-1 rounded-full bg-background border">
                    {novel.status}
                  </span>
                  <span>
                    Updated {new Date(novel.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardFooter>
              <Link href={`/dashboard/project/${novel.id}`} className="absolute inset-0">
                <span className="sr-only">View project</span>
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <BookOpen className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No projects yet</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
            You haven't created any projects yet. Start writing your first novel today.
          </p>
          <CreateProjectButton userId={session.user.id} />
        </div>
      )}
    </PageWrapper>
  )
}
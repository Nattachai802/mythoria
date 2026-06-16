import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getNovelsByUserId } from "@/server/novel"
import { PageWrapper } from "@/components/page-warpper"
import { BookOpen } from "lucide-react"
import { CreateProjectButton } from "@/components/dashboard/create-project-button"
import { Bookshelf, type ShelfNovel } from "@/components/dashboard/bookshelf"

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return <div>Not authenticated</div>
  }

  const { novels } = await getNovelsByUserId(session.user.id)

  const shelfNovels: ShelfNovel[] = (novels ?? []).map((novel: (NonNullable<typeof novels>)[number]) => ({
    id: novel.id,
    title: novel.title,
    description: novel.description,
    wordCount: novel.wordCount,
    chaptersCount: novel.chapters?.length || 0,
    status: novel.status,
    updatedAt: new Date(novel.updatedAt).toISOString(),
  }))

  return (
    <PageWrapper breadcrumbs={[{ label: "หน้าหลัก", href: "/dashboard" }]}>
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">ชั้นหนังสือของฉัน</h1>
          <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1.5 block">
            {shelfNovels.length ? `${shelfNovels.length} เล่มบนชั้น` : "ชั้นยังว่างเปล่า"}
          </span>
        </div>
        <CreateProjectButton userId={session.user.id} />
      </div>

      {shelfNovels.length > 0 ? (
        <Bookshelf novels={shelfNovels} />
      ) : (
        <div className="flex min-h-[400px] flex-col items-center justify-center chamfered border border-dashed border-border bg-card/40 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center chamfered-sm bg-[var(--forge-gold)]/10">
            <BookOpen className="h-6 w-6 text-[var(--forge-gold)]" />
          </div>
          <h3 className="mt-4 text-lg font-display font-semibold">ชั้นหนังสือยังว่างเปล่า</h3>
          <p className="mb-5 mt-2 text-sm text-muted-foreground max-w-sm">
            ยังไม่มีเล่มไหนบนชั้น เริ่มเข้าเล่มนิยายเรื่องแรกของคุณวันนี้
          </p>
          <CreateProjectButton userId={session.user.id} />
        </div>
      )}
    </PageWrapper>
  )
}

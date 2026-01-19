import { notFound } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
    BookOpen,
    FileText,
    Users,
    MapPin,
    Calendar,
    Clock,
    Plus,
    ChevronDown,
    ChevronRight,
    StickyNote,
    Sparkles,
    Target,
    TrendingUp,
    Pen,
    Flame,
    PenTool,
    BarChart3,
} from "lucide-react"
import { ProjectHeaderActions } from "@/components/project/project-header-actions"
import { CreateChapterDialog } from "@/components/project/create-chapter-dialog"
import { CreateNoteDialog } from "@/components/project/create-note-dialog"
import { getNovelByIdLight } from "@/server/novel"
import { getNotes } from "@/server/note"
import { getIdeasCount } from "@/server/idea"
import { getWritingStreak, getAnalyticsSummary, getWritingActivity } from "@/server/analytics"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChapterActions } from "@/components/project/chapter-actions"
import { ChapterRow } from "@/components/project/chapter-row"
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb"
import { VectorSyncButton } from "@/components/project/vector-sync-button"
import { PlotHoleJobButton } from "@/components/project/plot-hole-job-button"
import { cn } from "@/lib/utils"

type Props = {
    params: Promise<{ id: string }>
}

function getWordCount(content: string | null | undefined): number {
    if (typeof content !== 'string' || !content) return 0;
    const text = content.includes('<')
        ? content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
        : content.trim();
    if (!text) return 0;
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        try {
            const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
            let count = 0;
            for (const segment of segmenter.segment(text)) {
                if (segment.isWordLike) count++;
            }
            return count;
        } catch (err) { }
    }
    return text.replace(/\s+/g, ' ').trim().split(' ').length;
}

function getChapterWordCount(chapterNotes: any[]): number {
    let total = 0;
    for (const note of chapterNotes) {
        const content = note.content as { text?: string } | null;
        if (content?.text) total += getWordCount(content.text);
    }
    return total;
}

export default async function ProjectOverviewPage({ params }: Props) {
    const { id } = await params

    // Parallel fetching with light queries
    const [novelResult, notesResult, ideasCountResult, streakResult, summaryResult, activityResult] = await Promise.all([
        getNovelByIdLight(id),
        getNotes(id),
        getIdeasCount(id),
        getWritingStreak(id),
        getAnalyticsSummary(id),
        getWritingActivity(id, 14), // Last 14 days for mini calendar
    ])

    if (!novelResult.success || !novelResult.novel) {
        notFound()
    }

    const { novel } = novelResult
    const notes = notesResult.notes || []
    const ideasCount = ideasCountResult.count || 0
    const streak = streakResult
    const analytics = summaryResult.summary
    const activityData = activityResult.activity || []

    // Calculate stats
    const totalWords = novel.wordCount || 0
    const targetWords = novel.targetWordCount || 50000
    const progress = targetWords > 0 ? Math.min((totalWords / targetWords) * 100, 100) : 0
    const totalChapters = novel.chapters.length
    const publishedChapters = novel.chapters.filter((c: any) => c.status === "published")
    const draftChapters = novel.chapters.filter((c: any) => c.status === "draft")
    const lastUpdated = novel.updatedAt ? format(new Date(novel.updatedAt), "PP") : "Never"

    // Sort chapters by orderIndex
    const sortedDrafts = [...draftChapters].sort((a: any, b: any) => a.orderIndex - b.orderIndex)
    const sortedPublished = [...publishedChapters].sort((a: any, b: any) => a.orderIndex - b.orderIndex)

    return (
        <div className="flex flex-col gap-6">
            {/* Breadcrumb */}
            <ProjectBreadcrumb
                novelId={id}
                novelTitle={novel.title}
                items={[{ label: "Overview" }]}
            />

            {/* Main Layout: Sidebar + Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

                {/* LEFT SIDEBAR - Stats & Info */}
                <div className="space-y-4">
                    {/* Project Card - Minimal */}
                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <h1 className="text-lg font-semibold tracking-tight line-clamp-2">{novel.title}</h1>
                            <ProjectHeaderActions
                                novelId={id}
                                novelTitle={novel.title}
                                novelDescription={novel.description || ""}
                            />
                        </div>

                        {novel.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {novel.description}
                            </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{format(new Date(novel.createdAt), "PP")}</span>
                            <span>•</span>
                            <span>{lastUpdated}</span>
                        </div>
                    </div>

                    {/* Writing Stats Section - Compact */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Stats</span>
                            <Link
                                href={`/dashboard/project/${id}/analytics`}
                                className="text-[10px] text-primary hover:underline"
                            >
                                เพิ่มเติม
                            </Link>
                        </div>

                        {/* Stats Grid - Compact */}
                        <div className="grid grid-cols-3 gap-1.5">
                            <div className="p-1.5 rounded-md bg-gradient-to-br from-orange-500/10 to-red-500/10 text-center">
                                <span className="text-sm font-bold">{streak.currentStreak}</span>
                                <p className="text-[9px] text-muted-foreground">Streak</p>
                            </div>
                            <div className="p-1.5 rounded-md bg-muted/50 text-center">
                                <span className="text-sm font-bold">{(analytics?.todayWords || 0).toLocaleString()}</span>
                                <p className="text-[9px] text-muted-foreground">Today</p>
                            </div>
                            <div className="p-1.5 rounded-md bg-muted/50 text-center">
                                <span className="text-sm font-bold">{(analytics?.weekWords || 0).toLocaleString()}</span>
                                <p className="text-[9px] text-muted-foreground">Week</p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar - Minimal */}
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{totalWords.toLocaleString()} / {targetWords.toLocaleString()}</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                    </div>

                    {/* Mini Activity Calendar - Last 14 days */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Activity (14 days)</span>
                            <Link
                                href={`/dashboard/project/${id}/analytics`}
                                className="text-[10px] text-primary hover:underline"
                            >
                                เพิ่มเติม
                            </Link>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {activityData.slice(-14).map((day: { date: string; count: number }, i: number) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "aspect-square rounded-sm",
                                        day.count === 0 && "bg-muted/50",
                                        day.count > 0 && day.count < 500 && "bg-emerald-200 dark:bg-emerald-900",
                                        day.count >= 500 && day.count < 1000 && "bg-emerald-300 dark:bg-emerald-700",
                                        day.count >= 1000 && day.count < 2000 && "bg-emerald-400 dark:bg-emerald-600",
                                        day.count >= 2000 && "bg-emerald-500 dark:bg-emerald-500"
                                    )}
                                    title={`${day.date}: ${day.count.toLocaleString()} words`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* AI Tools Section */}
                    <div className="pt-4 border-t space-y-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <Sparkles className="h-3 w-3" />
                            AI Tools
                        </div>

                        {/* Sync Database Card */}
                        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-200/50 dark:border-blue-800/50">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-blue-500/20">
                                        <Target className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="text-sm font-medium">ซิงค์ฐานข้อมูล</span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">อัพเดทข้อมูลสำหรับ AI Search</p>
                            <VectorSyncButton novelId={id} />
                        </div>

                        {/* Plot Hole Checker Card */}
                        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-800/50">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-md bg-purple-500/20">
                                        <TrendingUp className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span className="text-sm font-medium">ตรวจสอบ Plot Holes</span>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">วิเคราะห์ความสอดคล้องของเนื้อเรื่อง</p>
                            <PlotHoleJobButton novelId={id} />
                        </div>
                    </div>
                </div>

                {/* RIGHT MAIN - Chapters */}
                <div className="space-y-4">
                    {/* Chapters Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                                <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Chapters</h2>
                                <p className="text-sm text-muted-foreground">
                                    {totalChapters} chapters • {publishedChapters.length} published
                                </p>
                            </div>
                        </div>
                        <CreateChapterDialog novelId={id} />
                    </div>

                    {/* Chapters Content */}
                    <div className="rounded-xl border bg-card/50 backdrop-blur">
                        {totalChapters === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                <div className="p-4 rounded-full bg-muted/50 mb-4">
                                    <Pen className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Start Your Story</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                                    Every great novel begins with a single chapter. Create your first one now.
                                </p>
                                <CreateChapterDialog novelId={id} />
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {/* Drafts Section */}
                                {sortedDrafts.length > 0 && (
                                    <Collapsible defaultOpen className="group/collapsible">
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                                            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                                                Drafts
                                            </Badge>
                                            <span className="text-xs">({sortedDrafts.length})</span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            {sortedDrafts.map((chapter, index) => {
                                                const chapterNotes = notes.filter((n: any) => n.linkedToChapterId === chapter.id)
                                                const wordCount = getChapterWordCount(chapterNotes)
                                                return (
                                                    <ChapterRow
                                                        key={chapter.id}
                                                        chapter={chapter}
                                                        chapterNotes={chapterNotes}
                                                        wordCount={wordCount}
                                                        novelId={id}
                                                        index={index + 1}
                                                    />
                                                )
                                            })}
                                        </CollapsibleContent>
                                    </Collapsible>
                                )}

                                {/* Published Section */}
                                {sortedPublished.length > 0 && (
                                    <Collapsible defaultOpen className="group/collapsible">
                                        <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                                            <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
                                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                                Published
                                            </Badge>
                                            <span className="text-xs">({sortedPublished.length})</span>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            {sortedPublished.map((chapter, index) => {
                                                const chapterNotes = notes.filter((n: any) => n.linkedToChapterId === chapter.id)
                                                const wordCount = getChapterWordCount(chapterNotes)
                                                return (
                                                    <ChapterRow
                                                        key={chapter.id}
                                                        chapter={chapter}
                                                        chapterNotes={chapterNotes}
                                                        wordCount={wordCount}
                                                        novelId={id}
                                                        index={sortedDrafts.length + index + 1}
                                                    />
                                                )
                                            })}
                                        </CollapsibleContent>
                                    </Collapsible>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

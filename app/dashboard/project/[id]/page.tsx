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
    Check,
    Zap,
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
import { PublishAssistant } from "@/components/project/publish-assistant"
import { ExportDialog } from "@/components/project/export-dialog"
import { StylometryBulkAnalyzeButton } from "@/components/project/stylometry-bulk-analyze-button"
import { getNovelStylometry } from "@/server/stylometry"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { History } from "lucide-react"

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
    const [novelResult, notesResult, ideasCountResult, streakResult, summaryResult, activityResult, stylometryResult] = await Promise.all([
        getNovelByIdLight(id),
        getNotes(id),
        getIdeasCount(id),
        getWritingStreak(id),
        getAnalyticsSummary(id),
        getWritingActivity(id, 14), // Last 14 days for mini calendar
        getNovelStylometry(id),
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
    const analyzedNoteIds = new Set((stylometryResult.data || []).map((s: any) => s.noteId))

    // Filtering for Stylometry dashboard selection
    const filterableNotes = notes.filter(n => {
        // Must have title and not be "Untitled Note"
        const hasTitle = n.title && n.title.toLowerCase() !== "untitled note" && n.title.trim() !== ""
        // Must be linked to a chapter
        const isLinked = !!n.linkedToChapterId
        // Must not be already analyzed
        const isNotAnalyzed = !analyzedNoteIds.has(n.id)

        return hasTitle && isLinked && isNotAnalyzed
    })

    const needsRewriteNotes = notes.filter((n: any) => n.status === "needs_rewrite")

    // Calculate stats
    const totalWords = novel.wordCount || 0
    const targetWords = novel.targetWordCount || 50000
    const progress = targetWords > 0 ? Math.min((totalWords / targetWords) * 100, 100) : 0
    const totalChapters = novel.chapters.length
    // earned disclosure: ซ่อนสถิติ/AI tools จนกว่าจะเริ่มเขียนจริง
    const hasContent = totalChapters > 0 || totalWords > 0
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

                    {/* Stats + AI tools — โผล่เมื่อเริ่มเขียนแล้ว (earned disclosure) */}
                    {hasContent && (<>
                    {/* Writing Stats Section */}
                    <div className="space-y-1.5 pt-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">สถิติการเขียน</span>
                            <Link
                                href={`/dashboard/project/${id}/analytics`}
                                className="text-[10px] text-primary hover:underline"
                            >
                                ดูทั้งหมด
                            </Link>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Flame className="h-3 w-3 text-orange-500" />
                                ต่อเนื่อง
                            </span>
                            <span className="text-sm font-semibold tabular-nums">{streak.currentStreak} <span className="text-xs font-normal text-muted-foreground">วัน</span></span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                            <span className="text-xs text-muted-foreground">วันนี้</span>
                            <span className="text-sm font-semibold tabular-nums">{(analytics?.todayWords || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">คำ</span></span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                            <span className="text-xs text-muted-foreground">สัปดาห์นี้</span>
                            <span className="text-sm font-semibold tabular-nums">{(analytics?.weekWords || 0).toLocaleString()} <span className="text-xs font-normal text-muted-foreground">คำ</span></span>
                        </div>
                    </div>

                    {/* Today's Goal & Status */}
                    {analytics?.todayGoal != null && analytics.goalStatus !== 'no_target' && (
                        <div className={`flex items-center justify-between px-2.5 py-2 chamfered-sm text-xs border ${
                            analytics.goalStatus === 'on_track'
                                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                                : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                        }`}>
                            <span className="flex items-center gap-1.5">
                                {analytics.goalStatus === 'on_track'
                                    ? <Check className="h-3.5 w-3.5" />
                                    : <Zap className="h-3.5 w-3.5" />}
                                เป้าหมายวันนี้: <span className="font-bold tabular-nums">{analytics.todayGoal.toLocaleString()} คำ</span>
                            </span>
                            {analytics.daysRemaining !== null && (
                                <span className="text-[10px] opacity-70">เหลือ {analytics.daysRemaining} วัน</span>
                            )}
                        </div>
                    )}

                    {/* Progress Bar */}
                    <div className="space-y-2 pt-2 border-t">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">ความคืบหน้า</span>
                            <span className="font-semibold tabular-nums">{totalWords.toLocaleString()} <span className="font-normal text-muted-foreground">/ {targetWords.toLocaleString()} คำ</span></span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground text-right">{Math.round(progress)}%</p>
                    </div>

                    {/* Mini Activity Calendar - Last 14 days */}
                    <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">กิจกรรม 14 วัน</span>
                            <Link
                                href={`/dashboard/project/${id}/analytics`}
                                className="text-[10px] text-primary hover:underline"
                            >
                                ดูทั้งหมด
                            </Link>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {activityData.slice(-14).map((day: { date: string; count: number }, i: number) => (
                                <div
                                    key={i}
                                    className={cn(
                                        "aspect-square chamfered-sm",
                                        day.count === 0 && "bg-muted/40",
                                        day.count > 0 && day.count < 500 && "bg-[var(--forge-gold)]/20",
                                        day.count >= 500 && day.count < 1000 && "bg-[var(--forge-gold)]/40",
                                        day.count >= 1000 && day.count < 2000 && "bg-[var(--forge-gold)]/65",
                                        day.count >= 2000 && "bg-[var(--forge-gold)]"
                                    )}
                                    title={`${day.date}: ${day.count.toLocaleString()} คำ`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* AI Tools Section */}
                    <div className="pt-4 border-t space-y-2">
                        <div className="flex items-center gap-1.5 mb-3">
                            <Sparkles className="h-3 w-3 text-primary" />
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">เครื่องมือ AI</span>
                        </div>

                        <div className="border border-border chamfered-sm divide-y divide-border/60">
                            <VectorSyncButton novelId={id} />
                            <PlotHoleJobButton novelId={id} />
                            <StylometryBulkAnalyzeButton
                                novelId={id}
                                notes={filterableNotes.map(n => ({ id: n.id, title: n.title, linkedToChapterId: n.linkedToChapterId }))}
                                chapters={novel.chapters.map((c: any) => ({ id: c.id, title: c.title }))}
                                totalNotesCount={notes.filter(n => !!n.linkedToChapterId).length}
                                analyzedCount={analyzedNoteIds.size}
                            />
                        </div>
                    </div>
                    </>)}

                    {/* First-run guide — นำทางนักเขียนใหม่ แทนกำแพงเลข 0 */}
                    {!hasContent && (
                        <div className="border border-border chamfered bg-card/40 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-[var(--forge-gold)]/10 chamfered-sm">
                                    <Sparkles className="h-3.5 w-3.5 text-[var(--forge-gold)]" />
                                </div>
                                <span className="text-sm font-display font-semibold">เริ่มต้นที่นี่</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                สร้างบทแรก แล้วสถิติ เครื่องมือวิเคราะห์ และ AI จะค่อยๆ ปรากฏเมื่อเรื่องของคุณเติบโต
                            </p>
                            <ol className="space-y-2 text-xs">
                                <li className="flex items-center gap-2">
                                    <span className="flex h-5 w-5 items-center justify-center chamfered-sm bg-[var(--forge-gold)]/15 text-[var(--forge-gold)] text-[10px] font-semibold shrink-0">1</span>
                                    เขียนตอนแรก
                                </li>
                                <li className="flex items-center gap-2 text-muted-foreground">
                                    <span className="flex h-5 w-5 items-center justify-center chamfered-sm bg-muted/50 text-[10px] font-semibold shrink-0">2</span>
                                    <Link href={`/dashboard/project/${id}/characters`} className="hover:text-foreground hover:underline">เพิ่มตัวละคร</Link>
                                </li>
                                <li className="flex items-center gap-2 text-muted-foreground">
                                    <span className="flex h-5 w-5 items-center justify-center chamfered-sm bg-muted/50 text-[10px] font-semibold shrink-0">3</span>
                                    <Link href={`/dashboard/project/${id}/plot`} className="hover:text-foreground hover:underline">วางพล็อต</Link>
                                </li>
                            </ol>
                        </div>
                    )}
                </div>

                {/* RIGHT MAIN - Chapters & Rewrite Queue */}
                <div className="space-y-4">
                    <Tabs defaultValue="chapters" className="w-full space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <TabsList className="bg-muted/50">
                                <TabsTrigger value="chapters" className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4" />
                                    <span>บท</span>
                                </TabsTrigger>
                                <TabsTrigger value="rewrite" className="flex items-center gap-2">
                                    <History className="h-4 w-4" />
                                    <span>คิวแก้ไข</span>
                                    {needsRewriteNotes.length > 0 && (
                                        <Badge className="ml-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-1.5 py-0 hover:bg-amber-500/10">
                                            {needsRewriteNotes.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="chapters" className="space-y-3 mt-0 border-none p-0">
                            {/* Actions row */}
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    {totalChapters} บท · {publishedChapters.length} เผยแพร่แล้ว
                                </p>
                                <div className="flex items-center gap-2">
                                    <PublishAssistant
                                        chapters={novel.chapters}
                                        notes={notes as any}
                                        novelTitle={novel.title}
                                    />
                                    <ExportDialog
                                        chapters={novel.chapters}
                                        notes={notes as any}
                                        novelTitle={novel.title}
                                        authorName={(novel as any).user?.name}
                                        coverImage={(novel as any).coverImage}
                                    />
                                    <CreateChapterDialog novelId={id} />
                                </div>
                            </div>

                            {/* Chapters Content */}
                            <div className="chamfered border bg-card/50">
                                {totalChapters === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <div className="p-4 rounded-full bg-muted/50 mb-4">
                                            <Pen className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="text-lg font-display font-semibold mb-2">เริ่มเรื่องราวของคุณ</h3>
                                        <p className="text-sm text-muted-foreground max-w-sm mb-6">
                                            นิยายทุกเรื่องเริ่มต้นจากบทแรก สร้างบทแรกของคุณได้เลย
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
                                                        ฉบับร่าง
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
                                                        เผยแพร่แล้ว
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
                        </TabsContent>

                        <TabsContent value="rewrite" className="space-y-3 mt-0 border-none p-0">
                            <p className="text-sm text-muted-foreground">
                                {needsRewriteNotes.length} ตอนรอการแก้ไข
                            </p>

                            {/* Rewrite Queue Content */}
                            <div className="chamfered border bg-card/50">
                                {needsRewriteNotes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <div className="p-4 rounded-full bg-muted/50 mb-4">
                                            <History className="h-8 w-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="text-lg font-display font-semibold mb-2">ไม่มีงานในคิว</h3>
                                        <p className="text-sm text-muted-foreground max-w-sm">
                                            ตั้งสถานะโน้ตเป็น "รอแก้ไข" ในหน้าเขียน เพื่อให้โน้ตนั้นปรากฏในคิวนี้
                                        </p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border/50">
                                        {needsRewriteNotes.map((noteItem, index) => {
                                            const wordCount = getWordCount((noteItem.content as any)?.text);
                                            const updatedDate = noteItem.updatedAt ? format(new Date(noteItem.updatedAt), "PPp") : "Never";
                                            return (
                                                <div key={noteItem.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-muted/20 transition-colors">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold text-muted-foreground">#{index + 1}</span>
                                                            <span className="font-semibold text-foreground text-sm sm:text-base">{noteItem.title || "Untitled Note"}</span>
                                                            {noteItem.linkedChapter && (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {noteItem.linkedChapter.title}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                                            <span>แก้ไขล่าสุด: {updatedDate}</span>
                                                            <span>•</span>
                                                            <span>{wordCount.toLocaleString()} คำ</span>
                                                            {noteItem.plotHoleCount > 0 && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-amber-500 font-medium">พบ {noteItem.plotHoleCount} plot holes</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-2">
                                                        <Link
                                                            href={`/dashboard/project/${id}/note/${noteItem.id}/rewrite`}
                                                            className="inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3"
                                                        >
                                                            <PenTool className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                                                            ตรวจแก้ (Rewrite)
                                                        </Link>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}

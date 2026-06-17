import { notFound } from "next/navigation";
import { getNovelByIdSimple } from "@/server/novel";
import { getWritingActivity, getWordsPerDay, getWritingStreak, getAnalyticsSummary } from "@/server/analytics";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Flame,
    TrendingUp,
    Calendar,
    Target,
    BookOpen,
    FileText,
    Trophy,
} from "lucide-react";
import { ActivityCalendar } from "@/components/analytics/activity-calendar";
import { WordsChart } from "@/components/analytics/words-chart";
import { StylometryDashboard } from "@/components/analytics/stylometry-dashboard";
import { getNovelStylometry } from "@/server/stylometry";

interface AnalyticsPageProps {
    params: Promise<{ id: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
    const { id: novelId } = await params;

    const [novelResult, activityResult, wordsResult, streakResult, summaryResult, stylometryResult] = await Promise.all([
        getNovelByIdSimple(novelId),
        getWritingActivity(novelId, 90),
        getWordsPerDay(novelId, 7),
        getWritingStreak(novelId),
        getAnalyticsSummary(novelId),
        getNovelStylometry(novelId),
    ]);

    if (!novelResult.success || !novelResult.novel) {
        notFound();
    }

    const novel = novelResult.novel;
    const activity = activityResult.activity || [];
    const wordsPerDay = wordsResult.data || [];
    const streak = streakResult;
    const summary = summaryResult.summary;
    const stylometryData = stylometryResult.success ? stylometryResult.data : [];

    const activeDays = activity.filter((d) => d.words > 0).length;
    const goalProgress = summary?.targetWords
        ? Math.round((summary.totalWords / summary.targetWords) * 100)
        : 0;
    const remainingWords = summary?.targetWords
        ? Math.max(0, summary.targetWords - (summary.totalWords ?? 0))
        : 0;
    // Daily-scoped derivations for the breakdown tab (distinct from the 7-day chart's own total/avg)
    const peakDayWords = wordsPerDay.reduce((max, d) => (d.words > max ? d.words : max), 0);
    const activeDays7 = wordsPerDay.filter((d) => d.words > 0).length;

    return (
        <div className="p-8 space-y-6">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novel.title}
                items={[{ label: "สถิติ" }]}
            />

            {/* Page title */}
            <div className="flex items-end justify-between gap-6 flex-wrap">
                <div>
                    <h1 className="text-3xl font-display font-bold tracking-tight">ภาพรวมการเขียน</h1>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--forge-gold)] opacity-75 animate-forge-pulse" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--forge-gold)]" />
                        </span>
                        <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            บันทึกการทำงาน · 90 วัน
                        </span>
                    </div>
                </div>

                {/* Whole-novel goal — the prime orientation metric, promoted out of the cramped sidebar */}
                {summary?.targetWords ? (
                    <div className="flex flex-col gap-1.5 min-w-[220px]">
                        <div className="flex items-center justify-between gap-4">
                            <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                                <Target className="h-3 w-3" />เป้าหมายทั้งเรื่อง
                            </span>
                            <span className="text-base font-display font-bold tabular-nums leading-none">{goalProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted chamfered-sm overflow-hidden">
                            <div
                                className="h-full bg-[var(--forge-gold)] transition-all"
                                style={{ width: `${Math.min(100, goalProgress)}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                            เหลืออีก {remainingWords.toLocaleString()} คำ
                        </span>
                    </div>
                ) : null}
            </div>

            {/* Hero instrument row: streak gauge + activity heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                {/* STREAK GAUGE — molten forge face */}
                <div className="relative chamfered overflow-hidden noise-texture border border-black/10 bg-gradient-to-br from-[var(--forge-gold)] to-[var(--forge-amber)] flex flex-col justify-between p-5 min-h-[220px]">
                    <div className="relative z-[2] flex items-center justify-between">
                        <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-black/55">
                            ต่อเนื่อง
                        </span>
                        <Flame className="h-4 w-4 text-black/70" />
                    </div>

                    <div className="relative z-[2]">
                        <div className="flex items-baseline gap-2">
                            <span className="font-display text-6xl font-bold tabular-nums leading-none text-[oklch(0.2_0.04_60)]">
                                {streak.currentStreak}
                            </span>
                            <span className="text-sm text-black/45">วัน</span>
                        </div>
                        <p className="text-xs text-black/60 mt-2">
                            {streak.currentStreak > 0 ? "เขียนต่อเนื่องไม่ขาดสาย" : "เริ่มสตรีคของคุณวันนี้"}
                        </p>
                    </div>

                    <div className="relative z-[2] flex items-center gap-1.5 text-[11px] text-black/55 pt-2.5 border-t border-black/10">
                        <Trophy className="h-3 w-3" />
                        สถิติสูงสุด {streak.bestStreak} วัน
                    </div>

                    {/* hazard edge — industrial signature */}
                    <div className="absolute bottom-0 left-0 right-0 h-[4px] hazard-stripe-dark z-[2] opacity-70" />
                </div>

                {/* ACTIVITY HEATMAP — the hero */}
                <div className="chamfered border border-border bg-card/50 p-5 flex flex-col">
                    <div className="flex items-end justify-between mb-4">
                        <div className="flex flex-col gap-1">
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                                แผนผังกิจกรรม · 90 วัน
                            </span>
                            <span className="text-sm font-display font-semibold tracking-tight">
                                จังหวะการเขียนของคุณ
                            </span>
                        </div>
                        <span className="font-technical text-[9px] tabular-nums text-muted-foreground/70">
                            <span className="text-base font-display font-bold text-foreground tabular-nums">{activeDays}</span> วันที่ลงมือ
                        </span>
                    </div>
                    <div className="flex-1 flex items-center">
                        <ActivityCalendar activity={activity} large />
                    </div>
                </div>
            </div>

            {/* Readout strip */}
            <div className="chamfered border border-border bg-card/50 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/60">
                <div className="px-5 py-4 flex flex-col gap-1.5">
                    <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-[var(--forge-gold)]" />
                        วันนี้
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-display font-bold tabular-nums">{summary?.todayWords?.toLocaleString() || '0'}</span>
                        <span className="text-xs text-muted-foreground">คำ</span>
                    </div>
                </div>
                <div className="px-5 py-4 flex flex-col gap-1.5">
                    <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3" />สัปดาห์นี้
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-display font-bold tabular-nums">{summary?.weekWords?.toLocaleString() || '0'}</span>
                        <span className="text-xs text-muted-foreground">คำ</span>
                    </div>
                </div>
                <div className="px-5 py-4 flex flex-col gap-1.5">
                    <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />เดือนนี้
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-display font-bold tabular-nums">{summary?.monthWords?.toLocaleString() || '0'}</span>
                        <span className="text-xs text-muted-foreground">คำ</span>
                    </div>
                </div>
                <div className="px-5 py-4 flex flex-col gap-1.5">
                    <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="h-3 w-3" />รวมทั้งหมด
                    </span>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-display font-bold tabular-nums">{summary?.totalWords?.toLocaleString() || '0'}</span>
                        <span className="text-xs text-muted-foreground">คำ</span>
                    </div>
                </div>
            </div>

            {/* Tabs: daily breakdown vs stylometry */}
            <Tabs defaultValue="daily" className="space-y-4 pt-1">
                <TabsList>
                    <TabsTrigger value="daily">รายวัน</TabsTrigger>
                    <TabsTrigger value="style">วิเคราะห์สไตล์</TabsTrigger>
                </TabsList>

                <TabsContent value="daily" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 chamfered border border-border bg-card/50 p-5">
                            <div className="flex items-center justify-between mb-5">
                                <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                    <TrendingUp className="h-3.5 w-3.5" />
                                    คำที่เขียนรายวัน · 7 วัน
                                </span>
                            </div>
                            <WordsChart data={wordsPerDay} />
                        </div>

                        <div className="chamfered border border-border bg-card/50 divide-y divide-border/60">
                            <div className="p-5 flex flex-col gap-1">
                                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                                    <FileText className="h-3 w-3" />จำนวนตอน
                                </span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-display font-bold tabular-nums tracking-tight">
                                        {summary?.totalNotes || '0'}
                                    </span>
                                    <span className="text-sm text-muted-foreground">ตอน</span>
                                </div>
                            </div>

                            <div className="p-5 flex flex-col gap-1">
                                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                                    <TrendingUp className="h-3 w-3" />ทำได้สูงสุด · 7 วัน
                                </span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-display font-bold tabular-nums tracking-tight">
                                        {peakDayWords.toLocaleString()}
                                    </span>
                                    <span className="text-sm text-muted-foreground">คำ/วัน</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">วันที่เขียนได้มากที่สุด</span>
                            </div>

                            <div className="p-5 flex flex-col gap-1">
                                <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                                    <Flame className="h-3 w-3" />ลงมือ · 7 วัน
                                </span>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl font-display font-bold tabular-nums tracking-tight">
                                        {activeDays7}
                                    </span>
                                    <span className="text-sm text-muted-foreground">/ 7 วัน</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">ความสม่ำเสมอสัปดาห์นี้</span>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="style">
                    <StylometryDashboard data={stylometryData as any} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

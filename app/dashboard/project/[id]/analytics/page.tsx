import { notFound } from "next/navigation";
import { getNovelByIdSimple } from "@/server/novel";
import { getWritingActivity, getWordsPerDay, getWritingStreak, getAnalyticsSummary } from "@/server/analytics";
import { ProjectBreadcrumb } from "@/components/project/project-breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Flame,
    TrendingUp,
    Calendar,
    PenTool,
    Target,
    BookOpen,
    FileText,
    Trophy,
    Zap,
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

    return (
        <div className="p-8 space-y-8">
            <ProjectBreadcrumb
                novelId={novelId}
                novelTitle={novel.title}
                items={[{ label: "Analytics" }]}
            />

            <div>
                <h1 className="text-3xl font-bold">Writing Analytics</h1>
                <p className="text-muted-foreground mt-1">
                    Track your writing progress and habits
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Writing Streak */}
                <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-500/20">
                                <Flame className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{streak.currentStreak}</p>
                                <p className="text-xs text-muted-foreground">Day Streak</p>
                            </div>
                        </div>
                        {streak.bestStreak > 0 && (
                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                Best: {streak.bestStreak} days
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Today */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <PenTool className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{summary?.todayWords?.toLocaleString() || 0}</p>
                                <p className="text-xs text-muted-foreground">Words Today</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* This Week */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-500/20">
                                <TrendingUp className="w-5 h-5 text-green-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{summary?.weekWords?.toLocaleString() || 0}</p>
                                <p className="text-xs text-muted-foreground">This Week</p>
                            </div>
                        </div>
                        {summary?.avgWordsPerDay && summary.avgWordsPerDay > 0 && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Avg: {summary.avgWordsPerDay} words/day
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* This Month */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                                <Calendar className="w-5 h-5 text-purple-500" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{summary?.monthWords?.toLocaleString() || 0}</p>
                                <p className="text-xs text-muted-foreground">This Month</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Words Per Day Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Words Per Day (Last 7 Days)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <WordsChart data={wordsPerDay} />
                </CardContent>
            </Card>

            {/* Activity Calendar */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Writing Activity (Last 90 Days)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ActivityCalendar activity={activity} />
                </CardContent>
            </Card>

            {/* Project Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-indigo-500/20">
                            <BookOpen className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{summary?.totalWords?.toLocaleString() || 0}</p>
                            <p className="text-sm text-muted-foreground">Total Words</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-teal-500/20">
                            <FileText className="w-6 h-6 text-teal-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">{summary?.totalNotes || 0}</p>
                            <p className="text-sm text-muted-foreground">Total Notes</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-amber-500/20">
                            <Target className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-3xl font-bold">
                                {summary?.targetWords
                                    ? Math.round((summary.totalWords / summary.targetWords) * 100)
                                    : 0}%
                            </p>
                            <p className="text-sm text-muted-foreground">Goal Progress</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <hr className="my-8" />
            
            <StylometryDashboard data={stylometryData as any} />
        </div>
    );
}

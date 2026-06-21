import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getAccountAnalytics } from "@/server/analytics";
import { PageWrapper } from "@/components/page-warpper";
import { ActivityCalendar } from "@/components/analytics/activity-calendar";
import { Flame, Trophy, BookOpen, FileText, Type, ChevronRight } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
    draft: "ฉบับร่าง",
    in_progress: "กำลังเขียน",
    completed: "จบแล้ว",
    published: "เผยแพร่",
    archived: "เก็บเข้ากรุ",
};

export default async function AccountAnalyticsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return <div className="p-8">Not authenticated</div>;

    const result = await getAccountAnalytics(session.user.id);

    if (!result.success) {
        return (
            <PageWrapper breadcrumbs={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "สถิติรวม", href: "/dashboard/analytics" }]}>
                <p className="p-8 text-destructive">โหลดสถิติไม่สำเร็จ</p>
            </PageWrapper>
        );
    }

    const { totals, streak, activity, portfolio } = result;

    return (
        <PageWrapper breadcrumbs={[{ label: "หน้าหลัก", href: "/dashboard" }, { label: "สถิติรวม", href: "/dashboard/analytics" }]}>
            <div className="p-6 md:p-8 space-y-6">
                {/* Title */}
                <div>
                    <h1 className="text-3xl font-display font-bold tracking-tight">ภาพรวมนักเขียน</h1>
                    <span className="font-technical text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1.5 block">
                        สถิติรวมทุกเล่ม · 90 วัน
                    </span>
                </div>

                {/* Stat strip */}
                <div className="chamfered border border-border bg-card/50 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/60">
                    <Stat icon={<Type className="h-3 w-3" />} label="คำทั้งหมด" value={totals.words.toLocaleString()} unit="คำ" />
                    <Stat icon={<BookOpen className="h-3 w-3" />} label="นิยาย" value={totals.novels.toString()} unit="เล่ม" />
                    <Stat icon={<FileText className="h-3 w-3" />} label="บททั้งหมด" value={totals.chapters.toString()} unit="บท" />
                    <Stat icon={<Flame className="h-3 w-3" />} label="ลงมือ" value={totals.activeDays.toString()} unit="วัน/90" />
                </div>

                {/* Streak gauge + combined heatmap */}
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                    <div className="relative chamfered overflow-hidden border border-black/10 bg-gradient-to-br from-[var(--forge-gold)] to-[var(--forge-amber)] flex flex-col justify-between p-5 min-h-[200px]">
                        <div className="flex items-center justify-between">
                            <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-black/55">ต่อเนื่อง (ทุกเล่ม)</span>
                            <Flame className="h-4 w-4 text-black/70" />
                        </div>
                        <div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-display text-6xl font-bold tabular-nums leading-none text-[oklch(0.2_0.04_60)]">
                                    {streak.current}
                                </span>
                                <span className="text-sm text-black/45">วัน</span>
                            </div>
                            <p className="text-xs text-black/60 mt-2">
                                {streak.current > 0 ? "เขียนต่อเนื่องไม่ขาดสาย" : "เริ่มสตรีคของคุณวันนี้"}
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-black/55 pt-2.5 border-t border-black/10">
                            <Trophy className="h-3 w-3" />สถิติสูงสุด {streak.best} วัน
                        </div>
                    </div>

                    <div className="chamfered border border-border bg-card/50 p-5 flex flex-col">
                        <span className="font-technical text-[9px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
                            แผนผังกิจกรรมรวม · 90 วัน
                        </span>
                        <div className="flex-1 flex items-center">
                            <ActivityCalendar activity={activity} large />
                        </div>
                    </div>
                </div>

                {/* Portfolio */}
                <div>
                    <h2 className="text-sm font-display font-semibold tracking-tight mb-3 flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-[var(--forge-gold)]" />
                        ชั้นหนังสือ ({portfolio.length})
                    </h2>
                    {portfolio.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center border border-dashed chamfered">
                            ยังไม่มีนิยาย — สร้างเล่มแรกของคุณ
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {portfolio.map((nv) => (
                                <Link
                                    key={nv.id}
                                    href={`/dashboard/project/${nv.id}`}
                                    className="group chamfered border border-border bg-card/50 hover:bg-card transition-colors p-4 flex flex-col gap-2.5"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h3 className="font-display font-semibold truncate group-hover:text-[var(--forge-gold)] transition-colors">
                                                {nv.title}
                                            </h3>
                                            <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                                                {STATUS_LABEL[nv.status] ?? nv.status}
                                            </span>
                                        </div>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    </div>

                                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground tabular-nums">
                                        <span><span className="text-foreground font-semibold">{nv.wordCount.toLocaleString()}</span> คำ</span>
                                        <span><span className="text-foreground font-semibold">{nv.chaptersCount}</span> บท</span>
                                    </div>

                                    {nv.targetWordCount ? (
                                        <div className="space-y-1">
                                            <div className="h-1.5 w-full bg-muted chamfered-sm overflow-hidden">
                                                <div className="h-full bg-[var(--forge-gold)] transition-all" style={{ width: `${nv.progress}%` }} />
                                            </div>
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {nv.progress}% ของ {nv.targetWordCount.toLocaleString()} คำ
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground/60">ยังไม่ตั้งเป้าหมายคำ</span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </PageWrapper>
    );
}

function Stat({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
    return (
        <div className="px-5 py-4 flex flex-col gap-1.5">
            <span className="font-technical text-[9px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                {icon}{label}
            </span>
            <div className="flex items-baseline gap-1">
                <span className="text-2xl font-display font-bold tabular-nums">{value}</span>
                <span className="text-xs text-muted-foreground">{unit}</span>
            </div>
        </div>
    );
}

import { PageWrapper } from "@/components/page-warpper";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { AiFeatureCard } from "@/components/dashboard/ai-control/feature-card";
import { getAiOverview } from "@/server/ai-control";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
    success: "text-emerald-600 dark:text-emerald-400",
    error: "text-destructive",
    blocked: "text-amber-600 dark:text-amber-400",
};

export default async function AiControlPage() {
    const data = await getAiOverview();

    if (data.isGuest) {
        return (
            <PageWrapper
                breadcrumbs={[
                    { label: "หน้าหลัก", href: "/dashboard" },
                    { label: "AI Control", href: "/dashboard/ai-control" },
                ]}
            >
                <h1 className="text-xl font-semibold">AI Control Board</h1>
                <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        โหมดผู้เยี่ยมชมไม่สามารถดูแผงควบคุม AI ได้
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    const totalTokens = data.totalsToday.promptTokens + data.totalsToday.completionTokens;

    return (
        <PageWrapper
            breadcrumbs={[
                { label: "หน้าหลัก", href: "/dashboard" },
                { label: "AI Control", href: "/dashboard/ai-control" },
            ]}
        >
            <div className="space-y-6">
                <div>
                    <h1 className="text-xl font-semibold">AI Control Board</h1>
                    <p className="text-sm text-muted-foreground">
                        ภาพรวมการใช้ AI ของบัญชีคุณ · แก้ flag/quota ผ่านคำสั่ง{" "}
                        <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">npm run ai list</code>{" "}
                        (เปิด/ปิด, quota, reset)
                    </p>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">AI runs วันนี้</p>
                            <p className="text-2xl font-semibold tabular-nums">
                                {data.totalsToday.runs.toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">Tokens วันนี้ (prompt + completion)</p>
                            <p className="text-2xl font-semibold tabular-nums">{totalTokens.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                in {data.totalsToday.promptTokens.toLocaleString()} · out{" "}
                                {data.totalsToday.completionTokens.toLocaleString()}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">ฟีเจอร์ AI ที่ปิดอยู่</p>
                            <p className="text-2xl font-semibold tabular-nums">
                                {data.features.filter((f) => !f.enabled).length}
                                <span className="text-sm text-muted-foreground">/{data.features.length}</span>
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Model map — ฟังก์ชันไหนใช้ model อะไร */}
                <section>
                    <h2 className="text-sm font-medium mb-3">แผนผังโมเดล — ฟังก์ชันไหนใช้ AI ตัวไหน</h2>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-56">ฟังก์ชัน</TableHead>
                                        <TableHead className="w-28">ลำดับ</TableHead>
                                        <TableHead className="w-24">Provider</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead className="w-20 text-right">Temp</TableHead>
                                        <TableHead className="w-24 text-right">Max Tokens</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.features.flatMap((f) =>
                                        f.steps.map((s, i) => (
                                            <TableRow key={`${f.key}:${i}`} className={i > 0 ? "border-t-dashed" : ""}>
                                                <TableCell className="text-xs font-medium">
                                                    {i === 0 ? f.label : ""}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{s.order}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-[10px] font-mono ${
                                                            s.provider === "groq"
                                                                ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                                                                : s.provider === "typhoon"
                                                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                                                                    : s.provider === "gemini"
                                                                        ? "bg-violet-500/15 text-violet-700 dark:text-violet-300"
                                                                        : ""
                                                        }`}
                                                    >
                                                        {s.provider}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono">{s.model}</TableCell>
                                                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                                    {s.temperature ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                                    {s.maxTokens?.toLocaleString() ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                        )),
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    <p className="text-xs text-muted-foreground mt-2">
                        &quot;สำรอง&quot; = fallback เมื่อตัวหลักล้ม (เดินอัตโนมัติที่ gateway) ·
                        &quot;ภายใน Python&quot; = pythonservice เรียกเองข้างใน (gate ผ่าน gateway, execution ฝั่ง Python)
                    </p>
                </section>

                {/* Feature status */}
                <section>
                    <h2 className="text-sm font-medium mb-3">สถานะฟีเจอร์ AI ทั้งหมด</h2>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {data.features.map((f) => (
                            <AiFeatureCard key={f.key} feature={f} />
                        ))}
                    </div>
                </section>

                {/* Recent runs */}
                <section>
                    <h2 className="text-sm font-medium mb-3">AI runs ล่าสุด</h2>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-36">ฟีเจอร์</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead className="w-20">สถานะ</TableHead>
                                        <TableHead className="w-24 text-right">Tokens</TableHead>
                                        <TableHead className="w-20 text-right">Latency</TableHead>
                                        <TableHead className="w-32 text-right">เวลา</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.recentRuns.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                                ยังไม่มีการเรียก AI — log จะปรากฏที่นี่หลังใช้งานฟีเจอร์ AI ใดๆ
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {data.recentRuns.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell className="text-xs font-medium">{r.feature}</TableCell>
                                            <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-52">
                                                {r.provider}/{r.model}
                                                {r.errorDetail && (
                                                    <span className="block text-destructive truncate max-w-52" title={r.errorDetail}>
                                                        {r.errorDetail}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className={`text-xs ${STATUS_STYLE[r.status] ?? ""}`}>
                                                {r.status}
                                            </TableCell>
                                            <TableCell className="text-right text-xs tabular-nums">
                                                {(r.promptTokens + r.completionTokens).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                                                {r.latencyMs != null ? `${(r.latencyMs / 1000).toFixed(1)}s` : "—"}
                                            </TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {new Date(r.createdAt).toLocaleTimeString("th-TH", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </section>

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">hint</Badge>
                    quota นับเฉพาะ run ที่ยิงจริง (success/error) · รีเซ็ตที่เที่ยงคืน · guest mode ถูกบล็อกที่ gateway เสมอ ·
                    แก้ค่าด้วย <code className="font-mono">npm run ai --help</code>
                </p>
            </div>
        </PageWrapper>
    );
}

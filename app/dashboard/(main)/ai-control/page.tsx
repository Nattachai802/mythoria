import { PageWrapper } from "@/components/page-warpper";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveFeatureGrids } from "@/components/dashboard/ai-control/live-feature-grid";
import { ModelMapSection } from "@/components/dashboard/ai-control/model-map-section";
import { RecentRunsSection } from "@/components/dashboard/ai-control/recent-runs-section";
import { getAiOverview, type AiFeatureView } from "@/server/ai-control";

export const dynamic = "force-dynamic";

// ฟีเจอร์ที่ไม่มี step เรียก LLM ตรงจาก Next.js เลย (chain ว่าง, มีแต่ pythonModels)
// ตรงกับสองกลุ่มที่ lib/ai-features.ts คอมเมนต์แยกไว้เองอยู่แล้ว
const isPythonOnly = (f: AiFeatureView) => f.steps.length > 0 && f.steps.every((s) => s.order === "ภายใน Python");

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
    const nextjsFeatures = data.features.filter((f) => !isPythonOnly(f));
    const pythonFeatures = data.features.filter(isPythonOnly);

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

                {/* Feature status — แยกกลุ่มตาม registry เอง (lib/ai-features.ts): เรียก LLM ตรงจาก Next.js vs ผ่าน Python */}
                <LiveFeatureGrids
                    groups={[
                        { heading: "สถานะฟีเจอร์ AI — เรียกตรงจาก Next.js", features: nextjsFeatures },
                        { heading: "สถานะฟีเจอร์ AI — ผ่าน Python microservice", features: pythonFeatures },
                    ]}
                />

                {/* Recent runs — สิ่งที่คนเปิดหน้านี้มาดูจริงๆ (อะไรพังบ้าง) เลยอยู่ก่อนแผนผังโมเดลที่เป็นแค่ของอ้างอิง */}
                <RecentRunsSection runs={data.recentRuns} />

                {/* Model map — อ้างอิงล้วน ไม่ใช่ของเช็คทุกครั้ง พับไว้เป็นค่าเริ่มต้น (ซ้ำกับป้าย provider/model บนการ์ดด้านบนอยู่แล้ว) */}
                <ModelMapSection features={data.features} />

                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">hint</Badge>
                    quota นับเฉพาะ run ที่ยิงจริง (success/error) · รีเซ็ตที่เที่ยงคืน · guest mode ถูกบล็อกที่ gateway เสมอ ·
                    แก้ค่าด้วย <code className="font-mono">npm run ai --help</code>
                </p>
            </div>
        </PageWrapper>
    );
}

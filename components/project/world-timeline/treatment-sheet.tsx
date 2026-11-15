"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleAlert, Loader2, RefreshCw, Scale } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { getTreatmentReport, type TreatmentReport } from "@/server/world-timeline"
import { RULE_LABEL, type CsRef, type FindingRule } from "@/lib/world-consistency"

/**
 * Treatment — ตรวจว่าทุกอย่างสมเหตุสมผลต่อกันไหม (กดตรวจเอง · กฎล้วน ไม่ใช้ AI)
 * ตรวจใหม่ทุกครั้งที่เปิด เพราะผลขึ้นกับข้อมูลหลายหน้า (ฉาก lore ตัวละคร สถานที่) ที่แก้จากที่อื่นได้
 */
export function TreatmentSheet({ novelId }: { novelId: string }) {
    const [report, setReport] = useState<TreatmentReport | null>(null)
    const [error, setError] = useState(false)
    const [isPending, startTransition] = useTransition()

    const run = () => startTransition(async () => {
        try {
            setReport(await getTreatmentReport(novelId))
            setError(false)
        } catch {
            setError(true)
        }
    })

    const hrefOf = (r: CsRef) =>
        r.kind === "scene" ? `/dashboard/project/${novelId}/plot`
            : r.kind === "character" ? `/dashboard/project/${novelId}/characters/${r.id}`
                : r.kind === "chapter" ? `/dashboard/project/${novelId}/chapter/${r.id}`
                    : null

    const groups = new Map<FindingRule, TreatmentReport["findings"]>()
    for (const f of report?.findings ?? []) groups.set(f.rule, [...(groups.get(f.rule) ?? []), f])
    const errors = report?.findings.filter(f => f.severity === "error").length ?? 0

    return (
        <Sheet onOpenChange={o => { if (o) run() }}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Scale className="size-4" /> ตรวจความสมเหตุสมผล
                </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>ตรวจความสมเหตุสมผล</SheetTitle>
                    <SheetDescription>
                        เทียบฉาก เหตุการณ์ ตัวละคร และสถานที่บนแกนเวลาเดียวกัน · ข้อมูลไม่พอจะไม่เตือน
                    </SheetDescription>
                </SheetHeader>

                <div className="flex items-center gap-2 border-b px-4 pb-3 text-sm">
                    {isPending ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> กำลังตรวจ…</span>
                    ) : report ? (
                        <span className="text-muted-foreground">
                            พบ {report.findings.length} ข้อ{errors ? ` (ขัดกันชัดเจน ${errors})` : ""}
                        </span>
                    ) : null}
                    <span className="flex-1" />
                    <Button variant="ghost" size="sm" className="gap-1" onClick={run} disabled={isPending}>
                        <RefreshCw className="size-3.5" /> ตรวจใหม่
                    </Button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {error && <p className="text-sm text-destructive">ตรวจไม่สำเร็จ ลองกด "ตรวจใหม่"</p>}
                    {report?.failed.length ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">ตัวตรวจบางตัวรันไม่สำเร็จ: {report.failed.join(", ")}</p>
                    ) : null}
                    {report && report.findings.length === 0 && !isPending && (
                        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                            <CheckCircle2 className="size-6 text-emerald-600" />
                            ไม่พบจุดที่ขัดกัน
                            <span className="text-xs">ยิ่งใส่เวลา สถานที่ และผู้เกี่ยวข้องให้ฉากกับเหตุการณ์มาก ยิ่งตรวจได้ละเอียด</span>
                        </div>
                    )}
                    {[...groups.entries()].map(([rule, list]) => (
                        <section key={rule} className="space-y-2">
                            <h3 className="text-xs font-medium text-muted-foreground">{RULE_LABEL[rule]} ({list.length})</h3>
                            {list.map(f => {
                                const Icon = f.severity === "error" ? CircleAlert : AlertTriangle
                                return (
                                    <div
                                        key={f.id}
                                        className={cn(
                                            "space-y-1.5 rounded-md border p-2.5 text-sm",
                                            f.severity === "error" ? "border-destructive/40" : "border-amber-500/40",
                                        )}
                                    >
                                        <p className="flex gap-1.5">
                                            <Icon className={cn("mt-0.5 size-4 shrink-0", f.severity === "error" ? "text-destructive" : "text-amber-600")} />
                                            <span>{f.message}</span>
                                        </p>
                                        <div className="flex flex-wrap gap-1 pl-5">
                                            {f.refs.map(r => {
                                                const href = hrefOf(r)
                                                const chip = <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{r.title}</span>
                                                return href
                                                    ? <Link key={`${r.kind}:${r.id}`} href={href} className="hover:opacity-80">{chip}</Link>
                                                    : <span key={`${r.kind}:${r.id}`}>{chip}</span>
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </section>
                    ))}
                </div>
            </SheetContent>
        </Sheet>
    )
}

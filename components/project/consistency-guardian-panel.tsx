"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, AlertTriangle, Loader2, BookOpen, Skull } from "lucide-react";
import { toast } from "sonner";
import { getConsistencyIssues, type ConsistencyIssue } from "@/server/consistency-guardian";

export function ConsistencyGuardianPanel({ novelId }: { novelId: string }) {
    const [loading, setLoading] = useState(false);
    const [issues, setIssues] = useState<ConsistencyIssue[] | null>(null);

    const run = async () => {
        setLoading(true);
        const res = await getConsistencyIssues(novelId);
        if (res.success) {
            setIssues(res.issues);
            if (res.issues.length === 0) toast.success("ไม่พบความขัดแย้ง");
        } else {
            toast.error(res.error || "ตรวจไม่สำเร็จ");
        }
        setLoading(false);
    };

    return (
        <div className="chamfered border border-border bg-card/50 p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                    {issues && issues.length > 0 ? (
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                    ) : (
                        <ShieldCheck className="h-5 w-5 text-[var(--forge-gold,#e0a13c)]" />
                    )}
                    <div>
                        <h3 className="text-sm font-display font-semibold tracking-tight">ผู้พิทักษ์ความสอดคล้อง</h3>
                        <p className="text-xs text-muted-foreground">
                            ตรวจความขัดแย้งเชิงโครงสร้างทั้งเล่ม · ตายแล้วยังปรากฏ
                        </p>
                    </div>
                </div>
                <Button size="sm" onClick={run} disabled={loading} className="gap-1.5 shrink-0">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    ตรวจสอบ
                </Button>
            </div>

            {issues !== null && (
                issues.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        ไม่พบความขัดแย้ง — ตัวละครที่ตายไม่ปรากฏในบทถัดมา
                    </div>
                ) : (
                    <div className="space-y-2">
                        <p className="text-xs font-technical uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-destructive" />
                            พบ {issues.length} จุดที่ขัดแย้ง
                        </p>
                        {issues.map((iss) => (
                            <div
                                key={iss.id}
                                className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-2"
                            >
                                <div className="flex items-center gap-2">
                                    <Skull className="h-4 w-4 text-destructive shrink-0" />
                                    <span className="font-medium">{iss.characterName}</span>
                                    <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive">
                                        ตายแล้วยังปรากฏ
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap pl-6">
                                    <span className="inline-flex items-center gap-1">
                                        <Skull className="h-3 w-3" /> ตายในบท
                                    </span>
                                    <Link
                                        href={`/dashboard/project/${novelId}/chapter/${iss.deathChapter.id}/overview`}
                                        className="font-medium text-foreground hover:text-[var(--forge-gold,#e0a13c)]"
                                    >
                                        {iss.deathChapter.title}
                                    </Link>
                                    <span className="opacity-40">→</span>
                                    <span className="inline-flex items-center gap-1">
                                        <BookOpen className="h-3 w-3" /> ปรากฏในบท
                                    </span>
                                    <Link
                                        href={`/dashboard/project/${novelId}/chapter/${iss.appearChapter.id}/overview`}
                                        className="font-medium text-destructive hover:underline"
                                    >
                                        {iss.appearChapter.title}
                                    </Link>
                                </div>
                            </div>
                        ))}
                        <p className="text-[10px] text-muted-foreground pt-1">
                            หมายเหตุ: ตัวละครที่มีสถานะ "ไม่ตาย" ในบทถัดมา (ชุบชีวิต) จะไม่ถูกเตือน
                        </p>
                    </div>
                )
            )}
        </div>
    );
}

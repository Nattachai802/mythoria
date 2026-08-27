"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { AiOverviewData } from "@/server/ai-control";

const STATUS_STYLE: Record<string, string> = {
    success: "text-emerald-600 dark:text-emerald-400",
    error: "text-destructive",
    blocked: "text-amber-600 dark:text-amber-400",
};

const VISIBLE_DEFAULT = 10;

// เดิมกาง 40 แถวเต็มเสมอ + ไม่มีตัวนับ error เลย ต้องไล่อ่านเองว่าอะไรพัง
export function RecentRunsSection({ runs }: { runs: AiOverviewData["recentRuns"] }) {
    const [showAll, setShowAll] = useState(false);
    const errorCount = runs.filter((r) => r.status === "error").length;
    const visible = showAll ? runs : runs.slice(0, VISIBLE_DEFAULT);

    return (
        <section>
            <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-medium">AI runs ล่าสุด</h2>
                {errorCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">
                        {errorCount} ข้อผิดพลาด
                    </Badge>
                )}
            </div>
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
                            {visible.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        ยังไม่มีการเรียก AI — log จะปรากฏที่นี่หลังใช้งานฟีเจอร์ AI ใดๆ
                                    </TableCell>
                                </TableRow>
                            )}
                            {visible.map((r) => (
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
            {runs.length > VISIBLE_DEFAULT && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 text-xs text-muted-foreground"
                    onClick={() => setShowAll((v) => !v)}
                >
                    {showAll ? "แสดงน้อยลง" : `แสดงทั้งหมด (${runs.length})`}
                </Button>
            )}
        </section>
    );
}

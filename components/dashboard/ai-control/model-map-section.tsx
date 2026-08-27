"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { PROVIDER_STYLE } from "./feature-card";
import type { AiFeatureView } from "@/server/ai-control";

// อ้างอิงเฉย ๆ ไม่ใช่ของที่เช็คทุกครั้งที่เปิดหน้า — พับไว้ก่อนเป็นค่าเริ่มต้น
// (ตามที่ critique ชี้: ซ้ำกับป้าย provider/model ที่อยู่ในการ์ดสถานะฟีเจอร์ด้านบนอยู่แล้ว)
export function ModelMapSection({ features }: { features: AiFeatureView[] }) {
    const [open, setOpen] = useState(false);
    const providerCount = new Set(features.flatMap((f) => f.steps.map((s) => s.provider))).size;

    return (
        <Collapsible open={open} onOpenChange={setOpen}>
            <section>
                <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center justify-between gap-2 text-left">
                        <h2 className="text-sm font-medium">แผนผังโมเดล — ฟังก์ชันไหนใช้ AI ตัวไหน</h2>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {features.length} ฟีเจอร์ · {providerCount} providers
                            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                    </button>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3">
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
                                    {features.flatMap((f) =>
                                        f.steps.map((s, i) => (
                                            <TableRow key={`${f.key}:${i}`} className={i > 0 ? "border-t-dashed" : ""}>
                                                <TableCell className="text-xs font-medium">
                                                    {i === 0 ? f.label : <span className="sr-only">{f.label}</span>}
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{s.order}</TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="secondary"
                                                        className={`text-[10px] font-mono ${PROVIDER_STYLE[s.provider] ?? ""}`}
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
                </CollapsibleContent>
            </section>
        </Collapsible>
    );
}

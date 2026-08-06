"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * ผู้อ่านจำลอง — คะแนนการตอบสนอง ไม่ใช่คำชม
 *
 * เดิมเป็นฟองแชทจาก persona 5 ตัวที่พูดเรื่องเดียวกันคนละน้ำเสียง
 * ตอนนี้เหลือผู้อ่านคนเดียวที่ "เห็นเฉพาะตอนก่อนหน้า" และให้คะแนน 3 มิติ
 * บรรทัด "เห็น N ตอนก่อนหน้า" คือหลักฐานว่าคะแนนความลุ้นเชื่อถือได้ ต้องแสดงเสมอ
 */

interface ReaderResponse {
    suspense: number; suspenseReason: string;
    curiosity: number; curiosityReason: string;
    surprise: number; surpriseReason: string;
    motivationClarity: string | null; motivationReason: string | null;
    causality: string | null; causalityReason: string | null;
    stakes: string | null; stakesReason: string | null;
    contextPosition: number;
    truncated: boolean;
    model: string;
    createdAt: string;
}

interface Props {
    noteId: string;
    novelId: string;
}

const SCALE_LABEL: Record<string, { text: string; cls: string }> = {
    clear: { text: "ชัดเจน", cls: "text-emerald-600 dark:text-emerald-400" },
    muddy: { text: "คลุมเครือ", cls: "text-amber-600 dark:text-amber-400" },
    unclear: { text: "ไม่เข้าใจ", cls: "text-red-500" },
};

export function AIReviewPanel({ noteId, novelId }: Props) {
    const [data, setData] = useState<ReaderResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/novel/${novelId}/note/${noteId}/ai-review`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setData(json.response ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [novelId, noteId]);

    useEffect(() => { load(); }, [load]);

    const generate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const res = await fetch(`/api/novel/${novelId}/note/${noteId}/ai-review`, { method: "POST" });
            const json = await res.json();
            if (!res.ok || !json.success) {
                const msg = json.message || json.error || `HTTP ${res.status}`;
                setError(msg);
                toast.error(msg);
                return;
            }
            setData(json.response);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            toast.error(msg);
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">ผู้อ่านจำลอง</span>
                {data && (
                    <span className="text-[11px] text-muted-foreground ml-auto">
                        เห็น {data.contextPosition} ตอนก่อนหน้า
                    </span>
                )}
            </div>

            {error && <p className="text-[11px] text-destructive mb-2">{error}</p>}

            {loading && !data ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                    <RefreshCw className="h-3 w-3 animate-spin" /> กำลังโหลด…
                </div>
            ) : !data ? (
                <div className="py-3 text-center space-y-2">
                    <p className="text-[11px] text-muted-foreground">
                        ให้ผู้อ่านที่ยังไม่รู้ตอนจบ อ่านตอนนี้แล้วบอกว่าลุ้นแค่ไหน
                    </p>
                    <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
                        {generating ? <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                        {generating ? "กำลังอ่าน…" : "ส่งให้อ่าน"}
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    <Score label="ความลุ้น" value={data.suspense} reason={data.suspenseReason} />
                    <Score label="ความสงสัย" value={data.curiosity} reason={data.curiosityReason} />
                    <Score label="เซอร์ไพรส์" value={data.surprise} reason={data.surpriseReason} />

                    <div className="border-t pt-2 space-y-1">
                        <Flag label="แรงจูงใจ" value={data.motivationClarity} reason={data.motivationReason} />
                        <Flag label="เหตุ-ผล" value={data.causality} reason={data.causalityReason} />
                        <Flag label="เดิมพัน" value={data.stakes} reason={data.stakesReason} />
                    </div>

                    {data.truncated && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400">
                            ตอนนี้ยาวเกินโควตา — ผู้อ่านได้เห็นช่วงต้นและช่วงท้าย ตัดช่วงกลางออก
                        </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={generate} disabled={generating}>
                            <RefreshCw className={cn("h-3 w-3 mr-1", generating && "animate-spin")} />
                            อ่านใหม่
                        </Button>
                        <span className="text-[10px] text-muted-foreground/70 ml-auto">{data.model}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function Score({ label, value, reason }: { label: string; value: number; reason: string }) {
    return (
        <div className="text-[11px]">
            <div className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
                <span className="font-mono tracking-tight" aria-label={`${value} จาก 5`}>
                    {"▓".repeat(value)}<span className="text-muted-foreground/30">{"░".repeat(5 - value)}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{value}/5</span>
            </div>
            <p className="pl-[4.5rem] text-muted-foreground/80 leading-snug">{reason}</p>
        </div>
    );
}

function Flag({ label, value, reason }: { label: string; value: string | null; reason: string | null }) {
    if (!value) return null;
    const s = SCALE_LABEL[value];
    return (
        <div className="text-[11px] flex items-baseline gap-2">
            <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
            <span className={cn("shrink-0 font-medium", s?.cls)}>{s?.text ?? value}</span>
            {reason && reason !== "—" && <span className="text-muted-foreground/80 leading-snug">{reason}</span>}
        </div>
    );
}

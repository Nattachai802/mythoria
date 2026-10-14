"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpellCheck, Loader2, Square, Zap, Gauge, Pause } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useChoiceDialog } from "@/components/project/choice-dialog";

// แผงติดตามการตรวจคำผิด (คิวแก้ไข) + ปุ่ม "ตรวจคำผิดทั้งคิว"
//
// ข้อมูลทั้งหมดมาจาก /spell-queue/overview ของ Python: โหมด GPU/CPU, งานที่กำลังตรวจ (ก้อนที่ i/n),
// คิว, เวลาที่เหลือโดยประมาณ, สถิติวันนี้ — อยู่ในหน่วยความจำของ Python เริ่มนับใหม่ทุกวัน/เมื่อ restart
// ตรวจทั้งคิว = ส่งทุกตอนเข้าคิวกลางครั้งเดียว Python ตรวจทีละตอนเอง ปิดหน้า/logout ได้

interface QueueItem {
    id: string;
    title: string;
    checked: boolean; // เคยมีผลตรวจคำผิดแล้ว
}

interface Overview {
    mode: "gpu" | "cpu" | "unknown";
    gpuCooldownUntil: number | null; // null = ไม่ได้พัก GPU
    running: { noteId: string; chunk: number; chunks: number | null; mode: string | null; elapsed: number } | null;
    queued: { noteId: string; chunks: number }[];
    etaSeconds: number;
    secondsPerChunk: number;
    today: {
        done: number; errors: number; chunksGpu: number; chunksCpu: number;
        gpuSeconds: number; avgNoteSeconds: number;
        lastError: { at: number; message: string } | null;
    };
}

const POLL_ACTIVE_MS = 5000;
const POLL_IDLE_MS = 60000;
const GPU_DAILY_SECONDS = 300; // ZeroGPU บัญชีฟรี 5 นาที/วัน

const fmtMin = (s: number) => (s < 60 ? `${Math.max(1, Math.round(s))} วิ` : `${Math.round(s / 60)} นาที`);
const fmtClock = (ts: number) => new Date(ts * 1000).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export function SpellCheckQueueButton({ novelId, items }: { novelId: string; items: QueueItem[] }) {
    const router = useRouter();
    const [ask, choiceDialog] = useChoiceDialog();
    const [ov, setOv] = useState<Overview | null>(null);
    const wasMine = useRef(false);

    const titles = new Map(items.map((i) => [i.id, i.title]));
    const mineQueued = ov?.queued.filter((q) => titles.has(q.noteId)) ?? [];
    const mineRunning = ov?.running && titles.has(ov.running.noteId) ? ov.running : null;
    const mineActive = mineQueued.length + (mineRunning ? 1 : 0);
    const anyActive = !!ov && (ov.queued.length > 0 || !!ov.running);

    const poll = useCallback(async () => {
        try {
            const res = await fetch(`/api/py/spell-queue/overview`);
            if (res.ok) setOv(await res.json());
        } catch { /* ถามใหม่รอบหน้า */ }
    }, []);

    useEffect(() => {
        const first = setTimeout(poll, 0);
        const t = setInterval(poll, anyActive ? POLL_ACTIVE_MS : POLL_IDLE_MS);
        return () => { clearTimeout(first); clearInterval(t); };
    }, [anyActive, poll]);

    // ตอนของนิยายนี้ตรวจครบ -> โหลดหน้าใหม่ให้ป้ายจาก DB ตรง
    useEffect(() => {
        if (mineActive > 0) { wasMine.current = true; return; }
        if (wasMine.current) {
            wasMine.current = false;
            toast.success("ตรวจคำผิดในคิวเสร็จแล้ว");
            router.refresh();
        }
    }, [mineActive, router]);

    const run = async () => {
        const checked = items.filter((i) => i.checked).length;
        const fresh = items.length - checked;
        let targets = items;
        if (checked > 0) {
            const choice = await ask({
                title: `ตรวจคำผิดทั้งคิว (${items.length} ตอน)`,
                description: (
                    <>
                        <p>มี {checked} ตอนที่ตรวจไว้แล้ว · ยังไม่เคยตรวจ {fresh} ตอน</p>
                        <p>ตรวจใหม่ทุกตอน = ผลเดิมของตอนที่ตรวจแล้วจะถูกแทนที่</p>
                        <p>ระบบตรวจทีละตอนเบื้องหลัง ปิดหน้านี้ได้ งานยังเดินต่อ</p>
                    </>
                ),
                choices: [
                    ...(fresh > 0 ? [{ value: "fresh", label: `เฉพาะที่ยังไม่ตรวจ (${fresh})`, primary: true }] : []),
                    { value: "all", label: `ตรวจใหม่ทุกตอน (${items.length})`, primary: fresh === 0 },
                ],
            });
            if (!choice) return;
            if (choice === "fresh") targets = items.filter((i) => !i.checked);
        }
        const res = await fetch(`/api/novel/${novelId}/spell-check-queue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteIds: targets.map((t) => t.id) }),
        }).catch(() => null);
        const data = res?.ok ? await res.json() : null;
        if (!data?.success) {
            toast.error("ส่งเข้าคิวตรวจไม่สำเร็จ");
            return;
        }
        toast.success(`ส่ง ${data.queued} ตอนเข้าคิวตรวจแล้ว${data.skipped ? ` (ข้าม ${data.skipped} ตอนที่ไม่มีเนื้อหา)` : ""}`);
        for (const t of targets) window.dispatchEvent(new CustomEvent("spell-job-started", { detail: t.id }));
        poll();
    };

    const stop = async () => {
        const waiting = mineQueued.map((q) => q.noteId);
        await fetch(`/api/py/spell-queue/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteIds: waiting }),
        }).catch(() => null);
        toast.info(`ถอน ${waiting.length} ตอนออกจากคิว — ตอนที่กำลังตรวจอยู่จะตรวจต่อจนเสร็จ`);
        poll();
    };

    if (items.length === 0) return null;

    const cooling = !!ov?.gpuCooldownUntil; // Python ส่งมาเฉพาะตอนที่ยังพัก GPU อยู่
    const mode = ov?.running?.mode ?? ov?.mode ?? "unknown";
    const t = ov?.today;

    return (
        <div className="w-full space-y-2">
            {choiceDialog}
            <div className="flex flex-wrap items-center justify-between gap-2">
                {/* โหมดตอนนี้ */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    {!ov ? null : !anyActive ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Pause className="h-3.5 w-3.5" aria-hidden /> ระบบตรวจคำผิดว่าง
                        </span>
                    ) : mode === "gpu" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                            <Zap className="h-3.5 w-3.5" aria-hidden /> โหมดเร่งความเร็ว (GPU)
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-muted-foreground">
                            <Gauge className="h-3.5 w-3.5" aria-hidden /> โหมดปกติ (CPU)
                        </span>
                    )}
                    {cooling && (
                        <span className="text-muted-foreground">
                            โควต้า GPU วันนี้หมด · ลองเร่งความเร็วอีกครั้ง {fmtClock(ov!.gpuCooldownUntil!)}
                        </span>
                    )}
                </div>
                {mineActive === 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={run}
                        title="ส่งทุกตอนเข้าคิวตรวจคำผิด — ระบบตรวจทีละตอนเบื้องหลัง ปิดหน้าได้"
                    >
                        <SpellCheck className="h-3.5 w-3.5" aria-hidden /> ตรวจคำผิดทั้งคิว
                    </Button>
                )}
            </div>

            {ov && anyActive && (
                <div className="rounded-md border border-purple-500/30 bg-purple-500/5 px-3 py-2 text-xs space-y-1.5" role="status">
                    {ov.running && (
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500 shrink-0" aria-hidden />
                                <span className="font-medium truncate">
                                    กำลังตรวจ: {titles.get(ov.running.noteId) ?? "ตอนจากโปรเจกต์อื่น"}
                                </span>
                                <span className="text-muted-foreground shrink-0">
                                    {ov.running.chunks ? `ส่วนที่ ${Math.min(ov.running.chunk + 1, ov.running.chunks)}/${ov.running.chunks} · ` : ""}
                                    {fmtMin(ov.running.elapsed)}
                                </span>
                            </div>
                            {ov.running.chunks ? (
                                <div className="h-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full bg-purple-500 transition-all"
                                        style={{ width: `${(ov.running.chunk / ov.running.chunks) * 100}%` }}
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                        <span>
                            รอคิว {ov.queued.length} ตอน
                            {mineQueued.length !== ov.queued.length && ` (ของโปรเจกต์นี้ ${mineQueued.length})`}
                            {" · "}เหลือราว {fmtMin(ov.etaSeconds)} ({ov.secondsPerChunk} วิ/ส่วน)
                            {" · "}ปิดหน้านี้ได้
                        </span>
                        {mineQueued.length > 0 && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={stop}>
                                <Square className="h-3 w-3" aria-hidden /> หยุดที่เหลือ
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {t && (t.done > 0 || t.errors > 0) && (
                <p className="text-[11px] text-muted-foreground">
                    วันนี้ตรวจแล้ว {t.done} ตอน
                    {t.avgNoteSeconds > 0 && ` · เฉลี่ย ${fmtMin(t.avgNoteSeconds)}/ตอน`}
                    {" · "}GPU ใช้ไป {Math.round(t.gpuSeconds)}/{GPU_DAILY_SECONDS} วิ ({t.chunksGpu} ส่วน) · CPU {t.chunksCpu} ส่วน
                    {t.errors > 0 && (
                        <span className="text-amber-600 dark:text-amber-400" title={t.lastError?.message}>
                            {" · "}ล้ม {t.errors} ครั้ง
                        </span>
                    )}
                </p>
            )}
        </div>
    );
}

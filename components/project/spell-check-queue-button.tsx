"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpellCheck, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useChoiceDialog } from "@/components/project/choice-dialog";

// "ตรวจคำผิดทั้งคิว" + แผงความคืบหน้า
//
// ส่งทุกตอนเข้าคิวกลางของ Python ครั้งเดียว (/spell-check-queue) แล้ว Python ตรวจทีละตอนเอง —
// ปิดหน้า/logout/เปิดจากเครื่องอื่นได้ งานยังเดินต่อ แผงนี้แค่ถามสถานะมาแสดง
// (เปิดหน้ากลับมาก็เห็นความคืบหน้าเดิม เพราะสถานะอยู่ที่ Python ไม่ใช่ในเบราว์เซอร์)
// ข้อจำกัด: สถานะ/คิวอยู่ในหน่วยความจำของ Python — Render restart แล้วคิวที่เหลือหาย

interface QueueItem {
    id: string;
    title: string;
    checked: boolean; // เคยมีผลตรวจคำผิดแล้ว
}

type Job = { state: "queued" | "running" | "done" | "error" | "unknown"; position?: number };

const POLL_MS = 5000;
const SEC_PER_NOTE = 130; // วัดจริง 2026-10-14: ~100-160 วิ/บท บน HF CPU

export function SpellCheckQueueButton({ novelId, items }: { novelId: string; items: QueueItem[] }) {
    const router = useRouter();
    const [ask, choiceDialog] = useChoiceDialog();
    const [jobs, setJobs] = useState<Record<string, Job>>({});
    const [batch, setBatch] = useState<{ total: number } | null>(null);
    const wasActive = useRef(false);

    const ids = items.map((i) => i.id).join(",");
    const active = Object.values(jobs).filter((j) => j.state === "queued" || j.state === "running");
    const running = items.find((i) => jobs[i.id]?.state === "running");
    const queued = active.length - (running ? 1 : 0);

    const poll = useCallback(async () => {
        try {
            const res = await fetch(`/api/py/spell-queue/status?ids=${ids}`);
            if (!res.ok) return;
            const next: Record<string, Job> = (await res.json()).jobs ?? {};
            setJobs(next);
            // คิวว่างแล้ว ล้างยอดรวมของรอบที่สั่ง (รอบหน้าอาจมาจากหน้าอื่น ไม่มียอดรวม)
            if (!Object.values(next).some((j) => j.state === "queued" || j.state === "running")) setBatch(null);
        } catch { /* ถามใหม่รอบหน้า */ }
    }, [ids]);

    // เปิดหน้า: ถามครั้งเดียว (อาจมีงานค้างจากรอบก่อน) · มีงานค้าง: ถามทุก 5 วิ
    useEffect(() => {
        const t = setTimeout(poll, 0);
        return () => clearTimeout(t);
    }, [poll]);
    useEffect(() => {
        if (active.length === 0) return;
        const t = setInterval(poll, POLL_MS);
        return () => clearInterval(t);
    }, [active.length, poll]);

    // ตรวจครบคิว -> โหลดหน้าใหม่ให้ตัวเลขจาก DB ตรง
    useEffect(() => {
        if (active.length > 0) { wasActive.current = true; return; }
        if (wasActive.current) {
            wasActive.current = false;
            toast.success("ตรวจคำผิดทั้งคิวเสร็จแล้ว");
            router.refresh();
        }
    }, [active.length, router]);

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
        setBatch({ total: data.queued });
        toast.success(`ส่ง ${data.queued} ตอนเข้าคิวตรวจแล้ว${data.skipped ? ` (ข้าม ${data.skipped} ตอนที่ไม่มีเนื้อหา)` : ""}`);
        for (const t of targets) window.dispatchEvent(new CustomEvent("spell-job-started", { detail: t.id }));
        poll();
    };

    const stop = async () => {
        const waiting = items.filter((i) => jobs[i.id]?.state === "queued").map((i) => i.id);
        await fetch(`/api/py/spell-queue/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ noteIds: waiting }),
        }).catch(() => null);
        toast.info(`ถอน ${waiting.length} ตอนออกจากคิว — ตอนที่กำลังตรวจอยู่จะตรวจต่อจนเสร็จ`);
        poll();
    };

    if (items.length === 0) return null;

    if (active.length > 0) {
        const total = batch?.total ?? active.length;
        const done = Math.max(0, total - active.length);
        const etaMin = Math.ceil((active.length * SEC_PER_NOTE) / 60);
        return (
            <div className="flex items-center gap-3 rounded-md border border-purple-500/30 bg-purple-500/5 px-3 py-1.5 text-xs" role="status">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500 shrink-0" aria-hidden />
                <div className="min-w-0">
                    <div className="font-medium">
                        ตรวจคำผิด {batch ? `${done}/${total} ตอน` : `ค้าง ${active.length} ตอน`} · อีกราว {etaMin} นาที
                    </div>
                    <div className="text-muted-foreground truncate max-w-[22rem]">
                        {running ? `กำลังตรวจ: ${running.title}` : "รอคิว…"}
                        {queued > 0 && ` · รอคิว ${queued} ตอน`} · ปิดหน้านี้ได้
                    </div>
                </div>
                {queued > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={stop}>
                        <Square className="h-3 w-3" aria-hidden /> หยุดที่เหลือ
                    </Button>
                )}
            </div>
        );
    }

    return (
        <>
            {choiceDialog}
            <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={run}
                title="ส่งทุกตอนเข้าคิวตรวจคำผิด — ระบบตรวจทีละตอนเบื้องหลัง ปิดหน้าได้"
            >
                <SpellCheck className="h-3.5 w-3.5" aria-hidden /> ตรวจคำผิดทั้งคิว
            </Button>
        </>
    );
}

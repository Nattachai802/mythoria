"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, RotateCw } from "lucide-react";
import { toast } from "sonner";

// สถานะตรวจคำผิดของโน้ตในคิวแก้ไข
//   proofreading = สั่งตรวจอัตโนมัติแล้ว → ถามสถานะงานจาก Python ทุก 5 วิ จนเสร็จ/ล้ม
//   user_verify  = worker ตรวจเสร็จและบันทึกผลแล้ว → แสดงจำนวนจุดที่ยังไม่แก้ (จาก DB)
// สถานะงานอยู่ในหน่วยความจำของ Python: Render restart แล้วได้ "unknown" → ให้กดตรวจใหม่

type JobState = "running" | "done" | "error" | "unknown";
const POLL_MS = 5000;

interface Props {
    novelId: string;
    noteId: string;
    status: string;
    unresolvedCount: number;
}

export function SpellStatusBadge({ novelId, noteId, status, unresolvedCount }: Props) {
    const router = useRouter();
    const [job, setJob] = useState<{ state: JobState; count?: number } | null>(
        status === "proofreading" ? { state: "running" } : null,
    );
    const refreshed = useRef(false);

    useEffect(() => {
        if (job?.state !== "running") return;
        let alive = true;
        const tick = async () => {
            try {
                const res = await fetch(`/api/py/spell-check-note/status/${noteId}`);
                if (!res.ok || !alive) return; // สะดุดชั่วคราว (เช่น service กำลังตื่น) ถามใหม่รอบหน้า
                const j = await res.json();
                if (j.state === "running") return;
                setJob({ state: j.state, count: j.count });
                // worker เปลี่ยนสถานะโน้ตใน DB แล้ว — โหลดหน้าใหม่ครั้งเดียวให้แถวเป็น "รอตรวจสอบ"
                // (getNotes cache 30 วิ อาจยังเห็นสถานะเก่า แต่ badge แสดงผลจาก state นี้ไปก่อนแล้ว)
                if (j.state === "done" && !refreshed.current) {
                    refreshed.current = true;
                    router.refresh();
                }
            } catch { /* ถามใหม่รอบหน้า */ }
        };
        const timer = setInterval(tick, POLL_MS);
        tick();
        return () => { alive = false; clearInterval(timer); };
    }, [job?.state, noteId, router]);

    const retry = async () => {
        const res = await fetch(`/api/novel/${novelId}/note/${noteId}/spell-check-trigger`, { method: "POST" })
            .catch(() => null);
        if (!res?.ok) {
            toast.error("เริ่มตรวจคำผิดไม่สำเร็จ");
            return;
        }
        refreshed.current = false;
        setJob({ state: "running" });
    };

    const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

    if (status === "user_verify" || job?.state === "done") {
        const n = status === "user_verify" ? unresolvedCount : job?.count ?? 0;
        return (
            <span className={`${pill} border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400`}>
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                {n > 0 ? `ตรวจเสร็จ · ${n} จุดรอดู` : "ตรวจเสร็จ · ไม่พบคำผิด"}
            </span>
        );
    }
    if (job?.state === "running") {
        return (
            <span className={`${pill} border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400`} role="status">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                กำลังตรวจคำผิด…
            </span>
        );
    }
    if (job?.state === "error" || job?.state === "unknown") {
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className={`${pill} border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400`}>
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                    {job.state === "error" ? "ตรวจไม่สำเร็จ" : "งานตรวจหาย (ระบบรีสตาร์ต)"}
                </span>
                <button
                    type="button"
                    onClick={retry}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                    <RotateCw className="h-3 w-3" aria-hidden /> ตรวจใหม่
                </button>
            </span>
        );
    }
    return null;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertTriangle, RotateCw, SpellCheck } from "lucide-react";
import { toast } from "sonner";
import { triggerSpellCheck } from "@/lib/spell-trigger";

// สถานะตรวจคำผิดของโน้ตในคิวแก้ไข
//   proofreading  = สั่งตรวจอัตโนมัติแล้ว → ถามสถานะงานจาก Python ทุก 5 วิ จนเสร็จ/ล้ม
//   user_verify   = worker ตรวจเสร็จและเปลี่ยนสถานะแล้ว → จำนวนจุดที่ยังไม่แก้ (จาก DB)
//   needs_rewrite = ตรวจตอนตั้งสถานะ แต่สถานะไม่เปลี่ยน → ถามครั้งเดียวว่ากำลังตรวจอยู่ไหม ไม่งั้นโชว์จุดค้างจาก DB
// สถานะงานอยู่ในหน่วยความจำของ Python: Render restart แล้วได้ "unknown"
// ปุ่ม "ตรวจทั้งคิว" สั่งงานแล้วส่ง event "spell-job-started" มา — badge ของตอนนั้นจะเริ่มหมุนเอง

type JobState = "queued" | "running" | "done" | "error" | "unknown";
const POLL_MS = 5000;

interface Props {
    novelId: string;
    noteId: string;
    status: string;
    unresolvedCount: number;
    /** เคยมีผลตรวจคำผิดแล้ว — แยก "ยังไม่ตรวจ" ออกจาก "ตรวจแล้วไม่พบ" (ไม่ส่ง = ไม่รู้ ไม่แสดงป้ายยังไม่ตรวจ) */
    checked?: boolean;
}

export function SpellStatusBadge({ novelId, noteId, status, unresolvedCount, checked }: Props) {
    const router = useRouter();
    const [job, setJob] = useState<{ state: JobState; count?: number; position?: number } | null>(
        status === "proofreading" ? { state: "running" } : null,
    );
    const refreshed = useRef(false);

    // รอ Rewrite: ไม่รู้ว่ามีงานค้างไหม — ถามครั้งเดียว ถ้ากำลังตรวจอยู่ค่อยเข้าโหมดถามซ้ำ
    useEffect(() => {
        if (status !== "needs_rewrite") return;
        fetch(`/api/py/spell-check-note/status/${noteId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => { if (j?.state === "running" || j?.state === "queued") setJob(j); })
            .catch(() => {});
    }, [status, noteId]);

    useEffect(() => {
        const onStart = (e: Event) => {
            if ((e as CustomEvent<string>).detail === noteId) {
                refreshed.current = false;
                setJob({ state: "running" });
            }
        };
        window.addEventListener("spell-job-started", onStart);
        return () => window.removeEventListener("spell-job-started", onStart);
    }, [noteId]);

    useEffect(() => {
        const waiting = job?.state === "running" || job?.state === "queued";
        if (!waiting) return;
        let alive = true;
        const tick = async () => {
            try {
                const res = await fetch(`/api/py/spell-check-note/status/${noteId}`);
                if (!res.ok || !alive) return; // สะดุดชั่วคราว (เช่น service กำลังตื่น) ถามใหม่รอบหน้า
                const j = await res.json();
                if (j.state === "running" || j.state === "queued") {
                    setJob((prev) => (prev?.state === j.state && prev?.position === j.position ? prev : j));
                    return;
                }
                setJob({ state: j.state, count: j.count });
                // worker เขียนผล/สถานะลง DB แล้ว — โหลดหน้าใหม่ครั้งเดียวให้ตัวเลขจาก DB ตรง
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
    }, [job?.state === "running" || job?.state === "queued", noteId, router]); // eslint-disable-line react-hooks/exhaustive-deps

    const retry = async () => {
        if (!(await triggerSpellCheck(novelId, noteId, status))) toast.error("เริ่มตรวจคำผิดไม่สำเร็จ");
    };

    const pill = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium";

    if (job?.state === "queued") {
        return (
            <span className={`${pill} border-purple-500/20 bg-purple-500/5 text-purple-600/80 dark:text-purple-400/80`} role="status">
                <Loader2 className="h-3 w-3" aria-hidden />
                รอคิวตรวจ{job.position ? ` #${job.position}` : ""}
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
    if (job?.state === "error" || (job?.state === "unknown" && status === "proofreading")) {
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
    const n = job?.state === "done" ? job.count ?? 0 : unresolvedCount;
    if (status === "needs_rewrite") {
        if (n === 0 && job?.state !== "done") {
            if (checked === false) {
                return <span className={`${pill} text-muted-foreground`}>ยังไม่ตรวจคำผิด</span>;
            }
            if (!checked) return null; // ไม่รู้ว่าเคยตรวจไหม — ไม่แสดงอะไร
        }
        return (
            <span className={`${pill} border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400`}>
                <SpellCheck className="h-3 w-3" aria-hidden />
                {n > 0 ? `${n} จุดคำผิดค้าง` : "ตรวจแล้ว · ไม่พบคำผิด"}
            </span>
        );
    }
    if (status === "user_verify" || job?.state === "done") {
        return (
            <span className={`${pill} border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400`}>
                <CheckCircle2 className="h-3 w-3" aria-hidden />
                {n > 0 ? `ตรวจเสร็จ · ${n} จุดรอดู` : "ตรวจเสร็จ · ไม่พบคำผิด"}
            </span>
        );
    }
    return null;
}

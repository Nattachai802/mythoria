"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SpellCheck, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { triggerSpellCheck } from "@/lib/spell-trigger";

// ตรวจคำผิดทุกตอนในคิวแก้ไข — ทีละตอน (Render free มีโปรเซสเดียว + Longdo มีโควต้า ยิงพร้อมกันไม่ได้)
// ลูปอยู่ในหน้าจอนี้: ออกจากหน้าแล้วตอนที่เหลือไม่ถูกตรวจ (ตอนที่สั่งไปแล้วตรวจต่อจนเสร็จ)
// ponytail: คิวฝั่งหน้าจอ ถ้าต้องตรวจทั้งคิวโดยไม่เฝ้าหน้า ค่อยย้ายคิวไปเก็บใน DB ฝั่ง worker

interface QueueItem {
    id: string;
    title: string;
    status: string;
    checked: boolean; // เคยมีผลตรวจคำผิดแล้ว
}

const POLL_MS = 4000;
const PER_NOTE_LIMIT_MS = 15 * 60 * 1000;

async function waitForJob(noteId: string, cancelled: () => boolean): Promise<string> {
    const deadline = Date.now() + PER_NOTE_LIMIT_MS;
    while (Date.now() < deadline && !cancelled()) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        try {
            const res = await fetch(`/api/py/spell-check-note/status/${noteId}`);
            if (!res.ok) continue;
            const j = await res.json();
            if (j.state !== "running") return j.state;
        } catch { /* ถามใหม่รอบหน้า */ }
    }
    return cancelled() ? "cancelled" : "timeout";
}

export function SpellCheckQueueButton({ novelId, items }: { novelId: string; items: QueueItem[] }) {
    const router = useRouter();
    const [running, setRunning] = useState(false);
    const cancelRef = useRef(false);

    const run = async () => {
        const checked = items.filter((i) => i.checked).length;
        let targets = items;
        if (checked > 0) {
            const redo = window.confirm(
                `มี ${checked} ตอนในคิวที่ตรวจคำผิดไว้แล้ว\n\n` +
                "ตกลง = ตรวจใหม่ทุกตอน (ผลเดิมของตอนที่ตรวจแล้วจะถูกแทนที่)\n" +
                "ยกเลิก = ตรวจเฉพาะตอนที่ยังไม่เคยตรวจ",
            );
            if (!redo) targets = items.filter((i) => !i.checked);
        }
        if (targets.length === 0) {
            toast.info("ทุกตอนในคิวตรวจไว้แล้ว");
            return;
        }

        cancelRef.current = false;
        setRunning(true);
        const tid = toast.loading(`ตรวจทั้งคิว 0/${targets.length}…`);
        let ok = 0, failed = 0;
        for (const [i, item] of targets.entries()) {
            if (cancelRef.current) break;
            toast.loading(`ตรวจทั้งคิว ${i + 1}/${targets.length} — ${item.title}`, { id: tid });
            if (!(await triggerSpellCheck(novelId, item.id, item.status))) { failed++; continue; }
            const state = await waitForJob(item.id, () => cancelRef.current);
            if (state === "done") ok++;
            else if (state !== "cancelled") failed++;
        }
        setRunning(false);
        const stopped = cancelRef.current ? " (หยุดกลางทาง)" : "";
        toast[failed ? "warning" : "success"](
            `ตรวจทั้งคิวเสร็จ${stopped} — สำเร็จ ${ok} ตอน${failed ? ` · ไม่สำเร็จ ${failed} ตอน` : ""}`,
            { id: tid },
        );
        router.refresh();
    };

    if (items.length === 0) return null;
    return running ? (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => { cancelRef.current = true; }}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            <Square className="h-3 w-3" aria-hidden /> หยุดตรวจทั้งคิว
        </Button>
    ) : (
        <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={run}
            title="ตรวจคำผิดทีละตอนจนครบคิว — เปิดหน้านี้ค้างไว้จนเสร็จ"
        >
            <SpellCheck className="h-3.5 w-3.5" aria-hidden /> ตรวจคำผิดทั้งคิว
        </Button>
    );
}

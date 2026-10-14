"use client";

import { useCallback, useRef, useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ถามผู้ใช้แบบ await ได้ แทน window.confirm (หน้าต่างของเบราว์เซอร์ไม่เข้าธีม และมีได้แค่ ตกลง/ยกเลิก)
//   const [ask, dialog] = useChoiceDialog();
//   const v = await ask({ title, description, choices: [{ value: "a", label: "..." }] });  // null = ปิด/ยกเลิก
//   ...render {dialog} ไว้ใน component

export interface Choice {
    value: string;
    label: string;
    primary?: boolean;
}

interface Ask {
    title: string;
    description: React.ReactNode;
    choices: Choice[];
    cancelLabel?: string;
}

export function useChoiceDialog(): [(q: Ask) => Promise<string | null>, React.ReactNode] {
    const [q, setQ] = useState<Ask | null>(null);
    const resolver = useRef<((v: string | null) => void) | null>(null);

    const ask = useCallback((next: Ask) => new Promise<string | null>((resolve) => {
        resolver.current = resolve;
        setQ(next);
    }), []);

    const finish = (v: string | null) => {
        resolver.current?.(v);
        resolver.current = null;
        setQ(null);
    };

    const dialog = (
        <AlertDialog open={!!q} onOpenChange={(open) => { if (!open) finish(null); }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{q?.title}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm text-muted-foreground">{q?.description}</div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => finish(null)}>{q?.cancelLabel ?? "ยกเลิก"}</AlertDialogCancel>
                    {q?.choices.map((c) => (
                        <AlertDialogAction
                            key={c.value}
                            onClick={() => finish(c.value)}
                            className={c.primary ? undefined : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}
                        >
                            {c.label}
                        </AlertDialogAction>
                    ))}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );

    return [ask, dialog];
}

/** คำถามก่อนตรวจคำผิดซ้ำ — ใช้คู่กับ maybeTriggerSpellCheck */
export function askSpellRecheck(ask: (q: Ask) => Promise<string | null>) {
    return async (existing: number) => (await ask({
        title: "ตอนนี้ตรวจคำผิดไว้แล้ว",
        description: (
            <>
                <p>มีผลตรวจเดิม {existing} รายการ</p>
                <p>ตรวจใหม่จะแทนที่ผลเดิมทั้งหมดของตอนนี้ รวมรายการที่แก้แล้ว</p>
            </>
        ),
        cancelLabel: "ไม่ต้องตรวจ",
        choices: [{ value: "redo", label: "ตรวจใหม่", primary: true }],
    })) === "redo";
}

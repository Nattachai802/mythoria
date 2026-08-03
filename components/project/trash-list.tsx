"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookText, FileText, Notebook, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { restoreFromTrash, purgeFromTrash } from "@/server/trash";
import type { TrashEntry } from "@/lib/trash";

const KIND_LABEL: Record<TrashEntry["kind"], string> = {
    novel: "นิยาย",
    chapter: "บท",
    note: "โน้ต",
};

const KIND_ICON = {
    novel: BookText,
    chapter: FileText,
    note: Notebook,
};

export function TrashList({ items }: { items: TrashEntry[] }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [confirming, setConfirming] = useState<TrashEntry | null>(null);

    const run = (fn: () => Promise<{ success: boolean; message?: string }>) => {
        startTransition(async () => {
            const res = await fn();
            if (res.success) {
                toast.success(res.message);
                router.refresh();
            } else {
                toast.error(res.message ?? "ทำรายการไม่สำเร็จ");
            }
        });
    };

    if (items.length === 0) {
        return (
            <p className="text-sm text-muted-foreground border border-dashed rounded-lg p-8 text-center">
                ถังขยะว่าง
            </p>
        );
    }

    return (
        <>
            <ul className="divide-y rounded-lg border">
                {items.map((item) => {
                    const Icon = KIND_ICON[item.kind];
                    return (
                        <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 p-3">
                            <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    {KIND_LABEL[item.kind]} · เหลืออีก {item.daysLeft} วัน
                                </p>
                            </div>
                            <Button
                                size="sm" variant="ghost" disabled={pending}
                                onClick={() => run(() => restoreFromTrash(item.kind, item.id))}
                            >
                                <RotateCcw className="w-3.5 h-3.5" /> กู้คืน
                            </Button>
                            <Button
                                size="sm" variant="ghost" disabled={pending}
                                className="text-destructive hover:text-destructive"
                                onClick={() => setConfirming(item)}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </li>
                    );
                })}
            </ul>

            <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>ลบถาวร?</AlertDialogTitle>
                        <AlertDialogDescription>
                            &ldquo;{confirming?.title}&rdquo; จะหายไปเลย กู้คืนไม่ได้อีก
                            {confirming?.kind === "novel" && " — บทและโน้ตทั้งหมดในนิยายเรื่องนี้จะหายไปด้วย"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (confirming) run(() => purgeFromTrash(confirming.kind, confirming.id));
                                setConfirming(null);
                            }}
                        >
                            ลบถาวร
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

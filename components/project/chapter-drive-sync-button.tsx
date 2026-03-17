"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CloudUpload, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface ChapterDriveSyncButtonProps {
    novelId: string;
    chapterId: string;
    notes: any[];
}

export function ChapterDriveSyncButton({ novelId, chapterId, notes }: ChapterDriveSyncButtonProps) {
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncAll = async () => {
        if (!notes || notes.length === 0) {
            toast.info("ไม่มีตอนย่อยให้ Sync ในบทนี้");
            return;
        }

        setIsSyncing(true);
        const toastId = toast.loading(`กำลังเริ่มต้น Sync ${notes.length} ตอน...`);

        try {
            // 1. Connect to Drive once per batch
            const connectRes = await fetch("/api/drive/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ novelId }),
            });

            if (!connectRes.ok) {
                const errorData = await connectRes.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to connect to Google Drive");
            }

            // 2. Loop through all notes and sync sequentially
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < notes.length; i++) {
                const note = notes[i];
                toast.loading(`กำลัง Sync ตอน "${note.title}" (${i + 1}/${notes.length})`, { id: toastId });

                try {
                    const syncRes = await fetch("/api/drive/sync", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ noteId: note.id }),
                    });

                    if (!syncRes.ok) throw new Error();
                    successCount++;
                } catch {
                    failCount++;
                }
            }

            if (failCount === 0) {
                toast.success(`Sync สำเร็จครบทั้ง ${successCount} ตอน!`, { id: toastId });
            } else {
                toast.warning(`Sync สำเร็จ ${successCount} ตอน, ไม่สำเร็จ ${failCount} ตอน`, { id: toastId });
            }

        } catch (error: any) {
            console.error(error);
            if (error.message.includes("connected")) {
                toast.error("คุณจะต้องเชื่อมต่อ Google Drive ในหน้ารายละเอียดของนิยายก่อน", {
                    id: toastId,
                    duration: 5000,
                    action: {
                        label: "ไปที่ตั้งค่า",
                        onClick: () => window.open(`/dashboard/settings`, '_blank')
                    }
                });
            } else {
                toast.error(error.message || "เกิดข้อผิดพลาดในการ Sync", { id: toastId });
            }
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleSyncAll();
                    }}
                    disabled={isSyncing || notes.length === 0}
                >
                    {isSyncing ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <CloudUpload className="h-3.5 w-3.5" />
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                {isSyncing ? "กำลัง Sync ทั้งบท..." : "Sync ทุกตอนในบทนี้ไปยัง Docs"}
            </TooltipContent>
        </Tooltip>
    );
}

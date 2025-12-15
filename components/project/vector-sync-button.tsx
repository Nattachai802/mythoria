"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface VectorSyncButtonProps {
    novelId: string;
}

export function VectorSyncButton({ novelId }: VectorSyncButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

    const handleSync = async () => {
        setIsLoading(true);
        setStatus("idle");

        try {
            toast.info("กำลังซิงค์ข้อมูล...", {
                description: "สร้าง embeddings สำหรับเนื้อหาทั้งหมด",
            });

            // Call Python FastAPI service
            const response = await fetch(`http://localhost:8000/sync/${novelId}`, {
                method: "POST",
            });

            const result = await response.json();

            if (result.success) {
                setStatus("success");
                toast.success("ซิงค์ข้อมูลสำเร็จ!", {
                    description: `ซิงค์แล้ว ${result.synced} รายการ`,
                });
            } else {
                setStatus("error");
                toast.error("ซิงค์ข้อมูลล้มเหลว", {
                    description: result.errors?.[0] || "เกิดข้อผิดพลาด",
                });
            }
        } catch (error) {
            setStatus("error");
            toast.error("ซิงค์ข้อมูลล้มเหลว", {
                description: "Python service ไม่ได้รัน (port 8000)",
            });
        } finally {
            setIsLoading(false);

            // Reset status after 3 seconds
            setTimeout(() => setStatus("idle"), 3000);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isLoading}
            className="gap-2 w-full justify-center bg-white/50 dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        >
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : status === "error" ? (
                <XCircle className="h-4 w-4 text-red-500" />
            ) : (
                <Database className="h-4 w-4" />
            )}
            {isLoading ? "กำลังซิงค์..." : "ซิงค์ข้อมูล"}
        </Button>
    );
}


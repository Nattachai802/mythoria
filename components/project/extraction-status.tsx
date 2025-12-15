"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getQueueStatus, reprocessNoteStates } from "@/server/character-state-extractor";

interface ExtractionStatusProps {
    noteId: string;
    onComplete?: () => void;
}

type StatusType = "pending" | "processing" | "completed" | "failed" | "none";

export function ExtractionStatus({ noteId, onComplete }: ExtractionStatusProps) {
    const [status, setStatus] = useState<StatusType>("none");
    const [error, setError] = useState<string | null>(null);
    const [isReprocessing, setIsReprocessing] = useState(false);

    const fetchStatus = async () => {
        const result = await getQueueStatus(noteId);
        setStatus(result.status);
        setError(result.error || null);

        if (result.status === "completed" && onComplete) {
            onComplete();
        }
    };

    useEffect(() => {
        fetchStatus();

        // Poll while pending or processing
        const interval = setInterval(() => {
            if (status === "pending" || status === "processing") {
                fetchStatus();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [noteId, status]);

    const handleReprocess = async () => {
        setIsReprocessing(true);
        try {
            const result = await reprocessNoteStates(noteId);
            if (result.success) {
                setStatus("pending");
                setError(null);
            } else {
                setError(result.error || "Failed to reprocess");
            }
        } finally {
            setIsReprocessing(false);
        }
    };

    if (status === "none") {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            {status === "pending" && (
                <Badge variant="secondary" className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    <span>รอคิว...</span>
                </Badge>
            )}

            {status === "processing" && (
                <Badge variant="secondary" className="flex items-center gap-1.5 bg-blue-500/10 text-blue-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>กำลังวิเคราะห์...</span>
                </Badge>
            )}

            {status === "completed" && (
                <Badge variant="secondary" className="flex items-center gap-1.5 bg-green-500/10 text-green-500">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>วิเคราะห์เสร็จสิ้น</span>
                </Badge>
            )}

            {status === "failed" && (
                <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="flex items-center gap-1.5">
                        <XCircle className="h-3 w-3" />
                        <span>เกิดข้อผิดพลาด</span>
                    </Badge>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReprocess}
                        disabled={isReprocessing}
                        className="h-6 px-2"
                    >
                        {isReprocessing ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3 w-3" />
                        )}
                        <span className="ml-1">ลองใหม่</span>
                    </Button>
                </div>
            )}
        </div>
    );
}

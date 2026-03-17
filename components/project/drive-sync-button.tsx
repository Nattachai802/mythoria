"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CloudUpload, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { SyncConflictDialog } from "./sync-conflict-dialog";

interface DriveSyncButtonProps {
  noteId: string;
  novelId: string;
  isInitialConnected?: boolean;
}

export function DriveSyncButton({ noteId, novelId, isInitialConnected = false }: DriveSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConnected, setIsConnected] = useState(isInitialConnected);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  // Conflict state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState({ local: "", remote: "" });

  const executeSync = async (forceContent?: string) => {
    setIsSyncing(true);
    setSyncStatus("idle");
    try {
      if (!isConnected) {
        const connectRes = await fetch("/api/drive/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ novelId }),
        });

        if (!connectRes.ok) {
           const errorData = await connectRes.json().catch(() => ({}));
           throw new Error(errorData.error || "Failed to connect to Google Drive");
        }
        setIsConnected(true);
      }

      const syncRes = await fetch("/api/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, forceContent }),
      });

      const responseData = await syncRes.json();

      if (!syncRes.ok) {
         throw new Error(responseData.error || "Failed to sync note");
      }

      setSyncStatus("success");
      
      // Update from Phase 1 Sync Coordinator Responses
      if (responseData.conflict) {
         setSyncStatus("error");
         setConflictData({ local: responseData.localContent, remote: responseData.remoteContent });
         setShowConflictDialog(true);
         toast.warning("พบข้อมูลขัดแย้ง! กรุณาเลือกเวอร์ชันเพื่อบันทึก");
      } else if (responseData.pulled) {
         toast.success("ดึงข้อมูลล่าสุดจาก Google Docs ลงมายังเว็บสำเร็จแล้ว! (รีเฟรชหน้าเพื่อดูเนื้อหา)");
      } else if (responseData.merged) {
         toast.success("รวมเนื้อหาทั้ง 2 ฝั่งสำเร็จ (Auto-Merged 3-way Sync) !");
      } else {
         toast.success("ส่งข้อมูลนิยายตอนนี้ขึ้น Google Docs สำเร็จแล้ว!");
      }
      
    } catch (error: any) {
      console.error(error);
      setSyncStatus("error");
      
      if (error.message.includes("connected")) {
          toast.error("คุณจะต้องเชื่อมต่อ Google Drive ในหน้ารายละเอียดของนิยายก่อนครับ", {
            duration: 5000,
            action: {
              label: "ไปที่ตั้งค่า",
              onClick: () => window.open(`/dashboard/settings`, '_blank')
            }
          });
      } else {
          toast.error(error.message || "เกิดข้อผิดพลาดในการ Sync");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleResolveConflict = async (resolvedContent: string) => {
    setShowConflictDialog(false);
    toast.loading("กำลังบันทึกเนื้อหาที่เลือกทับลงทั้งคู่...");
    await executeSync(resolvedContent);
  };

  return (
    <>
    <Button
      variant="ghost"
      className="w-full justify-start h-8 px-2 text-xs font-normal"
      onClick={() => executeSync()}
      disabled={isSyncing}
    >
      {isSyncing ? (
        <RefreshCw className="h-4 w-4 mr-2 animate-spin text-muted-foreground" />
      ) : syncStatus === "success" ? (
        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
      ) : syncStatus === "error" ? (
        <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
      ) : (
        <CloudUpload className="h-4 w-4 mr-2" />
      )}
      
      {isSyncing ? "กำลัง Sync..." : "Sync ไปยัง Docs"}
    </Button>
    <SyncConflictDialog 
       isOpen={showConflictDialog}
       onOpenChange={setShowConflictDialog}
       localContent={conflictData.local}
       remoteContent={conflictData.remote}
       onResolve={handleResolveConflict}
    />
    </>
  );
}

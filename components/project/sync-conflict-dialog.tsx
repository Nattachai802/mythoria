"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface SyncConflictDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  localContent: string;
  remoteContent: string;
  onResolve: (resolvedContent: string) => void;
}

export function SyncConflictDialog({ isOpen, onOpenChange, localContent, remoteContent, onResolve }: SyncConflictDialogProps) {
  const [choice, setChoice] = useState<"local" | "remote">("local");

  const handleConfirm = () => {
    const finalContent = choice === "local" ? localContent : remoteContent;
    onResolve(finalContent);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>พบข้อความขัดแย้งกัน (Merge Conflict)</DialogTitle>
          <DialogDescription>
            ระบบตรวจพบว่ามีการแก้บรรทัดเดียวกันหรือละแวกเดียวกันทั้งบนเว็บและบน Google Docs ทำให้สมองกลไม่สามารถรวมไฟล์ให้อัตโนมัติได้
            เพื่อป้องกันข้อมูลสูญหาย กรุณาเลือกว่าคุณต้องการยึดเนื้อหาเวอร์ชันใดในการบันทึก?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 my-4 h-[50vh] overflow-hidden">
          {/* Local */}
          <div 
             className={`border rounded-md flex flex-col cursor-pointer transition-all ${choice === "local" ? "ring-2 ring-blue-500 bg-blue-50/50" : "opacity-70 hover:opacity-100"}`}
             onClick={() => setChoice("local")}
          >
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-semibold text-blue-600">เวอร์ชันบนเว็บ (Mythoria)</h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm opacity-80" dangerouslySetInnerHTML={{ __html: localContent || "<em>(ไม่มีเนื้อหา)</em>" }} />
          </div>

          {/* Remote */}
          <div 
             className={`border rounded-md flex flex-col cursor-pointer transition-all ${choice === "remote" ? "ring-2 ring-emerald-500 bg-emerald-50/50" : "opacity-70 hover:opacity-100"}`}
             onClick={() => setChoice("remote")}
          >
            <div className="p-3 border-b bg-muted/50">
              <h3 className="font-semibold text-emerald-600">เวอร์ชันล่าสุด (Google Docs)</h3>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm opacity-80" dangerouslySetInnerHTML={{ __html: remoteContent || "<em>(ไม่มีเนื้อหา)</em>" }} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิกการ Sync</Button>
          <Button onClick={handleConfirm} className="bg-blue-600 hover:bg-blue-700 text-white">ยืนยันและทับข้อมูลเลย</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

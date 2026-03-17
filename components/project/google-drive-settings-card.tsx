"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { checkGoogleConnected } from "@/server/drive-sync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

export function GoogleDriveSettingsCard() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; googleEmail?: string } | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    // ตรวจสอบ drive_status จาก callback redirect
    const driveStatus = searchParams.get("drive_status");
    if (driveStatus === "connected") {
      toast.success("เชื่อมต่อ Google Drive สำเร็จ!");
    } else if (driveStatus === "cancelled") {
      toast.info("ยกเลิกการเชื่อมต่อ Google Drive");
    } else if (driveStatus === "error") {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ Google Drive");
    }

    // ดึงสถานะการเชื่อมต่อ
    checkGoogleConnected()
      .then((result) => setStatus(result))
      .catch(() => setStatus({ connected: false }));
  }, [searchParams]);

  const handleConnect = () => {
    setIsLoading(true);
    // Redirect ไปยัง OAuth flow ของเราเอง — รองรับ email ต่างกันได้
    window.location.href = "/api/google-drive/auth";
  };

  const handleReconnect = () => {
    setIsLoading(true);
    // บังคับขอ consent ใหม่ (prompt=consent อยู่ใน route แล้ว)
    window.location.href = "/api/google-drive/auth";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          การเชื่อมต่อ Google Drive
        </CardTitle>
        <CardDescription>
          อนุญาตให้ระบบสำรองข้อมูลหรือสร้างไฟล์ Google Docs ลงใน Google Drive ของคุณ
          สามารถใช้ Google account ต่าง email กับที่ login ได้
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted px-4 py-3 rounded-md text-sm text-foreground/80">
          <p>
            คุณสามารถเชื่อมต่อ Google Drive ด้วย Google account ใดก็ได้
            ไม่จำเป็นต้องเป็น email เดียวกับที่ใช้ login ครับ
          </p>
        </div>

        {status === null ? (
          <Button disabled className="opacity-50 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            กำลังตรวจสอบสถานะ...
          </Button>
        ) : status.connected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 rounded-md font-medium text-sm border border-emerald-200 dark:border-emerald-800/30">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>
                <p>เชื่อมต่อ Google Drive สำเร็จ</p>
                {status.googleEmail && (
                  <p className="text-xs font-normal text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">
                    {status.googleEmail}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReconnect}
              disabled={isLoading}
              className="gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              เปลี่ยน Google Account
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Cloud className="w-4 h-4" />
            {isLoading ? "กำลังเปิดหน้าต่าง..." : "เชื่อมต่อ Google Drive"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

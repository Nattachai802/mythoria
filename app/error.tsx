"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
        Sentry.captureException(error);
    }, [error]);

    return (
        <div className="min-h-screen relative grid place-items-center bg-background p-6 overflow-hidden grid-pattern-subtle">
            {/* แสงแดงจาง ๆ ลอยหลังการ์ด ให้ความรู้สึก "สัญญาณเตือน" ไม่ใช่แค่ error เฉย ๆ */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
                style={{ background: "radial-gradient(circle at 50% 40%, color-mix(in oklab, #ef4444 12%, transparent), transparent 60%)" }} />

            <div className="relative w-full max-w-md chamfered noise-texture-strong border border-red-500/20 bg-card p-8 text-center space-y-6
                animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none">
                {/* แถบบนแบบเดียวกับการ์ดฝ่าย/ระบบอื่นในแอป */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(90deg, transparent, #ef4444, transparent)" }} aria-hidden="true" />

                <span className="relative inline-grid h-16 w-16 place-items-center chamfered-sm mx-auto bg-red-500/10 text-red-500 ring-1 ring-red-500/30">
                    <AlertTriangle className="h-8 w-8" strokeWidth={1.75} />
                </span>

                <div className="space-y-2">
                    <p className="font-technical text-[10px] uppercase tracking-[0.2em] text-red-500/80">System Fault</p>
                    <h1 className="font-display font-bold text-xl">มีบางอย่างผิดพลาด</h1>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        เกิดข้อผิดพลาดที่ไม่คาดคิด ลองรีเฟรชอีกครั้ง — ข้อมูลที่แก้ไว้ก่อนหน้าไม่ได้หายไปไหน
                    </p>
                    {error.digest && (
                        <p className="font-technical text-[10px] text-muted-foreground/40 tracking-wide pt-1">DIGEST · {error.digest}</p>
                    )}
                </div>

                <div className="flex items-center justify-center gap-2 pt-2">
                    <Button onClick={() => reset()} variant="forge" size="sm" className="chamfered-sm">
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> ลองใหม่
                    </Button>
                    <Button asChild variant="outline" size="sm" className="chamfered-sm border-steel-800">
                        <Link href="/dashboard"><Home className="h-3.5 w-3.5 mr-1.5" /> กลับหน้าแรก</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

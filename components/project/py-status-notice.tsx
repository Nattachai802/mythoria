"use client";

import { useState } from "react";
import { Wrench, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { recheckPyHealth, PY_DOWN_MESSAGE, type PyHealth } from "@/hooks/use-py-health";

/**
 * ป้ายบอกสถานะเมื่อระบบวิเคราะห์ (Python service) ใช้ไม่ได้ — แสดงแทนที่ปุ่มไปเลย
 * ไม่ใช่ปุ่มจาง ๆ ที่กดไม่ติด user จะได้ไม่ต้องเดาว่ากดแล้วทำไมไม่มีอะไรเกิดขึ้น
 *
 * ค่าเริ่มต้นสั้นและ nowrap เพราะส่วนใหญ่ไปอยู่ในแถวแคบข้างชื่อฟีเจอร์ — ถ้าข้อความยาว
 * มันจะไปบีบ label ข้าง ๆ ให้ตกบรรทัดจนอ่านไม่ออก คำอธิบายเต็มอยู่ใน tooltip
 * ใส่ full ตรงที่มีที่ว่างพอ (เช่นเหนือช่องพิมพ์ของ Librarian)
 */
export function PyStatusNotice({ health, full = false, className }: {
    health: PyHealth;
    full?: boolean;
    className?: string;
}) {
    const [rechecking, setRechecking] = useState(false);

    if (health === "up") return null;

    if (health === "checking") {
        return (
            <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-muted-foreground", className)}>
                <Loader2 className="w-3 h-3 animate-spin" />
                กำลังตรวจสอบ...
            </span>
        );
    }

    // แบบสั้น: ป้ายเฉย ๆ ไม่ใช่ปุ่ม — ถ้าคลิกได้ user จะนึกว่ากดแล้วใช้ฟีเจอร์ได้
    // (การลองใหม่อยู่ในแบบเต็มที่มีที่ว่างพอจะเขียนว่ามันคืออะไร)
    if (!full) {
        return (
            <span
                title={PY_DOWN_MESSAGE}
                className={cn(
                    "inline-flex shrink-0 cursor-default select-none items-center gap-1 whitespace-nowrap rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-400",
                    className,
                )}
            >
                <Wrench className="w-3 h-3 shrink-0" />
                ปิดปรับปรุง
            </span>
        );
    }

    return (
        <span
            className={cn(
                "flex w-full items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400",
                className,
            )}
        >
            <Wrench className="w-3 h-3 shrink-0" />
            <span>{PY_DOWN_MESSAGE}</span>
            <button
                type="button"
                disabled={rechecking}
                onClick={async () => {
                    setRechecking(true);
                    await recheckPyHealth(); // อัปเดตทุกปุ่มบนหน้าพร้อมกัน ไม่ต้อง reload
                    setRechecking(false);
                }}
                className="ml-auto shrink-0 underline underline-offset-2 hover:no-underline disabled:opacity-50"
            >
                {rechecking ? "..." : "ลองใหม่"}
            </button>
        </span>
    );
}

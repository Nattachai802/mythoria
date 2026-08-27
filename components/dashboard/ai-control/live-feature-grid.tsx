"use client";

import { useEffect, useState } from "react";
import { AiFeatureCard } from "./feature-card";
import { getActiveFeatureKeys } from "@/server/ai-control";
import type { AiFeatureView } from "@/server/ai-control";

const POLL_MS = 4000; // ~2x ACTIVE_STALE_MS (lib/ai-gateway.ts) กัน miss ช่วงกลาง heartbeat

function withActive(f: AiFeatureView, active: Record<string, string>): AiFeatureView {
    return { ...f, activeSince: active[f.key] ?? null };
}

// พาสซีฟแดชบอร์ด ไม่ใช่ job ที่มีจุดจบ — poll ต่อเนื่องตราบใดที่หน้ายังเปิดอยู่
// (ต่างจาก ai-analysis-dialog.tsx ที่หยุด poll เองเมื่องานเสร็จ)
//
// รับฟีเจอร์ทั้งสองกลุ่ม (Next.js / Python) พร้อมหัวข้อของตัวเอง แล้ว render เป็น
// section แยกกัน แต่ poll getActiveFeatureKeys() รอบเดียวใช้ร่วม — ไม่ยิงซ้ำสองรอบ
export function LiveFeatureGrids({
    groups,
}: {
    groups: Array<{ heading: string; features: AiFeatureView[] }>;
}) {
    const allFeatures = groups.flatMap((g) => g.features);
    const [active, setActive] = useState<Record<string, string>>(() =>
        Object.fromEntries(allFeatures.filter((f) => f.activeSince).map((f) => [f.key, f.activeSince as string])),
    );

    useEffect(() => {
        const id = setInterval(async () => {
            if (document.visibilityState !== "visible") return;
            try {
                setActive(await getActiveFeatureKeys());
            } catch {
                // เงียบไว้ — พลาดรอบเดียวไม่ใช่เรื่องใหญ่ รอบหน้าลองใหม่
            }
        }, POLL_MS);
        return () => clearInterval(id);
    }, []);

    return (
        <>
            {groups.map(({ heading, features }) =>
                features.length > 0 ? (
                    <section key={heading}>
                        <h2 className="text-sm font-medium mb-3">{heading}</h2>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {features.map((f) => (
                                <AiFeatureCard key={f.key} feature={withActive(f, active)} />
                            ))}
                        </div>
                    </section>
                ) : null,
            )}
        </>
    );
}

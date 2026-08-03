"use client";

import { useEffect, useState } from "react";

export type PyHealth = "checking" | "up" | "down";

/**
 * Python service พร้อมใช้งานหรือยัง — ใช้ปิด/ซ่อนปุ่มที่ต้องพึ่ง service นี้ แทนที่จะให้ user กดแล้วเจอ error
 *
 * ping ครั้งเดียวต่อการโหลดหน้า แล้วแชร์ผลให้ทุก component ที่เรียก hook นี้
 * กด "ลองใหม่" ที่ไหนก็ได้ → ping รอบใหม่รอบเดียว แล้วทุก component อัปเดตพร้อมกัน
 * (ไม่ reload หน้า เพราะแอปนี้คือที่ที่คนกำลังพิมพ์งานอยู่)
 *
 * ponytail: ไม่ poll เป็นระยะ — service ล่มกลางคันแล้วปุ่มยังกดได้ ก็ตกไปที่ error handling เดิม
 */
let cached: Promise<boolean> | null = null;
const subscribers = new Set<(h: PyHealth) => void>();

function ping(): Promise<boolean> {
    cached ??= fetch("/api/py/health").then(r => r.ok).catch(() => false);
    return cached;
}

/** เช็คสถานะใหม่ แล้วแจ้งทุก component ที่ใช้ hook นี้ */
export async function recheckPyHealth(): Promise<void> {
    cached = null;
    subscribers.forEach(fn => fn("checking"));
    const ok = await ping();
    subscribers.forEach(fn => fn(ok ? "up" : "down"));
}

export function usePyHealth(): PyHealth {
    const [health, setHealth] = useState<PyHealth>("checking");

    useEffect(() => {
        let alive = true;
        const update = (h: PyHealth) => { if (alive) setHealth(h); };
        subscribers.add(update);
        ping().then(ok => update(ok ? "up" : "down"));
        return () => { alive = false; subscribers.delete(update); };
    }, []);

    return health;
}

/** คำอธิบายเต็ม — ใช้เป็น tooltip/ข้อความในที่ที่มีพื้นที่พอ */
export const PY_DOWN_MESSAGE = "ระบบวิเคราะห์ปิดปรับปรุงชั่วคราว — งานเขียนของคุณไม่ได้รับผลกระทบ";

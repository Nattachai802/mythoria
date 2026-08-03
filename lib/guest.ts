import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * โหมดผู้เยี่ยมชม: แก้ข้อมูลได้ (ข้อมูลถูกรีเซ็ตด้วย scripts/seed-demo.ts เป็นรอบ)
 * แต่เรียก AI ไม่ได้ — คนอื่นเผาโควตา API ของเจ้าของแอปไม่ได้
 *
 * เช็คจากอีเมลใน session ไม่ใช่ cookie ฝั่ง client (cookie `guest` มีไว้ให้ banner เท่านั้น)
 * cache() → หนึ่ง request ดึง session จริงครั้งเดียวเหมือน requireUser ใน lib/authz.ts
 */
export const isGuest = cache(async (): Promise<boolean> => {
    if (!process.env.DEMO_EMAIL) return false;
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.email === process.env.DEMO_EMAIL;
});

export const GUEST_AI_MESSAGE = "โหมดผู้เยี่ยมชมใช้ AI ไม่ได้ — ขอรหัสเชิญเพื่อใช้งานจริง";

/** ใส่บรรทัดแรกของ action ที่เรียก AI — throw ถ้าเป็นผู้เยี่ยมชม */
export async function assertNotGuest(): Promise<void> {
    if (await isGuest()) throw new Error(GUEST_AI_MESSAGE);
}

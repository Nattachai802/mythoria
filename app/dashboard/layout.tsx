import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { GuestBanner } from "@/components/guest-banner"

/**
 * ด่านเดียวคุมทุกหน้าใต้ /dashboard — คนที่ยังไม่ล็อกอินจะถูกพาไปหน้า login
 * แทนที่จะเจอ error จาก server action
 *
 * นี่เป็นเรื่อง UX ไม่ใช่ขอบเขตความปลอดภัย — ตัวกันจริงคือ requireNovelAccess()/requireUser()
 * ใน lib/authz.ts ที่เช็คทุกครั้งที่แตะข้อมูล layout ไม่ re-run ตอน client-side navigation
 * เลยพึ่งเป็นด่านความปลอดภัยไม่ได้ ห้ามถอด authz ออกเพราะคิดว่ามีตรงนี้แล้ว
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
        // ponytail: เด้งไป /login เฉยๆ ไม่ได้จำหน้าที่ตั้งใจจะเข้า
        // ถ้าอยากให้ล็อกอินเสร็จแล้วกลับมาหน้าเดิม ต้องมี middleware ใส่ pathname ลง header ก่อน
        redirect("/login")
    }

    return (
        <>
            <GuestBanner />
            {children}
        </>
    )
}

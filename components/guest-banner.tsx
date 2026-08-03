"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

/** แถบเตือนโหมดผู้เยี่ยมชม — อ่าน cookie ที่ /api/guest ตั้งไว้ ไม่ต้องยิง request เพิ่ม */
export function GuestBanner() {
    const [isGuest, setIsGuest] = useState(false)
    useEffect(() => {
        setIsGuest(document.cookie.split("; ").some((c) => c.startsWith("guest=")))
    }, [])

    if (!isGuest) return null

    return (
        <div className="flex flex-wrap items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <span>โหมดผู้เยี่ยมชม — ลองแก้ได้ตามสบาย ข้อมูลจะถูกรีเซ็ตทุกคืน · ฟีเจอร์ AI ปิดไว้</span>
            <Link href="/signup" className="font-medium underline underline-offset-4">
                สมัครใช้งานจริง
            </Link>
        </div>
    )
}

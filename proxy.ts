import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

// Auth gate for dashboard routes. Proxy always runs on Node.js runtime,
// so route config is not needed here.
export async function proxy(request: NextRequest) {
  const { pathname } = new URL(request.url)

  // เข้า/ออกจากระบบเมื่อไหร่ก็ล้างธงผู้เยี่ยมชม ไม่งั้นแถบแจ้งเตือนค้างกับบัญชีจริง
  // เจาะจงเฉพาะ sign-in/sign-out — /api/auth/get-session ถูกยิงทุกครั้งที่โหลดหน้า
  // ถ้าเหมารวมทั้ง /api/auth/* ธงจะโดนลบทิ้งทันทีที่ผู้เยี่ยมชมเปิดหน้าแรก
  if (pathname.startsWith("/api/auth/sign-in") || pathname.startsWith("/api/auth/sign-out")) {
    const res = NextResponse.next()
    res.cookies.delete("guest")
    return res
  }

  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next()
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

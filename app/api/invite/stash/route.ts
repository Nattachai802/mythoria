import { NextRequest, NextResponse } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE } from "@/lib/invitations";

/**
 * ฝากรหัสเชิญไว้ใน cookie ก่อนเริ่มสมัคร
 *
 * ทางอีเมลก็ต้องใช้ เพราะ better-auth ปฏิเสธ field แปลกปลอมใน body ของ sign-up
 * ทาง Google ยิ่งจำเป็น เพราะเบราว์เซอร์เด้งออกไป accounts.google.com แล้วกลับมา
 * ระหว่างนั้นไม่มีอะไรของเราติดตัวไปด้วย นอกจาก cookie ที่ฝากไว้ก่อน
 *
 * ไม่ตรวจความถูกต้องตรงนี้ — ปล่อยให้ด่านเดียวใน lib/auth.ts ตัดสิน
 * จะได้ไม่มีกติกาสองชุดที่หลุดจากกันได้
 */
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const code = typeof body?.code === "string" ? body.code.trim() : "";

    const res = NextResponse.json({ ok: true });
    res.cookies.set(INVITE_COOKIE, code, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // Lax ไม่ใช่ Strict — ขากลับจาก Google เป็นการเปลี่ยนหน้าข้ามเว็บ
        // ถ้าเป็น Strict เบราว์เซอร์จะไม่ส่ง cookie มาให้ แล้วรหัสจะหายเงียบๆ
        sameSite: "lax",
        path: "/",
        maxAge: INVITE_COOKIE_MAX_AGE,
    });
    return res;
}

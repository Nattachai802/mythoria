import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * เข้าสู่ระบบด้วยบัญชีเดโม (สร้างโดย scripts/seed-demo.ts) แล้วติดธงผู้เยี่ยมชม
 *
 * เป็น GET เพื่อให้เป็นลิงก์ธรรมดาได้ และเพราะ middleware บล็อก POST ของผู้เยี่ยมชมอยู่แล้ว
 * ต้องคัดลอก set-cookie ของ better-auth มาใส่ redirect เอง เพราะ nextCookies() ทำงาน
 * เฉพาะตอนที่ route handler ของ better-auth เป็นคนตอบกลับ
 */
export async function GET(req: NextRequest) {
    const email = process.env.DEMO_EMAIL;
    const password = process.env.DEMO_PASSWORD;
    if (!email || !password) {
        return NextResponse.json({ success: false, error: "ยังไม่ได้ตั้งค่าบัญชีเดโม" }, { status: 503 });
    }

    const signIn = await auth.api.signInEmail({
        body: { email, password },
        headers: req.headers,
        asResponse: true,
    });

    if (!signIn.ok) {
        return NextResponse.json(
            { success: false, error: "เข้าสู่ระบบบัญชีเดโมไม่สำเร็จ — รัน scripts/seed-demo.ts แล้วหรือยัง" },
            { status: 500 },
        );
    }

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    for (const cookie of signIn.headers.getSetCookie()) {
        res.headers.append("set-cookie", cookie);
    }
    // cookie นี้มีไว้ให้ฝั่ง client ขึ้นแถบแจ้งเตือนเท่านั้น — ด่านจริงอยู่ใน proxy.ts
    // ที่เทียบอีเมลใน session ลบ cookie ทิ้งก็ยังเขียนไม่ได้
    res.cookies.set("guest", "1", { sameSite: "lax", path: "/" });
    return res;
}

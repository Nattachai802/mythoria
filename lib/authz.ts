import { cache } from "react";
import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { novels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, isNull } from "drizzle-orm";

/**
 * เช็คว่า user ที่ล็อกอินอยู่เป็นเจ้าของ novel นี้จริง — ต้องเรียกก่อนอ่าน/แก้ข้อมูลที่ scope ด้วย novelId ทุกครั้ง
 * คืน userId ถ้าผ่าน, throw ถ้าไม่ผ่าน (ให้ caller ห่อ try/catch ตาม pattern { success, error } ที่ใช้อยู่ทั้ง repo)
 * ห่อด้วย React cache() → dedupe ต่อ request เดียว: หน้าเดียวโหลดหลาย action ที่ novelId เดียวกัน query จริงแค่รอบเดียว
 */
export const requireNovelAccess = cache(async (novelId: string): Promise<string> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) throw new Error("Unauthorized");

    const [novel] = await db
        .select({ userId: novels.userId })
        .from(novels)
        .where(and(eq(novels.id, novelId), isNull(novels.deletedAt)))
        .limit(1);

    if (!novel) throw new Error("Novel not found");
    if (novel.userId !== session.user.id) throw new Error("Forbidden");

    return session.user.id;
});

/**
 * เช็คแค่ session โดยไม่ต้องมี novelId (เช่น list novels ของ user เอง) — คืน userId
 * ห่อด้วย React cache() เหมือน requireNovelAccess: หน้าเดียวที่โหลดหลาย action พร้อมกัน
 * จะดึง session จริงแค่รอบเดียว
 */
export const requireUser = cache(async (): Promise<string> => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
});

/**
 * เวอร์ชันสำหรับ API route: คืน NextResponse ถ้าไม่ผ่าน, คืน null ถ้าผ่าน — ไม่ throw
 * ใช้บรรทัดเดียวบนสุดของ handler: `const denied = await guardNovel(novelId); if (denied) return denied;`
 * (route ส่วนใหญ่ห่อ try/catch ที่คืน 500 อยู่แล้ว ถ้าปล่อยให้ throw จะได้ 500 แทน 401/403)
 */
export async function guardNovel(novelId: string): Promise<NextResponse | null> {
    try {
        await requireNovelAccess(novelId);
        return null;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        const status = message === "Unauthorized" ? 401 : message === "Novel not found" ? 404 : 403;
        return NextResponse.json({ success: false, error: message }, { status });
    }
}

/** เหมือน guardNovel แต่เช็คแค่ว่าล็อกอินอยู่ — คืน userId เมื่อผ่าน */
export async function guardUser(): Promise<{ denied: NextResponse } | { userId: string }> {
    try {
        return { userId: await requireUser() };
    } catch {
        return { denied: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
    }
}

const AUTHZ_MESSAGES = ["Unauthorized", "Forbidden", "Novel not found"];

/** ใช้ใน catch block: โชว์ข้อความจริงถ้าเป็น error จาก requireNovelAccess/requireUser, ไม่งั้น fallback ข้อความทั่วไป (กัน error อื่นรั่วรายละเอียดออกไป) */
export function authErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && AUTHZ_MESSAGES.includes(error.message) ? error.message : fallback;
}

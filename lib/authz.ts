import { db } from "@/db/drizzle";
import { novels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

/**
 * เช็คว่า user ที่ล็อกอินอยู่เป็นเจ้าของ novel นี้จริง — ต้องเรียกก่อนอ่าน/แก้ข้อมูลที่ scope ด้วย novelId ทุกครั้ง
 * คืน userId ถ้าผ่าน, throw ถ้าไม่ผ่าน (ให้ caller ห่อ try/catch ตาม pattern { success, error } ที่ใช้อยู่ทั้ง repo)
 */
export async function requireNovelAccess(novelId: string): Promise<string> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) throw new Error("Unauthorized");

    const [novel] = await db
        .select({ userId: novels.userId })
        .from(novels)
        .where(eq(novels.id, novelId))
        .limit(1);

    if (!novel) throw new Error("Novel not found");
    if (novel.userId !== session.user.id) throw new Error("Forbidden");

    return session.user.id;
}

/** เช็คแค่ session โดยไม่ต้องมี novelId (เช่น list novels ของ user เอง) — คืน userId */
export async function requireUser(): Promise<string> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) throw new Error("Unauthorized");
    return session.user.id;
}

const AUTHZ_MESSAGES = ["Unauthorized", "Forbidden", "Novel not found"];

/** ใช้ใน catch block: โชว์ข้อความจริงถ้าเป็น error จาก requireNovelAccess/requireUser, ไม่งั้น fallback ข้อความทั่วไป (กัน error อื่นรั่วรายละเอียดออกไป) */
export function authErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && AUTHZ_MESSAGES.includes(error.message) ? error.message : fallback;
}

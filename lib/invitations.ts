import { db } from "@/db/drizzle"
import { invitations } from "@/db/schema"
import { eq, sql } from "drizzle-orm"
import { APIError } from "better-auth/api"
import { checkInvite, MISSING_CODE_MESSAGE } from "@/lib/invite-rules"

/**
 * รหัสเชิญ — Mythoria เป็นระบบปิด ต้องมีรหัสที่ยังใช้ได้จึงจะสร้างบัญชีได้
 *
 * รหัสเดินทางมาถึงด่านผ่าน cookie เสมอ ไม่ว่าจะสมัครทางไหน:
 * - ทางอีเมล  ฟอร์มฝากรหัสไว้ก่อนยิง sign-up (better-auth ปฏิเสธ field แปลกปลอมใน body)
 * - ทาง Google ฟอร์มฝากรหัสไว้ก่อนเด้งออกไป แล้วอ่านกลับตอนเขากลับมา
 *
 * ต้องเป็น SameSite=Lax ไม่ใช่ Strict — ขากลับจาก Google เป็นการเปลี่ยนหน้าข้ามเว็บ
 * ถ้าเป็น Strict เบราว์เซอร์จะไม่ส่ง cookie มาให้ แล้วรหัสจะหายเงียบๆ
 */
export const INVITE_COOKIE = "mythoria_invite"
export const INVITE_COOKIE_MAX_AGE = 60 * 15 // 15 นาที พอสำหรับเดินเรื่อง OAuth ให้จบ

function reject(message: string): never {
    throw APIError.from("FORBIDDEN", { code: "INVALID_INVITE_CODE", message })
}

/**
 * ตรวจว่ารหัสนี้ใช้สร้างบัญชีได้ไหม — ยังไม่หักโควตา
 * throw APIError ถ้าใช้ไม่ได้ (better-auth ส่งข้อความนี้กลับไปให้ผู้ใช้เห็นตรงๆ)
 */
export async function assertInviteUsable(code: string | null | undefined) {
    const trimmed = code?.trim()
    if (!trimmed) reject(MISSING_CODE_MESSAGE)

    const [invite] = await db.select().from(invitations).where(eq(invitations.code, trimmed)).limit(1)

    const problem = checkInvite(invite ?? null)
    if (problem) reject(problem)

    return invite
}

/**
 * หักโควตาหลังสร้างบัญชีสำเร็จ
 *
 * ponytail: ตรวจกับหักแยกกันคนละจังหวะ (before/after) มีช่องแข่งกันแคบๆ ถ้าสองคน
 * ยิงรหัสเดียวกันพร้อมกันเป๊ะ อาจใช้เกินโควตาไป 1 ครั้ง — ระบบนี้มีผู้ใช้หลักหน่วย
 * ยังไม่คุ้มกับการล็อกแถว ถ้าวันหนึ่งแจกรหัสเป็นร้อย ค่อยเปลี่ยนเป็น UPDATE ... WHERE
 * used_count < max_uses RETURNING แล้วเช็คว่าได้แถวกลับมาไหม
 */
export async function consumeInvite(code: string | null | undefined) {
    const trimmed = code?.trim()
    if (!trimmed) return

    await db
        .update(invitations)
        .set({ usedCount: sql`${invitations.usedCount} + 1`, lastUsedAt: new Date() })
        .where(eq(invitations.code, trimmed))
}

// กฎว่ารหัสเชิญใบไหนใช้สร้างบัญชีได้ — logic ล้วน ไม่แตะฐานข้อมูล เพื่อให้ตรวจสอบได้ด้วย node
// รันเช็ค: node --experimental-strip-types lib/invite-rules.check.ts

export type InviteRow = {
    maxUses: number
    usedCount: number
    expiresAt: Date | null
    revokedAt: Date | null
}

/**
 * คืนข้อความบอกเหตุผลถ้าใช้ไม่ได้, คืน null ถ้าใช้ได้
 * ส่ง invite เป็น null เมื่อค้นในตารางแล้วไม่เจอ
 */
export function checkInvite(invite: InviteRow | null, now: Date = new Date()): string | null {
    if (!invite) return "ไม่พบรหัสเชิญนี้ ตรวจสอบตัวสะกดอีกครั้ง"
    if (invite.revokedAt) return "รหัสเชิญนี้ถูกยกเลิกแล้ว"
    if (invite.expiresAt && invite.expiresAt.getTime() < now.getTime()) return "รหัสเชิญนี้หมดอายุแล้ว"
    if (invite.usedCount >= invite.maxUses) return "รหัสเชิญนี้ถูกใช้ครบจำนวนแล้ว"
    return null
}

export const MISSING_CODE_MESSAGE =
    "ต้องมีรหัสเชิญจึงจะสมัครได้ — Mythoria ยังไม่เปิดให้บุคคลทั่วไป"

// เช็คตัวเอง — รัน: node --experimental-strip-types lib/invite-rules.check.ts
import assert from "node:assert/strict"
import { checkInvite, type InviteRow } from "./invite-rules.ts"

const now = new Date("2026-07-26T00:00:00Z")
const base: InviteRow = { maxUses: 1, usedCount: 0, expiresAt: null, revokedAt: null }
const yesterday = new Date("2026-07-25T00:00:00Z")
const tomorrow = new Date("2026-07-27T00:00:00Z")

// ผ่านได้เฉพาะรหัสที่ยังไม่ถูกใช้ ไม่หมดอายุ ไม่ถูกเพิกถอน
assert.equal(checkInvite(base, now), null)
assert.equal(checkInvite({ ...base, expiresAt: tomorrow }, now), null)
assert.equal(checkInvite({ ...base, maxUses: 3, usedCount: 2 }, now), null)

// ทุกกิ่งที่ต้องปฏิเสธ
assert.match(checkInvite(null, now)!, /ไม่พบรหัสเชิญ/)
assert.match(checkInvite({ ...base, revokedAt: yesterday }, now)!, /ถูกยกเลิก/)
assert.match(checkInvite({ ...base, expiresAt: yesterday }, now)!, /หมดอายุ/)
assert.match(checkInvite({ ...base, usedCount: 1 }, now)!, /ใช้ครบ/)
assert.match(checkInvite({ ...base, maxUses: 3, usedCount: 3 }, now)!, /ใช้ครบ/)

// เพิกถอนต้องชนะทุกอย่าง แม้รหัสจะยังไม่หมดอายุและยังมีโควตาเหลือ
assert.match(checkInvite({ maxUses: 99, usedCount: 0, expiresAt: tomorrow, revokedAt: yesterday }, now)!, /ถูกยกเลิก/)

// หมดอายุพอดีวินาทีเดียวกัน ยังถือว่าใช้ได้ (ตัดที่ "น้อยกว่า" เท่านั้น)
assert.equal(checkInvite({ ...base, expiresAt: now }, now), null)

console.log("✅ invite-rules ผ่านทั้งหมด")

// เช็คตัวเอง — รัน: node --experimental-strip-types lib/story-date.check.ts
// ตั้ง TZ=Asia/Bangkok ด้วยจะครอบคลุมบั๊ก UTC offset ที่เคยทำให้วันเพี้ยนไป 1 วัน
import assert from "node:assert/strict"
import { clampStoryDate, toDateInputValue, fromDateInputValue, dayLabel, STORY_DATE_MAX } from "./story-date.ts"

// 1) round-trip ต้องไม่เลื่อนวัน (บั๊กเดิม: toISOString() ทำให้ 15 มี.ค. กลายเป็น 14 มี.ค. ที่ UTC+7)
const epoch = new Date(2026, 2, 15) // 15 มี.ค. 2026 เที่ยงคืน เวลาท้องถิ่น
assert.equal(toDateInputValue(epoch), "2026-03-15")
assert.equal(toDateInputValue(fromDateInputValue("2026-03-15")), "2026-03-15")

// 2) เลขมหาศาลต้องไม่ทำให้ Intl โยน RangeError
assert.equal(clampStoryDate(999999999), STORY_DATE_MAX)
assert.doesNotThrow(() => dayLabel(clampStoryDate(999999999), epoch))

// 3) ปัดเศษ + ค่าติดลบ (prologue ก่อนเริ่มเรื่อง) ต้องยังใช้ได้
assert.equal(clampStoryDate(3.9), 3)
assert.equal(dayLabel(-4, epoch), "10 มี.ค. 2569")

// 4) Day 1 = วันเดียวกับ epoch, ไม่มี epoch ให้ fallback เป็น "Day N"
assert.equal(dayLabel(1, epoch), "15 มี.ค. 2569")
assert.equal(dayLabel(1, null), "Day 1")
assert.equal(dayLabel(null, epoch), null)

console.log("✅ story-date ผ่านทั้งหมด")

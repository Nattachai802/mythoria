// วันที่ในโลกเรื่อง (P3 Phase A) — logic ล้วน ไม่พึ่ง React เพื่อให้ตรวจสอบได้ด้วย node
// รันเช็ค: node --experimental-strip-types lib/story-date.check.ts

const buddhistFormatter = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
})

// จำกัดช่วง ±100 ปี — กัน Intl.format โยน RangeError เมื่อผู้ใช้กรอกเลขมหาศาล
export const STORY_DATE_MIN = -36500
export const STORY_DATE_MAX = 36500

export function clampStoryDate(n: number) {
    return Math.min(STORY_DATE_MAX, Math.max(STORY_DATE_MIN, Math.trunc(n)))
}

export function addDays(base: Date, days: number) {
    const d = new Date(base)
    d.setDate(d.getDate() + days)
    return d
}

// <input type="date"> ใช้เวลาท้องถิ่น — toISOString() แปลงเป็น UTC ทำให้ที่ไทย (UTC+7) เพี้ยนไป 1 วัน
export function toDateInputValue(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// new Date("2026-03-15") = เที่ยงคืน UTC (= 07:00 ที่ไทย) — ต้องประกอบเป็นเวลาท้องถิ่นเอง
export function fromDateInputValue(v: string) {
    const [y, m, d] = v.split("-").map(Number)
    return new Date(y, m - 1, d)
}

// storyDate=1 คือวันเดียวกับ epoch (Day 1 = epoch + 0)
export function dayLabel(storyDate: number | null | undefined, epoch: Date | null): string | null {
    if (storyDate == null) return null
    return epoch ? buddhistFormatter.format(addDays(epoch, storyDate - 1)) : `Day ${storyDate}`
}

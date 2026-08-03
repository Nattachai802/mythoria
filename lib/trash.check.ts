import assert from "node:assert/strict";
import { TRASH_RETENTION_DAYS, daysLeft } from "./trash.ts";

const DAY = 86400_000;
const now = Date.UTC(2026, 0, 10);

// เพิ่งลบ = เหลือเต็มจำนวนวัน
assert.equal(daysLeft(new Date(now), now), TRASH_RETENTION_DAYS);

// ลบไป 1 วัน = เหลือ 6
assert.equal(daysLeft(new Date(now - DAY), now), TRASH_RETENTION_DAYS - 1);

// ลบไป 6 วันครึ่ง = ยังเหลือ 1 วัน (ปัดขึ้น ไม่ใช่ 0 — ห้ามบอก user ว่าหมดเวลาทั้งที่ยังกู้ได้)
assert.equal(daysLeft(new Date(now - 6.5 * DAY), now), 1);

// ครบพอดี = 0
assert.equal(daysLeft(new Date(now - TRASH_RETENTION_DAYS * DAY), now), 0);

// เกินกำหนดแล้วต้องไม่ติดลบ
assert.equal(daysLeft(new Date(now - 30 * DAY), now), 0);

console.log("trash: ok");

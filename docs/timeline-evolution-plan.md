# Timeline Evolution Plan — เส้นเวลาเรื่อง (Chronological Timeline)

## สถานะปัจจุบัน (Level 1: Ordinal)

- เส้นเวลาจริงอยู่ที่ `ChronoTimelineSheet` เปิดเป็น Sheet บนหน้า `/dashboard/project/[id]/plot`
- แต่ละ scene event มีแค่ `storyTimeIndex` (int, nullable) = ลำดับ "ก่อน/หลัง" เท่านั้น
- แสดงผลจัดกลุ่มตามบท (`relatedChapterId`) เพื่อเทียบลำดับการเล่า vs ลำดับเวลาจริง → ไฮไลต์ flashback
- ยังทำได้แค่ระดับ "เกิดก่อน-เกิดหลัง" ไม่มีระยะห่าง/วันที่จริง

## เป้าหมาย

ยกเส้นเวลาจาก **ordinal** → **duration + in-world date** เพื่อปลดล็อกการตรวจ conflict เชิงเวลาอัตโนมัติ
(ตัวละครตายแล้วโผล่, เดินทางเร็วผิดปกติ, timeskip ที่มองไม่เห็น)

## ระดับของ "เวลา" (roadmap)

| Level | คือ | สถานะ |
|-------|-----|-------|
| 1 | ลำดับ (ordinal) — ก่อน/หลัง | ✅ มีแล้ว (`storyTimeIndex`) |
| 2 | ระยะห่าง (duration/gap) ระหว่างฉาก | ⬜ แผนนี้ |
| 3 | เวลาสัมบูรณ์ (in-world date) ผูกกับ `eras` | ⬜ แผนนี้ |
| 4 | เกิดพร้อมกัน (concurrency) — หลายเส้นขนาน | ⬜ ภายหลัง |
| 5 | เหตุ-ผล (causality) A ทำให้เกิด B | ⬜ ภายหลัง |

## Phase A — In-world date/duration (Level 2-3)

### Schema (`db/schema.ts` — `timelineEvents`)
เพิ่ม field (ทั้งหมด nullable เพื่อ backward-compatible):
- `storyDate` — text หรือ int (วันในโลกเรื่อง; เก็บเป็น "day number" จากจุดอ้างอิงเพื่อคำนวณ diff ได้ง่าย)
- `storyDuration` — int (ความยาวฉากเป็นหน่วยเวลา เช่นชั่วโมง) — optional
- ผูก `eraId` (มี `eras` table อยู่แล้ว) เพื่อวางฉากในยุค

> ponytail: เก็บ storyDate เป็น int "day number" ก่อน ไม่ทำปฏิทินเต็ม (เดือน/ปีแบบ custom calendar) จนกว่าจะมีคนขอ — day number พอคำนวณ gap/ลำดับ/conflict ได้ครบ

### Migration
- `npm run db:push` (หรือ drizzle generate + migrate ตามที่โปรเจกต์ใช้) — เพิ่ม column แบบ nullable ไม่กระทบข้อมูลเดิม

### Server (`server/timeline.ts`)
- ไม่ต้องเพิ่ม action ใหม่ — `updateTimelineEvent` รองรับ field ใหม่ผ่าน `data` อยู่แล้ว (และตอนนี้กัน `novelId`/`id` ไม่ให้แก้แล้ว)

### UI (`components/project/timeline/chrono-timeline-sheet.tsx`)
- เพิ่มช่องกรอก storyDate ต่อฉาก
- แสดง "gap" ระหว่างฉากที่ติดกัน (เช่น "+3 วัน", "timeskip 2 ปี")
- เรียงตาม storyDate เมื่อมีค่า, fallback เป็น storyTimeIndex

## Phase B — Conflict detection เชิงเวลา
- ต่อยอดที่ `server/timeline-conflicts.ts` (มีอยู่แล้ว)
- ตรวจ: ตัวละครอยู่ 2 ที่พร้อมกัน, event หลังตาย, เวลาถอยหลังโดยไม่ตั้งใจ (flashback ที่ไม่ได้ mark)

## Decision ที่ค้าง (ต้องถามผู้ใช้ก่อนลงมือ Phase A)
1. รูปแบบวันที่ในโลกเรื่อง: **day number ล้วน** vs **custom calendar** (เดือน/ปีที่ผู้เขียนตั้งเอง)?
2. เส้นเวลาควรยังเป็น Sheet บน `/plot` หรือย้ายเป็นหน้าแยก `/plot/timeline` เมื่อ Phase A เพิ่ม UI หนักขึ้น?
   - ข้อเสนอ: refactor เนื้อ sheet เป็นคอมโพเนนต์ที่ render ได้ทั้ง sheet และหน้าเต็ม → ค่อยเพิ่ม route ทีหลังแทบไม่เขียนเพิ่ม

## Test cases (ตาม policy: เขียน .xlsx ก่อน ship ฟีเจอร์)
- ยังไม่สร้าง — จะเขียนตอนเริ่ม Phase A จริง (กรอก storyDate, ดู gap, เรียงลำดับ, conflict)

---
target: ChronoTimelineSheet
total_score: 22
p0_count: 1
p1_count: 4
timestamp: 2026-07-24T22-02-33Z
slug: ponents-project-timeline-chrono-timeline-sheet-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | บันทึก storyDate แบบ onBlur เงียบสนิท ไม่มี confirm ว่าบันทึกแล้ว |
| 2 | Match System / Real World | 3 | ภาษาไทยดี แต่ `lore.type` โชว์ enum อังกฤษดิบ (myth/prophecy) กลาง UI ไทย |
| 3 | User Control and Freedom | 2 | ถอดฉากออกจากเส้นเวลาไม่มี undo/confirm |
| 4 | Consistency and Standards | 2 | raw `<input>`/`<select>` ปน shadcn; emoji ปน lucide; font 5 ขนาดที่ 3 ขนาดห่างกันแค่ 1px |
| 5 | Error Prevention | 2 | storyDate รับค่าติดลบ/ค่ามหาศาลได้ ไม่มี min/max |
| 6 | Recognition Rather Than Recall | 3 | มี dayText ช่วย แต่ความสัมพันธ์ epoch↔Day N ต้องจำเอง |
| 7 | Flexibility and Efficiency | 2 | ไม่มี keyboard shortcut, ตั้งยุคทีละแถวเท่านั้น ไม่มี bulk |
| 8 | Aesthetic and Minimalist Design | 2 | แถวอัดเป็น 3 บรรทัด metadata สีเทาน้ำหนักเท่ากันหมด |
| 9 | Error Recovery | 2 | optimistic patch ไม่ rollback เมื่อ save fail — UI ค้างค่าที่บันทึกไม่ผ่าน |
| 10 | Help and Documentation | 2 | SheetDescription เป็น help เดียวที่มี และข้อความล้าสมัยแล้ว |
| **Total** | | **22/40** | **Acceptable — ต้องปรับหลายจุดก่อนใช้จริงยาวๆ** |

## Anti-Patterns Verdict

**LLM assessment**: ไม่ใช่ AI slop แบบ landing page (ไม่มี gradient text, ไม่มี hero metric, ไม่มี eyebrow) — Forge Mode token ถูกใช้จริง ภาษาไทยเป็นหลัก ดูเป็น product tool ไม่ใช่เทมเพลต **แต่** มี absolute ban 1 ข้อหลุดเข้ามา: `border-l-2 border-dashed` + `borderColor: era.color` บนบล็อก lore = side-stripe border สีเกิน 1px ตอนอยู่ใน mockup มันมีจุดกลม + spine เลยอ่านเป็น "รางเวลา" แต่ตอนแปลงเป็น React จุดหายไป เหลือแค่แถบสีข้าง = ตรงนิยาม ban เป๊ะ

**Deterministic scan**: `detect.mjs` = 0 findings (exit 0) — จับ side-stripe ตัวนี้ไม่ได้เพราะเป็น Tailwind class + inline style ไม่ใช่ CSS ตรงๆ ถือเป็นช่องโหว่ของ detector ไม่ใช่ใบผ่าน

**Visual overlays**: ไม่ได้ทำ — preview pane ติดหน้า login (เข้าระบบแทนผู้ใช้ไม่ได้) และ artifact domain ถูก block

## Overall Impression

ฟีเจอร์ทำงานได้และแนวคิด (day number + epoch + Intl พุทธศักราช) ถูกทาง — ไม่ต้องเขียน calendar engine เอง คือการตัดสินใจที่ดี

ปัญหาคือ **ผมยัด form control 3 ตัวลงในแถวที่ออกแบบมาให้แสดงผลอย่างเดียว โดยไม่ได้ออกแบบแถวใหม่** แถวเดิมเป็น 2 บรรทัดสะอาด ตอนนี้เป็น 3 บรรทัดที่ทุกบรรทัดเป็นสีเทา 9-10px น้ำหนักเท่ากัน — ตาไม่รู้จะจับอะไรก่อน และที่หนักกว่านั้นคือ **มี timezone bug ที่ทำให้ค่าในตัวเลือกวันที่เพี้ยนไป 1 วัน**

## What's Working

1. **การเลือก day-number + epoch แทน custom calendar** — `Intl.DateTimeFormat('th-TH-u-ca-buddhist')` เป็น native ทำให้ได้ พ.ศ. ฟรี และ gap/conflict ยังคำนวณบน int ง่ายๆ เป็นการตัดสินใจสถาปัตยกรรมที่ประหยัดโค้ดจริง
2. **Gap pill 3 ระดับ (ปกติ / timeskip / ย้อนเวลา) แยกด้วยทั้งสีและข้อความ** — ไม่ได้พึ่งสีอย่างเดียว ผ่านเกณฑ์ color-not-only
3. **ทุก field เป็น nullable + fallback เป็น "Day N"** — ผู้เขียนที่ไม่อยากผูกปฏิทินจริงยังใช้ได้ ไม่บังคับ ตรงกับหลัก "AI/feature is opt-in" ของโปรเจกต์

## Priority Issues

### [P0] Timezone bug — ตัวเลือกวันที่แสดงผิดไป 1 วัน และเขียนทับค่าผิดได้
`epoch.toISOString().slice(0, 10)` แปลงเป็น UTC ก่อน ที่ไทย (UTC+7) วันที่ 15 มี.ค. เที่ยงคืนกลายเป็น 14 มี.ค. ใน UTC
ยืนยันแล้วด้วยการรันจริง: ค่าที่เก็บ 15 มี.ค. → picker แสดง **14 มี.ค.** ขณะที่ป้าย พ.ศ. ในแถวแสดง **15 มี.ค. 2569** ถูกต้อง
**Why it matters**: ผู้ใช้เห็นสองค่าขัดกันในหน้าจอเดียว และถ้าแตะ picker แล้วกดยืนยัน จะบันทึกวันย้อนหลังไป 1 วันทุกครั้ง = ข้อมูลเพี้ยนสะสม
**Fix**: ฟอร์แมตด้วย local component แทน — `` `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` `` จาก `getFullYear/getMonth/getDate` และตอนอ่านค่ากลับใช้ `new Date(y, m-1, d)` ไม่ใช่ `new Date(string)`
**Suggested command**: `/impeccable harden`

### [P1] ตัวหนังสือ 9-10px เล็กเกินไปสำหรับภาษาไทย
dayText, era select, lore type = 9px; อีก 8 จุด = 10px
**Why it matters**: อักษรไทยมีสระบน/ล่างและวรรณยุกต์ซ้อนแนวตั้ง ที่ 9px มันเบียดกันจนอ่านไม่ออก — ต้องการขนาดมากกว่าละตินที่ระดับความชัดเท่ากัน ไม่ใช่น้อยกว่า PRODUCT.md ระบุ "WCAG AA อย่างน้อย" + "Thai-first clarity" + ผู้ใช้เขียนต่อเนื่องหลายชั่วโมง นี่ขัดหลักตัวเอง
**Fix**: ตั้ง floor ที่ 11px สำหรับข้อความไทยทุกจุด และยุบ scale เหลือ 3 ระดับ (11 / 12 / 14) — 9/10/11 ห่างกันแค่ ~1.1x อ่านไม่ออกว่าเป็นลำดับชั้นอยู่แล้ว
**Suggested command**: `/impeccable typeset`

### [P1] raw `<input>` / `<select>` ขัดกับ component vocabulary ของโปรเจกต์
โปรเจกต์ใช้ shadcn `Select` / `Input` ทุกที่ (เห็นได้ใน timeline-board.tsx บรรทัดเดียวกัน) แต่แถวนี้ใช้ native
**Why it matters**: native `<select>` เปิด dropdown ของ OS ซึ่งไม่รับ Forge Mode dark theme — จะเป็นกล่องขาวโผล่กลางจอมืด และ product register ห้าม "inconsistent component vocabulary" ตรงๆ
**Fix**: เปลี่ยนเป็น shadcn `Select` + `Input` ให้ตรงกับ filter dropdown ที่อยู่ห่างไป 200 บรรทัด
**Suggested command**: `/impeccable polish`

### [P1] แถวกลายเป็น 3 บรรทัด metadata น้ำหนักเท่ากันหมด
ชื่อฉาก / "เล่าเป็นลำดับที่ N · eventDate" / [input][dayText][select] — บรรทัด 2 กับ 3 เป็นสีเทา muted ขนาดใกล้กัน
**Why it matters**: Visual noise floor — ไม่มีอะไรเด่น ตาต้องไล่อ่านทุกบรรทัด ทั้งที่ 90% ของเวลาผู้เขียนสนใจแค่ "ฉากนี้วันไหน" PRODUCT.md บอก "Density with breathing room" ตอนนี้ได้ density แต่ไม่ได้ breathing room
**Fix**: ยกวันที่ขึ้นเป็น badge ซ้ายมือของแถว (เหมือน mockup) แทนที่จะซ่อนเป็นบรรทัดที่ 3 แล้วให้ input/select โผล่เฉพาะตอน hover/focus หรือย้ายเข้า popover — progressive disclosure
**Suggested command**: `/impeccable layout`

### [P1] optimistic update ไม่ rollback เมื่อบันทึกไม่สำเร็จ
`onEventPatched()` ยิงทันที ถ้า server action fail มีแค่ toast — state ใน UI ยังค้างค่าที่บันทึกไม่ผ่าน
**Why it matters**: ผู้ใช้เห็นค่าใหม่บนจอ คิดว่าบันทึกแล้ว รีเฟรชทีค่าหาย เป็นการสูญหายข้อมูลเงียบๆ กระทบทั้ง storyDate, eraId และ storyTimeIndex (โค้ดเดิม)
**Fix**: เก็บค่าเดิมไว้ก่อน patch แล้ว `onEventPatched(id, { storyDate: prevValue })` ใน branch ที่ fail
**Suggested command**: `/impeccable harden`

## Persona Red Flags

**Alex (Power User)** — เขียน serial ที่มี 60 ฉาก:
- ตั้งยุคได้ทีละแถวเท่านั้น ฉาก 1-40 อยู่ยุคเดียวกัน = คลิก select 40 ครั้ง ทั้งที่ยุคเป็นคุณสมบัติของ "ช่วง" ไม่ใช่ของแถว
- ไม่มี keyboard shortcut ใดๆ, Tab จาก input วันที่ไปยุคแล้วไปแถวถัดไปไม่มี flow ที่ออกแบบไว้
- กรอกวันที่ต้อง blur ทุกช่อง (Enter ไม่ commit) — พิมพ์ 60 ฉากคือคลิกออก 60 ครั้ง

**Sam (Accessibility-Dependent)**:
- ปุ่ม ✕ เป็น `opacity-0 group-hover:opacity-100` ไม่มี `focus-visible:opacity-100` → Tab ไปถึงแล้วมองไม่เห็นอะไรเลย โฟกัสหายไปในอากาศ
- ปุ่ม ✕ และ drag handle ใช้ `title` เป็น label เดียว ไม่มี `aria-label`
- ปุ่ม drag handle เป็น `<button>` แต่ dnd-kit sortable ไม่มี keyboard sensor ในไฟล์นี้ (มี `KeyboardSensor` import อยู่ใน timeline-board.tsx แต่ sheet นี้ใช้แค่ PointerSensor) → จัดลำดับด้วยคีย์บอร์ดไม่ได้เลย
- ข้อความ 9px ที่ zoom 200% ยังเล็กกว่า body text ปกติ

**Riley (Stress Tester)**:
- `defaultValue` + ไม่มี `key` = uncontrolled input ถ้า storyDate เปลี่ยนจากที่อื่นหรือ rollback ช่องยังโชว์ค่าเก่า
- กรอก `-5` ในช่องวันที่ได้ ไม่มี min — ได้ gap ติดลบและ "⚠ ย้อนเวลา" ที่ไม่ได้ตั้งใจ
- กรอก `999999999` ได้ → `addDays` ให้ Invalid Date → `Intl.format` throw RangeError → แถวพัง
- ยุคที่ไม่มี loreEntries เลย render เป็นกล่องขอบเปล่าๆ ไม่มี empty state

## Minor Observations

- **SheetDescription ล้าสมัย**: ยังเขียน "เลขในวงเล็บคือลำดับเล่า" แต่แถวเปลี่ยนเป็น "เล่าเป็นลำดับที่ N" แล้ว มีแต่ลิสต์ "ยังไม่จัดลำดับ" ที่ยังใช้วงเล็บ
- **emoji เป็น icon เชิงโครงสร้าง** (🚩 ⏳ ⚠) ขณะที่ทั้งโปรเจกต์ใช้ lucide — เปลี่ยนสีตาม token ไม่ได้ และ render ไม่เหมือนกันข้าม OS
- **สองระบบวันที่โชว์พร้อมกัน**: `eventDate` (text อิสระเดิม) บรรทัด 2 กับ `storyDate`→dayText บรรทัด 3 ผู้ใช้ไม่รู้ว่าอันไหนคือของจริง
- **`lore.type` แสดง enum อังกฤษดิบ** ("myth", "prophecy") ควรมี label map ไทยเหมือน `EVENT_TYPE_LABELS` ที่มีอยู่แล้วใน timeline-board.tsx
- **เสีย spine ของ timeline**: mockup มีเส้นตั้ง + จุดกลมทำให้ gap อ่านเป็น "ช่วงห่าง" ตอนนี้ gap ลอยเป็น `pl-7` เฉยๆ ไม่ได้เชื่อมอะไร

## Questions to Consider

- ถ้ายุคเป็นคุณสมบัติของ **ช่วง** ไม่ใช่ของแถว — UI ควรเป็น section header ที่คร่อมกลุ่มฉาก แทนที่จะเป็น select ซ้ำ 40 ตัวไหม
- ผู้เขียนคิดเป็น "อีก 3 วันต่อมา" มากกว่า "นี่คือวันที่ 47" — ควรให้กรอก **ระยะห่างจากฉากก่อน** แล้วให้ระบบบวกสะสม storyDate ให้เองไหม
- Sheet กว้าง 440px ยังพอไหมเมื่อแถวมี 3 คอนโทรล หรือถึงเวลาแยกเป็นหน้า `/plot/timeline` ตามที่ค้างไว้ใน decision ข้อ 2

# Mythoria — UX Improvement Plan (ลดความรู้สึก "ฟีเจอร์เยอะจนใช้ยาก")

> ปัญหาที่ผู้ใช้รู้สึก: ระบบมีฟีเจอร์เยอะมากจนนักเขียนใช้งานลำบาก
> วิธีคิด: **ลด cognitive load** — ไม่ใช่ตัดฟีเจอร์ แต่ "ค่อยๆ เผย" (progressive disclosure) + นำทาง + ยุบ chrome
> ยึดหลักการใน [`PRODUCT.md`](../PRODUCT.md): *Forge Mode is earned, not imposed* · *Tool disappears into the task* · *Density with breathing room*

---

## วินิจฉัยหลัก (จาก audit ทุกหน้า)

**ข่าวดี — ฐานดีอยู่แล้ว:** หน้าหนาๆ ใช้ tab/collapsible จัดการดี (worldbuilding/character/analytics), มี empty state 50 ไฟล์, editor มี Zen mode, World Graph รีดีไซน์แล้ว

**ปัญหาจริงไม่ใช่ "หน้ารก" แต่คือ 4 อย่าง:**
1. 🔴 **ไม่มี onboarding เลย (0)** — เปิดนิยายใหม่เจอ 8 เมนู + 21 หน้าแบบเย็นชา ไม่รู้เริ่มตรงไหน
2. 🔴 **ของขั้นสูงโผล่ตั้งแต่ยังว่าง** — AI tools บน Overview, advanced layers บน Plot board
3. 🟡 **Modal overload** — 68 ไฟล์ใช้ modal (WorldBuilding 43, Characters 27, Editor 25)
4. 🟡 **IA ระดับบนแบน + ค้นหายังไม่เต็มศักยภาพ** — nav 8 อันเรียงเท่ากัน, global-search ค้นแค่ 4 type นำทางอย่างเดียว

---

## ผล audit รายหน้า

| หน้า | สถานะ | ปัญหาเด่น |
|------|--------|-----------|
| **Overview** | โครงดี | AI tools โผล่บน landing (imposed) · กำแพงเลข 0 ตอนใหม่ · emoji icon `✓⚡` · publish/export โผล่เร็ว |
| **Note Editor** (924บ. 23ปุ่ม 25modal) | core task | chrome เยอะรอบที่เขียน — แต่มี Zen mode ช่วย · sidebar 3 tab สะอาด |
| **Plot / TimelineBoard** (488บ.) | dense | arc + tension + threads + filter เปิดพร้อมกัน → default ควรเรียบ |
| **Characters** (576บ. **27 modal**) | modal-heavy | ไม่มี empty state ชัด · แก้ไขผ่าน modal เยอะ |
| **Character detail** (26 comp) | ✅ ดี | มี tab (Basic/Description/Depth) จัด disclosure ดี |
| **World Building** (396บ. 9tab **43 modal**) | modal สูงสุด | tab ดี แต่ทุกการแก้เป็น modal |
| **World Graph** | ✅ รีดีไซน์แล้ว | (เสร็จรอบก่อน) |
| **Relationships** (152บ. 5tab) | ok | tabbed |
| **Powers** (103บ. 9modal) | ok | |
| **Ideas** (704บ. 13ปุ่ม 5tab) | ใหญ่ | tabbed แต่ control เยอะ |
| **Analytics** (264บ. 3tab) | tabbed | emoji icon 5 จุด |
| **Settings / Rewrite** | ok | Rewrite = power feature (3 mode + shortcuts) |

---

## แผนแก้ (เรียง P0 → P2)

### 🔴 P0 — แก้ต้นเหตุ "ไม่รู้เริ่มตรงไหน" (effort ต่ำ, ผลสูงสุด)

**P0.1 — First-run guide บน Overview**
- นิยายใหม่ (0 ตอน): แทนกำแพงสถิติ/AI tools ด้วย **เส้นทางนำ 3 ก้าว** — เขียนตอนแรก → เพิ่มตัวละคร → วางพล็อต
- ใช้ empty-state pattern ที่มีอยู่แล้วเป็นฐาน

**P0.2 — Earned disclosure**
- ซ่อน "เครื่องมือ AI" (Vector Sync/Plot Hole/Stylometry) บน Overview จนกว่ามีเนื้อหา (ตอน ≥1 หรือคำ ≥500)
- ซ่อน nav ขั้นสูง (World Graph/Powers/Stylometry) จนกว่ามีข้อมูลที่เกี่ยว
- Plot board default = view เรียบ; arc/tension/promise อยู่หลัง toggle

**P0.3 — จัดกลุ่ม nav 8 อัน → 3 โซน**
```
✍️ เขียน      Overview · Chapters · Plot · Ideas
🌍 โลก        Characters · World Building · Relationships · Powers · World Graph
📊 วิเคราะห์   Analytics · Stylometry
```
แค่ใส่ `SidebarGroupLabel` คั่น

### 🟡 P1 — ลดภาระความจำ + ขัดจังหวะ

**P1.1 — Command Palette (Cmd+K)** ⭐
- ยกระดับ `global-search.tsx` → ครอบทุก entity (เพิ่ม lore/power/idea/faction) + actions (สร้างตอน, เพิ่มตัวละคร, เปิด feature) + Librarian Q&A
- ไม่ต้องจำว่า feature อยู่ไหน — จำแค่ว่าอยากทำอะไร

**P1.2 — ลด modal ที่ขัดจังหวะ**
- flow แก้ไขสั้นๆ (rename, เปลี่ยน field เดียว) → inline edit แทน modal
- form ยาว → side sheet แทน modal กลางจอ (ไม่บังบริบท)
- เริ่มที่ WorldBuilding (43) + Characters (27)

### ⚪ P2 — ขัดเงา

**P2.1 — แทน emoji ด้วย Lucide icon** (Overview `✓⚡`, Analytics ×5) — ตาม skill (emoji ≠ structural icon)
**P2.2 — ลบลิงก์/ปุ่มซ้ำ** (Overview "ดูทั้งหมด" ซ้ำ, publish/export ย้ายเข้า overflow)
**P2.3 — Note Editor: รวมปุ่มรองเข้า overflow** — เหลือเฉพาะ Save + Zen + sidebar toggle เด่น ที่เหลือเข้า `...`

---

## ลำดับแนะนำ
**P0.1 + P0.3** ก่อน (first-run + จัดกลุ่ม nav) — ครึ่งวัน แก้ความรู้สึก overload ได้ทันทีโดยไม่สร้างของใหม่
→ **P0.2** earned disclosure → **P1.1** Command Palette (หมัดเด็ด) → P1.2 ลด modal (ทยอย) → P2 ขัดเงา

## หลักการที่ยึด (กันหลงทาง)
- **ลด ไม่ใช่เพิ่ม** — ทุกข้อแก้ด้วยการซ่อน/ยุบ/รวม ไม่ใช่เพิ่ม UI
- **earned, not imposed** — ของขั้นสูงโผล่เมื่อผู้ใช้พร้อม
- **ปกป้อง flow การเขียน** — หน้าเขียนคือหัวใจ, chrome ต้องหลีกทางได้
- ไม่ตัดฟีเจอร์ — power user ยังเข้าถึงทุกอย่างได้ (ผ่าน palette/disclosure)

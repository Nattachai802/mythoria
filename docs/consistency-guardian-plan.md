# Consistency Guardian — สถานะ + ที่เหลือ

ตรวจความขัดแย้งเชิงโครงสร้างทั้งเล่ม (deterministic, ไม่ใช้ LLM)
ไฟล์: [`server/consistency-guardian.ts`](../server/consistency-guardian.ts) · [`components/project/consistency-guardian-panel.tsx`](../components/project/consistency-guardian-panel.tsx) · mount: หน้า analytics ราย project

## เสร็จแล้ว
- ✅ check **"ตายแล้วยังปรากฏ"** — `status='dead'` (state) vs `chapterCharacters` เทียบ `orderIndex` ล้วน
- ✅ resurrection: มี state ไม่ใช่ dead ในบทหลังบทตาย → ข้ามตัวนั้น
- ✅ panel กดตรวจเอง (manual) + ลิงก์ไปบท

## ที่เหลือ
- ⬜ **verify รันจริง** — ยังไม่เทสต์กับ novel ที่มีตัวละครตาย+ปรากฏบทถัดมา
- ⬜ resurrection แบบ range (เตือนเฉพาะช่วงตาย→ก่อนฟื้น) — ตอนนี้ฟื้นแล้วข้ามทั้งตัว · ทำเมื่อมีเคสตาย-ฟื้นหลายรอบ
- ⬜ check **"ใช้พลังก่อนได้"** — *ยังไม่พร้อม*: `characterPowers.startChapterId` optional (มักว่าง) + `abilitiesUsed` free-text ไม่ผูก powerId (fuzzy). ทำได้แค่ soft warning ไม่ใช่ error · รอข้อมูลผูก powerId หรือยอมรับ noise
- ⬜ check **faction timeline** — `characterFactions.start/endChapterId` มี แต่ "ทำตัวเป็นสมาชิก" ไม่ได้บันทึกเชิงโครงสร้าง → ข้ามจนกว่าจะมี signal

## หลักการ
ต้อง **เชื่อถือได้** — ใส่เฉพาะ check ที่ structured จริง (enum/FK) เป็น error · check fuzzy ทำได้แค่ warning หรืออย่าทำ (กันผู้ใช้เลิกเชื่อทั้งระบบ)

---

## ค้างจาก session เดียวกัน (ยังไม่ verify รันจริงทั้งหมด)
librarian · ePub export · A5 page view · account analytics · references rebuild-on-sync · WorldBuilding modal→sheet (P1.2)
- ⬜ P1.2 ต่อ: Characters dialogs (27) + P2 polish (emoji→icon, ยุบ chrome) — ดู [`ux-improvement-plan.md`](./ux-improvement-plan.md)

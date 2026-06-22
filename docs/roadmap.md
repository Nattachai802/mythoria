# Mythoria — Roadmap ฟีเจอร์ถัดไป

> รวมไอเดียที่จะต่อยอด **หลังวาง Context Fabric + Stylometry เสร็จ**
> หลักการเดิม: statistical/deterministic ก่อน LLM · manual/on-demand (ผู้เขียนคุม) · additive ไม่พังของเก่า

---

## วิธีอ่านตารางนี้
- **Value** = ผู้ใช้ได้ประโยชน์แค่ไหน
- **Effort** = งานมากแค่ไหน
- **ใช้ของเดิม** = ต่อยอดสิ่งที่มีอยู่แล้ว (ยิ่งเยอะ = ทำเร็ว)

---

## 🎯 กลุ่ม A — ใช้พลัง Context Fabric (graph เชื่อมทุกโมดูล)

### A1. Consistency Guardian — ตรวจความสอดคล้องข้ามโมดูล ⭐ เรือธง
ตัวที่ทำให้ "การเชื่อมทุกอย่างเข้าด้วยกัน" จ่ายเงินคืน
- เดิน reference graph + agent เดิม (`check-timeline`, `validate-character`) จับความขัดแย้ง:
  - ตัวละครอยู่ 2 ที่พร้อมกัน
  - ใช้พลังก่อนได้รับมัน
  - lore ขัดกันเอง
  - ตัวละครตายแล้วยังปรากฏ
- **Value: สูงมาก · Effort: กลาง-สูง · ใช้ของเดิม: graph + agents + character states + timeline**

### A2. Promise Ledger อัตโนมัติ — ปม setup → payoff
- relation `foreshadows` / `pays_off` **จองไว้ใน vocab แล้ว** (รอใช้พอดี)
- สแกนหา "ปมที่ปลูกไว้แต่ลืมเฉลย" → เตือนนักเขียน
- **Value: สูง · Effort: กลาง · ใช้ของเดิม: references + plot board**

---

## 📖 กลุ่ม B — เปลี่ยน data เป็นของมีค่า

### B1. Story Codex — สร้าง story bible อัตโนมัติ
- รวม references + entities → wiki นิยายที่ navigate ได้ (ตัวละคร → ความสัมพันธ์ → สถานที่ → lore → พลัง)
- export ให้ทีม/ผู้อ่าน หรือใช้เป็น quick-reference ตอนเขียน
- **Value: สูง · Effort: ต่ำ-กลาง · ใช้ของเดิม: เกือบทั้งหมด (แค่จัดแสดง)**

### B2. Global Librarian — ถามนิยายได้ทั้งแอป
- ตอนนี้ Librarian (Graph RAG Q&A) อยู่แค่หน้า World Graph → ยกเป็น command palette ทั้งแอป
- "ใครฆ่า X?", "พลังนี้กฎอะไร?" ถามได้จากทุกหน้า
- **Value: กลาง-สูง · Effort: ต่ำ · ใช้ของเดิม: Graph RAG พร้อมแล้ว แค่ย้ายที่วาง**

---

## 🔬 กลุ่ม C — Stylometry เจาะลึก (ต่อจาก Patch 2.5 #1-2 ที่ทำแล้ว)

### C1. Echo / คำซ้ำใกล้ๆ detector ⭐ คุ้มสุดต่อ effort
- จับคำ/วลีเดียวกันที่โผล่ซ้ำในระยะใกล้ (เธอ...เธอ...เธอ / "นั่นเอง" รัวๆ) — ปัญหาคลาสสิก web novel ไทย
- statistical ล้วน (หา n-gram ซ้ำใน window) → ไฮไลต์ให้แก้
- **Value: สูง · Effort: ต่ำ · ของใหม่ ไม่แตะ pipeline อื่น**

### C2. Character Voice Distance — "ตัวละครเสียงเหมือนกันเกินไป"
- ทำ per-character particle fingerprint เป็นเวกเตอร์ → วัดระยะห่างระหว่างตัวละคร
- 2 ตัวพูดเหมือนกันเกิน = เสียงไม่แตกต่าง (ปัญหาการเขียน) → แปะที่หน้า character ผ่าน references
- **Value: สูง · Effort: กลาง · ใช้ของเดิม: ParticleAnalyzer + references** (= synergy stylometry × Context Fabric)

### C3. Pacing Heatmap ทั้งเล่ม
- เอา sentence-rhythm curve ทุกตอนมาเรียงเป็น heatmap → เห็นในแวบเดียวว่าเล่มไหนอืด/รัว
- **Value: กลาง-สูง · Effort: ต่ำ · ใช้ของเดิม: rhythm curve ที่เพิ่งทำ**

### C4. แกนวิจัยที่เหลือ (ตาม stylometry-deepening-plan.md)
- Function-word profile + **Burrows's Delta** (มาตรฐาน authorship)
- **Rolling-window drift** — ชี้จุดสไตล์เพี้ยนระดับย่อหน้า (จับ AI แทรก / ghostwriter)
- POS n-gram · Emotional arc
- **Value: กลาง-สูง · Effort: กลาง-สูง**

### C5. ของเสริมเล็ก
- Thai readability score (รวม sentence/word length + MTLD → "ความยากในการอ่าน" เล็งกลุ่มเป้าหมาย)
- Dialogue vs narration rhythm แยกกัน (บทพูดควรกระชับ บรรยายควรไหล)

---

## ลำดับที่แนะนำ

| รอบ | ทำอะไร | เหตุผล |
|-----|--------|--------|
| ตอนนี้ | C1 Echo detector | เร็ว เห็นผล ผู้ใช้ได้ทันที |
| ถัดไป | C4 (function-word) → C2 voice distance | ปูทางให้ stylometry ลึกขึ้น + เชื่อม Context Fabric |
| พีคของ session | **A1 Consistency Guardian** | payoff จริงของทั้งสถาปัตยกรรม |
| เก็บของหวาน | B1 Story Codex · B2 Global Librarian | เปลี่ยน data ที่มีเป็นของใช้จริง |

## นอก scope (ยึดตาม vision)
- LLM-based style analysis (คงสถิติล้วน)
- real-time analysis ระหว่างพิมพ์ (คง manual/on-demand)
- RAG auto-sync (manual by design — ผู้เขียนคุมว่าจะให้ AI เห็นอะไรเมื่อไหร่)

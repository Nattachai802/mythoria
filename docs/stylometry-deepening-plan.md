# Stylometry Deepening — แผนยกระดับการวิเคราะห์ลีลาการเขียน (Patch 2.5)

> เป้าหมาย: เปลี่ยนการวิเคราะห์สไตล์จาก **"รูปนิ่ง 1 ใบต่อตอน"** (ตัวเลขสรุปหยาบ + ป้ายอารมณ์ heuristic)
> ให้เป็น **"วิดีโอ + ลายนิ้วมือ"** (เส้นโค้งตลอดตอน + โปรไฟล์เวกเตอร์ระดับงานวิจัย)
> ยังเป็น **statistical NLP ล้วน** (PyThaiNLP) — ไม่ใช้ LLM, deterministic, อธิบายได้

## ปัญหาของระบบปัจจุบัน

โมดูลปัจจุบัน ([`pythonservice/stylometry.py`](../pythonservice/stylometry.py), [`author_fingerprint_discovery.py`](../pythonservice/author_fingerprint_discovery.py)) ครอบ 4 มิติ — feature-rich แต่แต่ละมิติคือ **scalar เดียว/ตอน**:

| มิติ | ตอนนี้ | จุดอ่อน |
|------|--------|---------|
| ① Pacing & Mood | นับ `…!?` density → ป้ายอารมณ์ | หยาบ — pacing จริงอยู่ที่จังหวะประโยค ไม่ใช่จำนวนเครื่องหมาย |
| ② Author Voice | นับสรรพนาม (PPRS) | signal จิ๋ว — ลายเซ็นจริงอยู่ที่ function words ทั้งชุด |
| ③ Character Vibes | นับ particle จัดกลุ่ม | ดีแล้ว แต่หยุดที่นับ ไม่วัดระยะห่างระหว่างตัวละคร |
| ④ Lexical + Anatomy | **TTR** + avg ประโยค + ratio บทพูด | **TTR มีจุดบกพร่องเชิงวิธีการ** (ลดตามความยาวเสมอ) |
| Fingerprint | 5 features → z-score | เปราะ — ใช้ค่า macro แค่ 5 ตัว |

---

## การยกระดับ — รายมิติ

### ① Pacing → Sentence-Rhythm Curve
จังหวะเรื่องอยู่ที่ **ลีลาความสั้น-ยาวของประโยค** (action = สั้นรัว, บรรยาย = ยาวไหล) ไม่ใช่จำนวน `!`

- พล็อต **เส้นความยาวประโยคตลอดตอน** → "จังหวะหัวใจ" ของเรื่อง (tension curve จริง)
- เพิ่ม **variance / burstiness** (สั้น-สั้น-ยาว) เป็น metric
- จังหวะสลับ **บทพูด ↔ บรรยาย** (alternation rhythm)
- reuse `sent_tokenize` + `DialogExtractor.span` ที่มีอยู่แล้ว

### ② Author Voice → Function-Word Profile
ลายเซ็นนักเขียนซ่อนใน **คำเล็กที่ใช้โดยไม่รู้ตัว** (และ/ที่/ก็/นะ/แล้ว) — topic-independent, จับได้แม่นกว่าคำใหญ่
*(เปรียบเหมือนลายมือ — เขียนตัว "ก" ออกมาเองโดยไม่คิด)*

- สร้าง **function-word frequency vector** เต็มชุด (คำเชื่อม/บุพบท/ลักษณนาม/particle)
- เก็บเป็นโปรไฟล์ผู้แต่ง → ใช้เป็น input ของ Burrows's Delta (ดูส่วนสถาปัตยกรรม A)

### ③ Character Vibes → Inter-Character Distance
- ทำ **per-character particle fingerprint** เป็นเวกเตอร์
- วัด distance ระหว่างตัวละคร → ตัวละคร 2 คนที่พูดเหมือนกันเกินไป = "เสียงไม่แตกต่าง" (ปัญหาการเขียน)
- localize ตอนที่เสียงตัวละคร drift (ต่อยอด `track_character_voice` เดิม)

### ④ Lexical → MTLD / MATTR แทน TTR
**TTR ลดลงตามความยาวเสมอ** → เทียบตอนยาว-สั้นไม่แฟร์
*(เหมือนตัดสินว่าใครมีสีเยอะจากการนับสีในรูป — คนวาดรูปใหญ่ย่อมใช้สีซ้ำมากกว่า)*

- ใช้ **MATTR** (moving-average TTR, วัดเป็นช่วงแล้วเฉลี่ย) หรือ **MTLD** — ทนต่อความยาว
- เพิ่ม **hapax ratio** (คำที่โผล่ครั้งเดียว) + **ความยาวคำเฉลี่ย** (พยางค์ → register)

---

## การยกระดับ — สถาปัตยกรรม

### A. Burrows's Delta (แทน 5-feature z-score)
มาตรฐาน authorship attribution: z-score ของความถี่ function word ทั้งชุด + ระยะ Manhattan
- แข็งกว่า fingerprint ปัจจุบัน (5 ค่า macro) มาก
- ต่อยอด `AuthorFingerprint` — ขยาย `FEATURE_CONFIG` จาก 5 macro → function-word vector

### B. Rolling / Windowed Analysis — localize จุดเพี้ยน ⭐
ตอนนี้บอกได้แค่ "ตอนที่ 5 สไตล์หลุด" แต่ชี้ไม่ได้ว่าย่อหน้าไหน
*(เหมือนหมอบอก "ร่างกายผิดปกติ" แต่ชี้ไม่ได้ว่าเจ็บตรงไหน)*

- เลื่อน **sliding window** ในตอน วิเคราะห์ทีละช่วง
- ชี้ได้ระดับย่อหน้า: "ย่อหน้า 4-6 สไตล์ต่างจากรอบๆ" → จับ AI แทรก / ghostwriter ได้แม่น

### C. POS n-gram Profile
ลำดับชนิดคำ (คุณศัพท์-นาม-กริยา) จับ "ไวยากรณ์เชิงสไตล์" — adjective-heavy vs verb-heavy
- reuse `pos_tag` (perceptron/orchid) ที่มีอยู่

### D. Emotional Arc
- sentiment lexicon ไล่ตลอดตอน → เส้นอารมณ์จริง (แทน vibe จากเครื่องหมาย)
- **sensory-word density** (ภาพ/เสียง/สัมผัส) → วัด "showing" เชิงปริมาณ

---

## ลำดับการทำ (impact ต่อ effort)

| # | งาน | สถานะ |
|---|-----|--------|
| 1 | MTLD/MATTR แทน TTR | ✅ เสร็จ |
| 2 | Sentence-rhythm curve (①) | ✅ เสร็จ |
| 3 | Function-word profile + Burrows Delta (②+A) | ✅ เสร็จ (dashboard คำนวณ Burrows Δ ข้ามตอน) |
| 4 | Rolling window drift localization (B) | ✅ เสร็จ (แถบ drift ในการ์ดตอน) |
| 5 | **POS n-gram (C) + Emotional arc (D)** | ⬜ ยังไม่ทำ — งานที่เหลืออันเดียว |

> เหลือแค่ **#5** (POS n-gram + Emotional arc) — reuse `pos_tag` + sentiment lexicon, nest ใน chapterAnatomy JSONB ตาม pattern เดิม

---

## จุดที่ต้องแก้ (ไฟล์)

| ชั้น | ไฟล์ | งาน |
|------|------|-----|
| วิเคราะห์ | [`pythonservice/stylometry.py`](../pythonservice/stylometry.py) | เพิ่ม MATTR/MTLD, rhythm curve, function-word vector, rolling window |
| fingerprint | [`pythonservice/author_fingerprint_discovery.py`](../pythonservice/author_fingerprint_discovery.py) | ขยาย `FEATURE_CONFIG` → Burrows Delta |
| endpoint | `pythonservice/main.py` | คืน field ใหม่ใน `/analyze-chapter-style` |
| wire | [`server/stylometry.ts`](../server/stylometry.ts) | รับ + เก็บ field ใหม่ |
| schema | `noteStylometry` / `chapterStylometry` (JSONB) | เก็บ curve/vector เพิ่ม (additive, ไม่ต้อง migrate ถ้าใช้ JSONB เดิม) |
| UI | [`components/analytics/stylometry-dashboard.tsx`](../components/analytics/stylometry-dashboard.tsx) | แสดง curve (line chart) + drift heatmap ระดับย่อหน้า |

## หลักการที่ยึด
- **statistical ล้วน ไม่ใช้ LLM** — สอดคล้องกับ stylometry เดิม (เร็ว, deterministic, โปร่งใส)
- **additive** — เพิ่ม field ใน JSONB ที่มีอยู่ ไม่ลบของเดิม ผลเก่ายัง render ได้
- **tuning ภาษาไทย** — function-word list, sensory lexicon, sentiment ต้องคัดสำหรับไทย

## นอก scope (รอบนี้)
- เปลี่ยนไป LLM-based style analysis
- cross-author attribution (เทียบกับนักเขียนคนอื่นนอกระบบ)
- real-time analysis ระหว่างพิมพ์ (คง manual/on-demand ตาม vision)

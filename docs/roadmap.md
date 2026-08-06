# Mythoria — Roadmap ฟีเจอร์ถัดไป

> หลักการเดิม: statistical/deterministic ก่อน LLM · manual/on-demand (ผู้เขียนคุม) · additive ไม่พังของเก่า

---

## ✅ เสร็จแล้ว (อ้างอิง)
- Context Fabric L0+L1 + **Phase 4 dual-write (8 junctions)** — ดู [`context-fabric-plan.md`](./context-fabric-plan.md)
- Stylometry #1-#4 (MTLD/MATTR, rhythm, Burrows Δ, rolling drift) — ดู [`stylometry-deepening-plan.md`](./stylometry-deepening-plan.md)
- C1 Echo detector · C2 Voice distance · C3 Pacing heatmap
- B1 Story Codex (`/codex`) · B2 Global Librarian (ถามในcommand palette)
- A1 Consistency Guardian — check "ตายแล้วยังปรากฏ" (resurrection-aware)

---

## ✅ เพิ่งเสร็จ
- Stylometry #5 — POS n-gram (ไวยากรณ์เชิงสไตล์) + Emotional arc (เส้นอารมณ์ + sensory density) — ดู [`stylometry-deepening-plan.md`](./stylometry-deepening-plan.md)

## ⬜ ยังไม่ทำ (unblocked — ทำได้เลย)

### รื้อระบบรีวิวรายตอน (stylometry + NarraBench)
**แผนเต็มอยู่ที่ [`chapter-review-redesign.md`](./chapter-review-redesign.md)**

ปัญหา: persona 5 ตัวต่างกันแค่น้ำเสียง ได้ input เดียวกัน (ตัดมา 3000 ตัวอักษร) และ
`server/rag.ts` ดึง context ด้วยความคล้ายโดยไม่กรอง `orderIndex` — รีวิวบท 5 จึงเห็นบท 20 ได้
เท่ากับ AI รู้ตอนจบแล้ว ประเมินความลุ้น/ความสงสัยไม่ได้

ทางแก้: ใช้รหัส SMV ของ NarraBench เป็นตัวจ่ายงานว่าคำถามไหนตอบด้วยตัวเลข (stylometry/SQL)
คำถามไหนต้องใช้ LLM — ปรากฏว่า 3 ใน 4 ของผลลัพธ์ที่อยากได้เป็น SQL ล้วน เพราะ
`noteStylometry` กับ `plotThreads` มีข้อมูลครบอยู่แล้ว แค่ไม่เคยถูกส่งเข้า prompt รีวิว

**เริ่มจากข้อ 1-3 ได้เลย ไม่ต้องแตะ LLM**

---

### C5 — ของเสริมเล็ก (stylometry)
- Thai readability score (sentence/word length + MTLD → "ความยากในการอ่าน")
- Dialogue vs narration rhythm แยกกัน (บทพูดควรกระชับ บรรยายควรไหล)
- **Effort: ต่ำ-กลาง**

### Context Fabric Phase 5-7 (epic)
- Phase 5: @-mention ใน editor → Phase 6: graph/agent อ่าน references → Phase 7: drop junction เก่า
- รายละเอียด: [`context-fabric-plan.md`](./context-fabric-plan.md)

### ย้าย vector store: LanceDB → ? — **พักไว้ รอ AI algorithm นิ่งก่อน**
**แผนเต็มอยู่ที่ [`task.md`](../task.md)**

กำลังจะรื้อ algorithm วิเคราะห์เนื้อเรื่องครั้งใหญ่ และการเลือก vector store เป็นการตัดสินใจ *ปลายน้ำ*
ของ algorithm นั้น — chunk ขนาดไหน, embedding model ตัวไหน (768 มิติยังใช่ไหม), 1 entity = 1 vector
หรือหลายตัว, ต้อง join กับ graph/references ตอน retrieve ไหม คำตอบพวกนี้เปลี่ยนได้หมด
ย้ายตอนนี้ = ตัดสินใจทั้งที่ยังไม่รู้โจทย์ แล้วอาจต้องย้ายซ้ำ

LanceDB บนดิสก์ **ไม่เจ็บตอน dev** — มันเจ็บเฉพาะตอนจะ deploy Python เท่านั้น เลยเลื่อนไปพร้อมกัน

**เมื่อถึงเวลาตัดสินใจ ค่าตั้งต้นคือ pgvector บน Neon ไม่ใช่ Upstash Vector**
เหตุผลคือ*สถาปัตยกรรม* และยังจริงแม้จะไว้ใจทุกเจ้าเต็มร้อย — Upstash ผ่านทุกข้อทางเทคนิค
(768 มิติที่เรา generate เอง, cosine, filter, namespace, free tier เหลือเฟือ, มี Python SDK)
แต่มันแค่ย้าย vector จากดิสก์ไป cloud **ไม่ได้แก้ปัญหาที่เขียนไว้ข้างล่างว่าเป็นต้นเหตุ** คือข้อมูลอยู่ 2 ที่
แล้วไม่มีอะไรบังคับให้ sync กัน ส่วน Neon ได้ FK cascade + join เดียวจบ + เหลือ store เดียว

> **แก้เหตุผลเดิม:** ตรงนี้เคยเขียนว่าส่งไป Upstash = "ต้นฉบับที่ยังไม่เผยแพร่ออกไปอยู่เซิร์ฟเวอร์บริษัทอื่น"
> — **ไม่จริง** ต้นฉบับอยู่นอกเครื่องมาตลอด: Neon ถือทั้งหมด, Vercel ประมวลผลทุก request,
> Gemini/Groq/Typhoon ได้รับเนื้อบททุกครั้งที่เรียก AI
> ที่เหลือจริงคือเรื่อง*ส่วนเพิ่ม* — ใส่ไว้ Neon เพิ่มบริษัทที่ถือต้นฉบับ **0 ราย** ส่วน Upstash เพิ่ม **1 ราย**
> (ToS อีกฉบับ, ช่องรั่วอีกทาง, เขตอำนาจศาลอีกที่) เป็นเรื่องระดับ ไม่ใช่เส้นแบ่งขาว-ดำอย่างที่เขียนไว้เดิม
> เวลาชั่งน้ำหนักผู้ให้บริการรายอื่นในอนาคต (เช่น Longdo spell-check API) ให้ใช้กรอบนี้

ปัญหาปัจจุบัน: เวกเตอร์อยู่ใน `vector-db/*.lance` (ไฟล์บนดิสก์ของเครื่องที่รัน Python) ส่วนข้อมูลจริงอยู่ Neon
- Vercel เขียนไฟล์ไม่ได้ + หายทุก deploy → Python ต้อง deploy แยกตลอดไป
- ไม่มีอะไรบังคับให้สองที่ sync กัน — ลบโน้ตแล้ว embedding ค้าง เลยต้องมีปุ่ม "ซิงค์ฐานข้อมูล AI" ให้กดเอง
- backup 2 ที่

ถ้าย้าย: `CREATE EXTENSION vector` บน Neon → embedding เป็นคอลัมน์ในตาราง → ลบโน้ตแล้ว embedding หายตาม FK cascade,
GraphRAG join กับ `references` ได้ใน query เดียวไม่ต้องข้ามเน็ต, ตัด endpoint `/search` `/sync` `/status` ทิ้ง

**Python ยังอยู่** — อีก ~20 endpoint (stylometry, spell check, plot hole) ต้องใช้ตัดคำไทย (pythainlp/attacut) อยู่ดี
**Effort: 1-2 วัน** (เขียน embedding pipeline ฝั่ง Node + backfill ข้อมูลเดิม)

---

## นอก scope (ยึดตาม vision)
- LLM-based style analysis (คงสถิติล้วน)
- real-time analysis ระหว่างพิมพ์ (คง manual/on-demand)
- RAG auto-sync (manual by design — ผู้เขียนคุมว่าจะให้ AI เห็นอะไรเมื่อไหร่)

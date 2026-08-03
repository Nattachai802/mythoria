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

### C5 — ของเสริมเล็ก (stylometry)
- Thai readability score (sentence/word length + MTLD → "ความยากในการอ่าน")
- Dialogue vs narration rhythm แยกกัน (บทพูดควรกระชับ บรรยายควรไหล)
- **Effort: ต่ำ-กลาง**

### Context Fabric Phase 5-7 (epic)
- Phase 5: @-mention ใน editor → Phase 6: graph/agent อ่าน references → Phase 7: drop junction เก่า
- รายละเอียด: [`context-fabric-plan.md`](./context-fabric-plan.md)

### ย้าย vector store: LanceDB → pgvector บน Neon
**ทำตอนย้าย VPS จริง** (ตอนนั้นต้องแตะ deploy ของ Python อยู่แล้ว ทำทีเดียวจบ) ไม่ต้องรีบก่อนหน้านั้น

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

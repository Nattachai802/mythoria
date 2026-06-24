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

## ⬜ ยังไม่ทำ (unblocked — ทำได้เลย)

### Stylometry #5 — POS n-gram + Emotional arc
- ลำดับชนิดคำ (adjective/verb-heavy) + เส้นอารมณ์จาก sentiment lexicon + sensory-word density
- reuse `pos_tag` ที่มี · nest ใน chapterAnatomy JSONB ตาม pattern เดิม
- **Effort: สูง · ไม่แตะ pipeline อื่น**

### C5 — ของเสริมเล็ก (stylometry)
- Thai readability score (sentence/word length + MTLD → "ความยากในการอ่าน")
- Dialogue vs narration rhythm แยกกัน (บทพูดควรกระชับ บรรยายควรไหล)
- **Effort: ต่ำ-กลาง**

### Context Fabric Phase 5-7 (epic)
- Phase 5: @-mention ใน editor → Phase 6: graph/agent อ่าน references → Phase 7: drop junction เก่า
- รายละเอียด: [`context-fabric-plan.md`](./context-fabric-plan.md)

---

## นอก scope (ยึดตาม vision)
- LLM-based style analysis (คงสถิติล้วน)
- real-time analysis ระหว่างพิมพ์ (คง manual/on-demand)
- RAG auto-sync (manual by design — ผู้เขียนคุมว่าจะให้ AI เห็นอะไรเมื่อไหร่)

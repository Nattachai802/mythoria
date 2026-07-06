# Story Bible Import — Auto-create นิยาย (Task/Spec)

> ผู้ใช้วางเอกสาร Story Bible (README/markdown) ตอนสร้างนิยายใหม่ → AI **สกัด** เป็น entity พื้นฐาน
> → ผู้ใช้ review → ยืนยัน → สร้างข้อมูลทั้งหมดในโปรเจกต์ใหม่ให้พร้อมเขียนทันที

## Decisions (เคาะแล้ว)

| ประเด็น | มติ |
|---|---|
| ขอบเขต AI | **สกัดอย่างเดียว** — ไม่แต่งเพิ่ม ไม่เติมช่องว่าง (ตรงกับ vision ผู้ช่วยเดิม "ห้ามคิดแทน") ช่องที่เอกสารไม่ระบุ = เว้นว่าง |
| จุด import | **เฉพาะตอนสร้างนิยายใหม่** — ไม่ทำ import เข้านิยายที่มีอยู่ (รอบแรก) |
| ยืนยัน | ต้อง review ทีละรายการก่อนเขียน DB เสมอ (safety net เพราะ model เล็ก) |

## ของที่มีอยู่แล้ว (reuse — ไม่สร้างใหม่)

- **`server/assistant.ts`** — pipeline `proposal → applyProposal` (LLM + Groq function-calling → ร่าง → ยืนยัน → เขียนจริง)
- **`CRUD_FORMAT`** (`server/registry/entity-registry.ts`) — 8 ชนิด: character, location, faction, power, item, lore, idea, plotThread. key = ชื่อคอลัมน์ → เขียนตรงเข้าตาราง
- **`createEntityRow`** — generic insert
- **`autoLinkFactions(novelId, [{name, parentName?, leaderName?}])`** — resolve ชื่อ→id ตั้ง parentFactionId/leaderId (สร้างเสร็จแล้ว รอ caller)
- **`references` (Context Fabric)** — graph edge สำหรับผูกความสัมพันธ์ข้าม entity

## Entity mapping (จากตัวอย่าง bible)

| ในเอกสาร | ลงเป็น |
|---|---|
| ตัวละครหลัก/รอง, ผีบรรพกาล, เพื่อน | character |
| กปธ., 13 ตระกูล, ตระกูลนอกกฎหมาย, สำนัก, สภา, แผนก | faction (+ hierarchy + status/alignment) |
| เพลิงบรรพกาล, ระบบธาตุ, ยศ, ลำดับชั้นผี, เกรดอาวุธ | power |
| บ้านร้าง, กทม./ปริมณฑล/ภูมิภาค | location |
| 5 มหาศาสตรา, สัตตโลหะ | item |
| ประวัติตระกูล, กระบวนการปราบผี, ธาตุเจ้าเรือน | lore |
| ปมพ่อหาย, เพื่อนเสียสติ, ต้นกำเนิดร่วม | plotThread |
| 3 Phases (ขยายสเกล) | storyArc / timelineEvent (ภายหลัง) |

## Phases

### Phase 1 — Batch extract engine
- `extractBible(novelId, markdown)` ใน `server/assistant.ts`
  - แบ่งเอกสารตามหัวข้อ `##` (regex) → สกัดทีละ section (bible จริง ~28k tokens เกินขีด model เดียว)
  - ต่อ section: prompt "สกัด entity จากข้อความนี้เท่านั้น ห้ามแต่ง" → JSON array `{entityType, fields}`
  - รวมผล → **dedupe ตามชื่อ** (เช่น "อัคนีศวร" โผล่หลายที่)
  - reuse `buildView()` → คืน `Proposal[]`
- ใช้ JSON output mode (ง่ายกว่า function-calling ตอนคืนหลายรายการ), prompt แยกจากผู้ช่วยเดิม
- **Checkpoint:** เทสกับ bible ไฟล์จริงก่อนลงทุนทำ UI — ดูคุณภาพการสกัดของ model

### Phase 2 — Review UI
- `bible-review.tsx` — โชว์ `Proposal[]` จัดกลุ่มตามชนิด (ตัวละคร N · ฝ่าย N · พลัง N …)
- ต่อการ์ด: ติ๊กเปิด/ปิด, แก้ field inline (reuse `ProposalDetail`)
- group + collapse (bible อาจได้ 50+ entity — กันตาลาย)
- ปุ่ม "สร้างทั้งหมด" → loop `applyProposal` เฉพาะที่ติ๊ก

### Phase 3 — เสียบ flow สร้างนิยาย
- หน้าสร้าง novel: textarea/upload `.md` (optional) + toggle "เตรียมข้อมูลจาก Story Bible"
- สร้าง novel → ถ้ามี bible → เด้งเข้าหน้า review → ยืนยัน → เข้าโปรเจกต์พร้อมข้อมูล

### Phase 4 — ผูกความสัมพันธ์ข้าม entity
- หลังสร้าง entity ครบ → เรียก **`autoLinkFactions`** (parent/leader) + สร้าง `references` edges
- แก้ปัญหา chicken-egg: สร้าง entity ทั้งหมดก่อน แล้ว resolve ชื่อ→id ทีเดียวตอนท้าย
- ขยาย pattern เดียวกันไปยัง character relationships, power↔character (wields) ฯลฯ

## ความเสี่ยง / ต้องระวัง

1. **Model เล็ก (llama-4-scout)** อาจสกัดพลาด → review ต่อการ์ดคือ safety net; ถ้าไม่พอค่อยสลับ model เฉพาะงาน extract
2. **จำนวนร่างเยอะ** → review UI ต้อง group + collapse
3. **field เป็น text ล้วน** → entity ซับซ้อน (power level/combination) ได้แค่ description ก่อน
4. **ความสัมพันธ์ข้าม entity** แยกเป็น Phase 4 (Phase 1–3 สร้างแต่ตัว entity)
5. **CRUD_FORMAT ยังไม่ครบทุก field** (lore ได้แค่ title/type/content; ตารางจริงมีมากกว่า) — ขยายเมื่อจำเป็น

## ลำดับทำ (แนะนำ)

Phase 1 (engine + เทสจริง) → Phase 2 (review) → Phase 3 (flow) = MVP ใช้งานได้ → Phase 4 (ผูกความสัมพันธ์)

## Dependencies ที่พร้อมแล้ว

- ✅ Faction overhaul (schema hierarchy/status/alignment + `autoLinkFactions`) — คอขวดหลักปลดแล้ว
- ✅ Context Fabric references layer (P4 dual-write)
- ✅ proposal/applyProposal pipeline

# Mythoria บรรณารักษ์ (Librarian) — แผน implementation

> ผู้ช่วยถาม-ตอบเกี่ยวกับนิยาย ด้วย Graph RAG ที่มีอยู่แล้ว
> อยู่บนหน้า World Graph + โชว์ traversal บนกราฟจริง

## หลักการ (เข้า vision)

- **Manual / opt-in** — ผู้ใช้เปิดเอง พิมพ์ถามเอง ไม่มี auto (ดู [[ai-is-opt-in-manual]])
- **ตอบจาก canon เท่านั้น** — LLM ตอบจากบริบทที่ retrieval ให้ ห้ามแต่งเพิ่ม ไม่มีให้บอกตรงๆ
- **โปร่งใส** — ทุกคำตอบโชว์ source + ไฮไลต์บนกราฟว่าดึงจากโหนดไหน

## การตัดสินใจที่เคาะแล้ว

| ประเด็น | เลือก |
|--------|-------|
| ที่อยู่ | หน้า World Graph (`/dashboard/project/[id]/graph`) |
| รูปแบบ | panel docked ขวา (พับได้) · จอแคบ → overlay |
| การสนทนา | chat หลายเทิร์น **เก็บลง DB** · v1 เธรดเดียวต่อนิยาย |
| traversal viz | **vector-led** — search hit เป็นแกน (สดเสมอ), graph neighbor เป็นของแถม |

## reuse map (ของเดิมเกือบครบ)

| ชิ้น | ไฟล์ | สถานะ |
|------|------|-------|
| Graph RAG retrieval | `server/rag.ts` `retrieveContext` | ✅ มีแล้ว |
| ask + LLM + sources | `server/librarian.ts` `askLibrarian` | ✅ สร้างแล้ว (รอบนี้) |
| กราฟ + node `type:id` | `components/project/world-graph.tsx`, `server/graph.ts` | ✅ มีแล้ว |
| entity resolve + href | `server/registry/entity-registry.ts` | ✅ มีแล้ว |
| LLM keys (Groq/Typhoon) | `.env` | ✅ มีแล้ว |

## ของใหม่ที่ต้องสร้าง

### 1. DB — เก็บเธรดสนทนา (additive, ไม่แตะ normalization ที่พักไว้)
```ts
// db/schema.ts
export const librarianMessages = pgTable("librarian_messages", {
  id: text().primaryKey().default(sql`gen_random_uuid()`),
  novelId: text().notNull().references(() => novels.id, { onDelete: "cascade" }),
  role: text().notNull(),            // "user" | "assistant"
  content: text().notNull(),
  sources: jsonb(),                  // LibrarianSource[] (เฉพาะ assistant)
  createdAt: timestamp().defaultNow().notNull(),
}, (t) => ({ novelIdx: index("librarian_msg_novel_idx").on(t.novelId) }));
```
- `db:push` (additive) + pg_dump ก่อน

### 2. Server actions (`server/librarian.ts` ต่อจากของเดิม)
- `getLibrarianThread(novelId)` → message[] เรียงเวลา
- `askLibrarian` (มีแล้ว) → ปรับให้ **บันทึก user + assistant message** ลง DB ก่อน return
- `clearLibrarianThread(novelId)` → ล้างเธรด (กันคำตอบผิดค้างถาวร)

### 3. Panel UI (`components/project/librarian-panel.tsx`)
- chat log (user/assistant bubbles) + source chips คลิกได้ (`href` จาก action)
- ช่องพิมพ์ + ปุ่มส่ง + loading
- empty state: แยก "ยังไม่ sync" vs "service ล่ม" (ดู risk #3)
- ปุ่มล้างเธรด + เวลา sync ล่าสุด
- callback `onSources(sources)` → ส่ง node ที่ใช้ตอบกลับหน้า graph

### 4. Traversal highlight (`world-graph.tsx`)
- เพิ่ม prop `highlight?: { search: string[]; graph: string[] }` (node key `type:id`)
- apply ผ่าน **paint callback อ่านจาก ref** ไม่แตะ data prop (กัน re-layout — risk #4)
- search hit = เรืองทอง (จุดเริ่ม) · graph neighbor = ขอบไฮไลต์ · ที่เหลือหรี่
- ไฮไลต์ search ทันทีที่ retrieval เสร็จ (ก่อน LLM ตอบ — risk #5)

### 5. หน้า graph เป็น split layout (`graph/page.tsx`)
- กราฟ (ซ้าย ยืด) + librarian panel (ขวา ~360px พับได้)
- narrow → panel เป็น overlay

## ลำดับทำ (safe, ทีละชั้น verify ได้)

1. ตาราง `librarianMessages` + `db:push` (+ backup)
2. actions `getLibrarianThread` / persist ใน `askLibrarian` / `clearLibrarianThread`
3. panel UI ต่อ action — **ใช้ได้จริงแบบ text-only ก่อน** (ยังไม่ทำกราฟ)
4. รัน Next + Python → verify ถาม-ตอบ + source chips ทำงาน
5. เพิ่ม `highlight` prop ใน world-graph (paint callback)
6. split layout + ต่อ `onSources` → highlight
7. polish: animate search→edge→neighbor, responsive, แยก error state

> ทำข้อ 3-4 ให้ใช้งานได้ก่อน (text Q&A) แล้วค่อยต่อ viz (5-7) — ได้ของใช้จริงเร็ว แล้วเสริม wow ทีหลัง

## ความเสี่ยง / ข้อจำกัด (รับรู้แล้ว)

| # | เรื่อง | mitigation |
|---|-------|-----------|
| 1 | `references` เป็น snapshot เก่า (ไม่ dual-write) → graph viz โชว์ความเชื่อมโยงเก่า/ขาด | reframe vector-led: graph เป็น bonus ไม่ใช่แกน · ระยะยาวคือทำ Phase 2 dual-write |
| 2 | vector hit ที่ไม่มี edge → ไม่มีโหนดไฮไลต์ | ยอมรับ — search node ที่มีในกราฟก็ยังสว่าง, ที่เหลือโชว์ใน chip |
| 3 | service ล่ม ปนกับ ยังไม่ sync | ให้ `retrieveContext`/health แยกสัญญาณ → ข้อความต่างกัน |
| 4 | force-graph re-layout กระตุก | highlight ผ่าน paint callback + ref เท่านั้น |
| 5 | latency หลายวิ | ไฮไลต์ search ก่อน LLM ตอบ |
| 6 | คำตอบผิดค้างถาวรใน DB | ปุ่มล้างเธรด + ถือเป็น AI ไม่ใช่ canon |
| 7 | จอแคบ | panel → overlay |

## นอก scope (รอบนี้ไม่ทำ)
- หลายห้องสนทนา (v1 เธรดเดียว/นิยาย)
- streaming คำตอบ
- dual-write references (แยกเป็นงานของมันเอง — pause อยู่)
- แก้ vector sync ให้ auto (ตั้งใจคง manual)

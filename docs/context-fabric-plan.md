# Mythoria Context Fabric — แผนสถาปัตยกรรม (Big Update)

> เป้าหมาย: เปลี่ยน Mythoria จากโมดูลที่ "เอกเทศน์ต่อกัน" ให้เป็นระบบที่ทุก module
> เชื่อมหากันลื่นไหลแบบ MCP — plot เชื่อม character note / lore / ปม ได้อิสระ

## ปัญหาที่แก้

ปัจจุบันมี 48 ตาราง เชื่อมกันด้วย junction table แบบจับคู่เฉพาะกิจ 20+ ตัว
(`noteCharacters`, `chapterCharacters`, `characterFactions`, `locationEntities`,
`characterPowers`, `ideaConnections`, ...) — ทุกความสัมพันธ์ถูก hardcode เป็นคู่ๆ
จึงไม่มี "ชั้นเชื่อมกลาง" ที่ทุกโมดูลใช้ร่วมกัน

ของที่มีอยู่แล้ว (ครึ่งหนึ่งของ MCP):
- RAG backbone: LanceDB (`content` table, multi `content_type`) + Gemini embeddings (768d) + `vector-sync-button`
- Agent + tools: `pythonservice/tool_definitions.py` (เช่น `check_timeline_conflict`)
- Graph: `server/graph.ts` — แต่เชื่อมแค่ character↔character
- ❌ ยังไม่มี mention layer / reference กลาง

## สถาปัตยกรรม "Context Fabric" (5 ชั้น)

```
L4  Context API ("MCP" gateway) — getContextFor / search / agent tools
L3  Knowledge Graph — ขยาย graph.ts → ทั้งโลก
L2  RAG / Vector — LanceDB ครอบทุก entity + auto-sync
L1  Reference Layer — 1 ตาราง แทน 20+ junction
L0  Entity Registry — abstraction เหนือ 48 ตาราง
```

## การตัดสินใจที่เคาะแล้ว

- **ขอบเขตรอบแรก**: วางรากฐาน **L0 + L1** เท่านั้น (mention/RAG/graph รอบถัดไป)
- **แหล่งสร้าง reference หลัก**: Manual `@`-mention (เป็น first-class, trust สูงสุด)
  - `@`-mention คือ UI (Phase 5) — รอบนี้ออกแบบ data model + write/read API ให้รองรับไว้ก่อน
- **Backward compat**: ปลอดภัยไว้ก่อน — backup ก่อนทุกอย่าง, ไม่ลบ junction จนกว่าจะมั่นใจ
- backfill junction เดิม flag `createdBy: 'migration'` แยกจาก `'user'` (mention จริง)

---

## L0 — Entity Registry (`server/registry/entity-registry.ts`)

```ts
type EntityType =
  | 'character' | 'location' | 'lore' | 'power' | 'faction'
  | 'item' | 'era' | 'plotThread' | 'note' | 'chapter'
  | 'entity' | 'timelineEvent' | 'idea';

interface EntityRef {
  type: EntityType;
  id: string;
  novelId: string;
  title: string;       // display name
  subtitle?: string;   // role / short desc สำหรับ dropdown
  icon?: string;
  href: string;
}

registry.resolve({ type, id })            // → EntityRef
registry.search(novelId, query, types?)   // → EntityRef[]  (mention dropdown ใช้)
```

แต่ละ type มี adapter เล็กๆ ที่รู้ว่าอ่าน title/href จากตารางไหน
→ ที่เหลือทั้งระบบไม่ต้องรู้จักตารางต้นทาง เพิ่ม type ใหม่ไม่ต้องแตะทุกที่

## L1 — Universal Reference Table (`db/schema.ts`)

```ts
export const references = pgTable('references', {
  id: uuid().primaryKey().defaultRandom(),
  novelId: uuid().notNull().references(() => novels.id, { onDelete: 'cascade' }),

  fromType: text().notNull(),   // EntityType
  fromId:   uuid().notNull(),
  toType:   text().notNull(),
  toId:     uuid().notNull(),

  relation: text().notNull(),   // ดูตาราง relation vocabulary ด้านล่าง
  context:  text(),             // ข้อความรอบ mention / คำอธิบาย
  sourceSpan: jsonb(),          // {start,end} ตำแหน่งใน rich text (ไว้ลบ ref เมื่อลบข้อความ)
  meta:     jsonb(),            // attribute ของ junction เดิม (role, level, travelTime...) — nullable

  createdBy: text().notNull().default('user'), // 'user' | 'ai' | 'migration'
  confidence: real(),           // null=manual, 0-1 สำหรับ ai
  createdAt: timestamp().defaultNow(),
}, (t) => [
  index('ref_from_idx').on(t.fromType, t.fromId),
  index('ref_to_idx').on(t.toType, t.toId),
  index('ref_novel_idx').on(t.novelId),
  uniqueIndex('ref_unique').on(t.fromType, t.fromId, t.toType, t.toId, t.relation),
]);
```

เหตุผลออกแบบ:
- **มีทิศทาง** (from→to) + `relation` → query ได้ทั้ง outgoing และ backlink
- `sourceSpan` → ลบข้อความ = ลบ reference ได้ถูกต้อง
- `createdBy` + `confidence` → แยก trust manual/ai/migration สำหรับ UI ภายหลัง

## L1 — Write/Read API (`server/references.ts`)

```ts
addReference({ from, to, relation, context?, sourceSpan? })  // upsert กัน dup
removeReference(id)  |  removeReferencesBySpan(fromId, span)
getOutgoing(entity, relation?)   // → EntityRef[] ผ่าน registry
getIncoming(entity, relation?)   // → backlinks
getContextBundle(entity)         // รวม in+out จัดกลุ่มตาม relation (L4 ต่อยอด)
```

---

---

## Relation Vocabulary (controlled) — ทิศทาง from → to

| relation | from → to | ความหมาย | ที่มา |
|---|---|---|---|
| `mentions` | content → any | @ ใน rich text (default ของ mention) | manual @ |
| `features` | note/chapter/scene → character | เนื้อหามีตัวละครนี้ร่วมแสดง (role อยู่ใน meta) | noteCharacters, chapterCharacters, scene |
| `set_in` | note/chapter/scene → location | ฉากเกิดที่สถานที่นี้ | timelineEvents.relatedLocationIds, sceneElementDetails(loc) |
| `member_of` | character → faction | สังกัด | characterFactions |
| `inhabits` | entity → location | สิ่งมีชีวิต/สัตว์อาศัยอยู่ | locationEntities |
| `wields` | character → power | ครอบครองพลัง (MIRROR) | characterPowers |
| `related_to` | character → character | ความสัมพันธ์ (MIRROR) | characterRelationships |
| `connects_to` | location → location | เส้นทางเชื่อม (MIRROR) | locationConnections |
| `combines_into` | power → power | สูตรผสม (MIRROR) | powerCombinations |
| `advances` | plotThread → timelineEvent | beat ของปม (role อยู่ใน meta) | plotThreadBeats |
| `linked_to` | idea → idea | ไอเดียเกี่ยวข้อง | ideaConnections (type=related) |
| `derived_from` | idea → idea | ไอเดียต่อยอด | ideaConnections (type=ancestor) |
| `located_in` | location → location | ลำดับชั้นสถานที่ | locations.parentLocationId |
| `grouped_in` | lore → loreGroup | จัดกลุ่ม lore | loreEntries.groupId |

**Reserved** (ยังไม่มี junction — ไว้ให้ manual/AI/Promise Ledger รอบหน้า):
`foreshadows` (event→event setup→payoff) · `pays_off` · `contradicts` · `depends_on`

## Junction → Reference Mapping (ตัวต่อตัว)

2 strategy: **MIGRATE** = copy เข้า references เป็น source of truth (ต้นทางยังอยู่จนถึง Phase 7).
**MIRROR** = ตาราง rich คงเป็นเจ้าของข้อมูลเดิม, dual-write reference เส้นบางไว้ให้ graph/RAG เห็นเท่านั้น.

| junction เดิม | strategy | from → to | relation | meta |
|---|---|---|---|---|
| `noteCharacters` | MIGRATE | note → character | `features` | `{role}` |
| `chapterCharacters` | MIGRATE | chapter → character | `features` | `{role, frequency}` |
| `characterFactions` | MIGRATE | character → faction | `member_of` | `{role, startChapterId, endChapterId}` |
| `locationEntities` | MIGRATE | entity → location | `inhabits` | `{population}` |
| `ideaConnections` | MIGRATE | idea → idea | `linked_to`/`derived_from` | `{label}` |
| `plotThreadBeats` | MIGRATE | plotThread → timelineEvent | `advances` | `{role, orderIndex, note}` |
| `sceneElementDetails` | MIGRATE | timelineEvent → character/location | `features`/`set_in` | `{action, how, goal, outcome}` |
| `timelineEvents.relatedCharacterIds` (jsonb) | MIGRATE | timelineEvent → character | `features` | — |
| `timelineEvents.relatedLocationIds` (jsonb) | MIGRATE | timelineEvent → location | `set_in` | — |
| `characterRelationships` | **MIRROR** | character → character | `related_to` | `{type, opinionLevel, sentiment}` |
| `characterPowers` | **MIRROR** | character → power | `wields` | `{currentLevel, acquiredMethod}` |
| `locationConnections` | **MIRROR** | location → location | `connects_to` | `{travelTime, travelMethod, isBidirectional}` |
| `powerCombinations` | **MIRROR** | power → power (result) | `combines_into` | `{sourcePowerIds, requiredLevels}` |

**ออกนอก scope (ไม่ migrate):**
- `chapterTags` — tag เป็น label ไม่ใช่ entity → ไม่เข้า registry
- `relationshipHistory` — เป็น child ของ characterRelationships (timeline opinion) คงเดิม
- `characterLifeEvents` — เป็น content/event ของตัวละคร (อาจเป็น EntityType เองทีหลัง)

## การรับประกันความปลอดภัยข้อมูล (เคาะแล้ว — ทุก step ของรอบนี้เป็น additive)

- เพิ่มคอลัมน์ `meta jsonb` (nullable) → ของเดิมไม่กระทบ
- เพิ่มตาราง `references` ใหม่ → ไม่แตะตารางเดิม
- MIGRATE = **copy** (ต้นทางอยู่ครบ), MIRROR = ต้นทางเป็นเจ้าของเหมือนเดิม
- junction เดิมไม่ถูกลบจนถึง Phase 7 (ตอนนั้นมี pg_dump backup แล้ว)

---

## ขั้นตอนปลอดภัย — รอบแรก (L0+L1)

1. ✅ `pg_dump` → `backup/pre-reference-layer-*.sql` (6.2M, 51 ตาราง) — vector-db ยังไม่มี local
2. ✅ เพิ่มตาราง `references` (`db:push`) — additive, ไม่แตะตารางเดิม (migration `0013_context_fabric_references.sql`)
3. ✅ เขียน registry (`server/registry/entity-registry.ts`) + references API (`server/references.ts`)
4. ⬜ **Dual-write**: แก้ junction write paths เดิม (เช่น `addCharacterToNote`) ให้เขียน `references` ด้วย — *ยังไม่ทำ (รอบถัดไป)*
5. ✅ **Backfill script** (`scripts/backfill-references.ts`): copy/mirror ตาม mapping — รันแล้ว 224 edges (flag `migration`), idempotent
6. **ยังไม่ลบ junction ใดๆ** — รอ Phase 4+ รอบถัดไป

### สถานะรอบแรก (2026-06-17)
- รากฐาน L0+L1 **สร้างเสร็จ + verify บนข้อมูลจริง**: `getContextBundle` ดึง backlink ได้ถูกต้อง
- references ปัจจุบัน 224 edges (features 124, set_in 61, connects_to 29, related_to 6, derived_from 2, wields 2) ทั้งหมด `createdBy=migration`
- **ค้าง**: dual-write (Phase 4 ในแผน), @-mention UI / RAG auto-sync / graph rewrite (Phase 5-6)
- ⚠️ `references` เป็น SQL reserved word — Drizzle quote ให้อัตโนมัติ, raw SQL ต้องใส่ `"references"`

ผลลัพธ์รอบแรก: reference layer มีข้อมูลครบ, ของเดิมไม่พัง, พร้อมให้ mention UI / graph / RAG เสียบในรอบหน้า

---

## Rollout เต็ม (อ้างอิง)

| Phase | ทำอะไร | ของเดิมพังไหม |
|---|---|---|
| 0 | backup db + LanceDB | ไม่ |
| 1 | L0 registry + L1 `references` table | ไม่ |
| 2 | Dual-write junction + reference | ไม่ |
| 3 | Backfill + L4 API อ่านจาก reference | ไม่ |
| 4 | สลับ read path ทุกโมดูลมาอ่าน L4 | rollback ได้ |
| 5 | `@`-mention UI + RAG auto-sync ครอบทุก type | ฟีเจอร์ใหม่ |
| 6 | ขยาย graph + agent tools อ่าน L1 | — |
| 7 | drop junction เก่า (มี backup) | ตั้งใจลบ |

## TODO รอบถัดไป (ก่อนเขียนโค้ด)
- เคาะรายการ `relation` มาตรฐานให้ครบ
- ลิสต์ junction ที่จะ migrate ตัวต่อตัว + mapping relation

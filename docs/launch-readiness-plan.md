# Launch Readiness Plan — เปิดระบบให้คนอื่นใช้งาน

แบ่งเป็น 4 phase เรียงตาม "อะไรจะทำให้เจ็บก่อนถ้าไม่ทำ" ทุก phase ผ่านการตรวจสอบโค้ดจริงแล้ว
(ไม่ใช่ checklist ทั่วไป) — อ้างอิงบริบทเต็มจากเซสชันที่วางแผนไว้

---

## Phase 1 — Safety Net ✅ เสร็จแล้ว

เป้าหมาย: รู้ตัวทันทีเมื่อของพัง แทนที่จะรอ user มาบ่น

- [x] **CI** — `.github/workflows/ci.yml` รัน `typecheck` + `build` อัตโนมัติทุก push เข้า `main`
- [x] **Error boundary** — `app/error.tsx` (error ในหน้าไหนก็ได้) + `app/global-error.tsx`
  (root layout เองพัง) แทนจอขาวเปล่า
- [x] **Sentry error tracking** — `instrumentation.ts` / `instrumentation-client.ts` /
  `sentry.server.config.ts` / `sentry.edge.config.ts`, DSN อยู่ใน `.env`
  (`NEXT_PUBLIC_SENTRY_DSN`) ทำงานเฉพาะ `NODE_ENV=production` เท่านั้น — ยังไม่เคยเห็น error
  จริงเพราะแอปยังไม่เคย deploy ขึ้น production
- [x] Bonus: เจอและแก้ปัญหา `pythonservice/discord_bot` เป็น broken git submodule
  ที่ทำให้ CI post-cleanup พัง (มันคือ repo แยก [`Mythoria_bot`](https://github.com/Nattachai802/Mythoria_bot) deploy เองผ่าน Render)

**หนี้ที่รู้ตัวแล้วและตั้งใจไม่แก้ตอนนี้**: CI ขึ้นแดงถาวรจาก TS error เก่า ~130 จุด
(implicit-any) กระจายทั่ว `server/` และ `app/api/` — ของเก่าก่อนเริ่ม work นี้ ไม่ใช่ของใหม่
เก็บไว้ทำใน Phase 4

---

## Phase 2 — ปิดรูก่อนเปิดสาธารณะ 🔶 กำลังทำ

เป้าหมาย: ป้องกันคนนอกอ่าน/แก้ข้อมูลคนอื่น หรือทำให้ค่าใช้จ่าย AI พุ่ง

### 2.1 Data isolation — เริ่มแล้ว
Audit พบว่า **เกือบทั้ง `server/` directory (~50 ไฟล์) ไม่มีการเช็คสิทธิ์เจ้าของเลย** —
ใครก็ตามที่รู้ `novelId`/entity id (เดา, สุ่ม, เปิด network tab) อ่านหรือแก้ข้อมูลนิยายคนอื่นได้

- [x] `lib/authz.ts` — helper กลาง: `requireNovelAccess(novelId)`, `requireUser()`,
  `authErrorMessage(error, fallback)`
- [x] `server/factions.ts` — ใช้ครบ (createFaction, updateFaction, deleteFaction)
- [x] `server/novel.ts` — ใช้ครบทุกฟังก์ชัน (รวมจุดที่ต้องระวังเรื่อง `unstable_cache`:
  เช็คสิทธิ์ต้องอยู่ *นอก* cached function เสมอ ไม่งั้น cache hit จะข้ามการเช็คไปเลย)
- [ ] ไฟล์ที่เหลือ — ดูลิสต์เต็มใน [`phase2-data-isolation-plan.md`](./phase2-data-isolation-plan.md)
  (chapter.ts, idea.ts, character.ts, lore.ts, timeline.ts, power.ts, note.ts, graph.ts,
  version-history.ts, plot-threads.ts, story-arcs.ts, world-systems.ts, locations.ts,
  items.ts, life-events.ts, eras.ts, location-connections.ts, note-character.ts,
  chapter-characters.ts, character-power.ts + ฟังก์ชันที่เหลือใน factions.ts เอง)

**รูปแบบการแก้ (สรุปจาก 2 ไฟล์ที่ทำแล้ว)**:
1. Client ส่ง `novelId` ตรง ๆ → `await requireNovelAccess(novelId)` บรรทัดแรกใน `try`
2. Client ส่งแค่ entity id (factionId, chapterId, ...) → query หา `novelId` เจ้าของก่อน
   แล้วค่อย `requireNovelAccess` แล้วค่อยทำงานจริง — และตัด field `novelId`/`userId`
   ออกจาก payload ก่อน update เสมอ (กัน client ย้ายของข้าม novel/user อื่น)
3. Query ที่รับ `userId` เป็น parameter (list ของ user เอง) → เรียก `requireUser()`
   แล้วใช้ userId ที่ยืนยันแล้วแทนค่าที่ client ส่งมา ไม่เชื่อ parameter ตรง ๆ

### 2.2 Python service auth — ยังไม่เริ่ม
- Frontend เรียก `http://localhost:8000` ตรง ๆ (เช่น `plot-hole-checker.tsx`) — ต้องมี
  internal API key ระหว่าง Next.js ↔ Python และห้ามเปิด endpoint สู่เน็ตสาธารณะตรง ๆ

### 2.3 Rate limiting — ยังไม่เริ่ม
- มีแค่ 4 ไฟล์ที่ทำไว้ (bible-import, chapter-summary, character-state-ai, note-summary)
- endpoint ที่เรียก AI (embedding, LLM) ที่เหลือทั้งหมดยังไม่มี limit ต่อ user

---

## Phase 3 — Compliance & Deploy จริง ⬜ ยังไม่เริ่ม

**ต้องเป็นคุณตัดสินใจ ผมทำแทนไม่ได้ทั้งหมด**:
- Privacy policy + PDPA consent (user ไทย + เก็บข้อมูลนิยาย)
- เลือก deploy target จริง (ไม่มี Dockerfile/vercel.json ในโปรเจกต์เลยตอนนี้)
- Secret management ของ production (แยกจาก `.env` ที่ใช้ตอน dev)
- แผน backup DB

---

## Phase 4 — Scale & Polish ⬜ ยังไม่เริ่ม (ไม่บล็อกการเปิดตัว)

- แก้ TS error เก่า ~130 จุดที่ทำให้ CI แดงถาวรตอนนี้
- ลบ `pythonservice/tool_definitions.py` (ยืนยันแล้วว่าเป็น dead code — ไม่มีที่ไหน import)
- ย้าย `tools/timeline_checker.py` + `tools/character_validator.py` เป็น TypeScript
  server action (เป็น business logic ล้วน ไม่มี ML, แค่เรียก API ของแอปเราเองข้ามไป Python
  แล้ววนกลับมา — ย้ายแล้วตัด network hop ออกได้เลย)
- เพิ่ม test coverage (ตอนนี้มีไฟล์เดียวทั้งโปรเจกต์: `lib/mentions.test.ts`)
- Billing/แผนราคา ถ้าจะคิดเงิน

---

## Reference
- [`phase2-data-isolation-plan.md`](./phase2-data-isolation-plan.md) — ลิสต์ไฟล์เต็มของ Phase 2.1

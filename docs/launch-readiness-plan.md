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

### 2.1 Data isolation — ✅ เสร็จแล้ว
Audit พบว่า **เกือบทั้ง `server/` directory (~50 ไฟล์) ไม่มีการเช็คสิทธิ์เจ้าของเลย** —
ใครก็ตามที่รู้ `novelId`/entity id (เดา, สุ่ม, เปิด network tab) อ่านหรือแก้ข้อมูลนิยายคนอื่นได้
ตอนนี้ปิดครบทุกไฟล์ที่มีข้อมูล scope ด้วย novelId แล้ว

- [x] `lib/authz.ts` — helper กลาง: `requireNovelAccess(novelId)`, `requireUser()`,
  `authErrorMessage(error, fallback)`
- [x] `server/novel.ts` + `server/factions.ts` — ครบ
- [x] ไฟล์ที่เหลือทั้งหมด (~20 ไฟล์): chapter, idea, character, discord-sync, lore, note,
  power, items, locations, eras, timeline, life-events, plot-threads, story-arcs,
  world-systems, version-history, graph, location-connections, chapter-characters,
  note-character, character-power — ดูสรุปเต็มใน
  [`phase2-data-isolation-plan.md`](./phase2-data-isolation-plan.md)
- Verified: normalized `tsc` error set เท่ากับ HEAD เป๊ะ (0 error ใหม่)

**รูปแบบการแก้ (สรุปจาก 2 ไฟล์แรก)**:
1. Client ส่ง `novelId` ตรง ๆ → `await requireNovelAccess(novelId)` บรรทัดแรกใน `try`
2. Client ส่งแค่ entity id (factionId, chapterId, ...) → query หา `novelId` เจ้าของก่อน
   แล้วค่อย `requireNovelAccess` แล้วค่อยทำงานจริง — และตัด field `novelId`/`userId`
   ออกจาก payload ก่อน update เสมอ (กัน client ย้ายของข้าม novel/user อื่น)
3. Query ที่รับ `userId` เป็น parameter (list ของ user เอง) → เรียก `requireUser()`
   แล้วใช้ userId ที่ยืนยันแล้วแทนค่าที่ client ส่งมา ไม่เชื่อ parameter ตรง ๆ

### 2.2 Python service auth — ✅ เสร็จแล้ว
เดิม: ~28 endpoint ของ FastAPI ไม่มี auth เลย และหลายจุด **เบราว์เซอร์เรียก `localhost:8000`
ตรง ๆ** (client component + EventSource) — deploy จริง = ใครก็ยิงได้โดยไม่ต้องล็อกอิน

แก้แล้ว (2 ชั้น ทำคู่กันเพราะฝัง secret ในเบราว์เซอร์ไม่ได้):
- [x] **Python**: middleware บังคับ header `X-Internal-Key` == `INTERNAL_API_KEY` ทุก endpoint
  (ยกเว้น `/health` + preflight), fail-closed ถ้าลืมตั้ง key ([`pythonservice/main.py`](../pythonservice/main.py))
- [x] **Next proxy** [`app/api/py/[...path]/route.ts`](../app/api/py/[...path]/route.ts) — same-origin,
  เช็ค session → forward พร้อม key → stream กลับ (รองรับ fetch + EventSource; cookie ไหลมาเอง)
- [x] **Server helper** [`lib/python-service.ts`](../lib/python-service.ts) `pyFetch()` แนบ key
  ให้ server callers (rag.ts, stylometry.ts, 4 route handlers)
- [x] Client callers ทั้งหมดชี้มา `/api/py/...` แทน `localhost:8000`
  (plot-hole-checker, vector-sync, librarian-panel, plot-hole-job SSE, spell-check-api)
- [x] `INTERNAL_API_KEY` (openssl rand -hex 32) ใส่ทั้ง `.env` และ `pythonservice/.env` (ทั้งคู่ gitignore)

**ceiling ที่จงใจเว้น** (`ponytail:` ใน route.ts): proxy เช็คแค่ "ล็อกอินแล้ว" ยังไม่เช็ค
ownership ราย novelId บน path ของ Python — endpoint พก novelId คนละที่ (path/body) ถ้าต้องแน่นกว่านี้ค่อยเพิ่ม per-route
- [ ] **ยังต้องทำ manual**: หลัง deploy ห้ามเปิด port 8000 สู่เน็ตสาธารณะ (ให้เข้าถึงได้เฉพาะจาก Next.js), rotate key ที่ generate ให้

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

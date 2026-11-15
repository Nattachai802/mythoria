# ระบบ AI ของ Mythoria — คู่มือสำหรับ dev

เอกสารนี้อธิบายว่าการเรียก AI ในแอปวิ่งผ่านอะไรบ้าง ตั้งค่าที่ไหน และถ้าจะเพิ่มฟีเจอร์ AI ใหม่ต้องแตะไฟล์ไหน
อ่านคู่กับโค้ด: ทุกหัวข้อมีชื่อไฟล์กำกับ

> หลักการของทั้งแอป: **AI ทำงานเมื่อผู้ใช้กดเรียกเท่านั้น** ไม่แต่งแทน ไม่ auto-run
> งานตรวจที่ต้องเชื่อถือได้ (เช่น คำเตือนในสมุดปม) ใช้กฎ deterministic ไม่ใช้ LLM

---

## 1. ภาพรวม

```
UI (client)
  │ server action / route handler
  ▼
server/<feature>.ts ──► getPlotContext()       (บริบทกระดานพล็อต, ถ้าต้องใช้)
  │                     lib/<feature>-ai.ts    (prompt + schema + parser แบบ pure)
  ▼
lib/ai-gateway.ts  callAi()
  ├─ gate: flag → guest → busy → quota
  ├─ เลือก chain (traditional / jev)
  ├─ เดิน fallback chain + cooldown
  └─ log ลง ai_usage_log
  ▼
Groq · Typhoon · Gemini · OpenRouter · TypeSafe (Jev)

Browser ──► /api/py/[...path]  (proxy, gate เดียวกัน) ──► Python FastAPI :8000
```

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/ai-features.ts` | Registry: ประกาศทุกฟีเจอร์ AI, โมเดล, fallback chain, quota default (pure module, CLI ใช้ร่วม) |
| `lib/ai-gateway.ts` | Gateway: `callAi()`, `callAiProvider()`, `assertAiAllowed()`, `logParseFailure()` (`server-only`) |
| `lib/plot-context.ts` + `server/plot-context.ts` | ประตูบริบทกระดานพล็อต: ประกาศระดับบริบทต่อฟีเจอร์ + `getPlotContext()` |
| `app/api/py/[...path]/route.ts` | Proxy ไป Python + gate ฟีเจอร์ฝั่ง Python |
| `scripts/ai-control.ts` | CLI `npm run ai` |
| `lib/guest.ts` | เช็คว่าเป็นบัญชีเดโม (AI ปิดสำหรับ guest) |

---

## 2. Registry — `lib/ai-features.ts`

ทุกฟีเจอร์ต้องมีแถวใน `AI_FEATURES` ก่อนถึงจะเรียกผ่าน gateway ได้ (key ไม่รู้จัก → `AiControlError("unknown-feature")`)

```ts
"beat-coach": {
    key: "beat-coach",
    label: "ผู้ช่วยดูจังหวะในฉาก",
    description: "...",
    chain: [                       // ลำดับ fallback ซ้าย → ขวา
        { provider: "groq",    model: GROQ_MODEL,    temperature: 0.3, maxTokens: 1500 },
        { provider: "typhoon", model: TYPHOON_MODEL, temperature: 0.3, maxTokens: 1500 },
    ],
    jevChain: [{ provider: "typesafe", model: JEV_MODEL, temperature: 0 }], // optional
    defaultDailyLimit: 100,        // ครั้ง/วัน/ผู้ใช้ · null = ไม่จำกัด
},
```

- `chain: []` คือฟีเจอร์ฝั่ง Python ที่ gateway แค่ gate ไม่ได้ยิง LLM เอง (ใส่ `pythonModels` ไว้โชว์บนแผนผัง)
- ค่าโมเดลอยู่ในค่าคงที่บนสุดของไฟล์ (`GROQ_MODEL`, `TYPHOON_MODEL`, `GEMINI_MODEL`, `OPENROUTER_MODEL`, `OPENROUTER_QWEN_FLASH`, `JEV_MODEL`) เปลี่ยนโมเดลทั้งแอปแก้ที่เดียว คอมเมนต์ข้างค่าคงที่บอกเหตุผลที่เลือกตัวนั้น อ่านก่อนเปลี่ยน
- **ไม่มีแถวในตาราง `ai_features` = ใช้ค่า default จาก registry** (เปิดอยู่, quota ตาม `defaultDailyLimit`, โหมด traditional)

### ฟีเจอร์ที่มีตอนนี้ (22 ตัว)

| key | ใช้ทำอะไร | chain หลัก | Jev |
|---|---|---|---|
| `alias-suggest` | แนะนำชื่อไทยของตัวละคร | Typhoon | |
| `data-assistant` | สั่งสร้าง/แก้ entity (function calling) | Groq | |
| `librarian` | ถาม-ตอบจาก canon (Graph RAG) | Groq → Typhoon | |
| `chapter-summary` / `note-summary` | สรุปบท / ตอน จากร้อยแก้ว | Gemini | |
| `plot-scene-recap` / `plot-chapter-recap` | สรุปจากโครงกระดานพล็อต | Gemini | |
| `echo-score` | ทายทิศเรื่องแล้วตัดสินว่าคาดเดาได้แค่ไหน | OpenRouter → Gemini → Typhoon | ✓ (รอบตัดสิน) |
| `scene-type-suggest` | แนะนำประเภทฉาก | Groq → Typhoon | ✓ |
| `pacing-ai-suggest` | ให้คะแนน pacing ทั้งบท | Groq → Typhoon | ✓ |
| `beat-coach` | เดาค่าจังหวะที่ขาด + เสนอจังหวะถัดไป | Groq → Typhoon | ✓ |
| `thread-fairness` | ตรวจการเฉลยปม (3 call ต่อการกด) | OpenRouter qwen-flash → Typhoon | |
| `character-state-extractor` | สกัดสถานะตัวละครเบื้องหลัง | Gemini → Typhoon | |
| `lore-extractor` / `lore-extract-manual` | สกัด entity จาก lore (auto / กดเอง) | Gemini → Groq | |
| `bible-import` | สกัด entity จาก Story Bible | Groq | |
| `reader-review` | นักอ่านจำลองให้คะแนน suspense ฯลฯ | Groq → Typhoon | |
| `vector-sync` | rebuild embeddings + reference index | Python (Gemini embedding) | |
| `graph-rag-search` | vector search + เดินกราฟ | Python | |
| `plot-hole-checker` | agent ตรวจ plot hole/timeline | Python (Typhoon 2.1) | |
| `character-analysis` | วิเคราะห์ตัวละคร queue/SSE | Python (Typhoon 2.1) | |

---

## 3. Gateway — `lib/ai-gateway.ts`

### 3.1 ลำดับที่ `callAi()` ทำ

1. **ensureAiAllowed** (`ensureAiAllowed()`)
   - feature ไม่อยู่ใน registry → `unknown-feature`
   - override ใน `ai_features` ตั้ง `enabled=false` → `disabled`
   - เป็นบัญชีเดโม (`isGuest()`) → `guest` (ข้ามได้ด้วย `skipGuestCheck` เฉพาะ flow ระบบ เช่น seed)
   - หา userId ไม่ได้ (background job ที่ไม่มี session) → **ข้าม busy/quota ทั้งหมด** ดังนั้น background ควรส่ง `userId` มาเอง
   - มีงานฟีเจอร์เดียวกันของ user เดียวกันค้างใน `ai_active_runs` (สดภายใน 8 วิ) → `busy`
   - นับแถวใน `ai_usage_log` วันนี้ (ไม่นับ `blocked`) ≥ quota → `quota` (รีเซ็ตเที่ยงคืนตามเวลาเซิร์ฟเวอร์)
2. **markFeatureActive**: upsert แถวใน `ai_active_runs`
3. **resolveChain**: โหมด `jev` จะใช้ `jevChain` นำหน้า chain เดิม **เฉพาะเมื่อครบ 3 ข้อ** คือ override ตั้ง mode=jev, registry มี `jevChain` และ caller ส่ง `jev` payload มา ขาดข้อไหนก็เดิน chain เดิม
4. **เดิน chain**: ข้าม provider ที่ติด cooldown แล้วลองตัวถัดไป ล้มหมด → `all-failed`
5. **executeStep**: เลือก adapter ตาม provider แล้ว log ทั้งกรณีสำเร็จและ error
6. **finally → clearFeatureActive**: ลบแถว active ทันที ไม่ต้องรอหมดอายุ

### 3.2 Provider adapters

| provider | adapter | key ใน env |
|---|---|---|
| groq / typhoon / openrouter | `chatOpenAiCompatible` (`/chat/completions`) | `GROQ_API_KEY`, `TYPHOON_API_KEY`, `OPENROUTER_API_KEY` |
| gemini | `chatGemini` (`@google/genai`, ปิด thinking ด้วย `thinkingBudget: 0`) | `GEMINI_API_KEY` |
| typesafe | `chatTypesafe` (`api.typesafe.ai/v1/systemone`) | `TYPESAFE_API_KEY` |

- `responseSchema` ใช้ได้ทั้ง OpenAI-compatible (`response_format.json_schema` strict) และ Gemini (`responseJsonSchema`) ใช้ schema เดียวกันได้ ไม่ต้องแปลง **ควรส่งทุกครั้งที่ต้องการ JSON** เพราะลด parse fail ได้ตั้งแต่ต้นทาง
- โมเดล Groq ที่เลือกไว้ต้องรองรับ json_schema strict (ดูคอมเมนต์ที่ `GROQ_MODEL`)
- `extraBody` ส่งต่อให้เฉพาะ OpenAI-compatible (เช่น `tools`) ฝั่ง Gemini จะไม่สนใจค่านี้
- **Cooldown**: error ที่มีคำว่า `429|quota|rate limit` จะพัก provider นั้น 60 วิ (in-memory ต่อ process) ถ้า caller จะ retry เอง ให้ส่ง `useCooldown: false`

### 3.3 API ที่ใช้บ่อย

| ฟังก์ชัน | ใช้เมื่อ |
|---|---|
| `assertAiAllowed(key)` | บรรทัดแรกของ action ที่ต้องทำงานหนักก่อนยิง (query เยอะ) เพื่อ fail-fast |
| `callAi({ feature, system, prompt, responseSchema, novelId, jev? })` | ยิงปกติแบบเดิน fallback |
| `callAiProvider(key, provider, opts)` | ยิง provider ที่ระบุตัวเดียว ไม่เดิน fallback และข้าม busy check ใช้กับ pattern โหวตหลาย provider (bible-import, character-state-extractor) |
| `logParseFailure(resp.logId, resp.text)` | parse คำตอบไม่ผ่าน → update แถว log เดิมเป็น `parse_error` + เก็บคำตอบดิบ 4000 ตัวอักษร (update แถวเดิม ไม่ insert ใหม่ เพื่อไม่หักโควตาซ้ำ) |
| `AiControlError` | error ที่ gate โยน มี `reason` ไว้แยกเคส ควรแสดง `message` ให้ผู้ใช้ตรง ๆ |

### 3.4 Log และ privacy

`ai_usage_log` เก็บแค่ metadata: feature, provider, model, status, token เข้า/ออก, latency, error 300 ตัวอักษร
**ห้ามเก็บ prompt หรือเนื้อหานิยายลง log** (ยกเว้น `rawResponse` ของเคส parse_error ที่ต้องใช้ดีบัก)
การ log เป็นแบบ best-effort: ถ้า DB ล้ม ฟีเจอร์ AI ต้องยังทำงานต่อได้

### 3.5 Fail-open ที่ต้องรู้

- อ่าน override จาก DB ไม่ได้ → ใช้ default (flag เปิด)
- นับ quota หรือเช็ค busy ไม่ได้ → ปล่อยผ่าน
- override cache 15 วิต่อ process ดังนั้นการปิดฟีเจอร์จาก CLI จะมีผลช้าได้สูงสุด 15 วิ

---

## 4. โหมด Jev (TypeSafe)

Jev **ไม่ generate ข้อความ** แต่คืนคำตอบแบบ typed (`noul` / `choice` / `score`) พร้อมความน่าจะเป็น
จึงใช้ได้เฉพาะฟีเจอร์ที่คำตอบเป็น "เลือกจากตัวเลือกที่รู้ล่วงหน้า"

```ts
interface JevPayload {
    state: unknown;                          // บริบท นับ token ครั้งเดียวต่อ call
    questions: Record<string, JevQuestion>;
    toJson: (answers) => string;             // แปลงเป็น JSON รูปเดียวกับที่ LLM ตอบ
}
```

`toJson` คือหัวใจของการออกแบบนี้: ฝั่ง caller ใช้ parser ตัวเดียวกันได้ทั้งสองโหมด โค้ดจึงไม่ต้องแยกเป็นสองสาย
ตัวอย่างดูที่ `buildBeatCoachJev()` ใน `lib/beat-coach-ai.ts` · ชุดทดสอบ adapter อยู่ที่ `lib/jev-adapters.check.ts`

ข้อควรระวัง: ถ้ารอบแรกตอบมาจาก Jev ช่องข้อความจะว่างเสมอ ฟีเจอร์ที่ต้องมีคำอธิบาย (เช่น beat-coach) ต้องยิงรอบที่สองโดย**ไม่ส่ง** `jev` เพื่อให้ LLM เขียนคำอธิบาย และต้องออกแบบให้รอบที่สองล้มได้โดยไม่ทิ้งผลของรอบแรก

สลับโหมดได้ที่ `npm run ai mode <key> jev|traditional` (เฉพาะฟีเจอร์ที่มี `jevChain`)

---

## 5. บริบทกระดานพล็อต — `getPlotContext()`

ฟีเจอร์ที่อ่านการ์ด/ฉากบนกระดาน **ห้ามประกอบ query เอง** ให้ประกาศใน `PLOT_CONTEXT_CONSUMERS` (`lib/plot-context.ts`) แล้วเรียกผ่าน `getPlotContext()` (`server/plot-context.ts`)

| ระดับ | ได้อะไร | เหมาะกับ |
|---|---|---|
| `full` | markdown เต็มของฉาก (`renderSceneMarkdown`) + `format` ดิบ | ฟีเจอร์ที่ต้องอ่านเนื้อฉากละเอียด |
| `digest` | โครง + ตัวเลข ตัดเนื้อการ์ดสั้น | ดูหลายฉาก/จังหวะ |
| `recap` | digest + ย่อหน้าสรุปที่ AI เคยเขียนไว้ | ให้คะแนนรวม |

| consumer | scope | level | หมายเหตุ |
|---|---|---|---|
| `echo-score` | scene | full | ห้ามเห็น recap |
| `plot-scene-recap` | scene | full | เป็นตัวผลิต recap เอง |
| `scene-type-suggest` | scene | full | |
| `beat-coach` | scene | digest | เห็นค่า pacing ที่ผู้ใช้ตั้งไว้ |
| `pacing-ai-suggest` | scene | recap | `hideUserPacing: true` กันไม่ให้ AI ยึดคำตอบเดิมของผู้เขียน |

กติกา:
- **ฟีเจอร์ที่ต้องเดาหรือวิเคราะห์เนื้อเรื่องเอง ห้ามใช้ `recap`** เพราะ recap คือสิ่งที่ AI ตีความมาแล้ว
- ช่อง `why` บังคับกรอก เพื่อกันคนเลือก `full` ไว้ก่อนโดยไม่คิด
- เช็ค `ctx.sceneCount === 0` ก่อนยิงทุกครั้ง (หาฉากไม่เจอหรือบทว่าง)
- ชุดทดสอบ: `lib/plot-context.check.ts`

ฟีเจอร์ที่ไม่ได้อ่านกระดาน (librarian, summary ฯลฯ) ดึงบริบทเองหรือใช้ Graph RAG ผ่าน `server/rag.ts`

---

## 6. ฝั่ง Python

- ทุก request จากเบราว์เซอร์วิ่งผ่าน `/api/py/[...path]` ซึ่ง (1) บังคับให้ล็อกอิน (2) แนบ `x-internal-key` (3) gate ฟีเจอร์ AI
- path segment แรกถูก map เป็น feature key ด้วย `resolvePythonFeature()` (ตาราง `PYTHON_PATH_FEATURES` ใน `lib/ai-features.ts`) ได้แก่ `sync`, `search`, `analyze-plot`, `check-timeline`, `validate-character`, `check-all-notes`, `analyze-characters`, `analyze-queue`
- gate ไม่ผ่าน → ตอบ 429 (quota/busy) หรือ 403 · Python ต่อไม่ติด → ตอบ 503
- endpoint ที่ไม่อยู่ในตาราง (spell-check, stylometry, health) ไม่ผ่าน gate โดยตั้งใจ เพราะคำนวณในเครื่อง ไม่เผาโควตา API
- **SSE**: แถว active ไม่ถูกลบตอนจบ จะหมดอายุเองใน 8 วิ ดังนั้น busy check ครอบคลุมแค่ช่วงต้นของ stream
- **ยังไม่ได้ทำ**: proxy เช็คแค่ว่าล็อกอินแล้ว ยังไม่เช็คว่าเป็นเจ้าของ `novelId` ที่อยู่ใน path/body ของ Python
- โมเดลที่ Python เรียกเองอยู่ในโค้ด Python (`ai_agent.py`, `character_analyzer.py`, `embeddings.py`) ยังใช้ Typhoon 2.1 คนละตัวกับฝั่ง Next (2.5)

---

## 7. AI Control

### CLI — `npm run ai`

```bash
npm run ai list                    # ทุกฟีเจอร์ + สถานะ + quota + ใช้ไปวันนี้ + chain
npm run ai off <key>               # ปิดฟีเจอร์
npm run ai on <key>                # เปิด
npm run ai quota <key> <N>         # N ครั้ง/วัน/ผู้ใช้ (0 = ไม่จำกัด)
npm run ai mode <key> jev          # หรือ traditional
npm run ai reset <key>             # ลบ override กลับไปใช้ default
npm run ai log [N]                 # runs ล่าสุด + error
```

CLI เขียนตาราง `ai_features` ตรง ๆ โดยใช้ `NEON_DATABASE_URL` หรือ `DATABASE_URL` (ตั้ง `DB_TARGET=local` เพื่อใช้ `LOCAL_DATABASE_URL`)
⚠️ ฐานข้อมูล Neon ใช้ร่วมกัน คำสั่ง `on/off/quota/mode/reset` จึงมีผลกับทุกคนทันที

### Board — `/dashboard/ai-control`

แสดงแผนผังโมเดล, สถานะ/quota/ยอดใช้วันนี้ของแต่ละฟีเจอร์, งานที่กำลังรันอยู่ (`ai_active_runs`) และ runs ล่าสุด (guest เข้าไม่ได้)

### ตารางที่เกี่ยวข้อง

| ตาราง | เก็บอะไร |
|---|---|
| `ai_features` | override ต่อฟีเจอร์: `enabled`, `daily_limit_per_user`, `mode` |
| `ai_usage_log` | 1 แถวต่อการยิง provider 1 ครั้ง (ใช้นับโควตาด้วย) |
| `ai_active_runs` | heartbeat แถวเดียวต่อ (user, feature) ใช้กันยิงซ้อน |
| `plot_findings`, `plot_recaps`, `ai_suggestions`, ... | ผลลัพธ์ของแต่ละฟีเจอร์ (แต่ละฟีเจอร์บันทึกเอง) |

---

## 8. เพิ่มฟีเจอร์ AI ใหม่ — checklist

ทำตามโครงของ `beat-coach` ซึ่งเป็นตัวอย่างที่ครบที่สุด

1. **Registry** — เพิ่ม key ใน `AI_FEATURES` (`lib/ai-features.ts`) พร้อม chain, quota และ `jevChain` ถ้าคำตอบเป็นตัวเลือกปิด
2. **บริบท** (ถ้าอ่านกระดานพล็อต) — เพิ่มแถวใน `PLOT_CONTEXT_CONSUMERS` ด้วย key เดียวกัน พร้อมเขียน `why`
3. **Pure logic** — `lib/<feature>-ai.ts`: `build...Prompt()`, `..._SCHEMA`, `parse...()` (+ `build...Jev()`) ห้าม import DB หรือ Next ในไฟล์นี้
4. **Check** — `lib/<feature>-ai.check.ts` ทดสอบ parser กับคำตอบรูปแปลก ๆ แล้วเพิ่มเข้าสคริปต์ `check` ใน `package.json`
5. **Server action** — `server/<feature>.ts` เรียงตามนี้:
   ```ts
   await assertAiAllowed("my-feature");          // fail-fast
   await requireNovelAccess(novelId);            // data isolation
   const ctx = await getPlotContext({ consumer: "my-feature", novelId, subjectId });
   if (ctx.sceneCount === 0) return { success: false, error: "..." };
   const resp = await callAi({ feature: "my-feature", system, prompt, responseSchema, novelId, jev });
   const parsed = parseX(resp.text);
   if (!parsed) { await logParseFailure(resp.logId, resp.text); return { success: false, ... }; }
   // บันทึกผล → คืนค่า
   // catch: if (err instanceof AiControlError) return { success: false, error: err.message };
   ```
6. **UI** — ต้องมีปุ่มให้ผู้ใช้กดเอง (ไม่ auto-run) และแสดง error จาก gate ให้ผู้ใช้เห็น
7. **Changelog** — เพิ่มรายการใต้ `version: "next"` ใน `lib/changelog.ts`

กติกาที่มักพลาด:
- background job ต้องส่ง `userId` ให้ `callAi` เอง ไม่อย่างนั้น quota และ busy check จะถูกข้ามทั้งหมด
- ฟีเจอร์ที่กดหนึ่งครั้งแล้วยิงหลาย call (เช่น `thread-fairness` ยิง 3 call) ต้องตั้ง quota เป็นจำนวน call ไม่ใช่จำนวนครั้งที่กด
- `temperature` ใน registry เป็นแค่ default ถ้าแต่ละขั้นต้องการต่างกัน ให้ส่ง `temperature` ทับใน `callAi`
- อย่าเรียก provider SDK ตรง ๆ จากโค้ดฟีเจอร์ ต้องผ่าน gateway ทุกครั้ง ไม่อย่างนั้นจะหลุดทั้ง quota, log และ flag

---

## 9. Env ที่ต้องตั้ง

```env
GROQ_API_KEY=
TYPHOON_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
TYPESAFE_API_KEY=        # ต้องมีเฉพาะเมื่อเปิดโหมด jev
INTERNAL_API_KEY=        # ต้องตรงกับ pythonservice/.env
DEMO_EMAIL=              # บัญชี guest ที่ถูกปิด AI
```

ถ้า key ของ provider ไหนไม่ได้ตั้ง step นั้นจะ error แล้ว gateway ไปลองตัวถัดไปใน chain

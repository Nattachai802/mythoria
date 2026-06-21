# Mythoria 🖋️✨

**The AI-Powered Forge for Your Next Masterpiece.**

**Mythoria** คือแพลตฟอร์มเขียนนิยายยุคใหม่ที่รวมพลัง Project Management + AI อัจฉริยะ + World Building เข้าไว้ในที่เดียว ออกแบบมาสำหรับนักเขียนที่ต้องการเครื่องมือจริงจัง ไม่ใช่แค่ Text Editor ทั่วไป

> **Current Version: `v2.1`** — Librarian Q&A, A5 Page View, ePub Export & Derived Reference Index

---

## 📑 สารบัญ

- [🎨 Design Philosophy](#-design-philosophy)
- [🏗️ System Architecture](#-system-architecture)
- [🚀 ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [🤖 ระบบ AI](#-ระบบ-ai)
- [🛠️ Tech Stack](#-tech-stack)
- [🗄️ โครงสร้างฐานข้อมูล](#-โครงสร้างฐานข้อมูล)
- [🗺️ Context Fabric](#-context-fabric)
- [🏁 การติดตั้ง](#-การติดตั้ง)

---

## 🎨 Design Philosophy

ใช้ Design System ที่พัฒนาขึ้นเองในชื่อ **"Forge Mode"** (Industrial Creativity Theme)

- **Aesthetics**: รูปทรงเลขาคณิตตัดมุม, ลวดลายอุตสาหกรรม, Typography แบบ Technical
- **Color System**: ระบบสี **OKLCH** เพื่อความสม่ำเสมอใน Light/Dark Mode ทุกสภาพแสง
- **Experience**: Micro-interactions, Glassmorphism, และ Keyboard Shortcuts ที่รู้สึก Premium
- **Principle**: *Tool disappears into the task* — ขณะเขียน UI ไม่แย่งความสนใจ แต่พร้อมเสมอเมื่อต้องการ

---

## 🏗️ System Architecture

ระบบของ **Mythoria** ถูกออกแบบด้วยสถาปัตยกรรมแบบ Hybrid Monolith (Next.js) ร่วมกับ Python AI Microservice เพื่อการประมวลผล RAG และ AI Agent แยกส่วนอย่างมีประสิทธิภาพ:

```mermaid
graph TD
    subgraph Client ["Client Side (Browser)"]
        UI["Next.js Pages Forge Mode UI"]
        Canvas["Visual Canvas React Flow"]
        Editor["Writing Studio Quill.js"]
        GraphVis["Relationship Graph"]
    end

    subgraph WebServer ["Web and Backend Server"]
        NextServer["Next.js Server Actions and APIs"]
        BAuth["Better Auth"]
        Drizzle["Drizzle ORM"]
    end

    subgraph AIService ["AI Microservice Python FastAPI port 8000"]
        VectorRAG["Vector and RAG\n/sync /search"]
        PlotAgent["Plot Hole Agent\n/analyze-plot\n/check-all-notes-stream\n/check-timeline /validate-character"]
        CharAnalyzer["Character Analyzer\n/analyze-characters\n/analyze-queue SSE"]
        Stylo["Stylometry\n/analyze-chapter-style\n/analyze-fingerprint-bulk"]
        SpellSvc["Spell Checker\n/spell-check\n/spell-check-note Background"]
        LanceDB[("LanceDB Vector DB")]
        SpellCache[("Spell Cache pkl")]
    end

    subgraph External ["External Services and DB"]
        Postgres[("Neon PostgreSQL")]
        GeminiEmbed["Gemini API Embeddings 768d"]
        Typhoon["Typhoon v2.1 Thai LLM"]
        Groq["Groq API Llama fast inference"]
        PyThaiNLP["PyThaiNLP Spell Check"]
        GDrive["Google Drive API"]
        Discord["Discord Webhooks"]
        Cloudinary["Cloudinary Asset Store"]
    end

    UI --> NextServer
    Canvas --> NextServer
    Editor --> NextServer
    GraphVis --> NextServer

    NextServer --> BAuth
    NextServer --> Drizzle
    NextServer --> VectorRAG
    NextServer --> PlotAgent
    NextServer --> CharAnalyzer
    NextServer --> Stylo
    NextServer --> SpellSvc
    NextServer --> GDrive
    NextServer --> Discord
    NextServer --> Cloudinary

    Drizzle --> Postgres

    VectorRAG --> LanceDB
    VectorRAG --> GeminiEmbed
    VectorRAG --> NextServer

    PlotAgent --> Typhoon
    PlotAgent --> Groq
    PlotAgent --> NextServer

    CharAnalyzer --> Typhoon
    CharAnalyzer --> NextServer

    Stylo --> Typhoon

    SpellSvc --> PyThaiNLP
    SpellSvc --> SpellCache
    SpellSvc --> NextServer
```

---

## 🚀 ฟีเจอร์หลัก

### ✍️ Writing Studio

Editor ที่ออกแบบมาเพื่อการเขียนนิยายโดยเฉพาะ:

- **Rich Text Editor**: Powered by **Quill.js** พร้อม Toolbar ที่ปรับแต่งแล้ว
- **A5 Page View** (ใหม่ใน v2.1): มุมมองกระดาษ A5 กลางพื้นเทา พร้อมเส้นแบ่งหน้าอัตโนมัติ — เขียนเต็มหน้าเห็นขอบหน้าใหม่ทันที (Focus Mode ยังเป็น single-column immersive)
- **Smart Sidebar**: Panel ด้านข้างแบบ Collapsible พร้อมข้อมูลทุกอย่างที่ต้องใช้ขณะเขียน
  - **NoteCastDeck**: แสดงตัวละครที่ปรากฏในตอนนั้นๆ
  - **NotePlotPanel**: แสดง Timeline Events และ Idea ที่เชื่อมกับ Chapter พร้อมระบบ Mark Active
  - **Plot Summary**: สรุป Note ด้วย AI อัตโนมัติ
- **Note Reference Panel**: เปิดตอนอื่นๆ แบบ Multi-tab ขณะเขียน — ค้นหา/Highlight ข้อความข้ามตอนได้ในที่เดียว
- **Version History**: บันทึกและเปรียบเทียบประวัติการแก้ไข ย้อนกลับได้ทุก Version
- **Note Navigation**: กด Next/Prev เพื่อสลับไปยังตอนถัดไปได้ทันที สร้างตอนใหม่อัตโนมัติถ้ายังไม่มี
- **Word Count Tracking**: นับคำแบบ Real-time และคำนวณยอดรวมทั้งนิยายอัตโนมัติ
- **Note Status**: จัดการสถานะตอน (Draft, In Progress, Done, Published, Proofreading) พร้อม Progress Bar
- **Find & Replace** (`Cmd/Ctrl+F`): ค้นหาและแทนที่ข้อความใน Editor ได้ทันที

### 🔬 Rewrite Workspace (ใหม่ใน v1.5)

โหมดเกลาและตรวจทานต้นฉบับระดับมืออาชีพ ประกอบด้วย 3 ส่วนหลัก:

**Paragraph Rewrite Mode** (`Alt/Option+P`)
- สลับโหมดเกลาย่อหน้าแบบ side-by-side: ซ้าย = ต้นฉบับ, ขวา = กำลังแก้
- **Word-level Diff**: เห็นความเปลี่ยนแปลงทุกคำแบบ inline (เปิด/ปิดด้วย `Alt+D`)
- **Paragraph Bookmarks** (`Alt+B`): Pin ย่อหน้าสำคัญไว้ jump กลับได้ทุกเมื่อ
- **Keyboard Navigation**: `Cmd+↑/↓` เลื่อนย่อหน้า, `Alt+N` เพิ่มย่อหน้าใหม่
- เปรียบเทียบกับ Version ประวัติได้ (เลือก Version จาก Dropdown)

**Audit / Proofreading Panel**
- Flag ปัญหาใน 3 ระดับ: **Developmental** (โครงสร้าง), **Line** (สำนวน), **Proofreading** (คำผิด/ไวยากรณ์)
- เลือกข้อความใน Editor → เพิ่ม Issue พร้อม Description และ Suggested Fix
- **Auto-fix**: แก้คำผิดด้วยคลิกเดียว (ระดับ Proofreading) — offset shift อัตโนมัติ
- **Background Spell Check**: เปลี่ยน Status → Proofreading ระบบตรวจอัตโนมัติ background

**Find & Replace Panel** (`Cmd+F`)
- นับจำนวน Match แบบ Real-time
- Replace All ทั้งใน Quill Mode และ Paragraph Mode

### 📖 Chapter & Project Management

- **Chapter List**: จัดการบท Drag & Drop เรียงลำดับ, กำหนด Status ของแต่ละบท
- **Chapter Overview Board**: Board-view ภาพรวม Chapter + Timeline Events ในแต่ละบท
- **Chapter Summary**: สรุปเนื้อหาใน Chapter ด้วย AI หนึ่งคลิก
- **Export Dialog**: Export นิยายเป็น **PDF**, **TXT** หรือ **ePub** พร้อมปรับแต่ง:
  - หน้าปก (ชื่อเรื่อง, ผู้แต่ง, วันที่)
  - Font Size ระดับ 11pt สำหรับ PDF
  - เรียง Note ตาม createdAt (เก่า→ใหม่)
  - **ePub** (ใหม่ใน v2.1): ไฟล์ ebook พร้อมหน้าปก + สารบัญต่อบท เปิดบน e-reader / ร้าน ebook ได้ (สร้างฝั่ง client ด้วย `epub-gen-memory`)
- **Global Search**: ค้นหา Note/Chapter/ตัวละคร/สถานที่ ทั่วทั้งโปรเจกต์

### 🧩 Idea Playground (Visual Plotting)

Canvas ที่ทรงพลังที่สุดสำหรับวางแผนพล็อต:

- **Infinite Canvas**: วางไอเดีย, ตัวละคร, ฉาก ได้ไม่จำกัด (Powered by **React Flow**)
- **Drag & Drop**: ลาก Character/Location จาก Sidebar ลงใน Scene ได้ทันที (**DnD Kit**)
- **Nested Thoughts**: ซ้อนไอเดียลงในไอเดียอื่นเพื่อจัดกลุ่มความคิด
- **Visual Connections**: ลากเส้นเชื่อมโยงเหตุการณ์เพื่อดู Timeline

### 🗂️ Active Plot Marker

ระบบ Mark Plot ที่กำลังใช้งาน:

- กด ⊙ ที่ **Idea** ในแต่ละ Event เพื่อ Mark ว่ากำลังเขียนถึงไอเดียนั้น
- Idea ที่ถูก Mark จะเปลี่ยนเป็นสีทอง มีกรอบเน้น
- แสดง **"ใช้งานแล้วใน: ..."** ว่า Idea นั้นเคยถูกใช้ไปในตอนไหนบ้างแล้ว
- ข้อมูลบันทึกลง Database ติดไปกับ Note นั้นๆ

### 🌍 World Building

ระบบสร้างโลก (World Building) ครบจบในที่เดียว:

- **Characters**: โปรไฟล์ตัวละครพร้อม Attribute, Power, Life Events, และ Character State (สถานะ ณ ปัจจุบัน)
- **Relationships**: แผนที่ความสัมพันธ์ระหว่างตัวละคร (Graph Visualization)
- **Locations**: สร้างสถานที่แบบ Tree (ประเทศ → เมือง → อาคาร) พร้อม Location Connections
- **Items**: ไอเทมพร้อม Attribute และ Lore ย่อย
- **Factions**: กลุ่ม/องค์กรในนิยาย
- **Lore & Lore Groups**: บันทึกประวัติศาสตร์, กฎของโลก, และเรื่องราวพื้นหลัง
  - **Lore Inspector Panel**: Slide-in Panel ดูรายละเอียด Lore แบบ Quick View โดยไม่ต้องเปิด Dialog เต็ม
  - **Lore Timeline**: Visual Timeline ของ Lore เชื่อมกับ Eras พร้อมระบบกรองและ Inspector
- **Eras**: ยุคสมัยในนิยาย Timeline ประวัติศาสตร์
- **Timeline Events**: เหตุการณ์สำคัญในแต่ละ Chapter พร้อม Scene Element Details

### 🔗 Context Fabric (ใหม่ใน v2.0)

ระบบเชื่อมทุกโมดูลเข้าด้วยกันแบบ MCP — ทุก entity อ้างถึงกันได้อิสระผ่าน reference layer เดียว:

- **@-mention**: พิมพ์ `@` ในตอนเพื่อเชื่อมตัวละคร/สถานที่/ตำนาน/ปม ได้ทุกที่ (สร้าง reference อัตโนมัติ)
- **AI Auto-link**: extractor วิเคราะห์เนื้อหาแล้วสร้างเส้นเชื่อมให้เอง — แยก `ผู้เขียนเชื่อมเอง` vs `AI เดา`
- **World Graph**: หน้ากราฟทั้งโลก เห็นความเชื่อมโยงของทุก entity ในแวบเดียว · ชี้โหนดไฮไลต์เพื่อนบ้าน คลิกเปิดหน้า · กรองตามที่มา (ผู้เขียน/AI) · มี **บรรณารักษ์ (Librarian)** ถาม-ตอบเกี่ยวกับนิยายในตัว
- **Backlink**: ถามได้ทันทีว่า "ตัวละครนี้โผล่ในตอนไหนบ้าง" โดยไม่ต้อง query แยกตาราง

### ⚡ Power System (ใหม่ใน v1.5)

ระบบจัดการพลังในนิยาย Fantasy/Sci-Fi อย่างครบถ้วน:

- **Power Card**: แสดง Power พร้อม Rarity, Type, และ Level ของตัวละครแต่ละคน
- **Power Levels**: บันทึกการเติบโตของพลังแต่ละช่วงเวลา พร้อม Acquired Method
- **Power Combinations**: ระบบสูตรผสมพลัง — กำหนด Source Powers + Required Levels → Result Power
- **Character Power Manager**: จัดการ Power ทั้งหมดของตัวละครใน Tab เดียว
- **Powers View**: หน้ารวม Power ทั้งหมดในโปรเจกต์ พร้อมค้นหา/กรองตาม Type

### 👤 Character Deep-Dive (ใหม่ใน v1.5)

ระบบวิเคราะห์ตัวละครเชิงลึก:

- **Character Design Board**: Board-style layout สำหรับออกแบบบุคลิก, แรงจูงใจ, ความกลัว ของตัวละคร
- **Character Journey**: Timeline การเดินทาง/พัฒนาการของตัวละครตลอดนิยาย
- **Character Timeline Slider**: เลื่อน Slider ดูสถานะตัวละคร (ตำแหน่ง, อารมณ์, สุขภาพ) ณ แต่ละช่วงเวลา
- **Faction Timeline View**: มุมมอง Timeline ของ Faction — ดูว่าตัวละครเข้า/ออกองค์กรเมื่อไหร่
- **Character Ideas Tab**: ไอเดียเฉพาะตัวละคร — เก็บ Scene idea / arc ที่ผูกกับ Character นั้นๆ
- **AI Analysis Dialog**: วิเคราะห์ตัวละครด้วย AI — ดึง Insight จาก Context ทั้งเรื่อง
- **AI Suggestion Card**: ข้อเสนอแนะ AI สำหรับการพัฒนาตัวละคร
- **Export Character Sheet**: Export โปรไฟล์ตัวละครฉบับสมบูรณ์เป็น PDF

### 📊 Analytics Dashboard

- **Account Overview** (`/dashboard/analytics`, ใหม่ใน v2.1): ภาพรวมนักเขียนข้ามทุกเล่ม — คำสะสมทั้งหมด, streak รวมทุกนิยาย, heatmap กิจกรรมรวม, portfolio ทุกเรื่องพร้อม progress เทียบเป้า
- **Activity Calendar**: GitHub-style Writing Heatmap — ดูวันที่เขียนและ Word Count รายวันในรูปแบบ Calendar
- **Writing Statistics**: กราฟ Word Count รายวัน, ประมาณวันเสร็จ
- **Stylometry Dashboard**: วิเคราะห์ **ลายมือเขียน (Writing Style)** เชิงลึก:
  - Sentence Length Distribution, Vocabulary Richness, Readability Score
  - ตรวจว่าสไตล์การเขียนสม่ำเสมอตลอดทั้งเรื่องหรือไม่
  - **Bulk Analyze**: วิเคราะห์ทุก Note ในนิยายพร้อมกัน
- **Character Activity**: วิเคราะห์การปรากฏตัวของตัวละครในแต่ละ Chapter
- **Plot Coverage**: ดูว่า Plot Event ไหนยังไม่ได้เขียน

### 🔗 Google Drive Integration

- **Sync Chapter**: Sync เนื้อหา Chapter ขึ้น Google Drive อัตโนมัติ
- **Conflict Resolution**: จัดการ Conflict ระหว่าง Local กับ Drive version
- **Chapter Drive Sync Button**: Sync รายบท หรือ Sync ทั้งโปรเจกต์

### 🤝 Discord Integration

- **Discord Sync**: โพสต์ Update นิยายเข้า Discord Channel อัตโนมัติ

---

## 🤖 ระบบ AI

### 1. AI Reader Group Chat

จำลอง **"ห้องแชทกลุ่มนักอ่าน"** ที่มี AI 5 คนที่มีบุคลิกต่างกัน ช่วยรีวิวเนื้อหา:

- **Mixed LLM**: ใช้ **Groq (Llama)** สำหรับนักอ่านบางตัว และ **Typhoon v2.1** สำหรับนักอ่านที่ต้องการ Thai Language
- **RAG Context**: ดึง Context จาก Vector DB ก่อนรีวิว เพื่อให้ Feedback สอดคล้องกับนิยายทั้งเรื่อง
- **Streaming Response**: แสดงผลแบบ Real-time

### 2. AI Agent: Plot Hole Checker

Agent อัจฉริยะที่ใช้ Tool Calling ตรวจสอบ:

- `CheckTimelineConflict`: ตรวจเวลาเดินทาง/การปรากฏตัวของตัวละครในสถานที่ต่างๆ
- `ValidateCharacterConsistency`: ตรวจสอบสถานะตัวละครว่าขัดแย้งกับพฤติกรรมหรือไม่
- บันทึก Plot Hole Issues ลง Database พร้อม `plot_hole_count`

### 3. Character State Extractor

- วิเคราะห์ Note ใหม่แล้วสกัด **"สถานะตัวละคร"** ออกมา (ตำแหน่ง, อารมณ์, สถานะสุขภาพ, ความสัมพันธ์ใหม่)
- ทำงาน Background หลังบันทึก Note
- เก็บ Character State History ทุก Snapshot → ใช้ใน Character Timeline Slider

### 4. Stylometry Analysis

- วิเคราะห์ **ลายมือเขียน (Writing Style)** ของนักเขียน
- ตรวจว่าสไตล์การเขียนสม่ำเสมอตลอดทั้งเรื่องหรือไม่
- **Bulk Analyze**: วิเคราะห์ทุก Note ในนิยายพร้อมกัน
- statistical NLP ล้วน (PyThaiNLP) — ไม่ใช้ LLM: pacing/mood, author voice, character vibes, lexical richness + author fingerprint (z-score drift)

> 🔭 **Patch 2.5 (วางแผน)** — *Stylometry Deepening*: ยกระดับจาก "รูปนิ่ง 1 ใบ/ตอน" → "วิดีโอ + ลายนิ้วมือ" — MTLD/MATTR แทน TTR, sentence-rhythm curve, function-word profile + Burrows's Delta, rolling-window จับจุดเพี้ยนระดับย่อหน้า · ดูแผนเต็มที่ [`docs/stylometry-deepening-plan.md`](./docs/stylometry-deepening-plan.md)

### 5. AI Summary (Note & Chapter)

- **Note Summary**: สรุปตอนที่กำลังเขียน
- **Chapter Summary**: รวบรวมสรุปทุก Note ใน Chapter
- ใช้ Typhoon v2.1 เพื่อความเข้าใจภาษาไทยได้ดี

### 6. Spell Checker (Background)

- ตรวจคำผิดอัตโนมัติเมื่อ Note ถูกเปลี่ยนสถานะเป็น **Proofreading**
- ผลลัพธ์ปรากฏใน Audit Panel ของ Rewrite Workspace พร้อม Auto-fix

### 7. Publish Assistant

- ผู้ช่วย AI ช่วยวางแผนการ Publish นิยาย
- วิเคราะห์ความพร้อมของเนื้อหา, แนะนำกลยุทธ์การ Publish

### 8. Word Checker

- ตรวจสอบคำที่ใช้บ่อย/น้อยเกินไป
- ช่วยหาคำที่ใช้ซ้ำซาก และแนะนำทางเลือก

### 9. Graph RAG (Python Microservice + Context Fabric)

- **LanceDB**: เก็บ Embeddings ครอบ **13 entity types** (ตัวละคร/สถานที่/ตำนาน/พลัง/ปม...) ผ่าน embeddable provider
- **FastAPI**: Service ที่ให้ Next.js ดึง Context ก่อนส่งให้ AI
- **Graph RAG**: vector search หา "จุดเริ่ม" → เดิน reference graph 1 hop → ได้ context ทั้ง **เชิงความหมาย (similar) + เชิงโครงสร้าง (connected)** ก่อนป้อน LLM
- Sync เป็น **manual** by design — กด **Vector Sync** ครั้งเดียว rebuild ทั้ง vector embeddings + reference graph index ให้สดพร้อมกัน (ผู้เขียนคุมว่าจะให้ AI เห็นอะไรเมื่อไหร่)

### 10. บรรณารักษ์ (Librarian Q&A) — ใหม่ใน v2.1

ผู้ช่วยถาม-ตอบเกี่ยวกับนิยายของคุณ อยู่บนหน้า **World Graph**:

- **Manual / opt-in**: ผู้เขียนพิมพ์ถามเอง ไม่มี auto — ตรงหลัก *AI รอถูกเรียก ไม่ยัดเยียด*
- **Graph RAG**: ใช้ `retrieveContext` เดียวกับ AI Review — vector + เดินกราฟ 1 hop
- **ตอบจาก canon เท่านั้น**: prompt บังคับตอบจากบริบทที่ดึงมา ไม่มีให้บอกตรงๆ (กัน hallucination) · Groq (Llama) หลัก → Typhoon สำรอง
- **โปร่งใส**: ทุกคำตอบมี source chips คลิกไปหน้า entity ได้ + ปุ่ม **"ทำไมตอบแบบนี้"** กางดูบริบทจริงที่ใช้ตอบ
- **Sync bar ในตัว**: เห็นจำนวนรายการในคลัง + เวลาซิงค์ล่าสุด + กดซิงค์ได้จาก panel
- เก็บประวัติสนทนา (เธรดเดียวต่อนิยาย) ล้างได้

---

## 🛠️ Tech Stack

### Frontend & Backend (Next.js Monolith)

| Technology | Description |
|---|---|
| **Next.js 16** | App Router, Server Actions, TurboPack |
| **Tailwind CSS v4** | Styling Engine (CSS-first config) |
| **React Flow (@xyflow/react)** | Canvas visualization |
| **@dnd-kit** | Drag & Drop interactions |
| **Quill.js / react-quill-new** | Rich Text Editor |
| **diff-match-patch** | Word-level diff ใน Rewrite Workspace |
| **Framer Motion** | Animations & Paragraph transitions |
| **Lucide React** | Icon system |
| **Sonner** | Toast notifications |
| **Better Auth** | Authentication (Email, OAuth) |
| **Drizzle ORM** | TypeScript ORM + Migrations |
| **PostgreSQL / Neon** | Database |
| **Resend + React Email** | Transactional Email |
| **Google Drive API** | Cloud Sync |
| **Cloudinary** | Asset Storage |

### AI / Microservice (Python)

| Technology | Description |
|---|---|
| **FastAPI** | High-performance Python API |
| **LangChain** | Agent Orchestration & Tool Use |
| **LanceDB** | Embeddings & Vector Search |
| **Typhoon v2.1** | Thai Large Language Model |
| **Groq API** | Llama-based fast inference |

---

## 🗄️ โครงสร้างฐานข้อมูล

ระบบมี **48+ tables** ครอบคลุมทุกมิติของการเขียนนิยาย:

| กลุ่ม | Tables |
|---|---|
| **Core** | `novels`, `chapters`, `notes` |
| **Characters** | `characters`, `relationships`, `relationship_history`, `life_events`, `character_states` |
| **World** | `locations`, `location_connections`, `items`, `factions`, `eras` |
| **Lore** | `lore`, `lore_groups`, `entities` |
| **Powers** | `powers`, `character_powers`, `power_levels`, `power_combinations` |
| **Plotting** | `ideas`, `timeline_events`, `scene_element_details`, `connections`, `plot_threads`, `plot_thread_beats` |
| **AI** | `analysis_queue`, `suggestions`, `note_summaries`, `chapter_summaries`, `audit_issues`, `librarian_messages` |
| **Context Fabric** | `references` (ดัชนี derive จาก junction) |
| **Sync** | `version_history`, `drive_sync_states` |
| **Auth** | `users`, `sessions`, `accounts`, `verifications` |

---

## 🗺️ Context Fabric

สถาปัตยกรรมที่ทำให้ทุก module เชื่อมหากันลื่นไหลแบบ MCP — เปลี่ยน Mythoria จากโมดูลที่เอกเทศน์ต่อกัน ให้เป็นระบบเดียวที่ plot เชื่อม character / lore / ปม ได้อิสระ:

```
L4  Graph RAG — vector search + เดิน reference graph 1 hop → context เชิงความหมาย + โครงสร้าง
L3  Knowledge Graph — getNovelGraph() ครอบทุก entity + World Graph UI
L2  RAG / Vector — LanceDB ครอบ 13 entity types (Gemini 768d)
L1  Reference Layer — ตาราง `references` (ดัชนี derive จาก junction · rebuild ตอน Vector Sync · มีทิศทาง + meta + createdBy)
L0  Entity Registry — abstraction เหนือ 48 ตาราง (resolve / search / embeddable)
```

| Phase | ทำอะไร | สถานะ |
|---|---|---|
| 0–1 | Entity Registry + `references` table | ✅ Done |
| 2–3 | Derived reference index — backfill + rebuild ตอน Vector Sync (junction = source of truth) | ✅ Done |
| 5A | AI extractors เขียน references เอง (`createdBy: ai/user`) | ✅ Done |
| 5B | `@`-mention ใน editor (Quill) | ✅ Done |
| 5C | RAG ครอบทุก entity type ผ่าน embeddable provider | ✅ Done |
| 6 | Knowledge Graph + Graph RAG + World Graph UI | ✅ Done |
| — | RAG auto-sync | ⛔️ ตัดทิ้ง (manual by design — ผู้เขียนคุมว่าจะให้ AI เห็นอะไรเมื่อไหร่) |
| 7 | ลบ junction เก่า (cleanup) | ⏳ Planned |

ดูรายละเอียดเต็มได้ที่ [`docs/context-fabric-plan.md`](./docs/context-fabric-plan.md)

---

## 🏁 การติดตั้ง

คุณสามารถเลือกติดตั้งได้ 2 วิธี: **ผ่าน VS Code DevContainers (แนะนำสุดๆ ง่ายมาก)** หรือ **ติดตั้งเองแบบ Manual**

### วิธีที่ 1: ติดตั้งผ่าน VS Code DevContainers (⭐️ แนะนำ)

วิธีนี้จะจำลองสภาพแวดล้อม (Node.js, PostgreSQL, Python) ทั้งหมดให้อัตโนมัติ ทำให้คุณสามารถทำงานข้ามคอมพิวเตอร์หลายเครื่องได้โดยไม่ต้องเสียเวลา Setup ระบบใหม่เลย

1. **เตรียมเครื่องมือ**: ติดตั้ง [Docker Desktop](https://www.docker.com/products/docker-desktop/) และโปรแกรม [VS Code](https://code.visualstudio.com/)
2. **ลง Extension**: ใน VS Code ให้ไปที่หน้า Extensions แล้วติดตั้ง **Dev Containers** (ของ Microsoft)
3. **เปิดโปรเจกต์**:
   ```bash
   git clone https://github.com/Nattachai802/mythoria.git
   cd mythoria
   ```
4. เปิดโฟลเดอร์โปรเจกต์นี้ใน VS Code
5. หน้าต่างมุมขวาล่างจะเด้งถาม ให้กดปุ่ม **Reopen in Container** (หรือกด `F1` แล้วพิมพ์ `Dev Containers: Reopen in Container`)
6. ปล่อยให้ระบบดาวน์โหลดและติดตั้งทุกอย่างให้**อัตโนมัติ** (รัน `npm install`, รัน Database, รัน `db:push` ให้เสร็จสรรพ)
7. เมื่อ Terminal แจ้งว่าโหลดเสร็จเรียบร้อย คุณสามารถสั่งรันเซิร์ฟเวอร์ได้ทันที:
   ```bash
   npm run dev:all
   ```

---

### วิธีที่ 2: ติดตั้งแบบ Manual (สำหรับรันบนเครื่องโดยตรง)

#### 1. Clone Project

```bash
git clone https://github.com/Nattachai802/mythoria.git
cd mythoria
```

#### 2. ติดตั้ง Dependencies

```bash
# Frontend & Backend
npm install

# Python AI Service
cd pythonservice
python -m venv venv
venv\Scripts\activate        # Windows
# หรือ source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

#### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root:

```env
# Database
DATABASE_URL="postgresql://postgres:1234@localhost:5432/mythoria_db"

# Auth
BETTER_AUTH_SECRET="your-secret"
BETTER_AUTH_URL="http://localhost:3000"

# AI APIs
TYPHOON_API_KEY="your-typhoon-key"
GROQ_API_KEY="your-groq-key"

# Google Drive (Optional)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Email (Optional)
RESEND_API_KEY="..."

# Discord (Optional)
DISCORD_BOT_TOKEN="..."
```

สร้างไฟล์ `pythonservice/.env`:

```env
TYPHOON_API_KEY="your-typhoon-key"
DATABASE_URL="postgresql://..."
```

#### 4. Setup Database

```bash
npm run db:push
```

#### 5. รันโปรแกรม

```bash
# รันทั้ง Next.js + Python Service พร้อมกัน
npm run dev:all

# หรือรันแยก
npm run dev          # Next.js (port 3000)
npm run dev:python   # Python Service (port 8000)
```

- **Web App**: `http://localhost:3000`
- **AI Service**: `http://localhost:8000`
- **DB Studio**: `npm run db:studio`

---

## 📄 License

MIT License © 2025 Nattachai802

+==============================================================================+
|                                                                              |
|   /##      /## /##    /## /###### /##   /##  /######  /#######  /###### /###### 
|  | ###    /###|  ##  /##/|_  ##_/| ##  | ## /##__  ##| ##__  ##|_  ##_//##__  ##
|  | ####  /#### \  ##/##/   | ##  | ##  | ##| ##  \ ##| ##  \ ##  | ## | ##  \ ##
|  | ## ##/## ##  \  ###/    | ##  | ####### | ##  | ##| #######/  | ## | #######/
|  | ##  ###| ##   \  ##/    | ##  | ##__  ##| ##  | ##| ##__  ##  | ## | ##__  ##
|  | ##   # | ##    | ##     | ##  | ##  | ##| ##  \ ##| ##  \ ##  | ## | ##  \ ##
|  | ##     | ##    | ##    /######| ##  | ##|  ######/| ##  | ## /######| ##  | ##
|  |__/     |__/    |__/   |______/|__/  |__/ \______/ |__/  |__/|______/|__/  |__/
|                                                                              |
|                THE AI-POWERED FORGE FOR YOUR NEXT MASTERPIECE                |
+==============================================================================+

Mythoria คือแพลตฟอร์มเขียนนิยายยุคใหม่ที่รวมพลัง Project Management + AI อัจฉริยะ + World Building + Plot Engine เข้าไว้ในที่เดียว ออกแบบมาสำหรับนักเขียนที่ต้องการเครื่องมือจริงจัง ไม่ใช่แค่ Text Editor ทั่วไป

[+] Current Version: v2.3+ (Plot Analysis Engine, Echo Score, Power Rules & Sheets Sync)
[+] Design Philosophy: Forge Mode (Industrial Creativity Framework)

==============================================================================
=== สารบัญ (TABLE OF CONTENTS)
==============================================================================

  - [01] DESIGN PHILOSOPHY (แนวคิดการออกแบบ) (#01-design-philosophy)
  - [02] SYSTEM ARCHITECTURE (สถาปัตยกรรมระบบ) (#02-system-architecture)
  - [03] CORE FEATURES (ฟีเจอร์หลัก) (#03-core-features)
  - [04] ADVANCED PLOT & ANALYTICS ENGINE (ระบบวิเคราะห์พล็อต) (#04-advanced-plot--analytics-engine)
  - [05] AI SYSTEMS & MICROSERVICES (ระบบ AI อัจฉริยะ) (#05-ai-systems--microservices)
  - [06] TECH STACK & INTEGRATIONS (เทคโนโลยีที่ใช้) (#06-tech-stack--integrations)
  - [07] DATABASE SCHEMA & SYSTEM TABLES (โครงสร้างฐานข้อมูล) (#07-database-schema--system-tables)
  - [08] CONTEXT FABRIC ARCHITECTURE (สถาปัตยกรรมเชื่อมโยงบริบท) (#08-context-fabric-architecture)
  - [09] INSTALLATION & SETUP GUIDE (การติดตั้งและรันระบบ) (#09-installation--setup-guide)

==============================================================================
=== <a id="01-design-philosophy"></a>[01] DESIGN PHILOSOPHY (แนวคิดการออกแบบ)
==============================================================================

ใช้ Design System ที่พัฒนาขึ้นเองในชื่อ "Forge Mode" (Industrial Creativity Theme)

  +-- Aesthetics: รูปทรงเรขาคณิตตัดมุม, ลวดลายอุตสาหกรรม, Typography แบบ Technical
  +-- Color System: ระบบสี OKLCH เพื่อความสม่ำเสมอใน Light/Dark Mode ทุกสภาพแสง
  +-- Experience: Micro-interactions, Glassmorphism, และ Keyboard Shortcuts ที่ลื่นไหล
  +-- Core Principle: "Tool disappears into the task" — ขณะเขียน UI ไม่แย่งความสนใจ แต่พร้อมเสมอเมื่อต้องการ

==============================================================================
=== <a id="02-system-architecture"></a>[02] SYSTEM ARCHITECTURE (สถาปัตยกรรมระบบ)
==============================================================================

ระบบของ Mythoria ถูกออกแบบด้วยสถาปัตยกรรมแบบ Hybrid Monolith (Next.js) ร่วมกับ Python AI Microservice เพื่อการประมวลผล RAG, Graph RAG และ AI Agents:

```mermaid
graph TD
    subgraph Client ["Client Side (Browser)"]
        UI["Next.js Pages Forge Mode UI"]
        Canvas["Visual Canvas React Flow"]
        Editor["Writing Studio Quill.js"]
        GraphVis["Relationship & World Graph"]
    end

    subgraph WebServer ["Web and Backend Server"]
        NextServer["Next.js Server Actions and APIs"]
        BAuth["Better Auth"]
        Drizzle["Drizzle ORM"]
        ContextFabric["Context Fabric Layer"]
    end

    subgraph AIService ["AI Microservice Python FastAPI port 8000"]
        VectorRAG["Vector and RAG /sync /search"]
        PlotAgent["Plot Hole Agent & Plot Engine"]
        CharAnalyzer["Character Analyzer SSE"]
        Stylo["Stylometry Engine #1-#5"]
        SpellSvc["Spell Checker"]
        LanceDB[("LanceDB Vector DB")]
    end

    subgraph External ["External Services and DB"]
        Postgres[("Neon PostgreSQL")]
        GeminiEmbed["Gemini API Embeddings 768d"]
        Typhoon["Typhoon v2.1 Thai LLM"]
        Groq["Groq API Llama fast inference"]
        PyThaiNLP["PyThaiNLP Spell Check"]
        GDrive["Google Drive & Sheets API"]
        Discord["Discord Webhooks"]
    end

    UI --> NextServer
    Canvas --> NextServer
    Editor --> NextServer
    GraphVis --> NextServer

    NextServer --> BAuth
    NextServer --> Drizzle
    NextServer --> ContextFabric
    NextServer --> VectorRAG
    NextServer --> PlotAgent
    NextServer --> CharAnalyzer
    NextServer --> Stylo
    NextServer --> SpellSvc
    NextServer --> GDrive
    NextServer --> Discord

    Drizzle --> Postgres
    VectorRAG --> LanceDB
    VectorRAG --> GeminiEmbed
    PlotAgent --> Typhoon
    PlotAgent --> Groq
    CharAnalyzer --> Typhoon
    Stylo --> Typhoon
    SpellSvc --> PyThaiNLP
```

==============================================================================
=== <a id="03-core-features"></a>[03] CORE FEATURES (ฟีเจอร์หลัก)
==============================================================================

+------------------------------------------------------------------------------+
| 1. WRITING STUDIO                                                            |
+------------------------------------------------------------------------------+
  |-- Rich Text Editor: Powered by Quill.js พร้อม Toolbar ที่ปรับแต่งเฉพาะ
  |-- A5 Page View: มุมมองกระดาษ A5 กลางพื้นเทา พร้อมเส้นแบ่งหน้าอัตโนมัติ
  |-- Smart Sidebar:
  |     |-- NoteCastDeck: แสดงตัวละครที่ปรากฏในตอนนั้นๆ
  |     |-- NotePlotPanel: แสดง Timeline Events และ Idea ที่เชื่อมกับ Chapter
  |     `-- Plot Summary: สรุป Note ด้วย AI อัตโนมัติ
  |-- Note Reference Panel: เปิดตอนอื่นๆ แบบ Multi-tab พร้อมค้นหา/Highlight ข้ามตอน
  |-- Version History: บันทึกและเปรียบเทียบประวัติการแก้ไขย้อนหลังได้ทุก Version
  |-- Real-time Word Count Tracking & Note Status Management (Draft, Published, ฯลฯ)

+------------------------------------------------------------------------------+
| 2. REWRITE WORKSPACE                                                         |
+------------------------------------------------------------------------------+
  |-- Paragraph Rewrite Mode (Alt/Option+P): สลับโหมดเกลาย่อหน้าแบบ Side-by-Side
  |-- Word-level Diff: แสดงความเปลี่ยนแปลงรายคำด้วย inline diff (Alt+D)
  |-- Paragraph Bookmarks (Alt+B): Pin ย่อหน้าสำคัญสำหรับ Jump กลับทันที
  |-- Audit / Proofreading Panel: Flag ปัญหาใน 3 ระดับ (Developmental, Line, Proofreading)
  |-- Background Spell Check: ตรวจคำผิดอัตโนมัติเมื่อสลับสถานะเป็น Proofreading พร้อม Auto-Fix

+------------------------------------------------------------------------------+
| 3. WORLD BUILDING & WORLD SYSTEMS                                            |
+------------------------------------------------------------------------------+
  |-- Characters & Relationships: โปรไฟล์ตัวละคร, ความสัมพันธ์ (Graph Vis), และ Character States
  |-- Locations & Tree Connections: โครงสร้างสถานที่แบบลำดับชั้น (ประเทศ -> เมือง -> อาคาร)
  |-- World Systems: Primitive เก็บระบบกลาง (ยศ, ลำดับชั้น, Tech Tree, Magic System)
  |     `-- Flexible JSONB Table: ผู้ใช้กำหนดคอลัมน์ Attribute เองได้ พร้อม Presets สำเร็จรูป
  |-- Factions, Items, Eras & Lore Groups: จัดกลุ่มตำนาน, กฎของโลก, และเรื่องราวพื้นหลัง
  |-- Lore Timeline & Lore Inspector Panel: Slide-in Panel ดูรายละเอียดและเชื่อมโยงกับ Eras

+------------------------------------------------------------------------------+
| 4. STORY BIBLE IMPORT                                                        |
+------------------------------------------------------------------------------+
  |-- Batch Extract: สกัดตัวละคร, Factions, Items, Powers และ World Systems จาก Markdown
  |-- Extract-Only Principle: สกัดเฉพาะข้อมูลที่มีอยู่จริง ไม่แต่งเพิ่ม ไม่เดาเนื้อหา
  |-- Safety Net Review: ติ๊กเลือกรายการก่อนกดยืนยันบันทึกลง Database

+------------------------------------------------------------------------------+
| 5. GOOGLE DRIVE & SHEETS DUAL SYNC                                           |
+------------------------------------------------------------------------------+
  |-- Google Drive Chapter Sync: บันทึกและ Sync เนื้อหาบทเรียนขึ้น Cloud อัตโนมัติ
  |-- Google Sheets Bible Sync: Sync ข้อมูลตัวละคร, สถานที่, ไอเทม, Lore ข้ามไปยัง Google Sheets

+------------------------------------------------------------------------------+
| 6. TRASH & RECOVERY SYSTEM                                                   |
+------------------------------------------------------------------------------+
  |-- Soft-Delete Architecture: กู้คืนไฟล์และข้อมูลที่ลบผิด (Notes, Chapters, Entities) ได้ตลอดเวลา

==============================================================================
=== <a id="04-advanced-plot--analytics-engine"></a>[04] ADVANCED PLOT & ANALYTICS ENGINE
==============================================================================

+------------------------------------------------------------------------------+
| 1. PLOT ANALYSIS ENGINE (PHASE 1 - DETERMINISTIC ANALYSIS)                    |
+------------------------------------------------------------------------------+
  |-- Pure Arithmetic Engine: ประมวลผลจาก Story Format ไม่เสียค่า LLM
  |-- 5 Structural Checks (กฎการวิเคราะห์พล็อต):
  |     1. Unpaid Threads (threads_unpaid): ตรวจหาปมที่หว่านแล้วยังไม่มีจังหวะเฉลย
  |     2. Vanished Participants (vanished_participant): ตรวจหาตัวละคร/สิ่งของที่โผล่การ์ดเดียวแล้วหายไป
  |     3. Single-Lane Pacing (single_lane): ตรวจสอบฉากที่เดินเลนเดียวตลอดทั้งฉาก
  |     4. Repetitive Scene Shape (repetitive_shape): ตรวจหาฉากที่มีลำดับปมและจังหวะซ้ำกันเป๊ะ
  |     5. Name-Only Beats (name_only_beat): ตรวจหาจังหวะที่เนื้อความ >50% เป็นเพียงชื่อผู้ร่วมฉาก
  |-- Scene Spine View: แสดงภาพรวมกระดูกสันหลังของแต่ละฉาก (Card count, Lanes used, Thread count)
  |-- Coverage Report: ตรวจความครอบคลุมข้อมูล (เป้าหมายฉาก, ลำดับเวลา, ระยะเวลา, POV, จุดหักเห)

+------------------------------------------------------------------------------+
| 2. ECHO SCORE & PREDICTABILITY (PHASE 2 - LLM JUDGE)                         |
+------------------------------------------------------------------------------+
  |-- Predictability & Twist Detection: วัดว่าการ์ดเหตุการณ์ถัดไป "คาดเดาง่ายแค่ไหน"
  |-- K=8 LLM Sampling: สุ่มเดาทางเลือกถัดไป 8 รูปแบบจากบริบทก่อนหน้า แล้วใช้ LLM ตัดสิน (Hits vs Matched)

+------------------------------------------------------------------------------+
| 3. POWER RULES ENGINE                                                        |
+------------------------------------------------------------------------------+
  |-- Global & Per-Power Boundaries: กำหนดกฎควบคุมขอบเขตพลังระดับเล่มและรายพลัง
  |-- Severity Level (Hard / Soft): แยกกฎบังคับเด็ดขาด (Hard) vs กฎที่ละเมิดได้ถ้าจ่ายราคา (Soft)
  |-- Context Injection: ป้อนกฎเข้า AI Writing Prompt เพื่อป้องกัน AI เขียนหลุดกติกาโลก

+------------------------------------------------------------------------------+
| 4. STYLOMETRY & CONSISTENCY GUARDIAN                                         |
+------------------------------------------------------------------------------+
  |-- Stylometry Analysis (#1-#5): วิเคราะห์ลายนิ้วมือการเขียน (MTLD/MATTR, Rhythm, Burstiness, POS n-gram)
  |-- Consistency Guardian: ตรวจจับข้อผิดพลาดเชิงโครงสร้าง (เช่น ตัวละครสถานะ dead แต่โผล่ในบทถัดมา)

==============================================================================
=== <a id="05-ai-systems--microservices"></a>[05] AI SYSTEMS & MICROSERVICES
==============================================================================

  [+] AI Reader Group Chat: จำลองห้องแชทนักอ่าน 5 บุคลิก (Groq Llama + Typhoon Thai LLM)
  [+] Plot Hole Checker Agent: Agent ตรวจสอบความขัดแย้งของเวลาและการปรากฏตัว
  [+] Character State Extractor: วิเคราะห์และสกัดสถานะตัวละครหลังบันทึก Note
  [+] Librarian Q&A (บรรณารักษ์ประจำเรื่อง): ถาม-ตอบข้อมูลนิยายบนหน้า World Graph จาก Canon เท่านั้น
  [+] Graph RAG Pipeline: ดึง Context ผ่าน Vector Search + Reference Graph 1 Hop ก่อนส่งให้ LLM

==============================================================================
=== <a id="06-tech-stack--integrations"></a>[06] TECH STACK & INTEGRATIONS
==============================================================================

  +-- FRONTEND & BACKEND (Next.js Monolith)
  |     |-- Next.js 16 (App Router, Server Actions, TurboPack)
  |     |-- Tailwind CSS v4 (CSS-first configuration)
  |     |-- React Flow (@xyflow/react) & @dnd-kit (Canvas & Drag-and-Drop)
  |     |-- Quill.js / react-quill-new (Rich Text Editing)
  |     |-- Better Auth (Authentication & Invite-only controls)
  |     `-- Drizzle ORM + Neon PostgreSQL

  +-- AI & MICROSERVICES (Python FastAPI)
        |-- FastAPI & LangChain (Agent Orchestration)
        |-- LanceDB (Vector Store & Embedded Search)
        |-- Typhoon v2.1 & Groq API (Thai LLM & Fast Llama Inference)
        `-- PyThaiNLP (Statistical Thai NLP & Spell Checker)

==============================================================================
=== <a id="07-database-schema--system-tables"></a>[07] DATABASE SCHEMA & SYSTEM TABLES
==============================================================================

ระบบใช้ทั้งหมด 56+ Tables แบ่งตามหน้าที่หลัก:

  +-- Core: novels, chapters, notes, note_versions, tags, chapter_tags
  +-- Characters: characters, character_relationships, character_states, character_factions, ฯลฯ
  +-- World: locations, location_connections, items, factions, eras, world_systems
  +-- Powers: powers, character_powers, power_levels, power_combinations, power_rules
  +-- Plotting: ideas, idea_connections, timeline_events, plot_threads, story_arcs
  +-- Analytics & AI: chapter_stylometry, note_audit_issues, librarian_messages, ai_suggestions
  +-- Context Fabric: references (Derive reference index from junctions)
  +-- Auth & System: user, session, account, invitations, drive_credentials, drive_settings

==============================================================================
=== <a id="08-context-fabric-architecture"></a>[08] CONTEXT FABRIC ARCHITECTURE
==============================================================================

  L4  Graph RAG — Vector search + เดิน reference graph 1 hop -> ได้ context เชิงความหมาย + โครงสร้าง
  L3  Knowledge Graph — getNovelGraph() ครอบทุก entity + World Graph UI (สลับ views ได้)
  L2  RAG / Vector — LanceDB ครอบ 14 entity types (Gemini 768d)
  L1  Reference Layer — ตาราง `references` ( derive จาก junction · rebuild ตอน Vector Sync )
  L0  Entity Registry — Abstraction เหนือ 56 ตาราง (resolve / search / embeddable)

==============================================================================
=== <a id="09-installation--setup-guide"></a>[09] INSTALLATION & SETUP GUIDE
==============================================================================

------------------------------------------------------------------------------
METHOD 1: DEV CONTAINERS (RECOMMENDED)
------------------------------------------------------------------------------
  1. ติดตั้ง Docker Desktop และ VS Code พร้อม Extension "Dev Containers"
  2. Clone Repository:
     $ git clone https://github.com/Nattachai802/mythoria.git
     $ cd mythoria
  3. เปิดโฟลเดอร์ใน VS Code แล้วเลือก "Reopen in Container"
  4. รันคำสั่งเริ่มระบบ:
     $ npm run dev:all

------------------------------------------------------------------------------
METHOD 2: MANUAL INSTALLATION
------------------------------------------------------------------------------
  1. Install Dependencies:
     $ npm install
     $ cd pythonservice && python -m venv venv
     $ venv\Scripts\activate   # Windows (หรือ source venv/bin/activate บน Mac/Linux)
     $ pip install -r requirements.txt

  2. Setup Environment Variables (.env):
     DATABASE_URL="postgresql://postgres:1234@localhost:5432/mythoria_db"
     BETTER_AUTH_SECRET="your-secret"
     TYPHOON_API_KEY="your-typhoon-key"
     GROQ_API_KEY="your-groq-key"
     INTERNAL_API_KEY="..."

  3. Database & Dev Server:
     $ npm run db:push
     $ npm run dev:all

==============================================================================
LICENSE: MIT License (c) 2025 Nattachai802
==============================================================================

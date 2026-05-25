# Mythoria 🖋️✨

**The AI-Powered Forge for Your Next Masterpiece.**

**Mythoria** คือแพลตฟอร์มเขียนนิยายยุคใหม่ที่รวมพลัง Project Management + AI อัจฉริยะ + World Building เข้าไว้ในที่เดียว ออกแบบมาสำหรับนักเขียนที่ต้องการเครื่องมือจริงจัง ไม่ใช่แค่ Text Editor ทั่วไป

---

## 📑 สารบัญ

- [🎨 Design Philosophy](#-design-philosophy)
- [🏗️ System Architecture](#-system-architecture)
- [🚀 ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [🤖 ระบบ AI](#-ระบบ-ai)
- [🛠️ Tech Stack](#-tech-stack)
- [🗄️ โครงสร้างฐานข้อมูล](#-โครงสร้างฐานข้อมูล)
- [🏁 การติดตั้ง](#-การติดตั้ง)

---

## 🎨 Design Philosophy

ใช้ Design System ที่พัฒนาขึ้นเองในชื่อ **"Forge Mode"** (Industrial Creativity Theme)

- **Aesthetics**: รูปทรงเลขาคณิตตัดมุม, ลวดลายอุตสาหกรรม, Typography แบบ Technical
- **Color System**: ระบบสี **OKLCH** เพื่อความสม่ำเสมอใน Light/Dark Mode ทุกสภาพแสง
- **Experience**: Micro-interactions, Glassmorphism, และ Keyboard Shortcuts ที่รู้สึก Premium

---

## 🏗️ System Architecture

ระบบของ **Mythoria** ถูกออกแบบด้วยสถาปัตยกรรมแบบ Hybrid Monolith (Next.js) ร่วมกับ Python AI Microservice เพื่อการประมวลผล RAG และ AI Agent แยกส่วนอย่างมีประสิทธิภาพ:

```mermaid
graph TD
    subgraph Client ["Client Side (Browser)"]
        UI["Next.js Pages (Forge Mode UI)"]
        Canvas["Visual Canvas (React Flow)"]
        Editor["Writing Studio (Quill.js)"]
        GraphVis["Relationship Graph (react-force-graph)"]
    end

    subgraph WebServer ["Web & Backend Server"]
        NextServer["Next.js Server Actions / APIs"]
        BAuth["Better Auth"]
        Drizzle["Drizzle ORM"]
    end

    subgraph AIService ["AI Microservice (Python)"]
        FastAPI["FastAPI App"]
        LangChain["LangChain (Agent Orchestration)"]
        LanceDB[("LanceDB (Vector DB)")]
    end

    subgraph External ["External Services & DB"]
        Postgres[("Neon PostgreSQL")]
        Typhoon["Typhoon v2.1 API"]
        Groq["Groq API (Llama)"]
        GDrive["Google Drive API"]
        Discord["Discord Webhooks / API"]
        Cloudinary["Cloudinary (Asset Store)"]
    end

    UI --> NextServer
    Canvas --> NextServer
    Editor --> NextServer
    GraphVis --> NextServer

    NextServer --> BAuth
    NextServer --> Drizzle
    NextServer --> FastAPI
    NextServer --> GDrive
    NextServer --> Discord
    NextServer --> Cloudinary

    Drizzle --> Postgres

    FastAPI --> LangChain
    LangChain --> LanceDB
    LangChain --> Typhoon
    LangChain --> Groq
    FastAPI --> Postgres
```

---

## 🚀 ฟีเจอร์หลัก

### ✍️ Note Editor (Writing Studio)

Editor ที่ออกแบบมาเพื่อการเขียนนิยายโดยเฉพาะ:

- **Rich Text Editor**: Powered by **Quill.js** พร้อม Toolbar ที่ปรับแต่งแล้ว
- **Smart Sidebar**: Panel ด้านข้างแบบ Collapsible พร้อมข้อมูลทุกอย่างที่ต้องใช้ขณะเขียน
  - **NoteCastDeck**: แสดงตัวละครที่ปรากฏในตอนนั้นๆ
  - **NotePlotPanel**: แสดง Timeline Events และ Idea ที่เชื่อมกับ Chapter พร้อมระบบ Mark Active
  - **Plot Summary**: สรุป Note ด้วย AI อัตโนมัติ
- **Version History**: บันทึกและเปรียบเทียบประวัติการแก้ไข ย้อนกลับได้ทุก Version
- **Note Navigation**: กด Next/Prev เพื่อสลับไปยังตอนถัดไปได้ทันที สร้างตอนใหม่อัตโนมัติถ้ายังไม่มี
- **Word Count Tracking**: นับคำแบบ Real-time และคำนวณยอดรวมทั้งนิยายอัตโนมัติ
- **Note Status**: จัดการสถานะตอน (Draft, In Progress, Done, Published) พร้อม Progress Bar

### 📖 Chapter & Project Management

- **Chapter List**: จัดการบท Drag & Drop เรียงลำดับ, กำหนด Status ของแต่ละบท
- **Chapter Summary**: สรุปเนื้อหาใน Chapter ด้วย AI หนึ่งคลิก
- **Export Dialog**: Export นิยายเป็น **PDF** หรือ **TXT** พร้อมปรับแต่ง:
  - หน้าปก (ชื่อเรื่อง, ผู้แต่ง, วันที่)
  - Font Size ระดับ 11pt สำหรับ PDF
  - เรียง Note ตาม createdAt (เก่า→ใหม่)
- **Global Search**: ค้นหา Note/Chapter/ตัวละคร/สถานที่ ทั่วทั้งโปรเจกต์

### 🧩 Idea Playground (Visual Plotting)

Canvas ที่ทรงพลังที่สุดสำหรับวางแผนพล็อต:

- **Infinite Canvas**: วางไอเดีย, ตัวละคร, ฉาก ได้ไม่จำกัด (Powered by **React Flow**)
- **Drag & Drop**: ลาก Character/Location จาก Sidebar ลงใน Scene ได้ทันที (**DnD Kit**)
- **Nested Thoughts**: ซ้อนไอเดียลงในไอเดียอื่นเพื่อจัดกลุ่มความคิด
- **Visual Connections**: ลากเส้นเชื่อมโยงเหตุการณ์เพื่อดู Timeline

### 🌍 World Building

ระบบสร้างโลก (World Building) ครบจบในที่เดียว:

- **Characters**: โปรไฟล์ตัวละครพร้อม Attribute, Power, Life Events, และ Character State (สถานะ ณ ปัจจุบัน)
- **Relationships**: แผนที่ความสัมพันธ์ระหว่างตัวละคร (Graph Visualization)
- **Locations**: สร้างสถานที่แบบ Tree (ประเทศ → เมือง → อาคาร) พร้อม Location Connections
- **Items**: ไอเทมพร้อม Attribute และ Lore ย่อย
- **Factions**: กลุ่ม/องค์กรในนิยาย
- **Lore & Lore Groups**: บันทึกประวัติศาสตร์, กฎของโลก, และเรื่องราวพื้นหลัง
- **Eras**: ยุคสมัยในนิยาย Timeline ประวัติศาสตร์
- **Timeline Events**: เหตุการณ์สำคัญในแต่ละ Chapter พร้อม Scene Element Details

### 🗂️ Active Plot Marker

ระบบ Mark Plot ที่กำลังใช้งาน (ใหม่!):

- กด ⊙ ที่ **Idea** ในแต่ละ Event เพื่อ Mark ว่ากำลังเขียนถึงไอเดียนั้น
- Idea ที่ถูก Mark จะเปลี่ยนเป็นสีทอง มีกรอบเน้น
- แสดง **"ใช้งานแล้วใน: ..."** ว่า Idea นั้นเคยถูกใช้ไปในตอนไหนบ้างแล้ว
- ข้อมูลบันทึกลง Database ติดไปกับ Note นั้นๆ

### 📊 Analytics Dashboard

- **Writing Statistics**: กราฟ Word Count รายวัน, ประมาณวันเสร็จ
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
- เก็บ Character State History ทุก Snapshot

### 4. Stylometry Analysis

- วิเคราะห์ **ลายมือเขียน (Writing Style)** ของนักเขียน
- ตรวจว่าสไตล์การเขียนสม่ำเสมอตลอดทั้งเรื่องหรือไม่
- **Bulk Analyze**: วิเคราะห์ทุก Note ในนิยายพร้อมกัน

### 5. AI Summary (Note & Chapter)

- **Note Summary**: สรุปตอนที่กำลังเขียน
- **Chapter Summary**: รวบรวมสรุปทุก Note ใน Chapter
- ใช้ Typhoon v2.1 เพื่อความเข้าใจภาษาไทยได้ดี

### 6. Publish Assistant

- ผู้ช่วย AI ช่วยวางแผนการ Publish นิยาย
- วิเคราะห์ความพร้อมของเนื้อหา, แนะนำกลยุทธ์การ Publish

### 7. Word Checker

- ตรวจสอบคำที่ใช้บ่อย/น้อยเกินไป
- ช่วยหาคำที่ใช้ซ้ำซาก และแนะนำทางเลือก

### 8. Vector Search & RAG (Python Microservice)

- **LanceDB**: เก็บ Embeddings ของ Note/Chapter ทั้งหมด
- **FastAPI**: Service ที่ให้ Next.js ดึง Context ก่อนส่งให้ AI
- Similarity Search แบบ Semantic บนเนื้อหาทั้งเรื่อง

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
| **Lucide React** | Icon system |
| **Framer Motion** | Animations |
| **Sonner** | Toast notifications |
| **Better Auth** | Authentication (Email, OAuth) |
| **Drizzle ORM** | TypeScript ORM + Migrations |
| **PostgreSQL / Neon** | Database |
| **Resend + React Email** | Transactional Email |
| **Google Drive API** | Cloud Sync |

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

ระบบมี **45+ tables** ครอบคลุมทุกมิติของการเขียนนิยาย:

| กลุ่ม | Tables |
|---|---|
| **Core** | `novels`, `chapters`, `notes` |
| **Characters** | `characters`, `relationships`, `life_events`, `character_states` |
| **World** | `locations`, `location_connections`, `items`, `factions`, `eras` |
| **Lore** | `lore`, `lore_groups`, `entities` |
| **Plotting** | `ideas`, `timeline_events`, `scene_element_details`, `connections` |
| **AI** | `analysis_queue`, `suggestions`, `note_summaries`, `chapter_summaries` |
| **Sync** | `version_history`, `drive_sync_states` |
| **Auth** | `users`, `sessions`, `accounts`, `verifications` |

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

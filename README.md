# Mythoria 🖋️✨

**The AI-Powered Forge for Your Next Masterpiece.**

**Mythoria** คือแพลตฟอร์มเขียนนิยายยุคใหม่ที่ผสานพลังของการจัดการโปรเจกต์ (Project Management) เข้ากับ AI Agent อัจฉริยะ ช่วยให้นักเขียนสามารถสร้างโลก (World Building), วางพล็อต (Plotting), และเขียนเนื้อหา (Writing) ได้อย่างไร้รอยต่อ

โดดเด่นด้วยดีไซน์แบบ **"Forge Mode"** ที่เน้นความสวยงาม ดุดัน และใช้งานได้จริง (Industrial Creativity)

![Mythoria Banner](https://placeholder-image.com/mythoria-banner.png)

---

## 📑 สารบัญ

- [🎨 Design Philosophy](#-design-philosophy-forge-mode)
- [🚀 ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [🛠️ เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [🤖 ระบบ AI &amp; Agents](#-ระบบ-ai--agents)
- [🗄️ โครงสร้างฐานข้อมูล](#-โครงสร้างฐานข้อมูล)
- [🏁 การติดตั้ง](#-การติดตั้ง)

---

## 🎨 Design Philosophy: Forge Mode

เราใช้ Design System ที่พัฒนาขึ้นเองในชื่อ **"Forge Mode"** (Industrial Creativity Theme)

- **Aesthetics**: เน้นรูปทรงเลขาคณิตตัดมุม (Chamfered corners), ลวดลายอุตสาหกรรม (Hazard stripes), และ Typography แบบ Technical
- **Color System**: ใช้ระบบสี **OKLCH** เพื่อความสดใสและสม่ำเสมอในทุกสภาพแสง (Light/Dark Mode)
- **Experience**: Micro-interactions, Glassmorphism, และเสียงตอบสนองที่ให้ความรู้สึก Premium

---

## 🚀 ฟีเจอร์หลัก

### 🧩 Idea Playground (Visual Plotting)

พื้นที่วางแผนแบบ Free-form canvas ที่ทรงพลังที่สุด:

- **Infinite Canvas**: วางไอเดีย, ตัวละคร, ฉาก ได้ไม่จำกัด (Powered by **React Flow**)
- **Drag & Drop**: ลาก Character/Location จากด้านข้างลงมาใส่ใน Scene ได้ทันทีด้วย **DnD Kit**
- **Nested Thoughts**: ซ้อนไอเดียลงในไอเดียอื่นเพื่อจัดกลุ่มความคิด
- **Visual Connections**: ลากเส้นเชื่อมโยงเหตุการณ์เพื่อดู Timeline และความสัมพันธ์

### 🧠 AI Agent Assistant

ผู้ช่วยอัจฉริยะที่เข้าใจนิยายของคุณ (Powered by **Typhoon v2.1 Thai LLM**):

- **Plot Hole Detection**: AI Agent จะอ่านเนื้อหาและใช้ Tools ตรวจสอบ Timeline และตรรกะของเรื่องอัตโนมัติ
- **Consistency Check**: ตรวจสอบว่าตัวละครทำสิ่งที่ขัดแย้งกับนิสัยหรือสถานะปัจจุบันหรือไม่
- **RAG & Vector Search**: ค้นหาข้อมูลเก่าๆ ในนิยายได้แม่นยำด้วย **LanceDB**

### 📚 Professional Writing Suite

- **Chapter Editor**: Rich text editor ที่ปรับแต่งมาสำหรับงานเขียนนิยายโดยเฉพาะ
- **World Building**: ระบบจัดการตัวละคร, สถานที่, ไอเทม, และความสัมพันธ์ที่เชื่อมโยงกันหมด
- **Timeline Board**: มุมมองเส้นเวลาประวัติศาสตร์ของโลกในนิยาย

---

## 🛠️ เทคโนโลยีที่ใช้

Project นี้ใช้ Tech Stack ที่ทันสมัยที่สุดในปี 2025:

### Frontend (Main App)

| Technology                                         | Description                           |
| -------------------------------------------------- | ------------------------------------- |
| **[Next.js 16](https://nextjs.org/)**           | App Router, Server Actions, TurboPack |
| **[Tailwind CSS v4](https://tailwindcss.com/)** | Styling Engine                        |
| **react-flow**                               | Node-based visualization (Canvas)     |
| **@dnd-kit**                                 | Drag and Drop interactions            |
| **lucide-react**                             | Beautiful consistency icons           |
| **framer-motion**                            | Smooth animations                     |

### Backend (Data & Auth)

| Technology                                         | Description                 |
| -------------------------------------------------- | --------------------------- |
| **[PostgreSQL](https://www.postgresql.org/)**   | Relational Database         |
| **[Drizzle ORM](https://orm.drizzle.team/)**    | TypeScript ORM & Migrations |
| **[Better Auth](https://www.better-auth.com/)** | Secure Authentication       |

### AI Service (Microservice)

| Technology                                      | Description                    |
| ----------------------------------------------- | ------------------------------ |
| **[FastAPI](https://fastapi.tiangolo.com/)** | High-performance Python API    |
| **[LangChain](https://www.langchain.com/)**  | Agent Orchestration & Tool Use |
| **[LanceDB](https://lancedb.com/)**          | Embeddings & Vector Search     |
| **[Typhoon v2.1](https://opentyphoon.ai/)**  | Thai Large Language Model      |

---

## 🤖 ระบบ AI & Agents

ระบบ AI ของ Mythoria ทำงานแยกเป็น Microservice (`/pythonservice`) เพื่อประสิทธิภาพสูงสุด:

1. **Agentic Workflow**: AI ไม่ได้แค่ตอบแชท แต่ทำหน้าที่เป็น Agent ที่สามารถเรียกใช้ Tools ได้
   * `CheckTimelineConflict`: คำนวณเวลาเดินทางระหว่างสถานที่
   * `ValidateCharacterConsistency`: ตรวจสอบสถานะตัวละคร
2. **Context-Aware**: ใช้ RAG (Retrieval-Augmented Generation) ดึงข้อมูลที่เกี่ยวข้องจาก Vector DB ก่อนตอบคำถาม

---

## 🗄️ โครงสร้างฐานข้อมูล

ระบบมี **30+ tables** ครอบคลุมทุกมิติของการเขียนนิยาย:

- **Core**: `novels`, `chapters`, `notes`
- **Character**: `characters`, `relationships`, `life_events`
- **World**: `locations`, `items`, `lore`, `factions`
- **Plotting**: `ideas`, `timeline_events`, `connections`
- **AI**: `analysis_queue`, `suggestions`, `embeddings`

---

## 🏁 การติดตั้ง

### 1. Clone Project

```bash
git clone <repository-url>
cd mythoria
```

### 2. ติดตั้ง Dependencies

```bash
# Frontend & Main Backend
npm install (อย่าลืมใส่ --legacy-peer-deps)

# AI Service (Python)
cd pythonservice
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
pip install -r requirements.txt
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root และ `pythonservice/.env`:

```env
# Main .env
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="your-secret"

# Pythonservice .env
TYPHOON_API_KEY="your-api-key"
```

### 4. รันโปรแกรม (Development Mode)

```bash
# รันทั้ง Next.js และ Python Service พร้อมกัน
npm run dev:all
```

- Web App: `http://localhost:3000`
- AI API: `http://localhost:8000`

---

## 📄 License

MIT License

# Mythoria 🖋️✨

**Mythoria** เป็น Web Application สำหรับนักเขียนนิยายที่ต้องการจัดการโปรเจกต์เขียนนิยายอย่างครบวงจร ตั้งแต่การสร้างตัวละคร สร้างโลก วางพล็อต ไปจนถึงการเขียนเนื้อหา พร้อมระบบ AI ช่วยวิเคราะห์

---

## 📑 สารบัญ

- [ฟีเจอร์หลัก](#-ฟีเจอร์หลัก)
- [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [โครงสร้างฐานข้อมูล](#-โครงสร้างฐานข้อมูล)
- [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [การติดตั้ง](#-การติดตั้ง)
- [การใช้งาน](#-การใช้งาน)

---

## 🚀 ฟีเจอร์หลัก

### 📚 จัดการโปรเจกต์
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Dashboard** | ศูนย์กลางจัดการนิยายทั้งหมด |
| **สถิติ** | ติดตาม word count, ความคืบหน้า, สถานะบท |
| **จัดการข้อมูล** | แก้ไข title, description, status, visibility |

### ✍️ เครื่องมือเขียน
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Chapter Editor** | Rich text editor (Quill) |
| **Notes System** | โน้ตประกอบแต่ละ chapter พร้อม Plot Hole Tracking |
| **Cast Deck** | เลือกตัวละครที่ปรากฏใน note |

### 👥 ระบบตัวละคร
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Character Profiles** | ข้อมูลครบ (role, appearance, personality, goals, aliases) |
| **Relationship Board** | แสดงความสัมพันธ์เป็น network graph |
| **Life Events** | เหตุการณ์สำคัญในชีวิตตัวละคร |
| **Faction Timeline** | ตัวละครอยู่กลุ่มไหนเมื่อไหร่ |
| **Power Manager** | จัดการพลังที่ตัวละครมี |

### 🎯 ระบบพลัง (Power System)
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Power Definition** | นิยามพลัง + ข้อจำกัด + rarity |
| **Power Levels** | แต่ละระดับมี pros/cons/changes |
| **Power Combinations** | รวมพลังหลายอย่าง |

### 🌍 สร้างโลก (World Building)
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Locations** | สถานที่แบบ hierarchy + map connections + travel time |
| **Lore Timeline** | ประวัติศาสตร์โลกแบบ visual (ยุคสมัย, กลุ่ม) |
| **Items/Artifacts** | ไอเทม อาวุธ ของวิเศษ |
| **Entities** | สิ่งมีชีวิต มอนสเตอร์ + threat level |
| **Factions** | กลุ่มก๊วนต่างๆ |

### 🧩 วางพล็อต
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Timeline Board** | วางเหตุการณ์บน timeline |
| **Idea Playground** | Canvas สำหรับวางไอเดีย (React Flow) |
| **Idea Connections** | เชื่อมโยงไอเดียถึงกัน |

### 🤖 AI Features
| ฟีเจอร์ | รายละเอียด |
|--------|-----------|
| **Character Analysis** | วิเคราะห์ความสัมพันธ์/เหตุการณ์จากเนื้อหาอัตโนมัติ |
| **Plot Hole Detection** | ตรวจหาข้อขัดแย้งในเนื้อเรื่อง |
| **State Extraction** | ดึงสถานะตัวละคร ณ จุดต่างๆ |
| **Vector Search** | ค้นหาเนื้อหาที่เกี่ยวข้องแบบอัจฉริยะ |
| **AI Suggestions** | แนะนำข้อมูลที่รอ user review |

---

## 🛠️ เทคโนโลยีที่ใช้

### Frontend
| เทคโนโลยี | เวอร์ชัน |
|----------|---------|
| [Next.js](https://nextjs.org/) | 16 (App Router) |
| [React](https://react.dev/) | 19 |
| [TypeScript](https://www.typescriptlang.org/) | 5 |
| [Tailwind CSS](https://tailwindcss.com/) | v4 |

### UI Components
| Library | หน้าที่ |
|---------|--------|
| [Radix UI](https://www.radix-ui.com/) | Accessible components |
| [Lucide React](https://lucide.dev/) | Icons |
| [DnD Kit](https://dndkit.com/) | Drag-and-drop |
| [React Flow](https://reactflow.dev/) | Node-based visualizations |
| [Sonner](https://sonner.emilkowal.ski/) | Toast notifications |

### Backend
| เทคโนโลยี | หน้าที่ |
|----------|--------|
| [PostgreSQL](https://www.postgresql.org/) | Database |
| [Drizzle ORM](https://orm.drizzle.team/) | ORM + Migrations |
| [Better Auth](https://www.better-auth.com/) | Authentication |
| [Zod](https://zod.dev/) | Validation |

### AI Service (Python)
| เทคโนโลยี | หน้าที่ |
|----------|--------|
| [FastAPI](https://fastapi.tiangolo.com/) | REST API |
| [LanceDB](https://lancedb.com/) | Vector Database |
| [Gemini AI](https://ai.google.dev/) | AI Analysis |

---

## 🗄️ โครงสร้างฐานข้อมูล

ระบบมี **30+ tables** แบ่งเป็นกลุ่มหลักๆ:

### Authentication
`user` • `session` • `account` • `verification`

### Core Novel
`novels` • `chapters` • `notes` • `tags`

### Character System
`characters` • `characterRelationships` • `relationshipHistory` • `characterLifeEvents` • `characterStates` • `characterFactions` • `characterPowers` • `chapterCharacters` • `noteCharacters` • `aliasCache`

### Power System
`powers` • `powerLevels` • `powerCombinations`

### World Building
`locations` • `locationConnections` • `factions` • `items` • `entities` • `locationEntities` • `eras` • `loreEntries` • `loreGroups`

### Plotting
`timelineEvents` • `ideas` • `ideaConnections`

### AI Analysis
`characterAnalysisQueue` • `aiSuggestions` • `stateExtractionQueue`

---

## 📂 โครงสร้างโปรเจกต์

```
mythoria/
├── app/                          # Next.js App Router pages
│   ├── api/                      # API routes
│   │   ├── auth/                 # Better Auth
│   │   ├── novel/                # Novel-related APIs
│   │   └── upload/               # File upload
│   ├── dashboard/                # Main interface
│   │   └── project/[id]/         # Project workspace
│   │       ├── chapter/          # Chapter editor
│   │       ├── characters/       # Character management
│   │       ├── locations/        # Location management
│   │       ├── powers/           # Power system
│   │       ├── relationships/    # Relationship board
│   │       ├── worldbuilding/    # Lore, items, entities
│   │       └── plot/             # Timeline & Ideas
│   └── (auth pages)
│
├── components/                   # React Components (84+ files)
│   ├── project/                  # Project-specific
│   │   ├── character/            # 23 components
│   │   ├── location/             # 10 components
│   │   ├── power/                # 7 components
│   │   ├── worldbuilding/        # 12 components
│   │   └── ...
│   └── ui/                       # Shadcn/ui
│
├── server/                       # Server Actions (31 files)
│   ├── novel.ts, chapter.ts, character.ts
│   ├── power.ts, locations.ts, factions.ts
│   ├── lore.ts, timeline.ts, idea.ts
│   └── ai.ts, character-state-*.ts
│
├── db/
│   ├── schema.ts                 # Drizzle schema (1388 lines)
│   └── drizzle.ts
│
├── lib/                          # Utilities
│
├── pythonservice/                # AI Service
│   ├── main.py                   # FastAPI endpoints
│   ├── ai_agent.py               # Plot analysis
│   ├── character_analyzer.py
│   ├── lance_client.py
│   └── tools/                    # Timeline checker, validator
│
└── migrations/                   # Drizzle migrations
```

---

## 🏁 การติดตั้ง

### ความต้องการ
- Node.js (LTS ล่าสุด)
- PostgreSQL
- Python 3.10+ (สำหรับ AI Service)

### ขั้นตอน

**1. Clone repository**
```bash
git clone <repository-url>
cd mythoria
```

**2. ติดตั้ง dependencies**
```bash
npm install
```

**3. ตั้งค่า Environment**

สร้างไฟล์ `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mythoria"
BETTER_AUTH_SECRET="your-secret-key"
```

**4. สร้างฐานข้อมูล**
```bash
npm run db:push
```

**5. ตั้งค่า Python Service** (optional)
```bash
cd pythonservice
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

---

## 🎮 การใช้งาน

### รัน Development Server
```bash
# Next.js only
npm run dev

# Next.js + Python AI Service
npm run dev:all
```

เปิด [http://localhost:3000](http://localhost:3000) เพื่อเริ่มใช้งาน

### Database Commands
| คำสั่ง | หน้าที่ |
|-------|--------|
| `npm run db:push` | Push schema to database |
| `npm run db:generate` | Generate migration |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Drizzle Studio |

---

## 📄 License

MIT License

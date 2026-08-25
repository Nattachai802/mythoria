```text
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
```

Mythoria is a next-generation novel writing and story architecture platform integrating Project Management, AI Agents, World Building, and Deterministic Plot Analysis into a single workspace. Designed specifically for serious authors who need more than just a plain text editor.

[+] Current Version: v0.5.0 (Plot Analysis Engine, Echo Score, Power Rules, Stylometry & Dual Sync)
[+] Design Philosophy: Forge Mode (Industrial Creativity Framework)

---

## TABLE OF CONTENTS

- [[01] DESIGN PHILOSOPHY](#01-design-philosophy)
- [[02] SYSTEM ARCHITECTURE](#02-system-architecture)
- [[03] CORE FEATURES](#03-core-features)
- [[04] ADVANCED PLOT & ANALYTICS ENGINE](#04-advanced-plot--analytics-engine)
- [[05] AI SYSTEMS & MICROSERVICES](#05-ai-systems--microservices)
- [[06] TECH STACK & INTEGRATIONS](#06-tech-stack--integrations)
- [[07] DATABASE SCHEMA & SYSTEM TABLES](#07-database-schema--system-tables)
- [[08] CONTEXT FABRIC ARCHITECTURE](#08-context-fabric-architecture)
- [[09] INSTALLATION & SETUP GUIDE](#09-installation--setup-guide)

---

## <a id="01-design-philosophy"></a>[01] DESIGN PHILOSOPHY

Mythoria utilizes a custom design system called "Forge Mode" (Industrial Creativity Theme):

  +-- Aesthetics: Beveled geometric shapes, industrial patterns, and technical typography.
  +-- Color System: OKLCH color space for visual consistency across Light/Dark modes in any ambient light.
  +-- Experience: Fluid micro-interactions, glassmorphism, and intuitive keyboard shortcuts.
  +-- Core Principle: "Tool disappears into the task" — UI stays out of your way while writing, yet remains instantly accessible when needed.

---

## <a id="02-system-architecture"></a>[02] SYSTEM ARCHITECTURE

Mythoria is engineered as a Hybrid Monolith (Next.js 16 App Router) coupled with a Python FastAPI AI Microservice for vector embeddings, RAG pipelines, Graph RAG, and AI agent execution:

```mermaid
graph TD
    subgraph Client ["Client Side (Browser)"]
        UI["Next.js Pages (Forge Mode UI)"]
        Canvas["Visual Canvas (React Flow / dnd-kit)"]
        Editor["Writing Studio (Quill.js)"]
        GraphVis["Relationship & World Graph (Force Graph 2D)"]
    end

    subgraph WebServer ["Web & Backend Server (Next.js 16 Monolith)"]
        NextServer["Next.js Server Actions & API Routes"]
        BAuth["Better Auth + Invite Rules Engine"]
        Drizzle["Drizzle ORM"]
        ContextFabric["Context Fabric Layer"]
    end

    subgraph AIService ["AI Microservice (Python FastAPI port 8000)"]
        VectorRAG["Vector & RAG (/sync, /search)"]
        PlotAgent["Plot Hole Agent & Plot Engine"]
        CharAnalyzer["Character State Extractor (SSE Stream)"]
        Stylo["Stylometry Engine & Fingerprint Discovery"]
        SpellSvc["Thai Spell Checker (PyThaiNLP + Longdo Dict)"]
        LanceDB[("LanceDB Vector DB")]
    end

    subgraph External ["External Services & DB"]
        Postgres[("Neon PostgreSQL Serverless")]
        GeminiEmbed["Gemini API Embeddings 768d"]
        Typhoon["Typhoon v2.1 Thai LLM"]
        Groq["Groq API (Llama Fast Inference)"]
        LongdoDict["Longdo Dictionary API"]
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
    SpellSvc --> LongdoDict
```

---

## <a id="03-core-features"></a>[03] CORE FEATURES

```text
+------------------------------------------------------------------------------+
| 1. WRITING STUDIO & REWRITE WORKSPACE                                        |
+------------------------------------------------------------------------------+
  |-- Quill Rich Text Editor: A5 paper layout view with page breaks & mention tags @[Name](character:id)
  |-- Multi-tab Reference Panel: Read, search, and highlight across notes concurrently
  |-- Paragraph Rewrite Mode (Alt+P): Side-by-side paragraph revision workspace
  |-- Inline Word-level Diff (Alt+D) & Bookmarks (Alt+B): Pin key paragraphs for instant jumping
  |-- Thai Spacing Corrector: Automated formatting of spaces around Thai words and punctuation
  |-- Audit & Proofreading Panel: 3-level issue flagging (Developmental, Line, Proofreading)
  |-- Version History & Visual Diff Viewer: Track and compare revisions across all saved versions
  |-- Export & Publish Assistant: Export to EPUB, Markdown, or Plain Text with pre-publish checks

+------------------------------------------------------------------------------+
| 2. WORLD BUILDING & WORLD SYSTEMS                                            |
+------------------------------------------------------------------------------+
  |-- Characters & Relationships: Character profiles, relationship graphs, and state timelines
  |-- Locations & Hierarchical Tree: Country -> City -> Building nested structure
  |-- World Systems & Attributes: Custom JSONB attributes for Magic Systems, Tech Trees, Ranks
  |-- Factions, Items, Eras & Lore Groups: Group lore, timeline events, and world rules
  |-- Interactive World Graph: 2D Force-directed relationship visualization with view switching

+------------------------------------------------------------------------------+
| 3. STORY BIBLE IMPORT & CLOSED AUTHENTICATION                                |
+------------------------------------------------------------------------------+
  |-- Batch Extract: Extract characters, factions, items, powers, and world systems from Markdown
  |-- Extract-Only Principle: Strictly extracts existing facts without hallucinating lore
  |-- Closed Registration: Invitation code enforcement (invitations table & invite rules)

+------------------------------------------------------------------------------+
| 4. GOOGLE DRIVE & SHEETS DUAL SYNC                                           |
+------------------------------------------------------------------------------+
  |-- Google Drive Chapter Sync: Automated cloud backup and chapter synchronization
  |-- Google Sheets Bible Sync: Bidirectional sync for characters, locations, items, and lore

+------------------------------------------------------------------------------+
| 5. WRITING GOALS & DEADLINE TRACKER                                          |
+------------------------------------------------------------------------------+
  |-- Daily Word Count Targets: Dynamic or static daily target modes
  |-- Target Deadline & Timeline Epoch: Countdown trackers and story timeline epoch dates
```

---

## <a id="04-advanced-plot--analytics-engine"></a>[04] ADVANCED PLOT & ANALYTICS ENGINE

```text
+------------------------------------------------------------------------------+
| 1. DETERMINISTIC PLOT ANALYSIS ENGINE (PHASE 1)                               |
+------------------------------------------------------------------------------+
  |-- Pure Arithmetic Engine: Zero-LLM cost evaluation based on Story Format
  |-- 5 Structural Rules Checks:
  |     1. Unpaid Threads (threads_unpaid): Detects unfulfilled setup threads
  |     2. Vanished Participants (vanished_participant): Flags entities appearing once then disappearing
  |     3. Single-Lane Pacing (single_lane): Identifies scenes stuck in a single pacing lane
  |     4. Repetitive Scene Shape (repetitive_shape): Identifies scenes with identical beat sequences
  |     5. Name-Only Beats (name_only_beat): Flags beats where >50% of content is entity names
  |-- Scene Spine View: Visual summary of beat count, lanes used, and thread density

+------------------------------------------------------------------------------+
| 2. ECHO SCORE & PREDICTABILITY (PHASE 2 - LLM JUDGE)                         |
+------------------------------------------------------------------------------+
  |-- Predictability & Twist Detection: Measures event predictability in upcoming scene cards
  |-- K=8 LLM Sampling: Samples 8 potential next choices from context to compute Hits vs Matched

+------------------------------------------------------------------------------+
| 3. POWER RULES ENGINE                                                        |
+------------------------------------------------------------------------------+
  |-- Global & Per-Power Boundaries: Enforces rules globally or per magic/power system
  |-- Severity Levels (Hard / Soft): Strict enforcement vs conditional soft rules
  |-- Context Injection: Injects power boundaries directly into AI prompts to prevent lore breaks

+------------------------------------------------------------------------------+
| 4. STYLOMETRY & AUTHOR FINGERPRINT DISCOVERY                                 |
+------------------------------------------------------------------------------+
  |-- 5 Stylometric Metrics: MTLD/MATTR (lexical richness), Rhythm, Burstiness, POS n-grams
  |-- Author Fingerprint Discovery: Single chapter & bulk style analysis across chapters
  |-- Consistency Guardian: Catches logical conflicts (e.g., dead character appearing in scene)
```

---

## <a id="05-ai-systems--microservices"></a>[05] AI SYSTEMS & MICROSERVICES

  [+] Single Simulated Reader: Evaluates reader feedback using Blind Context (seeing only N preceding chapters) across 3 dimensions (Suspense, Curiosity, Surprise), Motivation Clarity, Causality, and Stakes.
  [+] SSE Real-Time Streaming Audit: Real-time SSE streaming for character state extraction and note auditing (`/analyze-characters-stream`, `/check-all-notes-stream`).
  [+] Plot Hole Checker Agent: Agent checking temporal conflicts and presence anomalies.
  [+] Librarian Q&A Assistant: Canon-only RAG assistant answering world questions on the World Graph.
  [+] Graph RAG Pipeline: Vector search + 1-hop reference graph traversal before LLM prompt injection.
  [+] Thai Spell Checker & Longdo Dict: Statistical Thai NLP combined with dictionary lookup and auto-fixing.

---

## <a id="06-tech-stack--integrations"></a>[06] TECH STACK & INTEGRATIONS

- **FRONTEND & BACKEND (Next.js Monolith)**
  - Next.js 16.2+ (App Router, Server Actions, TurboPack)
  - React 19.2 (React 19 Server Components)
  - Tailwind CSS v4 (`@tailwindcss/postcss` & `tw-animate-css`)
  - React Flow (`@xyflow/react` v12), `@dnd-kit` & `react-force-graph-2d`
  - Quill.js v2.0 (`react-quill-new`, `quill-mention`)
  - Better Auth v1.6+ (Authentication & Invite Rules Engine)
  - Drizzle ORM v0.45+ + Neon PostgreSQL Serverless
  - Sentry Edge & Server Observability

- **AI & MICROSERVICES (Python FastAPI)**
  - FastAPI & LangChain Microservice (port 8000)
  - LanceDB (Embedded Vector Store & 768d Gemini Embeddings)
  - Typhoon v2.1 & Groq API (Thai LLM & High-Speed Llama Inference)
  - PyThaiNLP & Longdo Dictionary (Thai Spell Checker & Word Lookup)
  - Stylometry & Author Fingerprint Engine (#1-#5 Analysis)

---

## <a id="07-database-schema--system-tables"></a>[07] DATABASE SCHEMA & SYSTEM TABLES

System consists of 56+ PostgreSQL tables categorized by domain:

- **Core & Auth:** `user`, `session`, `account`, `verification`, `invitations` (Closed Invite-Only System)
- **Novels & Studio:** `novels`, `chapters`, `notes`, `note_versions`, `tags`, `chapter_tags`
- **Characters:** `characters`, `character_relationships`, `character_states`, `character_factions`, `life_events`
- **World Building:** `locations`, `location_connections`, `items`, `factions`, `faction_relationships`, `eras`, `world_systems`, `lore`, `lore_groups`, `lore_timeline`
- **Powers & Magic:** `powers`, `character_powers`, `power_levels`, `power_combinations`, `power_rules` (Global & Per-Power Boundaries)
- **Plotting & Timeline:** `ideas`, `idea_connections`, `timeline_events`, `plot_threads`, `story_arcs`
- **Analytics & AI:** `chapter_stylometry`, `author_fingerprint`, `note_audit_issues`, `librarian_messages`, `ai_suggestions`
- **Context Fabric & Sync:** `references` (Context Indexing), `drive_credentials`, `drive_settings` (Google Drive/Sheets Sync)

---

## <a id="08-context-fabric-architecture"></a>[08] CONTEXT FABRIC ARCHITECTURE

- **L4 Graph RAG:** Vector search + 1-hop reference graph traversal for semantic & structural context.
- **L3 Knowledge Graph:** `getNovelGraph()` aggregating all entities with World Graph UI switching.
- **L2 RAG / Vector:** LanceDB embedding 14 entity types with 768d Gemini embeddings.
- **L1 Reference Layer:** `references` table derived from entity junction tables & rebuilt during Vector Sync.
- **L0 Entity Registry:** Abstraction layer over 56 database tables for uniform resolve/search/embedding operations.

---

## <a id="09-installation--setup-guide"></a>[09] INSTALLATION & SETUP GUIDE

### METHOD 1: DEV CONTAINERS (RECOMMENDED)

1. Install Docker Desktop and VS Code with the "Dev Containers" extension.
2. Clone Repository:
   ```bash
   git clone https://github.com/Nattachai802/mythoria.git
   cd mythoria
   ```
3. Open folder in VS Code and select "Reopen in Container".
4. Start development server:
   ```bash
   npm run dev:all:linux
   ```

### METHOD 2: MANUAL INSTALLATION

1. Install Dependencies:
   ```bash
   npm install
   cd pythonservice && python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Mac/Linux:
   # source venv/bin/activate
   pip install -r requirements.txt
   ```

2. Setup Environment Variables (`.env`):
   ```env
   DATABASE_URL="postgresql://postgres:1234@localhost:5432/mythoria_db"
   BETTER_AUTH_SECRET="your-secret"
   TYPHOON_API_KEY="your-typhoon-key"
   GROQ_API_KEY="your-groq-key"
   INTERNAL_API_KEY="..."
   ```

3. Database Push & Development Servers:
   ```bash
   # Push schema changes to Neon DB (Do NOT run db:generate or db:migrate)
   npm run db:push

   # Run both Next.js and Python service on Windows:
   npm run dev:all:windows
   ```

---

## LICENSE

MIT License (c) 2025 Nattachai802

/**
 * AI Feature Registry — ประกาศฟีเจอร์ AI ทั้งหมดของ Mythoria ที่เดียว
 * ------------------------------------------------------------------
 * pure module ไม่แพ็ก Next.js — gateway (lib/ai-gateway.ts) ใช้ตอน runtime
 * และ CLI (scripts/ai-control.ts) ใช้ตอนจัดการ flag/quota ผ่านคำสั่ง `npm run ai`
 *
 * หลักการ: ไม่มีแถวใน ai_features = ใช้ default จาก registry (เปิด, quota ตาม defaultDailyLimit)
 */

export type AiProvider = "groq" | "typhoon" | "gemini" | "openrouter" | "python";

export interface AiProviderStep {
    provider: AiProvider;
    model: string;
    temperature: number;
    maxTokens?: number;
}

export interface AiFeatureDef {
    key: string;
    label: string;
    description: string;
    /** ลำดับ fallback — [] = ไม่ยิง LLM เอง (ฟีเจอร์ฝั่ง Python, gate อย่างเดียว) */
    chain: AiProviderStep[];
    /** quota default (ครั้ง/วัน/ผู้ใช้) — ai_features.daily_limit_per_user ทับค่านี้ได้ · null = ไม่จำกัด */
    defaultDailyLimit: number | null;
    /** สำหรับฟีเจอร์ฝั่ง Python: โมเดลที่ service เรียกเองภายใน (ไว้โชว์บนแผนผังโมเดล) */
    pythonModels?: string[];
}

const TYPHOON_MODEL = "typhoon-v2.5-30b-a3b-instruct"; // มาตรฐานเดียวทั้งแอป (เดิม Python ใช้ v2.1 ไม่ตรงกัน)
const GROQ_MODEL = "llama-3.3-70b-versatile"; // llama-4-scout ถูกปลดระวาง คืน 404
const GEMINI_MODEL = "gemini-2.5-flash";
// ช่องเดียวสำหรับเปลี่ยนโมเดลที่ยิงผ่าน OpenRouter ทั้งแอป — ยังไม่ผูกกับ feature ไหน (ลงทะเบียน provider ไว้ก่อน)
export const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct";
// กำลังทดสอบเทียบกับ Gemini สำหรับ echo-score โดยเฉพาะ (ดู scripts/compare-echo-models.ts) — ยังไม่ยืนยันคุณภาพ
export const DEEPSEEK_MODEL = "deepseek/deepseek-v3.2";

export const AI_FEATURES: Record<string, AiFeatureDef> = {
    // ---- LLM ฝั่ง Next.js ----
    "alias-suggest": {
        key: "alias-suggest",
        label: "แนะนำชื่อเล่นไทย (Alias)",
        description: "แปลงชื่อภาษาอังกฤษเป็นชื่อไทย 2-3 แบบ ตอนสร้าง/แก้ตัวละคร",
        chain: [{ provider: "typhoon", model: TYPHOON_MODEL, temperature: 0.3, maxTokens: 512 }],
        defaultDailyLimit: 100,
    },
    "data-assistant": {
        key: "data-assistant",
        label: "ผู้ช่วยจัดการข้อมูล",
        description: "สั่งสร้าง/แก้/ลบ entity ด้วยคำสั่ง (function calling — Groq เท่านั้น)",
        chain: [{ provider: "groq", model: GROQ_MODEL, temperature: 0.2 }],
        defaultDailyLimit: 300,
    },
    librarian: {
        key: "librarian",
        label: "บรรณารักษ์ (ถาม-ตอบ)",
        description: "Q&A จาก canon ของนิยายผ่าน Graph RAG — Groq หลัก Typhoon สำรอง",
        chain: [
            { provider: "groq", model: GROQ_MODEL, temperature: 0.3, maxTokens: 1024 },
            { provider: "typhoon", model: TYPHOON_MODEL, temperature: 0.3, maxTokens: 1024 },
        ],
        defaultDailyLimit: 300,
    },
    "chapter-summary": {
        key: "chapter-summary",
        label: "สรุป Chapter",
        description: "สรุปเนื้อหาบทด้วย AI หนึ่งคลิก",
        chain: [{ provider: "gemini", model: GEMINI_MODEL, temperature: 0.3, maxTokens: 256 }],
        defaultDailyLimit: 200,
    },
    "note-summary": {
        key: "note-summary",
        label: "สรุปตอน (Note)",
        description: "สรุปตอนที่กำลังเขียนแบบอัตโนมัติ",
        chain: [{ provider: "gemini", model: GEMINI_MODEL, temperature: 0.3, maxTokens: 256 }],
        defaultDailyLimit: 400,
    },
    // สรุปจากโครงสร้างบนกระดานพล็อต (cast/threads/beats) — คนละข้อมูลกับ chapter-summary/note-summary
    // ด้านบนที่สรุปจากร้อยแก้วที่เขียนแล้ว ตัวนี้ใช้ได้ตั้งแต่ยังไม่ได้ลงมือเขียนเลย
    "plot-scene-recap": {
        key: "plot-scene-recap",
        label: "สรุปฉาก (พล็อต)",
        description: "สรุปเนื้อหาฉากจากโครงสร้างบนกระดาน (cast/threads/beats)",
        chain: [{ provider: "gemini", model: GEMINI_MODEL, temperature: 0.2, maxTokens: 300 }],
        defaultDailyLimit: 200,
    },
    "plot-chapter-recap": {
        key: "plot-chapter-recap",
        label: "สรุปบท (พล็อต)",
        description: "สังเคราะห์สรุปฉากทั้งหมดในบทเป็นภาพรวมเดียว",
        chain: [{ provider: "gemini", model: GEMINI_MODEL, temperature: 0.2, maxTokens: 400 }],
        defaultDailyLimit: 100,
    },
    "echo-score": {
        key: "echo-score",
        label: "Echo Score (ทายพล็อต)",
        description: "ให้ AI ทายทิศทางเนื้อเรื่องแล้วตัดสินความคาดเดาได้",
        // gemini ล้ม/โดน rate limit → ร่วง typhoon (คู่เดียวกับ character-state-extractor ที่ต้องการ JSON เข้มงวดเหมือนกัน)
        // deepseek อยู่ท้ายสุด — last-resort เท่านั้น (ยังไม่ผ่านการทดสอบคุณภาพ/ความแม่น JSON จริง)
        // เอาไว้ให้ scripts/compare-echo-models.ts เรียกผ่าน callAiProvider() มาเทียบกับ gemini ก่อนตัดสินใจเลื่อนขึ้น
        // temperature ที่นี่เป็นแค่ default ของ registry — server/plot-analysis.ts ส่ง temperature ทับทุกครั้งอยู่แล้ว (1.0 guess / 0.0 judge)
        chain: [
            { provider: "gemini", model: GEMINI_MODEL, temperature: 1.0 },
            { provider: "typhoon", model: TYPHOON_MODEL, temperature: 1.0 },
            { provider: "openrouter", model: DEEPSEEK_MODEL, temperature: 1.0 },
        ],
        defaultDailyLimit: 100,
    },
    "character-state-extractor": {
        key: "character-state-extractor",
        label: "สกัดสถานะตัวละคร",
        description: "Background extraction หลังบันทึกตอน (ตำแหน่ง/อารมณ์/สุขภาพ)",
        chain: [
            { provider: "gemini", model: GEMINI_MODEL, temperature: 0.3, maxTokens: 8192 },
            { provider: "typhoon", model: TYPHOON_MODEL, temperature: 0.3, maxTokens: 8192 },
        ],
        defaultDailyLimit: 150,
    },
    "lore-extractor": {
        key: "lore-extractor",
        label: "สกัด Entity จาก Lore (Background)",
        description: "วิเคราะห์ lore ที่บันทึกแล้วเสนอ entity ใหม่แบบเบื้องหลัง",
        chain: [
            { provider: "gemini", model: GEMINI_MODEL, temperature: 0.2 },
            { provider: "groq", model: GROQ_MODEL, temperature: 0.2 },
        ],
        defaultDailyLimit: 150,
    },
    "lore-extract-manual": {
        key: "lore-extract-manual",
        label: "สกัด Entity จาก Lore (กดเอง)",
        description: "ปุ่มสกัด entity จากหน้า Lore — แยก toggle จากตัว background ได้",
        chain: [
            { provider: "gemini", model: GEMINI_MODEL, temperature: 0.2 },
            { provider: "groq", model: GROQ_MODEL, temperature: 0.2 },
        ],
        defaultDailyLimit: 100,
    },
    "bible-import": {
        key: "bible-import",
        label: "นำเข้า Story Bible",
        description: "สกัด entity จากเอกสาร markdown (extract-only ไม่แต่งเพิ่ม)",
        chain: [{ provider: "groq", model: GROQ_MODEL, temperature: 0.2 }],
        defaultDailyLimit: 20,
    },
    "reader-review": {
        key: "reader-review",
        label: "AI Reader รีวิว (suspense/curiosity/surprise)",
        description: "ให้นักอ่านจำลองให้คะแนนความตื่นเต้นของบท",
        chain: [
            { provider: "groq", model: GROQ_MODEL, temperature: 0.0 },
            { provider: "typhoon", model: TYPHOON_MODEL, temperature: 0.0 },
        ],
        defaultDailyLimit: 200,
    },

    // ---- ผ่าน Python microservice (gate ที่ gateway แต่ execution อยู่ฝั่ง Python) ----
    // pythonModels = โมเดลที่ pythonservice เรียกเองข้างใน (embeddings.py / ai_agent.py / character_analyzer.py)
    "vector-sync": {
        key: "vector-sync",
        label: "Vector Sync (embeddings)",
        description: "Rebuild embeddings + reference graph index ทั้งนิยาย (เรียก Gemini Embedding เยอะ)",
        chain: [],
        defaultDailyLimit: 12,
        pythonModels: ["gemini/gemini-embedding-001 (768d)"],
    },
    "graph-rag-search": {
        key: "graph-rag-search",
        label: "Graph RAG Search",
        description: "ค้นแบบเวกเตอร์ + เดินกราฟ (ใช้โดย Librarian/AI Review ภายใน)",
        chain: [],
        defaultDailyLimit: null,
        pythonModels: ["gemini/gemini-embedding-001 (query)"],
    },
    "plot-hole-checker": {
        key: "plot-hole-checker",
        label: "Plot Hole Checker",
        description: "Agent ตรวจ plothole/timeline/ความสม่ำเสมอตัวละคร (Typhoon ฝั่ง Python)",
        chain: [],
        defaultDailyLimit: 60,
        pythonModels: ["typhoon/typhoon-v2.1-12b-instruct"],
    },
    "character-analysis": {
        key: "character-analysis",
        label: "Character Analyzer",
        description: "วิเคราะห์ตัวละครเชิงลึกแบบ queue/SSE (Typhoon ฝั่ง Python)",
        chain: [],
        defaultDailyLimit: 40,
        pythonModels: ["typhoon/typhoon-v2.1-12b-instruct"],
    },
};

export type AiFeatureKey = keyof typeof AI_FEATURES;

/** path prefix แรกของ Python endpoint → feature key (ดู @app.post ใน pythonservice/main.py) */
const PYTHON_PATH_FEATURES: Array<[string, AiFeatureKey]> = [
    ["sync", "vector-sync"],
    ["search", "graph-rag-search"],
    ["analyze-plot", "plot-hole-checker"],
    ["check-timeline", "plot-hole-checker"],
    ["validate-character", "plot-hole-checker"],
    ["check-all-notes", "plot-hole-checker"],
    ["analyze-characters", "character-analysis"],
    ["analyze-queue", "character-analysis"],
];

export function resolvePythonFeature(pathSegment: string): AiFeatureKey | null {
    for (const [prefix, feature] of PYTHON_PATH_FEATURES) {
        if (pathSegment.startsWith(prefix)) return feature;
    }
    return null;
}

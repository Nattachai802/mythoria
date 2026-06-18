import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { aiChapterReviews, notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { retrieveContext } from "@/server/rag";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const TYPHOON_API_URL = "https://api.opentyphoon.ai/v1/chat/completions";
const TYPHOON_API_KEY = process.env.TYPHOON_API_KEY || "";

const PERSONAS_MAPPING = {
  groq: [
    { id: 1, name: "แฟนคลับเบอร์หนึ่ง", emoji: "🥰", desc: "ตื่นเต้น หวีดร้อง ใช้ emoji เยอะๆ ชอบทุกอย่าง" },
    { id: 2, name: "นักอ่านสายชิลล์", emoji: "😊", desc: "อ่านเอาสนุก สบายๆ ซื่อๆ ตรงไปตรงมา" },
    { id: 3, name: "นักวิจารณ์สายวิเคราะห์", emoji: "🧐", desc: "วิเคราะห์โครงเรื่อง จังหวะ มีเหตุมีผล วิจารณ์ตรงประเด็น" }
  ],
  typhoon: [
    { id: 4, name: "คุณครูจอมเนี้ยบ", emoji: "🤨", desc: "เข้มงวด จับผิดคำผิด ตรรกะ ความสมเหตุสมผล ชี้ปัญหาชัดเจน" },
    { id: 5, name: "ตัวตึงขี้อคติ", emoji: "👿", desc: "บ่น มึนๆ ไม่ค่อยพอใจอะไร แต่ภายใต้คำบ่นมักมีประเด็นที่ถูกต้องแฝงอยู่" } // These tricky personas benefit from Typhoon's deeper Thai nuance
  ]
};

const JSON_PROMPT = `
อ่านเนื้อหานิยายตอนล่าสุดนี้ แล้วให้คอมเมนต์ในมุมมองของนักอ่านหลายๆ แบบพร้อมกัน
กรุณาตอบกลับเป็น JSON Array โดยมีโครงสร้างดังนี้เท่านั้น (งดใส่ข้อความอื่น):
[
  { "id": 1, "content": "คอมเมนต์นักอ่านคนที่ 1..." },
  { "id": 2, "content": "คอมเมนต์นักอ่านคนที่ 2..." }
]

สวมบทบาทนักอ่านตาม ID ต่อไปนี้:
`;

async function fetchStoryContext(novelId: string, query: string, currentNoteId: string) {
  try {
    // Graph RAG: vector search + 1-hop reference expansion (server/rag.ts)
    const { items } = await retrieveContext(novelId, query);
    const kept = items.filter((it) => it.id !== currentNoteId).slice(0, 8);

    console.log(`[RAG] Fetched ${kept.length} context items for AI Review (search+graph).`);
    if (kept.length === 0) return "";

    return kept
      .map((it) =>
        it.via === "search"
          ? `[${it.type}] ${it.title}: ${it.content ?? ""}`
          : `[${it.type}] ${it.title} (เกี่ยวข้องผ่าน: ${it.relation})`,
      )
      .join("\n");
  } catch (error) {
    console.error("[RAG] Context Search Error:", error);
    return "";
  }
}

async function fetchBatchReviews(provider: "groq" | "typhoon", personas: any[], text: string, contextString: string = "") {
  const url = provider === "groq" ? GROQ_API_URL : TYPHOON_API_URL;
  const key = provider === "groq" ? GROQ_API_KEY : TYPHOON_API_KEY;
  const model = provider === "groq" ? "meta-llama/llama-4-scout-17b-16e-instruct" : "typhoon-v2.5-30b-a3b-instruct";

  const personaInstructions = personas.map(p => `ID ${p.id}: ${p.name} - สไตล์: ${p.desc} (ความยาว 2-4 ประโยค)`).join('\n');
  const systemPrompt = JSON_PROMPT + personaInstructions;

  const userContent = contextString 
    ? `=== ข้อมูลบริบทอ้างอิง ===\n${contextString}\n\n=== เนื้อหานิยาย ===\n${text}`
    : `เนื้อหานิยาย:\n\n${text}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.8,
        max_tokens: 8192,
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
      console.error(`AI API Error from ${provider}:`, await res.text());
      return null;
    }

    const data = await res.json();
    let rawText = data.choices?.[0]?.message?.content?.trim() ?? "[]";

    const cleanText = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    let parsed;
    try {
      parsed = JSON.parse(cleanText);
    } catch (parseError) {
      console.warn(`[JSON Parse Error] ${provider} failed. Attempting regex extraction...`);
      // Fallback regex extraction for array
      const arrayMatch = cleanText.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        try {
          parsed = JSON.parse(arrayMatch[0]);
        } catch (e2) {
          console.error(`[Regex Fallback Error] ${provider} failed again:`, e2);
          return null;
        }
      } else {
         return null;
      }
    }
    
    return Array.isArray(parsed) ? parsed : (parsed.reviews || parsed.data || []);
  } catch (e) {
    console.error(`Fetch Error from ${provider}:`, e);
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ novelId: string; noteId: string }> }) {
  try {
    const { noteId } = await params;
    const reviews = await db.select().from(aiChapterReviews)
      .where(eq(aiChapterReviews.noteId, noteId));
    return NextResponse.json({ success: true, reviews });
  } catch (e) {
    console.error("GET Reviews Error:", e);
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ novelId: string; noteId: string }> }) {
  try {
    const { noteId, novelId } = await params;
    const note = await db.query.notes.findFirst({ where: eq(notes.id, noteId) });
    if (!note) return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 });

    const rawHtml = (note.content as any)?.text ?? "";
    const plainText = rawHtml.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (plainText.length < 50) return NextResponse.json({ success: false, error: "เนื้อหาสั้นเกินไป" }, { status: 400 });

    const truncated = plainText.slice(0, 3000);

    const searchQuery = `${note.title || ""} ${plainText.slice(0, 500)}`.trim();
    const contextString = await fetchStoryContext(novelId, searchQuery, noteId);

    let [groqAns, typhoonAns] = await Promise.all([
      fetchBatchReviews("groq", PERSONAS_MAPPING.groq, truncated, contextString),
      fetchBatchReviews("typhoon", PERSONAS_MAPPING.typhoon, truncated, contextString)
    ]);

    // Provider Fallback: หาก Typhoon ล่มหรือไม่สามารถแกะ JSON ได้, ให้ Groq มารับช่วงต่อ
    if (!typhoonAns) {
      console.warn("⚠️ Typhoon API failed. Falling back to Groq for Typhoon's personas...");
      typhoonAns = await fetchBatchReviews("groq", PERSONAS_MAPPING.typhoon, truncated, contextString);
    }

    // หากของค่ายไหนพินาศ (ทำ fallback แล้วก็ยังไม่ได้) ให้กลายเป็น Array ว่างเพื่อไปดึงข้อความ Default ถัดไป
    const allAns = [...(groqAns || []), ...(typhoonAns || [])];

    const allPersonas = [...PERSONAS_MAPPING.groq, ...PERSONAS_MAPPING.typhoon];
    const finalResults = allPersonas.map(p => {
      const ans = allAns.find((a: any) => a.id === p.id);
      return {
        noteId: noteId,
        novelId: novelId,
        persona: p.id,
        personaName: `${p.emoji} ${p.name}`,
        content: ans?.content || "ขออภัย ฉันไม่สามารถรีวิวตอนนี้ได้"
      };
    });

    await db.delete(aiChapterReviews).where(eq(aiChapterReviews.noteId, noteId));
    await db.insert(aiChapterReviews).values(finalResults);

    return NextResponse.json({ success: true, reviews: finalResults });
  } catch (e) {
    console.error("POST Review Error:", e);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

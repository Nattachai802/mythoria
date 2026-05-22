import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db/drizzle";
import { characters, locations, items, ideas } from "@/db/schema";
import { eq, ilike, or } from "drizzle-orm";
import OpenAI from "openai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ novelId: string }> }
) {
    try {
        const { novelId } = await context.params;
        const body = await req.json();
        const { content } = body;

        if (!content || typeof content !== "string") {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: "GEMINI_API_KEY is not set" }, { status: 500 });
        }

        // 1. Prompt LLM to extract entities
        const prompt = `
You are a worldbuilding assistant. Extract the entities from the following lore content.
Identify:
1. characters (Who is in the event)
2. locations (Where it happens)
3. items (What important items, artifacts, or objects are mentioned)

Return a strictly valid JSON object with the following structure:
{
  "characters": ["name1", "name2"],
  "locations": ["location1"],
  "items": ["item1"]
}
If none are found for a category, return an empty array for it. Do not include markdown formatting like \`\`\`json.
Lore Content:
"${content}"
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                temperature: 0.2,
            }
        });

        const textResponse = response.text || "{}";
        const cleanedJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
        let extracted: { characters: string[], locations: string[], items: string[] } = { characters: [], locations: [], items: [] };
        let isFallback = false;

        try {
            extracted = JSON.parse(cleanedJson);
        } catch (e: any) {
            console.warn(`Gemini Extraction failed: ${e.message}. Switching to OpenAI Fallback.`);
            isFallback = true;

            try {
                if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set in .env");

                const openai = new OpenAI({
                    apiKey: process.env.GROQ_API_KEY,
                    baseURL: "https://api.groq.com/openai/v1"
                });
                const completion = await openai.chat.completions.create({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.2,
                    response_format: { type: "json_object" }
                });

                const textResponse = completion.choices[0].message.content || "{}";
                extracted = JSON.parse(textResponse);
            } catch (e2: any) {
                console.warn(`Groq Fallback also failed: ${e2.message}. Using fallback local scan.`);

                // FALLBACK: Local Keyword Match Scan
                const lowerContent = content.toLowerCase();

                const [allChars, allLocs, allItems] = await Promise.all([
                    db.query.characters.findMany({ where: eq(characters.novelId, novelId) }),
                    db.query.locations.findMany({ where: eq(locations.novelId, novelId) }),
                    db.query.items.findMany({ where: eq(items.novelId, novelId) })
                ]);

                allChars.forEach(c => {
                    if (lowerContent.includes(c.name.toLowerCase()) && c.name.length > 1) {
                        extracted.characters.push(c.name);
                    }
                });
                allLocs.forEach(l => {
                    if (lowerContent.includes(l.name.toLowerCase()) && l.name.length > 1) {
                        extracted.locations.push(l.name);
                    }
                });
                allItems.forEach(i => {
                    if (lowerContent.includes(i.name.toLowerCase()) && i.name.length > 1) {
                        extracted.items.push(i.name);
                    }
                });
            }
        }

        const foundCharacters: string[] = [];
        const foundLocations: string[] = [];
        const foundItems: string[] = [];
        const newIdeas: { title: string; category: string }[] = [];

        // 2. Fetch all novel entities in parallel for cross-referencing
        const [allChars, allLocs, allItems] = await Promise.all([
            db.query.characters.findMany({ where: eq(characters.novelId, novelId) }),
            db.query.locations.findMany({ where: eq(locations.novelId, novelId) }),
            db.query.items.findMany({ where: eq(items.novelId, novelId) })
        ]);

        // 3. Cross-reference Characters
        if (extracted.characters && extracted.characters.length > 0) {
            for (const name of extracted.characters) {
                const found = allChars.find(c => c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.name.toLowerCase()));
                if (found) {
                    if (!foundCharacters.includes(found.id)) foundCharacters.push(found.id);
                } else {
                    newIdeas.push({ title: name, category: "character" });
                }
            }
        }

        // 4. Cross-reference Locations
        if (extracted.locations && extracted.locations.length > 0) {
            for (const name of extracted.locations) {
                const found = allLocs.find(l => l.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(l.name.toLowerCase()));
                if (found) {
                    if (!foundLocations.includes(found.id)) foundLocations.push(found.id);
                } else {
                    newIdeas.push({ title: name, category: "worldbuilding" }); // worldbuilding for locations
                }
            }
        }

        // 5. Cross-reference Items
        if (extracted.items && extracted.items.length > 0) {
            for (const name of extracted.items) {
                const found = allItems.find(i => i.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(i.name.toLowerCase()));
                if (found) {
                    if (!foundItems.includes(found.id)) foundItems.push(found.id);
                } else {
                    newIdeas.push({ title: name, category: "worldbuilding" }); // worldbuilding for items
                }
            }
        }

        // 5. Create new Ideas for missing entities
        const insertedIdeaIds: string[] = [];
        if (newIdeas.length > 0) {
            const ideasToInsert = newIdeas.map(idea => ({
                title: idea.title,
                category: idea.category,
                novelId,
                content: "สกัดอัตโนมัติจากหน้า Lore",
                summary: idea.category === "character" ? "ตัวละครที่พบใน Lore" : "สถานที่/สิ่งของที่พบใน Lore",
            }));

            const inserted = await db.insert(ideas).values(ideasToInsert).returning({ id: ideas.id, title: ideas.title, category: ideas.category });
            inserted.forEach(i => insertedIdeaIds.push(i.id));
        }

        return NextResponse.json({
            success: true,
            foundCharacters,
            foundLocations,
            foundItems,
            newIdeas: newIdeas.map(i => i.title),
            extracted,
            isFallback
        });

    } catch (error: any) {
        console.error("Error extracting entities:", error);
        return NextResponse.json({ error: error.message || "Failed to extract entities" }, { status: 500 });
    }
}

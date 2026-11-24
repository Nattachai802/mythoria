import { NextRequest, NextResponse } from "next/server";
import { guardNovel } from "@/lib/authz";
import { db } from "@/db/drizzle";
import { characters, locations, items } from "@/db/schema";
import { upsertDetectedNotes, type DetectedName } from "@/server/idea-vault-detect";
import { eq, ilike, or } from "drizzle-orm";
import { callAi, AiControlError } from "@/lib/ai-gateway";

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ novelId: string }> }
) {
    try {
        const { novelId } = await context.params;
        const denied = await guardNovel(novelId); if (denied) return denied;
        const body = await req.json();
        const { content } = body;

        if (!content || typeof content !== "string") {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // 1. Prompt LLM to extract entities
        const prompt = `
You are an expert worldbuilding assistant. Your task is to extract important named entities (proper nouns / ชื่อเฉพาะ) from the provided lore text.
The system is generic and supports various genres (sci-fi, fantasy, mystery, modern, historical). Do not assume a specific genre.

Extract ONLY actual proper nouns (specific names) for the following categories. Do NOT extract common nouns, generic classes, or general categories (for example: DO NOT extract words like "มนุษย์", "เทพ", "ผู้หญิง", "ดาบ", "ปืน", "ประเทศ", "เมือง", "องค์กร" unless they are part of a specific proper name).

Identify and extract:
1. characters: Specific named individuals, characters, deities, creatures, or organizations/factions/groups (e.g., "ดร. สมชาย", "สมาคมพันธมิตรดวงดาว", "สมาพันธ์การค้า").
2. locations: Specific named locations, structures, cities, planets, or geographic areas (e.g., "มหานครนิวยอร์ก", "สถานีอวกาศโอเรียน", "ป่าหิมพานต์").
3. items: Specific named objects, ships, vehicles, legendary weapons, unique artifacts, or relics (e.g., "ยานอพอลโล 11", "ดาบฟ้าฟื้น", "ศิลานักปราชญ์").

Rules:
- The text is in Thai. Extract the names exactly as they are written in the text.
- Preserve parenthetical descriptions or translations if they form a part of the proper name (e.g., "สมาคม X (Association X)").
- Strictly ignore generic species, common objects, or general nouns. If the entity does not have a unique proper name, do not extract it.

Return a strictly valid JSON object with the following structure:
{
  "characters": ["name1", "name2"],
  "locations": ["location1", "location2"],
  "items": ["item1", "item2"]
}
If none are found for a category, return an empty array for it. Do not include markdown formatting like \`\`\`json.
Lore Content:
"${content}"
`;

        let extracted: { characters: string[], locations: string[], items: string[] } = { characters: [], locations: [], items: [] };
        let isFallback = false;

        // ผ่าน AI Gateway (Gemini → Groq fallback + json mode, flag/quota/log จัดการที่ gateway)
        try {
            const response = await callAi({
                feature: "lore-extract-manual",
                prompt,
                extraBody: { response_format: { type: "json_object" } },
                novelId,
            });
            const cleanedJson = response.text.replace(/```json/g, "").replace(/```/g, "").trim();
            extracted = JSON.parse(cleanedJson);
        } catch (e: any) {
            if (e instanceof AiControlError) {
                // disabled/quota/guest — บอกสาเหตุตรงๆ (ไม่ fallback ลับๆ ทั้งที่ระบบปิด)
                return NextResponse.json({ error: e.message }, { status: e.reason === "quota" || e.reason === "busy" ? 429 : 403 });
            }
            console.warn(`LLM Extraction failed: ${e?.message}. Using fallback local scan.`);
            isFallback = true;

            // FALLBACK: Local Keyword Match Scan
            const lowerContent = content.toLowerCase();

            const [allChars, allLocs, allItems] = await Promise.all([
                db.query.characters.findMany({ where: eq(characters.novelId, novelId) }),
                db.query.locations.findMany({ where: eq(locations.novelId, novelId) }),
                db.query.items.findMany({ where: eq(items.novelId, novelId) })
            ]);

            allChars.forEach((c: any) => {
                if (lowerContent.includes(c.name.toLowerCase()) && c.name.length > 1) {
                    extracted.characters.push(c.name);
                }
            });
            allLocs.forEach((l: any) => {
                if (lowerContent.includes(l.name.toLowerCase()) && l.name.length > 1) {
                    extracted.locations.push(l.name);
                }
            });
            allItems.forEach((i: any) => {
                if (lowerContent.includes(i.name.toLowerCase()) && i.name.length > 1) {
                    extracted.items.push(i.name);
                }
            });
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
                const found = allChars.find((c: any) => c.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(c.name.toLowerCase()));
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
                const found = allLocs.find((l: any) => l.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(l.name.toLowerCase()));
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
                const found = allItems.find((i: any) => i.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(i.name.toLowerCase()));
                if (found) {
                    if (!foundItems.includes(found.id)) foundItems.push(found.id);
                } else {
                    newIdeas.push({ title: name, category: "worldbuilding" }); // worldbuilding for items
                }
            }
        }

        // 5. ชื่อที่ยังไม่มีในนิยาย → คลังไอเดีย (รออนุมัติ) · ชื่อซ้ำใช้โน้ตเดิม
        // ยังไม่ผูก lore ตรงนี้ — หน้า lore ผูกให้ตอนผู้ใช้กดบันทึก (เลือก/ไม่เลือกได้)
        const allMatchedIdeas = await upsertDetectedNotes(novelId, newIdeas as DetectedName[]);

        return NextResponse.json({
            success: true,
            foundCharacters,
            foundLocations,
            foundItems,
            newIdeas: newIdeas.map(i => i.title),
            insertedIdeas: allMatchedIdeas,
            extracted,
            isFallback
        });

    } catch (error: any) {
        console.error("Error extracting entities:", error);
        return NextResponse.json({ error: error.message || "Failed to extract entities" }, { status: 500 });
    }
}

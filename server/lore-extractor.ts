"use server";

import { GoogleGenAI } from "@google/genai";
import { db } from "@/db/drizzle";
import { characters, locations, items, ideas, loreEntries } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-config";
import { addReferences, removeOutgoingReferences, type AddReferenceInput } from "./references";

// Initialize AI clients
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function extractLoreEntitiesInBackground(
    loreId: string,
    novelId: string,
    content: string
): Promise<void> {
    try {
        console.log(`[Background Extraction] Starting for Lore Entry: ${loreId}, Novel: ${novelId}`);

        // Set status to processing
        await db.update(loreEntries)
            .set({
                extractionStatus: "processing",
                extractionError: null
            })
            .where(eq(loreEntries.id, loreId));

        if (!content || !content.trim()) {
            console.log("[Background Extraction] Empty content, skipping");
            await db.update(loreEntries)
                .set({
                    extractionStatus: "completed",
                    extractionError: null
                })
                .where(eq(loreEntries.id, loreId));
            return;
        }

        if (!process.env.GEMINI_API_KEY) {
            console.warn("[Background Extraction] GEMINI_API_KEY is not set. Background extraction aborted.");
            await db.update(loreEntries)
                .set({
                    extractionStatus: "failed",
                    extractionError: "GEMINI_API_KEY is not set"
                })
                .where(eq(loreEntries.id, loreId));
            return;
        }

        // 1. Fetch existing lore entry to merge relationships
        const existingLore = await db.query.loreEntries.findFirst({
            where: eq(loreEntries.id, loreId),
        });

        if (!existingLore) {
            console.error(`[Background Extraction] Lore entry ${loreId} not found in database.`);
            return;
        }

        // 2. Prompt LLM to extract entities
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

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    temperature: 0.2,
                }
            });

            const textResponse = response.text || "{}";
            const cleanedJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
            extracted = JSON.parse(cleanedJson);
        } catch (e: any) {
            console.warn(`[Background Extraction] Gemini failed: ${e.message}. Trying OpenAI Fallback.`);

            try {
                if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");

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
                console.warn(`[Background Extraction] Groq Fallback failed: ${e2.message}. Running local scan fallback.`);

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
        }

        const foundCharacters: string[] = [];
        const foundLocations: string[] = [];
        const foundItems: string[] = [];
        const newIdeas: { title: string; category: string }[] = [];

        // 3. Parallel fetch for cross-referencing
        const [allChars, allLocs, allItems] = await Promise.all([
            db.query.characters.findMany({ where: eq(characters.novelId, novelId) }),
            db.query.locations.findMany({ where: eq(locations.novelId, novelId) }),
            db.query.items.findMany({ where: eq(items.novelId, novelId) })
        ]);

        // Cross-reference characters
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

        // Cross-reference locations
        if (extracted.locations && extracted.locations.length > 0) {
            for (const name of extracted.locations) {
                const found = allLocs.find((l: any) => l.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(l.name.toLowerCase()));
                if (found) {
                    if (!foundLocations.includes(found.id)) foundLocations.push(found.id);
                } else {
                    newIdeas.push({ title: name, category: "worldbuilding" });
                }
            }
        }

        // Cross-reference items
        if (extracted.items && extracted.items.length > 0) {
            for (const name of extracted.items) {
                const found = allItems.find((i: any) => i.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(i.name.toLowerCase()));
                if (found) {
                    if (!foundItems.includes(found.id)) foundItems.push(found.id);
                } else {
                    newIdeas.push({ title: name, category: "worldbuilding" });
                }
            }
        }

        // 4. Merge found entities with existing lore entry associations to avoid overwriting manually linked entities
        const existingCharIds = (existingLore.relatedCharacterIds as string[]) || [];
        const existingLocIds = (existingLore.relatedLocationIds as string[]) || [];
        const existingItemIds = (existingLore.relatedItemIds as string[]) || [];

        const mergedCharacterIds = Array.from(new Set([...existingCharIds, ...foundCharacters]));
        const mergedLocationIds = Array.from(new Set([...existingLocIds, ...foundLocations]));
        const mergedItemIds = Array.from(new Set([...existingItemIds, ...foundItems]));

        // Update the lore entry with merged entities and mark status as completed
        await db.update(loreEntries)
            .set({
                relatedCharacterIds: mergedCharacterIds,
                relatedLocationIds: mergedLocationIds,
                relatedItemIds: mergedItemIds,
                extractionStatus: "completed",
                extractionError: null,
                updatedAt: new Date()
            })
            .where(eq(loreEntries.id, loreId));

        console.log(`[Background Extraction] Updated Lore Entry ${loreId} with matched entities:`, {
            characters: mergedCharacterIds.length,
            locations: mergedLocationIds.length,
            items: mergedItemIds.length
        });

        // Context Fabric: mirror lore's entity links as `lore --mentions--> X` (resync)
        const mentionRefs: AddReferenceInput[] = [
            ...mergedCharacterIds.map((id) => ({ type: "character" as const, id })),
            ...mergedLocationIds.map((id) => ({ type: "location" as const, id })),
            ...mergedItemIds.map((id) => ({ type: "item" as const, id })),
        ].map((to) => ({ novelId, from: { type: "lore" as const, id: loreId }, to, relation: "mentions" as const, createdBy: "ai" as const }));
        await removeOutgoingReferences({ type: "lore", id: loreId }, "mentions");
        if (mentionRefs.length) await addReferences(mentionRefs);

        // 5. Insert unmatched entities as new ideas in the detected pool
        if (newIdeas.length > 0) {
            // First, filter out newIdeas that are already in the database as ideas (to prevent duplicates)
            const existingIdeas = await db.query.ideas.findMany({
                where: eq(ideas.novelId, novelId),
            });

            // Update existing ideas to link them to this lore entry
            const existingIdeasToLink = newIdeas.filter(newIdea =>
                existingIdeas.some((ei: any) => ei.title.toLowerCase() === newIdea.title.toLowerCase())
            );

            if (existingIdeasToLink.length > 0) {
                await Promise.all(
                    existingIdeasToLink.map(async (newIdea) => {
                        const existing = existingIdeas.find(
                            (ei: any) => ei.title.toLowerCase() === newIdea.title.toLowerCase()
                        );
                        if (existing) {
                            const currentLoreIds = (existing.linkedLoreIds as string[]) || [];
                            if (!currentLoreIds.includes(loreId)) {
                                await db
                                    .update(ideas)
                                    .set({
                                        linkedLoreIds: [...currentLoreIds, loreId],
                                        updatedAt: new Date(),
                                    })
                                    .where(eq(ideas.id, existing.id));
                                console.log(`[Background Extraction] Linked existing idea "${existing.title}" to lore entry ${loreId}`);
                            }
                        }
                    })
                );
            }

            // Insert new ideas that don't exist yet
            const ideasToInsert = newIdeas
                .filter(newIdea => !existingIdeas.some((ei: any) => ei.title.toLowerCase() === newIdea.title.toLowerCase()))
                .map(newIdea => ({
                    title: newIdea.title,
                    category: newIdea.category,
                    novelId,
                    content: "สกัดอัตโนมัติจากหน้า Lore",
                    summary: newIdea.category === "character" ? "ตัวละครที่พบใน Lore" : "สถานที่/สิ่งของที่พบใน Lore",
                    isDetected: true,
                    linkedLoreIds: [loreId]
                }));

            if (ideasToInsert.length > 0) {
                const inserted = await db.insert(ideas).values(ideasToInsert).returning();
                console.log(`[Background Extraction] Inserted ${inserted.length} new detected ideas.`);
            }
        }

        // 6. Cache revalidation to ensure the UI gets updated
        revalidateTag(CACHE_TAGS.ideas(novelId), "default");
        revalidatePath(`/dashboard/project/${novelId}/worldbuilding`);
        revalidatePath(`/dashboard/project/${novelId}/idea`);

        console.log(`[Background Extraction] Completed successfully for Lore Entry: ${loreId}`);

    } catch (error: any) {
        console.error(`[Background Extraction] Error processing lore entry ${loreId}:`, error);
        try {
            await db.update(loreEntries)
                .set({
                    extractionStatus: "failed",
                    extractionError: error?.message || "Unknown error"
                })
                .where(eq(loreEntries.id, loreId));
        } catch (dbErr) {
            console.error("[Background Extraction] Failed to save extraction error to database:", dbErr);
        }
    }
}

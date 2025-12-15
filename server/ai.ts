"use server";

import { db } from "@/db/drizzle";
import { aliasCache } from "@/db/schema";
import { eq } from "drizzle-orm";

const TYPHOON_API_KEY = "sk-p92ZcqcevSS7i0ANIJXKyCp4g6MvqsgsEDy1ZuQJNuRgmpzN";
const TYPHOON_API_URL = "https://api.opentyphoon.ai/v1/chat/completions";
const MODEL_NAME = "typhoon-v2.1-12b-instruct";

/**
 * Generate Thai aliases for an English name
 * Uses cache to avoid repeated API calls for the same name
 */
export async function generateThaiAliases(englishName: string): Promise<string[]> {
    if (!englishName) return [];

    // Normalize the name for cache lookup
    const normalizedName = englishName.trim().toLowerCase();

    try {
        // 1. Check cache first
        const cached = await db
            .select()
            .from(aliasCache)
            .where(eq(aliasCache.englishName, normalizedName))
            .limit(1);

        if (cached.length > 0 && cached[0].aliases) {
            console.log(`[AliasCache] HIT for "${englishName}"`);
            return cached[0].aliases as string[];
        }

        console.log(`[AliasCache] MISS for "${englishName}", calling API...`);

        // 2. Call API if not cached
        const response = await fetch(TYPHOON_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TYPHOON_API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [
                    {
                        role: "user",
                        content: `Task: Transliterate the name "${englishName}" to Thai script.
Requirements:
- Provide 2-3 common spelling variations used in Thailand.
- Include common Thai nicknames derived from this name (if any).
- Strictly output ONLY a valid JSON array of strings. Do not add conversational text.

Output Example: ["อลิซ", "อลิส", "น้องเอล"]`
                    }
                ],
                temperature: 0.3,
                max_tokens: 80,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Typhoon API Error:", errorText);
            return [];
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content?.trim();

        // Clean up content to ensure it's valid JSON
        // Sometimes models add ```json ... ``` wrapper
        let jsonStr = content;
        if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        let aliases: string[] = [];

        try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                aliases = parsed;
            }
        } catch (parseError) {
            console.error("Failed to parse Typhoon response:", content);
            // Fallback: try to match anything that looks like Thai text in brackets or quotes
            const matches = content.match(/["']([ก-๙]+)["']/g);
            if (matches) {
                aliases = matches.map((m: string) => m.replace(/['"]/g, ""));
            }
        }

        // 3. Save to cache (only if we got results)
        if (aliases.length > 0) {
            try {
                await db
                    .insert(aliasCache)
                    .values({
                        englishName: normalizedName,
                        aliases: aliases,
                    })
                    .onConflictDoUpdate({
                        target: aliasCache.englishName,
                        set: { aliases: aliases },
                    });
                console.log(`[AliasCache] Saved cache for "${englishName}"`);
            } catch (cacheError) {
                console.error("Failed to save alias cache:", cacheError);
                // Don't fail the request if cache save fails
            }
        }

        return aliases;
    } catch (error) {
        console.error("Error calling Typhoon API:", error);
        return [];
    }
}

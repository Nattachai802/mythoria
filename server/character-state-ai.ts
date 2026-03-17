"use server";

import { db } from "@/db/drizzle";
import { characters, locations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

// API Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA7O91TiZA3oB48B2NbRlgs5jNkwIx-wQo";
const GEMINI_MODEL = "gemini-2.5-flash";

const TYPHOON_API_KEY = "sk-p92ZcqcevSS7i0ANIJXKyCp4g6MvqsgsEDy1ZuQJNuRgmpzN";
const TYPHOON_MODEL = "typhoon-v2.5-30b-a3b-instruct";

// Initialize Gemini client
const geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Initialize Typhoon client (using OpenAI SDK)
const typhoonClient = new OpenAI({
    apiKey: TYPHOON_API_KEY,
    baseURL: "https://api.opentyphoon.ai/v1",
});

// Rate limit tracking
let lastGeminiRateLimitRetry = 0;
let lastTyphoonRateLimitRetry = 0;

// ============================================
// Types
// ============================================

interface CharacterLocationState {
    place: string;
    coordinates: string | null;
    in_contact_with: string[];
}

interface CharacterVitals {
    health: number;
    energy: string;
    status: string;
    specific_injuries: string[];
}

interface CharacterMentalState {
    mood: string;
    current_objective: string;
    mood_intensity: number;
}

interface CharacterAbilitiesEquipment {
    equipment: string[];
    abilities_used: string[];
    cooldowns: string[];
}

interface CharacterRelationship {
    target: string;
    dynamic: string;
    current_sentiment: string;
}

export interface ExtractedCharacterState {
    name: string;
    location: CharacterLocationState;
    vitals: CharacterVitals;
    mental_state: CharacterMentalState;
    abilities_and_equipment: CharacterAbilitiesEquipment;
    relationships: CharacterRelationship[];
    notes: string;
}

interface AIExtractionResult {
    characters: ExtractedCharacterState[];
    confidence?: number;
}

// Character info for prompt generation
interface CharacterInfo {
    name: string;
    aliases: string[];
}

// ============================================
// Prompt Generation
// ============================================

function generateExtractionPrompt(characterInfoList: CharacterInfo[], content: string): string {
    // Build character list with aliases for the prompt
    const characterDescriptions = characterInfoList.map((char) => {
        if (char.aliases.length > 0) {
            return `${char.name} (หรือเรียกว่า: ${char.aliases.join(", ")})`;
        }
        return char.name;
    });

    return `คุณเป็นผู้ช่วยวิเคราะห์นิยาย กรุณาอ่านเนื้อหาและสกัดสถานะตัวละครทุกตัวที่ปรากฏ ณ ตอนจบของบท

ตัวละครที่อาจปรากฏ (พร้อมชื่อเล่น/ฉายา):
${characterDescriptions.map((desc, i) => `${i + 1}. ${desc}`).join("\n")}

**สำคัญ**: ถ้าเจอชื่อเล่นหรือฉายาในเนื้อหา ให้ใช้ชื่อหลัก (ชื่อแรก) ในผลลัพธ์เสมอ

เนื้อหา:
${content}

ตอบเป็น JSON format เท่านั้น (ไม่ต้องมี markdown code block):
{
  "characters": [
    {
      "name": "ชื่อหลักของตัวละคร (ไม่ใช่ชื่อเล่น)",
      "location": {
        "place": "สถานที่ปัจจุบัน",
        "coordinates": "ไม่ระบุ หรือพิกัดถ้ามี",
        "in_contact_with": ["ชื่อตัวละครที่อยู่ด้วย"]
      },
      "vitals": {
        "health": 0-100,
        "energy": "exhausted/tired/normal/energetic/high",
        "status": "alive/injured/severely_injured/unconscious/dead/escaped",
        "specific_injuries": ["รายละเอียดบาดแผล"]
      },
      "mental_state": {
        "mood": "อารมณ์เป็นภาษาไทย",
        "current_objective": "เป้าหมายปัจจุบัน",
        "mood_intensity": 0-100
      },
      "abilities_and_equipment": {
        "equipment": ["ไอเทมที่มี"],
        "abilities_used": ["ความสามารถที่ใช้ในบทนี้"],
        "cooldowns": []
      },
      "relationships": [
        {
          "target": "ชื่อหลักของตัวละครเป้าหมาย",
          "dynamic": "ความสัมพันธ์",
          "current_sentiment": "ความรู้สึกปัจจุบัน"
        }
      ],
      "notes": "หมายเหตุสำคัญอื่นๆ"
    }
  ]
}

สกัดเฉพาะตัวละครที่ปรากฏในเนื้อหาจริงๆ เท่านั้น ถ้าไม่มีข้อมูลให้ใช้ค่า default ที่เหมาะสม`;
}

// ============================================
// AI API Calls
// ============================================

async function callGemini(prompt: string): Promise<AIExtractionResult | null> {
    try {
        // Check if we're in rate limit cooldown
        const now = Date.now();
        if (lastGeminiRateLimitRetry > now) {
            const waitTime = Math.ceil((lastGeminiRateLimitRetry - now) / 1000);
            console.log(`[Gemini] Rate limited, waiting ${waitTime}s...`);
            return null;
        }

        const response = await geminiClient.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                temperature: 0.3,
                maxOutputTokens: 8192,
            },
        });

        const content = response.text;

        if (!content) {
            console.error("[Gemini] No content in response");
            return null;
        }

        return parseAIResponse(content, "Gemini");
    } catch (error: any) {
        console.error("[Gemini] Error:", error?.message || error);

        // Handle rate limit errors
        if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota")) {
            console.log("[Gemini] Rate limited, applying 60s backoff");
            lastGeminiRateLimitRetry = Date.now() + 60000;
        }

        return null;
    }
}

async function callTyphoon(prompt: string): Promise<AIExtractionResult | null> {
    try {
        // Check if we're in rate limit cooldown
        const now = Date.now();
        if (lastTyphoonRateLimitRetry > now) {
            const waitTime = Math.ceil((lastTyphoonRateLimitRetry - now) / 1000);
            console.log(`[Typhoon] Rate limited, waiting ${waitTime}s...`);
            return null;
        }

        const response = await typhoonClient.chat.completions.create({
            model: TYPHOON_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that extracts character states from novel content. Always respond in valid JSON format."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 8192,
            temperature: 0.3,
        });

        const content = response.choices?.[0]?.message?.content;

        if (!content) {
            console.error("[Typhoon] No content in response");
            return null;
        }

        return parseAIResponse(content, "Typhoon");
    } catch (error: any) {
        console.error("[Typhoon] Error:", error?.message || error);

        // Handle rate limit errors
        if (error?.status === 429 || error?.message?.includes("429")) {
            console.log("[Typhoon] Rate limited, applying 60s backoff");
            lastTyphoonRateLimitRetry = Date.now() + 60000;
        }

        return null;
    }
}

function parseAIResponse(content: string, source: string): AIExtractionResult | null {
    try {
        // Clean up possible markdown code blocks
        let jsonStr = content.trim();
        if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
        }

        const parsed = JSON.parse(jsonStr);
        console.log(`[${source}] Parsed ${parsed.characters?.length || 0} characters`);
        return parsed as AIExtractionResult;
    } catch (error) {
        console.error(`[${source}] Failed to parse response:`, content.substring(0, 200));
        return null;
    }
}

// ============================================
// Voting Logic
// ============================================

export async function matchLocationId(
    locationName: string,
    novelId: string
): Promise<string | null> {
    if (!locationName) return null;

    try {
        // Try exact match first
        const exact = await db.query.locations.findFirst({
            where: eq(locations.novelId, novelId),
        });

        // Simple fuzzy match - find location that contains the name
        const allLocations = await db.query.locations.findMany({
            where: eq(locations.novelId, novelId),
        });

        const normalized = locationName.toLowerCase().trim();
        const match = allLocations.find(
            (loc) =>
                loc.name.toLowerCase().includes(normalized) ||
                normalized.includes(loc.name.toLowerCase())
        );

        return match?.id || null;
    } catch (error) {
        console.error("[LocationMatch] Error:", error);
        return null;
    }
}

function averageNumber(a: number | undefined, b: number | undefined): number | undefined {
    if (a !== undefined && b !== undefined) return Math.round((a + b) / 2);
    return a ?? b;
}

function mergeCharacterStates(
    geminiState: ExtractedCharacterState | undefined,
    typhoonState: ExtractedCharacterState | undefined
): ExtractedCharacterState | null {
    if (!geminiState && !typhoonState) return null;
    if (!geminiState) return typhoonState!;
    if (!typhoonState) return geminiState;

    // Merge with voting logic
    return {
        name: geminiState.name || typhoonState.name,
        location: {
            place: geminiState.location?.place || typhoonState.location?.place || "",
            coordinates: geminiState.location?.coordinates || typhoonState.location?.coordinates || null,
            in_contact_with: [
                ...new Set([
                    ...(geminiState.location?.in_contact_with || []),
                    ...(typhoonState.location?.in_contact_with || []),
                ]),
            ],
        },
        vitals: {
            health: averageNumber(geminiState.vitals?.health, typhoonState.vitals?.health) || 100,
            energy: geminiState.vitals?.energy || typhoonState.vitals?.energy || "normal",
            status: geminiState.vitals?.status || typhoonState.vitals?.status || "alive",
            specific_injuries: [
                ...new Set([
                    ...(geminiState.vitals?.specific_injuries || []),
                    ...(typhoonState.vitals?.specific_injuries || []),
                ]),
            ],
        },
        mental_state: {
            mood: geminiState.mental_state?.mood || typhoonState.mental_state?.mood || "neutral",
            current_objective:
                geminiState.mental_state?.current_objective ||
                typhoonState.mental_state?.current_objective ||
                "",
            mood_intensity:
                averageNumber(
                    geminiState.mental_state?.mood_intensity,
                    typhoonState.mental_state?.mood_intensity
                ) || 50,
        },
        abilities_and_equipment: {
            equipment: [
                ...new Set([
                    ...(geminiState.abilities_and_equipment?.equipment || []),
                    ...(typhoonState.abilities_and_equipment?.equipment || []),
                ]),
            ],
            abilities_used: [
                ...new Set([
                    ...(geminiState.abilities_and_equipment?.abilities_used || []),
                    ...(typhoonState.abilities_and_equipment?.abilities_used || []),
                ]),
            ],
            cooldowns: [
                ...new Set([
                    ...(geminiState.abilities_and_equipment?.cooldowns || []),
                    ...(typhoonState.abilities_and_equipment?.cooldowns || []),
                ]),
            ],
        },
        relationships: [
            ...geminiState.relationships,
            ...typhoonState.relationships.filter(
                (tr) => !geminiState.relationships.some((gr) => gr.target === tr.target)
            ),
        ],
        notes: [geminiState.notes, typhoonState.notes].filter(Boolean).join(" | "),
    };
}

// ============================================
// Main Export Function
// ============================================

export async function extractCharacterStatesWithVoting(
    noteContent: string,
    novelId: string
): Promise<{
    success: boolean;
    states: ExtractedCharacterState[];
    confidence: number;
    error?: string;
}> {
    try {
        // 1. Get all characters for this novel
        const novelCharacters = await db.query.characters.findMany({
            where: eq(characters.novelId, novelId),
        });

        if (novelCharacters.length === 0) {
            return { success: true, states: [], confidence: 100 };
        }

        // Build character info with aliases
        const characterInfoList: CharacterInfo[] = novelCharacters.map((c) => {
            // Parse aliases from jsonb field
            let aliases: string[] = [];
            if (c.aliases) {
                if (Array.isArray(c.aliases)) {
                    aliases = c.aliases.filter((a): a is string => typeof a === "string");
                } else if (typeof c.aliases === "string") {
                    aliases = [c.aliases];
                }
            }
            return {
                name: c.name,
                aliases,
            };
        });

        // 2. Generate prompt with aliases
        const prompt = generateExtractionPrompt(characterInfoList, noteContent);

        // 3. Call both AIs in parallel
        console.log("[VotingService] Calling Gemini and Typhoon in parallel...");
        const [geminiResult, typhoonResult] = await Promise.all([
            callGemini(prompt),
            callTyphoon(prompt),
        ]);

        console.log(`[VotingService] Gemini: ${geminiResult ? "OK" : "FAILED"}, Typhoon: ${typhoonResult ? "OK" : "FAILED"}`);

        // 4. If both failed, return error
        if (!geminiResult && !typhoonResult) {
            return {
                success: false,
                states: [],
                confidence: 0,
                error: "Both AI services failed to respond",
            };
        }

        // 5. Merge results with voting
        const geminiChars = geminiResult?.characters || [];
        const typhoonChars = typhoonResult?.characters || [];

        // Build alias -> main name mapping for normalization
        const aliasToMainName = new Map<string, string>();
        for (const charInfo of characterInfoList) {
            const mainNameLower = charInfo.name.toLowerCase();
            aliasToMainName.set(mainNameLower, charInfo.name);
            for (const alias of charInfo.aliases) {
                aliasToMainName.set(alias.toLowerCase(), charInfo.name);
            }
        }

        // Normalize character state name to main name
        const normalizeToMainName = (name: string): string => {
            const mainName = aliasToMainName.get(name.toLowerCase());
            return mainName || name; // Return original if not found in mapping
        };

        // Group all character states by their main name (normalized)
        const statesByMainName = new Map<string, ExtractedCharacterState[]>();

        for (const char of [...geminiChars, ...typhoonChars]) {
            const mainName = normalizeToMainName(char.name);
            const normalizedChar = { ...char, name: mainName }; // Use main name

            if (!statesByMainName.has(mainName)) {
                statesByMainName.set(mainName, []);
            }
            statesByMainName.get(mainName)!.push(normalizedChar);
        }

        // Merge all states for each character
        const mergedStates: ExtractedCharacterState[] = [];

        for (const [mainName, charStates] of statesByMainName) {
            if (charStates.length === 0) continue;

            // Merge all states for this character (could be 1-4 entries: up to 2 from each AI)
            let mergedState = charStates[0];
            for (let i = 1; i < charStates.length; i++) {
                mergedState = mergeCharacterStates(mergedState, charStates[i])!;
            }

            if (mergedState) {
                mergedStates.push(mergedState);
            }
        }

        // 6. Calculate confidence based on agreement
        let confidence = 50;
        if (geminiResult && typhoonResult) {
            // Both responded - higher confidence
            // Normalize names for comparison
            const geminiNamesNormalized = new Set(geminiChars.map((c) => normalizeToMainName(c.name)));
            const typhoonNamesNormalized = new Set(typhoonChars.map((c) => normalizeToMainName(c.name)));
            const intersection = [...geminiNamesNormalized].filter((n) => typhoonNamesNormalized.has(n)).length;
            const union = statesByMainName.size;
            confidence = union > 0 ? Math.round((intersection / union) * 100) : 50;
            confidence = Math.max(50, confidence); // Minimum 50% if both responded
        } else {
            // Only one responded
            confidence = 40;
        }

        console.log(`[VotingService] Merged ${mergedStates.length} character states, confidence: ${confidence}%`);

        return {
            success: true,
            states: mergedStates,
            confidence,
        };
    } catch (error) {
        console.error("[VotingService] Error:", error);
        return {
            success: false,
            states: [],
            confidence: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

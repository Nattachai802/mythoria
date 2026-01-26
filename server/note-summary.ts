'use server';

import { db } from "@/db/drizzle";
import { notes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";

// API Configuration - reuse from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyA7O91TiZA3oB48B2NbRlgs5jNkwIx-wQo";
const GEMINI_MODEL = "gemini-2.5-flash";

// Initialize Gemini client
const geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Rate limit tracking
let lastRateLimitRetry = 0;

// Summary prompt
const SUMMARY_PROMPT = `คุณเป็นผู้ช่วยสรุปเนื้อหานิยาย กรุณาสรุปเนื้อหาต่อไปนี้ใน 2-3 ประโยคสั้นๆ ภาษาไทย
เน้นเหตุการณ์สำคัญ ตัวละครหลัก และจุดพลิกผัน

เนื้อหา:
{content}

ตอบเป็นข้อความสรุปสั้นๆ เท่านั้น ไม่ต้องมีหัวข้อ bullet points หรือ formatting ใดๆ`;

// ============================================
// EXTRACT PLAIN TEXT FROM HTML
// ============================================

function extractPlainText(content: any): string {
    if (!content) return "";

    let html = "";
    if (typeof content === "string") {
        html = content;
    } else if (content?.text) {
        html = content.text;
    } else if (content?.ops) {
        // Quill Delta format
        html = content.ops
            .map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
            .join("");
    }

    // Strip HTML tags
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

// ============================================
// GENERATE NOTE SUMMARY
// ============================================

/**
 * สร้าง summary สำหรับ note โดยใช้ AI
 * ถ้ามี summary อยู่แล้ว (cached) จะ return ค่าเดิม
 */
export async function generateNoteSummary(
    noteId: string,
    forceRegenerate: boolean = false
): Promise<{
    success: boolean;
    summary?: string;
    cached?: boolean;
    error?: string;
}> {
    try {
        // 1. Get note
        const note = await db.query.notes.findFirst({
            where: eq(notes.id, noteId),
        });

        if (!note) {
            return { success: false, error: "Note not found" };
        }

        // 2. Check if summary already exists (cache)
        if (note.summary && !forceRegenerate) {
            console.log(`[NoteSummary] Using cached summary for note ${noteId}`);
            return { success: true, summary: note.summary, cached: true };
        }

        // 3. Extract plain text from content
        const plainText = extractPlainText(note.content);

        if (!plainText || plainText.length < 50) {
            return { success: false, error: "เนื้อหาสั้นเกินไปสำหรับการสรุป" };
        }

        // 4. Truncate if too long (save tokens)
        const MAX_CHARS = 8000; // ~2000 Thai words
        let textToSummarize = plainText;
        if (plainText.length > MAX_CHARS) {
            textToSummarize = plainText.substring(0, MAX_CHARS) + "...";
        }

        // 5. Check rate limit
        const now = Date.now();
        if (lastRateLimitRetry > now) {
            const waitTime = Math.ceil((lastRateLimitRetry - now) / 1000);
            return {
                success: false,
                error: `Rate limited, กรุณารอ ${waitTime} วินาที`
            };
        }

        // 6. Call Gemini
        console.log(`[NoteSummary] Generating summary for note ${noteId}...`);

        const prompt = SUMMARY_PROMPT.replace("{content}", textToSummarize);

        const response = await geminiClient.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
                temperature: 0.3,
                maxOutputTokens: 256, // Summary ไม่ต้องยาว
            },
        });

        const summary = response.text?.trim();

        if (!summary) {
            return { success: false, error: "AI returned empty response" };
        }

        // 7. Save to database (cache)
        await db
            .update(notes)
            .set({ summary })
            .where(eq(notes.id, noteId));

        console.log(`[NoteSummary] Generated and saved summary for note ${noteId}`);

        return { success: true, summary, cached: false };

    } catch (error: any) {
        console.error("[NoteSummary] Error:", error?.message || error);

        // Handle rate limit
        if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota")) {
            lastRateLimitRetry = Date.now() + 60000;
            return { success: false, error: "Rate limited, กรุณารอ 60 วินาที" };
        }

        return {
            success: false,
            error: error?.message || "Failed to generate summary"
        };
    }
}

// ============================================
// SAVE NOTE SUMMARY (Manual Edit)
// ============================================

/**
 * บันทึก summary ที่ user แก้ไขเอง
 */
export async function saveNoteSummary(
    noteId: string,
    summary: string,
    novelId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await db
            .update(notes)
            .set({ summary })
            .where(eq(notes.id, noteId));

        if (novelId) {
            revalidatePath(`/dashboard/project/${novelId}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error("[NoteSummary] Save error:", error);
        return { success: false, error: "Failed to save summary" };
    }
}

// ============================================
// CLEAR NOTE SUMMARY
// ============================================

/**
 * ลบ summary เพื่อให้ generate ใหม่ได้
 */
export async function clearNoteSummary(
    noteId: string
): Promise<{ success: boolean }> {
    try {
        await db
            .update(notes)
            .set({ summary: null })
            .where(eq(notes.id, noteId));

        return { success: true };
    } catch (error) {
        console.error("[NoteSummary] Clear error:", error);
        return { success: false };
    }
}

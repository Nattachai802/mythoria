'use server';

import { db } from "@/db/drizzle";
import { chapters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { revalidatePath } from "next/cache";

// API Configuration - reuse from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
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
// GENERATE SUMMARY
// ============================================

/**
 * สร้าง summary สำหรับ chapter โดยใช้ AI
 * ถ้ามี summary อยู่แล้ว (cached) จะ return ค่าเดิม
 */
export async function generateChapterSummary(
    chapterId: string,
    forceRegenerate: boolean = false
): Promise<{
    success: boolean;
    summary?: string;
    cached?: boolean;
    error?: string;
}> {
    try {
        // 1. Get chapter
        const chapter = await db.query.chapters.findFirst({
            where: eq(chapters.id, chapterId),
        });

        if (!chapter) {
            return { success: false, error: "Chapter not found" };
        }

        // 2. Check if summary already exists (cache)
        if (chapter.summary && !forceRegenerate) {
            console.log(`[ChapterSummary] Using cached summary for chapter ${chapterId}`);
            return { success: true, summary: chapter.summary, cached: true };
        }

        // 3. Extract plain text from content
        const content = chapter.content as any;
        let plainText = "";

        if (typeof content === "string") {
            plainText = content;
        } else if (content?.text) {
            plainText = content.text;
        } else if (content?.ops) {
            // Quill Delta format
            plainText = content.ops
                .map((op: any) => (typeof op.insert === "string" ? op.insert : ""))
                .join("");
        }

        // Strip HTML tags
        plainText = plainText
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\s+/g, " ")
            .trim();

        if (!plainText || plainText.length < 50) {
            return { success: false, error: "Content too short to summarize" };
        }

        // 4. Truncate if too long (save tokens)
        const MAX_CHARS = 8000; // ~2000 Thai words
        if (plainText.length > MAX_CHARS) {
            plainText = plainText.substring(0, MAX_CHARS) + "...";
        }

        // 5. Check rate limit
        const now = Date.now();
        if (lastRateLimitRetry > now) {
            const waitTime = Math.ceil((lastRateLimitRetry - now) / 1000);
            return {
                success: false,
                error: `Rate limited, please try again in ${waitTime} seconds`
            };
        }

        // 6. Call Gemini
        console.log(`[ChapterSummary] Generating summary for chapter ${chapterId}...`);

        const prompt = SUMMARY_PROMPT.replace("{content}", plainText);

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
            .update(chapters)
            .set({ summary })
            .where(eq(chapters.id, chapterId));

        console.log(`[ChapterSummary] Generated and saved summary for chapter ${chapterId}`);

        return { success: true, summary, cached: false };

    } catch (error: any) {
        console.error("[ChapterSummary] Error:", error?.message || error);

        // Handle rate limit
        if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota")) {
            lastRateLimitRetry = Date.now() + 60000;
            return { success: false, error: "Rate limited, please try again in 60 seconds" };
        }

        return {
            success: false,
            error: error?.message || "Failed to generate summary"
        };
    }
}

// ============================================
// SAVE SUMMARY (Manual Edit)
// ============================================

/**
 * บันทึก summary ที่ user แก้ไขเอง
 */
export async function saveChapterSummary(
    chapterId: string,
    summary: string,
    novelId?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await db
            .update(chapters)
            .set({ summary })
            .where(eq(chapters.id, chapterId));

        if (novelId) {
            revalidatePath(`/dashboard/project/${novelId}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error("[ChapterSummary] Save error:", error);
        return { success: false, error: "Failed to save summary" };
    }
}

// ============================================
// CLEAR SUMMARY (For Regeneration)
// ============================================

/**
 * ลบ summary เพื่อให้ generate ใหม่ได้
 */
export async function clearChapterSummary(
    chapterId: string
): Promise<{ success: boolean }> {
    try {
        await db
            .update(chapters)
            .set({ summary: null })
            .where(eq(chapters.id, chapterId));

        return { success: true };
    } catch (error) {
        console.error("[ChapterSummary] Clear error:", error);
        return { success: false };
    }
}

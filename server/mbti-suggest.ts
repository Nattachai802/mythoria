'use server';

// ช่วยหา MBTI / Big Five — อ่านภาพรวม + จิตใจ (มิติตัวละคร/แรงจูงใจเชิงลึก) ที่ผู้เขียนเขียน ให้ AI ตอบคำถามสถานการณ์พร้อมหลักฐาน
// สองระบบเรียก AI แยกกัน (เอกเทศ) — ผลไปเทียบกันทีหลังด้วย checkCoherence ในโค้ด
// ไม่เขียน DB — ผลอยู่ใน state ของหน้าจอ ผู้เขียนกด "ใช้" แล้วค่อยบันทึกผ่าน updateCharacterSection

import { db } from "@/db/drizzle";
import { characters } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callAi, logParseFailure, AiControlError } from "@/lib/ai-gateway";
import { requireNovelAccess, authErrorMessage } from "@/lib/authz";
import { MBTI_AI_SCHEMA, MBTI_QUESTIONS, buildMbtiPrompt, verifyAnswers } from "@/lib/mbti-suggest";
import { B5_AI_SCHEMA, B5_QUESTIONS, buildBigFivePrompt } from "@/lib/bigfive-suggest";
import { ENN_AI_SCHEMA, ENN_QUESTIONS, buildEnneagramPrompt, verifyEnnAnswers } from "@/lib/enneagram-suggest";
import type { CharacterMotive, CharacterPsych } from "@/lib/character-profile";
import { FACET_AI_SCHEMA, buildFacetPrompt, verifyFacetExtract, type FacetExtract } from "@/lib/facet-extract";

const MIN_TEXT = 80;      // สั้นกว่านี้ไม่มีอะไรให้ AI อ่าน → ให้ผู้เขียนตอบเองทั้งหมด (ไม่เสีย token)
const MAX_FIELD = 3000;

/** choice: "a"/"b" (MBTI/Big Five) หรือเลข type "1"–"9" (Enneagram) */
export type SuggestAnswer = { id: string; choice: string | null; quote: string };
export type SuggestResult =
    | { success: true; answers: Record<string, SuggestAnswer>; usedAi: boolean; notice?: string }
    | { success: false; error: string };
/** @deprecated ชื่อเดิม */
export type MbtiSuggestResult = SuggestResult;

type Kind = {
    feature: "mbti-suggest" | "bigfive-suggest" | "enneagram-suggest";
    questions: { id: string }[];
    verify?: (raw: unknown, source: string) => Record<string, SuggestAnswer>;
    schema: object;
    prompt: (name: string, source: string) => { system: string; prompt: string };
    label: string;
};
const KINDS = {
    mbti: { feature: "mbti-suggest", questions: MBTI_QUESTIONS, schema: MBTI_AI_SCHEMA, prompt: buildMbtiPrompt, label: "MBTI" },
    bigfive: { feature: "bigfive-suggest", questions: B5_QUESTIONS, schema: B5_AI_SCHEMA, prompt: buildBigFivePrompt, label: "Big Five" },
    enneagram: { feature: "enneagram-suggest", questions: ENN_QUESTIONS, schema: ENN_AI_SCHEMA, prompt: buildEnneagramPrompt, label: "Enneagram", verify: verifyEnnAnswers },
} satisfies Record<string, Kind>;

/** ข้อความที่ผู้เขียนเขียนไว้ (ภาพรวม + แรงจูงใจเชิงลึก) — แหล่งเดียวของทุกตัวช่วยวิเคราะห์ */
function characterSource(c: typeof characters.$inferSelect) {
    const m = (c.motive ?? {}) as CharacterMotive;
    const parts: [string, string | null | undefined][] = [
        ["สรุป", c.description], ["บุคลิกภาพ", c.personality], ["ปูมหลัง", c.backstory],
        ["เป้าหมาย", c.goals], ["แรงจูงใจ", c.motivation], ["ความขัดแย้ง", c.conflict],
        ["จุดแข็ง", c.strengths], ["จุดอ่อน", c.weaknesses],
        ["วิธีที่ใช้ไปให้ถึง", m.strategy], ["ความเชื่อผิดๆ", m.lie], ["คุณค่าที่ยึดถือ", m.value],
        ["จุดกดดัน", m.pressurePoint], ["บาดแผลในอดีต", m.wound],
    ];
    const source = parts
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `[${k}]\n${v!.trim().slice(0, MAX_FIELD)}`)
        .join("\n\n");
    return { source, enough: source.replace(/\[[^\]]+\]/g, "").trim().length >= MIN_TEXT };
}

async function loadCharacter(characterId: string) {
    const [c] = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1);
    if (!c) return null;
    await requireNovelAccess(c.novelId);
    return c;
}

async function suggest(characterId: string, kind: Kind): Promise<SuggestResult> {
    try {
        const c = await loadCharacter(characterId);
        if (!c) return { success: false, error: "ไม่พบตัวละคร" };
        const { source, enough } = characterSource(c);

        const empty = verifyAnswers(null, "", kind.questions);
        if (!enough) {
            return { success: true, answers: empty, usedAi: false, notice: "ยังมีข้อมูลตัวละครน้อย — ตอบคำถามเองได้เลย" };
        }

        try {
            const p = kind.prompt(c.name, source);
            const resp = await callAi({ feature: kind.feature, novelId: c.novelId, system: p.system, prompt: p.prompt, responseSchema: kind.schema });
            let raw: unknown;
            try {
                const t = resp.text.trim();
                raw = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
            } catch {
                await logParseFailure(resp.logId, resp.text);
                return { success: true, answers: empty, usedAi: false, notice: "AI ตอบกลับผิดรูปแบบ — ตอบคำถามเองได้เลย" };
            }
            return { success: true, answers: kind.verify ? kind.verify(raw, source) : verifyAnswers(raw, source, kind.questions), usedAi: true };
        } catch (error) {
            // AI ล่ม/โควตาเต็ม — ฟีเจอร์ยังใช้ได้ในโหมดตอบเอง
            const msg = error instanceof AiControlError ? error.message : "AI ใช้งานไม่ได้ตอนนี้";
            console.error(`[${kind.label}Suggest] AI error:`, error);
            return { success: true, answers: empty, usedAi: false, notice: `${msg} — ตอบคำถามเองได้เลย` };
        }
    } catch (error) {
        return { success: false, error: authErrorMessage(error, `ช่วยหา ${kind.label} ไม่สำเร็จ`) };
    }
}

export async function suggestMbti(characterId: string) { return suggest(characterId, KINDS.mbti); }
export async function suggestBigFive(characterId: string) { return suggest(characterId, KINDS.bigfive); }
export async function suggestEnneagram(characterId: string) { return suggest(characterId, KINDS.enneagram); }

export type FacetExtractResult =
    | { success: true; draft: FacetExtract; usedAi: boolean; notice?: string }
    | { success: false; error: string };

/** สกัดนิสัยเด่น + นิสัยที่ขัดกันเอง — ไม่เขียน DB ผู้เขียนติ๊กเลือกแล้วค่อยบันทึกผ่าน updateCharacterSection */
export async function extractFacets(characterId: string): Promise<FacetExtractResult> {
    const none: FacetExtract = { facets: [], contradictions: [] };
    try {
        const c = await loadCharacter(characterId);
        if (!c) return { success: false, error: "ไม่พบตัวละคร" };
        const { source, enough } = characterSource(c);
        if (!enough) return { success: true, draft: none, usedAi: false, notice: "ยังมีข้อมูลตัวละครน้อย — เขียนภาพรวมหรือแรงจูงใจเพิ่มก่อน" };
        const existing = ((c.psych ?? {}) as CharacterPsych).facets?.map((f) => f.name) ?? [];
        try {
            const p = buildFacetPrompt(c.name, source, existing);
            const resp = await callAi({ feature: "facet-extract", novelId: c.novelId, system: p.system, prompt: p.prompt, responseSchema: FACET_AI_SCHEMA });
            let raw: unknown;
            try {
                const t = resp.text.trim();
                raw = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
            } catch {
                await logParseFailure(resp.logId, resp.text);
                return { success: true, draft: none, usedAi: false, notice: "AI ตอบกลับผิดรูปแบบ — ลองใหม่อีกครั้ง" };
            }
            return { success: true, draft: verifyFacetExtract(raw, source, existing), usedAi: true };
        } catch (error) {
            const msg = error instanceof AiControlError ? error.message : "AI ใช้งานไม่ได้ตอนนี้";
            console.error("[FacetExtract] AI error:", error);
            return { success: true, draft: none, usedAi: false, notice: msg };
        }
    } catch (error) {
        return { success: false, error: authErrorMessage(error, "สกัดนิสัยไม่สำเร็จ") };
    }
}

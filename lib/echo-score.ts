/**
 * Echo Score — Phase 2 (docs/plot-analysis-plan.md)
 *
 * วัดว่า "การ์ดนี้คาดเดาได้แค่ไหน" จากมุมมองผู้อ่านที่เพิ่งอ่านถึงจังหวะก่อนหน้า
 *
 * ส่วนนี้เป็น pure logic ไม่เรียก LLM ไม่มี side effect
 * การเรียก LLM ทำใน server/plot-analysis.ts
 *
 * อ้างอิง: plot-analysis-plan.md §Phase 2
 */

import type { FormatBeat } from "./story-format";
import { createHash } from "crypto";

// ─── Constants ──────────────────────────────────────────────────────────

export const ECHO_PROMPT_VERSION = "1";
export const ECHO_K = 8;
export const ECHO_MODEL = "gemini-2.5-flash";

// ─── Types ──────────────────────────────────────────────────────────────

export interface EchoEvidence {
    hitCount: number;         // LLM ตัดสินว่าตรงกับการ์ดจริงกี่ครั้ง
    guesses: string[];        // ตัวคำเดาทั้ง K ครั้ง (แสดงใน UI)
    matched: number[];        // index ของคำเดาที่ตรง (0-based)
    model: string;            // ชื่อโมเดลที่ใช้
    promptVersion: string;    // ECHO_PROMPT_VERSION
    k: number;                // K ที่ใช้จริง
    inputHash: string;        // hash ของ prefix + card เพื่อ detect การเปลี่ยนแปลง
}

export interface EchoFinding {
    cardCode: string;         // "C04"
    cardId: string;
    cardTitle: string;
    beatIndex: number;
    hasIncomingLink: boolean; // มีเส้น leads_to เข้ามาไหม — ช่วยแยก "ว้าว" vs "มั่ว"
    evidence: EchoEvidence;
}

// ─── Prefix builder ─────────────────────────────────────────────────────

/**
 * สร้างข้อความ prefix จากการ์ดที่ beatIndex น้อยกว่า targetBeatIndex
 *
 * กฎสำคัญ: การ์ดที่ beatIndex เดียวกันคือเกิดพร้อมกัน ห้ามอยู่ใน prefix ของกัน
 * (ถ้าใส่จะเป็นการบอกใบ้ด้วยเหตุการณ์ที่เกิดพร้อมกัน → echo สูงเกินจริงทุกใบ)
 */
export function buildPrefixText(beats: FormatBeat[], targetBeatIndex: number): string {
    const prefixBeats = beats
        .filter(b => b.beatIndex < targetBeatIndex && !b.isBoardNote)
        .sort((a, b) => a.beatIndex - b.beatIndex);

    if (prefixBeats.length === 0) return "";

    return prefixBeats
        .map(b => {
            const parts: string[] = [`[${b.code}]`, b.title];
            if (b.content) parts.push(`— ${b.content}`);
            if (b.participants.length > 0) {
                const names = b.participants.map(p => p.name).join(", ");
                parts.push(`(${names})`);
            }
            return parts.join(" ");
        })
        .join("\n");
}

/**
 * สร้างข้อความของการ์ดเป้าหมาย (ใช้ใน judge prompt + hash)
 */
export function buildCardText(beat: FormatBeat): string {
    const parts = [beat.title];
    if (beat.content) parts.push(beat.content);
    if (beat.participants.length > 0) {
        parts.push(beat.participants.map(p => p.name).join(", "));
    }
    return parts.join(" — ");
}

// ─── Hash ───────────────────────────────────────────────────────────────

/**
 * SHA-256 สั้น 12 char — เทียบว่า prefix + card เปลี่ยนไปไหมก่อนเรียก LLM ซ้ำ
 */
export function hashEchoInput(prefixText: string, cardText: string): string {
    return createHash("sha256")
        .update(`${prefixText}|||${cardText}`)
        .digest("hex")
        .slice(0, 12);
}

// ─── Prompts ────────────────────────────────────────────────────────────

/**
 * Prompt ขอให้ LLM สุ่มต่อว่า "ต่อไปน่าจะเกิดอะไร" K ครั้ง
 *
 * คืน JSON array of strings — แต่ละสตริงคือคำเดา 1 อัน
 */
export function buildGuessPrompt(prefixText: string, k: number): string {
    return `คุณเป็นผู้อ่านนิยายที่เพิ่งอ่านเหตุการณ์ต่อไปนี้:

---
${prefixText}
---

จินตนาการว่าเหตุการณ์ต่อไปที่น่าจะเกิดขึ้นคืออะไร
สุ่มเดา ${k} ทางเลือกที่แตกต่างกัน แต่ละทางเลือกเป็นเหตุการณ์สั้นๆ 1 ประโยค

ตอบเฉพาะ JSON array of strings เท่านั้น ไม่มีคำอื่น:
["เดาที่ 1", "เดาที่ 2", ...]`;
}

/**
 * Prompt ให้ LLM ตัดสินว่า guesses ใดตรงกับเหตุการณ์จริง
 *
 * คืน JSON { hits: number, matched: number[] }
 * - hits: จำนวนที่ตรง
 * - matched: index (0-based) ของคำเดาที่ตรง
 */
export function buildJudgePrompt(
    prefixText: string,
    cardText: string,
    guesses: string[],
): string {
    const guessLines = guesses
        .map((g, i) => `${i}: "${g}"`)
        .join("\n");

    return `คุณเป็นผู้ตัดสินว่าคำเดาใดตรงกับเหตุการณ์จริงที่เกิดขึ้นในนิยาย

บริบทก่อนหน้า:
---
${prefixText}
---

เหตุการณ์จริงที่เกิดขึ้น:
"${cardText}"

คำเดาทั้งหมด:
${guessLines}

คำเดาที่ "ตรง" คือคำเดาที่ผู้อ่านทั่วไปจะถือว่าทายถูกหรือเกือบถูก
ไม่ต้องตรงทุกคำ แค่ตรงความคิดหลักก็นับ

ตอบเฉพาะ JSON เท่านั้น ไม่มีคำอื่น:
{"hits": <จำนวน>, "matched": [<index ที่ตรง>]}`;
}

// ─── Validators ─────────────────────────────────────────────────────────

/** แปลง LLM output เป็น string[] — กัน format แปลก */
export function parseGuessResponse(raw: string): string[] | null {
    try {
        const trimmed = raw.trim();
        // ดึงเฉพาะส่วน JSON array ออกมา (กันขึ้นต้นด้วย ```json ฯลฯ)
        const match = trimmed.match(/\[[\s\S]*\]/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((g): g is string => typeof g === "string");
    } catch {
        return null;
    }
}

/** แปลง LLM output เป็น { hits, matched } */
export function parseJudgeResponse(raw: string): { hits: number; matched: number[] } | null {
    try {
        const trimmed = raw.trim();
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (
            typeof parsed.hits !== "number" ||
            !Array.isArray(parsed.matched)
        ) return null;
        return {
            hits: parsed.hits,
            matched: parsed.matched.filter((i: unknown) => typeof i === "number"),
        };
    } catch {
        return null;
    }
}

// ─── Beat filter ────────────────────────────────────────────────────────

/**
 * กรองการ์ดที่ควรตรวจ echo score
 * ข้าม: sticky-note, board note, การ์ดที่ไม่มี title, การ์ดแรกในฉาก (ไม่มี prefix)
 */
export function filterEchoTargets(beats: FormatBeat[]): FormatBeat[] {
    // beatIndex ต่ำสุดที่มีอยู่จริง (ไม่จำเป็นต้องเป็น 0)
    const minBeatIndex = Math.min(...beats.map(b => b.beatIndex));
    return beats.filter(
        b =>
            !b.isBoardNote &&
            b.title.trim() !== "" &&
            b.beatIndex > minBeatIndex, // มีการ์ดก่อนหน้าอย่างน้อย 1 ใบ
    );
}

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

// v2: แยก persona เข้า system role, บังคับ JSON schema ที่ API แทนขอด้วยคำพูดอย่างเดียว,
// จำกัดความยาวคำเดา, เลิกขอ hitCount จากโมเดล (คำนวณจาก matched.length แทน — กัน 2 ค่าขัดกันเอง)
// v3: guesser เห็นสรุปฉากก่อนหน้าทั้งเรื่องด้วย (ไม่ใช่แค่ prefix ในฉากเดียวกัน) — เดิมวัดแค่
// "เดาง่ายในฉากนี้" ไม่ใช่ "เดาง่ายในสายตาคนอ่านที่อ่านมาแล้วทั้งเรื่อง" ตามที่ construct จริงต้องการ
// เปลี่ยนความหมายของ field พอที่ผลเก่า (v1/v2) ไม่ควรเทียบตรงกับผลใหม่ จึงขึ้นเวอร์ชัน
export const ECHO_PROMPT_VERSION = "3";
export const ECHO_K = 5; // ลดจาก 8 — ประหยัด token เล็กน้อย แลกความละเอียดที่ยอมรับได้ (K=3 หยาบเกินไป)
export const ECHO_GUESS_MAX_WORDS = 15;
export const ECHO_MODEL = "gemini-2.5-flash";

// ─── Types ──────────────────────────────────────────────────────────────

export interface EchoEvidence {
    hitCount: number;         // LLM ตัดสินว่าตรงกับการ์ดจริงกี่ครั้ง
    guesses: string[];        // ตัวคำเดาทั้ง K ครั้ง (แสดงใน UI)
    matched: { index: number; reason: string }[]; // ข้อที่ตรง (0-based) + เหตุผลสั้นๆ ว่าทำไมตรง — ตรวจสอบย้อนหลังได้ว่า judge ตัดสินใจถูกไหม
    model: string;            // ชื่อโมเดลที่ใช้
    promptVersion: string;    // ECHO_PROMPT_VERSION
    k: number;                // K ที่ใช้จริง
    inputHash: string;        // hash ของ prefix + card เพื่อ detect การเปลี่ยนแปลง
    // meta สำหรับแสดงผล — เก็บพร้อม evidence ตั้งแต่รอบล่าสุด · แถวเก่ากว่า v1.5 อาจไม่มี
    cardId?: string;
    cardTitle?: string;
    beatIndex?: number;
    hasIncomingLink?: boolean;
    cast?: { alias: string; name: string }[]; // @A/@B ฯลฯ ที่ใช้ตอนสร้าง prompt — ใช้แปลงกลับเป็นชื่อจริงตอนแสดงผล
    // ความครอบคลุมของสรุปฉากก่อนหน้าที่ป้อนให้ guesser — undefined/total=0 = ฉากแรกของเรื่อง ไม่มีฉากก่อนหน้าให้ตรวจ
    priorContextCoverage?: { covered: number; total: number };
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
 * สร้างข้อความ prefix จากการ์ดก่อนหน้าการ์ดเป้าหมาย
 *
 * กฎการเกิดพร้อมกัน (v3): ไม่ได้เดาจาก beatIndex เท่ากันอย่างเดียวอีกต่อไป — เช็คเส้นเชื่อมจริง
 * - การ์ด beatIndex เท่ากัน แต่ผู้เขียน "ไม่ได้" ลากเส้นชนิด simultaneous ไว้ (ดู
 *   lib/simultaneous-beats.ts) = แค่บังเอิญอยู่จังหวะเดียวกันบนกระดาน ไม่ใช่เกิดพร้อมกันจริง
 *   → เอาเข้า prefix ได้ตามปกติ (เดิมตัดทิ้งหมด ทำให้ context บางเกินไปจนเดามั่ว)
 * - การ์ด beatIndex เท่ากัน และมี link "simultaneous" เชื่อมกันจริง = เกิดพร้อมกันตามที่ผู้เขียนตั้งใจ
 *   → ตัดออก (ใส่จะเป็นการบอกใบ้เหตุการณ์ที่เกิดพร้อมกัน → echo สูงเกินจริง)
 * - ยกเว้นมี link "leads_to" ชี้จากการ์ดนั้นมาการ์ดเป้าหมายโดยตรง — แปลว่าผู้เขียนยืนยันเชิงเหตุ-ผล
 *   ชัดเจนกว่า flag เกิดพร้อมกัน เอาเข้า prefix ได้ (เหตุต้องมาก่อนผล)
 *
 * ตัวย่อ @A/@B ฯลฯ มาจาก buildSceneFormat (ย่อผู้ร่วมฉากทั้งเรื่องที่โผล่ ≥2 การ์ดขึ้นไป
 * ยืมรูปแบบเดียวกับ renderSceneMarkdown — ชื่อเต็ม ~5 โทเคน/ครั้ง เทียบ @A ~1 โทเคน)
 * แต่ legend ที่แปะใน prompt ต้องคำนวณจาก "คนที่โผล่ใน prefixBeats เท่านั้น" ห้ามใช้ cast
 * ทั้งฉาก — ไม่งั้นชื่อตัวละคร/สถานที่ที่เพิ่งโผล่ทีหลัง targetBeat จะรั่วเข้าไปใน legend
 * เท่ากับสปอยล์ล่วงหน้าว่า "เรื่องนี้มีตัวนี้อยู่ด้วยนะ" ก่อนเนื้อเรื่องจะพูดถึงจริง ทำให้ AI
 * เดาแม่นขึ้นเพราะรู้ชื่อมาก่อน ไม่ใช่เพราะเนื้อเรื่องเดาง่ายจริง (ตัดค่า Echo Score ให้ผิดความหมาย)
 */
export function buildPrefixText(beats: FormatBeat[], targetBeat: FormatBeat): string {
    const prefixBeats = beats.filter(b => {
        if (b.isBoardNote || b.code === targetBeat.code) return false;
        if (b.beatIndex < targetBeat.beatIndex) return true;
        if (b.beatIndex > targetBeat.beatIndex) return false;
        // beatIndex เท่ากัน — ตัดเฉพาะที่ลิงก์ simultaneous ไว้จริง เว้นแต่มี leads_to ชี้มาการ์ดนี้ยืนยันลำดับเหตุ-ผล
        const flaggedSimultaneous = targetBeat.simultaneousWith.includes(b.code);
        const explicitCause = b.links.some(l => l.kind === "leads_to" && l.toCode === targetBeat.code);
        return explicitCause || !flaggedSimultaneous;
    });
    // beats เข้ามาเรียงตาม beatIndex+เลนอยู่แล้วจากต้นทาง (buildSceneFormat) — filter ไม่ทำลำดับเสีย ไม่ต้อง sort ซ้ำ

    if (prefixBeats.length === 0) return "";

    // legend เฉพาะคนที่โผล่จริงใน prefixBeats — ไม่ใช้ cast ทั้งฉาก (กันสปอยล์ชื่ออนาคต)
    const aliasOf = new Map<string, string>();
    prefixBeats.forEach(b => b.participants.forEach(p => { if (p.alias) aliasOf.set(p.alias, p.name); }));
    const legend = [...aliasOf.entries()].map(([alias, name]) => `${alias}=${name}`).join(", ");

    // format ตัด glue chars ([]/—/()/,) เหลือเว้นวรรคล้วน — วัดจริงกิน token น้อยกว่า
    // format เดิม ~13-16% (ดู scripts/compare-thai-formats.ts, รันกับฉากจริงจาก DB แล้ว)
    const body = prefixBeats
        .map(b => {
            const parts: string[] = [b.code, b.title];
            if (b.content) parts.push(b.content);
            if (b.participants.length > 0) {
                parts.push(b.participants.map(p => p.alias ?? p.name).join(" "));
            }
            return parts.join(" ");
        })
        .join("\n");

    return legend ? `ตัวย่อ: ${legend}\n${body}` : body;
}

/**
 * สร้างข้อความของการ์ดเป้าหมาย (ใช้ใน judge prompt + hash)
 * ใช้ alias เดียวกับ buildPrefixText ได้เลย — legend ถูกประกาศไปแล้วใน prefixText ของ prompt เดียวกัน
 */
export function buildCardText(beat: FormatBeat): string {
    const parts = [beat.title];
    if (beat.content) parts.push(beat.content);
    if (beat.participants.length > 0) {
        parts.push(beat.participants.map(p => p.alias ?? p.name).join(" "));
    }
    return parts.join(" ");
}

// ─── Hash ───────────────────────────────────────────────────────────────

/**
 * SHA-256 สั้น 12 char — เทียบว่า prefix + card + สรุปฉากก่อนหน้าเปลี่ยนไปไหมก่อนเรียก LLM ซ้ำ
 * (priorContext รวมเข้ามาด้วย — ถ้าฉากก่อนหน้าถูกสรุปใหม่ ต้องตรวจซ้ำ ไม่งั้น cache จะเก่าเงียบๆ)
 */
export function hashEchoInput(prefixText: string, cardText: string, priorContext: string = ""): string {
    return createHash("sha256")
        .update(`${prefixText}|||${cardText}|||${priorContext}`)
        .digest("hex")
        .slice(0, 12);
}

// ─── JSON Schemas ───────────────────────────────────────────────────────
// บังคับรูปแบบที่ระดับ API (Gemini responseJsonSchema / OpenAI-compatible response_format)
// แทนที่จะขอด้วยคำพูดในเนื้อ prompt อย่างเดียว — กัน parse fail จากโมเดลใส่คำอธิบาย/markdown fence
// แถมมาแทน parseGuessResponse/parseJudgeResponse ที่ยังคงเป็น fallback ไว้ชั้นสอง (กันเคส provider
// ที่ไม่รองรับ schema จริง เช่น typhoon/openrouter ที่ยังไม่ยืนยัน)

export const ECHO_GUESS_SCHEMA = {
    type: "array",
    items: { type: "string" },
} as const;

export const ECHO_JUDGE_SCHEMA = {
    type: "object",
    properties: {
        matched: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    index: { type: "integer" },
                    reason: { type: "string" },
                },
                required: ["index", "reason"],
            },
        },
    },
    required: ["matched"],
} as const;

// ─── Prompts ────────────────────────────────────────────────────────────
// แยก persona/กติกา/ฟอร์แมต (คงที่ทุกคอล) ไปไว้ system — เหลือแค่เนื้อฉากจริงใน user
// เพื่อให้ role สื่อความหมายตรงตามหน้าที่ ไม่ใช่ยัดทุกอย่างเป็นข้อความก้อนเดียว

export interface EchoPrompt {
    system: string;
    user: string;
}

/**
 * สุ่มเดา K ทาง — คืน JSON array of strings (บังคับด้วย ECHO_GUESS_SCHEMA)
 *
 * priorContext (ถ้ามี) = สรุปฉากก่อนหน้าทั้งเรื่อง (จาก plot_recaps ที่มีอยู่แล้วเท่านั้น — ไม่สร้างสด)
 * แยกบล็อกชัดเจนจาก prefix ในฉากนี้ กัน AI สับสนระหว่าง "รู้มาก่อนแบบคร่าวๆ" กับ "จังหวะจ่อจะเดา"
 */
export function buildGuessPrompt(prefixText: string, k: number, priorContext: string = ""): EchoPrompt {
    const priorBlock = priorContext
        ? `เรื่องราวก่อนหน้านี้ (สรุปคร่าวๆ):\n---\n${priorContext}\n---\n\n`
        : "";
    return {
        system: `คุณเป็นผู้อ่านนิยายที่กำลังอ่านสด ยังไม่รู้เหตุการณ์ที่จะเกิดต่อไป
หน้าที่ของคุณคือจินตนาการว่าเหตุการณ์ถัดไปที่น่าจะเกิดขึ้นคืออะไร

กติกา:
- สุ่มเดา ${k} ทางเลือกที่แตกต่างกันจริง ๆ (คนละแนวคิด ไม่ใช่แค่เปลี่ยนคำ)
- แต่ละทางเลือกเป็นเหตุการณ์สั้น ไม่เกิน ${ECHO_GUESS_MAX_WORDS} คำ
- ห้ามใส่คำนำหน้าเช่น "ข้อ 1", "เดาที่ 1", ตัวเลข หรือเครื่องหมายใด ๆ ในเนื้อความ — ให้เป็นประโยคเหตุการณ์ล้วน ๆ
- ถ้ามี "เรื่องราวก่อนหน้านี้" ให้ใช้เป็นความรู้พื้นหลังประกอบการเดาด้วย (ผู้อ่านจริงจำเรื่องราวที่ผ่านมาได้)
  แต่จุดที่ต้องเดาคือเหตุการณ์ถัดจาก "บริบทในฉากนี้" เท่านั้น
- ตอบเป็น JSON array of strings ตาม schema ที่กำหนดเท่านั้น`,
        user: `${priorBlock}บริบทในฉากนี้:\n---\n${prefixText}\n---\n\nเหตุการณ์ถัดไปน่าจะเป็นอะไร`,
    };
}

/** ตัดสินว่า guesses ใดตรงกับเหตุการณ์จริง — คืน JSON { matched: { index, reason }[] } (บังคับด้วย ECHO_JUDGE_SCHEMA) */
export function buildJudgePrompt(
    prefixText: string,
    cardText: string,
    guesses: string[],
): EchoPrompt {
    const guessLines = guesses.map((g, i) => `${i}: "${g}"`).join("\n");

    return {
        system: `คุณเป็นกรรมการตัดสินว่าคำเดาข้อใด "ตรง" กับเหตุการณ์จริงที่เกิดขึ้นในนิยาย

เกณฑ์ตัดสิน (เข้มงวด — ต้องตรงทั้งการกระทำหลักและผลลัพธ์ ไม่ใช่แค่หัวข้อ/บรรยากาศคล้ายกัน):
- ถ้อยคำต่างกันได้ แต่ "ใครทำอะไร" และ "ผลที่ตามมา" ต้องเป็นเรื่องเดียวกันจริง ไม่ใช่แค่แนวคิด/หัวข้อคล้ายกัน
- ตัวอย่างที่ไม่ตรง (ห้ามนับ): เหตุการณ์จริง "พระเอกเผชิญหน้าตัวร้ายแล้วแพ้" vs คำเดา "พระเอกเผชิญหน้าตัวร้ายแล้วชนะ" — ผลลัพธ์ตรงข้ามกัน ไม่ตรง
- ตัวอย่างที่ไม่ตรง (ห้ามนับ): เหตุการณ์จริง "นางเอกหนีออกจากบ้าน" vs คำเดา "นางเอกทะเลาะกับพ่อ" — แค่หัวข้อความขัดแย้งในครอบครัวคล้ายกัน แต่คนละเหตุการณ์ คนละการกระทำ
- คำเดาที่พูดถึงคนละเหตุการณ์ คนละสาเหตุ คนละผลลัพธ์ ถือว่าไม่ตรง แม้จะมีคำซ้ำกันบางคำหรือแนวโน้มใกล้เคียงกัน
- อย่าให้ประโยชน์แห่งความสงสัยกับคำเดาที่คลุมเครือ — ถ้าไม่มั่นใจว่าตรงจริง ให้ตัดสินว่าไม่ตรง

ตอบเป็น JSON ตาม schema ที่กำหนดเท่านั้น — ใส่เฉพาะข้อที่ "ตรง" ลงใน "matched" แต่ละรายการมี index (0-based)
และ reason (เหตุผลสั้นๆ 1 ประโยคว่าทำไมตรง) ข้อที่ไม่ตรงไม่ต้องใส่ ไม่ต้องนับจำนวนเอง ระบบจะนับจากความยาวของ matched`,
        user: `บริบทก่อนหน้า:\n---\n${prefixText}\n---\n\nเหตุการณ์จริงที่เกิดขึ้น:\n"${cardText}"\n\nคำเดาทั้งหมด:\n${guessLines}`,
    };
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

/**
 * แปลง LLM output เป็น { hits, matched } — hits คำนวณจาก matched.length เสมอ
 * (v1 เคยขอ hits จากโมเดลแยกต่างหาก แต่สองค่านี้ไม่การันตีว่าตรงกัน — ตัดออก ให้มีแหล่งความจริงเดียว)
 */
export function parseJudgeResponse(raw: string): { hits: number; matched: { index: number; reason: string }[] } | null {
    try {
        const trimmed = raw.trim();
        const match = trimmed.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (!Array.isArray(parsed.matched)) return null;
        const matched = parsed.matched.filter(
            (m: unknown): m is { index: number; reason: string } =>
                !!m && typeof m === "object" && typeof (m as any).index === "number" && typeof (m as any).reason === "string",
        );
        return { hits: matched.length, matched };
    } catch {
        return null;
    }
}

// ─── Turning points ─────────────────────────────────────────────────────

/**
 * จุดพลิกผัน — การ์ดที่ hitCount ต่ำผิดปกติเทียบกับค่าเฉลี่ยของฉากเดียวกัน
 *
 * ไม่ใช่ AI ตัวใหม่ ไม่ยิงคอลเพิ่มแม้แต่ครั้งเดียว — แค่ตีความ hitCount ที่ Echo Score
 * เก็บไว้ใน plot_findings อยู่แล้ว (ข้อมูลจ่ายเงินไปแล้ว) มองเป็น predictability curve
 * ของทั้งฉาก แล้วชี้จุดที่ต่ำกว่าเพื่อนบ้านผิดปกติ (>= 1 stddev ใต้ค่าเฉลี่ย)
 *
 * "ต่ำ" ไม่ได้แปลว่า "ดี" หรือ "แย่" ในตัวมันเอง — แค่แปลว่าเดาได้ยากกว่าจังหวะอื่นในฉากนี้
 * อาจเป็นจุดหักมุมตั้งใจ หรือเขียนกำกวมโดยไม่ตั้งใจก็ได้ ต้องดูเนื้อฉากประกอบ
 *
 * ต้องมีอย่างน้อย 3 การ์ดถึงจะคำนวณ stddev ได้อย่างมีความหมาย — ฉากสั้นกว่านั้นคืน set ว่าง
 */
export function flagTurningPoints(findings: EchoFinding[]): Set<string> {
    const flagged = new Set<string>();
    if (findings.length < 3) return flagged;

    const hits = findings.map(f => f.evidence.hitCount);
    const mean = hits.reduce((a, b) => a + b, 0) / hits.length;
    const variance = hits.reduce((a, b) => a + (b - mean) ** 2, 0) / hits.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) return flagged; // ทุกการ์ด hitCount เท่ากันหมด — ไม่มีอะไรผิดปกติ

    findings.forEach(f => {
        if (f.evidence.hitCount <= mean - stddev) flagged.add(f.cardCode);
    });
    return flagged;
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

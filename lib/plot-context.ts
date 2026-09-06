/**
 * Plot Context Registry — ประกาศว่าฟีเจอร์ AI ตัวไหนกิน "บริบทกระดานพล็อต" ระดับไหน
 * ------------------------------------------------------------------------------
 * คู่ขนานกับ lib/ai-features.ts (registry ของ AI) — ที่นั่นคุมว่ายิงโมเดลไหน/quota เท่าไหร่
 * ที่นี่คุมว่า "ป้อนเนื้ออะไรเข้าไป" ประตูจริงอยู่ที่ server/plot-context.ts (getPlotContext)
 *
 * pure module — ไม่แตะ DB ไม่เรียก LLM (renderer ข้างล่างเป็นฟังก์ชันบริสุทธิ์ล้วน)
 *
 * เหตุผลที่ต้องมี: ก่อนหน้านี้ทุกฟีเจอร์ที่อยากอ่านการ์ดไอเดียต้องไปประกอบ query เอง
 * พอมีฟีเจอร์ที่ 3-4 เข้ามาก็เขียน reader ใหม่ซ้ำอีก (pacing-ai-suggest เคยเป็นแบบนั้น)
 * ประตูเดียวทำให้เพิ่มฟีเจอร์ใหม่ = เพิ่มหนึ่งแถวในตารางข้างล่าง ไม่ใช่เขียน reader ใหม่
 */

import type { SceneFormat } from "./story-format";

/** ระดับบริบท — recap ⊃ digest (recap คือ digest + ย่อหน้าสรุปที่ AI เคยเขียนไว้) */
export type ContextLevel = "full" | "digest" | "recap";
export type ContextScope = "scene" | "chapter";

export interface PlotContextConsumer {
    scope: ContextScope;
    level: ContextLevel;
    /** เหตุผลที่เลือกระดับนี้ — บังคับเขียน กันคนเลือก full มั่วเพราะขี้เกียจคิด */
    why: string;
    /**
     * ตัดค่า pacing ที่นักเขียนตั้งเองออกจากบริบท
     * ใช้กับฟีเจอร์ที่ให้ AI ตัดสินค่าเดียวกันนี้ใหม่ — ถ้าเห็นคำตอบเดิมมันจะ anchor ตอบใกล้ ๆ เดิม
     * แล้วเส้นเทียบก็แนบกันจนไม่เห็นความต่าง ซึ่งเป็นจุดประสงค์ทั้งหมดของฟีเจอร์
     */
    hideUserPacing?: boolean;
}

/**
 * key ตรงกับ key ใน AI_FEATURES (lib/ai-features.ts) แบบ 1:1
 *
 * กติกาสำคัญ: ฟีเจอร์ที่ต้อง "เดา/วิเคราะห์เนื้อเรื่องเอง" ห้ามกิน recap
 * เพราะ recap คือข้อความที่ AI ตีความมาแล้ว — อ่านแล้วเท่ากับเดาจากคำตอบ ผลเพี้ยน
 */
export const PLOT_CONTEXT_CONSUMERS: Record<string, PlotContextConsumer> = {
    "echo-score": {
        scope: "scene", level: "full",
        why: "ต้องเดาทิศเรื่องจากของดิบ ห้ามเห็นสรุปที่ตีความแล้ว",
    },
    "plot-scene-recap": {
        scope: "scene", level: "full",
        why: "เป็นคนผลิต recap เอง ต้องอ่านของดิบทั้งฉาก",
    },
    "scene-type-suggest": {
        scope: "scene", level: "full",
        why: "ฉากเดียว ไม่แพง และต้องเห็นรายละเอียดการ์ดเพื่อจัดประเภท",
    },
    "beat-coach": {
        scope: "scene", level: "digest",
        why: "ดูจังหวะภายในฉากเดียว ต้องเห็นค่าที่ผู้ใช้ตั้งไว้ด้วยเพื่อไม่เดาทับของเดิม",
        // ไม่ตั้ง hideUserPacing — ต่างจาก pacing-ai-suggest ตรงที่ตัวนี้ "เติมช่องว่าง" ไม่ใช่ "ให้ความเห็นที่สอง"
    },
    "pacing-ai-suggest": {
        scope: "scene", level: "recap",
        why: "ให้คะแนนทีละฉากตามที่ผู้ใช้กดดูอยู่ — digest สั้น + recap เสริมความหมายฟรี",
        hideUserPacing: true, // ฟีเจอร์นี้ให้ AI ตัดสิน pacing ใหม่ ห้ามเห็นคำตอบของนักเขียนก่อน
    },
};

/** ผลจากประตู getPlotContext (server/plot-context.ts) — text พร้อมส่ง LLM ตรง ๆ */
export interface PlotContextResult {
    /** เนื้อบริบทพร้อมป้อน LLM — ว่าง = ไม่พบ subject */
    text: string;
    level: ContextLevel;
    scope: ContextScope;
    /** โครงสร้างดิบ มีเฉพาะ scope "scene" (ฟีเจอร์ที่ต้องอ่าน field เองเช่นชื่อฉาก) */
    format: SceneFormat | null;
    /** จำนวนฉากที่รวมอยู่ — 0 = ไม่พบ/บทว่าง */
    sceneCount: number;
}

// ─── Digest renderer ───────────────────────────────────────────────────
// ฉบับย่อของ renderSceneMarkdown (lib/story-format.ts) — ตัดเนื้อการ์ด/cast/ปม/เส้นเชื่อมออก
// เหลือแค่โครงกับตัวเลข สำหรับฟีเจอร์ที่กินหลายฉากพร้อมกันแล้วเน้นเทียบภาพรวม ไม่ได้เจาะเนื้อ

/** ตัดเนื้อการ์ดให้สั้น — digest มีไว้ให้เห็นโครง ไม่ใช่ให้อ่านเรื่อง */
const BEAT_CONTENT_CHARS = 200;

export interface DigestBeat {
    id: string;
    title: string;
    sceneType?: string | null;
    pacing?: number | null;
    content?: string | null;
}

export interface DigestScene {
    id: string;
    title: string;
    sceneType?: string | null;
    sceneTone?: string | null;
    pacing?: number | null;
    goal?: string | null;
    conflict?: string | null;
    outcome?: string | null;
    /** ย่อหน้าสรุปจาก plot_recaps — มีเฉพาะ level "recap" และเฉพาะฉากที่เคยกดสรุปไว้ */
    recap?: string | null;
    beats: DigestBeat[];
}

function line(indent: string, label: string, value: unknown): string | null {
    if (value === null || value === undefined || value === "") return null;
    return `${indent}${label}: ${value}`;
}

export interface DigestOptions {
    indent?: string;
    /** ดู PlotContextConsumer.hideUserPacing */
    hideUserPacing?: boolean;
}

function renderDigestBeat(b: DigestBeat, indent: string, opts: DigestOptions): string {
    return [
        `${indent}- id: ${b.id}`,
        line(indent + "  ", "ชื่อ", b.title || "(ไม่มีชื่อ)"),
        line(indent + "  ", "ประเภท", b.sceneType),
        opts.hideUserPacing ? null : line(indent + "  ", "จังหวะที่ตั้งไว้", b.pacing),
        line(indent + "  ", "เนื้อ", b.content?.slice(0, BEAT_CONTENT_CHARS)),
    ].filter(Boolean).join("\n");
}

export function renderSceneDigest(s: DigestScene, opts: DigestOptions = {}): string {
    const indent = opts.indent ?? "";
    const head = [
        `${indent}- id: ${s.id}`,
        line(indent + "  ", "ชื่อฉาก", s.title || "(ไม่มีชื่อ)"),
        line(indent + "  ", "ประเภท", s.sceneType),
        line(indent + "  ", "โทน", s.sceneTone),
        opts.hideUserPacing ? null : line(indent + "  ", "จังหวะที่ตั้งไว้", s.pacing),
        line(indent + "  ", "เป้าหมาย", s.goal),
        line(indent + "  ", "อุปสรรค", s.conflict),
        line(indent + "  ", "ผล", s.outcome),
        line(indent + "  ", "สรุปฉาก", s.recap),
    ].filter(Boolean).join("\n");

    if (!s.beats.length) return head;
    const beats = s.beats.map(b => renderDigestBeat(b, indent + "  ", opts)).join("\n");
    return `${head}\n${indent}  การ์ดย่อยในฉาก:\n${beats}`;
}

/**
 * digest ฉากเดียว แต่บอกตำแหน่งในบทให้ด้วย — ราคาไม่กี่โทเคน แต่ทำให้ AI ตัดสินจังหวะได้ถูกขึ้น
 * (ฉากท้ายบทกับฉากเปิดบทควรได้จังหวะคนละแบบ ถ้าไม่บอกตำแหน่งมันเดาไม่ได้เลย)
 */
export function renderSceneDigestDoc(
    chapterTitle: string,
    scene: DigestScene,
    position: { index: number; total: number },
    opts: DigestOptions = {},
): string {
    const head = [
        "เอกสาร: โครงจังหวะรายฉาก (ฉบับย่อ — ไม่ใช่เนื้อเต็มของกระดาน)",
        `บท: ${chapterTitle || "(ไม่มีชื่อ)"}`,
        `ฉากนี้คือฉากที่ ${position.index} จาก ${position.total} ฉากในบท`,
        "การ์ดย่อยในฉากเรียงตามลำดับการเล่า",
        "---",
    ].join("\n");
    return `${head}\n\n${renderSceneDigest(scene, opts)}`;
}

export function renderChapterDigest(chapterTitle: string, scenes: DigestScene[], opts: DigestOptions = {}): string {
    const head = [
        "เอกสาร: โครงจังหวะรายบท (ฉบับย่อ — ไม่ใช่เนื้อเต็มของกระดาน)",
        `บท: ${chapterTitle || "(ไม่มีชื่อ)"}`,
        `จำนวนฉาก: ${scenes.length}`,
        "ฉากเรียงตามลำดับการเล่า การ์ดย่อยในฉากก็เรียงตามลำดับเช่นกัน",
        "---",
    ].join("\n");
    return `${head}\n\n${scenes.map(s => renderSceneDigest(s, opts)).join("\n\n")}`;
}

/**
 * ตรวจการเฉลยปม (E2) — ส่วนที่ไม่แตะ DB/AI
 *
 * สองการวัดที่ใช้คู่กัน (ตัวเดียวแยก "หักมุม" ออกจาก "ไม่มีที่มา" ไม่ได้):
 *   1. Echo ของการ์ดเฉลย — ตัดเส้นทางของปมก่อนเฉลย ให้ทายต่อ K ข้อ นับว่ากี่ข้อถึงเฉลย
 *      (prompt ทาย/ตัดสิน ยืมจาก lib/echo-score.ts — server เป็นคนประกอบ)
 *   2. เช็คลิสต์ความต่อเนื่อง — yes/no 3 ข้อที่ตอบได้จากการ์ด (เกือบเป็นข้อเท็จจริง ตัวตัดสินแม่นกว่าถามความรู้สึก)
 *
 * ผลเป็น "สัญญาณให้ผู้เขียนดู" ไม่ใช่คำตัดสิน — "เดาได้ไหม" เป็นเรื่องที่ผู้อ่านเห็นต่างกันได้
 * K=3 ได้แค่ 4 ระดับ ระดับติดกัน (1/3 กับ 2/3) ไม่ต่างกันอย่างมีนัย
 * ตัวเลขเทียบได้เฉพาะในนิยายเดียวกัน โมเดล+K+เวอร์ชัน prompt เดียวกัน — เก็บทั้งหมดไว้กับผล
 *
 * ไม่มี import ตอน runtime (มีแต่ type) — check รันด้วย node --experimental-strip-types ได้
 */
import type { ThreadJourney, JourneyStop } from "./thread-journey";

export const FAIRNESS_K = 3;
export const FAIRNESS_PROMPT_VERSION = "1";
/** ส่งจุดก่อนเฉลยสูงสุดกี่จุด (เลือกที่ใกล้เฉลยที่สุด) */
export const FAIRNESS_MAX_STOPS = 12;
export const FAIRNESS_CARD_CHARS = 400;

const ROLE_TH: Record<string, string> = { seed: "หว่าน", reinforce: "ย้ำ", payoff: "เฉลย" };

export interface DossierCard {
    title: string;
    content?: string | null;
}

export interface FairnessDossier {
    /** ข้อความก่อนเฉลย — ส่งเป็น prefix ให้ prompt ทาย/ตัดสินของ Echo */
    prefixText: string;
    /** การ์ดเฉลย */
    payoffText: string;
    /** ข้อความสำหรับเช็คลิสต์ (มีคำตอบจริง + ประเด็น) */
    checklistText: string;
    usedStops: number;
    droppedStops: number;
    payoffIsThin: boolean;
}

const ref = (s: JourneyStop) =>
    `[${s.chapterTitle ? `${s.chapterTitle} · ` : ""}${s.sceneTitle}${s.code && !s.sceneLevel ? ` · ${s.code}` : ""}]`;

function cardBody(s: JourneyStop, cardOf: (s: JourneyStop) => DossierCard | null): string {
    const c = cardOf(s);
    if (!c) return s.sceneLevel ? "(ผูกทั้งฉาก ไม่มีการ์ดเฉพาะ)" : "(ไม่พบการ์ด)";
    const body = (c.content ?? "").replace(/\s+/g, " ").trim();
    const cut = body.length > FAIRNESS_CARD_CHARS ? body.slice(0, FAIRNESS_CARD_CHARS) + "…" : body;
    return cut ? `${c.title} — ${cut}` : c.title;
}

/**
 * ประกอบแฟ้มปม — คืน null ถ้ายังไม่มีจุดเฉลย (ตรวจไม่ได้)
 * prefix ไม่มีคำตอบจริง (ผู้ทายต้องไม่รู้) · checklist มี (ผู้ตรวจต้องรู้ถึงจะบอกได้ว่าเบาะแสชี้ถูกทาง)
 */
export function buildFairnessDossier(
    thread: { title: string; summary?: string | null; points?: Array<{ id: string; text: string; status: string }> },
    journey: ThreadJourney,
    cardOf: (s: JourneyStop) => DossierCard | null,
): FairnessDossier | null {
    const payoff = journey.payoff;
    if (!payoff) return null;
    const pointText = (id?: string | null) => thread.points?.find(p => p.id === id)?.text;

    const payoffPos = payoff.pos ?? Infinity;
    const before = journey.stops.filter(s => s !== payoff && s.beat.role !== "payoff" && s.pos != null && s.pos < payoffPos);
    const used = before.slice(-FAIRNESS_MAX_STOPS);

    const lines: string[] = [];
    used.forEach((s, i) => {
        const pt = pointText(s.beat.pointId);
        lines.push(`${ref(s)} ${ROLE_TH[s.beat.role] ?? s.beat.role}${pt ? ` · ประเด็น: ${pt}` : ""}`);
        lines.push(`  ${cardBody(s, cardOf)}`);
        const next = used[i + 1];
        if (next?.gapFromPrev != null) lines.push(`  (ผ่านไป ${next.gapFromPrev} การ์ด)`);
    });
    if (before.length > used.length) lines.unshift(`(ตัดจุดที่ไกลจากเฉลยออก ${before.length - used.length} จุด)`);

    const head = `ปม: ${thread.title}`;
    const prefixText = [head, "", "สิ่งที่ผู้อ่านเห็นมาตามลำดับ:", ...(lines.length ? lines : ["(ยังไม่มีเบาะแสก่อนเฉลย)"])].join("\n");
    const payoffBody = cardBody(payoff, cardOf);
    const payoffText = `${ref(payoff)} ${payoffBody}`;

    const pts = (thread.points ?? []).map(p => `- ${p.text}${p.status === "resolved" ? " (คลี่แล้ว)" : ""}`);
    const checklistText = [
        head,
        `คำตอบจริงของปม: ${thread.summary?.trim() || "(ผู้เขียนไม่ได้ระบุ — ตัดสินจากการ์ดเฉลยอย่างเดียว)"}`,
        ...(pts.length ? ["ประเด็น:", ...pts] : []),
        "",
        "การ์ดก่อนเฉลย:",
        ...(lines.length ? lines : ["(ไม่มี)"]),
        "",
        `การ์ดเฉลย: ${payoffText}`,
    ].join("\n");

    const c = cardOf(payoff);
    return {
        prefixText, payoffText, checklistText,
        usedStops: used.length,
        droppedStops: before.length - used.length,
        payoffIsThin: !c || (c.content ?? "").trim().length < 20,
    };
}

// ─── เช็คลิสต์ความต่อเนื่อง ─────────────────────────────────────────────

export interface FairnessChecklist {
    /** เฉลยขัดกับการ์ดก่อนหน้า */
    contradicts: boolean;
    /** เฉลยพึ่งข้อมูล/ตัวละครที่ไม่เคยโผล่ก่อนหน้า */
    newInfo: boolean;
    /** ประเด็นที่คลี่แล้วมีการ์ดชี้ทางมาก่อน */
    pointsSignposted: boolean;
    /** คำทายแต่ละข้อเป็นคนละเหตุการณ์จริงไหม — false = ตัวอย่างไม่หลากหลาย ผล Echo เชื่อได้น้อย */
    guessesDistinct: boolean;
    note: string;
}

export const FAIRNESS_CHECKLIST_SCHEMA = {
    type: "object",
    properties: {
        contradicts: { type: "boolean" },
        newInfo: { type: "boolean" },
        pointsSignposted: { type: "boolean" },
        guessesDistinct: { type: "boolean" },
        note: { type: "string" },
    },
    required: ["contradicts", "newInfo", "pointsSignposted", "guessesDistinct", "note"],
} as const;

export function buildChecklistPrompt(checklistText: string, guesses: string[]): { system: string; user: string } {
    return {
        system: `คุณตรวจความต่อเนื่องของการเฉลยปมในนิยาย ตอบจากการ์ดที่ให้มาเท่านั้น ห้ามเดาเนื้อเรื่องที่ไม่ได้เขียน

ตอบ 3 ข้อ (true/false):
- contradicts: การ์ดเฉลยขัดกับข้อเท็จจริงในการ์ดก่อนหน้าไหม
- newInfo: การ์ดเฉลยต้องพึ่งตัวละคร สิ่งของ หรือข้อเท็จจริงที่ไม่เคยปรากฏในการ์ดก่อนหน้าเลยไหม (ถ้าแค่ตีความใหม่จากของเดิม = false)
- pointsSignposted: ทุกประเด็นที่ "คลี่แล้ว" มีการ์ดก่อนหน้าอย่างน้อยหนึ่งใบที่มีข้อมูลชี้ไปทางคำตอบจริงไหม (ไม่มีประเด็น = ดูทั้งปม)
- guessesDistinct: "คำทายของผู้อ่าน" แต่ละข้อเป็นคนละเหตุการณ์กันจริงไหม (แค่เปลี่ยนถ้อยคำแต่เรื่องเดียวกัน = false)

note: ภาษาไทย ไม่เกิน 2 ประโยค อ้างรหัสการ์ดในวงเล็บเหลี่ยมตามที่ให้มา
ปมที่ผู้เขียนตั้งใจให้เดายากไม่ถือว่าผิด ตอบตามข้อเท็จจริงในการ์ด
ตอบเป็น JSON ตาม schema เท่านั้น`,
        user: `${checklistText}\n\nคำทายของผู้อ่าน (ไม่ต้องตัดสินว่าถูกไหม ดูแค่ว่าต่างกันไหม):\n${guesses.map((g, i) => `${i + 1}. ${g}`).join("\n") || "(ไม่มี)"}`,
    };
}

export function parseChecklist(raw: string): FairnessChecklist | null {
    try {
        const m = raw.trim().match(/\{[\s\S]*\}/);
        if (!m) return null;
        const p = JSON.parse(m[0]);
        if (typeof p.contradicts !== "boolean" || typeof p.newInfo !== "boolean" || typeof p.pointsSignposted !== "boolean") return null;
        return {
            contradicts: p.contradicts, newInfo: p.newInfo, pointsSignposted: p.pointsSignposted,
            // ไม่ตอบช่องนี้ = ถือว่าหลากหลาย (ไม่ติดป้ายเตือนจากข้อมูลที่ไม่มี)
            guessesDistinct: typeof p.guessesDistinct === "boolean" ? p.guessesDistinct : true,
            note: typeof p.note === "string" ? p.note : "",
        };
    } catch {
        return null;
    }
}

// ─── ป้ายสรุป ──────────────────────────────────────────────────────────

export type PayoffLabel = "obvious" | "balanced" | "twist" | "unfounded";

export const PAYOFF_LABEL_TH: Record<PayoffLabel, { label: string; hint: string }> = {
    obvious: { label: "ชัดเจน คาดเดาได้", hint: "ทายต่อแล้วถึงเฉลยทุกข้อ ผู้อ่านน่าจะเดาออกก่อนถึงจุดเฉลย" },
    balanced: { label: "พอดี", hint: "มีเบาะแสพอให้เดาได้บางทาง แต่ยังไม่ชัดเกิน" },
    twist: { label: "หักมุม มีที่มา", hint: "ทายไม่ถึง แต่ย้อนดูแล้วเฉลยต่อยอดจากของที่วางไว้" },
    unfounded: { label: "เบาะแสไม่พอ", hint: "ทายไม่ถึง และเฉลยไม่ได้ต่อยอดจากการ์ดก่อนหน้า" },
};

/** มีที่มา = ไม่ขัดของเดิม + ไม่พึ่งของใหม่ + ประเด็นมีป้ายบอกทาง */
export function isGrounded(c: FairnessChecklist): boolean {
    return !c.contradicts && !c.newInfo && c.pointsSignposted;
}

/**
 * hits = จำนวนคำทายที่ถึงเฉลย (0..k)
 * ponytail: เกณฑ์แบ่งตายตัวที่ปลายสองข้าง (0 กับ k) เพราะ K=3 หยาบ — ถ้าเพิ่ม K ค่อยเปลี่ยนเป็นเปอร์เซ็นไทล์ในนิยายเดียวกัน
 */
export function classifyPayoff(hits: number, k: number, checklist: FairnessChecklist): PayoffLabel {
    const grounded = isGrounded(checklist);
    if (!grounded && hits < k) return "unfounded";
    if (hits >= k) return "obvious";
    if (hits === 0) return "twist";
    return "balanced";
}

/** hash แบบไม่พึ่ง node:crypto (ใช้ได้ทั้ง client/server) — แค่ตรวจว่า input เปลี่ยนไหม ไม่ใช่ความปลอดภัย */
export function hashFairnessInput(d: Pick<FairnessDossier, "prefixText" | "payoffText" | "checklistText">): string {
    const s = `${FAIRNESS_PROMPT_VERSION}|${FAIRNESS_K}|${d.prefixText}|${d.payoffText}|${d.checklistText}`;
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

/** ผลที่เก็บใน plot_findings.evidence */
export interface FairnessEvidence {
    hits: number;
    k: number;
    guesses: string[];
    matched: Array<{ index: number; reason: string }>;
    checklist: FairnessChecklist;
    label: PayoffLabel;
    /** โมเดลจริงต่อขั้น (หลัง fallback) */
    models: { guess: string; judge: string; checklist: string };
    promptVersion: string;
    inputHash: string;
    usedStops: number;
    droppedStops: number;
    payoffIsThin: boolean;
    noSummary: boolean;
}

export function mixedModels(e: Pick<FairnessEvidence, "models">): boolean {
    return new Set([e.models.guess, e.models.judge, e.models.checklist]).size > 1;
}

"use server";

import {
    CRUD_FORMAT,
    isCrudType,
    type EntityType,
} from "./registry/entity-registry";
import { applyProposal, type Proposal, type ProposalDetail } from "./assistant";

/**
 * Story Bible Import — Phase 1 engine
 * สกัด entity จากเอกสาร markdown → คืน Proposal[] ให้ผู้ใช้ review → applyProposal เขียนจริง
 * หลักการ: สกัดอย่างเดียว ห้ามแต่ง (ตรงกับผู้ช่วยเดิม) — ช่องที่เอกสารไม่ระบุ = เว้นว่าง
 * docs/story-bible-import-plan.md
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

// ชนิดที่สกัดได้ (instance ล้วน) — ตัด note/chapter/timelineEvent/worldSystem (entries jsonb) ออกก่อน
const EXTRACT_TYPES: EntityType[] = [
    "character", "location", "faction", "power", "item", "lore", "entity", "idea", "plotThread",
];

const FIELD_CATALOG = EXTRACT_TYPES.map((t) => {
    const f = CRUD_FORMAT[t]!;
    const cols = Object.entries(f.fields).map(([k, s]) => (s.required ? `${k}*` : k)).join(", ");
    return `- ${t} (${f.noun}): ${cols}`;
}).join("\n");

const EXTRACT_PROMPT = `คุณคือตัวสกัดข้อมูลจากเอกสาร Story Bible ของนิยาย
กติกาเข้ม:
- ดึงเฉพาะ entity ที่ "ปรากฏจริง" ในข้อความเท่านั้น ห้ามแต่งเพิ่ม ห้ามเดา
- field ที่เอกสารไม่ได้ระบุ = เว้นว่าง (อย่าใส่ค่ามั่ว)
- ตัวละคร/ผี/ตระกูล/ของ/พลัง/สถานที่/ปม ที่มีชื่อชัดเจนเท่านั้น อย่าดึงแนวคิดลอยๆ
- คืน JSON object เท่านั้น: {"entities":[{"entityType":"...","fields":{...}}]}
- entityType ต้องเป็นหนึ่งใน: ${EXTRACT_TYPES.join(", ")}
- fields key ตามชนิด (* = จำเป็น ต้องมี):
${FIELD_CATALOG}`;

interface RawEntity {
    entityType: string;
    fields: Record<string, unknown>;
}

/** ประกอบ Proposal (create) จาก raw — reuse CRUD_FORMAT ทำ details/summary */
function toProposal(type: EntityType, fields: Record<string, unknown>): Proposal {
    const format = CRUD_FORMAT[type]!;
    const title = String(fields.name ?? fields.title ?? "(ไม่มีชื่อ)");
    const details: ProposalDetail[] = Object.entries(fields)
        .filter(([k, v]) => format.fields[k] && v != null && String(v).trim() !== "" && k !== "name" && k !== "title")
        .map(([k, v]) => ({ label: format.fields[k].label, value: String(v) }));
    return {
        tool: "create_entity",
        entityType: type,
        fields,
        noun: format.noun,
        title,
        details,
        summary: `สร้าง${format.noun} "${title}"`,
    };
}

/** เรียก LLM สกัด 1 section */
async function extractSection(text: string): Promise<RawEntity[]> {
    const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: EXTRACT_PROMPT },
                { role: "user", content: text },
            ],
            response_format: { type: "json_object" },
            temperature: 0,
            max_tokens: 3000,
        }),
    });
    if (!res.ok) {
        console.error("[bible-import] groq error:", await res.text());
        return [];
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    try {
        const parsed = JSON.parse(content);
        return Array.isArray(parsed.entities) ? parsed.entities : [];
    } catch {
        console.error("[bible-import] JSON parse fail:", content.slice(0, 200));
        return [];
    }
}

/** แบ่งเอกสารตามหัวข้อ `##` (bible จริงยาวเกิน model เดียว) */
function splitSections(markdown: string): string[] {
    const parts = markdown.split(/^##\s+/m).map((s) => s.trim()).filter(Boolean);
    // รวม section สั้นมากเข้ากับตัวถัดไปเพื่อลดจำนวน call (heuristic ง่ายๆ)
    return parts.length ? parts : [markdown];
}

export interface ExtractResult {
    success: boolean;
    proposals?: Proposal[];
    error?: string;
    stats?: { sections: number; raw: number; deduped: number };
}

/** Phase 1: สกัดทั้งเอกสาร → Proposal[] (dedupe ตามชนิด+ชื่อ) */
export async function extractBible(markdown: string): Promise<ExtractResult> {
    if (!GROQ_API_KEY) return { success: false, error: "ยังไม่ได้ตั้งค่า GROQ_API_KEY" };
    if (!markdown.trim()) return { success: false, error: "เอกสารว่างเปล่า" };

    const sections = splitSections(markdown);
    const results = await Promise.all(sections.map((s) => extractSection(s)));
    const raw = results.flat();

    // dedupe ตาม type + ชื่อ (case-insensitive) — เก็บอันแรกที่มี field มากสุด
    const byKey = new Map<string, Proposal>();
    let rawCount = 0;
    for (const e of raw) {
        if (!isCrudType(e.entityType)) continue;
        const type = e.entityType as EntityType;
        if (!EXTRACT_TYPES.includes(type)) continue;
        const fields = (e.fields && typeof e.fields === "object") ? e.fields as Record<string, unknown> : {};
        const nameVal = String(fields.name ?? fields.title ?? "").trim();
        if (!nameVal) continue; // ต้องมีชื่อ
        rawCount++;
        const key = `${type}:${nameVal.toLowerCase()}`;
        const prop = toProposal(type, fields);
        const existing = byKey.get(key);
        if (!existing || prop.details.length > existing.details.length) byKey.set(key, prop);
    }

    const proposals = [...byKey.values()];
    return {
        success: true,
        proposals,
        stats: { sections: sections.length, raw: rawCount, deduped: proposals.length },
    };
}

export interface ImportResult {
    success: boolean;
    created: number;
    failed: number;
    errors: string[];
}

/** Phase 2→เขียนจริง: loop applyProposal เฉพาะที่ผู้ใช้ยืนยัน */
export async function applyBibleProposals(novelId: string, proposals: Proposal[]): Promise<ImportResult> {
    let created = 0, failed = 0;
    const errors: string[] = [];
    for (const p of proposals) {
        const r = await applyProposal(novelId, p);
        if (r.success) created++;
        else { failed++; errors.push(`${p.title}: ${r.error}`); }
    }
    return { success: failed === 0, created, failed, errors };
}

"use server";

import {
    CRUD_FORMAT,
    isCrudType,
    type EntityType,
} from "./registry/entity-registry";
import { applyProposal, type Proposal, type ProposalDetail } from "./assistant";
import { createWorldSystem } from "./world-systems";
import type { WorldSystemEntry } from "@/db/schema";
import { isGuest, GUEST_AI_MESSAGE } from "@/lib/guest";

/**
 * Story Bible Import — Phase 1 engine
 * สกัด entity จากเอกสาร markdown → คืน Proposal[] ให้ผู้ใช้ review → applyProposal เขียนจริง
 * หลักการ: สกัดอย่างเดียว ห้ามแต่ง (ตรงกับผู้ช่วยเดิม) — ช่องที่เอกสารไม่ระบุ = เว้นว่าง
 * docs/story-bible-import-plan.md
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile"; // llama-4-scout ถูกปลดระวาง คืน 404

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
- entityType ต้องเป็นหนึ่งใน: ${EXTRACT_TYPES.join(", ")}, worldSystem
- fields key ตามชนิด (* = จำเป็น ต้องมี):
${FIELD_CATALOG}
- worldSystem (ระบบ/สารบบ เช่น ยศ, ลำดับชั้น, taxonomy, องค์กร, กฎ, กระบวนการ — เนื้อหาที่เป็น "ตาราง/รายการเรียงลำดับ" ไม่ใช่ตัวละคร/ของเดี่ยวๆ):
  รูปแบบ: {"entityType":"worldSystem","fields":{"name*":"ชื่อระบบ","category":"rank|hierarchy|taxonomy|org|ruleset|process","description":"เกริ่นสั้น"},"entries":[{"label":"ชื่อรายการ","attrs":{"คอลัมน์":"ค่า"}}]}
  ตัวอย่าง: ตารางยศ 8 ชั้น → 1 worldSystem category=rank, entries=แต่ละยศ, attrs=คอลัมน์อื่นในตาราง (เช่น EN, Threat Level)`;

interface RawEntity {
    entityType: string;
    fields: Record<string, unknown>;
    entries?: unknown; // worldSystem เท่านั้น
}

const ORDERED_CATEGORIES = new Set(["rank", "hierarchy", "process"]);

/** normalize entries ดิบจาก LLM → WorldSystemEntry[] + รวม attrKeys */
function normalizeEntries(raw: unknown): { entries: WorldSystemEntry[]; attrKeys: string[] } {
    if (!Array.isArray(raw)) return { entries: [], attrKeys: [] };
    const keys: string[] = [];
    const entries: WorldSystemEntry[] = raw.map((e, i) => {
        const label = String((e?.label ?? e?.name ?? "")).trim();
        const attrsRaw = (e?.attrs && typeof e.attrs === "object") ? e.attrs as Record<string, unknown> : {};
        const attrs: Record<string, string> = {};
        for (const [k, v] of Object.entries(attrsRaw)) {
            if (v == null || String(v).trim() === "") continue;
            attrs[k] = String(v);
            if (!keys.includes(k)) keys.push(k);
        }
        return { label, order: i, note: "", attrs };
    }).filter(e => e.label);
    return { entries, attrKeys: keys };
}

/** ประกอบ Proposal (create) จาก raw — reuse CRUD_FORMAT ทำ details/summary */
function toProposal(type: EntityType, fields: Record<string, unknown>, rawEntries?: unknown): Proposal {
    // worldSystem: เก็บ entries/attrKeys ไว้ใน fields สำหรับ apply, details = จำนวนรายการ
    if (type === "worldSystem") {
        const format = CRUD_FORMAT.worldSystem!;
        const title = String(fields.name ?? "(ไม่มีชื่อ)");
        const { entries, attrKeys } = normalizeEntries(rawEntries);
        const category = String(fields.category ?? "taxonomy");
        const details: ProposalDetail[] = [{ label: "รายการ", value: `${entries.length}` }];
        if (attrKeys.length) details.push({ label: "คอลัมน์", value: attrKeys.join(", ") });
        return {
            tool: "create_entity",
            entityType: type,
            fields: { name: title, category, description: fields.description, entries, attrKeys },
            noun: format.noun,
            title,
            details,
            summary: `สร้าง${format.noun} "${title}" (${entries.length} รายการ)`,
        };
    }
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

/** parse เวลาหน่วง (ms) จาก error message ของ Groq: "Please try again in X.Xs" */
function parseRetryAfterMs(msg: string): number {
    const m = msg.match(/try again in ([\d.]+)s/);
    return m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : 5000; // +500ms buffer
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** เรียก LLM สกัด 1 section — retry สูงสุด 3 ครั้งเมื่อ rate limit */
async function extractSection(text: string, attempt = 1): Promise<RawEntity[]> {
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

    if (res.status === 429) {
        const errText = await res.text();
        if (attempt >= 3) {
            console.error("[bible-import] rate limit — หมด retry:", errText.slice(0, 120));
            return [];
        }
        const waitMs = parseRetryAfterMs(errText);
        console.warn(`[bible-import] rate limit — รอ ${waitMs}ms แล้ว retry (attempt ${attempt}/3)`);
        await sleep(waitMs);
        return extractSection(text, attempt + 1);
    }

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
    if (await isGuest()) return { success: false, error: GUEST_AI_MESSAGE };
    if (!GROQ_API_KEY) return { success: false, error: "ยังไม่ได้ตั้งค่า GROQ_API_KEY" };
    if (!markdown.trim()) return { success: false, error: "เอกสารว่างเปล่า" };

    const sections = splitSections(markdown);

    // Sequential — ส่งทีละ section ไม่ parallel เพื่อไม่กิน TPM limit
    const raw: RawEntity[] = [];
    for (let i = 0; i < sections.length; i++) {
        const entities = await extractSection(sections[i]);
        raw.push(...entities);
        // หน่วงเล็กน้อยระหว่าง section (ยกเว้น section สุดท้าย)
        if (i < sections.length - 1) await sleep(1200);
    }

    // dedupe ตาม type + ชื่อ (case-insensitive) — เก็บอันแรกที่มี field มากสุด
    const byKey = new Map<string, Proposal>();
    let rawCount = 0;
    for (const e of raw) {
        if (!isCrudType(e.entityType)) continue;
        const type = e.entityType as EntityType;
        if (type !== "worldSystem" && !EXTRACT_TYPES.includes(type)) continue;
        const fields = (e.fields && typeof e.fields === "object") ? e.fields as Record<string, unknown> : {};
        const nameVal = String(fields.name ?? fields.title ?? "").trim();
        if (!nameVal) continue; // ต้องมีชื่อ
        rawCount++;
        const key = `${type}:${nameVal.toLowerCase()}`;
        const prop = toProposal(type, fields, e.entries);
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
        // worldSystem: เขียนผ่าน createWorldSystem ตรงๆ (entries เป็น jsonb เกิน generic CRUD)
        if (p.entityType === "worldSystem") {
            const category = String(p.fields.category ?? "taxonomy");
            const r = await createWorldSystem({
                novelId,
                name: p.title,
                category,
                description: p.fields.description ? String(p.fields.description) : undefined,
                ordered: ORDERED_CATEGORIES.has(category),
                attrKeys: (p.fields.attrKeys as string[]) ?? [],
                entries: (p.fields.entries as WorldSystemEntry[]) ?? [],
            });
            if (r.success) created++;
            else { failed++; errors.push(`${p.title}: ${r.error}`); }
            continue;
        }
        const r = await applyProposal(novelId, p);
        if (r.success) created++;
        else { failed++; errors.push(`${p.title}: ${r.error}`); }
    }
    return { success: failed === 0, created, failed, errors };
}

"use server";

import {
    CRUD_FORMAT,
    CRUD_TYPES,
    isCrudType,
    createEntityRow,
    updateEntityRow,
    deleteEntityRow,
    search,
    type EntityType,
} from "./registry/entity-registry";

/**
 * ผู้ช่วยจัดการข้อมูล (Command Executor)
 * --------------------------------------
 * vision: ทำตามคำสั่งเท่านั้น — ไม่คิดแทน ไม่เขียนเนื้อหา
 * flow: runAssistant (LLM + tools) → คืน "ร่าง" (proposal) → ผู้ใช้กดยืนยัน → applyProposal เขียนจริง
 * tool ไม่เขียน DB เอง: การเขียนเกิดใน applyProposal หลังคนยืนยันเท่านั้น
 *
 * เพิ่ม entity type ใหม่ = แก้ CRUD_FORMAT ใน entity-registry.ts ที่เดียว (tool/validation/summary ตามไปเอง)
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"; // Groq เท่านั้น (รองรับ function-calling)

// แคตตาล็อกฟิลด์ต่อ type (ฉีดเข้า system prompt ให้ LLM รู้ว่า type ไหนมีฟิลด์อะไร)
const FIELD_CATALOG = CRUD_TYPES.map((t) => {
    const f = CRUD_FORMAT[t]!;
    const cols = Object.entries(f.fields)
        .map(([k, s]) => (s.required ? `${k}*` : k))
        .join(", ");
    return `- ${t} (${f.noun}): ${cols}`;
}).join("\n");

const SYSTEM_PROMPT = `คุณคือผู้ช่วยจัดการข้อมูลนิยาย — ทำตามคำสั่งผู้ใช้เท่านั้น
- ห้ามคิดแทน ห้ามแต่งเนื้อหา ห้ามเติม field ที่ผู้ใช้ไม่ได้บอก
- ถ้าคำสั่งขาดข้อมูลจำเป็น (* = จำเป็น) ให้ถามกลับสั้นๆ ห้ามเดา
- แก้ไข/ลบ ต้องอ้างชื่อรายการที่มีอยู่จริงเสมอ (ใส่ใน name)
- ถ้าผู้ใช้ขอสิ่งที่ไม่มี tool รองรับ (ช่วยคิด/เขียนเนื้อหา/วิเคราะห์) ให้บอกว่าทำได้แค่จัดการข้อมูลตามคำสั่ง
ชนิดข้อมูลและฟิลด์ที่รองรับ (key ใส่ใน fields):
${FIELD_CATALOG}`;

// ฟิลด์ทั้งหมดที่เป็นไปได้ (union) → property ของ object "fields" ในทุก tool
const ALL_FIELDS: Record<string, { type: "string"; description: string }> = {};
for (const t of CRUD_TYPES) {
    for (const [k, s] of Object.entries(CRUD_FORMAT[t]!.fields)) {
        if (!ALL_FIELDS[k]) ALL_FIELDS[k] = { type: "string", description: s.label };
    }
}

const ENTITY_TYPE_PARAM = {
    type: "string",
    enum: CRUD_TYPES as string[],
    description: "ชนิดข้อมูล",
};
const FIELDS_PARAM = {
    type: "object",
    description: "ค่าฟิลด์ (key ตามที่ระบุใน system prompt ของแต่ละชนิด)",
    properties: ALL_FIELDS,
};

const TOOLS = [
    {
        type: "function",
        function: {
            name: "create_entity",
            description: "สร้างข้อมูลใหม่ในนิยาย",
            parameters: {
                type: "object",
                properties: { entity_type: ENTITY_TYPE_PARAM, fields: FIELDS_PARAM },
                required: ["entity_type", "fields"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "update_entity",
            description: "แก้ไขข้อมูลที่มีอยู่ — ระบุ name ของรายการเดิม + fields ที่จะเปลี่ยน",
            parameters: {
                type: "object",
                properties: {
                    entity_type: ENTITY_TYPE_PARAM,
                    name: { type: "string", description: "ชื่อ/หัวข้อเดิมของรายการที่จะแก้" },
                    fields: FIELDS_PARAM,
                },
                required: ["entity_type", "name", "fields"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "delete_entity",
            description: "ลบข้อมูลที่มีอยู่ — ระบุ name ของรายการ",
            parameters: {
                type: "object",
                properties: {
                    entity_type: ENTITY_TYPE_PARAM,
                    name: { type: "string", description: "ชื่อ/หัวข้อของรายการที่จะลบ" },
                },
                required: ["entity_type", "name"],
            },
        },
    },
];

const TOOL_NAMES = ["create_entity", "update_entity", "delete_entity"] as const;
type ToolName = (typeof TOOL_NAMES)[number];

export interface ChatTurn {
    role: "user" | "assistant";
    content: string;
}

export interface ProposalDetail {
    label: string;
    value: string;
}

export interface Proposal {
    tool: ToolName;
    entityType: EntityType;
    id?: string; // update/delete: รายการที่ resolve ได้
    fields: Record<string, unknown>;
    noun: string; // ชื่อชนิดไทย เช่น "ตัวละคร"
    title: string; // ชื่อ/หัวข้อของรายการ
    details: ProposalDetail[]; // ฟิลด์ที่จะเขียน (ไม่รวม name/title) — ให้การ์ดโชว์เป็นรายการ
    summary: string; // ข้อความสั้น (aria-label / toast fallback)
}

export type AssistantResult =
    | ({ kind: "proposal" } & Proposal)
    | { kind: "message"; text: string }
    | { kind: "error"; error: string };

/** หาเรคคอร์ดจากชื่อ — exact ก่อน, ไม่เจอ/กำกวมให้คืนข้อความถามกลับ */
async function resolveByName(
    novelId: string,
    type: EntityType,
    name: string,
): Promise<{ id: string; title: string } | { ask: string }> {
    const q = name.trim();
    const noun = CRUD_FORMAT[type]!.noun;
    if (!q) return { ask: `ระบุชื่อ${noun}ด้วยนะครับ` };
    const hits = await search(novelId, q, { types: [type], limitPerType: 10 });
    if (hits.length === 0) return { ask: `ไม่พบ${noun}ชื่อ "${q}" — ตรวจชื่ออีกครั้งนะครับ` };
    const exact = hits.filter((h) => h.title === q);
    const pick = exact.length === 1 ? exact[0] : hits.length === 1 ? hits[0] : null;
    if (!pick) {
        const names = hits.map((h) => `"${h.title}"`).join(", ");
        return { ask: `มีหลายตัวที่ตรง: ${names} — ระบุชื่อให้ชัดเจนนะครับ` };
    }
    return { id: pick.id, title: pick.title };
}

const VERB: Record<ToolName, string> = {
    create_entity: "สร้าง",
    update_entity: "แก้ไข",
    delete_entity: "ลบ",
};

/** ประกอบข้อมูลให้การ์ดยืนยัน — noun/title/details + summary สั้น */
function buildView(
    tool: ToolName,
    type: EntityType,
    fields: Record<string, unknown>,
    targetTitle?: string,
): Pick<Proposal, "noun" | "title" | "details" | "summary"> {
    const format = CRUD_FORMAT[type]!;
    const title = String(fields.name ?? fields.title ?? targetTitle ?? "(ไม่มีชื่อ)");
    const details =
        tool === "delete_entity"
            ? []
            : Object.entries(fields)
                  .filter(([k, v]) => format.fields[k] && v != null && v !== "" && k !== "name" && k !== "title")
                  .map(([k, v]) => ({ label: format.fields[k].label, value: String(v) }));
    const summaryTail = details.length ? ` · ${details.map((d) => `${d.label}: ${d.value}`).join(" · ")}` : "";
    const summary = `${VERB[tool]}${format.noun} "${title}"${summaryTail}`;
    return { noun: format.noun, title, details, summary };
}

/** แยก fields ออกจาก args (รองรับทั้ง args.fields และฟิลด์ที่ LLM วางไว้ top-level) */
function extractFields(args: Record<string, unknown>): Record<string, unknown> {
    if (args.fields && typeof args.fields === "object") return args.fields as Record<string, unknown>;
    const { entity_type, name, ...rest } = args;
    void entity_type;
    void name;
    return rest;
}

export async function runAssistant(
    novelId: string,
    message: string,
    history: ChatTurn[] = [],
): Promise<AssistantResult> {
    const msg = message.trim();
    if (!msg) return { kind: "error", error: "กรุณาพิมพ์คำสั่ง" };
    if (!GROQ_API_KEY) return { kind: "error", error: "ยังไม่ได้ตั้งค่า GROQ_API_KEY" };

    try {
        const res = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    ...history.map((t) => ({ role: t.role, content: t.content })),
                    { role: "user", content: msg },
                ],
                tools: TOOLS,
                tool_choice: "auto",
                temperature: 0.2,
                max_tokens: 1024,
            }),
        });
        if (!res.ok) {
            console.error("[assistant] groq error:", await res.text());
            return { kind: "error", error: "ผู้ช่วยไม่ว่างชั่วคราว ลองใหม่อีกครั้ง" };
        }
        const data = await res.json();
        const choice = data.choices?.[0]?.message;
        const call = choice?.tool_calls?.[0];
        const name = call?.function?.name;

        if (name && (TOOL_NAMES as readonly string[]).includes(name)) {
            const tool = name as ToolName;
            let args: Record<string, unknown> = {};
            try {
                args = JSON.parse(call.function.arguments || "{}");
            } catch {
                return { kind: "error", error: "อ่านคำสั่งไม่สำเร็จ ลองพิมพ์ใหม่" };
            }
            const entityType = String(args.entity_type ?? "");
            if (!isCrudType(entityType)) {
                return { kind: "message", text: "ยังจัดการชนิดข้อมูลนี้ไม่ได้ครับ" };
            }
            const fields = extractFields(args);

            if (tool === "create_entity") {
                return { kind: "proposal", tool, entityType, fields, ...buildView(tool, entityType, fields) };
            }
            // update/delete → resolve ชื่อ→id ก่อน (กำกวม = ถามกลับ)
            const r = await resolveByName(novelId, entityType, String(args.name ?? ""));
            if ("ask" in r) return { kind: "message", text: r.ask };
            return {
                kind: "proposal",
                tool,
                entityType,
                id: r.id,
                fields,
                ...buildView(tool, entityType, fields, r.title),
            };
        }

        const text = choice?.content?.trim();
        if (text) return { kind: "message", text };
        return { kind: "error", error: "ไม่เข้าใจคำสั่ง ลองพิมพ์ใหม่" };
    } catch (e) {
        console.error("[assistant] fetch error:", e);
        return { kind: "error", error: "เชื่อมต่อผู้ช่วยไม่ได้ ลองใหม่อีกครั้ง" };
    }
}

export type ApplyResult =
    | { success: true; message: string; href: string | null }
    | { success: false; error: string };

/** เขียนจริงหลังผู้ใช้กดยืนยัน */
export async function applyProposal(novelId: string, p: Proposal): Promise<ApplyResult> {
    const noun = CRUD_FORMAT[p.entityType]?.noun ?? "รายการ";

    if (p.tool === "create_entity") {
        const r = await createEntityRow(p.entityType, novelId, p.fields);
        return r.success
            ? { success: true, message: `สร้าง${noun} "${r.title}" แล้ว`, href: r.href }
            : { success: false, error: r.error };
    }
    if (p.tool === "update_entity") {
        if (!p.id) return { success: false, error: "ไม่รู้ว่าจะแก้รายการไหน" };
        const r = await updateEntityRow(p.entityType, p.id, p.fields);
        return r.success
            ? { success: true, message: `แก้${noun} "${r.title}" แล้ว`, href: r.href }
            : { success: false, error: r.error };
    }
    if (!p.id) return { success: false, error: "ไม่รู้ว่าจะลบรายการไหน" };
    const r = await deleteEntityRow(p.entityType, p.id);
    return r.success
        ? { success: true, message: `ลบ${noun} "${r.title}" แล้ว`, href: null }
        : { success: false, error: r.error };
}

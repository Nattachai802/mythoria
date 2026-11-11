// สกัด "นิสัยเด่นเฉพาะตัว" + "นิสัยที่ขัดกันเอง" จากข้อความที่ผู้เขียนเขียนไว้
// AI เสนอ → โค้ดตรวจ quote ว่ามีจริงในข้อความ (ไม่เจอ = ล้าง quote → ป้าย "AI อนุมาน") → ผู้เขียนติ๊กเลือกเอง
// ไฟล์ pure: ไม่ import lib อื่น (check runner ต้องใช้นามสกุล .ts ซึ่ง tsc ไม่รับ)

export interface FacetDraft { name: string; direction: "low" | "high"; strength: number; scene: string; quote: string }
export interface ContraDraft { text: string; quoteA: string; quoteB: string }
export interface FacetExtract { facets: FacetDraft[]; contradictions: ContraDraft[] }

export const FACET_AI_SCHEMA = {
    type: "object",
    properties: {
        facets: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    direction: { type: "string", enum: ["low", "high"] },
                    strength: { type: "integer" },
                    scene: { type: "string" },
                    quote: { type: "string" },
                },
                required: ["name", "direction", "strength", "scene", "quote"],
            },
        },
        contradictions: {
            type: "array",
            items: {
                type: "object",
                properties: { text: { type: "string" }, quoteA: { type: "string" }, quoteB: { type: "string" } },
                required: ["text", "quoteA", "quoteB"],
            },
        },
    },
    required: ["facets", "contradictions"],
};

const norm = (s: string) => s.replace(/[\s"'“”‘’.,!?…\-—]/g, "").toLowerCase();
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * ตรวจผล AI: ตัดข้อที่ไม่มีชื่อ/ซ้ำกับของเดิม · strength ปัดเป็นทวีคูณ 10 ในช่วง 10–100
 * quote ต้องมีจริงในข้อความ ไม่งั้นล้างเป็น "" · จำกัด 5 นิสัย / 2 คู่ขัดกัน
 */
export function verifyFacetExtract(raw: unknown, sourceText: string, existingNames: string[] = []): FacetExtract {
    const src = norm(sourceText);
    const real = (q: string) => (q && norm(q).length >= 4 && src.includes(norm(q)) ? q : "");
    const r = (raw ?? {}) as { facets?: unknown; contradictions?: unknown };
    const seen = new Set(existingNames.map((n) => norm(n)));
    const facets: FacetDraft[] = [];
    for (const f of Array.isArray(r.facets) ? r.facets : []) {
        const o = (f ?? {}) as Record<string, unknown>;
        const name = str(o.name, 200);
        if (!name || seen.has(norm(name))) continue;
        seen.add(norm(name));
        const n = Number(o.strength);
        facets.push({
            name,
            direction: o.direction === "low" ? "low" : "high",
            strength: Number.isFinite(n) ? Math.min(100, Math.max(10, Math.round(n / 10) * 10)) : 60,
            scene: str(o.scene, 300),
            quote: real(str(o.quote, 300)),
        });
        if (facets.length === 5) break;
    }
    const contradictions: ContraDraft[] = [];
    for (const c of Array.isArray(r.contradictions) ? r.contradictions : []) {
        const o = (c ?? {}) as Record<string, unknown>;
        const text = str(o.text, 400);
        if (!text) continue;
        contradictions.push({ text, quoteA: real(str(o.quoteA, 300)), quoteB: real(str(o.quoteB, 300)) });
        if (contradictions.length === 2) break;
    }
    return { facets, contradictions };
}

export function buildFacetPrompt(name: string, sourceText: string, existingNames: string[]) {
    return {
        system: "คุณช่วยนักเขียนสกัดนิสัยของตัวละคร โดยยึดเฉพาะสิ่งที่นักเขียนเขียนไว้ ตอบเป็น JSON ตาม schema เท่านั้น",
        prompt: `ด้านล่างคือสิ่งที่นักเขียนเขียนอธิบายตัวละคร "${name}"

งานที่ 1 — นิสัยเด่นเฉพาะตัว (facets) 3–5 ข้อ:
- นิสัยที่เจาะจง ไม่ใช่คำกว้าง (ไม่เอา "ดี" "เก่ง" "ใจดี") เช่น "ไม่ไว้ใจใคร" "ต้องคุมทุกอย่างเอง" "อายเวลาถูกชม"
- direction: high = มีนิสัยนี้มาก, low = แทบไม่มี (ใช้เมื่อการ "ขาด" สิ่งนี้คือจุดเด่น เช่น "ความกลัว" low = ไม่กลัวอะไร)
- strength: 10–100 ว่าเด่นแค่ไหน
- scene: พฤติกรรมที่ผู้อ่านจะเห็นในฉาก 1 ประโยค เป็นการกระทำที่มองเห็นได้
- quote: วลีจากข้อความที่เป็นหลักฐาน คัดมาตรงตัว ถ้าไม่มีให้ ""
${existingNames.length ? `- ห้ามซ้ำกับที่ผู้เขียนมีแล้ว: ${existingNames.join(", ")}\n` : ""}
งานที่ 2 — นิสัยที่ขัดกันเอง (contradictions) 0–2 คู่:
- ด้านของบุคลิกที่ดูไม่เข้ากันในคนเดียว เช่น "ใจดีกับคนแปลกหน้า แต่ใจร้ายกับคนในบ้าน"
- ต้องเป็นเรื่องนิสัย ไม่ใช่ปัญหาในพล็อตหรือศัตรูภายนอก
- quoteA / quoteB: หลักฐานของแต่ละด้าน ถ้าไม่มีให้ ""
- ถ้าข้อความไม่มีด้านที่ขัดกันจริง ให้ส่ง [] — อย่าแต่งขึ้น

กฎ: ใช้เฉพาะข้อความด้านล่าง ห้ามใช้ความรู้นอก (เช่น ถ้าจำได้ว่าเป็นตัวละครจากเรื่องอะไร) · อย่าใช้วลีเดียวกันเป็นหลักฐานหลายข้อ

ข้อความของนักเขียน:
${sourceText}`,
    };
}

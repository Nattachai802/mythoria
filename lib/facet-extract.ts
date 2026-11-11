// สกัด "นิสัยเด่นเฉพาะตัว" + "นิสัยที่ขัดกันเอง" จากข้อความที่ผู้เขียนเขียนไว้
// AI เสนอ → โค้ดตรวจ quote ว่ามีจริงในข้อความ (ไม่เจอ = ล้าง quote → ป้าย "AI อนุมาน") → ผู้เขียนติ๊กเลือกเอง
// ไฟล์ pure: ไม่ import lib อื่น (check runner ต้องใช้นามสกุล .ts ซึ่ง tsc ไม่รับ)

export interface FacetDraft { key: string; name: string; direction: "low" | "high"; strength: number; scene: string; quote: string }
export interface ContraDraft { text: string; quoteA: string; quoteB: string }
export interface FacetExtract { facets: FacetDraft[]; contradictions: ContraDraft[] }


/** facet 30 ตัวของ Big Five (NEO-PI-R, ด้านละ 6) — ชื่อไทยใช้บนหน้าจอ · desc = ให้ AI รู้ว่าหมายถึงอะไร (ขั้วสูง) */
export const FACETS: { key: string; domain: "N" | "E" | "O" | "A" | "C"; name: string; desc: string }[] = [
    { key: "N1", domain: "N", name: "ขี้กังวล", desc: "คิดวน กลัวเรื่องร้ายจะเกิด ตึงเครียดง่าย" },
    { key: "N2", domain: "N", name: "โกรธง่าย", desc: "หงุดหงิด ฉุนเฉียว ขุ่นเคืองเมื่อถูกขัดใจ" },
    { key: "N3", domain: "N", name: "หม่นหมอง", desc: "เศร้า สิ้นหวัง รู้สึกผิดหรือไร้ค่าง่าย" },
    { key: "N4", domain: "N", name: "อายง่าย", desc: "กลัวถูกมองไม่ดี ประหม่าต่อหน้าคน" },
    { key: "N5", domain: "N", name: "ห้ามใจไม่อยู่", desc: "ทนแรงอยากไม่ได้ ทำตามอารมณ์แล้วเสียใจทีหลัง" },
    { key: "N6", domain: "N", name: "เปราะต่อแรงกดดัน", desc: "รับมือวิกฤตไม่ได้ ตื่นตระหนก พึ่งคนอื่นเมื่อเครียด" },
    { key: "E1", domain: "E", name: "อบอุ่นเข้าหาคน", desc: "เป็นกันเอง แสดงความรักความใส่ใจออกมา" },
    { key: "E2", domain: "E", name: "ชอบอยู่ท่ามกลางผู้คน", desc: "ชอบงานสังสรรค์ ไม่ชอบอยู่คนเดียว" },
    { key: "E3", domain: "E", name: "ชอบนำ", desc: "พูดตรง กล้าแสดงความเห็น ขึ้นมาคุมสถานการณ์" },
    { key: "E4", domain: "E", name: "พลังเหลือ", desc: "ทำตัวยุ่งตลอด เคลื่อนไหวเร็ว ชีวิตจังหวะไว" },
    { key: "E5", domain: "E", name: "ชอบความตื่นเต้น", desc: "แสวงหาความเสี่ยง ความเร้าใจ ทนความจำเจไม่ได้" },
    { key: "E6", domain: "E", name: "ร่าเริง", desc: "หัวเราะง่าย มองโลกสดใส มีความสุขให้เห็น" },
    { key: "O1", domain: "O", name: "ช่างจินตนาการ", desc: "เพ้อฝัน สร้างโลกในหัว" },
    { key: "O2", domain: "O", name: "รักความงาม", desc: "ซาบซึ้งศิลปะ ดนตรี ธรรมชาติ" },
    { key: "O3", domain: "O", name: "รับรู้อารมณ์ตัวเองลึก", desc: "รู้สึกเข้มข้น ใส่ใจความรู้สึกภายใน" },
    { key: "O4", domain: "O", name: "ชอบลองของใหม่", desc: "เปลี่ยนกิจวัตร ลองที่ใหม่ อาหารใหม่" },
    { key: "O5", domain: "O", name: "ใฝ่รู้ทางความคิด", desc: "ชอบถกปรัชญา ไขปริศนา คิดเชิงนามธรรม" },
    { key: "O6", domain: "O", name: "ตั้งคำถามกับกฎเดิม", desc: "ทบทวนค่านิยม ไม่ยึดประเพณีหรืออำนาจ" },
    { key: "A1", domain: "A", name: "ไว้ใจคน", desc: "เชื่อว่าคนอื่นมีเจตนาดี" },
    { key: "A2", domain: "A", name: "ตรงไปตรงมา", desc: "ไม่เล่นเกม ไม่หลอกล่อ พูดตามจริง" },
    { key: "A3", domain: "A", name: "ชอบช่วยเหลือ", desc: "ใส่ใจทุกข์สุขคนอื่น เสียสละให้" },
    { key: "A4", domain: "A", name: "ยอมคน", desc: "เลี่ยงการปะทะ ให้อภัย ไม่ตอบโต้" },
    { key: "A5", domain: "A", name: "ถ่อมตัว", desc: "ไม่โอ้อวด ไม่คิดว่าตัวเองเหนือกว่า" },
    { key: "A6", domain: "A", name: "ใจอ่อน", desc: "สงสารง่าย ตัดสินด้วยความเห็นใจมากกว่าเหตุผล" },
    { key: "C1", domain: "C", name: "มั่นใจในฝีมือ", desc: "รู้สึกว่าตัวเองทำได้ เตรียมพร้อม รับมือได้" },
    { key: "C2", domain: "C", name: "เป็นระเบียบ", desc: "จัดของเป็นที่ ทำตามแผน" },
    { key: "C3", domain: "C", name: "ยึดหน้าที่", desc: "รักษาคำพูด ทำตามหลักการแม้ไม่มีใครดู" },
    { key: "C4", domain: "C", name: "ทะเยอทะยาน", desc: "ตั้งเป้าสูง ทุ่มเทเพื่อความสำเร็จ" },
    { key: "C5", domain: "C", name: "วินัยในตัวเอง", desc: "ลงมือทำจนเสร็จแม้น่าเบื่อ ไม่ผัดวัน" },
    { key: "C6", domain: "C", name: "รอบคอบ", desc: "คิดก่อนทำ ชั่งน้ำหนักผลที่ตามมา" },
];
const FACET_KEYS = FACETS.map((f) => f.key);

export const FACET_AI_SCHEMA = {
    type: "object",
    properties: {
        facets: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    key: { type: "string", enum: FACET_KEYS },
                    direction: { type: "string", enum: ["low", "high"] },
                    strength: { type: "integer" },
                    scene: { type: "string" },
                    quote: { type: "string" },
                },
                required: ["key", "direction", "strength", "scene", "quote"],
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
 * key ต้องอยู่ในรายการ 30 facet (ชื่อไทยมาจากรายการ ไม่ใช่จาก AI) · quote ต้องมีจริงในข้อความ ไม่งั้นล้าง · จำกัด 6 นิสัย / 2 คู่ขัดกัน
 */
export function verifyFacetExtract(raw: unknown, sourceText: string, existing: string[] = []): FacetExtract {
    const src = norm(sourceText);
    const real = (q: string) => (q && norm(q).length >= 4 && src.includes(norm(q)) ? q : "");
    const r = (raw ?? {}) as { facets?: unknown; contradictions?: unknown };
    const seen = new Set(existing.map((n) => norm(n)));
    const facets: FacetDraft[] = [];
    for (const f of Array.isArray(r.facets) ? r.facets : []) {
        const o = (f ?? {}) as Record<string, unknown>;
        const def = FACETS.find((x) => x.key === o.key);
        if (!def || seen.has(norm(def.name)) || seen.has(def.key)) continue;
        seen.add(norm(def.name)); seen.add(def.key);
        const name = def.name;
        const n = Number(o.strength);
        facets.push({
            key: def.key,
            name,
            direction: o.direction === "low" ? "low" : "high",
            strength: Number.isFinite(n) ? Math.min(100, Math.max(10, Math.round(n / 10) * 10)) : 60,
            scene: str(o.scene, 300),
            quote: real(str(o.quote, 300)),
        });
        if (facets.length === 6) break;
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

export function buildFacetPrompt(name: string, sourceText: string, existing: string[]) {
    return {
        system: "คุณช่วยนักเขียนสกัดนิสัยของตัวละคร โดยยึดเฉพาะสิ่งที่นักเขียนเขียนไว้ ตอบเป็น JSON ตาม schema เท่านั้น",
        prompt: `ด้านล่างคือสิ่งที่นักเขียนเขียนอธิบายตัวละคร "${name}"

งานที่ 1 — เลือกนิสัยเด่นเฉพาะตัว 6 ข้อ จากรายการด้านล่างเท่านั้น (ตอบด้วยรหัส key):
${FACETS.map((f) => `${f.key} ${f.name}: ${f.desc}`).join("\n")}
- เลือกข้อที่ข้อความแสดงชัดที่สุด ทั้งที่ "มีมาก" (direction high) และที่ "แทบไม่มี" จนเป็นจุดเด่น (direction low เช่น A1 low = ระแวงทุกคน)
- strength: 10–100 ว่าเด่นแค่ไหน
- scene: พฤติกรรมที่ผู้อ่านจะเห็นในฉาก 1 ประโยค เป็นการกระทำที่มองเห็นได้ เฉพาะตัวละครนี้
- quote: วลีจากข้อความที่เป็นหลักฐาน คัดมาตรงตัว ถ้าไม่มีให้ ""
${existing.length ? `- ห้ามเลือกซ้ำกับที่ผู้เขียนมีแล้ว: ${existing.join(", ")}\n` : ""}
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

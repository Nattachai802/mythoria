// AI แตกข้อความในแท็บภาพรวม (สรุป/รูปลักษณ์/บุคลิกภาพ/ปูมหลัง) ออกมาเติมช่องในแท็บข้อมูลพื้นฐาน
// เติมเฉพาะช่องที่ยังว่าง · ร่องรอยเก็บใน profile._ai = { path: { value, quote } } (jsonb เดิม ไม่แก้ DB)
// pure logic (ไม่มี import ภายใน) — ทดสอบด้วย lib/character-autofill.check.ts

/** path = "<กลุ่ม>.<ช่อง>" ใน characters.profile · สเกล 1–5 กับครอบครัวไม่อยู่ในนี้โดยตั้งใจ */
export const AUTOFILL_FIELDS = {
    "identity.ageAtStart": { label: "อายุตอนเริ่มเรื่อง (ปี)", type: "int" },
    "identity.birthLabel": { label: "วันเกิด", type: "text" },
    "identity.homeland": { label: "บ้านเกิด", type: "text" },
    "identity.nationality": { label: "สัญชาติ", type: "text" },
    "identity.belief": { label: "ศาสนา/ความเชื่อ", type: "text" },
    "body.heightCm": { label: "ส่วนสูง (ซม.)", type: "int" },
    "body.build": { label: "รูปร่าง", type: "text" },
    "body.hair": { label: "ผม", type: "text" },
    "body.eyes": { label: "ตา", type: "text" },
    "body.skin": { label: "ผิว", type: "text" },
    "body.marks": { label: "ตำหนิ/แผลเป็น", type: "text" },
    "body.handedness": { label: "ถนัดมือ", type: "text" },
    "body.health": { label: "สุขภาพ", type: "text" },
    "social.occupation": { label: "อาชีพ", type: "text" },
    "social.formerTitle": { label: "ตำแหน่งเดิม", type: "text" },
    "social.education": { label: "การศึกษา", type: "text" },
    "social.maritalStatus": { label: "สถานะสมรส", type: "text" },
    "social.residence": { label: "ที่อยู่", type: "text" },
    "speech.selfPronoun": { label: "สรรพนามแทนตัว", type: "text" },
    "speech.addressOthers": { label: "เรียกคนอื่นว่า", type: "text" },
    "speech.voice": { label: "น้ำเสียง", type: "text" },
    "speech.catchphrase": { label: "คำติดปาก", type: "text" },
    "speech.languages": { label: "ภาษาที่พูด", type: "text" },
    "speech.habits": { label: "นิสัยเล็กๆ", type: "text" },
    "speech.likes": { label: "ชอบ", type: "text" },
    "speech.dislikes": { label: "ไม่ชอบ", type: "text" },
    "speech.fears": { label: "กลัว", type: "text" },
} as const;

export type AutofillPath = keyof typeof AUTOFILL_FIELDS;
export const AUTOFILL_PATHS = Object.keys(AUTOFILL_FIELDS) as AutofillPath[];

/** ช่องในแท็บภาพรวมที่เป็นต้นทาง — แก้ช่องพวกนี้แล้วค่อยเรียก AI */
export const OVERVIEW_SOURCES = ["description", "appearance", "personality", "backstory"] as const;

/** profile._ai — ค่าที่ AI เติม + ประโยคอ้างอิง · จุดทองแสดงเมื่อค่าปัจจุบันยังเท่ากับ value (ผู้ใช้แก้ = จุดหายเอง) */
export type AiTrace = Record<string, { value: string | number; quote: string }>;

type Obj = Record<string, unknown>;

const get = (profile: Obj | null | undefined, path: string) => {
    const [g, k] = path.split(".");
    return ((profile?.[g] ?? {}) as Obj)[k];
};
const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");

export function emptyPaths(profile: Obj | null | undefined): AutofillPath[] {
    return AUTOFILL_PATHS.filter((p) => isEmpty(get(profile, p)));
}

/** ประโยคอ้างอิงของช่อง ถ้าค่าปัจจุบันยังเป็นค่าที่ AI เติม */
export function aiQuote(profile: Obj | null | undefined, path: string): string | undefined {
    const t = (profile?._ai as AiTrace | undefined)?.[path];
    return t && get(profile, path) === t.value ? t.quote : undefined;
}

export interface AutofillSuggestion { path: string; value: string | number; quote: string }

/**
 * รวมคำแนะนำเข้ากับ profile ปัจจุบัน — คืน patch สำหรับ merge ตื้น (ทุกกลุ่มส่งทั้งก้อน รวม _ai)
 * กฎ: path ต้องอยู่ใน AUTOFILL_FIELDS · ช่องต้องยังว่าง ณ ตอนเขียน · ค่าตรงชนิด · มีประโยคอ้างอิง
 */
export function planAutofill(profile: Obj | null | undefined, suggestions: AutofillSuggestion[]) {
    const patch: Obj = {};
    const trace: AiTrace = { ...((profile?._ai as AiTrace | undefined) ?? {}) };
    let count = 0;
    const done = new Set<string>();

    for (const s of suggestions) {
        const def = AUTOFILL_FIELDS[s.path as AutofillPath];
        if (!def || done.has(s.path) || !s.quote?.trim() || !isEmpty(get(profile, s.path))) continue;
        let value: string | number;
        if (def.type === "int") {
            const n = typeof s.value === "number" ? s.value : Number(String(s.value).replace(/[^\d.]/g, ""));
            if (!Number.isFinite(n) || n <= 0) continue;
            value = Math.round(n);
            if (s.path === "body.heightCm" && (value < 10 || value > 1000)) continue; // ตรง zod ของ profile
            if (value > 100000) continue;
        } else {
            value = String(s.value).trim();
            if (!value || value.length > 2000) continue;
        }
        const [g, k] = s.path.split(".");
        const base = (patch[g] ?? profile?.[g] ?? {}) as Obj;
        patch[g] = { ...base, [k]: value };
        trace[s.path] = { value, quote: s.quote.trim().slice(0, 300) };
        done.add(s.path);
        count++;
    }
    if (count) patch._ai = trace;
    return { patch, count };
}

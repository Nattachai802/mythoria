// โน้ตบนการ์ด (scene_element_details.notes, elementType = idea_note)
// โน้ตใหม่เก็บเป็น Quill Delta JSON ลงคอลัมน์ text เดิม (ไม่ต้องแก้ schema, ไม่มี HTML → ไม่ต้อง sanitize)
// โน้ตเก่าเป็น plain text ล้วน — ยังอ่านได้ต่อ ตรวจด้วย isRichNote
// ทุกที่ที่ไม่ใช่ editor (AI context, export, คัดลอก) ต้องผ่าน noteToPlain

export type DeltaOp = {
    insert: string | { mention?: { id?: string; value?: string; denotationChar?: string } };
    attributes?: { bold?: boolean; italic?: boolean; strike?: boolean; underline?: boolean; list?: "bullet" | "ordered" };
};
export type NoteDelta = { ops: DeltaOp[]; template?: NoteTemplate };

// รูปแบบการแสดงผลของโน้ต — ผู้ใช้เลือกเอง เก็บในตัว Delta JSON (ไม่มี = ทั่วไป)
// เพิ่ม template ใหม่ = เพิ่มหนึ่งแถวตรงนี้ + กรณีใน NoteView (components/plot/playground/rich-note-editor.tsx)
export const NOTE_TEMPLATES = [
    { key: "plain", label: "ทั่วไป" },
    { key: "dialogue", label: "บทสนทนา" },
] as const;
export type NoteTemplate = (typeof NOTE_TEMPLATES)[number]["key"];

export function noteTemplate(raw: string | null | undefined): NoteTemplate {
    const t = parseDelta(raw)?.template;
    return NOTE_TEMPLATES.some((x) => x.key === t) ? (t as NoteTemplate) : "plain";
}

/** ใส่/เอา template ลงโน้ต — โน้ตเก่า (plain) ที่เลือก "ทั่วไป" คงเป็น plain ไว้ ไม่แปลงโดยไม่จำเป็น */
export function withTemplate(raw: string, tpl: NoteTemplate, names: { id: string; name: string }[]): string {
    const delta = parseDelta(raw);
    if (!delta && tpl === "plain") return raw;
    const { template: _drop, ...rest } = delta ?? legacyToDelta(raw, names);
    return JSON.stringify(tpl === "plain" ? rest : { ...rest, template: tpl });
}

export function parseDelta(raw: string | null | undefined): NoteDelta | null {
    if (!raw || raw[0] !== "{") return null;
    try {
        const d = JSON.parse(raw);
        return d && Array.isArray(d.ops) ? (d as NoteDelta) : null;
    } catch {
        return null;
    }
}

export const isRichNote = (raw: string | null | undefined) => parseDelta(raw) !== null;

/** plain text เก่า → Delta (ให้ editor เปิดโน้ตเก่าได้) */
export function plainToDelta(text: string): NoteDelta {
    return { ops: [{ insert: text.endsWith("\n") ? text : text + "\n" }] };
}

/**
 * โน้ตเก่า (plain) → Delta พร้อมแปลง "@ชื่อ" ที่ตรงกับตัวละครให้เป็น mention จริง
 * ไม่งั้นเปิดโน้ตเก่าใน editor แล้ว @ เป็นแค่ตัวอักษร ไม่เป็นชิป
 * เรียงชื่อยาวก่อน กัน "@สมชาย" ไปแมตช์ทับ "@สมชายใหญ่"
 */
export function legacyToDelta(text: string, names: { id: string; name: string }[]): NoteDelta {
    const body = text.endsWith("\n") ? text : text + "\n";
    const byName = new Map(names.filter((n) => n.name).map((n) => [n.name, n.id]));
    if (byName.size === 0) return { ops: [{ insert: body }] };
    const esc = [...byName.keys()].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`@(${esc.join("|")})`, "g");
    const ops: DeltaOp[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) {
        if (m.index > last) ops.push({ insert: body.slice(last, m.index) });
        ops.push({ insert: { mention: { id: byName.get(m[1]), value: m[1], denotationChar: "@" } } });
        last = m.index + m[0].length;
    }
    if (last < body.length) ops.push({ insert: body.slice(last) });
    return { ops };
}

/** ข้อความล้วนสำหรับ AI / export / คัดลอก — mention กลายเป็น "@ชื่อ", bullet เป็น "• " */
export function noteToPlain(raw: string | null | undefined): string {
    const delta = parseDelta(raw);
    if (!delta) return raw ?? "";
    let out = "";
    let line = "";
    for (const op of delta.ops) {
        if (typeof op.insert !== "string") {
            const m = op.insert?.mention;
            if (m?.value) line += `${m.denotationChar ?? "@"}${m.value}`;
            continue;
        }
        const parts = op.insert.split("\n");
        parts.forEach((part, i) => {
            line += part;
            if (i < parts.length - 1) {
                // attributes ของ "\n" คือรูปแบบของบรรทัดที่เพิ่งจบ
                const bullet = op.attributes?.list === "bullet" ? "• " : op.attributes?.list === "ordered" ? "- " : "";
                out += bullet + line + "\n";
                line = "";
            }
        });
    }
    return (out + line).trim();
}

/** ใช้ตรวจว่าโน้ตว่างไหม (Delta ว่างยังมี "\n" หนึ่งตัว) */
export const noteIsEmpty = (raw: string | null | undefined) => noteToPlain(raw).trim() === "";

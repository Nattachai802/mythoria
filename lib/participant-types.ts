/**
 * ชนิดของ "ผู้ร่วมฉาก" บนกระดานพล็อต — ประกาศที่เดียว
 * ------------------------------------------------------
 * เดิมการเพิ่มชนิดใหม่ต้องไล่แก้ ~7 ไฟล์เหมือนกันทุกครั้ง (ตัวละคร → ฝ่าย → พลัง → สิ่งของ)
 * พอถึงชนิดที่ 5-6 (สัตว์/ภูต และระบบโลก) เลยยุบมาไว้ที่นี่ตามที่จดไว้ใน task.md ข้อ 10
 *
 * เพิ่มชนิดใหม่ = เพิ่มหนึ่งแถวข้างล่าง + โหลดข้อมูลที่หน้า plot/[eventId]/page.tsx เท่านั้น
 *
 * pure data — ห้าม import อะไรเข้ามา ไม่งั้น `npm run check` โหลดไม่ได้ (ดู task.md 9e)
 * ชื่อไอคอนเป็น string ให้ฝั่ง UI map เป็น component เอง เพื่อไม่ให้ไฟล์นี้ผูกกับ lucide
 */

export interface ParticipantKind {
    /** ป้ายที่ผู้ใช้เห็น */
    label: string;
    /** ชื่อไอคอนใน lucide — ฝั่ง UI map เป็น component */
    icon: string;
    /** คลาสสีของไอคอน */
    color: string;
    /** ป้ายช่องกรอกว่า "ทำอะไร/ใช้ยังไง" — ต่างกันตามธรรมชาติของชนิด */
    actionLabel: string;
    /** ตัวอย่างในช่องกรอก */
    actionPlaceholder: string;
    /** ป้ายใน dropdown เลือกชนิด */
    selectLabel: string;
    /** placeholder ของ dropdown เลือกตัว */
    pickPlaceholder: string;
    /** หัวข้อแถวชิปกดเร็ว */
    quickPickLabel: string;
    /** ชื่อฟิลด์ที่ใช้เป็นชื่อแสดง — ideas ใช้ title ที่เหลือใช้ name */
    nameField: "name" | "title";
}

/**
 * key = ค่าที่เก็บลง scene_element_details.element_type และ children[].type บน canvasData
 * ห้ามเปลี่ยน key เดิม — ข้อมูลเก่าอ้างค่านี้อยู่
 */
export const PARTICIPANT_KINDS = {
    character: {
        label: "ตัวละคร", icon: "User", color: "text-blue-500",
        actionLabel: "ทำอะไรในซีนนี้", actionPlaceholder: "เช่น ลอบโจมตีเพื่อชิงหลักฐาน แต่ถูกจับได้",
        selectLabel: "ตัวละครจริง", pickPlaceholder: "เลือกตัวละคร...", quickPickLabel: "ตัวละครที่ใช้บ่อย",
        nameField: "name",
    },
    faction: {
        label: "กลุ่มฝ่าย", icon: "Shield", color: "text-emerald-500",
        actionLabel: "ทำอะไรในซีนนี้", actionPlaceholder: "เช่น ส่งกำลังมาปิดล้อมเมือง",
        selectLabel: "กลุ่มฝ่ายจริง", pickPlaceholder: "เลือกกลุ่มฝ่าย...", quickPickLabel: "กลุ่มฝ่ายที่ใช้บ่อย",
        nameField: "name",
    },
    entity: {
        label: "สัตว์/ภูต", icon: "PawPrint", color: "text-orange-500",
        actionLabel: "ทำอะไรในซีนนี้", actionPlaceholder: "เช่น โผล่จากใต้น้ำแล้วลากเรือจม",
        selectLabel: "สัตว์/สัตว์ประหลาด", pickPlaceholder: "เลือกสัตว์/ภูต...", quickPickLabel: "สัตว์/ภูตที่ใช้บ่อย",
        nameField: "name",
    },
    power: {
        label: "พลัง", icon: "Zap", color: "text-purple-500",
        actionLabel: "ใช้ยังไงในซีนนี้", actionPlaceholder: "เช่น ปลดผนึกชั้นสอง แลกกับพลังชีวิต",
        selectLabel: "พลัง", pickPlaceholder: "เลือกพลัง...", quickPickLabel: "พลังที่ใช้บ่อย",
        nameField: "name",
    },
    item: {
        label: "สิ่งของ", icon: "Gem", color: "text-cyan-600",
        actionLabel: "ใช้ยังไงในซีนนี้", actionPlaceholder: "เช่น ถูกขโมยไประหว่างชุลมุน",
        selectLabel: "สิ่งของ", pickPlaceholder: "เลือกสิ่งของ...", quickPickLabel: "สิ่งของที่ใช้บ่อย",
        nameField: "name",
    },
    system: {
        label: "ระบบโลก", icon: "Layers", color: "text-indigo-500",
        actionLabel: "เกี่ยวข้องยังไงในซีนนี้", actionPlaceholder: "เช่น ศัตวรตัวนี้ถูกจัดอยู่ระดับนี้",
        selectLabel: "ระบบโลก (ระดับ/ยศ)", pickPlaceholder: "เลือกระดับในระบบ...", quickPickLabel: "ระดับที่ใช้บ่อย",
        nameField: "name",
    },
} as const satisfies Record<string, ParticipantKind>;

export type ParticipantKindKey = keyof typeof PARTICIPANT_KINDS;

/** ชนิดจริงทั้งหมด (ไม่รวม dummy) — ใช้ทั้งฝั่ง UI และตอนกรองแถวใน DB */
export const PARTICIPANT_KEYS = Object.keys(PARTICIPANT_KINDS) as ParticipantKindKey[];

/** dummy = ชื่อชั่วคราวที่ยังไม่ได้สร้างเป็น entity จริง — มีแค่สองชนิดนี้เท่านั้น */
export const DUMMY_TYPES = ["dummy_character", "dummy_faction"] as const;

/** ทุกค่าที่นับเป็นผู้ร่วมฉากบน canvasData.children */
export const PARTICIPANT_TYPES: string[] = [...PARTICIPANT_KEYS, ...DUMMY_TYPES];

export const isDummyType = (t: string) => (DUMMY_TYPES as readonly string[]).includes(t);

export function kindOf(t: string): ParticipantKind | null {
    return (PARTICIPANT_KINDS as Record<string, ParticipantKind>)[t] ?? null;
}

// ─── ระบบโลก: ผูก "ระดับ" ไม่ใช่ตัวระบบทั้งก้อน ────────────────────────
// ผูกตัวระบบเปล่า ๆ จะได้ผู้ร่วมฉากชื่อ "ระบบยศนักล่า" ลอย ๆ ซึ่งไม่บอกอะไร
// สิ่งที่เกิดในฉากจริงคือ "ศัตรูตัวนี้ระดับ A" — คือ entry ข้างในระบบ
//
// เก็บด้วย elementId = "<systemId>::<label>" เพราะ element_id เป็น text อิสระ
// (ถ้าใช้แค่ systemId สองระดับของระบบเดียวกันในการ์ดใบเดียวจะทับกัน)
// อยากรู้ว่า "ระบบนี้ถูกอ้างที่ฉากไหนบ้าง" = match prefix "<systemId>::"

export const SYSTEM_ENTRY_SEP = "::";

export const systemEntryId = (systemId: string, label: string) => `${systemId}${SYSTEM_ENTRY_SEP}${label}`;

export function parseSystemEntryId(elementId: string): { systemId: string; label: string } | null {
    const at = elementId.indexOf(SYSTEM_ENTRY_SEP);
    if (at < 0) return null;
    return { systemId: elementId.slice(0, at), label: elementId.slice(at + SYSTEM_ENTRY_SEP.length) };
}

/** แปลง worldSystems ให้เป็นรายการเลือกได้ทีละระดับ — ระบบที่ยังไม่มี entry จะไม่โผล่ */
export function flattenSystemEntries(
    systems: { id: string; name: string; entries?: unknown }[],
): { id: string; name: string; systemName: string }[] {
    const out: { id: string; name: string; systemName: string }[] = [];
    for (const s of systems) {
        const entries = Array.isArray(s.entries) ? s.entries : [];
        for (const e of entries) {
            const label = typeof e === "string" ? e : (e as { label?: string })?.label;
            if (!label) continue;
            out.push({ id: systemEntryId(s.id, label), name: `${s.name} › ${label}`, systemName: s.name });
        }
    }
    return out;
}

/**
 * ชื่อไทย + สี ของ entity/relation บนกราฟ — ที่เดียวสำหรับทั้งมุมมองกราฟและมุมมองรายการ
 * (เดิมคัดลอกไว้ทั้ง world-graph.tsx และ story-codex.tsx แก้สีที่เดียวแล้วอีกที่เพี้ยน)
 */

export const TYPE_META: Record<string, { label: string; color: string }> = {
    character: { label: "ตัวละคร", color: "#5b9bd5" },
    location: { label: "สถานที่", color: "#3fa796" },
    lore: { label: "ตำนาน", color: "#9b6dd6" },
    power: { label: "พลัง", color: "#e0a13c" },
    faction: { label: "ก๊ก", color: "#d9534f" },
    item: { label: "ไอเทม", color: "#2e9e9e" },
    era: { label: "ยุค", color: "#7e6bd0" },
    entity: { label: "สิ่งมีชีวิต", color: "#e07b39" },
    note: { label: "บันทึก", color: "#6b7689" },
    chapter: { label: "บท", color: "#4a90c2" },
    timelineEvent: { label: "ฉาก", color: "#d56aa0" },
    idea: { label: "ไอเดีย", color: "#cbb53e" },
    plotThread: { label: "ปม", color: "#56b56b" },
};

export const metaFor = (type: string) => TYPE_META[type] ?? { label: type, color: "#71717a" };

/** ความหมายไทยของ relation ตามทิศ from → to */
export const REL_OUT: Record<string, string> = {
    member_of: "สังกัด", wields: "ครอบครองพลัง", related_to: "สัมพันธ์กับ",
    connects_to: "เชื่อมไป", features: "มีตัวละคร", inhabits: "อาศัยที่",
    linked_to: "เกี่ยวข้องกับ", derived_from: "ต่อยอดจาก", combines_into: "ผสมเป็น",
    mentions: "กล่าวถึง", set_in: "เกิดที่", grouped_in: "อยู่ในกลุ่ม",
    advances: "ขับเคลื่อน", located_in: "อยู่ใน",
};

export const relLabel = (relation: string) => REL_OUT[relation] ?? relation;

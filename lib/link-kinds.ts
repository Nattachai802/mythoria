/**
 * CanvasLink — ชนิดเส้นเชื่อมบนกระดานพล็อต
 *
 * ย้ายออกจาก playground-board.tsx เพื่อให้ lib/story-format.ts
 * (และผู้ใช้อื่นในอนาคต) เรียกใช้ได้โดยไม่ต้อง import จาก component
 */

// เส้นเชื่อมการ์ด = สีอย่างเดียว (ไม่มีชนิด/ข้อความที่ผู้ใช้ต้องตั้ง) · kind/label เดิมยังเก็บอยู่ในข้อมูลของเส้นเก่า ไม่แสดง ไม่ลบ
export type CanvasLink = { targetId: string; kind: string; label?: string | null; color?: string | null }

export const normalizeLink = (l: any): CanvasLink =>
    typeof l === "string" ? { targetId: l, kind: "related", label: null } : { kind: "related", ...l }

// เส้นทุกชนิดใช้ความหนา/ทึบ/ลูกศรแบบเดียวกันหมด ต่างกันแค่สี — เพื่อความสม่ำเสมอ ไม่มี dash แยกต่อชนิดอีกต่อไป
/** สีเริ่มต้นของเส้นใหม่ (เส้นด้ายแดงเดิม) */
export const DEFAULT_LINK_COLOR = "#dc2626"

/** จานสีสำเร็จรูป — ผู้ใช้เลือกสีอื่นเองได้ด้วย color picker */
export const LINK_COLOR_PRESETS = ["#dc2626", "#f97316", "#eab308", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"]

/** สีที่ใช้วาดเส้น: สีที่ผู้ใช้เลือก → สีตามชนิดของเส้นเก่า → สีเริ่มต้น */
export const linkColor = (l: { color?: string | null; kind?: string | null }): string =>
    (l.color && /^#[0-9a-fA-F]{3,8}$/.test(l.color) ? l.color : undefined) ?? (l.kind ? LINK_KINDS[l.kind]?.color : undefined) ?? DEFAULT_LINK_COLOR

/** โหนดใน canvasData ที่ฟีเจอร์เก่า (รอยต่อจังหวะ ถูกถอดแล้ว) เคยเขียนไว้ — ไม่ใช่การ์ด ต้องกรองออกจากรายการการ์ด แต่เก็บไว้ไม่ลบ */
export const LEGACY_HIDDEN_NODE_TYPES = ["beatJoin", "joinLegend"]

export const LINK_KINDS: Record<string, { label: string; color: string; pinFill: string; pinStroke: string }> = {
    related: { label: "เกี่ยวข้อง", color: "#dc2626", pinFill: "#991b1b", pinStroke: "#fca5a5" },          // ด้ายแดงเดิม
    leads_to: { label: "นำไปสู่", color: "#10b981", pinFill: "#047857", pinStroke: "#6ee7b7" },
    conflicts: { label: "ขัดแย้งกับ", color: "#ef4444", pinFill: "#991b1b", pinStroke: "#fca5a5" },
    simultaneous: { label: "เกิดพร้อมกัน", color: "#3b82f6", pinFill: "#1d4ed8", pinStroke: "#93c5fd" },
    ancestor: { label: "ทำไมถึงทำแบบนี้", color: "#3b82f6", pinFill: "#1d4ed8", pinStroke: "#93c5fd" },
}

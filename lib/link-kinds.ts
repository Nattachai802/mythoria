/**
 * CanvasLink — ชนิดเส้นเชื่อมบนกระดานพล็อต
 *
 * ย้ายออกจาก playground-board.tsx เพื่อให้ lib/story-format.ts
 * (และผู้ใช้อื่นในอนาคต) เรียกใช้ได้โดยไม่ต้อง import จาก component
 */

export type CanvasLink = { targetId: string; kind: string; label?: string | null }

export const normalizeLink = (l: any): CanvasLink =>
    typeof l === "string" ? { targetId: l, kind: "related", label: null } : { kind: "related", ...l }

// เส้นทุกชนิดใช้ความหนา/ทึบ/ลูกศรแบบเดียวกันหมด ต่างกันแค่สี — เพื่อความสม่ำเสมอ ไม่มี dash แยกต่อชนิดอีกต่อไป
export const LINK_KINDS: Record<string, { label: string; color: string; pinFill: string; pinStroke: string }> = {
    related: { label: "เกี่ยวข้อง", color: "#dc2626", pinFill: "#991b1b", pinStroke: "#fca5a5" },          // ด้ายแดงเดิม
    leads_to: { label: "นำไปสู่", color: "#10b981", pinFill: "#047857", pinStroke: "#6ee7b7" },
    conflicts: { label: "ขัดแย้งกับ", color: "#ef4444", pinFill: "#991b1b", pinStroke: "#fca5a5" },
    simultaneous: { label: "เกิดพร้อมกัน", color: "#3b82f6", pinFill: "#1d4ed8", pinStroke: "#93c5fd" },
    ancestor: { label: "ทำไมถึงทำแบบนี้", color: "#3b82f6", pinFill: "#1d4ed8", pinStroke: "#93c5fd" },
}

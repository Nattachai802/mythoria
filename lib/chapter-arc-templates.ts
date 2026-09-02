/**
 * รูปแบบจังหวะรายบท (chapter-scale, ไม่ใช่ระดับทั้งเล่ม) — pos 0-100% หมายถึงตำแหน่งในบทเดียว
 * ต่างจาก lib/story-structures.ts (Save the Cat ฯลฯ) ที่ pos หมายถึงตำแหน่งในทั้งเล่ม
 *
 * สำคัญ: นี่ "ไม่ใช่" ทฤษฎีที่มีชื่อ/มีแหล่งอ้างอิงเป็นตำรา — เป็น pattern ที่สังเกตได้ทั่วไปใน
 * เว็บโนเวลรายตอน (Royal Road/Webnovel/นิยายจีนแปล ฯลฯ) สังเคราะห์เอง ไม่ใช่ของ Blake Snyder/
 * Joseph Campbell แบบ STORY_STRUCTURES ห้ามเขียน label ให้ดูเหมือนมีที่มาเป็นตำราจริง
 */

export interface ChapterArcStage {
    name: string
    desc: string
    pos: number // 0-100 = ตำแหน่งในบทนี้ (ไม่ใช่ทั้งเล่ม)
}

export interface ChapterArcTemplate {
    id: string
    label: string
    desc: string
    stages: ChapterArcStage[]
}

export const CHAPTER_ARC_TEMPLATES: ChapterArcTemplate[] = [
    {
        id: "CA-001",
        label: "เปิดแรง–ไต่ระดับ–ค้างจังหวะ",
        desc: "รูปแบบที่พบบ่อยสุดในเว็บโนเวลรายตอน — จบตอนด้วยจังหวะสูงให้คนอ่านอยากอ่านตอนต่อไป",
        stages: [
            { name: "Hook", desc: "เปิดตอนด้วยจุดที่ดึงความสนใจทันที", pos: 0 },
            { name: "Build", desc: "ไต่ระดับความเข้มข้น/ข้อมูลใหม่ทีละนิด", pos: 45 },
            { name: "Cliffhanger", desc: "จบตอนที่จังหวะสูง ค้างคำถาม/สถานการณ์ไว้", pos: 95 },
        ],
    },
    {
        id: "CA-002",
        label: "คลี่คลาย–เปิดปมใหม่",
        desc: "ต้นตอนตอบคำถามจากตอนก่อน ก่อนปิดท้ายด้วยปมใหม่",
        stages: [
            { name: "Answer", desc: "คลี่คลายสิ่งที่ค้างไว้จากตอนที่แล้ว", pos: 15 },
            { name: "Development", desc: "เดินเรื่องต่อตามปกติ", pos: 55 },
            { name: "New Question", desc: "ปิดท้ายด้วยปมใหม่ที่ยังไม่ตอบ", pos: 90 },
        ],
    },
    {
        id: "CA-003",
        label: "ไต่ระดับต่อเนื่อง",
        desc: "ตอนที่ตั้งใจไม่ลงจบ ปล่อยพีคไว้ตอนถัดไป — ระวังถ้าจบตอนแล้วจังหวะยังต่ำอยู่ คนอ่านอาจหลุด",
        stages: [
            { name: "Continue", desc: "สานต่อจากตอนก่อนแบบไม่มีจุดพักใหญ่", pos: 10 },
            { name: "Rising", desc: "เข้มข้นขึ้นเรื่อยๆ", pos: 60 },
            { name: "Hold", desc: "ยังไม่ปล่อยพีค ทิ้งไว้ให้ตอนหน้า", pos: 95 },
        ],
    },
]

import type { Chapter } from "@/db/schema"

/**
 * บทเท่าที่กระดานพล็อตใช้จริง — จัดคอลัมน์, เรียงลำดับ, ทาบโครงเรื่อง
 *
 * ไม่รวม chapters.content ซึ่งเป็นต้นฉบับนิยายทั้งเรื่อง หน้าเพจจึงดึงเฉพาะคอลัมน์เหล่านี้ได้
 * (ดู getNovelForPlot ใน server/novel.ts) แทนที่จะลากเนื้อบทมาทั้งก้อนทุกครั้งที่เปิดกระดาน
 *
 * ถ้าวันหนึ่งมี component ในกระดานต้องใช้ field เพิ่ม ให้เติมที่นี่แล้วเติมใน getNovelForPlot ด้วย
 * compiler จะเตือนเองถ้าลืมข้างใดข้างหนึ่ง
 */
export type ChapterForBoard = Pick<Chapter, "id" | "title" | "orderIndex" | "novelId" | "status">

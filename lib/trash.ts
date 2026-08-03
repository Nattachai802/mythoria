/** ค่าคงที่/ชนิดของถังขยะ — แยกจาก server/trash.ts เพราะไฟล์ "use server" export ได้แค่ async function */
export const TRASH_RETENTION_DAYS = 7;

export type TrashEntry = {
    kind: "novel" | "chapter" | "note";
    id: string;
    title: string;
    novelId: string;
    deletedAt: Date;
    /** เหลืออีกกี่วันก่อนถูกล้างถาวร (ปัดขึ้น) */
    daysLeft: number;
};

/** เหลืออีกกี่วันก่อนถูกล้างถาวร — ปัดขึ้น ไม่ให้ติดลบ */
export function daysLeft(deletedAt: Date, now: number): number {
    const elapsed = now - deletedAt.getTime();
    return Math.max(0, Math.ceil((TRASH_RETENTION_DAYS * 86400_000 - elapsed) / 86400_000));
}

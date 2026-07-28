import { neon } from '@neondatabase/serverless';

/**
 * ฐานข้อมูลกลางที่ Discord bot เขียนไอเดียเข้ามาพัก (คนละตัวกับ db หลักใน db/drizzle.ts)
 *
 * เรียก neon() ตอนใช้จริง ไม่ใช่ตอน import — เดิมเรียกที่ระดับโมดูลแล้วโยน error ทันที
 * ถ้าไม่มี NEON_DATABASE_URL ซึ่งทำให้ `next build` ล้มทั้งก้อนตอนเก็บข้อมูลหน้า
 * (Next import โมดูลเพื่อดู route) — integration เสริมตัวเดียวไม่ควรล้ม build ทั้งโปรเจกต์
 * ตอนนี้ถ้า env หาย จะพังเฉพาะตอนเรียก Discord sync จริง พร้อมบอกสาเหตุตรงๆ
 */
let client: ReturnType<typeof neon> | null = null;

function getClient() {
    if (!client) {
        const url = process.env.NEON_DATABASE_URL;
        if (!url) {
            throw new Error("ไม่ได้ตั้ง NEON_DATABASE_URL — Discord sync ต้องใช้ตัวนี้");
        }
        client = neon(url);
    }
    return client;
}

// ระบุ return type ให้ตรงกับที่ neon() คืนโดยดีฟอลต์ (แถวเป็น object)
// ถ้าปล่อยให้ infer เอง จะได้ union ที่กว้างกว่าเดิมแล้วผู้เรียกอ่าน .length ไม่ได้
export const cloudDb = (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, any>[]> =>
    getClient()(strings, ...values) as Promise<Record<string, any>[]>;

export interface DiscordIdea {
    id: string;
    novel_id: string;
    title: string | null;
    content: string;
    category: string;
    tags: string[];
    discord_user_id: string | null;
    discord_username: string | null;
    discord_channel_id: string | null;
    discord_message_id: string | null;
    is_synced: boolean;
    synced_at: Date | null;
    expires_at: Date;
    created_at: Date;
}

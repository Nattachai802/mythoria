import { config } from "dotenv";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

config({ path: ".env" });

const connectionString = process.env.DB_TARGET === 'local'
    ? process.env.LOCAL_DATABASE_URL
    : (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

/**
 * ผูก type ของ db ไว้กับ schema จริง
 *
 * เดิมประกาศเป็น `let dbInstance;` แล้ว assign จาก globalThis ที่ cast เป็น any
 * TypeScript เลยกลืน db ทั้งตัวเป็น any — ทุก query ในโปรเจกต์จึงไม่มี type ตรวจให้เลย
 * (พิมพ์ชื่อคอลัมน์ผิดก็ไม่ฟ้อง, แก้ schema แล้วโค้ดที่ใช้ก็ไม่รู้)
 */
type DB = NodePgDatabase<typeof schema>;

function createDb(): DB {
    const pool = new Pool({
        connectionString: connectionString!,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });
    return drizzle(pool, { schema });
}

// dev: เก็บไว้บน globalThis กัน hot reload สร้าง pool ใหม่ทุกครั้งจนเชื่อมต่อเต็ม
const globalRef = globalThis as unknown as { db?: DB };

export const db: DB =
    process.env.NODE_ENV === "production"
        ? createDb()
        : (globalRef.db ??= createDb());

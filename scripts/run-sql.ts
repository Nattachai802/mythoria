/**
 * รันไฟล์ .sql กับฐานข้อมูลที่แอปใช้จริง — ใช้ connection string ชุดเดียวกับ drizzle.config.ts
 *
 * มีไว้เพราะ `drizzle-kit push` พ่วงคำสั่ง destructive จาก drift เก่ามาด้วย (เคย
 * เสนอจะ truncate ตาราง invitations) เวลาต้องการแค่ ALTER สองสามบรรทัดจึงยิงตรงแบบนี้ปลอดภัยกว่า
 *
 *   node --experimental-strip-types scripts/run-sql.ts migrations/0015_soft_delete.sql
 */
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { Client } from "pg";

config({ path: ".env" });

const file = process.argv[2];
if (!file) {
    console.error("ใช้: node --experimental-strip-types scripts/run-sql.ts <ไฟล์.sql>");
    process.exit(1);
}

const connectionString = process.env.DB_TARGET === "local"
    ? process.env.LOCAL_DATABASE_URL
    : (process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);

if (!connectionString) {
    console.error("ไม่พบ connection string ใน .env (NEON_DATABASE_URL หรือ DATABASE_URL)");
    process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new Client({ connectionString });

await client.connect();
console.log(`ต่อกับ ${new URL(connectionString).host} แล้ว — กำลังรัน ${file}`);
await client.query(sql);
await client.end();
console.log("เสร็จแล้ว");

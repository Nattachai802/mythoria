-- ถังขยะ: ลบแล้วกู้คืนได้ 7 วัน (null = ปกติ)
-- เขียนมือแทน drizzle-kit generate เพราะ migration folder กับ DB จริง drift กันอยู่
-- (โปรเจกต์นี้ใช้ db:push มาตลอด) — generate จะพ่น diff ของทั้งโปรเจกต์ออกมาแทนที่จะเป็นแค่ 3 คอลัมน์นี้
ALTER TABLE "novels" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;

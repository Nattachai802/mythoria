-- ใครใช้พลังนี้ได้ — ยิงตรงแทน drizzle-kit push (push จะ DROP content_vectors ที่ไม่ได้ประกาศใน schema.ts)
-- default 'unique' ตรงกับพฤติกรรมเดิม: พลังไปถึงตัวละครได้ทางแถว characterPowers เท่านั้น
ALTER TABLE "powers" ADD COLUMN IF NOT EXISTS "access" text DEFAULT 'unique';
ALTER TABLE "powers" ADD COLUMN IF NOT EXISTS "access_note" text;
ALTER TABLE "powers" ADD COLUMN IF NOT EXISTS "baseline" text;

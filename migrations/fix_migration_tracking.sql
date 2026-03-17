-- ============================================================
-- Fix drizzle migration tracking
-- รัน script นี้ใน database ตรงๆ เพื่อ mark migration 0000-0008
-- ว่า applied แล้ว จากนั้น drizzle migrate จะ apply เฉพาะ 0009
-- ============================================================

-- สร้าง tracking table ถ้ายังไม่มี
CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  id SERIAL PRIMARY KEY,
  hash text NOT NULL,
  created_at bigint
);

-- Mark migration 0000-0008 ว่าถูก apply แล้ว (ข้ามไปเพราะ table มีอยู่แล้ว)
INSERT INTO "__drizzle_migrations" (hash, created_at)
VALUES
  ('0000_public_turbo',            1764037622566),
  ('0001_narrow_dexter_bennett',   1765512474583),
  ('0002_cheerful_mantis',         1765553106750),
  ('0003_nervous_quentin_quire',   1765772954168),
  ('0004_conscious_mongoose',      1765775530084),
  ('0005_shiny_mysterio',          1765857462427),
  ('0006_gifted_hedge_knight',     1769003912299),
  ('0007_tidy_invaders',           1769404333544),
  ('0008_bent_prima',              1770103841744)
ON CONFLICT DO NOTHING;

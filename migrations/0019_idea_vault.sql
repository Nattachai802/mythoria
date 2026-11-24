-- คลังโน้ตไอเดีย (Idea Vault) — เพิ่มอย่างเดียว ไม่แตะตารางเดิม
-- ตรงกับ ideaVault / ideaVaultLinks ใน db/schema.ts
-- รัน: npm run db:sql migrations/0019_idea_vault.sql
-- (ใช้แทน db:push ได้ เพราะ push อาจพ่วงคำสั่ง destructive จาก drift เก่า)

-- 1) สำรองตาราง ideas ก่อน (ไม่ลบ ไม่แก้ของเดิม)
CREATE TABLE IF NOT EXISTS ideas_backup_20261124 AS SELECT * FROM ideas;

-- 2) คลังโน้ต
CREATE TABLE IF NOT EXISTS idea_vault (
    id             text PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id       text NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    text           text NOT NULL,
    body           text,
    summary        text,
    summary_source text,
    source         text,
    scopes         jsonb,
    is_detected    boolean NOT NULL DEFAULT false,
    is_archived    boolean NOT NULL DEFAULT false,
    ai_visible     boolean NOT NULL DEFAULT true,
    legacy_idea_id text,
    created_at     timestamp NOT NULL DEFAULT now(),
    updated_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idea_vault_novel_id_idx ON idea_vault (novel_id);
CREATE UNIQUE INDEX IF NOT EXISTS idea_vault_legacy_idx ON idea_vault (legacy_idea_id);

-- 3) ลิงก์โน้ต → ของจริง
CREATE TABLE IF NOT EXISTS idea_vault_links (
    id          text PRIMARY KEY DEFAULT gen_random_uuid(),
    novel_id    text NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    note_id     text NOT NULL REFERENCES idea_vault(id) ON DELETE CASCADE,
    target_type text NOT NULL,
    target_id   text NOT NULL,
    relation    text NOT NULL,
    created_at  timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idea_vault_links_unique ON idea_vault_links (note_id, target_type, target_id, relation);
CREATE INDEX IF NOT EXISTS idea_vault_links_target_idx ON idea_vault_links (target_type, target_id);
CREATE INDEX IF NOT EXISTS idea_vault_links_note_idx ON idea_vault_links (note_id);

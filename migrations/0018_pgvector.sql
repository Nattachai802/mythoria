-- ย้าย vector store: LanceDB (ไฟล์บนดิสก์) → pgvector บน Neon
--
-- เหตุผลอยู่ที่ task.md — สรุป: Python ต้อง stateless ถึงจะ deploy บน Render free ได้
-- และ embedding ควรอยู่ที่เดียวกับเนื้อหาที่มันอธิบาย ไม่ใช่คนละที่ที่ไม่มีอะไรบังคับให้ sync
--
-- 768 = ขนาดของ Gemini text-embedding-004 (ดู pythonservice/embeddings.py)
-- รัน: npm run db:sql migrations/0018_pgvector.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS content_vectors (
    id           text PRIMARY KEY,           -- id ของ entity ต้นทาง (note/character/...)
    novel_id     text NOT NULL,
    content_type text,                       -- character | note | chapter | location
    title        text,
    content      text,
    metadata     text,                       -- JSON string ตามของเดิม
    vector       vector(768),
    updated_at   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_vectors_novel_idx ON content_vectors (novel_id);
CREATE INDEX IF NOT EXISTS content_vectors_novel_type_idx ON content_vectors (novel_id, content_type);

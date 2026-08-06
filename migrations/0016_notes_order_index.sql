-- notes.order_index — ลำดับตอนภายในบท
--
-- เดิมลำดับตอนอนุมานจาก created_at ซึ่งเพี้ยนทันทีที่แทรกตอนย้อนหลังหรือสลับลำดับ
-- คู่กับ chapters.order_index จะได้ "ลำดับการอ่าน" ที่เชื่อถือได้ ซึ่งจำเป็นสำหรับ
-- รายงานรายตอน (baseline ต้องเป็นตอนก่อนหน้าจริง ๆ) และผู้อ่านจำลอง (ห้ามเห็นตอนอนาคต)
--
-- รัน: npm run db:sql migrations/0016_notes_order_index.sql

ALTER TABLE notes ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- backfill ตาม created_at เดิม เพื่อให้ลำดับที่ผู้ใช้เห็นอยู่ไม่เปลี่ยน
-- แยก partition ให้ note ที่ไม่ผูกบท (linked_to_chapter_id IS NULL) ไม่ปนกับของบทอื่น
WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY novel_id, linked_to_chapter_id
               ORDER BY created_at, id
           ) - 1 AS idx
    FROM notes
    WHERE deleted_at IS NULL
)
UPDATE notes
SET order_index = ranked.idx
FROM ranked
WHERE notes.id = ranked.id;

CREATE INDEX IF NOT EXISTS notes_chapter_order_idx
    ON notes (linked_to_chapter_id, order_index);

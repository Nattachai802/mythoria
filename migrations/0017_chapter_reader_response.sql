-- ผู้อ่านจำลองรายตอน — คะแนนแทนร้อยแก้ว
--
-- แทน ai_chapter_reviews (persona 5 ตัว) ตารางเดิมเว้นไว้อีกหนึ่งรอบก่อน drop
-- รัน: npm run db:sql migrations/0017_chapter_reader_response.sql

CREATE TABLE IF NOT EXISTS chapter_reader_response (
    id                 text PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id            text NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
    novel_id           text NOT NULL REFERENCES novels(id) ON DELETE CASCADE,

    suspense           integer NOT NULL,
    suspense_reason    text NOT NULL,
    curiosity          integer NOT NULL,
    curiosity_reason   text NOT NULL,
    surprise           integer NOT NULL,
    surprise_reason    text NOT NULL,

    motivation_clarity text,
    motivation_reason  text,
    causality          text,
    causality_reason   text,
    stakes             text,
    stakes_reason      text,

    raw                jsonb,
    model              text NOT NULL,
    prompt_version     text NOT NULL,
    context_position   integer NOT NULL,
    truncated          boolean NOT NULL DEFAULT false,

    created_at         timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chapter_reader_response_novel_id_idx
    ON chapter_reader_response (novel_id);

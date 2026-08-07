-- กฎของระบบพลัง — ยิงตรงแทน drizzle-kit push เพราะ push ลากคำสั่ง destructive
-- จาก drift เก่ามาด้วย (จะ DROP content_vectors ที่ไม่ได้ประกาศใน db/schema.ts)
CREATE TABLE IF NOT EXISTS "power_rules" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'limit' NOT NULL,
	"severity" text DEFAULT 'hard' NOT NULL,
	"power_ids" jsonb,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
	ALTER TABLE "power_rules" ADD CONSTRAINT "power_rules_novel_id_novels_id_fk"
		FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "power_rules_novel_id_idx" ON "power_rules" USING btree ("novel_id");

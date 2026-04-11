CREATE TABLE "ai_chapter_reviews" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"persona" integer NOT NULL,
	"persona_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_stylometry" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"pacing_and_mood" jsonb,
	"author_narration_style" jsonb,
	"character_dialogue_vibes" jsonb,
	"lexical_richness" jsonb,
	"chapter_anatomy" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_stylometry_chapter_id_unique" UNIQUE("chapter_id")
);
--> statement-breakpoint
CREATE TABLE "note_stylometry" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"pacing_and_mood" jsonb,
	"author_narration_style" jsonb,
	"character_dialogue_vibes" jsonb,
	"lexical_richness" jsonb,
	"chapter_anatomy" jsonb,
	"fingerprint_analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_chapter_reviews" ADD CONSTRAINT "ai_chapter_reviews_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chapter_reviews" ADD CONSTRAINT "ai_chapter_reviews_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_stylometry" ADD CONSTRAINT "chapter_stylometry_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_stylometry" ADD CONSTRAINT "chapter_stylometry_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_stylometry" ADD CONSTRAINT "note_stylometry_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_stylometry" ADD CONSTRAINT "note_stylometry_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;
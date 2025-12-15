CREATE TABLE "chapter_characters" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" text NOT NULL,
	"character_id" text NOT NULL,
	"role" text,
	"frequency" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_factions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faction_id" text NOT NULL,
	"character_id" text NOT NULL,
	"role" text,
	"start_chapter_id" text,
	"end_chapter_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_relationships" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"source_character_id" text NOT NULL,
	"target_character_id" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text,
	"color" text DEFAULT '#64748b',
	"novel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_characters" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"character_id" text NOT NULL,
	"role" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "goals" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "motivation" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "conflict" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "strengths" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "weaknesses" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "related_chapter_id" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "canvas_data" jsonb;--> statement-breakpoint
ALTER TABLE "chapter_characters" ADD CONSTRAINT "chapter_characters_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_characters" ADD CONSTRAINT "chapter_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_factions" ADD CONSTRAINT "character_factions_faction_id_factions_id_fk" FOREIGN KEY ("faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_factions" ADD CONSTRAINT "character_factions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_factions" ADD CONSTRAINT "character_factions_start_chapter_id_chapters_id_fk" FOREIGN KEY ("start_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_factions" ADD CONSTRAINT "character_factions_end_chapter_id_chapters_id_fk" FOREIGN KEY ("end_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_source_character_id_characters_id_fk" FOREIGN KEY ("source_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD CONSTRAINT "character_relationships_target_character_id_characters_id_fk" FOREIGN KEY ("target_character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_characters" ADD CONSTRAINT "note_characters_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_characters" ADD CONSTRAINT "note_characters_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_related_chapter_id_chapters_id_fk" FOREIGN KEY ("related_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
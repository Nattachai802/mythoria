CREATE TABLE "character_powers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" text NOT NULL,
	"power_id" text NOT NULL,
	"current_level" integer DEFAULT 1,
	"acquired_at" text,
	"acquired_method" text,
	"notes" text,
	"start_chapter_id" text,
	"end_chapter_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_states" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"character_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"location_id" text,
	"location_name" text,
	"location_coordinates" text,
	"in_contact_with" jsonb,
	"health" integer,
	"energy" text,
	"status" text,
	"specific_injuries" jsonb,
	"mood" text,
	"mood_intensity" integer,
	"current_objective" text,
	"equipment" jsonb,
	"abilities_used" jsonb,
	"cooldowns" jsonb,
	"relationships_dynamic" jsonb,
	"notes" text,
	"ai_confidence" integer,
	"raw_extraction" jsonb,
	"is_manually_edited" boolean DEFAULT false,
	"extracted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_connections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_idea_id" text NOT NULL,
	"target_idea_id" text NOT NULL,
	"label" text,
	"novel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"summary" text,
	"novel_id" text NOT NULL,
	"canvas_x" integer,
	"canvas_y" integer,
	"color" text DEFAULT '#3b82f6',
	"connected_idea_ids" jsonb,
	"category" text DEFAULT 'general',
	"tags" jsonb,
	"linked_chapter_id" text,
	"linked_character_ids" jsonb,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_combinations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"source_power_ids" jsonb NOT NULL,
	"result_power_id" text NOT NULL,
	"required_levels" jsonb,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_levels" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"power_id" text NOT NULL,
	"level" integer NOT NULL,
	"name" text,
	"description" text,
	"pros" jsonb,
	"cons" jsonb,
	"power_boost" integer,
	"cooldown" integer,
	"mana_cost" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "powers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'special',
	"rarity" text DEFAULT 'common',
	"max_level" integer DEFAULT 10,
	"icon" text,
	"color" text DEFAULT '#3b82f6',
	"novel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_extraction_queue" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "location_connections" ADD COLUMN "travel_time" integer;--> statement-breakpoint
ALTER TABLE "location_connections" ADD COLUMN "travel_time_unit" text DEFAULT 'hours';--> statement-breakpoint
ALTER TABLE "location_connections" ADD COLUMN "travel_method" text DEFAULT 'walk';--> statement-breakpoint
ALTER TABLE "location_connections" ADD COLUMN "travel_notes" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "plot_hole_checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "plot_hole_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "plot_hole_issues" jsonb;--> statement-breakpoint
ALTER TABLE "character_powers" ADD CONSTRAINT "character_powers_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_powers" ADD CONSTRAINT "character_powers_power_id_powers_id_fk" FOREIGN KEY ("power_id") REFERENCES "public"."powers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_powers" ADD CONSTRAINT "character_powers_start_chapter_id_chapters_id_fk" FOREIGN KEY ("start_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_powers" ADD CONSTRAINT "character_powers_end_chapter_id_chapters_id_fk" FOREIGN KEY ("end_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_states" ADD CONSTRAINT "character_states_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_states" ADD CONSTRAINT "character_states_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_states" ADD CONSTRAINT "character_states_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_states" ADD CONSTRAINT "character_states_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_connections" ADD CONSTRAINT "idea_connections_source_idea_id_ideas_id_fk" FOREIGN KEY ("source_idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_connections" ADD CONSTRAINT "idea_connections_target_idea_id_ideas_id_fk" FOREIGN KEY ("target_idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_connections" ADD CONSTRAINT "idea_connections_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_linked_chapter_id_chapters_id_fk" FOREIGN KEY ("linked_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_combinations" ADD CONSTRAINT "power_combinations_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_combinations" ADD CONSTRAINT "power_combinations_result_power_id_powers_id_fk" FOREIGN KEY ("result_power_id") REFERENCES "public"."powers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_levels" ADD CONSTRAINT "power_levels_power_id_powers_id_fk" FOREIGN KEY ("power_id") REFERENCES "public"."powers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "powers" ADD CONSTRAINT "powers_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "state_extraction_queue" ADD CONSTRAINT "state_extraction_queue_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;
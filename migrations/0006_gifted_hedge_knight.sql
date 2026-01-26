CREATE TABLE "eras" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#8b5cf6',
	"icon" text,
	"novel_id" text NOT NULL,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lore_groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#6366f1',
	"icon" text,
	"novel_id" text NOT NULL,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_versions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb NOT NULL,
	"word_count" integer DEFAULT 0,
	"version_number" integer NOT NULL,
	"save_type" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scene_element_details" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scene_id" text NOT NULL,
	"element_type" text NOT NULL,
	"element_id" text NOT NULL,
	"canvas_item_id" text,
	"action" text,
	"how" text,
	"goal" text,
	"outcome" text,
	"notes" text,
	"novel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "highlights" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "atmosphere" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "climate" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "landmarks" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "dangers" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "inhabitants" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "resources" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "secrets" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "history" text;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "map_position" jsonb;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "era_id" text;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "order_in_era" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "scope" text DEFAULT 'world';--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "parent_lore_id" text;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "status" text DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "event_type" text DEFAULT 'scene';--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "is_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "eras" ADD CONSTRAINT "eras_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_groups" ADD CONSTRAINT "lore_groups_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_versions" ADD CONSTRAINT "note_versions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_element_details" ADD CONSTRAINT "scene_element_details_scene_id_timeline_events_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scene_element_details" ADD CONSTRAINT "scene_element_details_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_parent_lore_id_lore_entries_id_fk" FOREIGN KEY ("parent_lore_id") REFERENCES "public"."lore_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_group_id_lore_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."lore_groups"("id") ON DELETE set null ON UPDATE no action;
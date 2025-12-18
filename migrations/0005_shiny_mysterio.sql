CREATE TABLE "ai_suggestions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"character_id" text,
	"suggestion_type" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" text,
	"suggested_data" jsonb NOT NULL,
	"confidence" integer,
	"reasoning" text,
	"source_chapter_id" text,
	"source_excerpt" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"user_modified_data" jsonb,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_analysis_queue" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"chapter_id" text,
	"character_id" text,
	"analysis_type" text DEFAULT 'all' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5,
	"error" text,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_life_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" text NOT NULL,
	"chapter_id" text,
	"novel_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"event_type" text DEFAULT 'other' NOT NULL,
	"impact" text DEFAULT 'neutral',
	"importance" integer DEFAULT 5,
	"changed_traits" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'creature',
	"threat_level" text DEFAULT 'harmless',
	"novel_id" text NOT NULL,
	"appearance" text,
	"abilities" jsonb,
	"weaknesses" jsonb,
	"habitat" text,
	"image" text,
	"icon" text,
	"color" text DEFAULT '#ef4444',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'artifact',
	"rarity" text DEFAULT 'common',
	"novel_id" text NOT NULL,
	"current_owner_id" text,
	"location_id" text,
	"properties" jsonb,
	"lore" text,
	"image" text,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_entities" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"population" text DEFAULT 'few',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lore_entries" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"type" text DEFAULT 'event',
	"era" text,
	"novel_id" text NOT NULL,
	"order_index" integer DEFAULT 0,
	"related_character_ids" jsonb,
	"related_location_ids" jsonb,
	"related_item_ids" jsonb,
	"icon" text,
	"color" text DEFAULT '#8b5cf6',
	"importance" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_history" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"relationship_id" text NOT NULL,
	"chapter_id" text,
	"novel_id" text NOT NULL,
	"opinion_level" integer NOT NULL,
	"sentiment" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_relationships" ADD COLUMN "opinion_level" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "character_relationships" ADD COLUMN "sentiment" text DEFAULT 'neutral';--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_source_chapter_id_chapters_id_fk" FOREIGN KEY ("source_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_analysis_queue" ADD CONSTRAINT "character_analysis_queue_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_analysis_queue" ADD CONSTRAINT "character_analysis_queue_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_analysis_queue" ADD CONSTRAINT "character_analysis_queue_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_life_events" ADD CONSTRAINT "character_life_events_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_life_events" ADD CONSTRAINT "character_life_events_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_life_events" ADD CONSTRAINT "character_life_events_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_current_owner_id_characters_id_fk" FOREIGN KEY ("current_owner_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_entities" ADD CONSTRAINT "location_entities_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_entities" ADD CONSTRAINT "location_entities_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD CONSTRAINT "lore_entries_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_history" ADD CONSTRAINT "relationship_history_relationship_id_character_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."character_relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_history" ADD CONSTRAINT "relationship_history_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_history" ADD CONSTRAINT "relationship_history_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;
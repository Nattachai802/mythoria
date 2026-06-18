CREATE TABLE "note_audit_issues" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"note_id" text NOT NULL,
	"level" text NOT NULL,
	"category" text NOT NULL,
	"start_index" integer NOT NULL,
	"end_index" integer NOT NULL,
	"flagged_text" text NOT NULL,
	"issue_description" text NOT NULL,
	"suggested_text" text,
	"suggestion_notes" text,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_thread_beats" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" text NOT NULL,
	"event_id" text NOT NULL,
	"role" text DEFAULT 'seed' NOT NULL,
	"note" text,
	"order_index" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_threads" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'foreshadow' NOT NULL,
	"status" text DEFAULT 'planted' NOT NULL,
	"importance" text DEFAULT 'minor' NOT NULL,
	"color" text DEFAULT '#f59e0b',
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"from_type" text NOT NULL,
	"from_id" text NOT NULL,
	"to_type" text NOT NULL,
	"to_id" text NOT NULL,
	"relation" text NOT NULL,
	"context" text,
	"source_span" jsonb,
	"meta" jsonb,
	"created_by" text DEFAULT 'user' NOT NULL,
	"confidence" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_arcs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"title" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"start_chapter_id" text,
	"end_chapter_id" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drive_settings" ADD COLUMN "worldbuilding_spreadsheet_id" text;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "is_detected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "extraction_status" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "lore_entries" ADD COLUMN "extraction_error" text;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "target_deadline" timestamp;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "daily_target_mode" text DEFAULT 'dynamic';--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "daily_target_word_count" integer DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "scene_goal" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "scene_conflict" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "scene_outcome" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "value_shift" integer;--> statement-breakpoint
ALTER TABLE "note_audit_issues" ADD CONSTRAINT "note_audit_issues_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_audit_issues" ADD CONSTRAINT "note_audit_issues_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_beats" ADD CONSTRAINT "plot_thread_beats_thread_id_plot_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."plot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_thread_beats" ADD CONSTRAINT "plot_thread_beats_event_id_timeline_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_threads" ADD CONSTRAINT "plot_threads_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD CONSTRAINT "story_arcs_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD CONSTRAINT "story_arcs_start_chapter_id_chapters_id_fk" FOREIGN KEY ("start_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_arcs" ADD CONSTRAINT "story_arcs_end_chapter_id_chapters_id_fk" FOREIGN KEY ("end_chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ref_from_idx" ON "references" USING btree ("from_type","from_id");--> statement-breakpoint
CREATE INDEX "ref_to_idx" ON "references" USING btree ("to_type","to_id");--> statement-breakpoint
CREATE INDEX "ref_novel_idx" ON "references" USING btree ("novel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ref_unique_edge" ON "references" USING btree ("from_type","from_id","to_type","to_id","relation");
CREATE TABLE "ai_active_runs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"novel_id" text,
	"feature" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_features" (
	"key" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"daily_limit_per_user" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"novel_id" text,
	"feature" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"status" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"error_detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chapter_reader_response" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"suspense" integer NOT NULL,
	"suspense_reason" text NOT NULL,
	"curiosity" integer NOT NULL,
	"curiosity_reason" text NOT NULL,
	"surprise" integer NOT NULL,
	"surprise_reason" text NOT NULL,
	"motivation_clarity" text,
	"motivation_reason" text,
	"causality" text,
	"causality_reason" text,
	"stakes" text,
	"stakes_reason" text,
	"raw" jsonb,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"context_position" integer NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chapter_reader_response_note_id_unique" UNIQUE("note_id")
);
--> statement-breakpoint
CREATE TABLE "faction_relationships" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"source_faction_id" text NOT NULL,
	"target_faction_id" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faction_status_presets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"novel_id" text,
	"user_id" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"note" text,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "plot_findings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"scene_id" text,
	"check_id" text NOT NULL,
	"subject_ref" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"verdict" text,
	"format_version" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plot_recaps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"scope" text NOT NULL,
	"subject_id" text NOT NULL,
	"content" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_rules" (
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
--> statement-breakpoint
CREATE TABLE "tone_presets" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_systems" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'taxonomy' NOT NULL,
	"description" text,
	"ordered" boolean DEFAULT false NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attr_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"color" text DEFAULT '#6366f1',
	"icon" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "parent_faction_id" text;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "alignment" text;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "element" text;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "leader_id" text;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "linked_idea_ids" jsonb;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "linked_system_ids" jsonb;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "importance" integer DEFAULT 5;--> statement-breakpoint
ALTER TABLE "factions" ADD COLUMN "order_index" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "timeline_epoch" timestamp;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "novels" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "plot_thread_beats" ADD COLUMN "canvas_item_id" text;--> statement-breakpoint
ALTER TABLE "powers" ADD COLUMN "access" text DEFAULT 'unique';--> statement-breakpoint
ALTER TABLE "powers" ADD COLUMN "access_note" text;--> statement-breakpoint
ALTER TABLE "powers" ADD COLUMN "baseline" text;--> statement-breakpoint
ALTER TABLE "scene_element_details" ADD COLUMN "role" text;--> statement-breakpoint
ALTER TABLE "scene_element_details" ADD COLUMN "note_kind" text;--> statement-breakpoint
ALTER TABLE "scene_element_details" ADD COLUMN "note_order" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "pov_character_id" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "story_time_index" integer;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "story_date" integer;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "story_duration" integer;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "era_id" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "cause_event_id" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "cause_kind" text;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD COLUMN "cause_note" text;--> statement-breakpoint
ALTER TABLE "ai_active_runs" ADD CONSTRAINT "ai_active_runs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_active_runs" ADD CONSTRAINT "ai_active_runs_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_log" ADD CONSTRAINT "ai_usage_log_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_reader_response" ADD CONSTRAINT "chapter_reader_response_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter_reader_response" ADD CONSTRAINT "chapter_reader_response_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_relationships" ADD CONSTRAINT "faction_relationships_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_relationships" ADD CONSTRAINT "faction_relationships_source_faction_id_factions_id_fk" FOREIGN KEY ("source_faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_relationships" ADD CONSTRAINT "faction_relationships_target_faction_id_factions_id_fk" FOREIGN KEY ("target_faction_id") REFERENCES "public"."factions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_status_presets" ADD CONSTRAINT "faction_status_presets_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faction_status_presets" ADD CONSTRAINT "faction_status_presets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_findings" ADD CONSTRAINT "plot_findings_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_findings" ADD CONSTRAINT "plot_findings_scene_id_timeline_events_id_fk" FOREIGN KEY ("scene_id") REFERENCES "public"."timeline_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plot_recaps" ADD CONSTRAINT "plot_recaps_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "power_rules" ADD CONSTRAINT "power_rules_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tone_presets" ADD CONSTRAINT "tone_presets_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world_systems" ADD CONSTRAINT "world_systems_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_active_runs_user_feature_idx" ON "ai_active_runs" USING btree ("user_id","feature");--> statement-breakpoint
CREATE INDEX "ai_usage_user_day_idx" ON "ai_usage_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_feature_idx" ON "ai_usage_log" USING btree ("feature","created_at");--> statement-breakpoint
CREATE INDEX "chapter_reader_response_novel_id_idx" ON "chapter_reader_response" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "faction_rel_novel_id_idx" ON "faction_relationships" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "faction_rel_source_idx" ON "faction_relationships" USING btree ("source_faction_id");--> statement-breakpoint
CREATE INDEX "faction_rel_target_idx" ON "faction_relationships" USING btree ("target_faction_id");--> statement-breakpoint
CREATE INDEX "faction_status_presets_user_id_idx" ON "faction_status_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "faction_status_presets_novel_id_idx" ON "faction_status_presets" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "plot_findings_novel_id_idx" ON "plot_findings" USING btree ("novel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plot_findings_check_subject_idx" ON "plot_findings" USING btree ("novel_id","check_id","subject_ref");--> statement-breakpoint
CREATE INDEX "plot_recaps_novel_id_idx" ON "plot_recaps" USING btree ("novel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plot_recaps_scope_subject_idx" ON "plot_recaps" USING btree ("novel_id","scope","subject_id");--> statement-breakpoint
CREATE INDEX "power_rules_novel_id_idx" ON "power_rules" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "tone_presets_user_id_idx" ON "tone_presets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "world_systems_novel_id_idx" ON "world_systems" USING btree ("novel_id");--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_parent_faction_id_factions_id_fk" FOREIGN KEY ("parent_faction_id") REFERENCES "public"."factions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factions" ADD CONSTRAINT "factions_leader_id_characters_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_pov_character_id_characters_id_fk" FOREIGN KEY ("pov_character_id") REFERENCES "public"."characters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_cause_event_id_timeline_events_id_fk" FOREIGN KEY ("cause_event_id") REFERENCES "public"."timeline_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chapter_reviews_novel_id_idx" ON "ai_chapter_reviews" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "ai_suggestions_novel_id_idx" ON "ai_suggestions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "chapter_stylometry_novel_id_idx" ON "chapter_stylometry" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "character_design_elements_novel_id_idx" ON "character_design_elements" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "character_states_novel_id_idx" ON "character_states" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "drive_sync_novel_id_idx" ON "drive_sync" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "entities_novel_id_idx" ON "entities" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "eras_novel_id_idx" ON "eras" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "factions_novel_id_idx" ON "factions" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "idea_connections_novel_id_idx" ON "idea_connections" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "ideas_novel_id_idx" ON "ideas" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "items_novel_id_idx" ON "items" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "lore_entries_novel_id_idx" ON "lore_entries" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "lore_entries_era_id_idx" ON "lore_entries" USING btree ("era_id");--> statement-breakpoint
CREATE INDEX "lore_groups_novel_id_idx" ON "lore_groups" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "note_audit_issues_novel_id_idx" ON "note_audit_issues" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "note_stylometry_novel_id_idx" ON "note_stylometry" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "notes_novel_id_idx" ON "notes" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "plot_thread_beats_thread_id_idx" ON "plot_thread_beats" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "plot_threads_novel_id_idx" ON "plot_threads" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "power_combinations_novel_id_idx" ON "power_combinations" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "powers_novel_id_idx" ON "powers" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "relationship_history_novel_id_idx" ON "relationship_history" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "scene_element_details_novel_id_idx" ON "scene_element_details" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "story_arcs_novel_id_idx" ON "story_arcs" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "tags_novel_id_idx" ON "tags" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timeline_events_novel_id_idx" ON "timeline_events" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "timeline_events_era_id_idx" ON "timeline_events" USING btree ("era_id");
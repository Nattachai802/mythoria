CREATE TABLE "character_design_elements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"name" text,
	"position" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_design_elements" ADD CONSTRAINT "character_design_elements_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character_design_elements" ADD CONSTRAINT "character_design_elements_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chapters_novel_id_idx" ON "chapters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "char_analysis_queue_novel_id_idx" ON "character_analysis_queue" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "char_analysis_queue_chapter_id_idx" ON "character_analysis_queue" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "life_events_novel_id_idx" ON "character_life_events" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "life_events_character_id_idx" ON "character_life_events" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "relationships_novel_id_idx" ON "character_relationships" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "relationships_source_char_idx" ON "character_relationships" USING btree ("source_character_id");--> statement-breakpoint
CREATE INDEX "relationships_target_char_idx" ON "character_relationships" USING btree ("target_character_id");--> statement-breakpoint
CREATE INDEX "characters_novel_id_idx" ON "characters" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "loc_conn_novel_id_idx" ON "location_connections" USING btree ("novel_id");--> statement-breakpoint
CREATE INDEX "loc_conn_source_loc_idx" ON "location_connections" USING btree ("source_location_id");--> statement-breakpoint
CREATE INDEX "loc_conn_target_loc_idx" ON "location_connections" USING btree ("target_location_id");--> statement-breakpoint
CREATE INDEX "locations_novel_id_idx" ON "locations" USING btree ("novel_id");
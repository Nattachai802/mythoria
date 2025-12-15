CREATE TABLE "alias_cache" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"english_name" text NOT NULL,
	"aliases" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "alias_cache_english_name_unique" UNIQUE("english_name")
);
--> statement-breakpoint
CREATE TABLE "location_connections" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_location_id" text NOT NULL,
	"target_location_id" text NOT NULL,
	"connection_type" text DEFAULT 'adjacent',
	"custom_label" text,
	"is_bidirectional" boolean DEFAULT true,
	"novel_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "aliases" jsonb;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_source_location_id_locations_id_fk" FOREIGN KEY ("source_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_target_location_id_locations_id_fk" FOREIGN KEY ("target_location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_connections" ADD CONSTRAINT "location_connections_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_location_id_locations_id_fk" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
CREATE TABLE "drive_credentials" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"google_email" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_credentials_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "drive_settings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"novel_id" text NOT NULL,
	"root_folder_id" text,
	"is_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "drive_settings_novel_id_unique" UNIQUE("novel_id")
);
--> statement-breakpoint
CREATE TABLE "drive_sync" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" text NOT NULL,
	"novel_id" text NOT NULL,
	"google_doc_id" text NOT NULL,
	"drive_folder_id" text,
	"last_synced_at" timestamp,
	"base_content" jsonb,
	"format_snapshot" jsonb,
	"last_local_modified_at" timestamp,
	"last_remote_modified_at" timestamp,
	"sync_status" text DEFAULT 'synced',
	"conflict_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_connections" ADD COLUMN "connection_type" text DEFAULT 'related' NOT NULL;--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "linked_location_ids" jsonb;--> statement-breakpoint
ALTER TABLE "drive_credentials" ADD CONSTRAINT "drive_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_settings" ADD CONSTRAINT "drive_settings_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_sync" ADD CONSTRAINT "drive_sync_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drive_sync" ADD CONSTRAINT "drive_sync_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;
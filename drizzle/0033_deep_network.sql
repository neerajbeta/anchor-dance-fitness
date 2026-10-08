ALTER TABLE "classes" ADD COLUMN "zoom_meeting_id" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "zoom_join_url" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "zoom_password" text;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "zoom_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "zoom_error" text;
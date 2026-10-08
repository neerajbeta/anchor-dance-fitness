ALTER TABLE "users" ADD COLUMN "gdpr_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gdpr_consent_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "media_consent_withdrawn_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "data_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "photo_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "video_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "promo_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Carry over the single combined consent people gave before it was split up:
-- anyone who agreed allowed their contact details, and the old media consent
-- covered photos, videos and promotional use together.
UPDATE "users" SET "data_consent" = true WHERE "gdpr_consent_at" IS NOT NULL;--> statement-breakpoint
UPDATE "users" SET "photo_consent" = true, "video_consent" = true, "promo_consent" = true WHERE "media_consent" = true;
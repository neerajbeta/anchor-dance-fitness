ALTER TYPE "public"."discount_scope" ADD VALUE 'event';--> statement-breakpoint
ALTER TYPE "public"."discount_scope" ADD VALUE 'workshop';--> statement-breakpoint
ALTER TYPE "public"."discount_scope" ADD VALUE 'studio';--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "valid_from" date;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "valid_until" date;
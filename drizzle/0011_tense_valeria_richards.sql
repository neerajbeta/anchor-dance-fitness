CREATE TYPE "public"."discount_type" AS ENUM('percent', 'flat');--> statement-breakpoint
ALTER TABLE "discounts" ALTER COLUMN "percent" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "type" "discount_type" DEFAULT 'percent' NOT NULL;--> statement-breakpoint
ALTER TABLE "discounts" ADD COLUMN "flat_amount" integer;
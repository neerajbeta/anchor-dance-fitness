CREATE TYPE "public"."discount_scope" AS ENUM('all', 'category', 'class');--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"percent" integer NOT NULL,
	"scope" "discount_scope" DEFAULT 'all' NOT NULL,
	"target" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "discounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "coupon_code" text;--> statement-breakpoint
ALTER TABLE "studio_blocks" ADD COLUMN "end_date" date;
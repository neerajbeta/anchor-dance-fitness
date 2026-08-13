ALTER TABLE "registrations" ADD COLUMN "amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "discount_code" text;
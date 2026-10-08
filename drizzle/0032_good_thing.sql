CREATE TABLE "payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" text NOT NULL,
	"step" integer NOT NULL,
	"channel" text NOT NULL,
	"sent_via" text,
	"status" text NOT NULL,
	"error" text,
	"sent_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_reminders_reg_idx" ON "payment_reminders" ("registration_id", "created_at");

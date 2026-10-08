CREATE TABLE "bulk_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"audience" text,
	"audience_label" text,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"error" text,
	"announcement_id" uuid,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone
);

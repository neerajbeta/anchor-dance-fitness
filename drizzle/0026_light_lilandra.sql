CREATE TABLE "vat_rates" (
	"booking_type" text PRIMARY KEY NOT NULL,
	"rate_bp" integer DEFAULT 0 NOT NULL,
	"mode" text DEFAULT 'inclusive' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "vat_rate_bp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "vat_mode" text;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "vat_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "net_amount" integer;
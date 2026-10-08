CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"registration_id" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now(),
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"description" text NOT NULL,
	"details" text,
	"booking_type" text NOT NULL,
	"base_amount" integer,
	"discount_code" text,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"net_amount" integer NOT NULL,
	"vat_rate_bp" integer DEFAULT 0 NOT NULL,
	"vat_mode" text,
	"vat_amount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"payment_method" text,
	"payment_ref" text,
	"seller" text,
	"emailed_at" timestamp with time zone,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_registration_id_unique" UNIQUE("registration_id")
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "base_amount" integer;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "discount_amount" integer;
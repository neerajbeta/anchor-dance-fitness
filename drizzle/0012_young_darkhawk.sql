CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"age" integer,
	"email" text NOT NULL,
	"phone_country_code" text,
	"phone" text NOT NULL,
	"area_of_interest" text,
	"type_of_class" text,
	"preferred_location" text,
	"additional_info" text,
	"consent" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);

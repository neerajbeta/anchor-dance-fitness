CREATE TYPE "public"."booking_type" AS ENUM('class', 'workshop', 'event', 'studio');--> statement-breakpoint
CREATE TYPE "public"."mode" AS ENUM('online', 'offline');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'overdue', 'onetime');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('student', 'admin', 'coach');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"emoji" text,
	"date" text NOT NULL,
	"mode" "mode" NOT NULL,
	"location" text NOT NULL,
	"coach" text,
	"price" integer DEFAULT 0 NOT NULL,
	"seats_left" integer DEFAULT 0 NOT NULL,
	"seats_total" integer DEFAULT 0 NOT NULL,
	"is_past" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"age" integer,
	"initial" text,
	"color" text,
	"location" text NOT NULL,
	"flag" text,
	"type" "booking_type" NOT NULL,
	"detail" text,
	"category" text,
	"level" text,
	"mode" "mode",
	"period" text,
	"plan" text,
	"paid" "payment_status" DEFAULT 'onetime' NOT NULL,
	"status" text NOT NULL,
	"status_tone" text DEFAULT 'gray' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'student' NOT NULL,
	"age" integer,
	"location" text,
	"flag" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

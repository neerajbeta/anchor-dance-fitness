CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"channel" text DEFAULT 'instagram' NOT NULL,
	"event_id" uuid,
	"landing" text DEFAULT 'workshops' NOT NULL,
	"start_date" date,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "promotions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "kind" text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "event_id" uuid;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "registrations" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;
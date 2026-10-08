CREATE TABLE "customer_status_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason_code" text,
	"note" text,
	"booking_id" text,
	"actor_name" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "customer_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blacklisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_status_log" ADD CONSTRAINT "customer_status_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_status_log_user_idx" ON "customer_status_log" ("user_id", "created_at");--> statement-breakpoint
INSERT INTO "permissions" ("name", "slug", "module", "description") VALUES
  ('View Customers', 'customers.view', 'customers', 'View customers, their status (paused, dropped, blacklisted, unpaid) and history.'),
  ('Edit Customers', 'customers.edit', 'customers', 'Pause, drop, resume or blacklist a customer.')
ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE p."slug" IN ('customers.view', 'customers.edit')
  AND r."slug" IN ('super-admin', 'admin', 'manager')
  AND NOT EXISTS (SELECT 1 FROM "role_permissions" rp WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id");
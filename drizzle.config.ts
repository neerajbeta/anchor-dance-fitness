import type { Config } from "drizzle-kit";

// Migrations run against the DIRECT connection (port 5432); runtime queries use
// the pooled DATABASE_URL. Falls back to DATABASE_URL if DIRECT_URL is unset.
export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
} satisfies Config;

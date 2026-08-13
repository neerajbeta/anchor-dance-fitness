// One-shot: create tables (run migrations) + seed mock data.
// Usage: node scripts/db-setup.mjs
import fs from "node:fs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
// Prefer direct connection for migrations, fall back to the pooler.
const candidates = [env.DIRECT_URL, env.DATABASE_URL].filter(Boolean);
if (candidates.length === 0) {
  console.error("✗ No DATABASE_URL / DIRECT_URL found in .env.local");
  process.exit(1);
}

function mask(url) {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
}

async function run(url) {
  const sql = postgres(url, { ssl: "require", prepare: false, max: 1, idle_timeout: 5 });
  const db = drizzle(sql);
  console.log(`→ Connecting: ${mask(url)}`);
  await sql`select 1`; // fail fast if unreachable
  console.log("  ✓ Connected");

  console.log("→ Running migrations (creating tables)…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("  ✓ Tables created / up to date");

  console.log("→ Seeding mock data…");
  await sql.unsafe(fs.readFileSync("./drizzle/seed.sql", "utf8"));
  console.log("  ✓ Seed applied");

  const [{ n: regs }] = await sql`select count(*)::int as n from registrations`;
  const [{ n: evs }] = await sql`select count(*)::int as n from events`;
  const [{ n: admins }] = await sql`select count(*)::int as n from users where role = 'admin'`;
  console.log(`\nRow counts → registrations: ${regs} · events: ${evs} · admin users: ${admins}`);

  await sql.end({ timeout: 5 });
}

let ok = false;
for (const url of candidates) {
  try {
    await run(url);
    ok = true;
    break;
  } catch (err) {
    console.error(`  ✗ Failed on ${mask(url)}: ${err.message}\n`);
  }
}
process.exit(ok ? 0 : 1);

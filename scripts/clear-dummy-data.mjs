// Removes everything created by scripts/seed-dummy-data.mjs — every demo row is tagged with
// a "[Demo]" prefix in its name/title, so cleanup is just deleting those.
// Usage: node scripts/clear-dummy-data.mjs
import fs from "node:fs";
import postgres from "postgres";

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
const url = env.DATABASE_URL;
if (!url) {
  console.error("✗ No DATABASE_URL found in .env.local");
  process.exit(1);
}

const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });

async function run() {
  await sql`select 1`;
  const regs = await sql`delete from registrations where name like '[Demo]%' returning id`;
  const blocks = await sql`delete from studio_blocks where reason like '[Demo]%' returning id`;
  const events = await sql`delete from events where title like '[Demo]%' returning id`;
  console.log(`✓ Removed ${regs.length} demo registrations, ${events.length} demo events, ${blocks.length} demo studio blocks.`);
  await sql.end();
}

run().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});

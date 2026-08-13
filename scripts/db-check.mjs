// Lists all tables + row counts, and de-duplicates events (idempotency repair).
import fs from "node:fs";
import postgres from "postgres";

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnv(".env"), ...loadEnv(".env.local") };
const url = env.DIRECT_URL || env.DATABASE_URL;
const sql = postgres(url, { ssl: "require", prepare: false, max: 1 });

try {
  // Repair: keep one event per (title, date), drop duplicates from repeated seeding.
  await sql.unsafe(`
    DELETE FROM events e USING events d
    WHERE e.title = d.title AND e.date = d.date AND e.ctid > d.ctid;
  `);

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  console.log(`\n${tables.length} tables in public schema:\n`);
  for (const { table_name } of tables) {
    const [{ n }] = await sql.unsafe(`SELECT count(*)::int AS n FROM "${table_name}"`);
    console.log(`  ${table_name.padEnd(22)} ${n} rows`);
  }
} catch (err) {
  console.error("✗", err.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

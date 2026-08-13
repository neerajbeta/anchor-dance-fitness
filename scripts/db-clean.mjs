// Removes dummy content so only real admin/user-created data remains.
// Empties registrations, bookings (+subtypes), payments, receipts, members,
// and the sample events. Keeps the admin login user and any real config.
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
  await sql.unsafe(`
    TRUNCATE TABLE
      receipts, payments,
      class_bookings, workshop_bookings, studio_bookings, bookings,
      registrations, members, event_media, events
    RESTART IDENTITY CASCADE;
  `);
  // Remove any non-admin (student/coach) users; keep admin login accounts.
  await sql`DELETE FROM users WHERE role <> 'admin'`;
  console.log("✓ Cleared registrations, bookings, payments, receipts, members, events, non-admin users");

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;`;
  console.log("");
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

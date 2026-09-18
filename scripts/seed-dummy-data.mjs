// Dummy/demo data for testing filters across the admin panel — registrations (classes,
// workshops, events, studio), events catalog rows, and a couple of studio blocks.
// NOT part of drizzle/seed.sql (infrastructure only) — this is throwaway test data, safe to
// re-run (skips if it already ran) and safe to delete: every row this script creates has
// `[Demo]` in its name/title so it's easy to find and remove later.
//
// Usage: node scripts/seed-dummy-data.mjs
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

function isoDate(daysFromToday) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

async function run() {
  console.log("→ Connecting…");
  await sql`select 1`;

  const already = await sql`select id from registrations where name like '[Demo]%' limit 1`;
  if (already.length > 0) {
    console.log("  Demo data already present (found a '[Demo]' registration) — skipping. " +
      "Run scripts/clear-dummy-data.mjs first if you want to regenerate it.");
    await sql.end();
    return;
  }

  // ── Events catalog (workshops + events) ────────────────────────────────────────────
  console.log("→ Creating demo events…");
  const eventRows = [
    {
      kind: "workshop", title: "[Demo] Salsa Fusion Night", emoji: "💃",
      mode: "online", location: "Stockholm", coach: "Coach Leila",
      price: 350, seatsTotal: 20, seatsLeft: 15, isPast: false,
      eventDate: isoDate(10), endDate: isoDate(10), startTime: "18:00", endTime: "20:00",
    },
    {
      kind: "workshop", title: "[Demo] Kathak Masterclass", emoji: "🩰",
      mode: "offline", location: "Mumbai", coach: "Coach Ana",
      price: 500, seatsTotal: 15, seatsLeft: 2, isPast: false, // low-seat
      eventDate: isoDate(6), endDate: isoDate(6), startTime: "10:00", endTime: "12:30",
    },
    {
      kind: "event", title: "[Demo] Zumba Marathon", emoji: "🎉",
      mode: "offline", location: "London", coach: "Coach Maria",
      price: 200, seatsTotal: 40, seatsLeft: 40, isPast: false,
      eventDate: isoDate(20), endDate: isoDate(20), startTime: "09:00", endTime: "13:00",
    },
    {
      kind: "event", title: "[Demo] Yoga Retreat Day", emoji: "🧘",
      mode: "online", location: "Madrid", coach: "Coach Leila",
      price: 300, seatsTotal: 25, seatsLeft: 0, isPast: false, // sold out
      eventDate: isoDate(15), endDate: isoDate(15), startTime: "08:00", endTime: "17:00",
    },
    {
      kind: "workshop", title: "[Demo] Bollywood Bash", emoji: "💃",
      mode: "offline", location: "Bhopal", coach: "Coach Ana",
      price: 400, seatsTotal: 30, seatsLeft: 5, isPast: true,
      eventDate: isoDate(-20), endDate: isoDate(-20), startTime: "17:00", endTime: "19:30",
    },
    {
      kind: "event", title: "[Demo] Annual Dance Showcase", emoji: "🌟",
      mode: "offline", location: "New York City", coach: "Coach Maria",
      price: 0, seatsTotal: 50, seatsLeft: 10, isPast: true,
      eventDate: isoDate(-35), endDate: isoDate(-35), startTime: "17:00", endTime: "20:00",
    },
  ];
  const insertedEvents = [];
  for (const e of eventRows) {
    const dateLabel = `${e.eventDate} · ${e.startTime}–${e.endTime}`;
    const [row] = await sql`
      insert into events
        (kind, title, description, emoji, date, mode, location, coach, price,
         seats_left, seats_total, is_past, is_open, event_date, end_date, start_time, end_time)
      values
        (${e.kind}, ${e.title}, ${"Demo data for testing filters."}, ${e.emoji}, ${dateLabel},
         ${e.mode}, ${e.location}, ${e.coach}, ${e.price}, ${e.seatsLeft}, ${e.seatsTotal},
         ${e.isPast}, ${e.seatsLeft > 0}, ${e.eventDate}, ${e.endDate}, ${e.startTime}, ${e.endTime})
      returning id, title
    `;
    insertedEvents.push(row);
  }
  const eventByTitle = Object.fromEntries(insertedEvents.map((e) => [e.title, e.id]));

  // ── Registrations (classes / workshops / events / studio) ─────────────────────────
  console.log("→ Creating demo registrations…");
  const [{ n: maxIdRow }] = await sql`
    select coalesce(max(nullif(regexp_replace(id, '\\D', '', 'g'), '')::int), 90) as n
    from registrations
  `;
  let nextId = maxIdRow + 1;
  const genId = () => `AF-${String(nextId++).padStart(4, "0")}`;

  const today = new Date();
  const colorFor = () => ["#EF5B2B", "#3B82C4", "#8B5CF6", "#E0972B", "#22B07D"][Math.floor(Math.random() * 5)];

  const regs = [
    // Classes — Active, paid
    { name: "[Demo] Ananya Sharma", email: "demo.ananya@example.com", location: "Stockholm", flag: "🇸🇪", type: "class", detail: "Batch TBD", category: "Bollywood Dance", level: "Beginner", mode: "offline", plan: "Quarterly", paid: "paid", status: "Active", statusTone: "ok", amount: 1047 },
    { name: "[Demo] Rohan Verma", email: "demo.rohan@example.com", location: "Mumbai", flag: "🇮🇳", type: "class", detail: "Mon·Wed·Fri 7AM", category: "Kathak", level: "Intermediate", mode: "online", plan: "Quarterly", paid: "paid", status: "Active", statusTone: "ok", amount: 950 },
    // Classes — overdue / at risk
    { name: "[Demo] Priya Nair", email: "demo.priya@example.com", location: "London", flag: "🇬🇧", type: "class", detail: "Batch TBD", category: "Yoga", level: "Beginner", mode: "offline", plan: "Monthly", paid: "overdue", status: "At Risk", statusTone: "danger", amount: 420 },
    { name: "[Demo] Karan Mehta", email: "demo.karan@example.com", location: "Indore", flag: "🇮🇳", type: "class", detail: "Tue·Thu 6PM", category: "Zumba", level: "Beginner", mode: "online", plan: "Monthly", paid: "overdue", status: "At Risk", statusTone: "danger", amount: 250 },
    // Classes — pending payment
    { name: "[Demo] Simran Kaur", email: "demo.simran@example.com", location: "Madrid", flag: "🇪🇸", type: "class", detail: "Batch TBD", category: "Salsa", level: "Advanced", mode: "offline", plan: "Quarterly", paid: "pending", status: "Active", statusTone: "warn", amount: 1100 },
    { name: "[Demo] Aditya Rao", email: "demo.aditya@example.com", location: "New York City", flag: "🇺🇸", type: "class", detail: "Batch TBD", category: "Yoga", level: "Intermediate", mode: "online", plan: "Monthly", paid: "pending", status: "Active", statusTone: "warn", amount: 380 },
    // Classes — Pending Batch (unassigned students)
    { name: "[Demo] Fatima Khan", email: "demo.fatima@example.com", location: "Bhopal", flag: "🇮🇳", type: "class", detail: "Batch TBD", category: "Bollywood Dance", level: "Beginner", mode: "offline", plan: "Quarterly", paid: "paid", status: "Pending Batch", statusTone: "warn", amount: 1000 },
    { name: "[Demo] Vikram Singh", email: "demo.vikram@example.com", location: "Stockholm", flag: "🇸🇪", type: "class", detail: "Batch TBD", category: "Kathak", level: "Beginner", mode: "online", plan: "Quarterly", paid: "paid", status: "Pending Batch", statusTone: "warn", amount: 1047 },
    { name: "[Demo] Meera Iyer", email: "demo.meera@example.com", location: "Mumbai", flag: "🇮🇳", type: "class", detail: "Batch TBD", category: "Zumba", level: "Intermediate", mode: "offline", plan: "Monthly", paid: "paid", status: "Pending Batch", statusTone: "warn", amount: 250 },
    { name: "[Demo] Arjun Patel", email: "demo.arjun@example.com", location: "London", flag: "🇬🇧", type: "class", detail: "Batch TBD", category: "Salsa", level: "Beginner", mode: "online", plan: "Quarterly", paid: "paid", status: "Pending Batch", statusTone: "warn", amount: 900 },
    { name: "[Demo] Diya Kapoor", email: "demo.diya@example.com", location: "Indore", flag: "🇮🇳", type: "class", detail: "Batch TBD", category: "Yoga", level: "Advanced", mode: "offline", plan: "Monthly", paid: "paid", status: "Pending Batch", statusTone: "warn", amount: 420 },
    // Workshops
    { name: "[Demo] Neha Joshi", email: "demo.neha@example.com", location: "Stockholm", flag: "🇸🇪", type: "workshop", detail: "[Demo] Salsa Fusion Night", category: null, level: null, mode: "online", plan: "", paid: "paid", status: "Registered", statusTone: "warn", amount: 350, eventTitle: "[Demo] Salsa Fusion Night" },
    { name: "[Demo] Rahul Gupta", email: "demo.rahul@example.com", location: "Mumbai", flag: "🇮🇳", type: "workshop", detail: "[Demo] Kathak Masterclass", category: null, level: null, mode: "offline", plan: "", paid: "overdue", status: "At Risk", statusTone: "danger", amount: 500, eventTitle: "[Demo] Kathak Masterclass" },
    { name: "[Demo] Sanya Malhotra", email: "demo.sanya@example.com", location: "London", flag: "🇬🇧", type: "workshop", detail: "[Demo] Kathak Masterclass", category: null, level: null, mode: "offline", plan: "", paid: "paid", status: "Registered", statusTone: "warn", amount: 500, eventTitle: "[Demo] Kathak Masterclass" },
    // Events
    { name: "[Demo] Aarav Shah", email: "demo.aarav@example.com", location: "Madrid", flag: "🇪🇸", type: "event", detail: "[Demo] Yoga Retreat Day", category: null, level: null, mode: "online", plan: "", paid: "paid", status: "Registered", statusTone: "warn", amount: 300, eventTitle: "[Demo] Yoga Retreat Day" },
    { name: "[Demo] Ishita Reddy", email: "demo.ishita@example.com", location: "New York City", flag: "🇺🇸", type: "event", detail: "[Demo] Annual Dance Showcase", category: null, level: null, mode: "offline", plan: "", paid: "pending", status: "Registered", statusTone: "warn", amount: 0, eventTitle: "[Demo] Annual Dance Showcase" },
    { name: "[Demo] Kabir Chopra", email: "demo.kabir@example.com", location: "Bhopal", flag: "🇮🇳", type: "event", detail: "[Demo] Zumba Marathon", category: null, level: null, mode: "offline", plan: "", paid: "overdue", status: "At Risk", statusTone: "danger", amount: 200, eventTitle: "[Demo] Zumba Marathon" },
    // Studio bookings
    { name: "[Demo] Tara Menon", email: "demo.tara@example.com", location: "Stockholm", flag: "🇸🇪", type: "studio", detail: "10:00–11:00 · Personal Practice", category: null, level: null, mode: "offline", plan: "", paid: "paid", status: "Confirmed", statusTone: "ok", amount: 150, period: isoDate(4) },
    { name: "[Demo] Yash Thakur", email: "demo.yash@example.com", location: "Indore", flag: "🇮🇳", type: "studio", detail: "14:00–15:30 · Rehearsal", category: null, level: null, mode: "offline", plan: "", paid: "paid", status: "Confirmed", statusTone: "ok", amount: 220, period: isoDate(8) },
    { name: "[Demo] Nikita Bose", email: "demo.nikita@example.com", location: "Mumbai", flag: "🇮🇳", type: "studio", detail: "18:00–19:00 · Private Coaching", category: null, level: null, mode: "offline", plan: "", paid: "overdue", status: "At Risk", statusTone: "danger", amount: 300, period: isoDate(2) },
  ];

  for (const r of regs) {
    const id = genId();
    const initial = r.name.replace("[Demo] ", "")[0].toUpperCase();
    const eventId = r.eventTitle ? eventByTitle[r.eventTitle] ?? null : null;
    const createdAt = new Date(today.getTime() - Math.floor(Math.random() * 25) * 86400000);
    await sql`
      insert into registrations
        (id, name, email, age, initial, color, location, flag, type, detail, category, level,
         mode, period, plan, paid, status, status_tone, amount, event_id, created_at)
      values
        (${id}, ${r.name}, ${r.email}, ${18 + Math.floor(Math.random() * 20)}, ${initial}, ${colorFor()},
         ${r.location}, ${r.flag}, ${r.type}, ${r.detail}, ${r.category}, ${r.level}, ${r.mode},
         ${r.period ?? ""}, ${r.plan}, ${r.paid}, ${r.status}, ${r.statusTone}, ${r.amount},
         ${eventId}, ${createdAt})
    `;
  }

  // ── A couple more studio blocks (for calendar variety) ─────────────────────────────
  console.log("→ Creating demo studio blocks…");
  await sql`
    insert into studio_blocks (location, date, end_date, start_time, end_time, reason)
    values
      (${"Stockholm"}, ${isoDate(12)}, ${isoDate(12)}, ${"09:00"}, ${"12:00"}, ${"[Demo] Maintenance"}),
      (${"Mumbai"}, ${isoDate(18)}, ${isoDate(19)}, ${"00:00"}, ${"23:30"}, ${"[Demo] Private event"})
  `;

  const counts = await sql`
    select type, count(*)::int as n from registrations where name like '[Demo]%' group by type
  `;
  console.log("\n✓ Done. Demo registrations by type:", Object.fromEntries(counts.map((c) => [c.type, c.n])));
  console.log(`✓ Demo events created: ${insertedEvents.length}`);
  await sql.end();
}

run().catch((err) => {
  console.error("✗ Failed:", err);
  process.exit(1);
});

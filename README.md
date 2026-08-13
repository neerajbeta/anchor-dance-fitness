# Anchor Fitness — Registration & Booking Portal

A Next.js (App Router) implementation of the Anchor Fitness portal, built from the
**Solution Architecture Document (v1.0)** and the **v5 wireframe flow**. The visual
design system is derived from the Anchor Fitness logo — a warm **orange → red gradient**
(`#F7942E → #EF5B2B → #E63E2B`) with a warm espresso ink and cream neutrals.

> Scope: **Phase 1 UI** (frontend + mock data). No backend / PostgreSQL / Azure —
> those are described in the architecture doc and structurally anticipated, not built.

## Tech stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS 3** with a custom brand token theme (`tailwind.config.ts`, `globals.css`)
- Google Fonts: **Inter** (body) + **Poppins** (display)

## Run

```bash
npm install
npm run dev     # http://localhost:3000
```

`npm run build` produces an optimized production build.

> **Note:** don't run `npm run build` while `npm run dev` is running — they share
> the `.next` folder and it corrupts the dev cache. Stop dev first, or `rm -rf .next`
> and restart dev if you hit `Cannot find module './###.js'`.

## Admin authentication

The admin panel uses **real server-side auth**, not a client flag:

- A signed **httpOnly session cookie** (JWT via `jose`), 8-hour expiry.
- **`middleware.ts`** guards every `/admin/*` route (except `/admin/login`) before it renders — logged-out users are redirected server-side.
- **Login** (`/admin/login`) verifies credentials via a server action: bcrypt-compared against the `users` table (`role='admin'`), or a demo fallback when no DB/admin exists.
- **Logout** (Sign Out) clears the cookie via a server action.

Set these in `.env.local` (see `.env.example`):

```bash
AUTH_SECRET="<long random string>"    # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ADMIN_EMAIL="admin@anchorfitness.com" # demo fallback (used only when no DB admin)
ADMIN_PASSWORD="anchor-admin"
```

With a database connected, add real admins to the `users` table (the seed inserts
one: `admin@anchorfitness.com` / `anchor-admin` — **change this**).

## REST API

All admin data flows through a JSON REST API under `/api`, authenticated by the
admin session cookie (server-side, per architecture doc §12/§15). Non-admins get
`401`/`403`. All routes run on the Node runtime and are dynamic.

| Method | Route | Purpose |
|--------|-------|---------|
| GET / POST | `/api/registrations` | List all registrations · create one (Book on Behalf / user booking) |
| GET / POST | `/api/events` | List events · create a workshop/event |
| PATCH / DELETE | `/api/events/[id]` | Edit / delete an event |
| GET | `/api/students?q=` | Search student users (Book on Behalf) |
| GET | `/api/dashboard` | Dashboard KPIs + recent lists |
| GET | `/api/payments` | Payment KPIs + rows |
| GET | `/api/studio` | Studio bookings |
| GET | `/api/catalog` | Plans + coaches + batches |

Mutations are validated and persist to PostgreSQL. Reads reuse the same
data-access layer the server components use (`lib/registrations.ts`, `lib/events.ts`,
`lib/stats.ts`); writes go through `lib/services.ts`. Auth guard: `lib/auth/api.ts`.

Admin pages that write: **Book on Behalf** (`POST /api/registrations`) and
**Events** (`POST`/`DELETE /api/events`). All admin read pages are server-rendered
dynamic (`force-dynamic`) and show real data with empty states — no mock rows.

## Database (PostgreSQL via Supabase → Azure later)

The app uses **Drizzle ORM + `postgres-js`** against plain PostgreSQL, so moving
from **Supabase** to **Azure Database for PostgreSQL** later is just a connection-string
swap — no code changes. Until `DATABASE_URL` is set, every screen falls back to the
bundled mock data (the admin table shows a **● Sample data** badge; with a DB it shows
**● Live database**).

### Connect Supabase

1. Create a Supabase project (EU region for the doc's data-residency note).
2. Copy `.env.example` → `.env.local` and fill in:
   - `DATABASE_URL` — **Transaction pooler** string (port `6543`) for runtime queries.
   - `DIRECT_URL` — **Direct** string (port `5432`) for migrations.
3. Create the tables and seed:

   ```bash
   npm run db:migrate      # applies drizzle/0000_*.sql to your database
   # then seed: paste drizzle/seed.sql into the Supabase SQL Editor and run
   ```

   (Or `npm run db:push` to push the schema without a migration file.)
4. Restart `npm run dev` — `/admin/registrations` now reads live rows.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run db:generate` | Regenerate SQL migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:push` | Push schema directly (no migration file) |
| `npm run db:studio` | Open Drizzle Studio (browse/edit data) |

### Files

```
drizzle.config.ts        # Drizzle Kit config
drizzle/0000_*.sql       # generated migration (users, events, registrations)
drizzle/seed.sql         # sample rows matching the mock data
src/lib/db/schema.ts     # table definitions
src/lib/db/client.ts     # guarded connection (no-op until DATABASE_URL set)
src/lib/registrations.ts # data-access with DB → mock fallback
```

### Migrating to Azure later

Point `DATABASE_URL` / `DIRECT_URL` at your Azure Database for PostgreSQL
(`...postgres.database.azure.com:5432/postgres?sslmode=require`) and re-run
`npm run db:migrate`. Application code stays the same.

## Screen map (17 wireframe screens)

A floating **⚓ screen switcher** (bottom-right on every page) jumps between all screens.

| # | Route | Screen |
|---|-------|--------|
| 1 | `/login` | Login / Sign up (split brand panel) |
| 2 | `/register` | Register — Step 1 (profile + optional guardian) |
| 3 | `/book` | Book Home (booking-type chooser) |
| 4 | `/book/class` | Book Class (mode toggle, dynamic location, media consent) |
| 5 | `/book/workshops` | Workshops & Events (filters, media cards, past section) |
| 6 | `/book/studio` | Studio Hire (calendar, multi-slot live pricing, policies) |
| 7 | `/plans` | Plans & Pay (5 plans + payment) |
| 8 | `/confirmation` | Booking Confirmed (receipt + calendar sync) |
| 9 | `/portal` | Student Portal (member switcher, classes/workshops/studio, receipts) |
| 10 | `/admin/registrations` | ★ All Registrations (primary admin view) |
| 11 | `/admin/dashboard` | Admin Dashboard (KPIs, alerts) |
| 12 | `/admin/events` | Events & Workshops (media mgmt + Create Event modal) |
| 13 | `/admin/studio` | Studio Bookings (calendar + list) |
| 14 | `/admin/book-on-behalf` | Book on Behalf (user search + admin batch) |
| 15 | `/admin/payments` | Payment Dashboard (heatmap) |
| 16 | `/add-member` | Add Family Member |
| 17 | `/coach` | Coach Portal (rosters, attendance, video upload) |

## Project structure

```
src/
  app/                 # one folder per route (App Router)
  components/          # Logo, TopNav, AdminShell, Stepper, StudioCalendar,
                       # ScreenSwitcher, GoogleButton, ui helpers
  lib/data.ts          # mock data (registrations, events, plans, slots)
```

## Design tokens

Brand colors and the full palette live in `tailwind.config.ts` (`brand.*`, `ink`,
`cream`, semantic `ok/warn/danger/info/grape`). To re-skin, change the `brand` scale
and the `bg-brand` gradient in one place.

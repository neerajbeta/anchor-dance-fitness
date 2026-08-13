-- Seed for Anchor Fitness — run AFTER the migrations.
-- Supabase: paste into SQL Editor and run. Idempotent (safe to re-run).
--
-- NOTE: This seeds ONLY the admin login account (infrastructure).
-- Registrations, bookings, events, payments etc. are NOT seeded — those tables
-- fill only with real data created by admins or users through the app.

-- Admin login user. Password is 'anchor-admin' (bcrypt). CHANGE THIS in production.
INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin','admin@anchorfitness.com','$2b$10$Ti82ezxHMOqOsEzEbWWvg.vFWVwEDQbt7GywC5euf62FuJs6WalE2','admin')
ON CONFLICT (email) DO NOTHING;

-- Default studio locations (from the architecture doc). Admin can add/remove more.
INSERT INTO locations (label, country, flag) VALUES
  ('Stockholm','Sweden','🇸🇪'),
  ('Mumbai','India','🇮🇳'),
  ('London','UK','🇬🇧'),
  ('New York City','USA','🇺🇸')
ON CONFLICT (label) DO NOTHING;

-- Default class categories. Admin can add/remove more.
INSERT INTO categories (name) VALUES ('Yoga'), ('Zumba'), ('Bollywood Dance')
ON CONFLICT (name) DO NOTHING;

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

-- Default pricing plans (student Choose Plan screen + Book on Behalf). Admin manages them
-- under Catalog → Plans. Recurring plan prices are per month; demo/one-time charge once.
INSERT INTO plans (code, name, "interval", price, description) VALUES
  ('demo', 'Demo Class', 'demo', 100, 'Single trial session. One-time. No commitment.'),
  ('monthly', 'Monthly', 'monthly', 399, 'Month-to-month. Cancel anytime.'),
  ('quarterly', 'Quarterly', 'quarterly', 349, 'Billed every 3 months.'),
  ('biannual', 'Bi-Annual', 'biannual', 299, 'Billed every 6 months.'),
  ('annual', 'Annual', 'annual', 249, 'Best long-term value.')
ON CONFLICT (code) DO NOTHING;

-- ───────────── User Management / RBAC: default roles & permission catalog ─────────────
-- Super Admin is a protected system role (is_system_role) — always full access, can't be
-- edited or deleted, so the app can never be locked out of its own admin panel.
INSERT INTO roles (name, slug, description, is_system_role) VALUES
  ('Super Admin', 'super-admin', 'Full system access — manages users, roles, permissions, and every admin module.', true),
  ('Admin', 'admin', 'Operational access to admin modules; user management depends on assigned permissions.', false),
  ('Manager', 'manager', 'Access limited to the modules assigned via permissions.', false),
  ('Staff', 'staff', 'Limited, view-first access based on assigned permissions.', false),
  ('Coach', 'coach', 'Instructor access — view assigned classes, events, and the studio schedule.', false)
ON CONFLICT (slug) DO NOTHING;

-- Permission catalog. New modules are onboarded by adding rows here — no schema change needed.
INSERT INTO permissions (name, slug, module, description) VALUES
  ('View Dashboard', 'dashboard.view', 'dashboard', 'View the admin dashboard.'),
  ('View Reports', 'reports.view', 'reports', 'View reports and analytics.'),
  ('View Users', 'users.view', 'users', 'View admin-panel user accounts.'),
  ('Create Users', 'users.create', 'users', 'Invite/create admin-panel user accounts.'),
  ('Edit Users', 'users.edit', 'users', 'Edit admin-panel user details and status.'),
  ('Delete Users', 'users.delete', 'users', 'Delete admin-panel user accounts.'),
  ('Manage User Roles', 'users.manage_roles', 'users', 'Assign or change a user''s role.'),
  ('View Roles', 'roles.view', 'roles', 'View roles and their permissions.'),
  ('Create Roles', 'roles.create', 'roles', 'Create new roles.'),
  ('Edit Roles', 'roles.edit', 'roles', 'Edit role name/description/status.'),
  ('Delete Roles', 'roles.delete', 'roles', 'Delete non-system roles.'),
  ('Manage Role Permissions', 'roles.manage_permissions', 'roles', 'Change which permissions a role grants.'),
  -- Catalog modules
  ('View Classes', 'classes.view', 'classes', 'View the Classes catalog.'),
  ('Create Classes', 'classes.create', 'classes', 'Add new classes.'),
  ('Edit Classes', 'classes.edit', 'classes', 'Edit existing classes.'),
  ('Delete Classes', 'classes.delete', 'classes', 'Delete classes.'),
  ('View Categories', 'categories.view', 'categories', 'View the Categories catalog.'),
  ('Create Categories', 'categories.create', 'categories', 'Add new categories.'),
  ('Edit Categories', 'categories.edit', 'categories', 'Edit existing categories.'),
  ('Delete Categories', 'categories.delete', 'categories', 'Delete categories.'),
  ('View Levels', 'levels.view', 'levels', 'View the Levels catalog.'),
  ('Create Levels', 'levels.create', 'levels', 'Add new levels.'),
  ('Edit Levels', 'levels.edit', 'levels', 'Edit existing levels.'),
  ('Delete Levels', 'levels.delete', 'levels', 'Delete levels.'),
  ('View Locations', 'locations.view', 'locations', 'View the Locations catalog.'),
  ('Create Locations', 'locations.create', 'locations', 'Add new locations.'),
  ('Edit Locations', 'locations.edit', 'locations', 'Edit existing locations.'),
  ('Delete Locations', 'locations.delete', 'locations', 'Delete locations.'),
  ('View Discounts', 'discounts.view', 'discounts', 'View the Discount Master.'),
  ('Create Discounts', 'discounts.create', 'discounts', 'Add new discounts.'),
  ('Edit Discounts', 'discounts.edit', 'discounts', 'Edit existing discounts.'),
  ('Delete Discounts', 'discounts.delete', 'discounts', 'Delete discounts.'),
  ('View Plans', 'plans.view', 'plans', 'View pricing plans.'),
  ('Create Plans', 'plans.create', 'plans', 'Add new pricing plans.'),
  ('Edit Plans', 'plans.edit', 'plans', 'Edit plan prices, details and active status.'),
  ('Delete Plans', 'plans.delete', 'plans', 'Delete pricing plans.'),
  -- Manage modules
  ('View Events & Workshops', 'events.view', 'events', 'View events and workshops, their media and registrants.'),
  ('Create Events & Workshops', 'events.create', 'events', 'Create new events/workshops.'),
  ('Edit Events & Workshops', 'events.edit', 'events', 'Edit events/workshops, including media.'),
  ('Delete Events & Workshops', 'events.delete', 'events', 'Delete events/workshops.'),
  ('View Book on Behalf', 'book_on_behalf.view', 'book_on_behalf', 'Access the Book on Behalf page.'),
  ('Create Bookings on Behalf', 'book_on_behalf.create', 'book_on_behalf', 'Book a class/workshop/studio session on behalf of a student.'),
  ('View Studio Bookings', 'studio.view', 'studio', 'View studio bookings and the studio calendar.'),
  ('Create Studio Bookings', 'studio.create', 'studio', 'Book studio slots on behalf of a student.'),
  ('Edit Studio Bookings', 'studio.edit', 'studio', 'Block/unblock studio slots.'),
  ('Delete Studio Bookings', 'studio.delete', 'studio', 'Remove studio blocks/bookings.'),
  ('View Payments', 'payments.view', 'payments', 'View payments and payment status.'),
  ('View Enquiries', 'enquiries.view', 'enquiries', 'View demo/enquiry leads.'),
  ('Edit Enquiries', 'enquiries.edit', 'enquiries', 'Update enquiry status.'),
  ('View Announcements', 'announcements.view', 'announcements', 'View admin-managed announcements.'),
  ('Create Announcements', 'announcements.create', 'announcements', 'Post new announcements.'),
  ('Edit Announcements', 'announcements.edit', 'announcements', 'Edit announcements.'),
  ('Delete Announcements', 'announcements.delete', 'announcements', 'Delete announcements.'),
  -- Settings
  ('View Portal Settings', 'settings.view', 'settings', 'View portal-wide settings.'),
  ('Edit Portal Settings', 'settings.edit', 'settings', 'Change portal-wide settings (studio rate, purposes, demo class types).')
ON CONFLICT (slug) DO NOTHING;

-- Super Admin: every permission in the catalog, always (idempotent — re-run safe, and covers
-- any permission added after this seed first ran).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'super-admin'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Admin: full operational access to every catalog/manage module, plus user management short of
-- deleting/managing roles or deleting users.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'admin'
  AND (
    p.slug IN ('dashboard.view','reports.view','users.view','users.create','users.edit','users.manage_roles','roles.view')
    OR p.module IN ('classes','categories','levels','locations','discounts','plans','events','book_on_behalf','studio','payments','enquiries','announcements','settings')
  )
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Manager: view + edit across operational modules (no create/delete, no user/role management).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'manager'
  AND (
    p.slug IN ('dashboard.view','reports.view','users.view','users.edit','book_on_behalf.view','book_on_behalf.create')
    OR (p.module IN ('classes','categories','levels','locations','discounts','plans','events','studio','enquiries','announcements') AND p.slug LIKE '%.view')
    OR (p.module IN ('classes','categories','levels','locations','discounts','plans','events','studio','enquiries','announcements') AND p.slug LIKE '%.edit')
    OR p.slug IN ('payments.view','settings.view')
  )
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Staff: dashboard only, by default. Admins can grant more via Roles & Permissions.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'staff'
  AND p.slug IN ('dashboard.view')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Coach: their own schedule-related views only — classes, events/workshops, studio, dashboard.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.slug = 'coach'
  AND p.slug IN ('dashboard.view','classes.view','events.view','studio.view')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id);

-- Backfill: any existing admin-role user with no roleId yet becomes Super Admin, preserving
-- their current full access exactly (zero regression for the account already in use).
UPDATE users SET role_id = (SELECT id FROM roles WHERE slug = 'super-admin')
WHERE role = 'admin' AND role_id IS NULL;

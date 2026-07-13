-- ABOVE CUTZ — Supabase schema
-- Run this in the Supabase SQL editor for your project.

-- ─────────────────────────────
-- SERVICES (editable from admin dashboard)
-- ─────────────────────────────
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10,2) not null,
  duration_minutes int not null default 30,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────
-- BUSINESS HOURS (per weekday, editable later)
-- 0 = Sunday ... 6 = Saturday
-- ─────────────────────────────
create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  weekday int not null unique check (weekday between 0 and 6),
  is_open boolean not null default true,
  open_time time,
  close_time time
);

insert into business_hours (weekday, is_open, open_time, close_time) values
  (0, false, null, null),
  (1, true, '09:00', '19:00'),
  (2, true, '09:00', '19:00'),
  (3, true, '09:00', '19:00'),
  (4, true, '09:00', '19:00'),
  (5, true, '09:00', '19:00'),
  (6, true, '09:00', '19:00')
on conflict (weekday) do nothing;

-- ─────────────────────────────
-- BLOCKED SLOTS (barber's day off, breaks, holidays)
-- ─────────────────────────────
create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references services(id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed' check (status in ('confirmed','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_date on appointments(appointment_date);

-- ─────────────────────────────
-- MEDIA (gallery photos + videos, uploaded via admin dashboard)
-- Actual files live in Supabase Storage bucket "media"
-- ─────────────────────────────
create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  file_url text not null,
  file_type text not null check (file_type in ('image','video')),
  section text not null default 'gallery' check (section in ('gallery','hero')),
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────
-- SHOP SETTINGS (single row: name, address, phone, socials)
-- ─────────────────────────────
create table if not exists shop_settings (
  id int primary key default 1,
  shop_name text not null default 'Above Cutz',
  address text,
  phone text,
  whatsapp text,
  instagram text,
  logo_url text,
  check (id = 1)
);

insert into shop_settings (id, shop_name) values (1, 'Above Cutz')
on conflict (id) do nothing;

-- ─────────────────────────────
-- ADMIN AUTH
-- Use Supabase Auth (email/password) for the single barber/admin account.
-- No separate table needed — create the user in Supabase Auth dashboard.
-- ─────────────────────────────

-- ─────────────────────────────
-- ROW LEVEL SECURITY
-- Public can READ services/media/settings/hours, and INSERT appointments.
-- Only authenticated admin can write everything else.
-- ─────────────────────────────
alter table services enable row level security;
alter table business_hours enable row level security;
alter table blocked_slots enable row level security;
alter table appointments enable row level security;
alter table media enable row level security;
alter table shop_settings enable row level security;

create policy "public read services" on services for select using (true);
create policy "public read hours" on business_hours for select using (true);
create policy "public read blocked" on blocked_slots for select using (true);
create policy "public read media" on media for select using (true);
create policy "public read settings" on shop_settings for select using (true);

create policy "public insert appointments" on appointments for insert with check (true);
create policy "public read own-day appointments" on appointments for select using (true);
-- (select needed publicly so the booking page can compute already-taken slots)

create policy "admin full access services" on services for all using (auth.role() = 'authenticated');
create policy "admin full access hours" on business_hours for all using (auth.role() = 'authenticated');
create policy "admin full access blocked" on blocked_slots for all using (auth.role() = 'authenticated');
create policy "admin full access appointments" on appointments for update using (auth.role() = 'authenticated');
create policy "admin delete appointments" on appointments for delete using (auth.role() = 'authenticated');
create policy "admin full access media" on media for all using (auth.role() = 'authenticated');
create policy "admin full access settings" on shop_settings for all using (auth.role() = 'authenticated');

-- ─────────────────────────────
-- STORAGE BUCKET
-- Create a public bucket named "media" in Supabase Storage (dashboard UI),
-- then allow authenticated uploads via storage policy:
-- Policy: authenticated users can insert/update/delete in "media" bucket.
-- Public can select (read) from "media" bucket.
-- ─────────────────────────────

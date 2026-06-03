-- ============================================================
-- GO DOC — Supabase schema
-- Run this whole file once in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE where possible.
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- 1. PROFILES — links auth.users to a role (admin / doctor)
-- ----------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  full_name   text,
  role        text not null check (role in ('admin','doctor')) default 'doctor',
  doctor_id   bigint,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 2. DOCTORS
-- ----------------------------------------------------------------
create table if not exists public.doctors (
  id          bigserial primary key,
  user_id     uuid unique references auth.users(id) on delete set null,
  name        text not null,
  spec        text,
  zones       jsonb not null default '[]'::jsonb,
  slots       jsonb not null default '[]'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 3. PATIENTS
-- ----------------------------------------------------------------
create table if not exists public.patients (
  id              bigserial primary key,
  name            text not null,
  phone           text,
  complaint       text,
  history         text,
  files           jsonb not null default '[]'::jsonb,
  zone            text,
  loc_text        text,
  loc_url         text,
  dx              jsonb,
  status          text not null default 'lead',
  doctor          text default '—',
  payment         text default 'Pending',
  status_history  jsonb not null default '[]'::jsonb,
  discharge       jsonb,
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 4. VISITS
-- ----------------------------------------------------------------
create table if not exists public.visits (
  id           bigserial primary key,
  patient_id   bigint not null references public.patients(id) on delete cascade,
  doctor_name  text,
  type         text not null default 'Treatment',
  time         text,
  date         text,
  status       text not null default 'scheduled',
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 5. NOTES (session notes / assessments)
-- ----------------------------------------------------------------
create table if not exists public.notes (
  id            bigserial primary key,
  patient_id    bigint not null references public.patients(id) on delete cascade,
  patient_name  text,
  doctor_name   text,
  visit_id      bigint,
  type          text,
  date          text,
  pain_before   int,
  pain_after    int,
  response      text,
  exercises     jsonb not null default '[]'::jsonb,
  modalities    jsonb not null default '[]'::jsonb,
  dx            jsonb,
  plan          text,
  next_session_date text,
  red_flag      boolean default false,
  red_flag_note text,
  state         text not null default 'submitted',
  opened_at     timestamptz,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 6. EXERCISE LIBRARY
-- ----------------------------------------------------------------
create table if not exists public.exercises (
  id           bigserial primary key,
  name         text not null,
  dosage_hint  text,
  position     text,
  description  text,
  notes        text,
  media_url    text,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 7. MODALITIES
-- ----------------------------------------------------------------
create table if not exists public.modalities (
  id      bigserial primary key,
  name    text not null,
  params  text
);

-- ----------------------------------------------------------------
-- 8. FINANCES (billing entries)
-- ----------------------------------------------------------------
create table if not exists public.finances (
  id          bigserial primary key,
  date        text,
  doctor      text,
  patient     text,
  type        text,
  fee         numeric,
  pct         numeric,
  status      text default 'Pending',
  method      text default 'Cash',
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- 9. CONFIG — single row
-- ----------------------------------------------------------------
create table if not exists public.config (
  id            int primary key default 1,
  default_fee   numeric not null default 500,
  default_pct   numeric not null default 0.6,
  currency      text not null default 'EGP',
  constraint single_row check (id = 1)
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- ----------------------------------------------------------------
-- 10. NOTIFICATIONS
-- ----------------------------------------------------------------
create table if not exists public.notifications (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  target      text not null check (target in ('admin','doctor')),
  "to"        text,
  text        text not null,
  read        boolean not null default false
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.doctors       enable row level security;
alter table public.patients      enable row level security;
alter table public.visits        enable row level security;
alter table public.notes         enable row level security;
alter table public.exercises     enable row level security;
alter table public.modalities    enable row level security;
alter table public.finances      enable row level security;
alter table public.config        enable row level security;
alter table public.notifications enable row level security;

-- helper: get role of current user
create or replace function public.current_role_of() returns text language sql stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---- PROFILES ----
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select
  using (auth.uid() = id or public.current_role_of() = 'admin');

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all
  using (public.current_role_of() = 'admin')
  with check (public.current_role_of() = 'admin');

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert
  with check (auth.uid() = id);

-- ---- generic: authenticated users can read everything (admins & doctors collaborate) ----
-- (Tighten later if patient PHI segregation is needed.)
do $$
declare t text;
begin
  for t in select unnest(array['doctors','patients','visits','notes','exercises','modalities','finances','config','notifications'])
  loop
    execute format('drop policy if exists "auth read %1$s" on public.%1$s;', t);
    execute format('create policy "auth read %1$s" on public.%1$s for select using (auth.uid() is not null);', t);
  end loop;
end$$;

-- ---- writes: admins can do everything, doctors limited ----
-- Doctors: insert notes & visits, update their own slots & finance status
drop policy if exists "admin all doctors" on public.doctors;
create policy "admin all doctors" on public.doctors for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

drop policy if exists "doctor update own slots" on public.doctors;
create policy "doctor update own slots" on public.doctors for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "admin all patients" on public.patients;
create policy "admin all patients" on public.patients for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

drop policy if exists "doctor update patients" on public.patients;
create policy "doctor update patients" on public.patients for update
  using (public.current_role_of() in ('admin','doctor'))
  with check (public.current_role_of() in ('admin','doctor'));

drop policy if exists "auth all visits" on public.visits;
create policy "auth all visits" on public.visits for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "auth all notes" on public.notes;
create policy "auth all notes" on public.notes for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "admin all exercises" on public.exercises;
create policy "admin all exercises" on public.exercises for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

drop policy if exists "admin all modalities" on public.modalities;
create policy "admin all modalities" on public.modalities for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

drop policy if exists "admin all finances" on public.finances;
create policy "admin all finances" on public.finances for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

drop policy if exists "auth insert finances" on public.finances;
create policy "auth insert finances" on public.finances for insert
  with check (auth.uid() is not null);

drop policy if exists "admin all config" on public.config;
create policy "admin all config" on public.config for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

drop policy if exists "auth all notifications" on public.notifications;
create policy "auth all notifications" on public.notifications for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'doctor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- SEED DATA (optional — comment out if not wanted)
-- ============================================================
insert into public.doctors (name, spec, zones, slots, files) values
 ('Dr. Layla','Ortho / Neuro','["Maadi","Zamalek","Dokki"]','["Sun-09:00","Sun-11:00","Tue-09:00","Tue-13:00","Thu-09:00"]','["MSK protocol.pdf"]'),
 ('Dr. Tarek','Sports / MSK','["Heliopolis (Masr El Gedida)","Nasr City"]','["Mon-11:00","Wed-11:00","Wed-13:00"]','[]'),
 ('Dr. Nour','Geriatric / Neuro','["6th October","Dokki","Giza Square"]','["Sat-09:00","Sat-11:00","Tue-13:00","Tue-15:00"]','["Stroke rehab.pdf"]')
on conflict do nothing;

insert into public.exercises (name, dosage_hint, position, description, notes) values
 ('Retrograde edema massage','10 min','Supine, legs elevated','Strokes foot → ankle → calf to assist venous return','Use after surgery, before active work'),
 ('Towel calf stretch (knee straight)','3 × 30s','Long sitting','Gastrocnemius stretch via towel around forefoot','Gentle — no forcing'),
 ('Nerve gliding (tibial)','2 × 10','Sitting, knee extended','Sliding technique','Stop if sharp electric pain'),
 ('Gait re-education','10 min','Standing','Conscious heel → flat → toe pattern','')
on conflict do nothing;

insert into public.modalities (name, params) values
 ('Therapeutic ultrasound','1MHz · 1.5 w/cm² · 5min'),
 ('TENS','80–100Hz · 20min'),
 ('Hot pack','15–20min'),
 ('Cryotherapy','10–15min')
on conflict do nothing;

-- ============================================================
-- HOW TO SEED YOUR ADMIN USER
-- ============================================================
-- 1. In Supabase Auth → Add user → enter your email + password.
-- 2. Copy the new user's UUID from the Authentication → Users table.
-- 3. Run (replacing the UUID):
--    update public.profiles set role = 'admin' where id = 'YOUR-UUID-HERE';
-- ============================================================

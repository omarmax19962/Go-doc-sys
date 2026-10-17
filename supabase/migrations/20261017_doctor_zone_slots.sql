-- Per-zone availability for doctors.
-- Optional override of the general weekly `slots` template, keyed by zone:
--   { "Maadi": ["Mon-11:00"], "Nasr City": ["Mon-13:00", "Wed-13:00"] }
-- A zone with no entry (or an empty array) falls back to the general `slots`.
alter table public.doctors
  add column if not exists zone_slots jsonb not null default '{}'::jsonb;

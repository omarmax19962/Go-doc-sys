-- ============================================================
-- GO DOC — aggressive doctor alerts
-- Run once in the Supabase SQL editor (safe to re-run).
-- Needs: schema.sql already applied (uses current_role_of(), doctors.user_id).
-- ============================================================

-- The alert ledger: one row per "thing a doctor must do". The alert-dispatch edge
-- function creates rows when a duty appears, pings on a ladder, and resolves the row
-- when reality changes (booking answered, session logged). See docs/alerts-and-coverage.md.
create table if not exists public.doctor_alerts (
  id               bigserial primary key,
  doctor_name      text not null,
  kind             text not null check (kind in ('booking_confirm','session_soon','session_log')),
  severity         text not null default 'high' check (severity in ('critical','high','normal')),
  dedupe_key       text not null unique,            -- one alert per duty, ever (no re-spam loops)
  meta             jsonb not null default '{}'::jsonb,
  status           text not null default 'open' check (status in ('open','resolved','expired')),
  attempts         int  not null default 0,         -- pings sent so far
  max_attempts     int  not null default 5,
  grace_min        int  not null default 5,         -- how long an ack silences pings
  ack_resolves     boolean not null default false,  -- heads-up alerts close on ack
  deadline_at      timestamptz,                     -- hard deadline (booking hold expiry)
  next_attempt_at  timestamptz not null default now(),
  last_sent_at     timestamptz,
  acked_at         timestamptz,
  escalated_at     timestamptz,                     -- admin was told
  resolved_at      timestamptz,
  resolved_reason  text,
  created_at       timestamptz not null default now()
);
create index if not exists doctor_alerts_due_idx  on public.doctor_alerts (next_attempt_at) where status = 'open';
create index if not exists doctor_alerts_doc_idx  on public.doctor_alerts (doctor_name)     where status = 'open';

-- Assumed shape of push_subscriptions (already created by the Web Push rollout).
-- No-op if it exists; documented here because alert-dispatch reads role/identity/endpoint/p256dh/auth.
create table if not exists public.push_subscriptions (
  id          bigserial primary key,
  role        text not null,
  identity    text,
  endpoint    text unique not null,
  p256dh      text,
  auth        text,
  user_agent  text,
  updated_at  timestamptz default now()
);

-- ---- RLS: doctors read their own alerts, admins read all. Writes go through the
-- ---- functions below / the service role only — a client can't edit or delete an alert.
alter table public.doctor_alerts enable row level security;
drop policy if exists "doctor_alerts read" on public.doctor_alerts;
create policy "doctor_alerts read" on public.doctor_alerts for select using (
  public.current_role_of() = 'admin'
  or doctor_name in (select name from public.doctors where user_id = auth.uid())
);

-- ---- ACK ("On it"): silence pings for grace_min, or close a heads-up alert.
-- ---- Never resolves a real duty — only the condition clearing does.
create or replace function public._ack_alert(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.doctor_alerts set
    acked_at        = now(),
    status          = case when ack_resolves then 'resolved' else status end,
    resolved_at     = case when ack_resolves then now() else resolved_at end,
    resolved_reason = case when ack_resolves then 'acked' else resolved_reason end,
    next_attempt_at = greatest(next_attempt_at, now() + make_interval(mins => grace_min))
  where id = p_id and status = 'open';
$$;
revoke all on function public._ack_alert(bigint) from public, anon, authenticated;  -- service role only (alert-ack function)

create or replace function public.ack_doctor_alert(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.doctor_alerts a
    where a.id = p_id and (
      public.current_role_of() = 'admin'
      or a.doctor_name in (select name from public.doctors where user_id = auth.uid()))
  ) then raise exception 'not allowed'; end if;
  perform public._ack_alert(p_id);
end $$;
grant execute on function public.ack_doctor_alert(bigint) to authenticated;

-- ---- realtime: the app shows the takeover the instant an alert is created/pinged
do $$ begin
  alter publication supabase_realtime add table public.doctor_alerts;
exception when duplicate_object then null; end $$;

-- ============================================================
-- SCHEDULER — run AFTER deploying the edge functions + setting their secrets.
-- Calls alert-dispatch every minute. Replace the two placeholders, then run:
--
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   select cron.schedule('doctor-alerts-every-minute', '* * * * *', $$
--     select net.http_post(
--       url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/alert-dispatch',
--       headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--       body    := '{}'::jsonb) $$);
--
-- Stop it any time:  select cron.unschedule('doctor-alerts-every-minute');
-- ============================================================

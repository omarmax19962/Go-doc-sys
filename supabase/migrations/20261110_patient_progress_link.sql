-- Patient Progress Link (v0): a private, no-login page we send to a patient.
-- Public reads go ONLY through the SECURITY DEFINER function below, which returns
-- a whitelisted DTO — anon never touches the patient tables directly.

-- 1) progress track per patient (null = auto-detect from diagnosis in the UI)
alter table public.patients
  add column if not exists progress_track text check (progress_track in ('pain','function'));

-- 2) neuro "general progress / independence" %, captured per session
alter table public.notes
  add column if not exists progress_pct int check (progress_pct between 0 and 100);

-- 3) share links — one live link per patient
create table if not exists public.patient_share_links (
  id             uuid primary key default gen_random_uuid(),
  patient_id     bigint not null references public.patients(id) on delete cascade,
  token          text not null unique,
  created_by     uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  last_viewed_at timestamptz,
  view_count     int not null default 0
);
create unique index if not exists one_live_link_per_patient
  on public.patient_share_links(patient_id) where revoked_at is null;

alter table public.patient_share_links enable row level security;
drop policy if exists "admin all share links" on public.patient_share_links;
create policy "admin all share links" on public.patient_share_links for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

-- 4) public read function — whitelisted DTO only, bumps view count
create or replace function public.patient_progress(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.patient_share_links;
  v_p    public.patients;
begin
  select * into v_link from public.patient_share_links
    where token = p_token and revoked_at is null;
  if not found then return null; end if;

  update public.patient_share_links
    set view_count = view_count + 1, last_viewed_at = now()
    where id = v_link.id;

  select * into v_p from public.patients where id = v_link.patient_id;
  if not found then return null; end if;

  return jsonb_build_object(
    'firstName', split_part(coalesce(v_p.name,''),' ',1),
    'gender',    v_p.gender,
    'diagnosis', case when jsonb_typeof(v_p.dx) = 'object' then v_p.dx->>'label' else null end,
    'physio',    nullif(v_p.doctor,'—'),
    'status',    v_p.status,
    'track',     v_p.progress_track,
    'nextVisit', (
      select jsonb_build_object('date', vi.date, 'time', vi.time, 'physio', vi.doctor_name)
      from public.visits vi
      where vi.patient_id = v_p.id
        and vi.status in ('scheduled','confirmed')
        and vi.date is not null
        and vi.date >= to_char((now() at time zone 'Africa/Cairo'),'YYYY-MM-DD')
      order by vi.date asc, vi.time asc nulls last
      limit 1
    ),
    'nextNoteDate', (
      select n.next_session_date from public.notes n
      where n.patient_id = v_p.id and n.next_session_date is not null
      order by n.date desc nulls last, n.created_at desc limit 1
    ),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
          'date',     n.date,
          'type',     n.type,
          'pain',     n.pain_before,
          'progress', n.progress_pct,
          'note',     n.patient_summary_ar
        ) order by n.date asc, n.created_at asc)
      from public.notes n
      where n.patient_id = v_p.id and n.date is not null
    ), '[]'::jsonb),
    'updatedAt', (select max(n.created_at) from public.notes n where n.patient_id = v_p.id)
  );
end;
$$;

revoke all on function public.patient_progress(text) from public;
grant execute on function public.patient_progress(text) to anon, authenticated;

-- Patient Progress Link v0.2 — full session transparency.
-- The patient page now opens each session in a detail sheet showing everything
-- the doctor documented. This replaces patient_progress() so its sessions[]
-- carries the full (clinically shareable) note, not just the plain summary.
--
-- Deliberately EXCLUDED: red_flag / red_flag_note — an internal clinical safety
-- alert, not patient-facing. Everything else the doctor wrote is returned.

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
          'date',        n.date,
          'type',        n.type,
          'pain',        n.pain_before,          -- kept for the pain chart/chip
          'painBefore',  n.pain_before,
          'painAfter',   n.pain_after,
          'progress',    n.progress_pct,         -- kept for the independence chart/chip
          'response',    n.response,
          'doctor',      nullif(n.doctor_name,'—'),
          'exercises',   n.exercises,
          'modalities',  n.modalities,
          'subjective',  n.subjective,
          'objective',   n.objective,
          'measures',    n.measures,
          'assessment',  n.assessment,
          'goals',       n.goals,
          'hep',         n.hep,
          'education',   n.education,
          'additionalNotes', n.additional_notes,
          'plan',        n.plan,
          'summary',     n.patient_summary_ar,   -- plain-language summary
          'note',        n.patient_summary_ar    -- kept for backward compatibility
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

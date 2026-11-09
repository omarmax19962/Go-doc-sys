-- Let doctors add patients (not just admins).
-- Previously doctors could only UPDATE patients; INSERT was admin-only, so the
-- doctor "New patient" flow was blocked by RLS. This allows doctor-or-admin inserts.
drop policy if exists "doctor insert patients" on public.patients;
create policy "doctor insert patients" on public.patients for insert
  with check (public.current_role_of() in ('admin','doctor'));

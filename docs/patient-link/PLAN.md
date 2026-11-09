# Go Doc — Patient Progress Link (v0, minimal) — plan for THIS app

Adapted to the real stack: **Vite + React SPA** (`src/App.jsx`), **Supabase** `glsqdguyraqaglmfavfv`
(anon key + RLS), deployed on **Vercel → go-doc-sys.vercel.app**. No Next.js, no SSR, no next-intl.
(The original spec was written for a Next.js app that doesn't exist here — this replaces it.)

## What we're building
A private, no-login web page we generate per patient and send on WhatsApp. It shows the patient:
1. **Next session** (date/time + physio).
2. **Sessions done** — each logged session counts as done (list of dates).
3. **Progress over time:**
   - **Ortho / pain track:** `pain_before` across sessions as a line chart + headline ("الألم نزل من 7 لـ 3").
   - **Neuro / function track:** a single **general-progress %** per session as a line chart + headline ("مستواك اتحسن من 25% لـ 55%").
4. An optional **doctor message** (reuses the existing patient-facing note).

Deliberately tiny. No patient login, no booking from the page, no goals system, no new heavy deps.

## Architecture (fits a client-only SPA — no server)
The public page can't read patient data with the anon key (RLS blocks it) and we have no Node server.
So the public read goes through **one Postgres `SECURITY DEFINER` function**, not a broad RLS hole and not an edge function:

- `public.patient_progress(p_token text) returns jsonb` — runs as definer, validates the token,
  bumps `view_count`/`last_viewed_at` (skipping link-preview bots), and returns a **whitelisted DTO only**.
  `grant execute on function public.patient_progress(text) to anon;`
- The public React page calls `supabase.rpc('patient_progress', { p_token })`. Nothing else is exposed to anon.

**Routing:** mirror the existing `isBookingRoute()` pattern (which renders `<PublicBooking/>` for `/book`
with no auth). Add `/p/:token` → render `<PatientProgress token=.../>` before `<AuthedApp/>`.
The SPA already serves all paths as index.html on Vercel, so `/p/<token>` loads the app.

## Data model (one migration — needs applying via your Supabase token, like the policy)
```sql
-- 1. track per patient (nullable = auto-detect from diagnosis in the UI)
alter table public.patients
  add column if not exists progress_track text check (progress_track in ('pain','function'));

-- 2. neuro general-progress %, captured per session
alter table public.notes
  add column if not exists progress_pct int check (progress_pct between 0 and 100);

-- 3. share links (one live link per patient)
create table if not exists public.patient_share_links (
  id uuid primary key default gen_random_uuid(),
  patient_id bigint not null references public.patients(id) on delete cascade,
  token text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count int not null default 0
);
create unique index if not exists one_live_link_per_patient
  on public.patient_share_links(patient_id) where revoked_at is null;
alter table public.patient_share_links enable row level security;
-- admins manage links; anon has NO direct table access (reads go through the function only)
create policy "admin all share links" on public.patient_share_links for all
  using (public.current_role_of() = 'admin') with check (public.current_role_of() = 'admin');

-- 4. the public read function (whitelisted DTO) + grant to anon  [full body in the migration file]
```

**Track auto-detection** (in UI, when `patients.progress_track` is null): diagnosis label matches
neuro keywords (`CIDP, stroke, hemipleg, parkinson, neuro, GBS, MS, demyelinat, spinal cord, paraplegi, quadripleg, palsy`)
→ `function`; otherwise → `pain`. Admin can override with a 2-option toggle.

## Doctor sheet change (minimal)
In the session Logger (`Logger` in App.jsx):
- **Pain track:** nothing new — `pain_before`/`pain_after` are already captured.
- **Function track (neuro):** add ONE control — a **"General progress / independence"** slider (0–100%),
  saved to `notes.progress_pct`. Prefilled from the last session's value. ~5 seconds, one drag.
- A tiny 👁 "patient sees this" hint next to pain / progress and the patient-note field.

## Admin: generate + send
On the patient profile (admin), a **"رابط المريض / Patient link"** button → modal:
- No link → **Create link** (inserts token).
- Live link → copy · **WhatsApp send** · preview · **revoke & regenerate** (confirm).
- WhatsApp: `https://wa.me/<E.164>?text=...`, Egyptian normalisation `01xxxxxxxxx → 201xxxxxxxxx`.
  Arabic message, first name only.
- If track not set → inline toggle first. If no phone → WhatsApp disabled, copy only.

## Public page (`/p/:token`) — Arabic RTL, mobile, IBM Plex Sans Arabic, teal palette
Header (logo + AR/EN toggle + "آخر تحديث") · greeting (first name) · next-session card
(النهارده/بكرة, physio) · progress card (chart + headline per track) · "الجلسات اللي خلصت (n)"
list (date + metric chip + patient note if any) · footer ("الصفحة دي خاصة بيك — متشاركهاش").
Gendered copy via `patients.gender`. SVG chart (no new dep), RTL = session 1 on the right.

## Privacy (must pass)
Function returns only: first name, diagnosis label, physio first name, status, track, next session,
and per session {n, date, pain_before OR progress_pct, patient note}. **Never** phone, address,
internal notes/SOAP, red flags, payment. Token = 32-char base64url. Revoked → generic 404. `noindex`.

## Test on a real patient (then you send)
Candidates found (active, lots of sessions):
- **Somaya** — Lower-limb weakness, 18 sessions, pain **9 → 2** → ideal **pain-track** demo.
- **Wessam** — right ankle/foot, 9 sessions, pain **7 → 0** → strong pain-track demo.
- **Omar Sami** — CIDP (neuro), 37 sessions → the **function-track** demo, but has **no** progress_pct yet
  (new field), so his page shows the "starting point" state until the doctor rates a session.

Plan: build → apply migration → deploy → generate a link via the real admin UI for **one pain-track
patient** (Somaya or Wessam — a compelling first send) → screenshot AR + EN → privacy-grep the HTML →
hand you the link + ready-to-paste WhatsApp text. **You send it, not me.**

## Rollout order
1. Migration SQL (you apply with your token — same one-command flow as the RLS policy).
2. Frontend: public route + page, admin link modal, doctor progress slider. Commit + push (Vercel).
3. Generate + screenshot + verify on the test patient. Report.

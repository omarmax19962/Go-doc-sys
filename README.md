# Go Doc — Patient & Doctor Management System

A React + Vite + Supabase app for managing physiotherapy patients, doctor schedules, session notes, and billing.

## Stack

- **Frontend**: React 19 + Vite + Tailwind v4
- **Backend**: Supabase (Postgres + Auth + Realtime + Edge Functions)
- **Hosting**: Vercel

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Supabase setup (one-time)

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run.
3. Go to **Authentication → Users → Add user**. Create your admin email + password.
4. Copy that user's UUID. In the SQL Editor, run:

   ```sql
   update public.profiles set role = 'admin' where id = 'YOUR-UUID-HERE';
   ```

5. Project Settings → API → copy **Project URL** and **anon public** key into `.env.local`.

### Doctor invites (optional but recommended)

To let admins invite doctors by email from the Doctors tab, deploy the Edge Function:

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy invite-doctor
```

The function uses the service-role key (auto-injected by Supabase) to send magic-link invites.

## Vercel deployment

1. Push to GitHub (see below).
2. Import the repo in Vercel → it auto-detects Vite.
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

## GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/omarmax19962/Go-doc-sys.git
git push -u origin main
```

## Project structure

```
src/
├── App.jsx                 # Main app — UI + role-aware screens
├── main.jsx                # Entry
├── lib/
│   ├── supabase.js         # Supabase client
│   ├── useAuth.js          # Auth hook (user, profile, role)
│   ├── useDataStore.js     # Data layer — loads all entities, exposes mutations
│   ├── db.js               # snake_case ↔ camelCase row mappers
│   └── invites.js          # Doctor invite wrapper
└── components/
    └── Login.jsx           # Email + password sign-in screen

supabase/
├── schema.sql              # Tables, RLS, triggers, seed
└── functions/
    └── invite-doctor/      # Edge function: admin-only doctor invite
        └── index.ts
```

## Roles

- **admin** — full access (all 7 tabs, doctor + finance management).
- **doctor** — visits, patients, availability only.

Role is read from `public.profiles.role` on login.

## Auth flow

- Admins are seeded via SQL (see step 4 above).
- Doctors are invited by admins from the Doctors tab → email with magic link.
- No public signup.

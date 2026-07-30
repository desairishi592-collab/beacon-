# Beacon

Risk monitoring for middle managers — starting with finance, more fields later.

Stack: Next.js (App Router), Supabase (auth + Postgres), deployed on Vercel.

## Setup

### 1. Create a Supabase project

Create a **new** Supabase project for Beacon (do not reuse APEX's project — separate user base, separate database).

### 2. Configure auth providers

In the Supabase dashboard, under **Authentication → Providers**:

- Enable **Email**, and under its settings turn **Confirm email** OFF (signups sign the user in immediately, no confirmation step, for now).
- Enable **Google** and **GitHub**, each with their own OAuth client ID/secret. Set the redirect URL for both to:
  `https://<your-project-ref>.supabase.co/auth/v1/callback`
- Add `http://localhost:3000/auth/callback` (and your production URL's equivalent) to **Authentication → URL Configuration → Redirect URLs**.

### 3. Run the database migration

Apply `supabase/migrations/0001_profiles.sql` — either paste it into the Supabase SQL editor, or via the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the `profiles` table (name, role, field, team_size, keyed to `auth.users.id`) with row-level security so users can only read/write their own row.

### 4. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from your Supabase project's API settings. The QuickBooks variables are placeholders for a follow-up — leave them blank for now.

### 5. Run it

```bash
npm install
npm run dev
```

## How auth + onboarding fit together

- `proxy.ts` (Next.js 16's renamed `middleware.ts`) refreshes the Supabase session on every request and redirects: signed-out users hitting `/dashboard` or `/onboarding` go to `/login`; signed-in users without a `profiles` row go to `/onboarding`; signed-in users with a profile are kept out of `/login` and `/onboarding`.
- `/onboarding` is a 4-step wizard (name → role → field → team size) with no skip option; the profile row is only written once all four are collected.
- `/dashboard` is a placeholder shell — QuickBooks connect and risk flags land in a follow-up.

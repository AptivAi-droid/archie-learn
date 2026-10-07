# Applying the Archie Learn database to Supabase

One SQL file builds or repairs the whole database: **`supabase/FULL_SETUP_FRESH_PROJECT.sql`**.
Every statement in it is idempotent, so you can run it on an empty project or on one that already has some or all of the old scripts applied.

## 1. Run the SQL

**Case A: the project was restored, or the old scripts were applied (or you don't know which ones were)**
1. Supabase Dashboard → your project → **SQL Editor** → New query.
2. Paste the **entire** contents of `supabase/FULL_SETUP_FRESH_PROJECT.sql` and click **Run**.
3. The last result grid should show `ok = true` on every row.

**Case B: a brand-new, empty project**
- Do the same as Case A, with the same file. Nothing else needs to run first.

You don't need to run `SUPABASE_SETUP.sql`, `SUPABASE_FIX_RLS.sql`, `SUPABASE_PHASE2.sql`, `SUPABASE_PHASE3.sql`, `SUPABASE_SEED_MORE.sql` or the files in `supabase/migrations/` on their own, because the full file already contains them in the correct order.

> If you edit any of those source files, regenerate `FULL_SETUP_FRESH_PROJECT.sql` so the two stay in sync.

## 2. Auth settings (Dashboard → Authentication)

- [ ] **URL Configuration → Site URL:** `https://aptivai-droid.github.io/archie-learn/`
- [ ] **URL Configuration → Redirect URLs** (add all three):
  - `https://aptivai-droid.github.io/archie-learn/**`
  - `https://aptivai-droid.github.io/archie-learn/dev/**`
  - `http://localhost:5173/**`
- [ ] **Sign In / Providers → Email → Confirm email:** **OFF** for the pilot. Before a public launch, configure custom SMTP (Resend/Postmark) and turn it back on.

## 3. Edge functions

Run these from the repo root with the Supabase CLI logged in. `<ref>` is the project ref from the dashboard URL.

```bash
supabase functions deploy chat mark vet-application --project-ref <ref>
supabase secrets set ANTHROPIC_API_KEY=... ALLOWED_ORIGIN=https://aptivai-droid.github.io --project-ref <ref>
```

## 4. Make yourself admin (once)

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where lower(email) = lower('<your admin email>'));
```

Run this in the SQL Editor after that user has signed up and finished their profile. The role-change guard allows edits from the SQL Editor and the service role, but it blocks users from changing their own role.

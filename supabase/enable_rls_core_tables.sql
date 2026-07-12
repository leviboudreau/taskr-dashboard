-- ─────────────────────────────────────────────────────────────────────────────
-- SECURITY FIX: lock down the core tables that were readable/writable by the
-- anonymous (publishable) API key — which ships in the deployed client bundle.
--
-- Audit found RLS was already ENABLED on these tables, but each carried a
-- leftover permissive policy ("Public access" / "allow all"): role `public`,
-- command ALL, USING (true) WITH CHECK (true). Because Postgres OR's policies
-- together, that single policy granted the world full access regardless of the
-- stricter authenticated policies. The fix is to drop those permissive policies.
--
-- This app authenticates every user before loading data (shared team model), so
-- the remaining `authenticated` policies keep the app fully working; only the
-- anonymous door closes.
--
-- Run once in the Supabase SQL editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Drop the wide-open "everyone" policies (the actual leak)
drop policy if exists "Public access" on public.calendar_events;
drop policy if exists "allow all"     on public.calendars;
drop policy if exists "Public access" on public.domains;
drop policy if exists "Public access" on public.projects;
drop policy if exists "Public access" on public.tasks;

-- 2) Ensure RLS is on and every table has an authenticated-only full-access policy.
--    (No-ops where already true; provides the sole policy for `calendars`.)
do $$
declare t text;
begin
  foreach t in array array['tasks','projects','domains','calendars','calendar_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_authenticated'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        t || '_authenticated', t
      );
    end if;
  end loop;
end $$;

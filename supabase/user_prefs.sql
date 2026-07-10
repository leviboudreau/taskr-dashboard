-- ─────────────────────────────────────────────────────────────────────────────
-- Per-user UI preferences (e.g. the Tasks page column layout / arrangement),
-- so a user's board layout follows them across devices instead of living only
-- in each browser's localStorage. One row per auth user; RLS restricts each
-- user to their own row. Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_prefs (
  user_id    uuid primary key,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_prefs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_prefs' and policyname = 'user_prefs_own'
  ) then
    create policy "user_prefs_own" on public.user_prefs for all
      to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

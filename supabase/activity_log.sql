-- ─────────────────────────────────────────────────────────────────────────────
-- Lightweight change history for compliance-relevant records (audits, qualifications
-- to start). One generic table rather than a per-entity log table — entity_id is
-- `text` (not a foreign key) so it works across both uuid and integer primary keys
-- and never gets blocked or cascade-affected by the row it's describing.
--
-- This does NOT auto-populate itself — nothing triggers on it yet. It's the schema
-- half of "a lightweight change history, given what this data actually is" (audits
-- carry CAPA/findings tracking — regulatory-flavored data where "who closed this
-- and when" can matter). The client-side write calls (one per status-changing
-- action: audit status transitions, qualification status transitions, etc.) are a
-- separate, contained follow-up once this table exists — ask for it once this has
-- been run.
--
-- Run once in the Supabase SQL editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,               -- 'audit' | 'qualification' | ...
  entity_id   text not null,               -- text, not a FK — see note above
  action      text not null,               -- e.g. 'status_changed', 'created', 'deleted'
  field       text,                        -- which field changed, if applicable (e.g. 'status')
  old_value   text,
  new_value   text,
  actor_email text,                        -- session.user.email at the time of the action
  actor_name  text,                        -- display name at the time of the action
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_entity_idx on public.activity_log (entity_type, entity_id, created_at desc);

alter table public.activity_log enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'activity_log'
      and policyname = 'activity_log_authenticated_all'
  ) then
    create policy "activity_log_authenticated_all"
      on public.activity_log for all
      to authenticated
      using (true) with check (true);
  end if;
end $$;

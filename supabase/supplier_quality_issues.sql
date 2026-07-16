-- ─────────────────────────────────────────────────────────────────────────────
-- Add "Supplier Quality Issues" as a first-class entity, mirroring the shape of
-- `escalations` (same columns, same RLS posture) so it can reuse the same
-- detail-popup / notes / attachments / drag-reorder UI patterns. Tasks can be
-- linked to an SQI the same way they're linked to an escalation.
-- Run once in the Supabase SQL editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.supplier_quality_issues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz,
  title text not null default '',
  status text default 'active',
  domain text default '',
  owners text[] default '{}',
  due text default '',
  priority text default '',
  color text default '',
  substatus text default '',
  notes jsonb default '[]',
  attachments jsonb default '[]',
  sort_order int default 0
);

alter table public.supplier_quality_issues enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'supplier_quality_issues'
      and policyname = 'supplier_quality_issues_authenticated'
  ) then
    create policy supplier_quality_issues_authenticated on public.supplier_quality_issues
      for all to authenticated using (true) with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'supplier_quality_issues'
  ) then
    alter publication supabase_realtime add table public.supplier_quality_issues;
  end if;
exception when duplicate_object then
  null; -- publication already covers all tables
end $$;

alter table public.tasks add column if not exists supplier_quality_issue_id uuid references public.supplier_quality_issues(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Qualification stage templates — a list of its own, separate from bundle
-- templates (qual_templates). Run this once in the Supabase SQL editor.
-- RLS mirrors qual_templates: authenticated users get full access.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.qualification_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  tasks      jsonb not null default '[]'::jsonb,   -- [{ title, subtasks:[string] }]
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.qualification_templates enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'qualification_templates'
      and policyname = 'qualification_templates_authenticated_all'
  ) then
    create policy "qualification_templates_authenticated_all"
      on public.qualification_templates for all
      to authenticated
      using (true) with check (true);
  end if;
end $$;

-- Carry over the real "Material Supplier Qualification" template from the bundle
-- templates (qual_templates) so qualifications start with your existing stages.
-- Idempotent: won't duplicate if it's already there.
insert into public.qualification_templates (name, tasks, sort_order)
select name, tasks, coalesce(sort_order, 0)
from public.qual_templates
where name = 'Material Supplier Qualification'
  and not exists (
    select 1 from public.qualification_templates where name = 'Material Supplier Qualification'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SAFETY NET (only if new qualifications fail to save): the `qualifications`
-- table must have RLS policies too. If it was created without them, uncomment:
--
-- alter table public.qualifications enable row level security;
-- create policy "qualifications_authenticated_all" on public.qualifications
--   for all to authenticated using (true) with check (true);
-- ─────────────────────────────────────────────────────────────────────────────

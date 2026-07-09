-- ─────────────────────────────────────────────────────────────────────────────
-- Note subgroups: give note_groups a self-referential parent_id.
-- A subgroup is just a note_groups row with parent_id set to its parent group.
-- Notes keep their single group_id (which may point at a group OR a subgroup).
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.note_groups
  add column if not exists parent_id uuid references public.note_groups(id) on delete cascade;

create index if not exists note_groups_parent_id_idx on public.note_groups(parent_id);

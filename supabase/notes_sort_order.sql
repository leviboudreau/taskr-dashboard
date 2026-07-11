-- ─────────────────────────────────────────────────────────────────────────────
-- Manual note ordering: add sort_order so notes can be drag-rearranged
-- (used by the "Manual" sort mode on the Notes page).
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notes
  add column if not exists sort_order integer not null default 0;

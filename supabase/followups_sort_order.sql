-- ─────────────────────────────────────────────────────────────────────────────
-- Follow-up item ordering: add sort_order so items can be rearranged up/down.
-- The app degrades gracefully without this (falls back to created_at order and
-- reordering just won't persist), so it's optional but needed for reordering.
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.follow_ups
  add column if not exists sort_order integer not null default 0;

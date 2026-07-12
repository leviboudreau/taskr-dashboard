-- ─────────────────────────────────────────────────────────────────────────────
-- Wire up the 'waiting' task status (already present in the app's STATUS_DOT
-- palette but never settable): who/what a waiting task is blocked on, and
-- when it started waiting (so the briefing can say "waiting 12 days").
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tasks add column if not exists waiting_on text default '';
alter table public.tasks add column if not exists waiting_since timestamptz;

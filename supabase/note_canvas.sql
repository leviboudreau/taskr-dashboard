-- ─────────────────────────────────────────────────────────────────────────────
-- Canvas notes: a second note type alongside the existing single-document notes.
-- A canvas note is still a plain notes row (same group/subgroup, search, trash,
-- activity log) — is_canvas just flags it, and canvas_boxes holds its free-form
-- boxes as a JSON array of { id, x, y, w, h, z, body }, mirroring how
-- notes.attachments already stores its list as JSON on the parent row rather
-- than a child table.
-- Run once in the Supabase SQL editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.notes add column if not exists is_canvas boolean not null default false;
alter table public.notes add column if not exists canvas_boxes jsonb not null default '[]'::jsonb;

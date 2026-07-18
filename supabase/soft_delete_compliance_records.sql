-- ─────────────────────────────────────────────────────────────────────────────
-- Soft-delete for compliance-relevant records: escalations, supplier_quality_issues,
-- audits, and notes currently hard-delete with no recovery path and no history —
-- risky for records that (per activity_log.sql) can matter for "who closed this
-- and when." Tasks already have a soft-delete convention (substatus:'canceled' +
-- a Trash panel); these four tables get an equivalent via a deleted_at column
-- since none of them has a spare status value that means "deleted."
--
-- Pairs with activity_log.sql (already run) — the app now also writes rows there
-- on delete/restore for these four tables.
-- Run once in the Supabase SQL editor. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.escalations add column if not exists deleted_at timestamptz;
alter table public.supplier_quality_issues add column if not exists deleted_at timestamptz;
alter table public.audits add column if not exists deleted_at timestamptz;
alter table public.notes add column if not exists deleted_at timestamptz;

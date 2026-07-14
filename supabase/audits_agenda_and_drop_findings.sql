-- ─────────────────────────────────────────────────────────────────────────────
-- 1) New "send agenda" reminder: a date the agenda was actually sent, so the app
--    can compute a live reminder ~20-30 calendar days before the scheduled audit
--    date and clear it once this is set.
-- 2) Findings (critical/major/minor/recommendation) are no longer tracked in the
--    app at all — dropped below. Confirmed against live data before writing this:
--    4 real audit rows exist today (Innophos, Gelita, KRONOS, Sensient) and every
--    findings_* value on all of them is 0, so there is nothing to lose. If that's
--    changed by the time you run this, the DROP COLUMN statements will still work
--    (they just discard whatever's there) — check first with:
--      select id, name, findings_critical, findings_major, findings_minor, findings_recommendation
--      from public.audits
--      where findings_critical > 0 or findings_major > 0 or findings_minor > 0 or findings_recommendation > 0;
--
-- Run once in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.audits
  add column if not exists agenda_sent_date date;

alter table public.audits
  drop column if exists findings_critical,
  drop column if exists findings_major,
  drop column if exists findings_minor,
  drop column if exists findings_recommendation;

import { addCalDays, calDaysBetween } from './dates.js'

// ─── Audit clock engine ─────────────────────────────────────────────────────
// Deliberately independent of computeSchedule: audits have a linear lifecycle, no dependency
// graph between stages, and their clocks run on calendar days (not business days). "Waiting on" per
// state lives in AUDIT_STATUSES; this only computes which clock (if any) is currently live and its
// days remaining/overdue. Clocks are computed on the fly from stored dates — nothing is stamped.
export function computeAuditClock(audit, todayISO) {
  let dueDate = null, label = null
  if (audit.status === 'pending_report' && audit.end_date) { dueDate = addCalDays(audit.end_date, 30); label = 'Report due' }
  else if (audit.status === 'pending_capa_response' && audit.report_issued_date) { dueDate = addCalDays(audit.report_issued_date, 30); label = 'CAPA response due' }
  else if (audit.status === 'capa_in_progress' && audit.capa_closure_due) { dueDate = audit.capa_closure_due; label = 'CAPA closure due' } // stored value, not derived
  // Agenda reminder: live once within 30 calendar days of the scheduled audit date, until sent. Due date
  // is 20 days out (the near edge of the "20-30 days before" window) — comfortably before it, then urgent
  // once inside it, danger once past it. Only relevant before the audit has actually started.
  else if (['to_schedule', 'scheduled'].includes(audit.status) && audit.start_date && !audit.agenda_sent_date) {
    const windowStart = addCalDays(audit.start_date, -30)
    if (todayISO >= windowStart) { dueDate = addCalDays(audit.start_date, -20); label = 'Agenda due' }
  }
  if (!dueDate) return null
  const daysRemaining = calDaysBetween(todayISO, dueDate)
  const tone = daysRemaining < 0 ? 'danger' : daysRemaining <= 5 ? 'warn' : 'normal'
  return { label, dueDate, daysRemaining, tone }
}
export const clockText = c => c ? (c.daysRemaining < 0 ? `${-c.daysRemaining}d overdue` : c.daysRemaining === 0 ? 'due today' : `${c.daysRemaining}d remaining`) : null
// Fuller phrasing for the audits list row, e.g. "Report 12 days overdue" / "CAPA response due in 6 days"
export const clockPhrase = c => {
  if (!c) return null
  const label = c.label.replace(/ due$/, '')
  if (c.daysRemaining < 0) return `${label} ${-c.daysRemaining} day${-c.daysRemaining === 1 ? '' : 's'} overdue`
  if (c.daysRemaining === 0) return `${label} due today`
  return `${label} due in ${c.daysRemaining} day${c.daysRemaining === 1 ? '' : 's'}`
}
// Urgency sort for the audits list: breached (most overdue first) > live (soonest first) >
// no clock but scheduled (soonest start_date first) > no clock, unscheduled (creation order).
export const auditUrgencyKey = (a, todayISO) => {
  const clock = computeAuditClock(a, todayISO)
  if (clock && clock.tone === 'danger') return [0, clock.daysRemaining]
  if (clock) return [1, clock.daysRemaining]
  if (a.start_date) return [2, a.start_date]
  return [3, a.created_at || '']
}
export const auditUrgencyCompare = todayISO => (a, b) => {
  const ka = auditUrgencyKey(a, todayISO), kb = auditUrgencyKey(b, todayISO)
  if (ka[0] !== kb[0]) return ka[0] - kb[0]
  return ka[0] <= 1 ? ka[1] - kb[1] : String(ka[1]).localeCompare(String(kb[1]))
}

// ─── Status auto-advance ────────────────────────────────────────────────────
// The timeline invites filling in the live step's date, which reasonably implies the audit has
// progressed — but status is a separate field with nothing keeping it in sync, so it was possible
// (and happened, twice, in production) to set report_issued_date and stay stuck in pending_report
// with the report clock still ticking. Order must stay in sync with AUDIT_STATUSES in App.jsx.
const AUDIT_STATUS_ORDER = ['to_schedule', 'scheduled', 'in_progress', 'pending_report', 'pending_capa_response', 'capa_in_progress', 'closed']
// response_received_date is deliberately absent — receiving a CAPA plan doesn't advance anything;
// approving it does. end_date only counts once it's actually arrived, not for a future-dated audit.
const AUDIT_STATUS_ADVANCE_RULES = [
  { dateField: 'end_date', target: 'pending_report', requireDateReached: true },
  { dateField: 'report_issued_date', target: 'pending_capa_response' },
  { dateField: 'response_approved_date', target: 'capa_in_progress' },
  { dateField: 'closed_date', target: 'closed' },
]
// Only ever advances — if the audit is already at or past every matched rule's target, returns the
// status unchanged, so correcting an earlier date (or clearing one) can never drag it backwards.
export function deriveAuditStatus(audit, todayISO) {
  const currentIdx = AUDIT_STATUS_ORDER.indexOf(audit.status)
  let targetIdx = currentIdx
  for (const rule of AUDIT_STATUS_ADVANCE_RULES) {
    const dateVal = audit[rule.dateField]
    if (!dateVal) continue
    if (rule.requireDateReached && dateVal > todayISO) continue
    const idx = AUDIT_STATUS_ORDER.indexOf(rule.target)
    if (idx > targetIdx) targetIdx = idx
  }
  return targetIdx > currentIdx ? AUDIT_STATUS_ORDER[targetIdx] : audit.status
}

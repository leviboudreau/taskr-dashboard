import { addCalDays, calDaysBetween } from './dates.js'

export const AUDIT_SEVERITIES = [
  { key: 'findings_critical',       abbr: 'C', color: '#991b1b' },
  { key: 'findings_major',          abbr: 'M', color: '#c2410c' },
  { key: 'findings_minor',          abbr: 'm', color: '#a16207' },
  { key: 'findings_recommendation', abbr: 'R', color: '#57534e' },
]

export function findingsSummary(a) {
  return AUDIT_SEVERITIES.map(s => ({ ...s, n: Number(a[s.key]) || 0 })).filter(s => s.n > 0)
}

// ─── Audit clock engine ─────────────────────────────────────────────────────
// Deliberately independent of computeSchedule: audits have a linear 7-state lifecycle, no dependency
// graph between stages, and their clocks run on calendar days (not business days). "Waiting on" per
// state lives in AUDIT_STATUSES; this only computes which clock (if any) is currently live and its
// days remaining/overdue. Clocks are computed on the fly from stored dates — nothing is stamped.
export function computeAuditClock(audit, todayISO) {
  let dueDate = null, label = null
  if (audit.status === 'pending_report' && audit.end_date) { dueDate = addCalDays(audit.end_date, 30); label = 'Report due' }
  else if (audit.status === 'pending_capa_response' && audit.report_issued_date) { dueDate = addCalDays(audit.report_issued_date, 30); label = 'CAPA response due' }
  else if (audit.status === 'capa_in_progress' && audit.capa_closure_due) { dueDate = audit.capa_closure_due; label = 'CAPA closure due' } // stored value, not derived
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

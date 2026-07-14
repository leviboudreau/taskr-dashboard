import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toISODate, fromISODate } from '../src/lib/dates.js'
import { computeAuditClock, clockPhrase, auditUrgencyCompare, findingsSummary } from '../src/lib/audits.js'

const TODAY = '2026-07-13'

describe('computeAuditClock', () => {
  test('no live clock outside the three clock-bearing statuses', () => {
    for (const status of ['to_schedule', 'scheduled', 'in_progress', 'closed']) {
      assert.equal(computeAuditClock({ status }, TODAY), null, `${status} -> no clock`)
    }
  })

  test('pending_report: due = end_date + 30 calendar days', () => {
    const c = computeAuditClock({ status: 'pending_report', end_date: '2026-06-20' }, TODAY)
    assert.equal(c.dueDate, '2026-07-20')
    assert.equal(c.daysRemaining, 7)
    assert.equal(c.tone, 'normal', 'outside the 5-day warn threshold')
    assert.equal(c.label, 'Report due')
  })
  test('pending_report without end_date has no clock, even though status matches', () => {
    assert.equal(computeAuditClock({ status: 'pending_report' }, TODAY), null)
  })
  test('an overdue report is tone danger', () => {
    const c = computeAuditClock({ status: 'pending_report', end_date: '2026-05-01' }, TODAY)
    assert.ok(c.daysRemaining < 0)
    assert.equal(c.tone, 'danger')
  })

  test('pending_capa_response: due = report_issued_date + 30 calendar days', () => {
    const c = computeAuditClock({ status: 'pending_capa_response', report_issued_date: '2026-06-01' }, TODAY)
    assert.equal(c.dueDate, '2026-07-01')
    assert.equal(c.daysRemaining, -12)
    assert.equal(c.tone, 'danger')
    assert.equal(c.label, 'CAPA response due')
  })
  test('response_received_date does not affect the clock (receiving a plan does not advance anything)', () => {
    const withReceived = computeAuditClock({ status: 'pending_capa_response', report_issued_date: '2026-06-01', response_received_date: '2026-07-10' }, TODAY)
    const withoutReceived = computeAuditClock({ status: 'pending_capa_response', report_issued_date: '2026-06-01' }, TODAY)
    assert.deepEqual(withReceived, withoutReceived)
  })

  test('capa_in_progress uses the stored capa_closure_due verbatim, not a derived date', () => {
    const c = computeAuditClock({ status: 'capa_in_progress', capa_closure_due: '2026-08-01' }, TODAY)
    assert.equal(c.dueDate, '2026-08-01')
    assert.equal(c.daysRemaining, 19)
    assert.equal(c.tone, 'normal')
  })
  test('capa_in_progress without capa_closure_due has no clock', () => {
    assert.equal(computeAuditClock({ status: 'capa_in_progress' }, TODAY), null)
  })

  test('tone thresholds: danger < 0, warn 0-5, normal 6+', () => {
    const plusDays = n => toISODate((() => { const d = fromISODate(TODAY); d.setDate(d.getDate() + n); return d })())
    assert.equal(computeAuditClock({ status: 'capa_in_progress', capa_closure_due: plusDays(5) }, TODAY).tone, 'warn')
    assert.equal(computeAuditClock({ status: 'capa_in_progress', capa_closure_due: plusDays(6) }, TODAY).tone, 'normal')
    const dueToday = computeAuditClock({ status: 'capa_in_progress', capa_closure_due: TODAY }, TODAY)
    assert.equal(dueToday.daysRemaining, 0)
    assert.equal(dueToday.tone, 'warn')
    const oneOverdue = computeAuditClock({ status: 'capa_in_progress', capa_closure_due: plusDays(-1) }, TODAY)
    assert.equal(oneOverdue.daysRemaining, -1)
    assert.equal(oneOverdue.tone, 'danger')
  })
})

describe('clockPhrase', () => {
  test('phrases overdue, due-today, and future clocks distinctly', () => {
    assert.equal(clockPhrase(computeAuditClock({ status: 'pending_report', end_date: '2026-05-01' }, TODAY)), 'Report 43 days overdue')
    assert.equal(clockPhrase(computeAuditClock({ status: 'capa_in_progress', capa_closure_due: '2026-07-16' }, TODAY)), 'CAPA closure due in 3 days')
    assert.equal(clockPhrase(computeAuditClock({ status: 'capa_in_progress', capa_closure_due: TODAY }, TODAY)), 'CAPA closure due today')
    assert.equal(clockPhrase(null), null)
  })
})

describe('auditUrgencyCompare', () => {
  test('sorts breached (most overdue first) > live (soonest first) > scheduled (soonest first) > unscheduled (creation order)', () => {
    const rows = [
      { id: 'A', status: 'pending_report', end_date: '2026-05-01', created_at: '2026-01-01' },        // tier0, breached
      { id: 'B', status: 'pending_capa_response', report_issued_date: '2026-04-01', created_at: '2026-01-02' }, // tier0, more overdue
      { id: 'C', status: 'capa_in_progress', capa_closure_due: '2026-07-16', created_at: '2026-01-03' }, // tier1, 3d remaining
      { id: 'D', status: 'pending_report', end_date: '2026-06-20', created_at: '2026-01-04' },          // tier1, 7d remaining
      { id: 'E', status: 'scheduled', start_date: '2026-07-20', created_at: '2026-01-05' },              // tier2
      { id: 'F', status: 'scheduled', start_date: '2026-08-01', created_at: '2026-01-06' },              // tier2
      { id: 'G', status: 'to_schedule', created_at: '2026-01-07' },                                      // tier3
      { id: 'H', status: 'to_schedule', created_at: '2026-02-01' },                                      // tier3
    ]
    const sorted = [...rows].sort(auditUrgencyCompare(TODAY)).map(a => a.id)
    assert.deepEqual(sorted, ['B', 'A', 'C', 'D', 'E', 'F', 'G', 'H'])
  })
})

describe('findingsSummary', () => {
  test('omits zero-count severities and keeps the rest with their abbr', () => {
    const s = findingsSummary({ findings_critical: 2, findings_major: 0, findings_minor: 1, findings_recommendation: 0 })
    assert.deepEqual(s.map(f => [f.key, f.n, f.abbr]), [['findings_critical', 2, 'C'], ['findings_minor', 1, 'm']])
  })
  test('all zero -> empty array', () => {
    assert.deepEqual(findingsSummary({}), [])
  })
})

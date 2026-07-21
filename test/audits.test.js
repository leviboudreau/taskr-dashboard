import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toISODate, fromISODate, addCalDays } from '../src/lib/dates.js'
import { computeAuditClock, clockPhrase, auditUrgencyCompare, deriveAuditStatus } from '../src/lib/audits.js'

const TODAY = '2026-07-13'

describe('computeAuditClock', () => {
  test('no live clock with no dates set at all', () => {
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

  describe('agenda-send reminder', () => {
    test('live once within 30 calendar days of a scheduled start_date, due 20 days out', () => {
      const c = computeAuditClock({ status: 'scheduled', start_date: addCalDays(TODAY, 25) }, TODAY)
      assert.equal(c.label, 'Agenda due')
      assert.equal(c.dueDate, addCalDays(TODAY, 5), 'due date is start_date - 20, i.e. 5 days from today here')
      assert.equal(c.daysRemaining, 5)
      assert.equal(c.tone, 'warn')
    })
    test('not live yet when the audit is more than 30 days out', () => {
      assert.equal(computeAuditClock({ status: 'scheduled', start_date: addCalDays(TODAY, 45) }, TODAY), null)
    })
    test('overdue (danger) once past the 20-days-out mark without having sent it', () => {
      const c = computeAuditClock({ status: 'scheduled', start_date: addCalDays(TODAY, 10) }, TODAY)
      assert.ok(c.daysRemaining < 0)
      assert.equal(c.tone, 'danger')
    })
    test('clears once agenda_sent_date is set, even inside the window', () => {
      assert.equal(computeAuditClock({ status: 'scheduled', start_date: addCalDays(TODAY, 25), agenda_sent_date: TODAY }, TODAY), null)
    })
    test('also live during to_schedule (not just scheduled)', () => {
      const c = computeAuditClock({ status: 'to_schedule', start_date: addCalDays(TODAY, 20) }, TODAY)
      assert.equal(c.label, 'Agenda due')
    })
    test('not live once the audit is underway or later — sending an agenda is moot by then', () => {
      for (const status of ['in_progress', 'pending_report', 'pending_capa_response', 'capa_in_progress', 'closed']) {
        assert.equal(computeAuditClock({ status, start_date: addCalDays(TODAY, 10) }, TODAY), null, `${status} -> no agenda clock`)
      }
    })
    test('no clock without a start_date to compute the window from', () => {
      assert.equal(computeAuditClock({ status: 'scheduled' }, TODAY), null)
    })
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

describe('deriveAuditStatus', () => {
  test('setting report_issued_date advances pending_report -> pending_capa_response (the KRONOS/Gelita bug)', () => {
    assert.equal(deriveAuditStatus({ status: 'pending_report', end_date: '2026-06-01', report_issued_date: '2026-07-10' }, TODAY), 'pending_capa_response')
  })
  test('setting response_approved_date advances pending_capa_response -> capa_in_progress', () => {
    assert.equal(deriveAuditStatus({ status: 'pending_capa_response', response_approved_date: '2026-07-10' }, TODAY), 'capa_in_progress')
  })
  test('setting closed_date advances capa_in_progress -> closed', () => {
    assert.equal(deriveAuditStatus({ status: 'capa_in_progress', closed_date: '2026-07-10' }, TODAY), 'closed')
  })
  test('end_date advances to pending_report only once it has actually arrived', () => {
    assert.equal(deriveAuditStatus({ status: 'in_progress', end_date: TODAY }, TODAY), 'pending_report', 'due today counts')
    assert.equal(deriveAuditStatus({ status: 'in_progress', end_date: addCalDays(TODAY, -1) }, TODAY), 'pending_report', 'in the past counts')
    assert.equal(deriveAuditStatus({ status: 'in_progress', end_date: addCalDays(TODAY, 1) }, TODAY), 'in_progress', 'future end_date does not advance yet')
  })
  test('response_received_date never advances anything on its own — approving the plan does', () => {
    assert.equal(deriveAuditStatus({ status: 'pending_capa_response', response_received_date: '2026-07-10' }, TODAY), 'pending_capa_response')
  })
  test('never advances past the furthest matching rule in one pass, e.g. a backfilled closed_date skips straight to closed', () => {
    assert.equal(deriveAuditStatus({ status: 'pending_report', end_date: '2026-05-01', report_issued_date: '2026-06-01', response_approved_date: '2026-06-15', closed_date: '2026-07-01' }, TODAY), 'closed')
  })
  test('never moves backwards: already at or beyond the implied target is a no-op', () => {
    assert.equal(deriveAuditStatus({ status: 'closed', end_date: '2026-05-01', closed_date: '2026-06-01' }, TODAY), 'closed')
    assert.equal(deriveAuditStatus({ status: 'capa_in_progress', report_issued_date: '2026-06-01' }, TODAY), 'capa_in_progress', 'correcting an earlier date must not drag it back')
  })
  test('clearing a date never reverses status — that is a manual-only action', () => {
    assert.equal(deriveAuditStatus({ status: 'pending_capa_response', report_issued_date: '' }, TODAY), 'pending_capa_response')
  })
  test('no dates set at all is a no-op for every status', () => {
    for (const status of ['to_schedule', 'scheduled', 'in_progress', 'pending_report', 'pending_capa_response', 'capa_in_progress', 'closed']) {
      assert.equal(deriveAuditStatus({ status }, TODAY), status)
    }
  })
})

describe('auditUrgencyCompare', () => {
  test('sorts breached (most overdue first) > live (soonest first) > scheduled (soonest first) > unscheduled (creation order)', () => {
    const rows = [
      { id: 'A', status: 'pending_report', end_date: '2026-05-01', created_at: '2026-01-01' },        // tier0, breached
      { id: 'B', status: 'pending_capa_response', report_issued_date: '2026-04-01', created_at: '2026-01-02' }, // tier0, more overdue
      { id: 'C', status: 'capa_in_progress', capa_closure_due: '2026-07-16', created_at: '2026-01-03' }, // tier1, 3d remaining
      { id: 'D', status: 'pending_report', end_date: '2026-06-20', created_at: '2026-01-04' },          // tier1, 7d remaining
      { id: 'E', status: 'scheduled', start_date: '2026-09-01', created_at: '2026-01-05' },              // tier2 (>30d out, agenda clock not live yet)
      { id: 'F', status: 'scheduled', start_date: '2026-10-01', created_at: '2026-01-06' },              // tier2
      { id: 'G', status: 'to_schedule', created_at: '2026-01-07' },                                      // tier3
      { id: 'H', status: 'to_schedule', created_at: '2026-02-01' },                                      // tier3
    ]
    const sorted = [...rows].sort(auditUrgencyCompare(TODAY)).map(a => a.id)
    assert.deepEqual(sorted, ['B', 'A', 'C', 'D', 'E', 'F', 'G', 'H'])
  })
})

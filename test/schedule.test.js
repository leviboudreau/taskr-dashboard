import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { computeSchedule } from '../src/lib/schedule.js'
import { toISODate, fromISODate, isWeekday } from '../src/lib/dates.js'

const TODAY = '2026-07-13' // a Monday
const addBizFrom = (iso, n) => { const x = fromISODate(iso); let c = 0; while (c < n) { x.setDate(x.getDate() + 1); if (isWeekday(x)) c++ } return toISODate(x) }
// Wrap a flat subtask list as one track
const q = (subs, start) => computeSchedule({ start_date: start }, [{ id: 't1', title: 'Track One', subtasks: subs }], TODAY)

describe('BUG 1 — overdue forecast reflects remaining work, never collapses to today', () => {
  test('untouched 20bd stage anchored in the past forecasts today+20', () => {
    const { schedule } = q([{ id: 'a', title: 'A', duration: 20, depends_on: [], percent: 0 }], '2026-01-01')
    assert.equal(schedule.a.plannedEnd, addBizFrom(TODAY, 20))
    assert.ok(schedule.a.plannedEnd > TODAY, 'forecast is in the future, not today')
  })
  test('75% done of a 20bd overdue stage forecasts today+5', () => {
    const { schedule } = q([{ id: 'a', title: 'A', duration: 20, depends_on: [], percent: 75 }], '2026-01-01')
    assert.equal(schedule.a.plannedEnd, addBizFrom(TODAY, 5))
  })
  test('expected_end override wins over the duration forecast', () => {
    const { schedule } = q([{ id: 'a', title: 'A', duration: 20, depends_on: [], percent: 0, expected_end: '2026-09-01' }], '2026-01-01')
    assert.equal(schedule.a.plannedEnd, '2026-09-01')
  })
  test('future stage on schedule uses full duration from start, percent ignored', () => {
    const { schedule } = q([{ id: 'a', title: 'A', duration: 10, depends_on: [], percent: 0 }], '2026-08-03')
    assert.equal(schedule.a.plannedStart, '2026-08-03')
    assert.equal(schedule.a.plannedEnd, addBizFrom('2026-08-03', 10))
  })
})

describe('BUG 2 — a completion date before its predecessor is clamped for propagation, not display', () => {
  test('child keeps its real completed_date but propagates from the clamped value', () => {
    const subs = [
      { id: 'p', title: 'Pred', duration: 10, depends_on: [], done: true, completed_date: '2026-06-15' },
      { id: 'c', title: 'Child done early', duration: 5, depends_on: ['p'], done: true, completed_date: '2026-06-01' }, // before p
      { id: 'd', title: 'Dependent', duration: 5, depends_on: ['c'] },
    ]
    const { schedule } = q(subs, '2026-01-01')
    assert.equal(schedule.c.warning, 'completed-early')
    assert.equal(schedule.c.actualEnd, '2026-06-01', 'displays the real completed date')
    assert.ok(schedule.d.plannedStart >= '2026-06-15', 'dependent flows from the clamped predecessor end, not backwards')
  })
})

describe('N/A stages', () => {
  test('collapse to zero duration and pass the predecessor end straight through', () => {
    const subs = [
      { id: 'p', title: 'P', duration: 10, depends_on: [], done: true, completed_date: '2026-06-15' },
      { id: 'n', title: 'NA', duration: 8, depends_on: ['p'], na: true },
      { id: 'd', title: 'D', duration: 3, depends_on: ['n'] },
    ]
    const { schedule } = q(subs, '2026-01-01')
    assert.equal(schedule.n.plannedStart, schedule.n.plannedEnd)
    assert.ok(schedule.d.plannedStart >= '2026-06-15')
  })
})

describe('Slack and critical path', () => {
  test('a parallel short branch has float; the long branch drives the join with zero slack', () => {
    // start -> A(10) -> C(5);  start -> B(2) -> C.  B has slack because A drives C.
    const subs = [
      { id: 'a', title: 'A long', duration: 10, depends_on: [] },
      { id: 'b', title: 'B short', duration: 2, depends_on: [] },
      { id: 'c', title: 'C join', duration: 5, depends_on: ['a', 'b'] },
    ]
    const { schedule, critical } = q(subs, '2026-08-03')
    assert.equal(schedule.a.slack, 0)
    assert.equal(schedule.b.slack, 8, '10 - 2 = 8 business days of float')
    assert.equal(schedule.c.slack, 0)
    assert.ok(critical.has('a') && critical.has('c') && !critical.has('b'), 'critical path is A→C, not B')
  })
  test('a diamond picks the longer chain as critical', () => {
    const subs = [
      { id: 's', title: 'Start', duration: 1, depends_on: [] },
      { id: 'x', title: 'X', duration: 3, depends_on: ['s'] },
      { id: 'y', title: 'Y', duration: 12, depends_on: ['s'] },
      { id: 'e', title: 'End', duration: 2, depends_on: ['x', 'y'] },
    ]
    const { critical } = q(subs, '2026-08-03')
    assert.ok(critical.has('s') && critical.has('y') && critical.has('e'), 'critical = S→Y→End')
    assert.ok(!critical.has('x'), 'short branch X excluded')
  })
})

describe('Pinned starts', () => {
  test('a pin overrides the computed start and stops reflowing when the predecessor moves', () => {
    const before = q([
      { id: 'p', title: 'Pred', duration: 10, depends_on: [] },
      { id: 'c', title: 'Child', duration: 5, depends_on: ['p'] },
    ], '2026-08-03').schedule

    const s2 = q([
      { id: 'p', title: 'Pred', duration: 10, depends_on: [] },
      { id: 'c', title: 'Child', duration: 5, depends_on: ['p'], pinned_start: '2026-10-05' },
    ], '2026-08-03').schedule
    assert.equal(s2.c.plannedStart, '2026-10-05')
    assert.notEqual(s2.c.plannedStart, before.c.plannedStart)

    // predecessor grows much longer — pinned child must NOT reflow
    const s3 = q([
      { id: 'p', title: 'Pred', duration: 40, depends_on: [] },
      { id: 'c', title: 'Child', duration: 5, depends_on: ['p'], pinned_start: '2026-10-05' },
    ], '2026-08-03').schedule
    assert.equal(s3.c.plannedStart, '2026-10-05', 'pinned child stays put when predecessor moves')
  })
  test('a pin earlier than the predecessor end raises a soft-overlap warning, not on the predecessor', () => {
    const subs = [
      { id: 'p', title: 'Pred', duration: 20, depends_on: [] },
      { id: 'c', title: 'Child', duration: 5, depends_on: ['p'], pinned_start: '2026-08-05' }, // before p finishes
    ]
    const s = q(subs, '2026-08-03').schedule
    assert.equal(s.c.warning, 'pinned-overlap')
    assert.equal(s.p.warning, null)
  })
})

describe('overdue flag (drives the status-strip metric)', () => {
  test('fires exactly when the stretch-forecast path fires', () => {
    assert.equal(q([{ id: 'a', title: 'A', duration: 20, depends_on: [], percent: 0 }], '2026-01-01').schedule.a.overdue, true, 'untouched, badly overdue')
    assert.equal(q([{ id: 'a', title: 'A', duration: 10, depends_on: [], percent: 0 }], '2026-08-03').schedule.a.overdue, false, 'future, on-schedule')
    assert.equal(q([{ id: 'a', title: 'A', duration: 10, depends_on: [], done: true, completed_date: '2026-01-01' }], '2026-01-01').schedule.a.overdue, false, 'done stages are excluded by definition')
    assert.equal(q([{ id: 'a', title: 'A', duration: 10, depends_on: [], na: true }], '2026-01-01').schedule.a.overdue, false, 'N/A stages are excluded')
    assert.equal(q([{ id: 'a', title: 'A', duration: 10, depends_on: [], expected_end: '2026-01-01' }], '2026-01-01').schedule.a.overdue, true, 'past expected_end override')
    assert.equal(q([{ id: 'a', title: 'A', duration: 10, depends_on: [], expected_end: '2026-12-01' }], '2026-01-01').schedule.a.overdue, false, 'future expected_end override')
  })
})

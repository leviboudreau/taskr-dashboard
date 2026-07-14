import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toISODate, fromISODate, isWeekday, addCalDays, calDaysBetween } from '../src/lib/dates.js'

describe('toISODate / fromISODate round-trip', () => {
  test('round-trips a plain date', () => {
    assert.equal(toISODate(new Date(2026, 6, 13)), '2026-07-13')
    assert.equal(toISODate(fromISODate('2026-07-13')), '2026-07-13')
  })
  test('pads single-digit month/day', () => {
    assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05')
  })
  test('fromISODate constructs a local date, not UTC-shifted', () => {
    const d = fromISODate('2026-07-13')
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 6)
    assert.equal(d.getDate(), 13)
  })
})

describe('isWeekday', () => {
  test('Monday–Friday are weekdays', () => {
    // 2026-07-13 is a Monday
    for (let i = 0; i < 5; i++) assert.equal(isWeekday(new Date(2026, 6, 13 + i)), true, `+${i}d from Mon`)
  })
  test('Saturday/Sunday are not', () => {
    assert.equal(isWeekday(new Date(2026, 6, 18)), false) // Sat
    assert.equal(isWeekday(new Date(2026, 6, 19)), false) // Sun
  })
})

describe('addCalDays / calDaysBetween', () => {
  test('addCalDays adds calendar days, crossing month boundaries', () => {
    assert.equal(addCalDays('2026-05-01', 30), '2026-05-31')
    assert.equal(addCalDays('2026-06-01', 30), '2026-07-01') // 30-day June rolls into July
  })
  test('calDaysBetween is signed and symmetric', () => {
    assert.equal(calDaysBetween('2026-07-13', '2026-07-20'), 7)
    assert.equal(calDaysBetween('2026-07-20', '2026-07-13'), -7)
    assert.equal(calDaysBetween('2026-07-13', '2026-07-13'), 0)
  })
})

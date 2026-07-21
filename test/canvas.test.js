import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { nextZ, bringToFront, clampBox, createBox, CANVAS_W, CANVAS_H, MIN_W, MIN_H, DEFAULT_W, DEFAULT_H } from '../src/lib/canvas.js'

describe('nextZ', () => {
  test('0 for an empty canvas', () => {
    assert.equal(nextZ([]), 0)
  })
  test('max + 1 for a mix of z values', () => {
    assert.equal(nextZ([{ z: 0 }, { z: 3 }, { z: 1 }]), 4)
  })
})

describe('bringToFront', () => {
  test('already-frontmost box is a no-op: returns the same array reference', () => {
    const boxes = [{ id: 'a', z: 0 }, { id: 'b', z: 1 }]
    assert.equal(bringToFront(boxes, 'b'), boxes)
  })
  test('a non-frontmost box gets bumped above the current max; others are untouched', () => {
    const boxes = [{ id: 'a', z: 0 }, { id: 'b', z: 1 }]
    const next = bringToFront(boxes, 'a')
    assert.notEqual(next, boxes)
    assert.equal(next.find(b => b.id === 'a').z, 2)
    assert.equal(next.find(b => b.id === 'b').z, 1)
  })
  test('unknown id is a no-op', () => {
    const boxes = [{ id: 'a', z: 0 }]
    assert.equal(bringToFront(boxes, 'missing'), boxes)
  })
})

describe('clampBox', () => {
  test('size clamps to the minimum', () => {
    const c = clampBox({ x: 0, y: 0, w: 10, h: 10 })
    assert.equal(c.w, MIN_W)
    assert.equal(c.h, MIN_H)
  })
  test('size clamps to the canvas bounds', () => {
    const c = clampBox({ x: 0, y: 0, w: CANVAS_W * 2, h: CANVAS_H * 2 })
    assert.equal(c.w, CANVAS_W)
    assert.equal(c.h, CANVAS_H)
  })
  test('position cannot go negative', () => {
    const c = clampBox({ x: -50, y: -50, w: DEFAULT_W, h: DEFAULT_H })
    assert.equal(c.x, 0)
    assert.equal(c.y, 0)
  })
  test('position cannot push the box off the far edge', () => {
    const c = clampBox({ x: CANVAS_W, y: CANVAS_H, w: DEFAULT_W, h: DEFAULT_H })
    assert.equal(c.x, CANVAS_W - DEFAULT_W)
    assert.equal(c.y, CANVAS_H - DEFAULT_H)
  })
})

describe('createBox', () => {
  test('has all required fields at the requested position, default size, empty body', () => {
    const b = createBox({ x: 100, y: 200 }, [])
    assert.equal(b.x, 100)
    assert.equal(b.y, 200)
    assert.equal(b.w, DEFAULT_W)
    assert.equal(b.h, DEFAULT_H)
    assert.equal(b.z, 0)
    assert.equal(b.body, '')
    assert.ok(b.id)
  })
  test('z is one above the current max', () => {
    const b = createBox({ x: 0, y: 0 }, [{ id: 'x', z: 5 }])
    assert.equal(b.z, 6)
  })
  test('ids are unique across calls', () => {
    const a = createBox({ x: 0, y: 0 }, [])
    const b = createBox({ x: 0, y: 0 }, [])
    assert.notEqual(a.id, b.id)
  })
})

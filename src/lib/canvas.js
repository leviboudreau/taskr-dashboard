// ─── Canvas note geometry ───────────────────────────────────────────────────
// Pure helpers for the free-form "canvas" note type — kept independent of the
// DOM/pointer-event plumbing in NoteCanvas.jsx so the geometry itself is unit-testable.
export const CANVAS_W = 3000
export const CANVAS_H = 2000
export const DEFAULT_W = 260
export const DEFAULT_H = 160
export const MIN_W = 160
export const MIN_H = 100

const genId = () => 'box_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

// Highest existing z + 1 (0 for an empty canvas) — the z a newly created or newly-fronted box should get.
export const nextZ = boxes => (boxes.length ? Math.max(...boxes.map(b => b.z || 0)) + 1 : 0)

// Clamps a box's size to [MIN_W/MIN_H, bounds] and its position so it stays fully on the canvas.
export function clampBox(box, bounds = { w: CANVAS_W, h: CANVAS_H }) {
  const w = Math.max(MIN_W, Math.min(box.w, bounds.w))
  const h = Math.max(MIN_H, Math.min(box.h, bounds.h))
  const x = Math.max(0, Math.min(box.x, bounds.w - w))
  const y = Math.max(0, Math.min(box.y, bounds.h - h))
  return { ...box, x, y, w, h }
}

export function createBox({ x, y }, existingBoxes = []) {
  return clampBox({ id: genId(), x, y, w: DEFAULT_W, h: DEFAULT_H, z: nextZ(existingBoxes), body: '' })
}

// Returns the same array reference (no-op) when the target is already frontmost, so callers can use
// reference equality to skip marking the note dirty on a click that didn't actually change anything.
export function bringToFront(boxes, id) {
  const target = boxes.find(b => b.id === id)
  if (!target) return boxes
  const maxZ = boxes.length ? Math.max(...boxes.map(b => b.z || 0)) : 0
  if (target.z === maxZ) return boxes
  return boxes.map(b => (b.id === id ? { ...b, z: maxZ + 1 } : b))
}

import { useState, useRef, useEffect, Suspense, lazy } from 'react'
import DOMPurify from 'dompurify'
import { createBox, bringToFront, clampBox, CANVAS_W, CANVAS_H, DEFAULT_W, DEFAULT_H } from '../lib/canvas.js'
import { NOTE_EDITOR_CSS } from './RichTextEditor.jsx'

// Imported the same lazy way App.jsx imports it, so Vite resolves both to the one Tiptap chunk —
// it's only ever fetched once a box is actually clicked into, not merely by opening a canvas note.
const RichTextEditor = lazy(() => import('./RichTextEditor.jsx'))

// A note's own "Delete" affordance (App.jsx's ConfirmDeleteButton) lives in App.jsx and isn't exported,
// so this is a small in-file equivalent: click once to arm, click "Sure?" within 3s to confirm.
function DeleteBoxButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const stop = e => e.stopPropagation() // never let a click here reach the box's own drag-start handler
  if (confirming) {
    return (
      <span onPointerDown={stop} style={{ display: 'inline-flex', gap: 3 }}>
        <button onClick={() => { clearTimeout(timer.current); onConfirm() }}
          style={{ fontSize: 10, padding: '1px 5px', border: 'none', borderRadius: 4, background: '#A32D2D', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>Sure?</button>
        <button onClick={() => { clearTimeout(timer.current); setConfirming(false) }}
          style={{ fontSize: 10, padding: '1px 5px', border: '0.5px solid #ddd', borderRadius: 4, background: 'none', color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>No</button>
      </span>
    )
  }
  return (
    <button onPointerDown={stop} title="Delete box"
      onClick={() => { setConfirming(true); timer.current = setTimeout(() => setConfirming(false), 3000) }}
      style={{ fontSize: 11, width: 16, height: 16, lineHeight: '16px', textAlign: 'center', padding: 0, border: 'none', borderRadius: 4, background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'inherit' }}
      onMouseEnter={e => { e.currentTarget.style.background = '#fceaea'; e.currentTarget.style.color = '#c0392b' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' }}>
      ✕
    </button>
  )
}

// Free-form "canvas" note surface — independent rich-text boxes positioned anywhere on a fixed,
// scrollable page, à la OneNote. Controlled: `boxes` in, `onChange(nextBoxes)` out on every committed
// mutation. `NotesTab` treats the result as just another field of its existing draft/debounce-save,
// so this component owns geometry and interaction only, no persistence of its own.
function NoteCanvas({ boxes = [], onChange, members = [], isMobile = false }) {
  const [activeBoxId, setActiveBoxId] = useState(null)
  // Docks the active box's formatting toolbar in one shared spot at the top of the panel — the same
  // location a standard note's toolbar lives — rather than a separate copy squeezed into each box.
  // A callback ref (not useRef) so the first render where a box becomes active already has the node.
  const [toolbarSlot, setToolbarSlot] = useState(null)
  const [, setTick] = useState(0)
  const bump = () => setTick(t => t + 1)
  // Mutable, not state: position/size during an active drag needs to update at pointer-move frequency
  // without re-rendering NotesTab's whole draft (title input, sidebar, etc.) on every frame — only the
  // one dragging box re-renders, via bump(). Mirrors QualificationGantt's dragRef/bump() idiom.
  const dragRef = useRef(null)
  const surfaceRef = useRef(null)

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape') return
      if (dragRef.current) { dragRef.current = null; bump() } // cancel an in-flight move/resize
      else setActiveBoxId(null) // otherwise exit edit mode
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const focusBox = id => {
    setActiveBoxId(id)
    const next = bringToFront(boxes, id)
    if (next !== boxes) onChange(next) // bringToFront returns the same reference when already frontmost
  }

  const updateBoxBody = (id, html) => onChange(boxes.map(b => (b.id === id ? { ...b, body: html } : b)))

  const deleteBox = id => {
    onChange(boxes.filter(b => b.id !== id))
    if (activeBoxId === id) setActiveBoxId(null)
  }

  const placeNewBox = (x, y) => {
    const box = createBox({ x: Math.max(0, x - DEFAULT_W / 2), y: Math.max(0, y - DEFAULT_H / 2) }, boxes)
    onChange([...boxes, box])
    setActiveBoxId(box.id)
  }

  // Double-click empty canvas → new box at the click point
  const onSurfaceDoubleClick = e => {
    if (e.target !== e.currentTarget) return // hit a box, not the bare surface
    const r = surfaceRef.current.getBoundingClientRect()
    placeNewBox(e.clientX - r.left + surfaceRef.current.scrollLeft, e.clientY - r.top + surfaceRef.current.scrollTop)
  }
  // "+ Box" — the touch-safe path where there's no double-click, drops a box near the current scroll center
  const addBoxNearCenter = () => {
    const el = surfaceRef.current
    const x = el ? el.scrollLeft + el.clientWidth / 2 : CANVAS_W / 2
    const y = el ? el.scrollTop + el.clientHeight / 2 : CANVAS_H / 2
    placeNewBox(x, y)
  }
  // Click on bare canvas background exits edit mode (does nothing while a drag is in progress)
  const onSurfacePointerDown = e => {
    if (e.target !== e.currentTarget || dragRef.current) return
    setActiveBoxId(null)
  }

  const startDrag = (e, box, mode) => {
    e.stopPropagation()
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    dragRef.current = { mode, id: box.id, startX: e.clientX, startY: e.clientY,
      origX: box.x, origY: box.y, origW: box.w, origH: box.h, curX: box.x, curY: box.y, curW: box.w, curH: box.h, moved: false }
    focusBox(box.id)
  }
  const onDragMove = (e, box, mode) => {
    const d = dragRef.current
    if (!d || d.id !== box.id || d.mode !== mode) return
    e.preventDefault()
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true
    // Height is intrinsic to content now (no fixed box height/scrollbar), so resize only ever changes width.
    if (mode === 'move') { d.curX = d.origX + dx; d.curY = d.origY + dy }
    else { d.curW = d.origW + dx }
    bump()
  }
  const endDrag = box => {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !d.moved) { bump(); return }
    const updated = clampBox(
      d.mode === 'move' ? { ...box, x: d.curX, y: d.curY } : { ...box, w: d.curW },
      { w: CANVAS_W, h: CANVAS_H },
    )
    onChange(boxes.map(b => (b.id === d.id ? updated : b)))
  }

  // A box being actively dragged reflects dragRef's live position/size; every other box reads its
  // committed value from `boxes` as normal.
  const liveBox = box => {
    const d = dragRef.current
    if (!d || d.id !== box.id) return box
    return d.mode === 'move' ? { ...box, x: d.curX, y: d.curY } : { ...box, w: d.curW }
  }

  const isDragging = !!dragRef.current // read during render — bump() re-renders this component while a drag is live

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <style>{NOTE_EDITOR_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'stretch', background: 'white', border: '0.5px solid #e5e5e5', borderBottom: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '5px 8px', flexShrink: 0 }}>
          <button onClick={addBoxNearCenter}
            style={{ fontSize: 12, padding: '4px 10px', border: '0.5px solid #e0e0e0', borderRadius: 6, background: '#f7f7f5', color: '#555', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            + Box
          </button>
        </div>
        {/* Empty when no box is active; the active box's own RichTextEditor toolbar portals in here */}
        <div ref={setToolbarSlot} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          {!activeBoxId && <span style={{ fontSize: 11, color: '#bbb', padding: '0 8px' }}>Double-click anywhere to start a box · drag the header to move · corner to resize</span>}
        </div>
      </div>
      <div ref={surfaceRef} onDoubleClick={onSurfaceDoubleClick} onPointerDown={onSurfacePointerDown}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'auto', border: '0.5px solid #e5e5e5', background: '#fbfbfa',
          ...(isDragging ? { backgroundImage: 'radial-gradient(#e5e5e0 1px, transparent 1px)', backgroundSize: '18px 18px' } : {}) }}>
        <div style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H }}>
          {boxes.map(rawBox => {
            const box = liveBox(rawBox)
            const isActive = box.id === activeBoxId
            return (
              // No header bar: the box's own padding ring is the drag handle (a pointerdown that lands on
              // the box itself, not on the content inside it, starts a move — same e.target===e.currentTarget
              // test used for the canvas background). Height is never set explicitly, so the box grows to
              // fit whatever's typed instead of scrolling.
              <div key={box.id}
                onPointerDownCapture={() => focusBox(box.id)}
                onPointerDown={e => { if (e.target === e.currentTarget) startDrag(e, box, 'move') }}
                onPointerMove={e => onDragMove(e, box, 'move')}
                onPointerUp={() => endDrag(box)} onPointerCancel={() => endDrag(box)}
                style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, minHeight: 32, zIndex: box.z,
                  boxSizing: 'border-box', padding: 8, background: 'white', borderRadius: 8,
                  border: '0.5px solid #e5e5e5', cursor: 'move', touchAction: 'none' }}>
                <div style={{ position: 'absolute', top: 1, right: 1 }}>
                  <DeleteBoxButton onConfirm={() => deleteBox(box.id)} />
                </div>
                {isActive ? (
                  <Suspense fallback={null}>
                    <RichTextEditor key={box.id} initialValue={box.body} isMobile={isMobile} members={members} autoFocus compact
                      toolbarPortalTarget={toolbarSlot}
                      onChange={html => updateBoxBody(box.id, html)} />
                  </Suspense>
                ) : box.body ? (
                  <div className="note-editor" style={{ fontSize: 13, lineHeight: 1.4, color: '#333', cursor: 'text' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(box.body, { ADD_ATTR: ['colwidth'] }) }} />
                ) : (
                  <div style={{ fontSize: 13, color: '#ccc', minHeight: 20, cursor: 'text' }}>Empty note</div>
                )}
                <div onPointerDown={e => startDrag(e, box, 'resize')} onPointerMove={e => onDragMove(e, box, 'resize')}
                  onPointerUp={() => endDrag(box)} onPointerCancel={() => endDrag(box)}
                  title="Resize width"
                  style={{ position: 'absolute', right: -3, top: '50%', transform: 'translateY(-50%)', width: 6, height: 24, cursor: 'ew-resize', touchAction: 'none',
                    borderRadius: 3, background: '#e0ddea' }} />
              </div>
            )
          })}
          {boxes.length === 0 && (
            <div style={{ position: 'absolute', top: 24, left: 24, fontSize: 13, color: '#bbb', pointerEvents: 'none' }}>
              Double-click anywhere, or use + Box, to start your first note.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default NoteCanvas

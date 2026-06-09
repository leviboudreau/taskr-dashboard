import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Constants ───────────────────────────────────────────────────────────────

const MEMBERS = ['Levi', 'Margarita', 'Illya', 'Matthew']
const COLS = [
  { key: 'active', lbl: 'Active' },
  { key: 'waiting', lbl: 'Waiting on' },
  { key: 'someday', lbl: 'Someday' },
  { key: 'done', lbl: 'Done' },
]
const SUBSTATUS = [
  { key: '', label: '—' },
  { key: 'not_started', label: 'Not started', bg: '#F1EFE8', tc: '#5F5E5A', border: '#B4B2A9' },
  { key: 'in_progress', label: 'In progress', bg: '#E6F1FB', tc: '#0C447C', border: '#85B7EB' },
  { key: 'at_risk', label: 'At risk', bg: '#FCEBEB', tc: '#791F1F', border: '#F09595' },
  { key: 'on_hold', label: 'On hold', bg: '#FAEEDA', tc: '#633806', border: '#FAC775' },
  { key: 'complete', label: 'Complete', bg: '#EAF3DE', tc: '#27500A', border: '#97C459' },
  { key: 'canceled', label: 'Canceled', bg: '#F1EFE8', tc: '#888780', border: '#B4B2A9' },
]
const FLAG_COLORS = [
  { key: '', label: 'None', hex: '#e5e5e5' },
  { key: 'red', label: 'Red', hex: '#E24B4A' },
  { key: 'orange', label: 'Orange', hex: '#F97316' },
  { key: 'yellow', label: 'Yellow', hex: '#EAB308' },
  { key: 'green', label: 'Green', hex: '#639922' },
  { key: 'blue', label: 'Blue', hex: '#378ADD' },
  { key: 'violet', label: 'Violet', hex: '#7F77DD' },
]
const MEMBER_COLORS = {
  Levi: { bg: '#F1EFE8', tc: '#5F5E5A' },
  Margarita: { bg: '#E1F5EE', tc: '#085041' },
  Illya: { bg: '#E6F1FB', tc: '#0C447C' },
  Matthew: { bg: '#EEEDFE', tc: '#3C3489' },
}
const CITIES = [
  { name: 'Greenwood, SC', tz: 'America/New_York' },
  { name: 'Puebla, MX', tz: 'America/Mexico_City' },
  { name: 'Bornem/Colmar', tz: 'Europe/Paris' },
  { name: 'Rewari, India', tz: 'Asia/Kolkata' },
  { name: 'Suzhou, China', tz: 'Asia/Shanghai' },
  { name: 'Sagamihara, Japan', tz: 'Asia/Tokyo' },
]

const flagBg = c => ({ red: '#FCEBEB', orange: '#FFF0E8', yellow: '#FEFCE8', green: '#EAF3DE', blue: '#E6F1FB', violet: '#EEEDFE' }[c] || null)
const flagBorder = c => ({ red: '#E24B4A', orange: '#F97316', yellow: '#EAB308', green: '#639922', blue: '#378ADD', violet: '#7F77DD' }[c] || null)
const subStyle = k => SUBSTATUS.find(s => s.key === k) || SUBSTATUS[0]
const fmtTs = ts => { const d = new Date(ts); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }

// ─── World Clock ─────────────────────────────────────────────────────────────
function WorldClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div style={{ display: 'flex', marginBottom: '1rem', background: '#f7f7f5', borderRadius: 8, overflow: 'hidden', border: '0.5px solid #e5e5e5' }}>
      {CITIES.map((c, i) => {
        const timeStr = now.toLocaleTimeString('en-US', { timeZone: c.tz, hour: 'numeric', minute: '2-digit', hour12: true })
        const dayStr = now.toLocaleDateString('en-US', { timeZone: c.tz, weekday: 'short' })
        const homeDay = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' })
        const isNext = dayStr !== homeDay && i > 1
        return (
          <div key={c.name} style={{ flex: 1, padding: '6px 10px', borderRight: i < CITIES.length - 1 ? '0.5px solid #e5e5e5' : 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#aaa', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name.split(',')[0]}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111', whiteSpace: 'nowrap' }}>
              {timeStr}{isNext && <span style={{ fontSize: 9, color: '#aaa', marginLeft: 3 }}>+1</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Badge ───────────────────────────────────────────────────────────────────
function Badge({ type, children }) {
  const s = {
    domain: { background: '#E6F1FB', color: '#0C447C' },
    owner: { background: '#E1F5EE', color: '#085041' },
    due: { background: '#FAEEDA', color: '#633806' },
    high: { background: '#FCEBEB', color: '#791F1F' },
    done: { background: '#EAF3DE', color: '#27500A' },
  }[type] || {}
  return <span style={{ ...s, fontSize: 11, padding: '2px 7px', borderRadius: 10, whiteSpace: 'nowrap' }}>{children}</span>
}

// ─── Owner Pip ───────────────────────────────────────────────────────────────
function OwnerPip({ name }) {
  const c = MEMBER_COLORS[name] || { bg: '#f0f0f0', tc: '#888' }
  return <span title={name} style={{ width: 18, height: 18, borderRadius: '50%', background: c.bg, color: c.tc, fontSize: 10, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid rgba(0,0,0,0.08)' }}>{name[0]}</span>
}

// ─── Task Card ───────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDragStart, onDragEnd, dragging, compact, onToggleSubtask }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const done = task.status === 'done'
  const bg = flagBg(task.color)
  const border = flagBorder(task.color)
  const hasNotes = task.notes && task.notes.length > 0
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : []
  const hasSubtasks = subtasks.length > 0
  const completedSubs = subtasks.filter(s => s.done).length
  const owners = task.owners || ['Levi']
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); onDragStart(task.id) }}
      onDragEnd={onDragEnd}
      onClick={() => onEdit(task)}
      style={{ background: bg || 'white', border: border ? `1px solid ${border}` : '0.5px solid #e5e5e5', borderRadius: 8, padding: compact ? '8px 10px' : '10px 12px', marginBottom: 8, userSelect: 'none', opacity: dragging ? 0.4 : 1, cursor: 'grab', width: '100%' }}
      onMouseEnter={e => { if (!border) e.currentTarget.style.borderColor = '#bbb' }}
      onMouseLeave={e => { if (!border) e.currentTarget.style.borderColor = '#e5e5e5' }}
    >
      {/* Top row: domain left, substatus + priority right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3, gap: 4, minHeight: 18 }}>
        <div>{task.domain && <span style={{ fontSize: 10, fontWeight: 500, background: '#E6F1FB', color: '#0C447C', padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap', border: '0.5px solid #85B7EB' }}>{task.domain}</span>}</div>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {task.substatus && (() => { const ss = subStyle(task.substatus); return <span style={{ fontSize: 9, fontWeight: 500, background: ss.bg, color: ss.tc, border: `0.5px solid ${ss.border}`, padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>{ss.label}</span> })()}
          {task.priority === 'high' && <span style={{ fontSize: 9, fontWeight: 500, background: '#FCEBEB', color: '#791F1F', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap', border: '0.5px solid #F09595' }}>High</span>}
        </div>
      </div>

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 500, color: done ? '#999' : '#111', textDecoration: done ? 'line-through' : 'none', marginBottom: 4, lineHeight: 1.4 }}>{task.title}</div>

      {/* Badges */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: !compact && (hasNotes || showOwners || hasSubtasks) ? 6 : 0 }}>
        {task.due && <Badge type="due">{task.due}</Badge>}
        {done && <Badge type="done">Done</Badge>}
      </div>

      {/* Subtasks toggle */}
      {!compact && hasSubtasks && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 3 }}>
            <button onClick={e => { e.stopPropagation(); setSubtasksOpen(o => !o) }} style={{ fontSize: 10, color: '#888', background: 'none', border: '0.5px solid #ddd', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
              {subtasksOpen ? 'hide subtasks' : `${completedSubs}/${subtasks.length} subtask${subtasks.length > 1 ? 's' : ''}`}
            </button>
          </div>
          {subtasksOpen && (
            <div style={{ marginBottom: 6, paddingLeft: 2 }}>
              {subtasks.map(st => (
                <div key={st.id} onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <input type="checkbox" checked={!!st.done} onChange={e => { e.stopPropagation(); onToggleSubtask(task.id, st.id, e.target.checked) }} style={{ width: 12, height: 12, cursor: 'pointer' }} />
                  <span style={{ fontSize: 11, color: st.done ? '#aaa' : '#444', textDecoration: st.done ? 'line-through' : 'none' }}>{st.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notes toggle */}
      {!compact && hasNotes && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <button onClick={e => { e.stopPropagation(); setNotesOpen(o => !o) }} style={{ fontSize: 10, color: '#888', background: 'none', border: '0.5px solid #ddd', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
            {notesOpen ? 'hide notes' : `${task.notes.length} note${task.notes.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
      {notesOpen && !compact && hasNotes && (
        <div style={{ marginBottom: 8, borderTop: '0.5px solid #e5e5e5', paddingTop: 8 }}>
          {task.notes.map(n => (
            <div key={n.id} style={{ fontSize: 11, color: '#555', marginBottom: 5, lineHeight: 1.5 }}>
              <span style={{ color: '#bbb', marginRight: 6, fontSize: 10 }}>{fmtTs(n.ts)}</span>{n.text}
            </div>
          ))}
        </div>
      )}

      {/* Owner pips + notes */}
      {!compact && showOwners && (
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          {owners.map(o => <OwnerPip key={o} name={o} />)}
        </div>
      )}
    </div>
  )
}

// ─── Today Strip ─────────────────────────────────────────────────────────────
function TodayStrip({ tasks, onEdit, onDragStart, onDragEnd, draggingId, onDrop, onDragOver, onDragLeave, isOver, onRemove }) {
  const today = tasks.filter(t => t.today && t.status !== 'done')
  return (
    <div onDragOver={e => { e.preventDefault(); onDragOver('today') }} onDragLeave={onDragLeave} onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), 'today') }}
      style={{ marginBottom: 12, background: isOver ? '#EEF4FF' : '#f7f7f5', border: isOver ? '1.5px dashed #378ADD' : '1.5px solid transparent', borderRadius: 12, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: today.length ? 10 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</span>
          <span style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 10, padding: '1px 7px', fontSize: 11, color: '#888' }}>{today.length}</span>
        </div>
        <span style={{ fontSize: 11, color: '#bbb' }}>Drag tasks here · or check in with Claude each morning</span>
      </div>
      {today.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
          {today.map(t => (
            <div key={t.id} style={{ position: 'relative' }}>
              <TaskCard task={t} onEdit={onEdit} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={draggingId === t.id} compact />
              <button onClick={e => { e.stopPropagation(); onRemove(t.id) }} style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#ccc' }} onMouseEnter={e => e.currentTarget.style.color = '#333'} onMouseLeave={e => e.currentTarget.style.color = '#ccc'}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#ccc', padding: '8px 0' }}>No tasks for today — drag tasks here or check in with Claude</div>
      )}
    </div>
  )
}

// ─── Note Item ───────────────────────────────────────────────────────────────
function NoteItem({ note, onDelete, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note.text)
  return (
    <div style={{ marginBottom: 8, padding: '8px 10px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #f0f0f0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#bbb', marginBottom: 3 }}>{fmtTs(note.ts)}</div>
          {editing ? (
            <textarea value={val} onChange={e => setVal(e.target.value)} autoFocus style={{ width: '100%', fontSize: 12, height: 56, resize: 'none', fontFamily: 'inherit', padding: '5px 7px', border: '0.5px solid #ddd', borderRadius: 5 }} />
          ) : (
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{note.text}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {editing ? (
            <>
              <button onClick={() => { onSave(note.id, val.trim()); setEditing(false) }} style={{ fontSize: 11, background: '#111', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Save</button>
              <button onClick={() => { setVal(note.text); setEditing(false) }} style={{ fontSize: 11, background: 'none', border: '0.5px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', color: '#666' }}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} style={{ fontSize: 11, background: 'none', border: '0.5px solid #ddd', borderRadius: 4, padding: '2px 7px', cursor: 'pointer', color: '#888' }}>Edit</button>
          )}
          <button onClick={() => onDelete(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 12 }} onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'} onMouseLeave={e => e.currentTarget.style.color = '#ddd'}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Form ───────────────────────────────────────────────────────────────
function TaskForm({ task, isEdit, onSave, onDelete, onClose, domains }) {
  const EMPTY = { title: '', status: 'active', domain: '', owners: ['Levi'], due: '', priority: '', color: '', notes: [], today: false, substatus: '', subtasks: [] }
  const [f, setF] = useState({ ...EMPTY, ...task, owners: Array.isArray(task?.owners) ? task.owners : ['Levi'], notes: Array.isArray(task?.notes) ? task.notes : [], subtasks: Array.isArray(task?.subtasks) ? task.subtasks : [] })
  const [newNote, setNewNote] = useState('')
  const [newSub, setNewSub] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const toggleOwner = m => {
    const cur = f.owners || []
    if (cur.includes(m)) { if (cur.length > 1) set('owners', cur.filter(o => o !== m)) }
    else set('owners', [...cur, m])
  }
  const addNote = () => { const text = newNote.trim(); if (!text) return; set('notes', [...f.notes, { id: 'n' + Date.now(), text, ts: Date.now() }]); setNewNote('') }
  const removeNote = id => set('notes', f.notes.filter(n => n.id !== id))
  const editNote = (id, text) => { if (!text) removeNote(id); else set('notes', f.notes.map(n => n.id === id ? { ...n, text } : n)) }
  const addSub = () => { const text = newSub.trim(); if (!text) return; set('subtasks', [...f.subtasks, { id: 'st' + Date.now(), title: text, done: false }]); setNewSub('') }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 30, zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, border: '0.5px solid #e5e5e5', padding: '1.25rem', width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}>
        <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Task title..."
          style={{ width: '100%', fontSize: 18, fontWeight: 700, border: 'none', outline: 'none', marginBottom: 14, color: '#111', background: 'transparent', padding: 0 }} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={f.status} onChange={e => set('status', e.target.value)} style={{ width: '100%', fontSize: 13 }}>
              {['active', 'waiting', 'someday', 'done'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select></div>
          <div><label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Priority</label>
            <select value={f.priority} onChange={e => set('priority', e.target.value)} style={{ width: '100%', fontSize: 13 }}>
              <option value="">Normal</option><option value="high">High</option>
            </select></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Sub-status</label>
            <select value={f.substatus || ''} onChange={e => set('substatus', e.target.value)} style={{ width: '100%', fontSize: 13 }}>
              {SUBSTATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></div>
          <div><label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Domain</label>
            <select value={f.domain} onChange={e => set('domain', e.target.value)} style={{ width: '100%', fontSize: 13 }}>
              <option value="">— none —</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div><label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Due date</label>
            <input type="text" value={f.due} onChange={e => set('due', e.target.value)} placeholder="e.g. Sep 2025" style={{ width: '100%', fontSize: 13 }} /></div>
          <div><label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Flag color</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width: fc.key ? 20 : 14, height: fc.key ? 20 : 14, borderRadius: '50%', background: fc.hex, border: f.color === fc.key ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />)}
            </div></div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Assigned to</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MEMBERS.map(m => { const sel = (f.owners || []).includes(m); const c = MEMBER_COLORS[m] || {}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 16, cursor: 'pointer', border: sel ? `1.5px solid ${c.tc}` : '1px solid #e5e5e5', background: sel ? c.bg : 'white', color: sel ? c.tc : '#888', fontWeight: sel ? 500 : 400 }}>{m}</button> })}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!f.today} onChange={e => set('today', e.target.checked)} style={{ width: 14, height: 14 }} />Include in Today
        </label>

        <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 12, marginBottom: 4 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>Subtasks</label>
          {f.subtasks.map(st => (
            <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 8px', background: '#fafafa', borderRadius: 6, border: '0.5px solid #f0f0f0' }}>
              <input type="checkbox" checked={!!st.done} onChange={e => setF(p => ({ ...p, subtasks: p.subtasks.map(s => s.id === st.id ? { ...s, done: e.target.checked } : s) }))} style={{ width: 13, height: 13, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 12, color: st.done ? '#aaa' : '#444', textDecoration: st.done ? 'line-through' : 'none' }}>{st.title}</span>
              <button onClick={() => setF(p => ({ ...p, subtasks: p.subtasks.filter(s => s.id !== st.id) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', fontSize: 12 }} onMouseEnter={e => e.currentTarget.style.color = '#E24B4A'} onMouseLeave={e => e.currentTarget.style.color = '#ddd'}>✕</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <input type="text" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addSub() }} placeholder="Add a subtask..." style={{ flex: 1, fontSize: 12, padding: '6px 9px', border: '0.5px solid #ddd', borderRadius: 6 }} />
            <button onClick={addSub} style={{ fontSize: 12, background: '#111', color: 'white', border: 'none', borderRadius: 6, padding: '0 14px', cursor: 'pointer' }}>Add</button>
          </div>
        </div>

        <div style={{ borderTop: '0.5px solid #f0f0f0', paddingTop: 12, marginBottom: 4, marginTop: 4 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>Notes</label>
          {f.notes.map(n => <NoteItem key={n.id} note={n} onDelete={removeNote} onSave={editNote} />)}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote() }} placeholder="Add a note... (⌘+Enter to save)" style={{ flex: 1, fontSize: 12, height: 56, resize: 'none', fontFamily: 'inherit', padding: '7px 9px', border: '0.5px solid #ddd', borderRadius: 6 }} />
            <button onClick={addNote} style={{ fontSize: 12, background: '#111', color: 'white', border: 'none', borderRadius: 6, padding: '0 14px', cursor: 'pointer' }}>Add</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div>{isEdit && <button onClick={() => onDelete(task.id)} style={{ fontSize: 13, color: '#A32D2D', background: 'none', border: '0.5px solid #F09595', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ fontSize: 13, background: 'none', border: '0.5px solid #ccc', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#444' }}>Cancel</button>
            <button onClick={() => { if (f.title.trim()) onSave(f) }} style={{ fontSize: 13, background: '#111', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks, setTasks] = useState([])
  const [domains, setDomains] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tasks')
  const [form, setForm] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [minimized, setMinimized] = useState({})
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  const [mobileCol, setMobileCol] = useState('active')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Load data from Supabase
  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: tasksData }, { data: domainsData }] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
      supabase.from('domains').select('*').order('sort_order', { ascending: true }),
    ])
    if (tasksData) setTasks(tasksData.map(t => ({ ...t, owners: t.owners || ['Levi'], notes: t.notes || [], subtasks: t.subtasks || [] })))
    if (domainsData) setDomains(domainsData.map(d => d.name))
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase.channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  const saveTask = async data => {
    const payload = {
      title: data.title, status: data.status, domain: data.domain || '',
      owners: data.owners || ['Levi'], due: data.due || '', priority: data.priority || '',
      color: data.color || '', substatus: data.substatus || '',
      notes: data.notes || [], today: !!data.today, subtasks: data.subtasks || [],
      updated_at: new Date().toISOString(),
    }
    if (isEdit && form?.id) {
      await supabase.from('tasks').update(payload).eq('id', form.id)
    } else {
      const maxOrder = tasks.length ? Math.max(...tasks.map(t => t.sort_order || 0)) : 0
      await supabase.from('tasks').insert({ ...payload, sort_order: maxOrder + 1 })
    }
    setForm(null)
    await loadData()
  }

  const deleteTask = async id => {
    await supabase.from('tasks').delete().eq('id', id)
    setForm(null)
    await loadData()
  }

  const moveTask = async (id, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const toggleToday = async (id, today) => {
    await supabase.from('tasks').update({ today, updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const toggleSubtask = async (taskId, subtaskId, done) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const subtasks = (task.subtasks || []).map(s => s.id === subtaskId ? { ...s, done } : s)
    await supabase.from('tasks').update({ subtasks, updated_at: new Date().toISOString() }).eq('id', taskId)
    await loadData()
  }

  const drop = async (id, col) => {
    if (!id) return
    if (col === 'today') { await toggleToday(id, true) }
    else { await moveTask(id, col) }
    setDraggingId(null); setOverCol(null)
  }

  const removeFromToday = async id => { await toggleToday(id, false) }
  const toggleMin = key => setMinimized(m => ({ ...m, [key]: !m[key] }))

  const activeCols = COLS.filter(c => !minimized[c.key])
  const minCols = COLS.filter(c => minimized[c.key])
  const todayCount = tasks.filter(t => t.today && t.status !== 'done').length

  if (loading) return (
    <div style={{ fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontSize: 14 }}>
      Loading TASKr...
    </div>
  )

  return (
    <div style={{ fontFamily: 'system-ui,sans-serif', padding: isMobile ? '0.75rem' : '1.25rem 1.5rem', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '0.5px solid #e5e5e5' }}>
        <h1 style={{ fontSize: 18, fontWeight: 500, color: '#111', margin: 0 }}>💪🏻 TASKr Dashboard</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#aaa' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span style={{ fontSize: 10, color: '#bbb' }}>Live · Supabase</span>
        </div>
      </div>

      <WorldClock />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: '1.25rem', borderBottom: '0.5px solid #e5e5e5' }}>
        {['tasks', 'team', 'settings'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ fontSize: 13, padding: '6px 14px 8px', cursor: 'pointer', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #111' : '2px solid transparent', color: tab === t ? '#111' : '#888', fontWeight: tab === t ? 500 : 400, marginBottom: -1 }}>
            {t === 'tasks' ? 'Task board' : t === 'settings' ? '⚙️ Settings' : 'Team'}
          </button>
        ))}
      </div>

      {/* Task Board */}
      {tab === 'tasks' && (
        <>
          {/* View toggle row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
            {minCols.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                {minCols.map(col => (
                  <div key={col.key} onClick={() => toggleMin(col.key)} style={{ background: '#f7f7f5', border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.lbl}</span>
                    <span style={{ fontSize: 10, color: '#ccc', background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '1px 5px' }}>{tasks.filter(t => t.status === col.key).length}</span>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setTab('trash')} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, cursor: 'pointer', border: tab === 'trash' ? '1px solid #111' : '0.5px solid #ddd', background: tab === 'trash' ? '#111' : 'white', color: tab === 'trash' ? 'white' : '#888' }}>
              🗑 Trash{tasks.filter(t => t.status === 'canceled').length > 0 ? ` (${tasks.filter(t => t.status === 'canceled').length})` : ''}
            </button>
          </div>

          {/* Today strip */}
          <TodayStrip allTasks={tasks} tasks={tasks} onEdit={t => { setForm({ ...t }); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} draggingId={draggingId} onDrop={drop} onDragOver={setOverCol} onDragLeave={() => setOverCol(null)} isOver={overCol === 'today'} onRemove={removeFromToday} />

          {/* Columns */}
          {isMobile ? (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
                {COLS.map(col => {
                  const ct = tasks.filter(t => t.status === col.key && t.status !== 'canceled')
                  const active = mobileCol === col.key
                  return <button key={col.key} onClick={() => setMobileCol(col.key)} style={{ flexShrink: 0, fontSize: 12, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', border: active ? '1.5px solid #111' : '0.5px solid #ddd', background: active ? '#111' : 'white', color: active ? 'white' : '#888', fontWeight: active ? 500 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {col.lbl}<span style={{ fontSize: 10, background: active ? 'rgba(255,255,255,0.2)' : '#f0f0f0', color: active ? 'white' : '#aaa', borderRadius: 8, padding: '1px 6px' }}>{ct.length}</span>
                  </button>
                })}
              </div>
              {COLS.filter(c => c.key === mobileCol).map(col => {
                const ct = tasks.filter(t => t.status === col.key && t.status !== 'canceled')
                return <div key={col.key} onDragOver={e => { e.preventDefault(); setOverCol(col.key) }} onDragLeave={() => setOverCol(null)} onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), col.key) }} style={{ background: '#f7f7f5', borderRadius: 12, padding: 12, minHeight: 200 }}>
                  {ct.map(t => <TaskCard key={t.id} task={t} onEdit={t => { setForm({ ...t }); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId === t.id} onToggleSubtask={toggleSubtask} />)}
                  <button onClick={() => { setForm({ status: col.key }); setIsEdit(false) }} style={{ width: '100%', marginTop: 8, padding: '10px 0', fontSize: 13, color: '#aaa', border: '0.5px dashed #ccc', borderRadius: 8, background: 'none', cursor: 'pointer' }}>+ Add task</button>
                </div>
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              {activeCols.map(col => {
                const ct = tasks.filter(t => t.status === col.key && t.status !== 'canceled')
                return (
                  <div key={col.key} onDragOver={e => { e.preventDefault(); setOverCol(col.key) }} onDragLeave={() => setOverCol(null)} onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), col.key) }}
                    style={{ flex: 1, minWidth: 0, background: overCol === col.key ? '#EEF4FF' : '#f7f7f5', border: overCol === col.key ? '1.5px dashed #378ADD' : '1.5px solid transparent', borderRadius: 12, padding: 12, minHeight: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.lbl}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 10, padding: '1px 7px', fontSize: 11, color: '#888' }}>{ct.length}</span>
                        <button onClick={() => toggleMin(col.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 16, padding: '0 2px' }} onMouseEnter={e => e.currentTarget.style.color = '#888'} onMouseLeave={e => e.currentTarget.style.color = '#ccc'}>−</button>
                      </div>
                    </div>
                    {ct.map(t => <TaskCard key={t.id} task={t} onEdit={t => { setForm({ ...t }); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId === t.id} onToggleSubtask={toggleSubtask} />)}
                    <button onClick={() => { setForm({ status: col.key }); setIsEdit(false) }}
                      style={{ width: '100%', marginTop: 4, padding: '7px 0', fontSize: 12, color: '#aaa', border: '0.5px dashed #ccc', borderRadius: 8, background: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#444' }} onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#aaa' }}>
                      + Add task
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Trash */}
      {tab === 'trash' && (
        <div>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Canceled tasks — click Restore to recover.</p>
          {tasks.filter(t => t.status === 'canceled').length === 0 && <div style={{ fontSize: 13, color: '#ccc', textAlign: 'center', padding: '2rem 0' }}>Trash bin is empty</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
            {tasks.filter(t => t.status === 'canceled').map(t => (
              <div key={t.id} style={{ background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 8, padding: '10px 12px', opacity: 0.75 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#888', textDecoration: 'line-through', marginBottom: 6 }}>{t.title}</div>
                {t.domain && <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>{t.domain}</div>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => moveTask(t.id, 'active')} style={{ fontSize: 11, background: '#111', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Restore</button>
                  <button onClick={() => deleteTask(t.id)} style={{ fontSize: 11, background: 'none', color: '#A32D2D', border: '0.5px solid #F09595', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          {[
            { name: 'Margarita Vulfova', ini: 'MV', role: 'Direct report', loc: 'Brooklyn, NY', bg: '#E1F5EE', tc: '#085041' },
            { name: 'Illya Ostrenko', ini: 'IO', role: 'Sr. Quality Systems Specialist', loc: 'Morristown, NJ', bg: '#E6F1FB', tc: '#0C447C' },
            { name: 'Matthew Miller', ini: 'MM', role: 'Quality Systems Specialist', loc: 'Greenwood, SC', bg: '#EEEDFE', tc: '#3C3489' },
            { name: 'Open — EMEA', ini: '?', role: 'France-based', loc: 'France', open: true },
            { name: 'Open — APAC', ini: '?', role: 'Asia-Pacific', loc: 'APAC', open: true },
          ].map(m => (
            <div key={m.name} style={{ background: 'white', border: `0.5px ${m.open ? 'dashed' : 'solid'} #e5e5e5`, borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.open ? '#f7f7f5' : m.bg, color: m.open ? '#aaa' : m.tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>{m.ini}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#111' }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.4 }}>{m.role}</div>
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>📍 {m.loc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <DomainSettings domains={domains} onUpdate={loadData} />
      )}

      {/* Task form */}
      {form !== null && (
        <TaskForm task={form} isEdit={isEdit} onSave={saveTask} onDelete={deleteTask} onClose={() => setForm(null)} domains={domains} />
      )}
    </div>
  )
}

// ─── Domain Settings ──────────────────────────────────────────────────────────
function DomainSettings({ domains, onUpdate }) {
  const [newDomain, setNewDomain] = useState('')
  const [editIdx, setEditIdx] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [domainData, setDomainData] = useState([])

  useEffect(() => {
    supabase.from('domains').select('*').order('sort_order').then(({ data }) => { if (data) setDomainData(data) })
  }, [domains])

  const addDomain = async () => {
    const val = newDomain.trim()
    if (!val) return
    const maxOrder = domainData.length ? Math.max(...domainData.map(d => d.sort_order)) : 0
    await supabase.from('domains').insert({ name: val, sort_order: maxOrder + 1 })
    setNewDomain('')
    onUpdate()
  }

  const removeDomain = async id => {
    await supabase.from('domains').delete().eq('id', id)
    onUpdate()
  }

  const saveEdit = async (id) => {
    const val = editVal.trim()
    if (!val) return
    await supabase.from('domains').update({ name: val }).eq('id', id)
    setEditIdx(null)
    onUpdate()
  }

  const moveUp = async (i) => {
    if (i === 0) return
    const a = domainData[i - 1], b = domainData[i]
    await Promise.all([
      supabase.from('domains').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('domains').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    onUpdate()
  }

  const moveDown = async (i) => {
    if (i === domainData.length - 1) return
    const a = domainData[i], b = domainData[i + 1]
    await Promise.all([
      supabase.from('domains').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('domains').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    onUpdate()
  }

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Domains</div>
      <div style={{ maxWidth: 520 }}>
        {domainData.map((d, i) => (
          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '9px 12px', background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 8 }}>
            <span style={{ fontSize: 11, color: '#ccc', minWidth: 20 }}>{i + 1}</span>
            {editIdx === d.id ? (
              <input autoFocus type="text" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(d.id); if (e.key === 'Escape') setEditIdx(null) }} style={{ flex: 1, fontSize: 13, border: 'none', outline: 'none', padding: 0 }} />
            ) : (
              <span style={{ flex: 1, fontSize: 13, color: '#111' }}>{d.name}</span>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {editIdx === d.id ? (
                <>
                  <button onClick={() => saveEdit(d.id)} style={{ fontSize: 11, background: '#111', color: 'white', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditIdx(null)} style={{ fontSize: 11, background: 'none', border: '0.5px solid #ddd', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: '#888' }}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => moveUp(i)} style={{ fontSize: 11, background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#aaa' }}>↑</button>
                  <button onClick={() => moveDown(i)} style={{ fontSize: 11, background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#aaa' }}>↓</button>
                  <button onClick={() => { setEditIdx(d.id); setEditVal(d.name) }} style={{ fontSize: 11, background: 'none', border: '0.5px solid #e5e5e5', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#888' }}>Edit</button>
                  <button onClick={() => removeDomain(d.id)} style={{ fontSize: 11, background: 'none', border: '0.5px solid #f0c0c0', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
                </>
              )}
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addDomain() }} placeholder="Add a new domain..." style={{ flex: 1, fontSize: 13, padding: '8px 10px', border: '0.5px solid #ddd', borderRadius: 8 }} />
          <button onClick={addDomain} style={{ fontSize: 12, background: '#111', color: 'white', border: 'none', borderRadius: 8, padding: '0 16px', cursor: 'pointer' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

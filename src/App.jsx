import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'

// ─── Constants ────────────────────────────────────────────────────────────────
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
const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const RECURRENCE_TYPES = [
  { key: '', label: 'Does not repeat' },
  { key: 'weekly_day', label: 'Weekly on day(s)' },
  { key: 'biweekly', label: 'Every 2 weeks' },
  { key: 'monthly_date', label: 'Monthly by date' },
  { key: 'monthly_dow', label: 'Monthly by weekday' },
]
const DOW_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const CAL_START_HOUR = 6
const CAL_END_HOUR = 22
const CAL_HOUR_H = 56
const CAL_TOTAL_H = (CAL_END_HOUR - CAL_START_HOUR) * CAL_HOUR_H

// ─── Pure Helpers ─────────────────────────────────────────────────────────────
const flagBg = c => ({ red: '#FCEBEB', orange: '#FFF0E8', yellow: '#FEFCE8', green: '#EAF3DE', blue: '#E6F1FB', violet: '#EEEDFE' }[c] || null)
const flagBorder = c => ({ red: '#E24B4A', orange: '#F97316', yellow: '#EAB308', green: '#639922', blue: '#378ADD', violet: '#7F77DD' }[c] || null)
const subStyle = k => SUBSTATUS.find(s => s.key === k) || SUBSTATUS[0]
const fmtTs = ts => { const d = new Date(ts); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }

// ─── Calendar Helpers ─────────────────────────────────────────────────────────
const toISODate = d => { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
const fromISODate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
const today = () => toISODate(new Date())

function startOfWeek(d) {
  const dt = new Date(d); dt.setDate(dt.getDate() - dt.getDay()); dt.setHours(0,0,0,0); return dt
}
function getWeekDates(ws) {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate()+i); return d })
}
function getMonthDates(year, month) {
  const first = new Date(year, month, 1), start = new Date(first)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate()+i); return d })
}
function isWeekday(d) { const w = d.getDay(); return w !== 0 && w !== 6 }
function adjustForBizDay(d, adj) {
  const dt = new Date(d)
  if (isWeekday(dt) || !adj) return dt
  if (adj === 'forward') { while (!isWeekday(dt)) dt.setDate(dt.getDate()+1) }
  else if (adj === 'backward') { while (!isWeekday(dt)) dt.setDate(dt.getDate()-1) }
  else {
    const fwd = new Date(dt), bkw = new Date(dt)
    while (!isWeekday(fwd)) fwd.setDate(fwd.getDate()+1)
    while (!isWeekday(bkw)) bkw.setDate(bkw.getDate()-1)
    return (fwd-dt) <= (dt-bkw) ? fwd : bkw
  }
  return dt
}
function getNthWeekday(year, month, dow, week) {
  if (week > 0) {
    const d = new Date(year, month, 1)
    while (d.getDay() !== dow) d.setDate(d.getDate()+1)
    d.setDate(d.getDate()+(week-1)*7)
    return d.getMonth() === month ? d : null
  } else {
    const d = new Date(year, month+1, 0)
    while (d.getDay() !== dow) d.setDate(d.getDate()-1)
    return d
  }
}
function expandRecurring(ev, rangeStart, rangeEnd) {
  const out = [], rd = ev.recurrence_data || {}
  const anchor = ev.recurrence_start ? fromISODate(ev.recurrence_start) : fromISODate(ev.start_date)
  const rEnd = ev.recurrence_end ? fromISODate(ev.recurrence_end) : null
  const rsStr = toISODate(rangeStart), reStr = toISODate(rangeEnd)
  const addOcc = dt => {
    if (rEnd && dt > rEnd) return
    if (dt < anchor) return
    const ds = toISODate(dt)
    if (ds >= rsStr && ds <= reStr) out.push({ ...ev, start_date: ds, _recurring: true })
  }
  if (ev.recurrence_type === 'weekly_day') {
    const days = (rd.days||[]).map(d => DOW_NUM[d]).filter(d => d !== undefined)
    const cur = new Date(rangeStart)
    while (cur <= rangeEnd) { if (days.includes(cur.getDay())) addOcc(new Date(cur)); cur.setDate(cur.getDate()+1) }
  } else if (ev.recurrence_type === 'biweekly') {
    const days = (rd.days||[]).map(d => DOW_NUM[d]).filter(d => d !== undefined)
    const anchorSun = new Date(anchor); anchorSun.setDate(anchorSun.getDate()-anchorSun.getDay())
    const cur = new Date(rangeStart)
    while (cur <= rangeEnd) {
      if (days.includes(cur.getDay())) {
        const wk = Math.round((cur-anchorSun)/(7*86400000))
        if (wk >= 0 && wk % 2 === 0) addOcc(new Date(cur))
      }
      cur.setDate(cur.getDate()+1)
    }
  } else if (ev.recurrence_type === 'monthly_date') {
    const date = rd.date||1, adj = rd.business_day_adjustment||null
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const endMo = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
    while (cur <= endMo) {
      const d = new Date(cur.getFullYear(), cur.getMonth(), date)
      if (d.getMonth() === cur.getMonth()) addOcc(adjustForBizDay(d, adj))
      cur.setMonth(cur.getMonth()+1)
    }
  } else if (ev.recurrence_type === 'monthly_dow') {
    const dow = DOW_NUM[rd.dow] ?? 1, week = rd.week||1
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const endMo = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
    while (cur <= endMo) {
      const d = getNthWeekday(cur.getFullYear(), cur.getMonth(), dow, week)
      if (d) addOcc(d)
      cur.setMonth(cur.getMonth()+1)
    }
  }
  return out
}
function getEventsForRange(events, rangeStart, rangeEnd) {
  const all = []
  for (const ev of events) {
    if (ev.recurrence_type) { all.push(...expandRecurring(ev, rangeStart, rangeEnd)) }
    else {
      const evS = fromISODate(ev.start_date), evE = ev.end_date ? fromISODate(ev.end_date) : evS
      if (evE >= rangeStart && evS <= rangeEnd) all.push(ev)
    }
  }
  return all
}
const timeToMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m }
const fmtTime = t => { const [h,m] = t.split(':').map(Number), ap = h>=12?'pm':'am', hh = h>12?h-12:h===0?12:h; return m===0?`${hh}${ap}`:`${hh}:${String(m).padStart(2,'0')}${ap}` }

// ─── World Clock ──────────────────────────────────────────────────────────────
function WorldClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div style={{ display:'flex', marginBottom:'1rem', background:'#f7f7f5', borderRadius:8, overflow:'hidden', border:'0.5px solid #e5e5e5' }}>
      {CITIES.map((c, i) => {
        const timeStr = now.toLocaleTimeString('en-US', { timeZone:c.tz, hour:'numeric', minute:'2-digit', hour12:true })
        const dayStr = now.toLocaleDateString('en-US', { timeZone:c.tz, weekday:'short' })
        const homeDay = now.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'short' })
        const isNext = dayStr !== homeDay && i > 1
        return (
          <div key={c.name} style={{ flex:1, padding:'6px 10px', borderRight:i<CITIES.length-1?'0.5px solid #e5e5e5':'none', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#aaa', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name.split(',')[0]}</div>
            <div style={{ fontSize:13, fontWeight:500, color:'#111', whiteSpace:'nowrap' }}>
              {timeStr}{isNext && <span style={{ fontSize:9, color:'#aaa', marginLeft:3 }}>+1</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ type, children }) {
  const s = { domain:{ background:'#E6F1FB', color:'#0C447C' }, owner:{ background:'#E1F5EE', color:'#085041' }, due:{ background:'#FAEEDA', color:'#633806' }, high:{ background:'#FCEBEB', color:'#791F1F' }, done:{ background:'#EAF3DE', color:'#27500A' } }[type] || {}
  return <span style={{ ...s, fontSize:11, padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap' }}>{children}</span>
}

// ─── Owner Pip ────────────────────────────────────────────────────────────────
function OwnerPip({ name }) {
  const c = MEMBER_COLORS[name] || { bg:'#f0f0f0', tc:'#888' }
  return <span title={name} style={{ width:18, height:18, borderRadius:'50%', background:c.bg, color:c.tc, fontSize:10, fontWeight:500, display:'inline-flex', alignItems:'center', justifyContent:'center', border:'0.5px solid rgba(0,0,0,0.08)' }}>{name[0]}</span>
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDragStart, onDragEnd, dragging, compact, onToggleSubtask, dropIndicator, onDragOver }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const done = task.status === 'done'
  const bg = flagBg(task.color), border = flagBorder(task.color)
  const hasNotes = task.notes && task.notes.length > 0
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : []
  const hasSubtasks = subtasks.length > 0
  const completedSubs = subtasks.filter(s => s.done).length
  const owners = task.owners || ['Levi']
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')

  return (
    <div style={{ position:'relative' }}>
      {dropIndicator === 'before' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginBottom:4 }} />}
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); onDragStart(task.id) }}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver ? e => { e.preventDefault(); onDragOver(task.id) } : undefined}
        onClick={() => onEdit(task)}
        style={{ background:bg||'white', border:border?`1px solid ${border}`:'0.5px solid #e5e5e5', borderRadius:8, padding:compact?'8px 10px':'10px 12px', marginBottom:8, userSelect:'none', opacity:dragging?0.4:1, cursor:'grab', width:'100%' }}
        onMouseEnter={e => { if (!border) e.currentTarget.style.borderColor='#bbb' }}
        onMouseLeave={e => { if (!border) e.currentTarget.style.borderColor='#e5e5e5' }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3, gap:4, minHeight:18 }}>
          <div>{task.domain && <span style={{ fontSize:10, fontWeight:500, background:'#E6F1FB', color:'#0C447C', padding:'2px 7px', borderRadius:6, whiteSpace:'nowrap', border:'0.5px solid #85B7EB' }}>{task.domain}</span>}</div>
          <div style={{ display:'flex', gap:3, flexShrink:0 }}>
            {task.substatus && (() => { const ss = subStyle(task.substatus); return <span style={{ fontSize:9, fontWeight:500, background:ss.bg, color:ss.tc, border:`0.5px solid ${ss.border}`, padding:'2px 6px', borderRadius:6, whiteSpace:'nowrap' }}>{ss.label}</span> })()}
            {task.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:6, whiteSpace:'nowrap', border:'0.5px solid #F09595' }}>High</span>}
          </div>
        </div>
        <div style={{ fontSize:13, fontWeight:500, color:done?'#999':'#111', textDecoration:done?'line-through':'none', marginBottom:4, lineHeight:1.4 }}>{task.title}</div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center', marginBottom:!compact&&(hasNotes||showOwners||hasSubtasks)?6:0 }}>
          {task.due && <Badge type="due">{task.due}</Badge>}
          {done && <Badge type="done">Done</Badge>}
        </div>
        {!compact && hasSubtasks && (
          <div>
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:3 }}>
              <button onClick={e => { e.stopPropagation(); setSubtasksOpen(o => !o) }} style={{ fontSize:10, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:4, padding:'2px 6px', cursor:'pointer' }}>
                {subtasksOpen ? 'hide subtasks' : `${completedSubs}/${subtasks.length} subtask${subtasks.length>1?'s':''}`}
              </button>
            </div>
            {subtasksOpen && (
              <div style={{ marginBottom:6, paddingLeft:2 }}>
                {subtasks.map(st => (
                  <div key={st.id} onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <input type="checkbox" checked={!!st.done} onChange={e => { e.stopPropagation(); onToggleSubtask(task.id, st.id, e.target.checked) }} style={{ width:12, height:12, cursor:'pointer' }} />
                    <span style={{ fontSize:11, color:st.done?'#aaa':'#444', textDecoration:st.done?'line-through':'none' }}>{st.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!compact && hasNotes && (
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:4 }}>
            <button onClick={e => { e.stopPropagation(); setNotesOpen(o => !o) }} style={{ fontSize:10, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:4, padding:'2px 6px', cursor:'pointer' }}>
              {notesOpen ? 'hide notes' : `${task.notes.length} note${task.notes.length>1?'s':''}`}
            </button>
          </div>
        )}
        {notesOpen && !compact && hasNotes && (
          <div style={{ marginBottom:8, borderTop:'0.5px solid #e5e5e5', paddingTop:8 }}>
            {task.notes.map(n => (
              <div key={n.id} style={{ fontSize:11, color:'#555', marginBottom:5, lineHeight:1.5 }}>
                <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
              </div>
            ))}
          </div>
        )}
        {!compact && showOwners && (
          <div style={{ display:'flex', gap:3, marginTop:2 }}>
            {owners.map(o => <OwnerPip key={o} name={o} />)}
          </div>
        )}
      </div>
      {dropIndicator === 'after' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginTop:-4, marginBottom:4 }} />}
    </div>
  )
}

// ─── Today Strip ──────────────────────────────────────────────────────────────
function TodayStrip({ tasks, onEdit, onDragStart, onDragEnd, draggingId, onDrop, onDragOver, onDragLeave, isOver, onRemove }) {
  const todayTasks = tasks.filter(t => t.today && t.status !== 'done')
  return (
    <div onDragOver={e => { e.preventDefault(); onDragOver('today') }} onDragLeave={onDragLeave} onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), 'today') }}
      style={{ marginBottom:12, background:isOver?'#EEF4FF':'#f7f7f5', border:isOver?'1.5px dashed #378ADD':'1.5px solid transparent', borderRadius:12, padding:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:todayTasks.length?10:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>Today</span>
          <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{todayTasks.length}</span>
        </div>
        <span style={{ fontSize:11, color:'#bbb' }}>Drag tasks here · or check in with Claude each morning</span>
      </div>
      {todayTasks.length > 0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
          {todayTasks.map(t => (
            <div key={t.id} style={{ position:'relative' }}>
              <TaskCard task={t} onEdit={onEdit} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={draggingId===t.id} compact />
              <button onClick={e => { e.stopPropagation(); onRemove(t.id) }} style={{ position:'absolute', top:4, right:4, background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#ccc' }} onMouseEnter={e => e.currentTarget.style.color='#333'} onMouseLeave={e => e.currentTarget.style.color='#ccc'}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize:12, color:'#ccc', padding:'8px 0' }}>No tasks for today — drag tasks here or check in with Claude</div>
      )}
    </div>
  )
}

// ─── Projects Strip ───────────────────────────────────────────────────────────
function ProjectsStrip({ projects, activeProject, onSelect }) {
  if (!projects.length) return null
  return (
    <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:2 }}>
      {[{ id: null, name: 'All', color: '' }, ...projects].map(p => {
        const active = activeProject === p.id
        const hex = p.color || '#999'
        return (
          <button key={p.id ?? 'all'} onClick={() => onSelect(p.id)}
            style={{ flexShrink:0, fontSize:12, padding:'4px 12px', borderRadius:16, cursor:'pointer', border:active?`1.5px solid ${p.id?hex:'#111'}`:'0.5px solid #e5e5e5', background:active?(p.id?flagBg(p.color)||'#f0f0f0':'#111'):'white', color:active?(p.id?flagBorder(p.color)||'#333':'white'):'#888', fontWeight:active?500:400, whiteSpace:'nowrap' }}>
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

// ─── Note Item ────────────────────────────────────────────────────────────────
function NoteItem({ note, onDelete, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(note.text)
  return (
    <div style={{ marginBottom:8, padding:'8px 10px', background:'#fafafa', borderRadius:6, border:'0.5px solid #f0f0f0' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:'#bbb', marginBottom:3 }}>{fmtTs(note.ts)}</div>
          {editing ? <textarea value={val} onChange={e => setVal(e.target.value)} autoFocus style={{ width:'100%', fontSize:12, height:56, resize:'none', fontFamily:'inherit', padding:'5px 7px', border:'0.5px solid #ddd', borderRadius:5 }} />
            : <div style={{ fontSize:12, color:'#444', lineHeight:1.5 }}>{note.text}</div>}
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          {editing ? <>
            <button onClick={() => { onSave(note.id, val.trim()); setEditing(false) }} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:4, padding:'2px 8px', cursor:'pointer' }}>Save</button>
            <button onClick={() => { setVal(note.text); setEditing(false) }} style={{ fontSize:11, background:'none', border:'0.5px solid #ccc', borderRadius:4, padding:'2px 8px', cursor:'pointer', color:'#666' }}>Cancel</button>
          </> : <button onClick={() => setEditing(true)} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:4, padding:'2px 7px', cursor:'pointer', color:'#888' }}>Edit</button>}
          <button onClick={() => onDelete(note.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:12 }} onMouseEnter={e => e.currentTarget.style.color='#E24B4A'} onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Form ────────────────────────────────────────────────────────────────
function TaskForm({ task, isEdit, onSave, onDelete, onClose, domains, projects }) {
  const EMPTY = { title:'', status:'active', domain:'', owners:['Levi'], due:'', priority:'', color:'', notes:[], today:false, substatus:'', subtasks:[], project_id:null }
  const [f, setF] = useState({ ...EMPTY, ...task, owners:Array.isArray(task?.owners)?task.owners:['Levi'], notes:Array.isArray(task?.notes)?task.notes:[], subtasks:Array.isArray(task?.subtasks)?task.subtasks:[] })
  const [newNote, setNewNote] = useState('')
  const [newSub, setNewSub] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]:v }))
  const toggleOwner = m => { const cur = f.owners||[]; if (cur.includes(m)) { if (cur.length>1) set('owners', cur.filter(o => o!==m)) } else set('owners', [...cur, m]) }
  const addNote = () => { const text = newNote.trim(); if (!text) return; set('notes', [...f.notes, { id:'n'+Date.now(), text, ts:Date.now() }]); setNewNote('') }
  const removeNote = id => set('notes', f.notes.filter(n => n.id!==id))
  const editNote = (id, text) => { if (!text) removeNote(id); else set('notes', f.notes.map(n => n.id===id?{...n,text}:n)) }
  const addSub = () => { const text = newSub.trim(); if (!text) return; set('subtasks', [...f.subtasks, { id:'st'+Date.now(), title:text, done:false }]); setNewSub('') }

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:30, zIndex:50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', padding:'1.25rem', width:'100%', maxWidth:480, maxHeight:'88vh', overflowY:'auto' }}>
        <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Task title..."
          style={{ width:'100%', fontSize:18, fontWeight:700, border:'none', outline:'none', marginBottom:14, color:'#111', background:'transparent', padding:0 }} />
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Status</label>
            <select value={f.status} onChange={e => set('status', e.target.value)} style={{ width:'100%', fontSize:13 }}>
              {['active','waiting','someday','done'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select></div>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Priority</label>
            <select value={f.priority} onChange={e => set('priority', e.target.value)} style={{ width:'100%', fontSize:13 }}>
              <option value="">Normal</option><option value="high">High</option>
            </select></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Sub-status</label>
            <select value={f.substatus||''} onChange={e => set('substatus', e.target.value)} style={{ width:'100%', fontSize:13 }}>
              {SUBSTATUS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></div>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Domain</label>
            <select value={f.domain} onChange={e => set('domain', e.target.value)} style={{ width:'100%', fontSize:13 }}>
              <option value="">— none —</option>
              {domains.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Due date</label>
            <input type="text" value={f.due} onChange={e => set('due', e.target.value)} placeholder="e.g. Sep 2025" style={{ width:'100%', fontSize:13 }} /></div>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:6 }}>Flag color</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width:fc.key?20:14, height:fc.key?20:14, borderRadius:'50%', background:fc.hex, border:f.color===fc.key?'2.5px solid #111':'2px solid transparent', cursor:'pointer', padding:0 }} />)}
            </div></div>
        </div>
        {projects && projects.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Project</label>
            <select value={f.project_id||''} onChange={e => set('project_id', e.target.value||null)} style={{ width:'100%', fontSize:13 }}>
              <option value="">— none —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:6 }}>Assigned to</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {MEMBERS.map(m => { const sel = (f.owners||[]).includes(m); const c = MEMBER_COLORS[m]||{}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize:12, padding:'4px 10px', borderRadius:16, cursor:'pointer', border:sel?`1.5px solid ${c.tc}`:'1px solid #e5e5e5', background:sel?c.bg:'white', color:sel?c.tc:'#888', fontWeight:sel?500:400 }}>{m}</button> })}
          </div>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#444', marginBottom:14, cursor:'pointer' }}>
          <input type="checkbox" checked={!!f.today} onChange={e => set('today', e.target.checked)} style={{ width:14, height:14 }} />Include in Today
        </label>
        <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4 }}>
          <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:8 }}>Subtasks</label>
          {f.subtasks.map(st => (
            <div key={st.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 8px', background:'#fafafa', borderRadius:6, border:'0.5px solid #f0f0f0' }}>
              <input type="checkbox" checked={!!st.done} onChange={e => setF(p => ({ ...p, subtasks:p.subtasks.map(s => s.id===st.id?{...s,done:e.target.checked}:s) }))} style={{ width:13, height:13, cursor:'pointer' }} />
              <span style={{ flex:1, fontSize:12, color:st.done?'#aaa':'#444', textDecoration:st.done?'line-through':'none' }}>{st.title}</span>
              <button onClick={() => setF(p => ({ ...p, subtasks:p.subtasks.filter(s => s.id!==st.id) }))} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:12 }} onMouseEnter={e => e.currentTarget.style.color='#E24B4A'} onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <input type="text" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key==='Enter') addSub() }} placeholder="Add a subtask..." style={{ flex:1, fontSize:12, padding:'6px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
            <button onClick={addSub} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:6, padding:'0 14px', cursor:'pointer' }}>Add</button>
          </div>
        </div>
        <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4, marginTop:4 }}>
          <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:8 }}>Notes</label>
          {f.notes.map(n => <NoteItem key={n.id} note={n} onDelete={removeNote} onSave={editNote} />)}
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <textarea value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&(e.metaKey||e.ctrlKey)) addNote() }} placeholder="Add a note... (⌘+Enter to save)" style={{ flex:1, fontSize:12, height:56, resize:'none', fontFamily:'inherit', padding:'7px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
            <button onClick={addNote} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:6, padding:'0 14px', cursor:'pointer' }}>Add</button>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
          <div>{isEdit && <button onClick={() => onDelete(task.id)} style={{ fontSize:13, color:'#A32D2D', background:'none', border:'0.5px solid #F09595', borderRadius:8, padding:'7px 14px', cursor:'pointer' }}>Delete</button>}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ fontSize:13, background:'none', border:'0.5px solid #ccc', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'#444' }}>Cancel</button>
            <button onClick={() => { if (f.title.trim()) onSave(f) }} style={{ fontSize:13, background:'#111', color:'white', border:'none', borderRadius:8, padding:'7px 16px', cursor:'pointer' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Event Form ──────────────────────────────────────────────────────
const CAL_EMPTY = { title:'', type:'event', start_date:today(), end_date:'', start_time:'09:00', end_time:'10:00', all_day:false, recurrence_type:'', recurrence_data:{}, recurrence_start:'', recurrence_end:'', owners:['Levi'], color:'', description:'' }

function CalendarEventForm({ event, isEdit, onSave, onDelete, onClose }) {
  const [f, setF] = useState({ ...CAL_EMPTY, ...event, recurrence_data: event?.recurrence_data || {} })
  const set = (k, v) => setF(p => ({ ...p, [k]:v }))
  const setRd = (k, v) => setF(p => ({ ...p, recurrence_data:{ ...p.recurrence_data, [k]:v } }))
  const toggleOwner = m => { const cur = f.owners||[]; if (cur.includes(m)) { if (cur.length>1) set('owners', cur.filter(o => o!==m)) } else set('owners', [...cur, m]) }
  const toggleDay = d => {
    const days = f.recurrence_data.days||[]
    setRd('days', days.includes(d) ? days.filter(x => x!==d) : [...days, d])
  }
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const rd = f.recurrence_data || {}

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:30, zIndex:50 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', padding:'1.25rem', width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto' }}>
        <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Event title..."
          style={{ width:'100%', fontSize:18, fontWeight:700, border:'none', outline:'none', marginBottom:14, color:'#111', background:'transparent', padding:0 }} />

        {/* Type */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[{ key:'event', label:'Event' }, { key:'travel', label:'✈ Travel block' }].map(t => (
            <button key={t.key} onClick={() => set('type', t.key)}
              style={{ fontSize:12, padding:'5px 14px', borderRadius:16, cursor:'pointer', border:f.type===t.key?'1.5px solid #111':'0.5px solid #e5e5e5', background:f.type===t.key?'#111':'white', color:f.type===t.key?'white':'#888', fontWeight:f.type===t.key?500:400 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Dates */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Start date</label>
            <input type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} style={{ width:'100%', fontSize:13 }} /></div>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>{f.type==='travel'?'End date':'End date (optional)'}</label>
            <input type="date" value={f.end_date} onChange={e => set('end_date', e.target.value)} style={{ width:'100%', fontSize:13 }} /></div>
        </div>

        {/* Times + all day */}
        {f.type !== 'travel' && (
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#444', marginBottom:8, cursor:'pointer' }}>
              <input type="checkbox" checked={!!f.all_day} onChange={e => set('all_day', e.target.checked)} style={{ width:14, height:14 }} />All day
            </label>
            {!f.all_day && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Start time</label>
                  <input type="time" value={f.start_time} onChange={e => set('start_time', e.target.value)} style={{ width:'100%', fontSize:13 }} /></div>
                <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>End time</label>
                  <input type="time" value={f.end_time} onChange={e => set('end_time', e.target.value)} style={{ width:'100%', fontSize:13 }} /></div>
              </div>
            )}
          </div>
        )}

        {/* Recurrence */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Repeats</label>
          <select value={f.recurrence_type} onChange={e => { set('recurrence_type', e.target.value); setF(p => ({ ...p, recurrence_data:{} })) }} style={{ width:'100%', fontSize:13, marginBottom:8 }}>
            {RECURRENCE_TYPES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>

          {(f.recurrence_type === 'weekly_day' || f.recurrence_type === 'biweekly') && (
            <div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {weekdays.map(d => {
                  const sel = (rd.days||[]).includes(d)
                  return <button key={d} onClick={() => toggleDay(d)} style={{ fontSize:12, padding:'4px 10px', borderRadius:16, cursor:'pointer', border:sel?'1.5px solid #111':'0.5px solid #e5e5e5', background:sel?'#111':'white', color:sel?'white':'#888' }}>{d}</button>
                })}
              </div>
              {f.recurrence_type === 'biweekly' && (
                <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Starting from (anchor week)</label>
                  <input type="date" value={f.recurrence_start||f.start_date} onChange={e => set('recurrence_start', e.target.value)} style={{ width:'100%', fontSize:13 }} /></div>
              )}
            </div>
          )}

          {f.recurrence_type === 'monthly_date' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Day of month</label>
                <input type="number" min={1} max={31} value={rd.date||1} onChange={e => setRd('date', parseInt(e.target.value)||1)} style={{ width:'100%', fontSize:13 }} /></div>
              <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>If weekend</label>
                <select value={rd.business_day_adjustment||''} onChange={e => setRd('business_day_adjustment', e.target.value||null)} style={{ width:'100%', fontSize:13 }}>
                  <option value="">No adjustment</option>
                  <option value="forward">Move to Monday</option>
                  <option value="backward">Move to Friday</option>
                  <option value="nearest">Nearest weekday</option>
                </select></div>
            </div>
          )}

          {f.recurrence_type === 'monthly_dow' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Which week</label>
                <select value={rd.week||1} onChange={e => setRd('week', parseInt(e.target.value))} style={{ width:'100%', fontSize:13 }}>
                  <option value={1}>1st</option><option value={2}>2nd</option><option value={3}>3rd</option><option value={4}>4th</option><option value={-1}>Last</option>
                </select></div>
              <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Day of week</label>
                <select value={rd.dow||'Mon'} onChange={e => setRd('dow', e.target.value)} style={{ width:'100%', fontSize:13 }}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <option key={d} value={d}>{d}</option>)}
                </select></div>
            </div>
          )}

          {f.recurrence_type && (
            <div style={{ marginTop:8 }}>
              <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Recurrence ends (optional)</label>
              <input type="date" value={f.recurrence_end||''} onChange={e => set('recurrence_end', e.target.value)} style={{ width:'50%', fontSize:13 }} />
            </div>
          )}
        </div>

        {/* Owners */}
        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:6 }}>Attendees</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {MEMBERS.map(m => { const sel = (f.owners||[]).includes(m); const c = MEMBER_COLORS[m]||{}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize:12, padding:'4px 10px', borderRadius:16, cursor:'pointer', border:sel?`1.5px solid ${c.tc}`:'1px solid #e5e5e5', background:sel?c.bg:'white', color:sel?c.tc:'#888', fontWeight:sel?500:400 }}>{m}</button> })}
          </div>
        </div>

        {/* Color + description */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:6 }}>Color</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width:fc.key?20:14, height:fc.key?20:14, borderRadius:'50%', background:fc.hex, border:f.color===fc.key?'2.5px solid #111':'2px solid transparent', cursor:'pointer', padding:0 }} />)}
            </div></div>
          <div><label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Location</label>
            <input type="text" value={f.location||''} onChange={e => set('location', e.target.value)} placeholder="optional" style={{ width:'100%', fontSize:13 }} /></div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:12, color:'#888', display:'block', marginBottom:4 }}>Notes</label>
          <textarea value={f.description||''} onChange={e => set('description', e.target.value)} placeholder="Add notes..." rows={3} style={{ width:'100%', fontSize:12, resize:'vertical', fontFamily:'inherit', padding:'7px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>{isEdit && <button onClick={() => onDelete(event.id)} style={{ fontSize:13, color:'#A32D2D', background:'none', border:'0.5px solid #F09595', borderRadius:8, padding:'7px 14px', cursor:'pointer' }}>Delete</button>}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ fontSize:13, background:'none', border:'0.5px solid #ccc', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'#444' }}>Cancel</button>
            <button onClick={() => { if (f.title.trim()) onSave(f) }} style={{ fontSize:13, background:'#111', color:'white', border:'none', borderRadius:8, padding:'7px 16px', cursor:'pointer' }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Week View ───────────────────────────────────────────────────────
function CalendarWeekView({ events, weekStart, onDayClick, onEventClick }) {
  const HOURS = Array.from({ length: CAL_END_HOUR - CAL_START_HOUR }, (_, i) => i + CAL_START_HOUR)
  const weekDates = getWeekDates(weekStart)
  const rangeStart = weekDates[0], rangeEnd = weekDates[6]
  const allExpanded = getEventsForRange(events, rangeStart, rangeEnd)
  const todayStr = today()

  const allDayEvs = allExpanded.filter(ev => ev.all_day || ev.type === 'travel' || (ev.end_date && ev.end_date !== ev.start_date))
  const timedEvs = allExpanded.filter(ev => !ev.all_day && ev.type !== 'travel' && ev.start_time && !(ev.end_date && ev.end_date !== ev.start_date))

  const evsByDay = weekDates.map(d => {
    const ds = toISODate(d)
    return timedEvs.filter(ev => ev.start_date === ds)
  })

  const evTop = t => { const [h,m] = t.split(':').map(Number); return ((h - CAL_START_HOUR) * 60 + m) * (CAL_HOUR_H / 60) }
  const evH = (s, e) => e ? Math.max((timeToMin(e) - timeToMin(s)) * (CAL_HOUR_H / 60), 22) : CAL_HOUR_H

  return (
    <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden', background:'white' }}>
      {/* Day headers */}
      <div style={{ display:'flex', borderBottom:'0.5px solid #e5e5e5' }}>
        <div style={{ width:50, flexShrink:0 }} />
        {weekDates.map((d, i) => {
          const ds = toISODate(d), isToday = ds === todayStr
          return (
            <div key={i} onClick={() => onDayClick(d)} style={{ flex:1, textAlign:'center', padding:'10px 0 8px', borderLeft:'0.5px solid #f0f0f0', cursor:'pointer' }}>
              <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.04em' }}>{DOW_SHORT[d.getDay()]}</div>
              <div style={{ width:30, height:30, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:300, marginTop:2, background:isToday?'#111':'transparent', color:isToday?'white':'#111' }}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day row */}
      {allDayEvs.length > 0 && (
        <div style={{ display:'flex', borderBottom:'0.5px solid #e5e5e5', minHeight:32 }}>
          <div style={{ width:50, flexShrink:0, fontSize:9, color:'#ccc', padding:'8px 4px 0 6px' }}>all-day</div>
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'4px 2px', borderLeft:'0.5px solid #f0f0f0' }}>
            {allDayEvs.map((ev, i) => {
              const evS = fromISODate(ev.start_date)
              const evE = ev.end_date ? fromISODate(ev.end_date) : evS
              const dispS = evS < rangeStart ? rangeStart : evS
              const dispE = evE > rangeEnd ? rangeEnd : evE
              const sc = Math.max(0, weekDates.findIndex(d => toISODate(d) === toISODate(dispS))) + 1
              const ec = Math.min(7, weekDates.findIndex(d => toISODate(d) === toISODate(dispE))) + 2
              const bg = ev.type === 'travel' ? '#FAEEDA' : (flagBg(ev.color) || '#E6F1FB')
              const bdr = ev.type === 'travel' ? '#FAC775' : (flagBorder(ev.color) || '#85B7EB')
              return (
                <div key={i} onClick={() => onEventClick(ev)} style={{ gridColumn:`${sc}/${ec}`, fontSize:10, padding:'3px 6px', borderRadius:4, cursor:'pointer', background:bg, border:`0.5px solid ${bdr}`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#333' }}>
                  {ev.type === 'travel' && '✈ '}{ev.title}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Time grid */}
      <div style={{ overflowY:'auto', maxHeight:520 }}>
        <div style={{ display:'flex', height:CAL_TOTAL_H, position:'relative' }}>
          {/* Hour labels */}
          <div style={{ width:50, flexShrink:0, position:'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={{ position:'absolute', top:(h-CAL_START_HOUR)*CAL_HOUR_H, width:'100%', fontSize:10, color:'#ccc', textAlign:'right', paddingRight:8, paddingTop:2 }}>
                {h===12?'12pm':h>12?`${h-12}pm`:`${h}am`}
              </div>
            ))}
          </div>
          {/* Day columns */}
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', position:'relative', borderLeft:'0.5px solid #f0f0f0' }}>
            {/* Hour lines */}
            {HOURS.map(h => (
              <div key={h} style={{ position:'absolute', left:0, right:0, top:(h-CAL_START_HOUR)*CAL_HOUR_H, borderTop:`0.5px solid ${h===12?'#e0e0e0':'#f0f0f0'}`, pointerEvents:'none' }} />
            ))}
            {/* Now line */}
            {(() => {
              const now = new Date(), h = now.getHours(), m = now.getMinutes()
              if (h >= CAL_START_HOUR && h < CAL_END_HOUR && weekDates.some(d => toISODate(d) === todayStr)) {
                const top = ((h - CAL_START_HOUR) * 60 + m) * (CAL_HOUR_H / 60)
                return <div style={{ position:'absolute', left:0, right:0, top, borderTop:'1.5px solid #E24B4A', pointerEvents:'none', zIndex:2 }} />
              }
            })()}
            {weekDates.map((d, di) => {
              const ds = toISODate(d), isToday = ds === todayStr
              return (
                <div key={di} onClick={() => onDayClick(d)} style={{ position:'relative', borderLeft:di>0?'0.5px solid #f0f0f0':'none', background:isToday?'#fefffe':'transparent', cursor:'pointer', minHeight:CAL_TOTAL_H }}>
                  {evsByDay[di].map((ev, ei) => {
                    const top = evTop(ev.start_time)
                    const height = evH(ev.start_time, ev.end_time)
                    const bg = flagBg(ev.color) || '#E6F1FB'
                    const bdr = flagBorder(ev.color) || '#85B7EB'
                    return (
                      <div key={`${ev.id}-${ei}`} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                        style={{ position:'absolute', top, height, left:2, right:2, borderRadius:4, cursor:'pointer', background:bg, border:`0.5px solid ${bdr}`, padding:'2px 4px', overflow:'hidden', zIndex:1 }}>
                        <div style={{ fontSize:10, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#333' }}>{ev.title}</div>
                        {height > 28 && <div style={{ fontSize:9, color:'#666' }}>{fmtTime(ev.start_time)}{ev.end_time&&` – ${fmtTime(ev.end_time)}`}</div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Month View ──────────────────────────────────────────────────────
function CalendarMonthView({ events, year, month, onDayClick, onEventClick }) {
  const dates = getMonthDates(year, month)
  const todayStr = today()
  const rangeStart = dates[0], rangeEnd = dates[41]
  const expanded = getEventsForRange(events, rangeStart, rangeEnd)

  const evsByDay = {}
  expanded.forEach(ev => {
    const ds = ev.start_date
    if (!evsByDay[ds]) evsByDay[ds] = []
    evsByDay[ds].push(ev)
  })

  return (
    <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden', background:'white' }}>
      {/* DOW headers */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'0.5px solid #e5e5e5' }}>
        {DOW_SHORT.map(d => <div key={d} style={{ textAlign:'center', fontSize:10, color:'#aaa', padding:'8px 0', textTransform:'uppercase' }}>{d}</div>)}
      </div>
      {/* Day cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
        {dates.map((d, i) => {
          const ds = toISODate(d), isToday = ds === todayStr, inMonth = d.getMonth() === month
          const dayEvs = evsByDay[ds] || []
          const visible = dayEvs.slice(0, 3), overflow = dayEvs.length - 3
          return (
            <div key={i} onClick={() => onDayClick(d)}
              style={{ minHeight:80, padding:'6px 4px 4px', borderTop:i>=7?'0.5px solid #f0f0f0':undefined, borderLeft:i%7!==0?'0.5px solid #f0f0f0':undefined, cursor:'pointer', background:'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, marginBottom:3, background:isToday?'#111':'transparent', color:isToday?'white':inMonth?'#111':'#ccc', fontWeight:isToday?500:400 }}>
                {d.getDate()}
              </div>
              {visible.map((ev, ei) => {
                const bg = ev.type==='travel'?'#FAEEDA':(flagBg(ev.color)||'#E6F1FB')
                const bdr = ev.type==='travel'?'#FAC775':(flagBorder(ev.color)||'#85B7EB')
                return (
                  <div key={ei} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    style={{ fontSize:10, padding:'1px 5px', borderRadius:3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:bg, border:`0.5px solid ${bdr}`, color:'#333', cursor:'pointer' }}>
                    {ev.type==='travel'&&'✈ '}{ev.start_time&&!ev.all_day?`${fmtTime(ev.start_time)} `:''}
                    {ev.title}
                  </div>
                )
              })}
              {overflow > 0 && <div style={{ fontSize:9, color:'#888', paddingLeft:4 }}>+{overflow} more</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────
function CalendarTab({ events, onSave, onDelete }) {
  const [calView, setCalView] = useState('week')
  const [calDate, setCalDate] = useState(() => startOfWeek(new Date()))
  const [eventForm, setEventForm] = useState(null)
  const [isEdit, setIsEdit] = useState(false)

  const weekStart = calView === 'week' ? calDate : startOfWeek(calDate)
  const year = calDate.getFullYear(), month = calDate.getMonth()

  const nav = dir => {
    setCalDate(d => {
      const nd = new Date(d)
      if (calView === 'week') nd.setDate(nd.getDate() + dir * 7)
      else nd.setMonth(nd.getMonth() + dir)
      return nd
    })
  }

  const goToday = () => setCalDate(calView === 'week' ? startOfWeek(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  const headerLabel = calView === 'week'
    ? (() => { const wd = getWeekDates(calDate); return `${wd[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${wd[6].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` })()
    : `${MONTH_NAMES[month]} ${year}`

  const handleDayClick = d => setEventForm({ ...CAL_EMPTY, start_date: toISODate(d) })

  const handleEventClick = ev => { setEventForm({ ...ev }); setIsEdit(true) }

  const handleSave = async data => {
    const payload = {
      title: data.title, type: data.type||'event',
      start_date: data.start_date, end_date: data.end_date||null,
      start_time: data.all_day||data.type==='travel'?null:(data.start_time||null),
      end_time: data.all_day||data.type==='travel'?null:(data.end_time||null),
      all_day: !!data.all_day || data.type==='travel',
      recurrence_type: data.recurrence_type||null,
      recurrence_data: data.recurrence_type?data.recurrence_data:{},
      recurrence_start: data.recurrence_type?(data.recurrence_start||data.start_date):null,
      recurrence_end: data.recurrence_end||null,
      owners: data.owners||['Levi'], color: data.color||'',
      description: data.description||'', location: data.location||'',
    }
    if (isEdit && eventForm?.id) await supabase.from('calendar_events').update(payload).eq('id', eventForm.id)
    else await supabase.from('calendar_events').insert(payload)
    setEventForm(null); setIsEdit(false); onSave()
  }

  const handleDelete = async id => {
    await supabase.from('calendar_events').delete().eq('id', id)
    setEventForm(null); setIsEdit(false); onSave()
  }

  return (
    <div>
      {/* Nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => nav(-1)} style={{ background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:14, color:'#555' }}>‹</button>
          <button onClick={goToday} style={{ fontSize:12, background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'#555' }}>Today</button>
          <button onClick={() => nav(1)} style={{ background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, width:28, height:28, cursor:'pointer', fontSize:14, color:'#555' }}>›</button>
          <span style={{ fontSize:15, fontWeight:500, color:'#111', marginLeft:4 }}>{headerLabel}</span>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <div style={{ display:'flex', background:'#f7f7f5', borderRadius:8, border:'0.5px solid #e5e5e5', overflow:'hidden' }}>
            {['week','month'].map(v => (
              <button key={v} onClick={() => setCalView(v)} style={{ fontSize:12, padding:'5px 12px', border:'none', background:calView===v?'white':'transparent', color:calView===v?'#111':'#888', fontWeight:calView===v?500:400, cursor:'pointer', borderRight:v==='week'?'0.5px solid #e5e5e5':undefined }}>
                {v.charAt(0).toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => { setEventForm({ ...CAL_EMPTY }); setIsEdit(false) }} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>+ Event</button>
        </div>
      </div>

      {calView === 'week'
        ? <CalendarWeekView events={events} weekStart={calDate} onDayClick={handleDayClick} onEventClick={handleEventClick} />
        : <CalendarMonthView events={events} year={year} month={month} onDayClick={handleDayClick} onEventClick={handleEventClick} />}

      {eventForm !== null && (
        <CalendarEventForm event={eventForm} isEdit={isEdit} onSave={handleSave} onDelete={handleDelete} onClose={() => { setEventForm(null); setIsEdit(false) }} />
      )}
    </div>
  )
}

// ─── Team Board Tab ───────────────────────────────────────────────────────────
const TEAM_MEMBERS = [
  { key: 'all', label: 'All' },
  { key: 'Levi', label: 'Levi' },
  { key: 'Margarita', label: 'Margarita', full: 'Margarita Vulfova', role: 'Direct Report', loc: 'Brooklyn, NY' },
  { key: 'Illya', label: 'Illya', full: 'Illya Ostrenko', role: 'Sr. Quality Systems Specialist', loc: 'Morristown, NJ' },
  { key: 'Matthew', label: 'Matthew', full: 'Matthew Miller', role: 'Quality Systems Specialist', loc: 'Greenwood, SC' },
]

function TeamBoardTab({ tasks, onEdit, onDragStart, onDragEnd, draggingId, onDrop, onDragOver, onDragLeave, overCol, toggleSubtask }) {
  const [member, setMember] = useState('all')
  const filtered = member === 'all' ? tasks : tasks.filter(t => (t.owners||['Levi']).includes(member))
  const visible = filtered.filter(t => t.status !== 'canceled')
  const info = TEAM_MEMBERS.find(m => m.key === member)

  return (
    <div>
      {/* Member selector */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {TEAM_MEMBERS.map(m => {
          const active = member === m.key
          const c = MEMBER_COLORS[m.key] || {}
          return (
            <button key={m.key} onClick={() => setMember(m.key)}
              style={{ fontSize:12, padding:'5px 14px', borderRadius:16, cursor:'pointer', border:active?(m.key==='all'||!c.tc?'1.5px solid #111':`1.5px solid ${c.tc}`):'0.5px solid #e5e5e5', background:active?(m.key==='all'?'#111':c.bg||'#f0f0f0'):'white', color:active?(m.key==='all'?'white':c.tc||'#333'):'#888', fontWeight:active?500:400 }}>
              {m.label}
            </button>
          )
        })}
        {[
          { key:'emea', label:'Open — EMEA', open:true },
          { key:'apac', label:'Open — APAC', open:true },
        ].map(m => (
          <button key={m.key} style={{ fontSize:12, padding:'5px 14px', borderRadius:16, border:'0.5px dashed #ddd', background:'white', color:'#bbb', cursor:'default' }}>{m.label}</button>
        ))}
      </div>

      {/* Member info card */}
      {info && info.full && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'10px 14px', background:'#f7f7f5', borderRadius:10, border:'0.5px solid #e5e5e5' }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:(MEMBER_COLORS[member]||{}).bg||'#f0f0f0', color:(MEMBER_COLORS[member]||{}).tc||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:500 }}>{info.label[0]}</div>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:'#111' }}>{info.full}</div>
            <div style={{ fontSize:12, color:'#888' }}>{info.role} · {info.loc}</div>
          </div>
          <div style={{ marginLeft:'auto', fontSize:12, color:'#888' }}>{visible.length} task{visible.length!==1?'s':''}</div>
        </div>
      )}

      {/* Board */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
        {COLS.map(col => {
          const ct = visible.filter(t => t.status === col.key)
          const colKey = `team-${col.key}-${member}`
          return (
            <div key={col.key} onDragOver={e => { e.preventDefault(); onDragOver(col.key) }} onDragLeave={onDragLeave} onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), col.key) }}
              style={{ flex:1, minWidth:0, background:overCol===col.key?'#EEF4FF':'#f7f7f5', border:overCol===col.key?'1.5px dashed #378ADD':'1.5px solid transparent', borderRadius:12, padding:12, minHeight:180 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{col.lbl}</span>
                <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
              </div>
              {ct.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tasks, setTasks] = useState([])
  const [domains, setDomains] = useState([])
  const [projects, setProjects] = useState([])
  const [calEvents, setCalEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tasks')
  const [form, setForm] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [minimized, setMinimized] = useState({})
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  const [mobileCol, setMobileCol] = useState('active')
  const [viewMode, setViewMode] = useState('order') // 'order' | 'dynamic' | 'domain'
  const [activeProject, setActiveProject] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { col, taskId, position }

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: tasksData }, { data: domainsData }, { data: projectsData }, { data: calData }] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
      supabase.from('domains').select('*').order('sort_order', { ascending: true }),
      supabase.from('projects').select('*').order('sort_order', { ascending: true }),
      supabase.from('calendar_events').select('*').order('created_at', { ascending: true }),
    ])
    if (tasksData) setTasks(tasksData.map(t => ({ ...t, owners: t.owners||['Levi'], notes: t.notes||[], subtasks: t.subtasks||[] })))
    if (domainsData) setDomains(domainsData.map(d => d.name))
    if (projectsData) setProjects(projectsData)
    if (calData) setCalEvents(calData)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const ch = supabase.channel('app-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, () => loadData())
      .on('postgres_changes', { event:'*', schema:'public', table:'calendar_events' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const saveTask = async data => {
    const payload = {
      title: data.title, status: data.status, domain: data.domain||'',
      owners: data.owners||['Levi'], due: data.due||'', priority: data.priority||'',
      color: data.color||'', substatus: data.substatus||'',
      notes: data.notes||[], today: !!data.today, subtasks: data.subtasks||[],
      updated_at: new Date().toISOString(),
    }
    if (data.project_id !== undefined) payload.project_id = data.project_id || null
    if (isEdit && form?.id) {
      await supabase.from('tasks').update(payload).eq('id', form.id)
    } else {
      const maxOrder = tasks.length ? Math.max(...tasks.map(t => t.sort_order||0)) : 0
      await supabase.from('tasks').insert({ ...payload, sort_order: maxOrder+1 })
    }
    setForm(null)
    await loadData()
  }

  const deleteTask = async id => {
    await supabase.from('tasks').delete().eq('id', id)
    setForm(null); await loadData()
  }

  const moveTask = async (id, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const toggleToday = async (id, todayVal) => {
    await supabase.from('tasks').update({ today: todayVal, updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const toggleSubtask = async (taskId, subtaskId, done) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const subtasks = (task.subtasks||[]).map(s => s.id===subtaskId?{...s,done}:s)
    await supabase.from('tasks').update({ subtasks, updated_at: new Date().toISOString() }).eq('id', taskId)
    await loadData()
  }

  const reorderTask = async (dragId, targetId, position, col) => {
    const colTasks = tasks.filter(t => t.status === col && t.status !== 'canceled').sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
    const dragIdx = colTasks.findIndex(t => t.id === dragId)
    const targetIdx = colTasks.findIndex(t => t.id === targetId)
    if (dragIdx === -1) return
    const moved = colTasks.splice(dragIdx < 0 ? colTasks.length : dragIdx, dragIdx >= 0 ? 1 : 0)
    const insertAt = position === 'before' ? targetIdx : targetIdx + 1
    const adjustedInsert = dragIdx < targetIdx ? insertAt - 1 : insertAt
    colTasks.splice(Math.max(0, adjustedInsert), 0, ...moved)
    const updates = colTasks.map((t, i) => supabase.from('tasks').update({ sort_order: i+1, status: col, updated_at: new Date().toISOString() }).eq('id', t.id))
    await Promise.all(updates)
    await loadData()
  }

  const drop = async (id, col) => {
    if (!id) return
    if (col === 'today') { await toggleToday(id, true) }
    else {
      if (dropTarget && dropTarget.taskId && viewMode === 'dynamic') {
        await reorderTask(id, dropTarget.taskId, dropTarget.position, col)
      } else {
        await moveTask(id, col)
      }
    }
    setDraggingId(null); setOverCol(null); setDropTarget(null)
  }

  const removeFromToday = async id => { await toggleToday(id, false) }
  const toggleMin = key => setMinimized(m => ({ ...m, [key]: !m[key] }))

  const activeCols = COLS.filter(c => !minimized[c.key])
  const minCols = COLS.filter(c => minimized[c.key])

  const projectFilteredTasks = activeProject
    ? tasks.filter(t => t.project_id === activeProject)
    : tasks

  const getColTasks = (colKey) => projectFilteredTasks.filter(t => t.status === colKey && t.status !== 'canceled')

  if (loading) return (
    <div style={{ fontFamily:'system-ui,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#888', fontSize:14 }}>
      Loading TASKr...
    </div>
  )

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', padding:isMobile?'0.75rem':'1.25rem 1.5rem', maxWidth:1400, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.25rem', paddingBottom:'1rem', borderBottom:'0.5px solid #e5e5e5' }}>
        <h1 style={{ fontSize:18, fontWeight:500, color:'#111', margin:0 }}>💪🏻 TASKr Dashboard</h1>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={{ fontSize:12, color:'#aaa' }}>{new Date().toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric', year:'numeric' })}</span>
          <span style={{ fontSize:10, color:'#bbb' }}>Live · Supabase</span>
        </div>
      </div>

      <WorldClock />

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:'1.25rem', borderBottom:'0.5px solid #e5e5e5' }}>
        {[
          { key:'tasks', label:'Task board' },
          { key:'calendar', label:'Calendar' },
          { key:'team', label:'Team' },
          { key:'trash', label:`Trash${tasks.filter(t=>t.status==='canceled').length>0?` (${tasks.filter(t=>t.status==='canceled').length})`:''}`},
          { key:'settings', label:'⚙️ Settings' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ fontSize:13, padding:'6px 14px 8px', cursor:'pointer', background:'none', border:'none', borderBottom:tab===t.key?'2px solid #111':'2px solid transparent', color:tab===t.key?'#111':'#888', fontWeight:tab===t.key?500:400, marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Task Board ── */}
      {tab === 'tasks' && (
        <>
          {/* View controls */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
            <div style={{ display:'flex', gap:6 }}>
              {minCols.map(col => (
                <div key={col.key} onClick={() => toggleMin(col.key)} style={{ background:'#f7f7f5', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, fontWeight:500, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em' }}>{col.lbl}</span>
                  <span style={{ fontSize:10, color:'#ccc', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'1px 5px' }}>{getColTasks(col.key).length}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {/* View mode */}
              <div style={{ display:'flex', background:'#f7f7f5', borderRadius:8, border:'0.5px solid #e5e5e5', overflow:'hidden' }}>
                {[{ k:'order', l:'In order' }, { k:'dynamic', l:'Dynamic' }, { k:'domain', l:'By domain' }].map((v, i, arr) => (
                  <button key={v.k} onClick={() => setViewMode(v.k)} style={{ fontSize:11, padding:'4px 10px', border:'none', background:viewMode===v.k?'white':'transparent', color:viewMode===v.k?'#111':'#888', fontWeight:viewMode===v.k?500:400, cursor:'pointer', borderRight:i<arr.length-1?'0.5px solid #e5e5e5':undefined }}>
                    {v.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Today strip */}
          <TodayStrip tasks={projectFilteredTasks} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} draggingId={draggingId} onDrop={drop} onDragOver={setOverCol} onDragLeave={() => setOverCol(null)} isOver={overCol==='today'} onRemove={removeFromToday} />

          {/* Projects strip */}
          <ProjectsStrip projects={projects} activeProject={activeProject} onSelect={setActiveProject} />

          {/* ── Domain grouped view ── */}
          {viewMode === 'domain' && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', overflowX:'auto' }}>
              {[...domains.map(d => ({ key:d, lbl:d })), { key:'', lbl:'No domain' }].map(domCol => {
                const ct = projectFilteredTasks.filter(t => (t.domain||'') === domCol.key && t.status !== 'canceled')
                if (ct.length === 0 && domCol.key !== '') return null
                return (
                  <div key={domCol.key} style={{ flex:'0 0 220px', background:'#f7f7f5', borderRadius:12, padding:12, minHeight:180 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:500, color:domCol.key?'#0C447C':'#aaa', textTransform:'uppercase', letterSpacing:'0.06em' }}>{domCol.lbl}</span>
                      <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                    </div>
                    {ct.map(t => (
                      <div key={t.id} style={{ marginBottom:8 }}>
                        <TaskCard task={t} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} />
                      </div>
                    ))}
                    <button onClick={() => { setForm({ domain: domCol.key, status:'active' }); setIsEdit(false) }} style={{ width:'100%', marginTop:4, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>
                      + Add task
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Standard / Dynamic column view ── */}
          {viewMode !== 'domain' && (
            isMobile ? (
              <div>
                <div style={{ display:'flex', gap:6, marginBottom:10, overflowX:'auto' }}>
                  {COLS.map(col => {
                    const ct = getColTasks(col.key), active = mobileCol===col.key
                    return <button key={col.key} onClick={() => setMobileCol(col.key)} style={{ flexShrink:0, fontSize:12, padding:'6px 14px', borderRadius:20, cursor:'pointer', border:active?'1.5px solid #111':'0.5px solid #ddd', background:active?'#111':'white', color:active?'white':'#888', fontWeight:active?500:400, display:'flex', alignItems:'center', gap:6 }}>
                      {col.lbl}<span style={{ fontSize:10, background:active?'rgba(255,255,255,0.2)':'#f0f0f0', color:active?'white':'#aaa', borderRadius:8, padding:'1px 6px' }}>{ct.length}</span>
                    </button>
                  })}
                </div>
                {COLS.filter(c => c.key===mobileCol).map(col => {
                  const ct = getColTasks(col.key)
                  return <div key={col.key} onDragOver={e => { e.preventDefault(); setOverCol(col.key) }} onDragLeave={() => setOverCol(null)} onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), col.key) }} style={{ background:'#f7f7f5', borderRadius:12, padding:12, minHeight:200 }}>
                    {ct.map(t => <TaskCard key={t.id} task={t} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} />)}
                    <button onClick={() => { setForm({ status:col.key }); setIsEdit(false) }} style={{ width:'100%', marginTop:8, padding:'10px 0', fontSize:13, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>+ Add task</button>
                  </div>
                })}
              </div>
            ) : (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                {activeCols.map(col => {
                  const ct = getColTasks(col.key)
                  return (
                    <div key={col.key}
                      onDragOver={e => { e.preventDefault(); setOverCol(col.key) }}
                      onDragLeave={() => { setOverCol(null); setDropTarget(null) }}
                      onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), col.key) }}
                      style={{ flex:1, minWidth:0, background:overCol===col.key?'#EEF4FF':'#f7f7f5', border:overCol===col.key?'1.5px dashed #378ADD':'1.5px solid transparent', borderRadius:12, padding:12, minHeight:220 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{col.lbl}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                          <button onClick={() => toggleMin(col.key)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:16, padding:'0 2px' }} onMouseEnter={e => e.currentTarget.style.color='#888'} onMouseLeave={e => e.currentTarget.style.color='#ccc'}>−</button>
                        </div>
                      </div>
                      {ct.map(t => (
                        <TaskCard key={t.id} task={t}
                          onEdit={t => { setForm({...t}); setIsEdit(true) }}
                          onDragStart={id => setDraggingId(id)}
                          onDragEnd={() => { setDraggingId(null); setOverCol(null); setDropTarget(null) }}
                          dragging={draggingId===t.id}
                          onToggleSubtask={toggleSubtask}
                          dropIndicator={dropTarget?.col===col.key&&dropTarget?.taskId===t.id?dropTarget.position:null}
                          onDragOver={viewMode==='dynamic'?taskId => setDropTarget({ col:col.key, taskId, position:'before' }):null}
                        />
                      ))}
                      <button onClick={() => { setForm({ status:col.key }); setIsEdit(false) }}
                        style={{ width:'100%', marginTop:4, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#444' }}
                        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#aaa' }}>
                        + Add task
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </>
      )}

      {/* ── Calendar ── */}
      {tab === 'calendar' && (
        <CalendarTab events={calEvents} onSave={loadData} onDelete={loadData} />
      )}

      {/* ── Team Board ── */}
      {tab === 'team' && (
        <TeamBoardTab
          tasks={tasks}
          onEdit={t => { setForm({...t}); setIsEdit(true) }}
          onDragStart={id => setDraggingId(id)}
          onDragEnd={() => { setDraggingId(null); setOverCol(null) }}
          draggingId={draggingId}
          onDrop={drop}
          onDragOver={setOverCol}
          onDragLeave={() => setOverCol(null)}
          overCol={overCol}
          toggleSubtask={toggleSubtask}
        />
      )}

      {/* ── Trash ── */}
      {tab === 'trash' && (
        <div>
          <p style={{ fontSize:13, color:'#888', marginBottom:16 }}>Canceled tasks — click Restore to recover.</p>
          {tasks.filter(t => t.status==='canceled').length === 0 && <div style={{ fontSize:13, color:'#ccc', textAlign:'center', padding:'2rem 0' }}>Trash bin is empty</div>}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
            {tasks.filter(t => t.status==='canceled').map(t => (
              <div key={t.id} style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'10px 12px', opacity:0.75 }}>
                <div style={{ fontSize:13, fontWeight:500, color:'#888', textDecoration:'line-through', marginBottom:6 }}>{t.title}</div>
                {t.domain && <div style={{ fontSize:11, color:'#aaa', marginBottom:8 }}>{t.domain}</div>}
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button onClick={() => moveTask(t.id, 'active')} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>Restore</button>
                  <button onClick={() => deleteTask(t.id)} style={{ fontSize:11, background:'none', color:'#A32D2D', border:'0.5px solid #F09595', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <DomainSettings domains={domains} onUpdate={loadData} />
      )}

      {/* Task form modal */}
      {form !== null && (
        <TaskForm task={form} isEdit={isEdit} onSave={saveTask} onDelete={deleteTask} onClose={() => setForm(null)} domains={domains} projects={projects} />
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
    const val = newDomain.trim(); if (!val) return
    const maxOrder = domainData.length ? Math.max(...domainData.map(d => d.sort_order)) : 0
    await supabase.from('domains').insert({ name:val, sort_order:maxOrder+1 })
    setNewDomain(''); onUpdate()
  }
  const removeDomain = async id => { await supabase.from('domains').delete().eq('id', id); onUpdate() }
  const saveEdit = async id => {
    const val = editVal.trim(); if (!val) return
    await supabase.from('domains').update({ name:val }).eq('id', id)
    setEditIdx(null); onUpdate()
  }
  const moveUp = async i => {
    if (i===0) return
    const a = domainData[i-1], b = domainData[i]
    await Promise.all([supabase.from('domains').update({ sort_order:b.sort_order }).eq('id',a.id), supabase.from('domains').update({ sort_order:a.sort_order }).eq('id',b.id)]); onUpdate()
  }
  const moveDown = async i => {
    if (i===domainData.length-1) return
    const a = domainData[i], b = domainData[i+1]
    await Promise.all([supabase.from('domains').update({ sort_order:b.sort_order }).eq('id',a.id), supabase.from('domains').update({ sort_order:a.sort_order }).eq('id',b.id)]); onUpdate()
  }

  return (
    <div>
      <div style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Domains</div>
      <div style={{ maxWidth:520 }}>
        {domainData.map((d, i) => (
          <div key={d.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'9px 12px', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8 }}>
            <span style={{ fontSize:11, color:'#ccc', minWidth:20 }}>{i+1}</span>
            {editIdx===d.id
              ? <input autoFocus type="text" value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key==='Enter') saveEdit(d.id); if (e.key==='Escape') setEditIdx(null) }} style={{ flex:1, fontSize:13, border:'none', outline:'none', padding:0 }} />
              : <span style={{ flex:1, fontSize:13, color:'#111' }}>{d.name}</span>}
            <div style={{ display:'flex', gap:4 }}>
              {editIdx===d.id ? <>
                <button onClick={() => saveEdit(d.id)} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:4, padding:'3px 8px', cursor:'pointer' }}>Save</button>
                <button onClick={() => setEditIdx(null)} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:4, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Cancel</button>
              </> : <>
                <button onClick={() => moveUp(i)} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:4, padding:'2px 6px', cursor:'pointer', color:'#aaa' }}>↑</button>
                <button onClick={() => moveDown(i)} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:4, padding:'2px 6px', cursor:'pointer', color:'#aaa' }}>↓</button>
                <button onClick={() => { setEditIdx(d.id); setEditVal(d.name) }} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:4, padding:'2px 6px', cursor:'pointer', color:'#888' }}>Edit</button>
                <button onClick={() => removeDomain(d.id)} style={{ fontSize:11, background:'none', border:'0.5px solid #f0c0c0', borderRadius:4, padding:'2px 6px', cursor:'pointer', color:'#A32D2D' }}>✕</button>
              </>}
            </div>
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => { if (e.key==='Enter') addDomain() }} placeholder="Add a new domain..." style={{ flex:1, fontSize:13, padding:'8px 10px', border:'0.5px solid #ddd', borderRadius:8 }} />
          <button onClick={addDomain} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'0 16px', cursor:'pointer' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

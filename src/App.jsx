import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabase'
import DOMPurify from 'dompurify'
import { Newspaper, RefreshCw, NotebookPen, CalendarDays, Settings, LayoutList, StickyNote } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const MEMBERS = ['Levi', 'Margarita', 'Illya', 'Matthew']
const COLS = [
  { key: 'hopper',      lbl: 'Hopper' },
  { key: 'not_started', lbl: 'Not started' },
  { key: 'in_progress', lbl: 'In progress' },
  { key: 'at_risk',     lbl: 'At risk' },
  { key: 'on_hold',     lbl: 'On hold' },
  { key: 'complete',    lbl: 'Complete' },
]
const SUBSTATUS = [
  { key: '', label: '—' },
  { key: 'hopper', label: 'Hopper', bg: '#FFFBE6', tc: '#7A5C00', border: '#C9960A' },
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
  { name: 'Puebla, MX', tz: 'America/Mexico_City' },
  { name: 'Greenwood, SC', tz: 'America/New_York' },
  { name: 'Bornem/Colmar', tz: 'Europe/Paris' },
  { name: 'Rewari, India', tz: 'Asia/Kolkata' },
  { name: 'Jakarta', tz: 'Asia/Jakarta' },
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
  { key: 'monthly_biz_day', label: 'Monthly by Nth business day' },
]
const DOW_NUM = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// US federal holiday rules — type:'fixed'|'nth'|'last', dow: JS day-of-week 0=Sun
const US_HOLIDAY_DEFS = [
  { name: "New Year's Day",    type:'fixed', month:1,  day:1  },
  { name: "MLK Day",           type:'nth',   month:1,  dow:1, n:3 },
  { name: "Presidents' Day",   type:'nth',   month:2,  dow:1, n:3 },
  { name: "Memorial Day",      type:'last',  month:5,  dow:1  },
  { name: "Juneteenth",        type:'fixed', month:6,  day:19 },
  { name: "Independence Day",  type:'fixed', month:7,  day:4  },
  { name: "Labor Day",         type:'nth',   month:9,  dow:1, n:1 },
  { name: "Columbus Day",      type:'nth',   month:10, dow:1, n:2 },
  { name: "Veterans Day",      type:'fixed', month:11, day:11 },
  { name: "Thanksgiving Day",  type:'nth',   month:11, dow:4, n:4 },
  { name: "Christmas Day",     type:'fixed', month:12, day:25 },
]

const CAL_START_HOUR = 6
const CAL_END_HOUR = 22
const CAL_HOUR_H = 56
const CAL_TOTAL_H = (CAL_END_HOUR - CAL_START_HOUR) * CAL_HOUR_H

// ─── Pure Helpers ─────────────────────────────────────────────────────────────
const flagBg = c => ({ red: '#FCEBEB', orange: '#FFF0E8', yellow: '#FEFCE8', green: '#EAF3DE', blue: '#E6F1FB', violet: '#EEEDFE' }[c] || null)
const flagBorder = c => ({ red: '#E24B4A', orange: '#F97316', yellow: '#EAB308', green: '#639922', blue: '#378ADD', violet: '#7F77DD' }[c] || null)
const evTypeBg = ev => ev.type==='travel'?'#FAEEDA':ev.type==='audit'?'#EDE9FE':ev.type==='vacation'?'#DCFCE7':ev.type==='holiday'?'#f0fdf4':(flagBg(ev.color)||'#E6F1FB')
const evTypeBdr = ev => ev.type==='travel'?'#FAC775':ev.type==='audit'?'#A78BFA':ev.type==='vacation'?'#6EE7B7':ev.type==='holiday'?'#86efac':(flagBorder(ev.color)||'#85B7EB')
const evTypeTc = ev => ev.type==='travel'?'#633806':ev.type==='audit'?'#5B21B6':ev.type==='vacation'?'#065F46':ev.type==='holiday'?'#15803d':'#0C447C'
const evTypeIcon = ev => ev.type==='travel'?'✈ ':ev.type==='audit'?'🔍 ':ev.type==='vacation'?'🌴 ':ev.type==='holiday'?'★ ':''
const subStyle = k => SUBSTATUS.find(s => s.key === k) || SUBSTATUS[0]
const fmtTs = ts => { const d = new Date(ts); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
const fmtDateTime = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) }

// ─── Shared modal / form styling (matches the app's menu + pill language) ──────
const MODAL_OVERLAY = { position:'fixed', inset:0, background:'rgba(40,30,60,0.32)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'max(30px, env(safe-area-inset-top))', paddingBottom:'env(safe-area-inset-bottom)', paddingLeft:'env(safe-area-inset-left)', paddingRight:'env(safe-area-inset-right)' }
const MODAL_CARD = { background:'white', borderRadius:16, border:'0.5px solid #e5e5e5', boxShadow:'0 12px 40px rgba(80,60,120,0.18)', padding:'1.1rem 1.25rem', width:'100%', maxHeight:'88dvh', overflowY:'auto', overscrollBehavior:'contain', WebkitOverflowScrolling:'touch' }
const FIELD_LABEL = { fontSize:10, fontWeight:600, color:'#a99fc0', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }
const FIELD_SELECT = { width:'100%', fontSize:13, padding:'7px 9px', border:'0.5px solid #e0e0e0', borderRadius:8, background:'white', outline:'none', fontFamily:'inherit', color:'#333', cursor:'pointer' }
const FIELD_INPUT = { width:'100%', boxSizing:'border-box', fontSize:13, padding:'7px 9px', border:'0.5px solid #e0e0e0', borderRadius:8, background:'white', outline:'none', fontFamily:'inherit', color:'#333' }
const BTN_PRIMARY = { fontSize:13, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:500, fontFamily:'inherit' }
const BTN_GHOST = { fontSize:13, background:'white', border:'0.5px solid #c4b5fd', borderRadius:8, cursor:'pointer', color:'#7c3aed', fontFamily:'inherit' }

// Created / Modified timestamp line shown at the top of task & project/escalation popups
function TimestampMeta({ created, updated }) {
  if (!created && !updated) return null
  const showEdited = updated && updated !== created
  return (
    <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:10, color:'#bbb', marginBottom:14 }}>
      {created && <span>Created {fmtDateTime(created)}</span>}
      {showEdited && <span style={{ color:'#c4b5fd' }}>· Modified {fmtDateTime(updated)}</span>}
    </div>
  )
}

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
function generateUSHolidays(year, calendarId) {
  return US_HOLIDAY_DEFS.map(h => {
    let d
    if (h.type === 'fixed') {
      d = new Date(year, h.month - 1, h.day)
    } else if (h.type === 'nth') {
      d = getNthWeekday(year, h.month - 1, h.dow, h.n)
    } else {
      d = getNthWeekday(year, h.month - 1, h.dow, 0) // last
    }
    if (!d) return null
    return { title: h.name, type: 'holiday', all_day: true, start_date: toISODate(d), end_date: null, calendar_id: calendarId, owners: [], color: '', emoji: '' }
  }).filter(Boolean)
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
  } else if (ev.recurrence_type === 'monthly_biz_day') {
    const n = rd.biz_day || 1
    const cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const endMo = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
    while (cur <= endMo) {
      let count = 0
      const d = new Date(cur.getFullYear(), cur.getMonth(), 1)
      const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
      while (d.getDate() <= lastDay) {
        if (d.getDay() !== 0 && d.getDay() !== 6) { count++; if (count === n) { addOcc(new Date(d)); break } }
        d.setDate(d.getDate() + 1)
      }
      cur.setMonth(cur.getMonth() + 1)
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
function WorldClock({ style: extraStyle = {} }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return (
    <div style={{ display:'flex', overflowX:'auto', WebkitOverflowScrolling:'touch', ...extraStyle }}>
      {CITIES.map((c, i) => {
        const timeStr = now.toLocaleTimeString('en-US', { timeZone:c.tz, hour:'numeric', minute:'2-digit', hour12:true })
        const dayStr = now.toLocaleDateString('en-US', { timeZone:c.tz, weekday:'short' })
        const homeDay = now.toLocaleDateString('en-US', { timeZone:'America/New_York', weekday:'short' })
        const isNext = dayStr !== homeDay && i > 1
        return (
          <div key={c.name} style={{ flex:'1 0 72px', padding:'9px 12px', borderLeft:'0.5px solid rgba(255,255,255,0.15)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center' }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.55)', marginBottom:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'0.07em' }}>{c.name.split(',')[0]}</div>
            <div style={{ fontSize:13, fontWeight:500, color:'rgba(255,255,255,0.95)', whiteSpace:'nowrap' }}>
              {timeStr}{isNext && <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginLeft:3 }}>+1</span>}
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
  return <span style={{ ...s, fontSize:11, padding:'2px 7px', borderRadius:20, whiteSpace:'nowrap' }}>{children}</span>
}

// ─── Owner Pip ────────────────────────────────────────────────────────────────
function OwnerPip({ name }) {
  const c = MEMBER_COLORS[name] || { bg:'#f0f0f0', tc:'#888' }
  return <span title={name} style={{ width:18, height:18, borderRadius:'50%', background:c.bg, color:c.tc, fontSize:10, fontWeight:500, display:'inline-flex', alignItems:'center', justifyContent:'center', border:'0.5px solid rgba(0,0,0,0.08)' }}>{name[0]}</span>
}

// ─── Task Card ────────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onDragStart, onDragEnd, dragging, compact, onToggleSubtask, dropIndicator, onDragOver, onComplete, entityMap = {} }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [subtasksOpen, setSubtasksOpen] = useState(false)
  const done = task.substatus === 'complete'
  const bg = flagBg(task.color), border = flagBorder(task.color)
  const hasNotes = task.notes && task.notes.length > 0
  const attachCount = Array.isArray(task.attachments) ? task.attachments.length : 0
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : []
  const hasSubtasks = subtasks.length > 0
  const completedSubs = subtasks.filter(s => s.done).length
  const owners = task.owners || ['Levi']
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')
  const linkedEntity = entityMap[task.project_id] || entityMap[task.escalation_id] || null

  return (
    <div style={{ position:'relative' }}>
      {dropIndicator === 'before' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginBottom:4 }} />}
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(task.id)); onDragStart(task.id) }}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver ? e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onDragOver(task.id, e.clientY < r.top + r.height / 2 ? 'before' : 'after') } : undefined}
        onClick={() => onEdit(task)}
        style={{ background:bg||'white', border:border?`1px solid ${border}`:'0.5px solid #e5e5e5', borderRadius:8, padding:compact?'8px 10px':'10px 12px', marginBottom:4, userSelect:'none', opacity:dragging?0.4:1, cursor:'grab', width:'100%', boxSizing:'border-box' }}
        onMouseEnter={e => { if (!border) e.currentTarget.style.borderColor='#bbb' }}
        onMouseLeave={e => { if (!border) e.currentTarget.style.borderColor='#e5e5e5' }}
      >
        {!done && (
          <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:3, marginBottom:3 }}>
            {linkedEntity && <span style={{ fontSize:10, fontWeight:500, background:linkedEntity.type==='project'?'#EAF3DE':'#FCEBEB', color:linkedEntity.type==='project'?'#27500A':'#791F1F', padding:'2px 7px', borderRadius:20, border:`0.5px solid ${linkedEntity.type==='project'?'#97C459':'#F09595'}`, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{linkedEntity.name}</span>}
            {task.domain && <span style={{ fontSize:10, fontWeight:500, background:'#E6F1FB', color:'#0C447C', padding:'2px 7px', borderRadius:20, border:'0.5px solid #85B7EB', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.domain}</span>}
            {task.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap', border:'0.5px solid #F09595' }}>High</span>}
          </div>
        )}
        <div style={{ fontSize:done?11:13, fontWeight:500, color:done?'#999':'#111', textDecoration:done?'line-through':'none', marginBottom:done?0:4, lineHeight:1.4, overflowWrap:'break-word', wordBreak:'break-word' }}>{task.title}</div>
        {!done && (
          <>
            {subtasksOpen && !compact && hasSubtasks && (
              <div style={{ marginBottom:6, paddingLeft:2, marginTop:4 }}>
                {subtasks.map(st => (
                  <div key={st.id} onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <input type="checkbox" checked={!!st.done} disabled={!!st.na} onChange={e => { e.stopPropagation(); onToggleSubtask(task.id, st.id, e.target.checked) }} style={{ width:12, height:12, cursor:st.na?'default':'pointer' }} />
                    <span style={{ fontSize:11, color:(st.done||st.na)?'#aaa':'#444', textDecoration:(st.done||st.na)?'line-through':'none', opacity:st.na?0.6:1 }}>{st.title}{st.na&&<span style={{ fontSize:9, marginLeft:4, color:'#bbb' }}>N/A</span>}</span>
                  </div>
                ))}
              </div>
            )}
            {notesOpen && !compact && hasNotes && (
              <div style={{ marginBottom:6, borderTop:'0.5px solid #e5e5e5', paddingTop:8, marginTop:4 }}>
                {task.notes.map(n => (
                  <div key={n.id} style={{ fontSize:11, color:'#555', marginBottom:5, lineHeight:1.5 }}>
                    <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
                  </div>
                ))}
              </div>
            )}
            {!compact && (showOwners || task.due || hasSubtasks || hasNotes || attachCount > 0) && (
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6, flexWrap:'wrap' }}>
                {showOwners && owners.map(o => <OwnerPip key={o} name={o} />)}
                {task.due && <Badge type="due">{task.due}</Badge>}
                {hasSubtasks && (
                  <button onClick={e => { e.stopPropagation(); setSubtasksOpen(o => !o) }} style={{ fontSize:10, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:20, padding:'2px 6px', cursor:'pointer' }}>
                    {completedSubs}/{subtasks.length} sub
                  </button>
                )}
                {hasNotes && (
                  <button onClick={e => { e.stopPropagation(); setNotesOpen(o => !o) }} style={{ fontSize:10, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:20, padding:'2px 6px', cursor:'pointer' }}>
                    {task.notes.length} note{task.notes.length>1?'s':''}
                  </button>
                )}
                {attachCount > 0 && (
                  <span style={{ fontSize:10, color:'#aaa', background:'none', border:'0.5px solid #ddd', borderRadius:20, padding:'2px 6px' }}>📎 {attachCount}</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {onComplete && (
        <button
          onClick={e => { e.stopPropagation(); onComplete(task.id, !done) }}
          title={done ? 'Mark incomplete' : 'Mark complete'}
          style={{ position:'absolute', bottom:5, right:5, width:14, height:14, borderRadius:'50%', border:`1px solid ${done?'#97C459':'#ccc'}`, background:done?'#EAF3DE':'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, color:done?'#27500A':'#bbb', padding:0, lineHeight:1 }}
          onMouseEnter={e => { if (!done) { e.currentTarget.style.borderColor='#97C459'; e.currentTarget.style.color='#27500A'; e.currentTarget.style.background='#EAF3DE' } }}
          onMouseLeave={e => { if (!done) { e.currentTarget.style.borderColor='#ccc'; e.currentTarget.style.color='#bbb'; e.currentTarget.style.background='white' } }}>
          ✓
        </button>
      )}
      {dropIndicator === 'after' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginTop:-4, marginBottom:4 }} />}
    </div>
  )
}

// ─── Today Strip ──────────────────────────────────────────────────────────────
function TodayStrip({ tasks, onEdit, onDragStart, onDragEnd, draggingId, onDrop, onDragOver, onDragLeave, isOver, onRemove, onAdd, onComplete, entityMap = {}, isOpen = true, onToggle, onTaskDragOver, todayDropTarget }) {
  const todayTasks = tasks.filter(t => t.today && t.substatus !== 'complete').sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
  return (
    <div onDragOver={e => { e.preventDefault(); onDragOver('today') }} onDragLeave={onDragLeave} onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), 'today') }}
      style={{ background:isOver?'#EEF4FF':'#f7f7f5', border:isOver?'1.5px dashed #378ADD':'1.5px solid transparent', borderRadius:12, padding:12 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isOpen && todayTasks.length ? 10 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>Today</span>
          <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{todayTasks.length}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {isOpen && (
            <>
              <button onClick={onAdd} style={{ fontSize:11, color:'#aaa', background:'none', border:'0.5px dashed #ccc', borderRadius:6, padding:'3px 10px', cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#444' }}
                onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#aaa' }}>+ Add task</button>
              <span className="desktop-only" style={{ fontSize:11, color:'#bbb' }}>or drag tasks here</span>
            </>
          )}
          <button onClick={onToggle} style={{ background:'none', border:'none', cursor:'pointer', padding:'0 2px', color:'#bbb', fontSize:10, lineHeight:1 }}>
            {isOpen ? '▴' : '▾'}
          </button>
        </div>
      </div>
      {isOpen && (todayTasks.length > 0 ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8 }}>
          {todayTasks.map(t => (
            <div key={t.id} style={{ position:'relative' }}>
              <TaskCard task={t} onEdit={onEdit} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={draggingId===t.id} compact onComplete={onComplete} entityMap={entityMap}
                onDragOver={onTaskDragOver ? (taskId, pos) => onTaskDragOver(taskId, pos) : null}
                dropIndicator={todayDropTarget?.taskId === t.id ? todayDropTarget.position : null} />
              <button onClick={e => { e.stopPropagation(); onRemove(t.id) }} style={{ position:'absolute', top:4, right:4, background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#ccc' }} onMouseEnter={e => e.currentTarget.style.color='#333'} onMouseLeave={e => e.currentTarget.style.color='#ccc'}>✕</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize:12, color:'#ccc', padding:'8px 0' }}>No tasks for today — drag tasks here or check in with Claude</div>
      ))}
    </div>
  )
}

// ─── Confirm Delete Button ────────────────────────────────────────────────────
function ConfirmDeleteButton({ onConfirm, children = 'Delete', style: btnStyle = {} }) {
  const [confirming, setConfirming] = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  if (confirming) {
    return (
      <span style={{ display:'inline-flex', gap:4, alignItems:'center' }}>
        <button onClick={() => { clearTimeout(timer.current); setConfirming(false); onConfirm() }}
          style={{ ...btnStyle, background:'#A32D2D', color:'white', border:'none' }}>Sure?</button>
        <button onClick={() => { clearTimeout(timer.current); setConfirming(false) }}
          style={{ fontSize: btnStyle.fontSize||11, background:'none', border:'0.5px solid #e0e0e0', borderRadius: btnStyle.borderRadius||6, padding: btnStyle.padding||'4px 8px', cursor:'pointer', color:'#888', fontFamily:'inherit' }}>No</button>
      </span>
    )
  }
  return (
    <button onClick={() => { setConfirming(true); timer.current = setTimeout(() => setConfirming(false), 3000) }}
      style={btnStyle}>{children}</button>
  )
}

// ─── Detail Popup (Project / Escalation) ─────────────────────────────────────
const STATUS_DOT = { active:'#378ADD', waiting:'#F0A500', someday:'#bbb', done:'#48A868' }
function DetailPopup({ entity, entityType, tasks, domains, onClose, onDelete, onSaveEntity, onSaveTask, onDeleteTask, members = MEMBERS }) {
  const isProject = entityType === 'project'
  const RED = '#c0392b'

  const [f, setF] = useState({
    title:    entity.title    || '',
    status:   entity.status   || 'active',
    domain:   entity.domain   || '',
    owners:   Array.isArray(entity.owners) ? entity.owners : ['Levi'],
    due:      entity.due      || '',
    priority: entity.priority || '',
    color:    entity.color    || '',
    substatus:entity.substatus|| '',
    notes:    Array.isArray(entity.notes) ? entity.notes : [],
    attachments: Array.isArray(entity.attachments) ? entity.attachments : [],
  })
  const [newNote, setNewNote] = useState('')
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editNoteText, setEditNoteText] = useState('')
  const set = (k, v) => setF(p => ({ ...p, [k]:v }))
  const toggleOwner = m => { const cur = f.owners||[]; if (cur.includes(m)) { set('owners', cur.filter(o=>o!==m)) } else set('owners', [...cur,m]) }
  const addNote = () => { const text=newNote.trim(); if(!text) return; set('notes',[...f.notes,{id:'n'+Date.now(),text,ts:Date.now()}]); setNewNote('') }
  const removeNote = id => setF(p => ({ ...p, notes: p.notes.filter(n=>n.id!==id) }))
  const startEditNote = n => { setEditingNoteId(n.id); setEditNoteText(n.text) }
  const commitEditNote = () => {
    if (!editingNoteId) return
    const text = editNoteText.trim()
    const eid = editingNoteId
    if (text) setF(p => ({ ...p, notes: p.notes.map(n => n.id===eid ? {...n, text} : n) }))
    else setF(p => ({ ...p, notes: p.notes.filter(n => n.id!==eid) }))
    setEditingNoteId(null); setEditNoteText('')
  }

  const linkedTasks = isProject
    ? tasks.filter(t => t.project_id === entity.id)
    : tasks.filter(t => t.escalation_id === entity.id)

  const [taskForm, setTaskForm] = useState(null)
  const [isEditTask, setIsEditTask] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importSearch, setImportSearch] = useState('')
  const openAddTask = () => {
    setTaskForm({ title:'', status:'active', domain:'', owners:['Levi'], due:'', priority:'', color:'', notes:[], today:false, substatus:'', subtasks:[], attachments:[], project_id:isProject?entity.id:null, escalation_id:!isProject?entity.id:null })
    setIsEditTask(false)
  }
  const openEditTask = t => { setTaskForm({...t}); setIsEditTask(true) }
  const linkTask = async t => {
    const updated = { ...t, project_id: isProject ? entity.id : t.project_id, escalation_id: !isProject ? entity.id : t.escalation_id }
    await onSaveTask(updated, t.id)
    setImportOpen(false); setImportSearch('')
  }
  const importableTasks = tasks
    .filter(t => t.substatus !== 'canceled' && t.status !== 'canceled')
    .filter(t => isProject ? t.project_id !== entity.id : t.escalation_id !== entity.id)
    .filter(t => !importSearch || t.title.toLowerCase().includes(importSearch.toLowerCase()))

  return (
    <>
      <div style={{ ...MODAL_OVERLAY, zIndex:50 }}>
        <div style={{ ...MODAL_CARD, maxWidth:520 }}>

          {/* Title */}
          <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)}
            placeholder={isProject ? 'Project title...' : 'Escalation title...'}
            style={{ width:'100%', fontSize:18, fontWeight:700, border:'none', outline:'none', marginBottom: 6, color:isProject?'#111':RED, background:'transparent', padding:0 }} />
          <TimestampMeta created={entity.created_at} updated={entity.updated_at} />
          {entity.template_name && (
            <div style={{ marginBottom:14 }}>
              <span style={{ fontSize:11, color:'#7c3aed', background:'#ede9fe', border:'0.5px solid #c4b5fd', borderRadius:20, padding:'2px 10px' }}>
                Template: {entity.template_name}
              </span>
            </div>
          )}

          {/* Status + Priority + Due */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
            <div><label style={FIELD_LABEL}>Status</label>
              <select value={f.substatus||''} onChange={e => set('substatus', e.target.value)} style={FIELD_SELECT}>
                {SUBSTATUS.filter(s => s.key !== 'canceled').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select></div>
            <div><label style={FIELD_LABEL}>Priority</label>
              <select value={f.priority} onChange={e => set('priority', e.target.value)} style={FIELD_SELECT}>
                <option value="">Normal</option><option value="high">High</option>
              </select></div>
            <div><label style={FIELD_LABEL}>Due date</label>
              <DatePicker value={f.due} onChange={v => set('due', v)} /></div>
          </div>

          {/* Domain + Flag color */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, alignItems:'end' }}>
            <div><label style={FIELD_LABEL}>Domain</label>
              <select value={f.domain} onChange={e => set('domain', e.target.value)} style={FIELD_SELECT}>
                <option value="">— none —</option>
                {domains.map(d => <option key={d} value={d}>{d}</option>)}
              </select></div>
            <div><label style={FIELD_LABEL}>Flag color</label>
              <div style={{ display:'flex', gap:5, alignItems:'center', height:32, flexWrap:'wrap' }}>
                {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width:fc.key?18:13, height:fc.key?18:13, borderRadius:'50%', background:fc.hex, border:f.color===fc.key?'2.5px solid #111':'2px solid transparent', cursor:'pointer', padding:0 }} />)}
              </div></div>
          </div>

          {/* Assigned to */}
          <div style={{ marginBottom:12 }}>
            <label style={FIELD_LABEL}>Assigned to</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {members.map(m => { const sel=(f.owners||[]).includes(m); const c=MEMBER_COLORS[m]||{}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:sel?`1.5px solid ${c.tc}`:'0.5px solid #e5e5e5', background:sel?c.bg:'white', color:sel?c.tc:'#888', fontWeight:sel?500:400 }}>{m}</button> })}
            </div>
          </div>

          {/* Notes */}
          <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4 }}>
            <label style={FIELD_LABEL}>Notes</label>
            {f.notes.map(n => (
              <div key={n.id} style={{ fontSize:11, color:'#555', marginBottom:6, lineHeight:1.5, display:'flex', gap:8, alignItems:'flex-start' }}>
                <span style={{ color:'#bbb', fontSize:10, marginTop:1, flexShrink:0 }}>{fmtTs(n.ts)}</span>
                {editingNoteId === n.id ? (
                  <input
                    autoFocus
                    value={editNoteText}
                    onChange={e => setEditNoteText(e.target.value)}
                    onBlur={commitEditNote}
                    onKeyDown={e => { if (e.key==='Enter') commitEditNote(); if (e.key==='Escape') { setEditingNoteId(null); setEditNoteText('') } }}
                    style={{ flex:1, fontSize:11, padding:'2px 4px', border:'0.5px solid #bbb', borderRadius:6 }}
                  />
                ) : (
                  <span style={{ flex:1, cursor:'text' }} onClick={() => startEditNote(n)}>{n.text}</span>
                )}
                <button onClick={() => removeNote(n.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:11, padding:0, flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.color='#E24B4A'} onMouseLeave={e=>e.currentTarget.style.color='#ddd'}>✕</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <input type="text" value={newNote} onChange={e=>setNewNote(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addNote()}} placeholder="Add a note..." style={{ flex:1, fontSize:12, padding:'6px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
              <button onClick={addNote} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
            </div>
          </div>

          <AttachmentSection
            attachments={f.attachments}
            entityPath={isProject ? `projects/${entity.id}` : `escalations/${entity.id}`}
            onAdd={att => setF(p => ({ ...p, attachments: [...p.attachments, att] }))}
            onRemove={id => setF(p => ({ ...p, attachments: p.attachments.filter(a => a.id !== id) }))}
          />

          {/* Tasks list */}
          <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginTop:12 }}>
            <div style={{ fontSize:11, fontWeight:500, color:'#bbb', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
              Tasks · {linkedTasks.length}
            </div>
            {linkedTasks.length === 0 && <div style={{ fontSize:12, color:'#ccc', padding:'4px 0 10px' }}>No tasks yet</div>}
            {linkedTasks.map(t => (
              <div key={t.id} onClick={() => openEditTask(t)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#fafafa', borderRadius:6, border:'0.5px solid #f0f0f0', marginBottom:6, cursor:'pointer', boxSizing:'border-box' }}
                onMouseEnter={e => e.currentTarget.style.background='#f2f2f0'}
                onMouseLeave={e => e.currentTarget.style.background='#fafafa'}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:subStyle(t.substatus).bg||'#e5e5e5', border:`1px solid ${subStyle(t.substatus).border||'#ccc'}`, flexShrink:0 }} />
                <span style={{ flex:1, fontSize:13, color:t.substatus==='complete'?'#aaa':'#111', textDecoration:t.substatus==='complete'?'line-through':'none' }}>{t.title}</span>
                {t.domain && <span style={{ fontSize:9, background:'#E6F1FB', color:'#0C447C', padding:'2px 6px', borderRadius:6, border:'0.5px solid #85B7EB', flexShrink:0, whiteSpace:'nowrap' }}>{t.domain}</span>}
                {t.priority === 'high' && <span style={{ fontSize:9, background:'#FCEBEB', color:'#791F1F', padding:'2px 5px', borderRadius:6, border:'0.5px solid #F09595', flexShrink:0 }}>High</span>}
                <span style={{ fontSize:12, color:'#ccc', flexShrink:0 }}>›</span>
              </div>
            ))}
            <div style={{ display:'flex', gap:6, marginTop:4 }}>
              <button onClick={openAddTask}
                style={{ flex:1, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer', fontFamily:'inherit' }}>
                + New task
              </button>
              <button onClick={() => { setImportOpen(o => !o); setImportSearch('') }}
                style={{ flex:1, padding:'7px 0', fontSize:12, color:importOpen?'#111':'#aaa', border:importOpen?'0.5px solid #bbb':'0.5px dashed #ccc', borderRadius:8, background:importOpen?'#f7f7f5':'none', cursor:'pointer', fontFamily:'inherit' }}>
                ↙ Import task
              </button>
            </div>
            {importOpen && (
              <div style={{ marginTop:8, background:'#fafafa', border:'0.5px solid #e5e5e5', borderRadius:8, overflow:'hidden' }}>
                <input autoFocus type="text" value={importSearch} onChange={e => setImportSearch(e.target.value)}
                  placeholder="Search tasks to import..."
                  style={{ width:'100%', boxSizing:'border-box', fontSize:12, padding:'8px 10px', border:'none', borderBottom:'0.5px solid #e5e5e5', outline:'none', background:'white', fontFamily:'inherit' }} />
                <div style={{ maxHeight:200, overflowY:'auto' }}>
                  {importableTasks.length === 0 && (
                    <div style={{ fontSize:12, color:'#ccc', padding:'10px', textAlign:'center' }}>No tasks found</div>
                  )}
                  {importableTasks.map(t => (
                    <div key={t.id} onClick={() => linkTask(t)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', cursor:'pointer', borderBottom:'0.5px solid #f0f0f0' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f0f0ee'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:subStyle(t.substatus).bg||'#e5e5e5', border:`1px solid ${subStyle(t.substatus).border||'#ccc'}`, flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:12, color:'#111' }}>{t.title}</span>
                      {t.domain && <span style={{ fontSize:9, background:'#E6F1FB', color:'#0C447C', padding:'1px 6px', borderRadius:20, border:'0.5px solid #85B7EB', flexShrink:0 }}>{t.domain}</span>}
                      {(t.project_id || t.escalation_id) && <span style={{ fontSize:9, color:'#bbb', flexShrink:0 }}>linked</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, borderTop:'0.5px solid #f0f0f0', paddingTop:12 }}>
            <ConfirmDeleteButton onConfirm={() => { onDelete(entity.id); onClose() }}
              style={{ fontSize:12, color:'#E24B4A', background:'none', border:'0.5px solid #fcc', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit' }}>
              Delete {isProject ? 'project' : 'escalation'}
            </ConfirmDeleteButton>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onClose}
                style={{ fontSize:12, background:'none', color:'#888', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
              <button onClick={() => { onSaveEntity(f, entity.id); onClose() }}
                style={{ ...BTN_PRIMARY, fontSize:12, padding:'6px 16px' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      {taskForm && (
        <TaskForm task={taskForm} isEdit={isEditTask} members={members}
          onSave={async data => { await onSaveTask(data, isEditTask ? taskForm.id : null); setTaskForm(null) }}
          onDelete={async id => { await onDeleteTask(id); setTaskForm(null) }}
          onClose={() => setTaskForm(null)}
          domains={domains} zIndex={60}
        />
      )}
    </>
  )
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, taskCount, noteCount = 0, attachCount = 0, onOpen, dragging, dropIndicator, onDragStart, onDragEnd, onDragOver }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const notes = Array.isArray(project.notes) ? project.notes : []
  const bg = flagBg(project.color), border = flagBorder(project.color)
  const owners = project.owners || ['Levi']
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')
  return (
    <div className="proj-card" style={{ position:'relative', flexShrink:0 }}>
      {dropIndicator === 'before' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginBottom:4 }} />}
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(project.id)); onDragStart && onDragStart(project.id) }}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver ? e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onDragOver(project.id, e.clientY < r.top + r.height/2 ? 'before' : 'after') } : undefined}
        onClick={() => onOpen(project)}
        style={{ background:bg||'white', border:`0.5px solid ${border||'#e5e5e5'}`, borderRadius:8, padding:'10px 12px', cursor:'grab', boxSizing:'border-box', userSelect:'none', opacity:dragging?0.4:1 }}
        onMouseEnter={e => { if(!border) e.currentTarget.style.borderColor='#bbb' }}
        onMouseLeave={e => { if(!border) e.currentTarget.style.borderColor='#e5e5e5' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:3 }}>
          {project.domain && <span style={{ fontSize:10, fontWeight:500, background:'#E6F1FB', color:'#0C447C', padding:'2px 7px', borderRadius:20, border:'0.5px solid #85B7EB', whiteSpace:'nowrap' }}>{project.domain}</span>}
          {project.substatus && (() => { const ss = subStyle(project.substatus); return <span style={{ fontSize:9, fontWeight:500, background:ss.bg, color:ss.tc, border:`0.5px solid ${ss.border}`, padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>{ss.label}</span> })()}
          {project.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap', border:'0.5px solid #F09595' }}>High</span>}
        </div>
        <div style={{ fontSize:13, fontWeight:500, color:'#111', marginBottom:6, lineHeight:1.3 }}>{project.title}</div>
        {notesOpen && notes.length > 0 && (
          <div style={{ marginBottom:6, borderTop:'0.5px solid #e5e5e5', paddingTop:8, marginTop:4 }}>
            {notes.map(n => (
              <div key={n.id} style={{ fontSize:11, color:'#555', marginBottom:5, lineHeight:1.5 }}>
                <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6, flexWrap:'wrap' }}>
          {showOwners && owners.map(o => <OwnerPip key={o} name={o} />)}
          {project.due && <Badge type="due">{project.due}</Badge>}
          {noteCount > 0 && (
            <button onClick={e => { e.stopPropagation(); setNotesOpen(o => !o) }} style={{ fontSize:10, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:20, padding:'2px 6px', cursor:'pointer' }}>
              {notesOpen ? 'hide notes' : `${noteCount} note${noteCount!==1?'s':''}`}
            </button>
          )}
          {attachCount > 0 && <span style={{ fontSize:10, color:'#aaa', background:'#f7f7f5', border:'0.5px solid #e5e5e5', borderRadius:20, padding:'1px 7px' }}>📎 {attachCount}</span>}
          <span style={{ fontSize:10, color:'#aaa', background:'#f7f7f5', border:'0.5px solid #e5e5e5', borderRadius:20, padding:'1px 7px' }}>{taskCount} task{taskCount!==1?'s':''}</span>
        </div>
      </div>
      {dropIndicator === 'after' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginTop:4 }} />}
    </div>
  )
}

// ─── Projects Section ─────────────────────────────────────────────────────────
function ProjectsSection({ projects, tasks, onAdd, onOpen, templates = [], noBorder = false, onReorder }) {
  const [step, setStep] = useState(null) // null | 'pick-type' | 'title' | 'bundle-template'
  const [newType, setNewType] = useState('project')
  const [newTitle, setNewTitle] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)

  const reset = () => { setStep(null); setNewTitle(''); setNewType('project'); setSelectedTemplate(null) }

  const handleAdd = () => {
    const title = newTitle.trim()
    if (!title) { reset(); return }
    onAdd(title, newType, selectedTemplate)
    reset()
  }

  const TYPE_OPTIONS = [
    { key:'project', label:'Project', desc:'Track work with tasks', bg:'#f7f7f5', border:'#ddd', tc:'#333' },
    { key:'bundle', label:'Bundle', desc:'Group related projects', bg:'#ede9fe', border:'#c4b5fd', tc:'#6d28d9' },
  ]

  return (
    <div style={{ marginBottom: noBorder ? 0 : 12, paddingBottom: noBorder ? 0 : 12, borderBottom: noBorder ? 'none' : '0.5px solid #f0f0f0' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && dropTarget && onReorder) onReorder(id, dropTarget.id, dropTarget.position); setDraggingId(null); setDropTarget(null) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-start' }}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} taskCount={tasks.filter(t => t.project_id === p.id).length} noteCount={Array.isArray(p.notes)?p.notes.length:0} attachCount={Array.isArray(p.attachments)?p.attachments.length:0} onOpen={onOpen}
            dragging={draggingId === p.id}
            dropIndicator={dropTarget?.id === p.id ? dropTarget.position : null}
            onDragStart={id => setDraggingId(id)}
            onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
            onDragOver={(id, pos) => setDropTarget({ id, position: pos })} />
        ))}

        {step === null && (
          <button onClick={() => setStep('pick-type')} style={{ alignSelf:'center', background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:12, padding:'4px 2px', fontFamily:'inherit' }}
            onMouseEnter={e => e.currentTarget.style.color='#888'}
            onMouseLeave={e => e.currentTarget.style.color='#ccc'}>
            + new
          </button>
        )}

        {step === 'pick-type' && (
          <div style={{ flexShrink:0, width:240, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:12, boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>What are you creating?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {TYPE_OPTIONS.map(t => (
                <button key={t.key} onClick={() => { setNewType(t.key); setStep(t.key === 'bundle' ? 'bundle-template' : 'title') }}
                  style={{ textAlign:'left', background:t.bg, border:`0.5px solid ${t.border}`, borderRadius:8, padding:'8px 10px', cursor:'pointer' }}>
                  <div style={{ fontSize:12, fontWeight:500, color:t.tc }}>{t.label}</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{t.desc}</div>
                </button>
              ))}
            </div>
            <button onClick={reset} style={{ marginTop:8, width:'100%', fontSize:11, background:'none', border:'none', color:'#bbb', cursor:'pointer', padding:'4px 0' }}>Cancel</button>
          </div>
        )}

        {step === 'bundle-template' && (
          <div style={{ flexShrink:0, width:240, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:12, boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.06em' }}>Select template</div>
            {templates.length === 0 ? (
              <div style={{ fontSize:12, color:'#bbb', padding:'8px 0' }}>No templates yet — add them in Settings.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {templates.map(t => (
                  <button key={t.id} onClick={() => { setSelectedTemplate(t.id); setStep('title') }}
                    style={{ textAlign:'left', background:'#fafafa', border:`0.5px solid ${selectedTemplate===t.id?'#c4b5fd':'#e5e5e5'}`, borderRadius:8, padding:'8px 10px', cursor:'pointer' }}>
                    <div style={{ fontSize:12, fontWeight:500, color:'#111' }}>{t.name}</div>
                    <div style={{ fontSize:10, color:'#aaa' }}>{t.tasks?.length || 0} tasks</div>
                  </button>
                ))}
              </div>
            )}
            <div style={{ display:'flex', gap:4, marginTop:8 }}>
              <button onClick={() => setStep('pick-type')} style={{ flex:1, fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 0', cursor:'pointer', color:'#888' }}>Back</button>
              {templates.length > 0 && <button onClick={() => { setSelectedTemplate(null); setStep('title') }} style={{ flex:1, fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 0', cursor:'pointer', color:'#888' }}>Skip template</button>}
            </div>
          </div>
        )}

        {step === 'title' && (
          <div style={{ flexShrink:0, width:200 }}>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>{newType === 'bundle' ? 'Bundle' : 'Project'} title</div>
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') handleAdd(); if (e.key==='Escape') reset() }}
              placeholder="Title..."
              style={{ width:'100%', boxSizing:'border-box', fontSize:13, padding:'8px 10px', border:'1.5px solid #111', borderRadius:8, outline:'none', fontFamily:'inherit' }} />
            <div style={{ display:'flex', gap:4, marginTop:4 }}>
              <button onClick={handleAdd} style={{ flex:1, fontSize:11, background:'#111', color:'white', border:'none', borderRadius:8, padding:'5px 0', cursor:'pointer', fontFamily:'inherit' }}>Add</button>
              <button onClick={reset} style={{ flex:1, fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:8, padding:'5px 0', cursor:'pointer', color:'#888', fontFamily:'inherit' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Escalation Card ──────────────────────────────────────────────────────────
function EscalationCard({ escalation, taskCount, noteCount = 0, attachCount = 0, onOpen, dragging, dropIndicator, onDragStart, onDragEnd, onDragOver }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const notes = Array.isArray(escalation.notes) ? escalation.notes : []
  const RED = '#c0392b', REDBORDER = '#f0a0a0'
  const bg = flagBg(escalation.color), border = flagBorder(escalation.color)
  const owners = escalation.owners || ['Levi']
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')
  return (
    <div className="proj-card" style={{ position:'relative', flexShrink:0 }}>
      {dropIndicator === 'before' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginBottom:4 }} />}
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData('text/plain', String(escalation.id)); onDragStart && onDragStart(escalation.id) }}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver ? e => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onDragOver(escalation.id, e.clientY < r.top + r.height/2 ? 'before' : 'after') } : undefined}
        onClick={() => onOpen(escalation)}
        style={{ background:bg||'white', border:`0.5px solid ${border||'#e5e5e5'}`, borderRadius:8, padding:'10px 12px', cursor:'grab', boxSizing:'border-box', userSelect:'none', opacity:dragging?0.4:1 }}
        onMouseEnter={e => { if(!border) e.currentTarget.style.borderColor=REDBORDER }}
        onMouseLeave={e => { if(!border) e.currentTarget.style.borderColor='#e5e5e5' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:3 }}>
          {escalation.domain && <span style={{ fontSize:10, fontWeight:500, background:'#E6F1FB', color:'#0C447C', padding:'2px 7px', borderRadius:20, border:'0.5px solid #85B7EB', whiteSpace:'nowrap' }}>{escalation.domain}</span>}
          {escalation.substatus && (() => { const ss = subStyle(escalation.substatus); return <span style={{ fontSize:9, fontWeight:500, background:ss.bg, color:ss.tc, border:`0.5px solid ${ss.border}`, padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap' }}>{ss.label}</span> })()}
          {escalation.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap', border:'0.5px solid #F09595' }}>High</span>}
        </div>
        <div style={{ fontSize:13, fontWeight:500, color:'#111', marginBottom:6, lineHeight:1.3 }}>{escalation.title}</div>
        {notesOpen && notes.length > 0 && (
          <div style={{ marginBottom:6, borderTop:'0.5px solid #e5e5e5', paddingTop:8, marginTop:4 }}>
            {notes.map(n => (
              <div key={n.id} style={{ fontSize:11, color:'#555', marginBottom:5, lineHeight:1.5 }}>
                <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
              </div>
            ))}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6, flexWrap:'wrap' }}>
          {showOwners && owners.map(o => <OwnerPip key={o} name={o} />)}
          {escalation.due && <Badge type="due">{escalation.due}</Badge>}
          {noteCount > 0 && (
            <button onClick={e => { e.stopPropagation(); setNotesOpen(o => !o) }} style={{ fontSize:10, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:20, padding:'2px 6px', cursor:'pointer' }}>
              {notesOpen ? 'hide notes' : `${noteCount} note${noteCount!==1?'s':''}`}
            </button>
          )}
          {attachCount > 0 && <span style={{ fontSize:10, color:'#aaa', background:'#f7f7f5', border:'0.5px solid #e5e5e5', borderRadius:20, padding:'1px 7px' }}>📎 {attachCount}</span>}
          <span style={{ fontSize:10, color:'#aaa', background:'#f7f7f5', border:'0.5px solid #e5e5e5', borderRadius:20, padding:'1px 7px' }}>{taskCount} task{taskCount!==1?'s':''}</span>
        </div>
      </div>
      {dropIndicator === 'after' && <div style={{ height:2, background:'#378ADD', borderRadius:1, marginTop:4 }} />}
    </div>
  )
}

// ─── Escalations Section ──────────────────────────────────────────────────────
function EscalationsSection({ escalations, tasks, onAdd, onOpen, onReorder, isOpen, onToggle }) {
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const RED = '#c0392b'
  const handleAdd = () => {
    const title = newTitle.trim()
    if (!title) { setAdding(false); return }
    onAdd(title); setNewTitle(''); setAdding(false)
  }
  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: isOpen && escalations.length ? 10 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.06em' }}>Escalations</span>
          <span style={{ background:'white', border:'0.5px solid #c4b5fd', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#7c3aed' }}>{escalations.length}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {isOpen && (
            <button onClick={() => setAdding(true)} style={{ fontSize:11, color:'#a78bfa', background:'none', border:'0.5px dashed #c4b5fd', borderRadius:6, padding:'3px 10px', cursor:'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#7c3aed' }}
              onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#a78bfa' }}>+ Add</button>
          )}
          <button onClick={onToggle} style={{ background:'none', border:'none', cursor:'pointer', padding:'0 2px', color:'#a78bfa', fontSize:10, lineHeight:1 }}>
            {isOpen ? '▴' : '▾'}
          </button>
        </div>
      </div>
      {/* Cards */}
      {isOpen && (
        <div onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && dropTarget && onReorder) onReorder(id, dropTarget.id, dropTarget.position); setDraggingId(null); setDropTarget(null) }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropTarget(null) }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-start' }}>
            {escalations.map(e => (
              <EscalationCard key={e.id} escalation={e} taskCount={tasks.filter(t => t.escalation_id === e.id).length} noteCount={Array.isArray(e.notes)?e.notes.length:0} attachCount={Array.isArray(e.attachments)?e.attachments.length:0} onOpen={onOpen}
                dragging={draggingId === e.id}
                dropIndicator={dropTarget?.id === e.id ? dropTarget.position : null}
                onDragStart={id => setDraggingId(id)}
                onDragEnd={() => { setDraggingId(null); setDropTarget(null) }}
                onDragOver={(id, pos) => setDropTarget({ id, position: pos })} />
            ))}
            {adding && (
              <div style={{ flexShrink:0, width:200 }}>
                <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter') handleAdd(); if (e.key==='Escape') { setAdding(false); setNewTitle('') } }}
                  placeholder="Escalation title..."
                  style={{ width:'100%', boxSizing:'border-box', fontSize:13, padding:'8px 10px', border:`1.5px solid ${RED}`, borderRadius:8, outline:'none', fontFamily:'inherit' }} />
                <div style={{ display:'flex', gap:4, marginTop:4 }}>
                  <button onClick={handleAdd} style={{ flex:1, fontSize:11, background:RED, color:'white', border:'none', borderRadius:8, padding:'5px 0', cursor:'pointer', fontFamily:'inherit' }}>Add</button>
                  <button onClick={() => { setAdding(false); setNewTitle('') }} style={{ flex:1, fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:8, padding:'5px 0', cursor:'pointer', color:'#888', fontFamily:'inherit' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Rich Text Editor ─────────────────────────────────────────────────────────
// ─── Mention Picker ───────────────────────────────────────────────────────────
function MentionPicker({ members, onInsert }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex' }}>
      <button
        onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }}
        title="Tag a team member"
        style={{ fontSize:12, padding:'3px 8px', border:'0.5px solid #e0e0e0', borderRadius:6, background: open?'#ede9fe':'#f7f7f5', color: open?'#7c3aed':'#555', cursor:'pointer', fontFamily:'inherit', lineHeight:1.4 }}>
        @ Tag
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:300, background:'white', border:'0.5px solid #e0e0e0', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.1)', minWidth:140, padding:4 }}>
          {members.map(name => (
            <button key={name} onMouseDown={e => { e.preventDefault(); onInsert(name); setOpen(false) }}
              style={{ width:'100%', textAlign:'left', padding:'6px 10px', background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#333', borderRadius:6, fontFamily:'inherit' }}
              onMouseEnter={e => e.currentTarget.style.background='#ede9fe'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              @{name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function RichTextEditor({ initialValue, onChange, isMobile = false, members = [] }) {
  const editorRef = useRef(null)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [tableHover, setTableHover] = useState([0, 0])
  const [tableCtx, setTableCtx] = useState(null)
  const [imgSel, setImgSel] = useState(null)
  const [imgBar, setImgBar] = useState(null)
  const wrapperRef = useRef(null)
  const pasteInProgressRef = useRef(false)
  const dragCleanupRef = useRef(null)
  useEffect(() => () => {
    if (dragCleanupRef.current) {
      document.removeEventListener('mousemove', dragCleanupRef.current.onMove)
      document.removeEventListener('mouseup', dragCleanupRef.current.onUp)
    }
  }, [])

  const handlePaste = async e => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(item => item.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (!file) return

    // Show blob URL immediately so the image appears with zero delay
    const objectUrl = URL.createObjectURL(file)
    const phId = `imgph${Date.now()}`
    pasteInProgressRef.current = true
    editorRef.current.focus()
    document.execCommand('insertHTML', false,
      `<img id="${phId}" src="${objectUrl}" style="max-width:100%;border-radius:6px;margin:4px 0;display:block">`)

    // Convert to compressed base64 — stored directly in note body, no Supabase Storage needed
    const dataUrl = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = ev => {
        const imgEl = new Image()
        imgEl.onload = () => {
          const maxW = 1200
          const scale = Math.min(1, maxW / imgEl.naturalWidth)
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(imgEl.naturalWidth * scale)
          canvas.height = Math.round(imgEl.naturalHeight * scale)
          canvas.getContext('2d').drawImage(imgEl, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/jpeg', 0.82))
        }
        imgEl.src = ev.target.result
      }
      reader.readAsDataURL(file)
    })

    pasteInProgressRef.current = false
    URL.revokeObjectURL(objectUrl)

    const img = editorRef.current?.querySelector(`#${phId}`)
    if (img) {
      img.src = dataUrl
      img.removeAttribute('id')
    } else if (editorRef.current) {
      const newImg = document.createElement('img')
      newImg.src = dataUrl
      newImg.style.cssText = 'max-width:100%;border-radius:6px;margin:4px 0;display:block'
      editorRef.current.appendChild(newImg)
    }

    if (editorRef.current) onChange(editorRef.current.innerHTML)
  }

  const computeImgBar = (imgEl) => {
    if (!wrapperRef.current) return
    const wRect = wrapperRef.current.getBoundingClientRect()
    const iRect = imgEl.getBoundingClientRect()
    setImgBar({ top: iRect.top - wRect.top, left: iRect.left - wRect.left, width: iRect.width, height: iRect.height })
  }

  const selectImg = (imgEl) => {
    if (imgSel) imgSel.style.outline = ''
    if (imgEl) { imgEl.style.outline = '2px solid #7c3aed'; imgEl.style.outlineOffset = '2px' }
    setImgSel(imgEl)
    if (imgEl) computeImgBar(imgEl)
    else setImgBar(null)
  }

  const setImgWidth = (w) => {
    if (!imgSel) return
    imgSel.style.width = w
    imgSel.style.maxWidth = '100%'
    imgSel.removeAttribute('height')
    onChange(editorRef.current.innerHTML)
    computeImgBar(imgSel)
  }

  const removeSelectedImg = () => {
    if (!imgSel) return
    imgSel.style.outline = ''
    imgSel.remove()
    onChange(editorRef.current.innerHTML)
    setImgSel(null); setImgBar(null)
  }

  const startDragResize = (e) => {
    e.preventDefault()
    const el = imgSel
    if (!el) return
    const startX = e.clientX
    const startW = el.getBoundingClientRect().width
    const onMove = (mv) => {
      el.style.width = Math.max(50, startW + mv.clientX - startX) + 'px'
      el.style.maxWidth = '100%'
      computeImgBar(el)
    }
    const onUp = () => {
      if (editorRef.current) onChange(editorRef.current.innerHTML)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      dragCleanupRef.current = null
    }
    dragCleanupRef.current = { onMove, onUp }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useLayoutEffect(() => { if (editorRef.current) editorRef.current.innerHTML = DOMPurify.sanitize(initialValue || '') }, [])

  useEffect(() => {
    const check = () => {
      const sel = window.getSelection()
      if (!sel || !sel.anchorNode || !editorRef.current) return setTableCtx(null)
      let td = null, tr = null, table = null, cur = sel.anchorNode
      while (cur && cur !== editorRef.current) {
        if (!td && cur.nodeName === 'TD') td = cur
        if (!tr && cur.nodeName === 'TR') tr = cur
        if (!table && cur.nodeName === 'TABLE') table = cur
        cur = cur.parentNode
      }
      setTableCtx(td && tr && table ? { td, tr, table } : null)
    }
    document.addEventListener('selectionchange', check)
    return () => document.removeEventListener('selectionchange', check)
  }, [])

  const exec = (cmd, val = null) => {
    editorRef.current.focus()
    document.execCommand(cmd, false, val)
    onChange(editorRef.current.innerHTML)
  }

  const insertTable = (rows, cols) => {
    const cellHTML = `<td style="border:1px solid #d1d5db;padding:3px 8px;min-width:60px;">&nbsp;</td>`
    const rowHTML = `<tr>${Array(cols).fill(cellHTML).join('')}</tr>`
    exec('insertHTML', `<table style="border-collapse:collapse;width:100%;margin:8px 0">${Array(rows).fill(rowHTML).join('')}</table><p><br></p>`)
    setShowTablePicker(false)
  }

  const convertToChecklist = () => {
    const sel = window.getSelection()
    if (!sel || !editorRef.current) return
    const makeItem = text => {
      const div = document.createElement('div')
      div.style.cssText = 'display:flex;align-items:center;gap:8px;margin:2px 0'
      const cb = document.createElement('input')
      cb.type = 'checkbox'
      cb.style.cssText = 'width:14px;height:14px;cursor:pointer;flex-shrink:0;margin:0'
      const span = document.createElement('span')
      span.style.lineHeight = '1.5'
      if (text) span.textContent = text
      div.appendChild(cb)
      div.appendChild(span)
      return { div, span }
    }
    const placeCursor = span => {
      const range = document.createRange()
      range.selectNodeContents(span)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    if (!sel.isCollapsed && sel.toString().trim()) {
      const text = sel.toString()
      const { div, span } = makeItem(text)
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(div)
      placeCursor(span)
    } else {
      let block = sel.anchorNode
      while (block && block.parentNode !== editorRef.current) block = block.parentNode
      if (!block || block === editorRef.current || block.nodeName === 'TABLE') {
        exec('insertHTML', '<div style="display:flex;align-items:center;gap:8px;margin:2px 0"><input type="checkbox" style="width:14px;height:14px;cursor:pointer;flex-shrink:0;margin:0"><span style="line-height:1.5">Checklist item</span></div>')
        onChange(editorRef.current.innerHTML)
        return
      }
      const isChecklist = block.nodeType === 1 && !!block.querySelector('input[type="checkbox"]')
      if (isChecklist) {
        const { div, span } = makeItem('')
        block.parentNode.insertBefore(div, block.nextSibling)
        placeCursor(span)
      } else {
        const text = (block.textContent || '').trim()
        const { div, span } = makeItem(text)
        block.parentNode.replaceChild(div, block)
        placeCursor(span)
      }
    }
    onChange(editorRef.current.innerHTML)
  }

  const getChecklistCtx = () => {
    const sel = window.getSelection()
    if (!sel || !sel.anchorNode || !editorRef.current) return null
    let cur = sel.anchorNode
    while (cur && cur !== editorRef.current) {
      if (cur.nodeName === 'DIV') {
        const cb = cur.querySelector('input[type="checkbox"]')
        if (cb) return { div: cur, cb, span: cur.querySelector('span') }
      }
      cur = cur.parentNode
    }
    return null
  }

  const handleKeyDown = e => {
    if (e.key === 'Tab') {
      e.preventDefault()
      if (tableCtx) {
        const { td, tr, table } = tableCtx
        const rows = Array.from(table.rows)
        const colIdx = Array.from(tr.cells).indexOf(td)
        const rowIdx = rows.indexOf(tr)
        if (e.shiftKey) {
          const prev = colIdx > 0 ? tr.cells[colIdx - 1]
            : rowIdx > 0 ? rows[rowIdx - 1].cells[rows[rowIdx - 1].cells.length - 1] : null
          if (prev) focusCell(prev)
        } else {
          if (colIdx < tr.cells.length - 1) {
            focusCell(tr.cells[colIdx + 1])
          } else if (rowIdx < rows.length - 1) {
            focusCell(rows[rowIdx + 1].cells[0])
          } else {
            tableOp('row-below')
            const newRow = Array.from(table.rows)[rowIdx + 1]
            if (newRow) focusCell(newRow.cells[0])
          }
        }
      } else {
        let cur = window.getSelection()?.anchorNode
        let inList = false
        while (cur && cur !== editorRef.current) {
          if (cur.nodeName === 'LI') { inList = true; break }
          cur = cur.parentNode
        }
        if (inList) {
          e.shiftKey ? exec('outdent') : exec('indent')
        } else {
          exec('insertText', '    ')
        }
      }
      return
    }
    if (e.key !== 'Enter' && e.key !== 'Backspace') return
    const ctx = getChecklistCtx()
    if (!ctx) return
    const sel = window.getSelection()
    if (e.key === 'Enter') {
      e.preventDefault()
      const newDiv = document.createElement('div')
      newDiv.style.cssText = 'display:flex;align-items:center;gap:8px;margin:2px 0'
      const newCb = document.createElement('input')
      newCb.type = 'checkbox'
      newCb.style.cssText = 'width:14px;height:14px;cursor:pointer;flex-shrink:0;margin:0'
      const newSpan = document.createElement('span')
      newSpan.style.lineHeight = '1.5'
      newDiv.appendChild(newCb)
      newDiv.appendChild(newSpan)
      ctx.div.parentNode.insertBefore(newDiv, ctx.div.nextSibling)
      const range = document.createRange()
      range.setStart(newSpan, 0)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      onChange(editorRef.current.innerHTML)
    } else if (e.key === 'Backspace') {
      const atStart = sel && sel.isCollapsed && sel.anchorOffset === 0
      const isEmpty = !ctx.span || ctx.span.textContent === ''
      if (atStart && isEmpty) {
        e.preventDefault()
        const prev = ctx.div.previousSibling
        ctx.div.remove()
        if (prev) {
          const range = document.createRange()
          range.selectNodeContents(prev)
          range.collapse(false)
          sel.removeAllRanges()
          sel.addRange(range)
        }
        onChange(editorRef.current.innerHTML)
      }
    }
  }

  const fillCell = color => {
    if (!tableCtx) return
    tableCtx.td.style.backgroundColor = color
    onChange(editorRef.current.innerHTML)
  }

  const focusCell = cell => {
    editorRef.current.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    const node = cell.firstChild || cell
    range.setStart(node, 0)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  const tableOp = op => {
    if (!tableCtx) return
    const { td, tr, table } = tableCtx
    const rows = Array.from(table.rows)
    const colIdx = Array.from(tr.cells).indexOf(td)
    const rowIdx = rows.indexOf(tr)
    const mkCell = () => {
      const c = document.createElement('td')
      c.style.cssText = 'border:1px solid #d1d5db;padding:3px 8px;min-width:60px;'
      c.innerHTML = ' '
      return c
    }
    if (op === 'col-left' || op === 'col-right') {
      const idx = op === 'col-left' ? colIdx : colIdx + 1
      rows.forEach(r => r.insertBefore(mkCell(), r.cells[idx] || null))
    } else if (op === 'col-del') {
      if (rows[0]?.cells.length > 1) {
        rows.forEach(r => { if (r.cells[colIdx]) r.deleteCell(colIdx) })
        const targetCell = rows[rowIdx]?.cells[Math.min(colIdx, rows[0].cells.length - 1)]
        if (targetCell) focusCell(targetCell)
      }
    } else if (op === 'row-above' || op === 'row-below') {
      const newRow = document.createElement('tr')
      for (let i = 0; i < tr.cells.length; i++) newRow.appendChild(mkCell())
      tr.parentNode.insertBefore(newRow, op === 'row-above' ? tr : tr.nextSibling)
    } else if (op === 'row-del') {
      if (rows.length > 1) {
        tr.remove()
        const updatedRows = Array.from(table.rows)
        const targetRow = updatedRows[Math.min(rowIdx, updatedRows.length - 1)]
        const targetCell = targetRow?.cells[Math.min(colIdx, (targetRow?.cells.length || 1) - 1)]
        if (targetCell) focusCell(targetCell)
      } else {
        const sibling = table.nextSibling || table.previousSibling
        table.remove()
        editorRef.current.focus()
        if (sibling) {
          const r = document.createRange()
          r.selectNodeContents(sibling)
          r.collapse(true)
          const s = window.getSelection()
          s.removeAllRanges()
          s.addRange(r)
        }
      }
    } else if (op === 'merge-right') {
      const nextCell = tr.cells[colIdx + 1]
      if (nextCell) {
        td.colSpan = (td.colSpan || 1) + (nextCell.colSpan || 1)
        const content = nextCell.innerHTML.trim()
        if (content && content !== '&nbsp;') td.innerHTML += ' ' + content
        nextCell.remove()
        focusCell(td)
      }
    } else if (op === 'merge-down') {
      const nextRow = rows[rowIdx + 1]
      if (nextRow && nextRow.cells[colIdx]) {
        const belowCell = nextRow.cells[colIdx]
        td.rowSpan = (td.rowSpan || 1) + (belowCell.rowSpan || 1)
        const content = belowCell.innerHTML.trim()
        if (content && content !== '&nbsp;') td.innerHTML += ' ' + content
        belowCell.remove()
        focusCell(td)
      }
    } else if (op === 'split') {
      const extraCols = (td.colSpan || 1) - 1
      if (extraCols > 0) {
        td.colSpan = 1
        for (let i = 0; i < extraCols; i++) tr.insertBefore(mkCell(), tr.cells[colIdx + 1] || null)
      }
      const extraRows = (td.rowSpan || 1) - 1
      if (extraRows > 0) {
        td.rowSpan = 1
        for (let i = 1; i <= extraRows; i++) {
          const targetRow = rows[rowIdx + i]
          if (targetRow) targetRow.insertBefore(mkCell(), targetRow.cells[colIdx] || null)
        }
      }
      focusCell(td)
    }
    onChange(editorRef.current.innerHTML)
  }

  const COLORS = [
    '#111111','#c0392b','#0C447C','#27500A','#7d3c98','#d35400',
    '#f1948a','#85c1e9','#a9dfbf','#d7bde2','#fad7a0','#a2d9ce','#f9e79f','#aab7b8',
  ]
  const HIGHLIGHTS = ['#fef08a','#bbf7d0','#bae6fd','#fecdd3','#fed7aa','#e9d5ff']
  const CELL_FILLS  = ['','#fef9c3','#dbeafe','#dcfce7','#fce7f3','#ffedd5','#f3f4f6','#1e293b']
  const sep = { width:'0.5px', height:14, background:'#e0e0e0', margin:'0 2px', flexShrink:0 }
  const tbtn = (label, cmd, val = null, extra = {}) => (
    <button onMouseDown={e => { e.preventDefault(); exec(cmd, val) }}
      style={{ fontSize:12, padding:'3px 7px', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', fontFamily:'inherit', lineHeight:1.4, ...extra }}>
      {label}
    </button>
  )
  const xbtn = (label, action, title) => (
    <button onMouseDown={e => { e.preventDefault(); action() }} title={title}
      style={{ fontSize:11, padding:'2px 7px', border:'0.5px solid #c4b5fd', borderRadius:6, background:'white', cursor:'pointer', lineHeight:1.4, color:'#7c3aed' }}>
      {label}
    </button>
  )
  const rowStyle = { display:'flex', gap:3, padding:'5px 10px', background:'#f7f7f5', borderLeft:'0.5px solid #e5e5e5', borderRight:'0.5px solid #e5e5e5', flexWrap:'wrap', alignItems:'center' }

  return (
    <div ref={wrapperRef} style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, position:'relative' }}>
      <style>{`.note-editor p{margin:0}.note-editor td{line-height:1.6}.note-editor ul,.note-editor ol{padding-left:18px;margin:2px 0}.note-editor ol{list-style:none;counter-reset:item}.note-editor ol>li{counter-increment:item}.note-editor ol>li::before{content:counters(item,".")". ";margin-right:3px}`}</style>
      {/* Toolbar — sticky so it stays above keyboard on mobile */}
      <div style={{ position:'sticky', top:0, zIndex:5, background:'white' }}>
      {/* Row 1: text formatting + lists + table + size */}
      <div style={{ ...rowStyle, borderTop:'0.5px solid #e5e5e5', borderRadius:'10px 10px 0 0' }}>
        {tbtn('B', 'bold', null, { fontWeight:700 })}
        {tbtn('I', 'italic', null, { fontStyle:'italic' })}
        {tbtn('U', 'underline', null, { textDecoration:'underline' })}
        {tbtn('S', 'strikeThrough', null, { textDecoration:'line-through' })}
        <div style={sep} />
        {tbtn('• List', 'insertUnorderedList')}
        {tbtn('1. List', 'insertOrderedList')}
        {tbtn('→', 'indent', null, { title:'Indent' })}
        {tbtn('←', 'outdent', null, { title:'Outdent' })}
        <div style={sep} />
        <button onMouseDown={e => { e.preventDefault(); convertToChecklist() }}
          style={{ fontSize:12, padding:'3px 7px', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', fontFamily:'inherit', lineHeight:1.4 }}
          title="Convert current line or selected text to checklist item">
          ☑ Check
        </button>
        <div style={sep} />
        <div style={{ position:'relative' }}>
          <button onMouseDown={e => { e.preventDefault(); setShowTablePicker(v => !v) }}
            style={{ fontSize:12, padding:'3px 7px', border:'0.5px solid #e0e0e0', borderRadius:6, background:showTablePicker?'#ede9fe':'white', cursor:'pointer', fontFamily:'inherit', lineHeight:1.4 }}>
            ⊞ Table
          </button>
          {showTablePicker && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, padding:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:20 }}>
              <div style={{ fontSize:10, color:'#888', marginBottom:5, textAlign:'center', minWidth:120 }}>
                {tableHover[0] > 0 ? `${tableHover[0]} × ${tableHover[1]} table` : 'Hover to select'}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 18px)', gap:2 }}>
                {Array.from({ length:36 }).map((_, i) => {
                  const r = Math.floor(i/6)+1, c = (i%6)+1
                  const active = r <= tableHover[0] && c <= tableHover[1]
                  return (
                    <div key={i}
                      style={{ width:16, height:16, background:active?'#bfdbfe':'#f0f0f0', border:`1px solid ${active?'#93c5fd':'#e0e0e0'}`, borderRadius:2, cursor:'pointer' }}
                      onMouseEnter={() => setTableHover([r,c])}
                      onClick={() => tableHover[0] > 0 && insertTable(tableHover[0], tableHover[1])} />
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <div style={sep} />
        <select defaultValue="3" onMouseDown={e => e.stopPropagation()}
          onChange={e => { exec('fontSize', e.target.value); e.target.value='3' }}
          style={{ fontSize:11, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'2px 4px', background:'white', cursor:'pointer', height:24 }}>
          <option value="1">X-Small</option>
          <option value="2">Small</option>
          <option value="3">Normal</option>
          <option value="4">Large</option>
          <option value="5">X-Large</option>
        </select>
        <div style={sep} />
        {tbtn('✕ fmt', 'removeFormat', null, { color:'#aaa', fontSize:11 })}
        {members.length > 0 && (
          <>
            <div style={sep} />
            <MentionPicker members={members} onInsert={name => {
              editorRef.current.focus()
              document.execCommand('insertHTML', false,
                `<span data-mention="${name}" style="background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 6px;font-weight:500;white-space:nowrap">@${name}</span>&nbsp;`)
              onChange(editorRef.current.innerHTML)
            }} />
          </>
        )}
      </div>
      {/* Row 2: colors — scrollable on mobile */}
      <div style={{ ...rowStyle, borderTop:'0.5px solid #f0f0f0', gap:5, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling:'touch' }}>
        <span style={{ fontSize:10, color:'#999', flexShrink:0 }}>Text</span>
        <div style={sep} />
        {COLORS.map(c => (
          <button key={c} onMouseDown={e => { e.preventDefault(); exec('foreColor', c) }}
            style={{ width: isMobile ? 20 : 14, height: isMobile ? 20 : 14, borderRadius:'50%', background:c, border:'1.5px solid transparent', cursor:'pointer', padding:0, flexShrink:0 }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#555'}
            onMouseLeave={e => e.currentTarget.style.borderColor='transparent'} />
        ))}
        <div style={{ ...sep, margin:'0 5px' }} />
        <span style={{ fontSize:10, color:'#999', flexShrink:0 }}>Highlight</span>
        <div style={sep} />
        {HIGHLIGHTS.map(c => (
          <button key={c} onMouseDown={e => { e.preventDefault(); exec('hiliteColor', c) }}
            style={{ width: isMobile ? 22 : 16, height: isMobile ? 20 : 14, borderRadius:3, background:c, border:'1.5px solid transparent', cursor:'pointer', padding:0, flexShrink:0 }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#555'}
            onMouseLeave={e => e.currentTarget.style.borderColor='transparent'} />
        ))}
        <button onMouseDown={e => { e.preventDefault(); exec('hiliteColor', 'transparent') }}
          style={{ fontSize:10, padding: isMobile ? '4px 8px' : '1px 5px', border:'0.5px solid #e0e0e0', borderRadius:3, background:'white', cursor:'pointer', color:'#aaa', lineHeight:1.4, flexShrink:0 }}
          title="Remove highlight">✕</button>
      </div>
      {/* Row 3: table context controls (hidden on mobile) */}
      {!isMobile && tableCtx && (
        <div style={{ ...rowStyle, borderTop:'0.5px solid #e9d5ff', background:'#faf5ff', gap:4 }}>
          <span style={{ fontSize:10, color:'#7c3aed', fontWeight:500, marginRight:2, flexShrink:0 }}>Table</span>
          <div style={{ ...sep, background:'#ddd6fe' }} />
          {xbtn('← Col', () => tableOp('col-left'), 'Insert column to the left')}
          {xbtn('Col →', () => tableOp('col-right'), 'Insert column to the right')}
          {xbtn('✕ Col', () => tableOp('col-del'), 'Delete this column')}
          <div style={{ ...sep, background:'#ddd6fe' }} />
          {xbtn('↑ Row', () => tableOp('row-above'), 'Insert row above')}
          {xbtn('Row ↓', () => tableOp('row-below'), 'Insert row below')}
          {xbtn('✕ Row', () => tableOp('row-del'), 'Delete this row')}
          <div style={{ ...sep, background:'#ddd6fe' }} />
          {xbtn('⊞→', () => tableOp('merge-right'), 'Merge with cell to the right')}
          {xbtn('⊞↓', () => tableOp('merge-down'), 'Merge with cell below')}
          {xbtn('⊟', () => tableOp('split'), 'Split merged cell')}
          <div style={{ ...sep, background:'#ddd6fe' }} />
          <span style={{ fontSize:10, color:'#7c3aed', flexShrink:0 }}>Cell fill</span>
          {CELL_FILLS.map((c, i) => (
            <button key={i} onMouseDown={e => { e.preventDefault(); fillCell(c) }}
              title={c || 'Clear fill'}
              style={{ width:15, height:15, borderRadius:3, background:c||'white', border:c?'1.5px solid transparent':'1.5px solid #d1d5db', cursor:'pointer', padding:0, flexShrink:0, position:'relative', overflow:'hidden' }}
              onMouseEnter={e => e.currentTarget.style.borderColor='#7c3aed'}
              onMouseLeave={e => e.currentTarget.style.borderColor=c?'transparent':'#d1d5db'}>
              {!c && <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, color:'#bbb', lineHeight:1 }}>✕</span>}
            </button>
          ))}
        </div>
      )}
      </div>{/* end sticky toolbar */}
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        onInput={() => { if (!pasteInProgressRef.current) onChange(editorRef.current.innerHTML) }}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onScroll={() => { if (imgSel) computeImgBar(imgSel) }}
        onClick={e => {
          if (e.target.type === 'checkbox') setTimeout(() => onChange(editorRef.current.innerHTML), 0)
          setShowTablePicker(false)
          if (e.target.tagName === 'IMG') { selectImg(e.target) }
          else { selectImg(null) }
        }}
        onMouseLeave={() => setTableHover([0,0])}
        className="note-editor"
        style={{ flex:1, border:'0.5px solid #e5e5e5', borderTop:'none', borderRadius:'0 0 10px 10px', padding:'12px 16px', outline:'none', fontSize: isMobile ? 16 : 13, lineHeight:1.4, overflowY:'auto', WebkitOverflowScrolling:'touch', color:'#333', minHeight:200 }} />
      {imgSel && imgBar && (<>
        <div onMouseDown={e => e.preventDefault()} style={{
          position:'absolute', top: Math.max(2, imgBar.top - 34), left: imgBar.left,
          zIndex:200, background:'#1c1c1e', borderRadius:6,
          display:'flex', alignItems:'center', gap:1, padding:'3px 5px',
          boxShadow:'0 2px 8px rgba(0,0,0,0.3)', pointerEvents:'auto'
        }}>
          {['25%','50%','75%','100%'].map(w => (
            <button key={w} onMouseDown={e => { e.preventDefault(); setImgWidth(w) }}
              style={{ background:'none', border:'none', color:'#fff', fontSize:11, cursor:'pointer', padding:'1px 6px', borderRadius:3, lineHeight:1.6 }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>{w}</button>
          ))}
          <div style={{ width:1, background:'#555', height:14, margin:'0 2px' }} />
          <button onMouseDown={e => { e.preventDefault(); removeSelectedImg() }}
            style={{ background:'none', border:'none', color:'#ff6b6b', fontSize:11, cursor:'pointer', padding:'1px 6px', borderRadius:3, lineHeight:1.6 }}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,80,80,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>✕</button>
        </div>
        <div onMouseDown={startDragResize} style={{
          position:'absolute', top: imgBar.top + imgBar.height - 8, left: imgBar.left + imgBar.width - 8,
          width:16, height:16, background:'#7c3aed', borderRadius:'0 0 4px 0',
          cursor:'se-resize', zIndex:200, border:'2px solid white', boxShadow:'0 1px 3px rgba(0,0,0,0.25)'
        }} />
      </>)}
    </div>
  )
}

// ─── Briefing Tab ─────────────────────────────────────────────────────────────
function BriefingTab() {
  const todayISO = toISODate(new Date())
  const [briefContent, setBriefContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const taskMetaRef = useRef({})
  const histRef = useRef()

  useEffect(() => { checkAndLoad(); loadHistory() }, [])

  useEffect(() => {
    if (!historyOpen) return
    const handler = e => { if (histRef.current && !histRef.current.contains(e.target)) setHistoryOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [historyOpen])

  const loadHistory = async () => {
    const { data } = await supabase.from('briefings').select('date').order('date', { ascending: false }).limit(60)
    if (data) setHistory(data.map(r => r.date))
  }

  const checkAndLoad = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await supabase.from('briefings').select('content').eq('date', todayISO).maybeSingle()
      setBriefContent(data?.content || null)
      setLoading(false)
    } catch (e) { setError('Could not load briefing: ' + e.message); setLoading(false) }
  }

  const generate = async () => {
    setGenerating(true); setError(null)
    try {
      // Delete today's existing row first
      await supabase.from('briefings').delete().eq('date', todayISO)

      const [{ data: tasks }, { data: calRaw }] = await Promise.all([
        supabase.from('tasks').select('*').eq('status', 'active'),
        supabase.from('calendar_events').select('*'),
      ])

      // Build task meta lookup for Action required coloring
      const meta = {}
      ;(tasks || []).forEach(t => { meta[t.title.toLowerCase()] = { color: t.color, substatus: t.substatus } })
      taskMetaRef.current = meta

      const todayDate = fromISODate(todayISO)
      const todayEvents = getEventsForRange(calRaw || [], todayDate, todayDate)
        .filter(ev => ev.start_date === todayISO && ev.type !== 'travel')
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
      const travelToday = getEventsForRange(calRaw || [], todayDate, todayDate).filter(ev => ev.type === 'travel')
      const horizon = new Date(todayDate); horizon.setDate(horizon.getDate() + 14)
      const horizonEvents = getEventsForRange(calRaw || [], new Date(todayDate.getTime() + 86400000), horizon)

      const dateStr = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

      const calLines = [
        ...travelToday.map(ev => `- [Travel] ${ev.title}`),
        ...todayEvents.map(ev => {
          const t = ev.all_day ? 'All day' : (ev.start_time ? ev.start_time.slice(0,5) : '')
          const dur = (!ev.all_day && ev.start_time && ev.end_time)
            ? Math.round((new Date(`2000-01-01T${ev.end_time}`) - new Date(`2000-01-01T${ev.start_time}`)) / 60000) : null
          return `- [${t}] ${ev.title}${dur ? ` (${dur} min)` : ''}`
        }),
      ].join('\n') || 'None scheduled.'

      const taskLines = (tasks || []).map(t => {
        const parts = [`- [${t.title}]`]
        if ((t.owners||[]).length) parts.push(`owners: ${t.owners.join(', ')}`)
        if (t.substatus) parts.push(`substatus: ${t.substatus}`)
        if (t.color) parts.push(`flag: ${t.color}`)
        if (t.due) parts.push(`due: ${t.due}`)
        const openSubs = (Array.isArray(t.subtasks) ? t.subtasks : []).filter(s => !s.done).length
        if (openSubs) parts.push(`open subtasks: ${openSubs}`)
        return parts.join(' | ')
      }).join('\n') || 'None.'

      const horizonLines = horizonEvents.length
        ? horizonEvents.map(ev => `- ${ev.start_date} ${ev.title}${ev.type==='travel'?' (travel)':''}`).join('\n') : ''

      const systemPrompt = `You are a personal assistant to a Global Quality Systems Director at a pharmaceutical and nutraceutical contract manufacturing company. You generate concise, professional daily briefings based on live task and calendar data. Your tone is direct, warm, and occasionally witty. No em dashes. Short paragraphs. Bullets for multiple items. Never use the words "KPI" or "KQI" — always say "KQM" (Key Quality Metrics).`

      const userPrompt = `Generate a daily briefing for today, ${dateStr}.

Today's calendar events:
${calLines}

Active tasks:
${taskLines}${horizonLines ? `\n\nUpcoming (next 14 days):\n${horizonLines}` : ''}

Format the briefing exactly in this order with these section headers:

## Good morning, Levi.
3 to 5 sentences summarizing the day's tone, key priorities, and anything worth flagging. Be specific — reference actual tasks and events by name. If travel is coming up within 3 days, mention it.

## Quote of the day
One motivational or leadership quote relevant to quality, leadership, or the nature of the day's work. Format as: "Quote text." — Author Name

## Did you know?
One genuinely interesting fact on any topic. Keep it to 2-3 sentences. Make it something worth remembering.

## Action required
Tasks flagged red, substatus at_risk, or with open subtasks. For each item lead with the task title in bold, then one sentence on why it needs attention and what the next action is. If nothing qualifies, omit this section entirely.

## Suggestions
3 to 5 opinionated, specific bullets on what Levi should focus on, follow up on, or decide today. Go beyond the active task list — if something hasn't been touched in a while, a deadline is approaching, a team member may need a check-in, or a strategic initiative is stalling, call it out. Be direct and useful, not generic.

## On your calendar
Bullet list of today's events with times and duration. If none, write "No meetings scheduled — good day to focus."

## On the horizon
Anything with a due date in the next 14 days, upcoming travel, or recurring deadlines (KQM Data Entry, KQM Report). Format as a simple dated list.

Important rules:
- You MUST include every section above using the exact ## headers shown. Never omit Quote of the day or Did you know — they are always required.
- Use actual task titles and names, not generic descriptions.
- Keep the full briefing under 650 words.`

      const { data: proxyData, error: proxyError } = await supabase.functions.invoke('anthropic-proxy', {
        body: { systemPrompt, userPrompt, model: 'claude-sonnet-4-6', max_tokens: 1200 },
      })
      if (proxyError) throw new Error(proxyError.message)
      if (proxyData?.error) throw new Error(proxyData.error?.message || proxyData.error)
      const result = proxyData
      const text = result.content[0].text
      await supabase.from('briefings').insert({ date: todayISO, content: text })
      setBriefContent(text); setSelectedDate(null)
      await loadHistory()
    } catch (e) {
      setError('Failed to generate briefing: ' + e.message)
    } finally { setGenerating(false) }
  }

  const loadHistoryEntry = async date => {
    setHistoryOpen(false)
    taskMetaRef.current = {}
    const { data } = await supabase.from('briefings').select('content').eq('date', date).maybeSingle()
    if (data?.content) { setBriefContent(data.content); setSelectedDate(date) }
  }

  const fmtDate = iso => {
    if (!iso) return ''
    return fromISODate(iso).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' })
  }

  const renderInline = text =>
    text.split(/\*\*(.*?)\*\*/g).map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)

  const renderContent = text => {
    if (!text) return null
    // Split into sections by ## headers
    const sections = []
    let cur = { header: null, lines: [] }
    for (const line of text.split('\n')) {
      if (/^## /.test(line)) { sections.push(cur); cur = { header: line.slice(3).trim(), lines: [] } }
      else cur.lines.push(line)
    }
    sections.push(cur)

    return sections.filter(s => s.header || s.lines.some(l => l.trim())).map((sec, si) => {
      const h = (sec.header || '').toLowerCase()
      const isGreeting = h.startsWith('good morning')
      const isQuote = h === 'quote of the day'
      const isDyk = h.startsWith('did you know')
      const isAction = h.startsWith('action required')

      // Clean leading/trailing blank lines
      const bodyLines = sec.lines
      while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift()
      while (bodyLines.length && !bodyLines[bodyLines.length-1].trim()) bodyLines.pop()

      const headerEl = sec.header && (
        <div style={{
          fontSize: isGreeting ? 22 : 10,
          fontWeight: isGreeting ? 700 : 600,
          color: isGreeting ? '#111' : '#999',
          marginTop: si === 0 ? 0 : 32,
          marginBottom: isGreeting ? 10 : 10,
          letterSpacing: isGreeting ? 0 : '0.08em',
          textTransform: isGreeting ? 'none' : 'uppercase',
        }}>
          {renderInline(sec.header)}
        </div>
      )

      let bodyEl
      if (isQuote || isDyk) {
        bodyEl = (
          <div style={{ background:'#f8f7f5', borderRadius:8, padding:'14px 18px' }}>
            {bodyLines.map((line, i) => {
              if (!line.trim()) return <div key={i} style={{ height:4 }} />
              return <p key={i} style={{ fontSize:13, color:'#555', margin:'0 0 2px', lineHeight:1.6, fontStyle: isQuote ? 'italic' : 'normal' }}>{renderInline(line)}</p>
            })}
          </div>
        )
      } else if (isAction) {
        // Group lines into items: each item starts with a **bold** line
        const items = []
        let cur = null
        for (const line of bodyLines) {
          if (!line.trim()) { if (cur) { items.push(cur); cur = null } continue }
          if (/^\*\*/.test(line)) {
            if (cur) items.push(cur)
            const titleMatch = line.match(/^\*\*(.*?)\*\*/)
            const titleKey = titleMatch ? titleMatch[1].toLowerCase() : ''
            const metaEntry = Object.entries(taskMetaRef.current).find(([k]) =>
              titleKey.includes(k) || k.includes(titleKey)
            )
            const info = metaEntry?.[1]
            const barColor = info?.color === 'red' ? '#ef4444' : info?.substatus === 'at_risk' ? '#f59e0b' : '#ef4444'
            cur = { lines: [line], barColor }
          } else {
            if (cur) cur.lines.push(line)
            else { cur = { lines: [line], barColor: '#ef4444' } }
          }
        }
        if (cur) items.push(cur)

        bodyEl = (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {items.map((item, ii) => (
              <div key={ii} style={{ display:'flex', gap:0 }}>
                <div style={{ width:3, borderRadius:2, background:item.barColor, flexShrink:0, marginRight:14, alignSelf:'stretch' }} />
                <div>
                  {item.lines.map((line, li) => (
                    /^\*\*/.test(line)
                      ? <div key={li} style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:2, lineHeight:1.5 }}>{renderInline(line)}</div>
                      : <div key={li} style={{ fontSize:13, color:'#555', lineHeight:1.55 }}>{renderInline(line)}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      } else {
        bodyEl = (
          <div>
            {bodyLines.map((line, i) => {
              if (!line.trim()) return <div key={i} style={{ height:5 }} />
              if (/^[-*] /.test(line)) return (
                <div key={i} style={{ display:'flex', gap:9, fontSize:13, color:'#333', marginBottom:4, lineHeight:1.55 }}>
                  <span style={{ color:'#ccc', flexShrink:0, marginTop:1 }}>•</span>
                  <span>{renderInline(line.slice(2))}</span>
                </div>
              )
              if (/^\d+\.\s/.test(line) && !isGreeting) return (
                <div key={i} style={{ display:'flex', gap:9, fontSize:13, color:'#333', marginBottom:4, lineHeight:1.55 }}>
                  <span style={{ color:'#ccc', flexShrink:0 }}>{line.match(/^(\d+)\./)[ 1]}.</span>
                  <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
                </div>
              )
              return <p key={i} style={{ fontSize:13, color:'#333', margin:'0 0 5px', lineHeight:1.6 }}>{renderInline(line)}</p>
            })}
          </div>
        )
      }

      return <div key={si}>{headerEl}{bodyEl}</div>
    })
  }

  const isToday = !selectedDate || selectedDate === todayISO

  if (loading) return <div style={{ padding:60, textAlign:'center', color:'#aaa', fontSize:13 }}>Loading briefing...</div>

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', marginBottom:24, gap:8 }}>
        <div ref={histRef} style={{ position:'relative' }}>
          <button onClick={() => setHistoryOpen(o => !o)}
            style={{ fontSize:12, padding:'6px 12px', border:'0.5px solid #e5e5e5', borderRadius:8, background:'white', cursor:'pointer', color:'#555', display:'flex', alignItems:'center', gap:4 }}>
            History <span style={{ fontSize:10, color:'#aaa' }}>▾</span>
          </button>
          {historyOpen && (
            <div style={{ position:'absolute', right:0, top:'calc(100% + 4px)', background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,0.1)', zIndex:50, minWidth:200, maxHeight:260, overflowY:'auto' }}>
              {history.length === 0
                ? <div style={{ padding:'12px 16px', fontSize:12, color:'#aaa' }}>No past briefings</div>
                : history.map(date => (
                  <button key={date} onClick={() => loadHistoryEntry(date)}
                    style={{ display:'block', width:'100%', textAlign:'left', fontSize:12, padding:'9px 16px', border:'none', borderBottom:'0.5px solid #f5f5f5', background:(selectedDate||todayISO)===date?'#f0f7ff':'white', cursor:'pointer', color:'#333' }}>
                    {date === todayISO ? '📅 Today' : fmtDate(date)}
                  </button>
                ))
              }
            </div>
          )}
        </div>
        {isToday && (
          <button onClick={generate} disabled={generating}
            style={{ fontSize:12, padding:'6px 14px', background:'#111', color:'white', border:'none', borderRadius:8, cursor:generating?'not-allowed':'pointer', opacity:generating?0.55:1, whiteSpace:'nowrap' }}>
            {generating ? 'Generating...' : briefContent ? '↺ Regenerate' : 'Generate'}
          </button>
        )}
      </div>

      {selectedDate && selectedDate !== todayISO && (
        <div style={{ fontSize:11, color:'#aaa', marginBottom:16, textAlign:'right' }}>Viewing {fmtDate(selectedDate)}</div>
      )}

      {error && (
        <div style={{ background:'#fff5f5', border:'0.5px solid #f0a0a0', borderRadius:8, padding:'10px 16px', fontSize:12, color:'#c0392b', marginBottom:20 }}>
          {error}
        </div>
      )}

      {generating && !briefContent && (
        <div style={{ padding:60, textAlign:'center', color:'#aaa', fontSize:13 }}>Generating your briefing...</div>
      )}

      {briefContent && (
        <div style={{ opacity:generating?0.45:1, transition:'opacity 0.25s' }}>
          {renderContent(briefContent)}
        </div>
      )}

      {!briefContent && !generating && !error && (
        <div style={{ background:'#f7f7f5', border:'0.5px dashed #ccc', borderRadius:12, padding:'48px 32px', textAlign:'center', color:'#bbb', fontSize:13 }}>
          No briefing yet for today. Click Generate to create one.
        </div>
      )}
    </div>
  )
}

// ─── Follow Ups Tab ───────────────────────────────────────────────────────────
const DEFAULT_FOLLOW_UP_PEOPLE = ['Margarita', 'Illya', 'Matthew', 'Kaat']
function FollowUpsTab({ followUps, onAdd, onToggle, onDelete, onUpdate, onCreateTask, people = DEFAULT_FOLLOW_UP_PEOPLE, tasks = [] }) {
  const [activePerson, setActivePerson] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [addingFor, setAddingFor] = useState(null)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [tasksOpenFor, setTasksOpenFor] = useState({})

  const startEdit = item => { setEditingId(item.id); setEditText(item.text) }
  const commitEdit = id => {
    const trimmed = editText.trim()
    if (trimmed) onUpdate(id, trimmed)
    else onDelete(id)
    setEditingId(null); setEditText('')
  }

  const extraPeople = [...new Set(followUps.map(f => f.person))].filter(p => p && !people.includes(p))
  const allPeople = [...people, ...extraPeople]

  const pendingFor = p => followUps.filter(f => f.person === p && !f.done).length
  const itemsFor = p => followUps.filter(f => f.person === p && (showDone || !f.done))
  const tss = t => t.substatus || (t.status === 'done' ? 'complete' : 'not_started')
  const tasksFor = p => tasks.filter(t => (t.owners||[]).includes(p) && tss(t) !== 'complete' && tss(t) !== 'canceled')
  const visiblePeople = activePerson ? [activePerson] : allPeople

  const handleAdd = person => {
    if (!newText.trim()) return
    onAdd(newText.trim(), person)
    setNewText(''); setAddingFor(null)
  }

  return (
    <div>
      {/* Person filter pills */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:1, background:'#ede9fe', borderRadius:10, padding:3, flexWrap:'wrap' }}>
          <button onClick={() => setActivePerson(null)}
            style={{ fontSize:12, padding:'4px 12px', borderRadius:8, cursor:'pointer', border:'none', background:activePerson===null?'linear-gradient(135deg,#4f46e5,#7c3aed)':'transparent', color:activePerson===null?'white':'#7c3aed', fontWeight:activePerson===null?600:400, transition:'background 0.15s, color 0.15s' }}>
            All
          </button>
          {allPeople.map(p => {
            const cnt = pendingFor(p), active = activePerson === p
            const mc = MEMBER_COLORS[p]
            return (
              <button key={p} onClick={() => setActivePerson(active ? null : p)}
                style={{ fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:'none', background:active?(mc?.bg||'#ede9fe'):'transparent', color:active?(mc?.tc||'#7c3aed'):'#7c3aed', fontWeight:active?600:400, display:'flex', alignItems:'center', gap:5, transition:'background 0.15s, color 0.15s' }}>
                {p}
                {cnt > 0 && <span style={{ fontSize:10, background:'rgba(0,0,0,0.1)', color:'inherit', borderRadius:10, padding:'0 5px', minWidth:14, textAlign:'center' }}>{cnt}</span>}
              </button>
            )
          })}
        </div>
        <button onClick={() => setShowDone(v => !v)}
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:showDone?'none':'0.5px solid #c4b5fd', background:showDone?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', color:showDone?'white':'#7c3aed', height:28, transition:'background 0.15s, color 0.15s' }}>
          ✓ Done
        </button>
      </div>

      {/* Per-person sections */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {visiblePeople.map(person => {
          const items = itemsFor(person)
          const pending = pendingFor(person)
          if (!activePerson && items.length === 0) return null
          const mc = MEMBER_COLORS[person]
          return (
            <div key={person} style={{ background:'#f7f7f5', borderRadius:12, padding:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:26, height:26, borderRadius:'50%', background:mc?.bg||'#e8e8e8', color:mc?.tc||'#888', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, border:'0.5px solid rgba(0,0,0,0.06)' }}>{person[0]}</div>
                  <span style={{ fontSize:13, fontWeight:500, color:'#111' }}>{person}</span>
                  {pending > 0 && <span style={{ fontSize:10, color:'#888', background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px' }}>{pending} pending</span>}
                </div>
                <button onClick={() => { setAddingFor(addingFor === person ? null : person); setNewText('') }}
                  style={{ fontSize:11, color:'#888', background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'3px 9px', cursor:'pointer', fontFamily:'inherit' }}>
                  {addingFor === person ? 'Cancel' : '+ Add'}
                </button>
              </div>

              {/* Assigned tasks */}
              {(() => {
                const pt = tasksFor(person)
                if (pt.length === 0) return null
                const isOpen = tasksOpenFor[person] !== false
                return (
                  <div style={{ marginBottom:8 }}>
                    <button onClick={() => setTasksOpenFor(s => ({...s, [person]: !isOpen}))}
                      style={{ display:'flex', alignItems:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:'2px 0 6px', color:'#888', fontSize:11, fontFamily:'inherit', width:'100%', textAlign:'left' }}>
                      <span style={{ fontSize:8, display:'inline-block', transition:'transform 0.15s', transform: isOpen?'rotate(90deg)':'rotate(0deg)' }}>▶</span>
                      {pt.length} assigned task{pt.length !== 1 ? 's' : ''}
                    </button>
                    {isOpen && pt.map(t => {
                      const ss = subStyle(tss(t))
                      return (
                        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 8px', background:'white', borderRadius:6, border:'0.5px solid #ebebeb', marginBottom:3 }}>
                          <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background:ss.bg, border:`1px solid ${ss.border}` }} />
                          <span style={{ flex:1, fontSize:12, color:'#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
                          <span style={{ fontSize:10, color:ss.tc, background:ss.bg, border:`0.5px solid ${ss.border}`, borderRadius:10, padding:'1px 6px', whiteSpace:'nowrap', flexShrink:0 }}>{ss.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}

              {addingFor === person && (
                <div style={{ display:'flex', gap:6, marginBottom:8 }}>
                  <input autoFocus value={newText} onChange={e => setNewText(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') handleAdd(person); if (e.key==='Escape') { setAddingFor(null); setNewText('') } }}
                    placeholder="Follow-up item..."
                    style={{ flex:1, fontSize:13, padding:'6px 10px', border:'0.5px solid #e0e0e0', borderRadius:8, outline:'none', fontFamily:'inherit' }} />
                  <button onClick={() => handleAdd(person)}
                    style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'0 14px', cursor:'pointer', fontFamily:'inherit' }}>
                    Add
                  </button>
                </div>
              )}

              {items.length === 0 && addingFor !== person && (
                <div style={{ fontSize:12, color:'#bbb', padding:'4px 0 2px' }}>No pending follow-ups — click + Add to create one</div>
              )}
              {items.map(item => (
                <div key={item.id}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', background:item.done?'transparent':'white', borderRadius:6, border:item.done?'none':'0.5px solid #ebebeb', marginBottom:4 }}
                  onMouseEnter={e => { e.currentTarget.querySelectorAll('.fu-action').forEach(el => el.style.opacity='1') }}
                  onMouseLeave={e => { e.currentTarget.querySelectorAll('.fu-action').forEach(el => el.style.opacity='0') }}>
                  <input type="checkbox" checked={!!item.done} onChange={e => onToggle(item.id, e.target.checked)} style={{ width:14, height:14, cursor:'pointer', flexShrink:0 }} />
                  {editingId === item.id ? (
                    <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter') commitEdit(item.id); if (e.key==='Escape') { setEditingId(null); setEditText('') } }}
                      onBlur={() => commitEdit(item.id)}
                      style={{ flex:1, fontSize:13, padding:'2px 4px', border:'none', borderBottom:'1.5px solid #111', outline:'none', background:'transparent', fontFamily:'inherit', color:'#333' }} />
                  ) : (
                    <span onClick={() => !item.done && startEdit(item)} style={{ flex:1, fontSize:13, color:item.done?'#bbb':'#333', textDecoration:item.done?'line-through':'none', cursor:item.done?'default':'text' }}>{item.text}</span>
                  )}
                  {editingId !== item.id && (
                    <>
                      {!item.done && onCreateTask && (
                        <button className="fu-action" onClick={() => onCreateTask(item)} title="Create task"
                          style={{ fontSize:10, color:'#ddd', background:'none', border:'none', cursor:'pointer', opacity:0, transition:'opacity 0.1s', padding:'0 2px', flexShrink:0 }}
                          onMouseEnter={e => e.currentTarget.style.color='#0C447C'}
                          onMouseLeave={e => e.currentTarget.style.color='#ddd'}>+task</button>
                      )}
                      <button className="fu-action" onClick={() => startEdit(item)}
                        style={{ fontSize:10, color:'#ddd', background:'none', border:'none', cursor:'pointer', opacity:0, transition:'opacity 0.1s', padding:'0 2px', flexShrink:0 }}
                        onMouseEnter={e => e.currentTarget.style.color='#555'}
                        onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✎</button>
                      <button className="fu-action" onClick={() => onDelete(item.id)}
                        style={{ fontSize:10, color:'#ddd', background:'none', border:'none', cursor:'pointer', opacity:0, transition:'opacity 0.1s', padding:'0 2px', flexShrink:0 }}
                        onMouseEnter={e => e.currentTarget.style.color='#E24B4A'}
                        onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )
        })}
        {visiblePeople.every(p => itemsFor(p).length === 0) && !activePerson && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb', fontSize:13 }}>
            No follow-ups yet — select a person above and click + Add
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Linear Task Page (mockup) ────────────────────────────────────────────────
const LINEAR_NCOL = 3

// ─── Linear page building blocks (module scope so they don't remount on every render) ──
function OwnerStack({ owners }) {
  return (
    <div style={{ display:'flex', alignItems:'center' }}>
      {owners.map((o, i) => {
        const c = MEMBER_COLORS[o] || { bg:'#f0f0f0', tc:'#888' }
        return (
          <div key={o} title={o}
            style={{ width:18, height:18, borderRadius:'50%', background:c.bg, color:c.tc, fontSize:10, fontWeight:500, display:'flex', alignItems:'center', justifyContent:'center', border:'2px solid white', boxSizing:'content-box', marginLeft: i === 0 ? 0 : -8, position:'relative', zIndex: owners.length - i }}>
            {o[0]}
          </div>
        )
      })}
    </div>
  )
}
const Indicator = () => <div style={{ height:3, borderRadius:2, background:'linear-gradient(90deg,#4f46e5,#7c3aed)', margin:'-3px 4px 0', boxShadow:'0 0 6px rgba(124,58,237,0.4)' }} />
const chevronBtn = (open, onClick) => (
  <button onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onClick() }}
    style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:11, lineHeight:1, padding:'2px 4px', flexShrink:0 }}>
    {open ? '▾' : '▸'}
  </button>
)
// Wraps trailing header controls (add button, chevron, etc.) and pushes the group flush right together
const linHeaderRight = (...nodes) => (
  <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
    {nodes}
  </div>
)
const pill = (activeVal, val, label, onClick) => (
  <button key={val} onClick={onClick}
    style={{ fontSize:11, padding:'4px 12px', border:'none', background:activeVal===val?'linear-gradient(135deg,#4f46e5,#7c3aed)':'transparent', color:activeVal===val?'white':'#7c3aed', fontWeight:activeVal===val?600:400, cursor:'pointer', borderRadius:8, whiteSpace:'nowrap' }}>
    {label}
  </button>
)
const linAddIconBtn = onClick => (
  <button onClick={e => { e.stopPropagation(); onClick() }} onPointerDown={e => e.stopPropagation()} title="Add task"
    style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:15, lineHeight:1, padding:'2px 5px', flexShrink:0, fontWeight:600 }}
    onMouseEnter={e => e.currentTarget.style.color = '#7c3aed'} onMouseLeave={e => e.currentTarget.style.color = '#bbb'}>
    +
  </button>
)
const linColorBtn = (onClick, shade) => (
  <button onClick={e => { e.stopPropagation(); onClick() }} onPointerDown={e => e.stopPropagation()} title="Customize color"
    style={{ width:13, height:13, borderRadius:'50%', flexShrink:0, padding:0, cursor:'pointer', background: shade || '#e5e5e5', border: shade ? '1.5px solid rgba(0,0,0,0.15)' : '1.5px dashed #bbb' }}
    onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
    onMouseLeave={e => e.currentTarget.style.borderColor = shade ? 'rgba(0,0,0,0.15)' : '#bbb'} />
)
const linHideBtn = onClick => (
  <button onClick={e => { e.stopPropagation(); onClick() }} onPointerDown={e => e.stopPropagation()} title="Remove from view (empty domain — stays available elsewhere)"
    style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:12, lineHeight:1, padding:'2px 4px', flexShrink:0 }}
    onMouseEnter={e => e.currentTarget.style.color = '#c0392b'} onMouseLeave={e => e.currentTarget.style.color = '#ccc'}>
    ✕
  </button>
)

function DomainColorPopover({ name, meta, onUpdate, onClose }) {
  return (
    <>
      <div onClick={e => { e.stopPropagation(); onClose() }} style={{ position:'fixed', inset:0, zIndex:150 }} />
      <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
        style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, padding:10, minWidth:170 }}>
        <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, fontSize:12, color:'#555', marginBottom:8, cursor:'pointer' }}>
          Shade
          <input type="color" value={meta.color || '#f7f7f5'} onChange={e => onUpdate({ color: e.target.value })} style={{ width:32, height:24, border:'none', padding:0, cursor:'pointer', background:'none' }} />
        </label>
        <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, fontSize:12, color:'#555', marginBottom: (meta.color || meta.text_color) ? 8 : 0, cursor:'pointer' }}>
          Title color
          <input type="color" value={meta.text_color || '#888888'} onChange={e => onUpdate({ text_color: e.target.value })} style={{ width:32, height:24, border:'none', padding:0, cursor:'pointer', background:'none' }} />
        </label>
        {(meta.color || meta.text_color) && (
          <button onClick={() => onUpdate({ color:null, text_color:null })}
            style={{ fontSize:11, color:'#888', background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 0', cursor:'pointer', width:'100%' }}>
            Reset to default
          </button>
        )}
      </div>
    </>
  )
}

function Row({ t, hideLinked, listTasks, listId, v }) {
  const ss = subStyle(v.tss(t))
  const done = v.tss(t) === 'complete'
  const owners = t.owners || []
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')
  const linked = v.entityMap[t.project_id] || v.entityMap[t.escalation_id] || null
  const hideLink = hideLinked || v.groupBy === 'project'
  const fb = flagBorder(t.color)
  const subs = Array.isArray(t.subtasks) ? t.subtasks : []
  const notes = Array.isArray(t.notes) ? t.notes : []
  const notesOpen = v.openNotes.has(t.id)
  const siblings = listTasks || []
  const siblingIds = siblings.map(x => x.id)
  const rowDrop = v.rowDrop
  const dropInd = pos => <div style={{ height:3, borderRadius:2, background:'linear-gradient(90deg,#4f46e5,#7c3aed)', margin: pos === 'before' ? '0 0 3px' : '3px 0 0' }} />
  return (
    <div data-tid={t.id} style={{ marginBottom:4 }}>
      {rowDrop && rowDrop.overId === t.id && rowDrop.pos === 'before' && dropInd('before')}
      <div draggable onClick={() => v.onEdit(t)}
        onDragStart={e => { e.stopPropagation(); v.dragTaskRef.current = t.id; e.dataTransfer.setData('text/task', t.id); if (listId) e.dataTransfer.setData('text/fromlist', listId); e.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => { v.dragTaskRef.current = null; v.setRowDrop(null); v.clearOutlines() }}
        onDragOver={e => { const d = v.dragTaskRef.current; if (d && d !== t.id && siblingIds.includes(d)) { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); v.setRowDrop({ overId: t.id, pos: e.clientY < r.top + r.height / 2 ? 'before' : 'after' }) } }}
        onDrop={e => { const d = v.dragTaskRef.current; if (d && siblingIds.includes(d) && listId) { e.preventDefault(); e.stopPropagation(); v.reorderTo(siblings, d, t.id, rowDrop?.pos || 'before', listId) } v.dragTaskRef.current = null; v.setRowDrop(null) }}
        style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 10px', background:'white', borderRadius:8, border:'0.5px solid #ebebeb', borderLeft: fb ? `3px solid ${fb}` : '0.5px solid #ebebeb', cursor:'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = fb || '#d8d8d8'; if (fb) e.currentTarget.style.borderLeftColor = fb }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#ebebeb'; if (fb) e.currentTarget.style.borderLeftColor = fb }}>
        <div onClick={e => { e.stopPropagation(); v.onComplete(t.id, !done) }} title="Toggle complete"
          style={{ width:15, height:15, borderRadius:'50%', border:`1.5px solid ${ss.border||'#ccc'}`, background: done ? (ss.bg||'#eee') : 'white', flexShrink:0, boxSizing:'border-box', cursor:'pointer' }} />
        <span style={{ flex:1, minWidth:0, fontSize:12, color: done?'#aaa':'#222', textDecoration: done?'line-through':'none', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35 }}>
          {t.today && <span style={{ fontSize:9, color:'#E24B4A', marginRight:6, fontWeight:600 }}>TODAY</span>}
          {t.title}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:'52%' }}>
          {subs.length > 0 && <span style={{ fontSize:10, color:'#aaa' }}>☑ {subs.filter(s => s.done).length}/{subs.length}</span>}
          {notes.length > 0 && <button onClick={e => { e.stopPropagation(); v.toggleNotes(t.id) }} title="Notes"
            style={{ fontSize:10, color: notesOpen?'#7c3aed':'#aaa', background: notesOpen?'#ede9fe':'none', border:'none', borderRadius:6, padding:'1px 5px', cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:3 }}><StickyNote size={11} strokeWidth={2} /> {notes.length}</button>}
          {v.groupBy !== 'status' && <span style={{ fontSize:10, color:ss.tc, background:ss.bg, border:`0.5px solid ${ss.border}`, borderRadius:20, padding:'1px 7px', whiteSpace:'nowrap' }}>{ss.label}</span>}
          {!hideLink && linked && <span style={{ fontSize:10, fontWeight:500, background:linked.type==='project'?'#EAF3DE':'#FCEBEB', color:linked.type==='project'?'#27500A':'#791F1F', padding:'2px 7px', borderRadius:20, border:`0.5px solid ${linked.type==='project'?'#97C459':'#F09595'}`, whiteSpace:'nowrap', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis' }}>{linked.name}</span>}
          {v.groupBy !== 'domain' && t.domain && <Badge type="domain">{t.domain}</Badge>}
          {t.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:20, border:'0.5px solid #F09595', whiteSpace:'nowrap' }}>High</span>}
          {v.groupBy !== 'owner' && showOwners && <OwnerStack owners={owners} />}
          {t.due && <Badge type="due">{t.due}</Badge>}
        </div>
      </div>
      {rowDrop && rowDrop.overId === t.id && rowDrop.pos === 'after' && dropInd('after')}
      {notesOpen && notes.length > 0 && (
        <div style={{ background:'#fafafa', border:'0.5px solid #ececec', borderRadius:8, padding:'8px 10px', marginTop:3 }}>
          {t.updated_at && <div style={{ fontSize:9, color:'#a99fc0', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>Task modified {fmtDateTime(t.updated_at)}</div>}
          {notes.map(n => (
            <div key={n.id} style={{ fontSize:11, color:'#555', lineHeight:1.5, marginBottom:4 }}>
              <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EscRow({ e, v, escList }) {
  const ss = subStyle(e.substatus || 'not_started')
  const owners = e.owners || []
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')
  const escTasks = v.tasks.filter(t => t.escalation_id === e.id && v.tss(t) !== 'canceled' && (v.showDone || v.tss(t) !== 'complete') && v.ownerMatch(t)).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const notes = Array.isArray(e.notes) ? e.notes : []
  const fb = flagBorder(e.color)
  const id = `esc:${e.id}`
  const open = !v.isMin(id)
  const noteKey = `escnotes:${e.id}`
  const notesOpen = v.openNotes.has(noteKey)
  const list = escList || []
  const listIds = list.map(x => x.id)
  const entDrop = v.entDrop
  const entInd = pos => <div style={{ height:3, borderRadius:2, background:'linear-gradient(90deg,#7c3aed,#a855f7)', margin: pos === 'before' ? '0 0 4px' : '4px 0 0' }} />
  return (
    <div
      onDragOver={ev => { const d = v.dragEntRef.current; if (d && d !== e.id && listIds.includes(d)) { ev.preventDefault(); const r = ev.currentTarget.getBoundingClientRect(); v.setEntDrop({ overId: e.id, pos: ev.clientY < r.top + r.height / 2 ? 'before' : 'after' }) } }}
      onDrop={ev => { const d = v.dragEntRef.current; if (d && listIds.includes(d)) { ev.preventDefault(); v.reorderTo(list, d, e.id, entDrop?.pos || 'before', 'escalations') } v.dragEntRef.current = null; v.setEntDrop(null) }}
      style={{ background:'transparent' }}>
      {entDrop && entDrop.overId === e.id && entDrop.pos === 'before' && entInd('before')}
      <div style={{ background:'#fdf6f6', borderRadius:8, border:'0.5px solid #f2dede', borderLeft:`3px solid ${fb || '#F09595'}`, marginBottom:4, padding:'8px 10px' }}>
      <div draggable onDragStart={ev => { v.dragEntRef.current = e.id; ev.dataTransfer.setData('text/ent', e.id); ev.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => { v.dragEntRef.current = null; v.setEntDrop(null) }}
        onDoubleClick={() => v.onOpenEscalation && v.onOpenEscalation(e)} title="Drag to reorder · double-click to open"
        style={{ display:'flex', alignItems:'center', gap:10, cursor:'grab' }}>
        <span style={{ flex:1, minWidth:0, fontSize:12, fontWeight:500, color:'#8a2b2b', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.3 }}>{e.title}</span>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end', maxWidth:'52%' }}>
          {escTasks.length > 0 && <span style={{ fontSize:10, color:'#aaa' }}>{escTasks.length} task{escTasks.length!==1?'s':''}</span>}
          {notes.length > 0 && <button onClick={ev => { ev.stopPropagation(); v.toggleNotes(noteKey) }} title="Notes"
            style={{ fontSize:10, color: notesOpen?'#7c3aed':'#aaa', background: notesOpen?'#ede9fe':'none', border:'none', borderRadius:6, padding:'1px 5px', cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:3 }}><StickyNote size={11} strokeWidth={2} /> {notes.length}</button>}
          {e.substatus && <span style={{ fontSize:10, color:ss.tc, background:ss.bg, border:`0.5px solid ${ss.border}`, borderRadius:20, padding:'1px 7px', whiteSpace:'nowrap' }}>{ss.label}</span>}
          {e.domain && <Badge type="domain">{e.domain}</Badge>}
          {e.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:20, border:'0.5px solid #F09595', whiteSpace:'nowrap' }}>High</span>}
          {showOwners && <OwnerStack owners={owners} />}
          {e.due && <Badge type="due">{e.due}</Badge>}
        </div>
        {linHeaderRight(v.onAddTask && linAddIconBtn(() => v.onAddTask({ escalation_id: e.id })), chevronBtn(open, () => v.toggleMin(id)))}
      </div>
      {open && escTasks.length > 0 && (() => {
        const escListId = `esc:${e.id}`
        const ordered = v.orderList(escListId, escTasks)
        return (
          <div style={{ marginTop:8 }}>
            {ordered.map(t => <Row key={t.id} t={t} listTasks={ordered} listId={escListId} v={v} />)}
          </div>
        )
      })()}
      {notesOpen && notes.length > 0 && (
        <div style={{ background:'#fafafa', border:'0.5px solid #ececec', borderRadius:8, padding:'8px 10px', marginTop:8 }}>
          {notes.map(n => (
            <div key={n.id} style={{ fontSize:11, color:'#555', lineHeight:1.5, marginBottom:4 }}>
              <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
            </div>
          ))}
        </div>
      )}
      </div>
      {entDrop && entDrop.overId === e.id && entDrop.pos === 'after' && entInd('after')}
    </div>
  )
}

function SectionCard({ label, count, accent, bg = '#f7f7f5', border, minId, children, v, onAdd }) {
  const open = !minId || !v.isMin(minId)
  return (
    <div style={{ background:bg, border: border ? `0.5px solid ${border}` : undefined, borderRadius:12, padding:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: open ? 10 : 0 }}>
        {accent && <span style={{ width:7, height:7, borderRadius:'50%', background:accent }} />}
        <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
        <span style={{ fontSize:10, color:'#888', background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px' }}>{count}</span>
        {linHeaderRight(onAdd && linAddIconBtn(onAdd), minId && chevronBtn(open, () => v.toggleMin(minId)))}
      </div>
      {open && children}
    </div>
  )
}

function CategoryCard({ g, onGrab, ghost, v, renderTasks }) {
  const id = `cat:${v.groupBy}:${g.key}`
  const open = !v.isMin(id)
  const isDomain = v.groupBy === 'domain' && g.key !== '__none'
  const meta = isDomain ? (v.domainMeta[g.key] || {}) : {}
  const colorOpen = isDomain && v.colorEditKey === g.key
  return (
    <div data-lcard
      onDragOver={onGrab ? e => { e.preventDefault() } : undefined}
      onDragEnter={onGrab ? e => { e.currentTarget.style.outline = '2px dashed #7c3aed'; e.currentTarget.style.outlineOffset = '2px' } : undefined}
      onDragLeave={onGrab ? e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.style.outline = 'none' } : undefined}
      onDrop={onGrab ? e => v.handleSectionDrop(e, g) : undefined}
      style={{ background: meta.color || '#f7f7f5', borderRadius:12, padding:12, visibility: ghost ? 'hidden' : 'visible', position:'relative' }}>
      <div onPointerDown={onGrab}
        onDoubleClick={v.groupBy === 'project' && g.key !== '__none' ? () => v.onOpenProject && v.onOpenProject(g.key) : undefined}
        title={v.groupBy === 'project' && g.key !== '__none' ? 'Double-click to open' : undefined}
        style={{ display:'flex', alignItems:'center', gap:8, marginBottom: open ? 10 : 0, cursor: onGrab ? 'grab' : 'default', touchAction:'none', userSelect:'none', position:'relative' }}>
        {!v.isMobile && <span title="Drag to rearrange" style={{ color:'#bfb6d6', fontSize:14, lineHeight:1, flexShrink:0 }}>⠿</span>}
        <span style={v.groupBy === 'project'
          ? { flex:'1 1 auto', minWidth:0, fontSize:10, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }
          : { fontSize:11, fontWeight:500, color: meta.text_color || '#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{g.label}</span>
        <span style={{ fontSize:10, color:'#888', background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', flexShrink:0 }}>{g.tasks.length}</span>
        {linHeaderRight(
          v.onAddTask && linAddIconBtn(() => v.onAddTask(v.addPrefill(g.key))),
          isDomain && v.onUpdateDomainMeta && linColorBtn(() => v.setColorEditKey(colorOpen ? null : g.key), meta.color),
          isDomain && g.tasks.length === 0 && v.hideDomain && linHideBtn(() => v.hideDomain(g.key)),
          chevronBtn(open, () => v.toggleMin(id))
        )}
        {colorOpen && <DomainColorPopover name={g.label} meta={meta}
          onUpdate={patch => v.onUpdateDomainMeta(g.key, patch)}
          onClose={() => v.setColorEditKey(null)} />}
      </div>
      {open && renderTasks(g.tasks, g.key)}
    </div>
  )
}

function TaskLinearMockup({ tasks, entityMap = {}, domains = [], domainMeta = {}, memberNames = [], escalations = [], isMobile = false, onEdit, onComplete, onOpenEscalation, onOpenProject, onUpdateTasks, onRestoreTask, onDeleteTask, onAddTask, onAddEscalation, onAddDomain, onUpdateDomainMeta, onOpenClassic }) {
  const [groupBy, setGroupByState] = useState(() => localStorage.getItem('taskr-linear-group') || 'domain')
  const setGroupBy = k => { setGroupByState(k); try { localStorage.setItem('taskr-linear-group', k) } catch {} }
  const [showDone, setShowDone] = useState(false)
  const [listView, setListView] = useState(false)
  const [search, setSearch] = useState('')
  const [showTrash, setShowTrash] = useState(false)
  const [addingEsc, setAddingEsc] = useState(false)
  const [newEscTitle, setNewEscTitle] = useState('')
  const handleAddEsc = () => {
    const title = newEscTitle.trim()
    if (title && onAddEscalation) onAddEscalation(title)
    setNewEscTitle(''); setAddingEsc(false)
  }
  const [addingDomain, setAddingDomain] = useState(false)
  const [newDomainTitle, setNewDomainTitle] = useState('')
  const handleAddDomain = () => {
    const title = newDomainTitle.trim()
    if (title && onAddDomain) onAddDomain(title)
    setNewDomainTitle(''); setAddingDomain(false)
  }
  const [hiddenDomains, setHiddenDomains] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('taskr-linear-hidden-domains')) || []) } catch { return new Set() } })
  const hideDomain = key => setHiddenDomains(prev => { const n = new Set(prev); n.add(key); try { localStorage.setItem('taskr-linear-hidden-domains', JSON.stringify([...n])) } catch {} return n })
  const [colorEditKey, setColorEditKey] = useState(null)
  const [filterOwner, setFilterOwner] = useState('all')
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const [sortCol, setSortCol] = useState('title')
  const [sortDir, setSortDir] = useState('asc')
  const [colFilters, setColFilters] = useState({ status:'', domain:'', owner:'' })
  const [colsByGroup, setColsByGroup] = useState(() => { try { return JSON.parse(localStorage.getItem('taskr-linear-cols')) || {} } catch { return {} } })
  const [numCols, setNumColsState] = useState(() => { const n = parseInt(localStorage.getItem('taskr-linear-numcols'), 10); return n >= 1 && n <= 8 ? n : LINEAR_NCOL })
  const setNumCols = n => { const clamped = Math.max(1, Math.min(8, n)); setNumColsState(clamped); try { localStorage.setItem('taskr-linear-numcols', String(clamped)) } catch {} }
  const [orders, setOrders] = useState(() => { try { return JSON.parse(localStorage.getItem('taskr-linear-order')) || {} } catch { return {} } })
  const [minimized, setMinimized] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('taskr-linear-min')) || []) } catch { return new Set() } })
  const [openNotes, setOpenNotes] = useState(() => new Set())
  const toggleNotes = id => setOpenNotes(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const persistMin = n => { try { localStorage.setItem('taskr-linear-min', JSON.stringify([...n])) } catch {} }
  const isMin = id => minimized.has(id)
  const toggleMin = id => setMinimized(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); persistMin(n); return n })
  const [drag, setDrag] = useState(null)          // { key, x, y, offsetX, offsetY, w }
  const [dropTarget, setDropTarget] = useState(null) // { col, index }
  const [rowDrop, setRowDrop] = useState(null)    // { overId, pos } — within-list reorder indicator
  const [entDrop, setEntDrop] = useState(null)    // { overId, pos } — escalation/cluster reorder indicator
  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const dropRef = useRef(null)
  const dragTaskRef = useRef(null)                // id of task being dragged (for reorder detection)
  const dragEntRef = useRef(null)                 // id of escalation/project being dragged (for reorder)

  const tss = t => t.substatus || (t.status === 'done' ? 'complete' : 'not_started')
  const ownerMatch = t => filterOwner === 'all' || (t.owners || []).includes(filterOwner)
  const q = search.trim().toLowerCase()
  const matchSearch = t => !q || (t.title || '').toLowerCase().includes(q) || (Array.isArray(t.notes) && t.notes.some(n => (n.text || '').toLowerCase().includes(q)))
  const activeTasks = tasks.filter(t => tss(t) !== 'canceled' && (showDone || tss(t) !== 'complete') && ownerMatch(t) && matchSearch(t))
    .slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const trashTasks = tasks.filter(t => t.substatus === 'canceled')

  // Per-view manual ordering (client-side, keyed per list so it never touches the global board order)
  const orderList = (listId, list) => {
    const ord = orders[listId]
    if (!ord) return list
    const pos = Object.fromEntries(ord.map((id, i) => [id, i]))
    return list.slice().sort((a, b) => {
      const pa = pos[a.id] ?? Infinity, pb = pos[b.id] ?? Infinity
      return pa !== pb ? pa - pb : (a.sort_order || 0) - (b.sort_order || 0)
    })
  }
  const saveOrder = (listId, orderedIds) => {
    const next = { ...orders, [listId]: orderedIds }
    setOrders(next)
    try { localStorage.setItem('taskr-linear-order', JSON.stringify(next)) } catch {}
  }
  const reorderTo = (listTasks, draggedId, overId, pos, listId) => {
    const ids = listTasks.map(t => t.id).filter(id => id !== draggedId)
    let idx = overId ? ids.indexOf(overId) : ids.length
    if (idx < 0) idx = ids.length
    if (pos === 'after') idx += 1
    ids.splice(idx, 0, draggedId)
    if (ids.join(',') !== listTasks.map(t => t.id).join(',')) saveOrder(listId, ids)
  }

  // Prefill for a new task created inside a section (matches the section's grouping attribute)
  const addPrefill = key => {
    if (groupBy === 'status') return { substatus: key }
    if (groupBy === 'domain') return { domain: key === '__none' ? '' : key }
    if (groupBy === 'owner') return { owners: key === '__un' ? [] : [key] }
    if (groupBy === 'project') return { project_id: key === '__none' ? null : key }
    return {}
  }

  // Move task(s) into a category by changing the underlying grouping attribute
  const applyMove = (ids, targetKey) => {
    if (!onUpdateTasks || !ids?.length) return
    let patch = null
    if (groupBy === 'status') patch = { substatus: targetKey }
    else if (groupBy === 'domain') patch = { domain: targetKey === '__none' ? '' : targetKey }
    else if (groupBy === 'owner') patch = { owners: targetKey === '__un' ? [] : [targetKey] }
    else if (groupBy === 'project') patch = { project_id: targetKey === '__none' ? null : targetKey }
    if (patch) onUpdateTasks(ids, patch)
  }
  // Owner move: swap the source owner for the target so other co-owners are preserved
  const moveTaskToOwner = (taskId, targetKey, fromListId) => {
    if (!onUpdateTasks) return
    if (targetKey === '__un') { onUpdateTasks([taskId], { owners: [] }); return }
    const srcOwner = fromListId ? fromListId.split(':')[1] : null // "owner:<name>:main"
    const cur = tasks.find(t => t.id === taskId)?.owners || []
    const next = cur.filter(o => o !== srcOwner)
    if (!next.includes(targetKey)) next.push(targetKey)
    onUpdateTasks([taskId], { owners: next })
  }
  const mainListId = sectionKey => `${groupBy}:${sectionKey}:main`
  const handleSectionDrop = (e, g) => {
    e.preventDefault()
    e.currentTarget.style.outline = 'none'
    const taskId = e.dataTransfer.getData('text/task')
    const taskIds = e.dataTransfer.getData('text/tasks')
    if (taskId) {
      const listForReorder = orderList(mainListId(g.key), groupBy === 'project' ? (g.tasks || []) : (g.tasks || []).filter(t => !t.project_id))
      if (listForReorder.some(t => t.id === taskId)) {
        // dropped in this section's empty area but already belongs here → move to the end
        reorderTo(listForReorder, taskId, null, 'after', mainListId(g.key))
      } else if (groupBy === 'owner') {
        moveTaskToOwner(taskId, g.key, e.dataTransfer.getData('text/fromlist'))
      } else {
        applyMove([taskId], g.key)
      }
    } else if (taskIds) applyMove(taskIds.split(','), g.key)
  }
  const clearOutlines = () => { if (containerRef.current) containerRef.current.querySelectorAll('[data-lcard]').forEach(el => { el.style.outline = 'none' }) }

  // Tasks already shown in the Today section are hidden from the board below to avoid duplicates
  const boardTasks = activeTasks.filter(t => !t.today)

  let groups = []
  if (groupBy === 'status') {
    groups = COLS.map(c => ({ key:c.key, label:c.lbl, tasks: boardTasks.filter(t => tss(t) === c.key) }))
  } else if (groupBy === 'domain') {
    // Show every known domain (not just ones with tasks) so a freshly-added or empty domain still gets a column
    const extra = [...new Set(boardTasks.map(t => t.domain).filter(d => d && !domains.includes(d)))]
    const dk = [...domains, ...extra].sort((a, b) => a.localeCompare(b))
    groups = dk.map(d => ({ key:d, label:d, tasks: boardTasks.filter(t => (t.domain||'') === d) }))
    const noDomainTasks = boardTasks.filter(t => !t.domain)
    if (noDomainTasks.length) groups.push({ key:'__none', label:'No domain', tasks: noDomainTasks })
  } else if (groupBy === 'owner') {
    const ok = [...memberNames, '']
    groups = ok.map(o => ({ key:o||'__un', label:o||'Unassigned', tasks: boardTasks.filter(t => o ? (t.owners||[]).includes(o) : (t.owners||[]).length === 0) }))
  } else { // project / bundle
    const byId = {}
    boardTasks.forEach(t => { const pid = t.project_id || '__none'; (byId[pid] = byId[pid] || []).push(t) })
    groups = Object.entries(byId).map(([id, ts]) => ({ key:id, label: id === '__none' ? 'No project / bundle' : (entityMap[id]?.name || 'Unknown'), tasks: ts }))
    groups.sort((a, b) => a.key === '__none' ? 1 : b.key === '__none' ? -1 : a.label.localeCompare(b.label))
  }
  // Domain columns stay visible even when empty, unless the user dismissed them while empty (auto-reappears once a task lands there)
  groups = groupBy === 'domain'
    ? groups.filter(g => !(hiddenDomains.has(g.key) && g.tasks.length === 0))
    : groups.filter(g => g.tasks.length > 0)
  const groupMap = Object.fromEntries(groups.map(g => [g.key, g]))
  const keys = groups.map(g => g.key)

  // Derive columns from stored order; append any not-yet-placed category to the shortest column.
  // Columns beyond the current numCols are simply not read here, so shrinking never loses items —
  // they fall through to the "not yet placed" pass below and get redistributed automatically.
  const buildColumns = () => {
    const stored = colsByGroup[groupBy] || Array.from({ length: numCols }, () => [])
    const placed = new Set()
    const cols = Array.from({ length: numCols }, (_, i) => (stored[i] || []).filter(k => { if (keys.includes(k) && !placed.has(k)) { placed.add(k); return true } return false }))
    keys.forEach(k => { if (!placed.has(k)) { const mi = cols.reduce((m, c, i, a) => c.length < a[m].length ? i : m, 0); cols[mi].push(k); placed.add(k) } })
    return cols
  }
  const columns = buildColumns()

  const persist = next => { setColsByGroup(next); try { localStorage.setItem('taskr-linear-cols', JSON.stringify(next)) } catch {} }
  const moveByIndex = (key, col, index) => {
    const cols = columns.map(c => c.filter(k => k !== key))
    const target = cols[col] || cols[0]
    const ti = cols[col] ? col : 0
    cols[ti].splice(Math.max(0, Math.min(index, target.length)), 0, key)
    persist({ ...colsByGroup, [groupBy]: cols })
  }
  const resetLayout = () => persist({ ...colsByGroup, [groupBy]: undefined })

  // ── Custom pointer-drag: lift a section and drop it above/after any other ──
  const startDrag = (e, g) => {
    if (isMobile || e.button !== 0) return
    e.preventDefault()
    const cardEl = e.currentTarget.closest('[data-lcard]')
    const r = cardEl ? cardEl.getBoundingClientRect() : { left:e.clientX, top:e.clientY, width:280 }
    dragRef.current = { key:g.key, active:false, startX:e.clientX, startY:e.clientY, offsetX:e.clientX - r.left, offsetY:e.clientY - r.top, w:r.width }

    const onMove = ev => {
      const d = dragRef.current; if (!d) return
      const x = ev.clientX, y = ev.clientY
      if (!d.active) { if (Math.hypot(x - d.startX, y - d.startY) < 5) return; d.active = true }
      const cont = containerRef.current
      if (cont) {
        const colEls = [...cont.querySelectorAll('[data-lcol]')]
        let ci = 0, best = Infinity
        colEls.forEach((el, i) => { const cr = el.getBoundingClientRect(); const cx = (cr.left + cr.right) / 2; const dd = Math.abs(x - cx); if (dd < best) { best = dd; ci = i } })
        const cards = colEls[ci] ? [...colEls[ci].querySelectorAll('[data-lcard]')] : []
        let index = cards.length
        for (let i = 0; i < cards.length; i++) { const cr = cards[i].getBoundingClientRect(); if (y < cr.top + cr.height / 2) { index = i; break } }
        dropRef.current = { col: ci, index }
        setDropTarget({ col: ci, index })
      }
      setDrag({ key:d.key, x, y, offsetX:d.offsetX, offsetY:d.offsetY, w:d.w })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const d = dragRef.current, dt = dropRef.current
      if (d && d.active && dt) moveByIndex(d.key, dt.col, dt.index)
      dragRef.current = null; dropRef.current = null
      setDrag(null); setDropTarget(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Click-and-drag on blank column space to pan horizontally when there are more columns than fit
  const bgDragRef = useRef(null)
  const isInteractiveTarget = el => !!(el && el.closest && el.closest('[data-lcard], button, input, textarea, select, a, [draggable="true"]'))
  const onContainerPointerDown = e => {
    if (drag || e.button !== 0 || isInteractiveTarget(e.target)) return
    const cont = containerRef.current
    if (!cont) return
    bgDragRef.current = { startX: e.clientX, scrollLeft: cont.scrollLeft }
    cont.style.cursor = 'grabbing'; cont.style.userSelect = 'none'
    const onMove = ev => {
      const d = bgDragRef.current; if (!d) return
      cont.scrollLeft = d.scrollLeft - (ev.clientX - d.startX)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      bgDragRef.current = null
      cont.style.cursor = numCols > 3 ? 'grab' : 'default'; cont.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const todayTasks = activeTasks.filter(t => t.today)

  // Context handed to the module-scope building blocks (Row/EscRow/SectionCard/CategoryCard)
  const v = { tss, entityMap, groupBy, openNotes, rowDrop, onEdit, dragTaskRef, setRowDrop, clearOutlines, reorderTo, onComplete, toggleNotes, tasks, showDone, ownerMatch, isMin, toggleMin, onOpenEscalation, orderList, isMobile, onOpenProject, handleSectionDrop, onAddTask, addPrefill, dragEntRef, entDrop, setEntDrop, domainMeta, onUpdateDomainMeta, hideDomain, colorEditKey, setColorEditKey }

  // Within a category, cluster tasks that belong to a project/bundle into a titled container
  const renderTasks = (list, sectionKey) => {
    if (groupBy === 'project') {
      const ordered = orderList(mainListId(sectionKey), list)
      return ordered.map(t => <Row key={t.id} t={t} listTasks={ordered} listId={mainListId(sectionKey)} v={v} />)
    }
    const standalone = orderList(mainListId(sectionKey), list.filter(t => !t.project_id))
    const byProj = {}
    list.filter(t => t.project_id).forEach(t => { (byProj[t.project_id] = byProj[t.project_id] || []).push(t) })
    const clusterListKey = `clustord:${groupBy}:${sectionKey}`
    const rawClusters = Object.entries(byProj).sort((a, b) => (entityMap[a[0]]?.name||'').localeCompare(entityMap[b[0]]?.name||''))
    const clusterPseudo = orderList(clusterListKey, rawClusters.map(([pid, ts]) => ({ id: pid, ts })))
    const clusterIdsHere = clusterPseudo.map(c => c.id)
    return (
      <>
        {standalone.map(t => <Row key={t.id} t={t} listTasks={standalone} listId={mainListId(sectionKey)} v={v} />)}
        {clusterPseudo.map(({ id: pid, ts: tsRaw }) => {
          const clusterListId = `${groupBy}:${sectionKey}:proj:${pid}`
          const ts = orderList(clusterListId, tsRaw)
          const ent = entityMap[pid]
          const cbg = flagBg(ent?.color) || '#f4f2ec'
          const cbd = flagBorder(ent?.color) || '#d8d4c8'
          const pnotes = Array.isArray(ent?.notes) ? ent.notes : []
          const id = clusterListId // section-specific collapse id
          const open = !isMin(id)
          const cDrop = entDrop
          const cInd = pos => <div style={{ height:3, borderRadius:2, background:'linear-gradient(90deg,#7c3aed,#a855f7)', margin: pos === 'before' ? '0 0 4px' : '4px 0 0' }} />
          return (
            <div key={pid}
              onDragOver={e => { const d = dragEntRef.current; if (d && d !== pid && clusterIdsHere.includes(d)) { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setEntDrop({ overId: pid, pos: e.clientY < r.top + r.height / 2 ? 'before' : 'after' }) } }}
              onDrop={e => { const d = dragEntRef.current; if (d && clusterIdsHere.includes(d)) { e.preventDefault(); e.stopPropagation(); reorderTo(clusterPseudo, d, pid, cDrop?.pos || 'before', clusterListKey) } dragEntRef.current = null; setEntDrop(null) }}>
              {cDrop && cDrop.overId === pid && cDrop.pos === 'before' && cInd('before')}
              <div style={{ border:`1px solid ${cbd}`, borderRadius:8, padding: open ? '7px 7px 3px' : '7px', marginBottom:4, background:cbg }}>
                <div draggable onDragStart={e => { e.stopPropagation(); dragEntRef.current = pid; e.dataTransfer.setData('text/tasks', ts.map(x => x.id).join(',')); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { dragEntRef.current = null; setEntDrop(null); clearOutlines() }}
                  onDoubleClick={() => onOpenProject && onOpenProject(pid)} title="Drag to reorder · double-click to open"
                  style={{ display:'flex', alignItems:'center', gap:6, padding: open ? '0 3px 6px' : '0 3px', cursor:'grab' }}>
                  <span style={{ flex:'1 1 auto', minWidth:0, fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'#555', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ent?.name || 'Project'}</span>
                  <span style={{ fontSize:9, color:'#888', background:'white', border:`0.5px solid ${cbd}`, borderRadius:8, padding:'0 6px', flexShrink:0 }}>{ts.length}</span>
                  {pnotes.length > 0 && <span style={{ fontSize:9, color:'#999', display:'inline-flex', alignItems:'center', gap:2 }}><StickyNote size={10} strokeWidth={2} /> {pnotes.length}</span>}
                  {linHeaderRight(onAddTask && linAddIconBtn(() => onAddTask({ project_id: pid, ...addPrefill(sectionKey) })), chevronBtn(open, () => toggleMin(id)))}
                </div>
                {open && ts.map(t => <Row key={t.id} t={t} hideLinked listTasks={ts} listId={clusterListId} v={v} />)}
                {open && pnotes.length > 0 && (
                  <div style={{ background:'#fafafa', border:'0.5px solid #ececec', borderRadius:8, padding:'8px 10px', margin:'0 0 4px' }}>
                    {pnotes.map(n => (
                      <div key={n.id} style={{ fontSize:11, color:'#555', lineHeight:1.5, marginBottom:4 }}>
                        <span style={{ color:'#bbb', marginRight:6, fontSize:10 }}>{fmtTs(n.ts)}</span>{n.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {cDrop && cDrop.overId === pid && cDrop.pos === 'after' && cInd('after')}
            </div>
          )
        })}
      </>
    )
  }


  // Columns to render, with the lifted section removed so the rest float up live
  const displayCols = columns.map(col => col.filter(k => !(drag && k === drag.key)))

  // Collapse / expand all
  const clusterIds = groupBy === 'project' ? [] : groups.flatMap(g => [...new Set(g.tasks.filter(t => t.project_id).map(t => t.project_id))].map(pid => `${groupBy}:${g.key}:proj:${pid}`))
  const allCollapsibleIds = [
    ...(todayTasks.length ? ['sec:today'] : []),
    ...(escalations.length ? ['sec:esc'] : []),
    ...groups.map(g => `cat:${groupBy}:${g.key}`),
    ...clusterIds,
  ]
  const anyOpen = allCollapsibleIds.some(id => !minimized.has(id))
  const toggleAll = () => {
    const n = anyOpen
      ? new Set([...minimized, ...allCollapsibleIds])
      : new Set([...minimized].filter(id => !allCollapsibleIds.includes(id)))
    setMinimized(n); persistMin(n)
  }

  // Collapse / expand just the projects, bundles & escalations
  const projEscIds = [
    ...escalations.map(e => `esc:${e.id}`),
    ...(groupBy === 'project'
      ? groups.filter(g => g.key !== '__none').map(g => `cat:project:${g.key}`)
      : clusterIds),
  ]
  const anyProjOpen = projEscIds.some(id => !minimized.has(id))
  const toggleProjEsc = () => {
    const n = anyProjOpen
      ? new Set([...minimized, ...projEscIds])
      : new Set([...minimized].filter(id => !projEscIds.includes(id)))
    setMinimized(n); persistMin(n)
  }

  // ── List view (sortable + per-column filters) ──
  const setSort = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }
  const renderListView = () => {
    const rows = activeTasks
      .filter(t => !colFilters.status || tss(t) === colFilters.status)
      .filter(t => !colFilters.domain || (t.domain || '') === colFilters.domain)
      .filter(t => !colFilters.owner || (t.owners || []).includes(colFilters.owner))
      .slice()
      .sort((a, b) => {
        const val = t => sortCol === 'status' ? (subStyle(tss(t)).label || '') : sortCol === 'domain' ? (t.domain || '') : sortCol === 'due' ? (t.due || '9999-99-99') : sortCol === 'owner' ? ((t.owners || [])[0] || '') : (t.title || '')
        const cmp = String(val(a)).localeCompare(String(val(b)), undefined, { numeric:true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    const GRID = isMobile ? '20px 1fr auto auto' : '22px 1fr 120px 120px 90px 110px'
    const domainOpts = [...new Set(tasks.map(t => t.domain).filter(Boolean))].sort()
    const H = ({ col, label }) => (
      <button onClick={() => setSort(col)} style={{ display:'flex', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:0, fontSize:10, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', fontFamily:'inherit' }}>
        {label}{sortCol === col && <span style={{ fontSize:8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    )
    const selStyle = { fontSize:10, padding:'2px 4px', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', color:'#555', maxWidth:'100%', outline:'none' }
    return (
      <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:GRID, gap:isMobile?6:8, padding:'8px 12px', background:'#f7f7f5', borderBottom:'0.5px solid #e5e5e5', alignItems:'center' }}>
          <span />
          <H col="title" label="Task" />
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}><H col="status" label="Status" />
            <select value={colFilters.status} onChange={e => setColFilters(f => ({ ...f, status:e.target.value }))} style={selStyle}>
              <option value="">All</option>{COLS.map(c => <option key={c.key} value={c.key}>{c.lbl}</option>)}
            </select></div>
          {!isMobile && <div style={{ display:'flex', flexDirection:'column', gap:3 }}><H col="domain" label="Domain" />
            <select value={colFilters.domain} onChange={e => setColFilters(f => ({ ...f, domain:e.target.value }))} style={selStyle}>
              <option value="">All</option>{domainOpts.map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>}
          <H col="due" label="Due" />
          {!isMobile && <div style={{ display:'flex', flexDirection:'column', gap:3 }}><H col="owner" label="Owner" />
            <select value={colFilters.owner} onChange={e => setColFilters(f => ({ ...f, owner:e.target.value }))} style={selStyle}>
              <option value="">All</option>{memberNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select></div>}
        </div>
        {rows.map((t, i) => {
          const ss = subStyle(tss(t)); const done = tss(t) === 'complete'; const owners = t.owners || []
          return (
            <div key={t.id} onClick={() => onEdit(t)}
              style={{ display:'grid', gridTemplateColumns:GRID, gap:isMobile?6:8, padding:'7px 12px', alignItems:'center', borderBottom: i === rows.length-1 ? 'none' : '0.5px solid #f0f0f0', cursor:'pointer', background:'white' }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
              <div onClick={e => { e.stopPropagation(); onComplete(t.id, !done) }} style={{ width:14, height:14, borderRadius:'50%', border:`1.5px solid ${ss.border||'#ccc'}`, background: done ? (ss.bg||'#eee') : 'white', cursor:'pointer', boxSizing:'border-box' }} />
              <span style={{ fontSize:13, color: done?'#aaa':'#111', textDecoration: done?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>
                {t.today && <span style={{ fontSize:9, color:'#E24B4A', marginRight:5, fontWeight:600 }}>TODAY</span>}{t.title}
              </span>
              <span style={{ fontSize:10, color:ss.tc, background:ss.bg, border:`0.5px solid ${ss.border}`, borderRadius:20, padding:'1px 7px', whiteSpace:'nowrap', width:'fit-content' }}>{ss.label||'—'}</span>
              {!isMobile && <span style={{ fontSize:10, color:t.domain?'#0C447C':'#ccc', background:t.domain?'#E6F1FB':'transparent', border:t.domain?'0.5px solid #85B7EB':'none', borderRadius:20, padding:t.domain?'2px 7px':'0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'fit-content' }}>{t.domain||'—'}</span>}
              <span style={{ fontSize:11, color:t.due?(t.due<today()?'#c0392b':'#888'):'#ccc', whiteSpace:'nowrap' }}>{t.due||'—'}</span>
              {!isMobile && <div style={{ display:'flex' }}>{owners.length ? <OwnerStack owners={owners} /> : <span style={{ fontSize:11, color:'#ccc' }}>—</span>}</div>}
            </div>
          )
        })}
        {rows.length === 0 && <div style={{ padding:'28px 12px', textAlign:'center', fontSize:13, color:'#bbb' }}>No tasks</div>}
      </div>
    )
  }

  return (
    <div style={{ userSelect: drag ? 'none' : undefined }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:1, background:'#ede9fe', borderRadius:10, padding:3 }}>
          {[{k:'domain',l:'Domain'},{k:'status',l:'Status'},{k:'owner',l:'Owner'},{k:'project',l:'Project'}].map(g => pill(groupBy, g.k, g.l, () => setGroupBy(g.k)))}
        </div>
        {/* Owner filter */}
        <div style={{ position:'relative' }}>
          <button onClick={() => setOwnerMenuOpen(o => !o)} title="Filter by owner"
            style={{ fontSize:11, background: filterOwner!=='all' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'white', border: filterOwner!=='all' ? 'none' : '0.5px solid #c4b5fd', borderRadius:10, padding:'4px 10px', cursor:'pointer', height:26, color: filterOwner!=='all' ? 'white' : '#7c3aed', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
            <span>{filterOwner === 'all' ? '👥 All' : filterOwner}</span><span style={{ fontSize:9, opacity:0.7 }}>▾</span>
          </button>
          {ownerMenuOpen && (
            <>
              <div onClick={() => setOwnerMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, minWidth:150, maxHeight:280, overflowY:'auto', padding:4 }}>
                {[{ v:'all', l:'👥 All' }, ...memberNames.map(n => ({ v:n, l:n }))].map(opt => (
                  <button key={opt.v} onClick={() => { setFilterOwner(opt.v); setOwnerMenuOpen(false) }}
                    style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', padding:'7px 10px', background: filterOwner===opt.v ? '#ede9fe' : 'none', border:'none', borderRadius:7, cursor:'pointer', fontSize:12, color: filterOwner===opt.v ? '#7c3aed' : '#444', fontWeight: filterOwner===opt.v ? 600 : 400, fontFamily:'inherit' }}>
                    {opt.v !== 'all' && <OwnerPip name={opt.v} />}{opt.l}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={() => setShowDone(v => !v)}
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:showDone?'none':'0.5px solid #c4b5fd', background:showDone?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', color:showDone?'white':'#7c3aed', height:26 }}>
          ✓ Done
        </button>
        <button onClick={() => setListView(v => !v)} title={listView ? 'Board view' : 'List view'}
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:listView?'none':'0.5px solid #c4b5fd', background:listView?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', color:listView?'white':'#7c3aed', height:26 }}>
          ☰ List
        </button>
        {!listView && <button onClick={toggleAll} title={anyOpen ? 'Collapse all' : 'Expand all'}
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'0.5px solid #c4b5fd', background:'white', color:'#7c3aed', height:26 }}>
          {anyOpen ? '⊟ Collapse all' : '⊞ Expand all'}
        </button>}
        {!listView && projEscIds.length > 0 && <button onClick={toggleProjEsc} title="Collapse/expand bundles"
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'0.5px solid #c4b5fd', background:'white', color:'#7c3aed', height:26 }}>
          {anyProjOpen ? '⊟' : '⊞'} Collapse bundles
        </button>}
        {!isMobile && !listView && <button onClick={resetLayout} title="Reset column layout"
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'0.5px solid #e0e0e0', background:'white', color:'#888', height:26 }}>
          ⟲ Reset layout
        </button>}
        {!isMobile && !listView && (
          <div style={{ display:'flex', alignItems:'center', gap:1, border:'0.5px solid #e0e0e0', borderRadius:10, height:26, overflow:'hidden' }}>
            <button onClick={() => setNumCols(numCols - 1)} disabled={numCols <= 1} title="Remove column"
              style={{ fontSize:12, padding:'0 8px', height:'100%', border:'none', background:'white', color: numCols <= 1 ? '#ddd' : '#888', cursor: numCols <= 1 ? 'default' : 'pointer' }}>−</button>
            <span style={{ fontSize:11, color:'#888', padding:'0 2px', minWidth:12, textAlign:'center' }}>{numCols}</span>
            <button onClick={() => setNumCols(numCols + 1)} disabled={numCols >= 8} title="Add column"
              style={{ fontSize:12, padding:'0 8px', height:'100%', border:'none', background:'white', color: numCols >= 8 ? '#ddd' : '#888', cursor: numCols >= 8 ? 'default' : 'pointer' }}>+</button>
          </div>
        )}
        {/* Trash toggle */}
        <button onClick={() => setShowTrash(s => !s)} title="Trash"
          style={{ position:'relative', fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:showTrash?'none':'0.5px solid #c4b5fd', background:showTrash?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', color:showTrash?'white':'#7c3aed', height:26 }}>
          🗑
          {trashTasks.length > 0 && <span style={{ position:'absolute', top:-5, right:-5, background:'#ef4444', color:'white', borderRadius:'50%', fontSize:9, minWidth:15, height:15, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, padding:'0 2px' }}>{trashTasks.length}</span>}
        </button>
        {/* Search */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', ...(isMobile ? { flex:'1 1 100%' } : {}) }}>
          <span style={{ position:'absolute', left:8, fontSize:12, color:'#a78bfa', pointerEvents:'none' }}>🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks…"
            style={{ fontSize:11, padding:'4px 8px 4px 26px', border:'0.5px solid #c4b5fd', borderRadius:10, background:'white', height:26, outline:'none', width:isMobile?'100%':160, color:'#333', boxSizing:'border-box' }} />
        </div>
        {onOpenClassic && <button onClick={onOpenClassic} title="Open the classic kanban/list task board"
          style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'0.5px solid #e0e0e0', background:'white', color:'#888', height:26, marginLeft:'auto' }}>
          Classic view
        </button>}
      </div>

      {showTrash && (
        <div style={{ background:'#f7f7f5', borderRadius:12, padding:12, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>🗑 Trash</span>
            <span style={{ fontSize:11, color:'#bbb' }}>Canceled tasks — restore to recover, or delete permanently.</span>
          </div>
          {trashTasks.length === 0 ? (
            <div style={{ fontSize:13, color:'#ccc', textAlign:'center', padding:'1.5rem 0' }}>Trash is empty</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:isMobile?'1fr':'repeat(auto-fill,minmax(240px,1fr))', gap:8 }}>
              {trashTasks.map(t => (
                <div key={t.id} style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'8px 10px', opacity:0.85 }}>
                  <div style={{ fontSize:13, color:'#888', textDecoration:'line-through', marginBottom:6 }}>{t.title}</div>
                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                    {onRestoreTask && <button onClick={() => onRestoreTask(t)} style={{ ...BTN_PRIMARY, fontSize:11, padding:'3px 10px' }}>Restore</button>}
                    {onDeleteTask && <ConfirmDeleteButton onConfirm={() => onDeleteTask(t.id)} style={{ fontSize:11, background:'none', color:'#A32D2D', border:'0.5px solid #F09595', borderRadius:6, padding:'3px 10px', cursor:'pointer' }}>Delete</ConfirmDeleteButton>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!showTrash && listView && renderListView()}

      {/* Today (2 cols) + Escalations (1 col) — one row, linear formatting */}
      {!listView && !showTrash && (
        <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:12, marginBottom:12, alignItems:'flex-start' }}>
          {todayTasks.length > 0 && (() => {
            const td = orderList('today', todayTasks)
            const inToday = id => td.some(x => x.id === id)
            return (
            <div style={{ flex: isMobile ? '1 1 auto' : 2, minWidth:0, width:isMobile?'100%':undefined }}>
              <SectionCard label="Today" count={todayTasks.length} accent="#E24B4A" bg="#fdf2f1" border="#f2d9d5" minId="sec:today" v={v} onAdd={onAddTask ? () => onAddTask({ today: true }) : undefined}>
                <div
                  onDragOver={e => { const d = dragTaskRef.current || e.dataTransfer.getData('text/task'); if (inToday(d)) e.preventDefault() }}
                  onDrop={e => {
                    const d = dragTaskRef.current || e.dataTransfer.getData('text/task')
                    if (!d || !inToday(d)) return
                    e.preventDefault()
                    let overId = null, pos = 'after'
                    for (const el of e.currentTarget.querySelectorAll('[data-tid]')) {
                      const r = el.getBoundingClientRect()
                      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        overId = el.getAttribute('data-tid'); pos = e.clientX < r.left + r.width / 2 ? 'before' : 'after'; break
                      }
                    }
                    reorderTo(td, d, overId, pos, 'today')
                    dragTaskRef.current = null; setRowDrop(null)
                  }}
                  style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', columnGap:8, minHeight:40 }}>
                  {td.map(t => <Row key={t.id} t={t} listTasks={td} listId="today" v={v} />)}
                </div>
              </SectionCard>
            </div>
            )
          })()}
          <div style={{ flex: isMobile ? '1 1 auto' : 1, minWidth:0, width:isMobile?'100%':undefined }}>
            <SectionCard label="Escalations" count={escalations.length} accent="#7c3aed" bg="#ede9fe" border="#c4b5fd" minId="sec:esc" v={v} onAdd={onAddEscalation ? () => setAddingEsc(true) : undefined}>
              {(() => { const el = orderList('escalations', escalations); return el.map(e => <EscRow key={e.id} e={e} v={v} escList={el} />) })()}
              {escalations.length === 0 && !addingEsc && <div style={{ fontSize:12, color:'#c9b8e8', textAlign:'center', padding:'8px 0' }}>No escalations</div>}
              {addingEsc && (
                <div style={{ marginTop: escalations.length ? 4 : 0 }}>
                  <input autoFocus value={newEscTitle} onChange={e => setNewEscTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddEsc(); if (e.key === 'Escape') { setAddingEsc(false); setNewEscTitle('') } }}
                    placeholder="Escalation title…"
                    style={{ width:'100%', boxSizing:'border-box', fontSize:13, padding:'7px 9px', border:'1.5px solid #7c3aed', borderRadius:8, outline:'none', fontFamily:'inherit' }} />
                  <div style={{ display:'flex', gap:4, marginTop:4 }}>
                    <button onClick={handleAddEsc} style={{ ...BTN_PRIMARY, flex:1, fontSize:11, padding:'5px 0' }}>Add</button>
                    <button onClick={() => { setAddingEsc(false); setNewEscTitle('') }} style={{ flex:1, fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:8, padding:'5px 0', cursor:'pointer', color:'#888', fontFamily:'inherit' }}>Cancel</button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {!listView && !showTrash && (
        <div style={{ borderTop:'0.5px solid #ececec', paddingTop:14, marginTop: (todayTasks.length > 0 || escalations.length > 0) ? 4 : 0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              {{ domain:'Domains', status:'Statuses', owner:'Owners', project:'Projects & Bundles' }[groupBy]}
            </span>
            {groupBy === 'domain' && onAddDomain && linAddIconBtn(() => setAddingDomain(true))}
          </div>
          {addingDomain && (
            <div style={{ maxWidth:260, marginBottom:12 }}>
              <input autoFocus value={newDomainTitle} onChange={e => setNewDomainTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddDomain(); if (e.key === 'Escape') { setAddingDomain(false); setNewDomainTitle('') } }}
                placeholder="Domain title…"
                style={{ width:'100%', boxSizing:'border-box', fontSize:13, padding:'7px 9px', border:'1.5px solid #7c3aed', borderRadius:8, outline:'none', fontFamily:'inherit' }} />
              <div style={{ display:'flex', gap:4, marginTop:4 }}>
                <button onClick={handleAddDomain} style={{ ...BTN_PRIMARY, flex:1, fontSize:11, padding:'5px 0' }}>Add</button>
                <button onClick={() => { setAddingDomain(false); setNewDomainTitle('') }} style={{ flex:1, fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:8, padding:'5px 0', cursor:'pointer', color:'#888', fontFamily:'inherit' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!listView && !showTrash && (groups.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb', fontSize:13 }}>No tasks</div>
      ) : isMobile ? (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {groups.map(g => <CategoryCard key={g.key} g={g} v={v} renderTasks={renderTasks} />)}
        </div>
      ) : (
        <div ref={containerRef} onPointerDown={onContainerPointerDown}
          style={{ display:'flex', gap:12, alignItems:'flex-start', overflowX: numCols > 3 ? 'auto' : 'visible', WebkitOverflowScrolling:'touch', cursor: numCols > 3 ? 'grab' : 'default', paddingBottom: numCols > 3 ? 6 : 0 }}>
          {displayCols.map((colKeys, ci) => {
            const items = []
            const showInd = i => drag && dropTarget && dropTarget.col === ci && dropTarget.index === i
            if (showInd(0)) items.push(<Indicator key="ind-0" />)
            colKeys.forEach((key, i) => {
              if (groupMap[key]) items.push(<CategoryCard key={key} g={groupMap[key]} onGrab={e => startDrag(e, groupMap[key])} v={v} renderTasks={renderTasks} />)
              if (showInd(i + 1)) items.push(<Indicator key={`ind-${i+1}`} />)
            })
            return (
              <div key={ci} data-lcol
                style={{ ...(numCols > 3 ? { flex:'0 0 280px', width:280 } : { flex:1, minWidth:0 }), display:'flex', flexDirection:'column', gap:12, minHeight:80, borderRadius:12, padding:2, outline: (drag && dropTarget && dropTarget.col === ci) ? '2px dashed #c4b5fd' : '2px solid transparent', transition:'outline-color 0.12s' }}>
                {items.length ? items : <div style={{ minHeight:40 }} />}
              </div>
            )
          })}
        </div>
      ))}

      {/* Lifted clone following the cursor */}
      {drag && groupMap[drag.key] && (
        <div style={{ position:'fixed', left: drag.x - drag.offsetX, top: drag.y - drag.offsetY, width: drag.w, pointerEvents:'none', zIndex:1000, transform:'rotate(-1.5deg) scale(1.02)', opacity:0.96, filter:'drop-shadow(0 18px 34px rgba(80,60,120,0.35))', maxHeight:300, overflow:'hidden', borderRadius:12 }}>
          <CategoryCard g={groupMap[drag.key]} v={v} renderTasks={renderTasks} />
        </div>
      )}
    </div>
  )
}

// ─── Notes Section (wrapper with sub-tabs) ────────────────────────────────────
function NotesSection({ notes, onSaveNote, onDeleteNote, noteGroups, onSaveGroup, onRenameGroup, onDeleteGroup, members = [] }) {
  return <NotesTab notes={notes} onSave={onSaveNote} onDelete={onDeleteNote} groups={noteGroups} onSaveGroup={onSaveGroup} onRenameGroup={onRenameGroup} onDeleteGroup={onDeleteGroup} members={members} />
}

// ─── Notes Tab ───────────────────────────────────────────────────────────────
function NotesTab({ notes, onSave, onDelete, groups = [], onSaveGroup, onRenameGroup, onDeleteGroup, members = [] }) {
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [copied, setCopied] = useState(false)
  const [focused, setFocused] = useState(false)
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [search, setSearch] = useState('')
  const [mobileView, setMobileView] = useState('list') // 'list' | 'editor'
  const [swipeState, setSwipeState] = useState({}) // { [id]: { x, swiped } }
  const [editorHeight, setEditorHeight] = useState(null)
  const [activeGroupId, setActiveGroupId] = useState(undefined) // undefined=all, null=ungrouped, uuid=group
  const [renamingGroupId, setRenamingGroupId] = useState(null)
  const [renameText, setRenameText] = useState('')
  const [deletingGroupId, setDeletingGroupId] = useState(null)
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const isMobileNotes = window.innerWidth < 640
  const autoSaveTimerRef = useRef(null)
  const draftRef = useRef(draft)
  const selectedIdRef = useRef(selectedId)
  draftRef.current = draft
  selectedIdRef.current = selectedId

  // Reset activeGroupId if the selected group was deleted
  useEffect(() => {
    if (activeGroupId !== undefined && activeGroupId !== null) {
      if (!groups.find(g => g.id === activeGroupId)) setActiveGroupId(undefined)
    }
  }, [groups, activeGroupId])

  // Keyboard-aware height via visualViewport
  useEffect(() => {
    if (!isMobileNotes) return
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setEditorHeight(vv.height)
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [isMobileNotes])

  // Full-screen (browser Fullscreen API) editing — pairs with focus overlay
  const fsTriggeredFocus = useRef(false)
  const toggleFullscreen = () => {
    const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
    if (inFs) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)
    } else {
      if (!focused) { setFocused(true); fsTriggeredFocus.current = true }
      const el = document.documentElement
      ;(el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)
    }
  }
  useEffect(() => {
    const onChange = () => {
      const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement)
      if (!inFs && fsTriggeredFocus.current) { setFocused(false); fsTriggeredFocus.current = false }
    }
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange) }
  }, [])

  useEffect(() => {
    if (notes.length > 0 && !selectedId) {
      setSelectedId(notes[0].id)
      setDraft({ title: notes[0].title, body: notes[0].body || '' })
    }
  }, [notes])

  // Auto-save 1.5s after the user stops typing
  useEffect(() => {
    if (!dirty) return
    clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      if (draftRef.current && selectedIdRef.current) {
        onSave(draftRef.current, selectedIdRef.current).then(result => { if (result !== null) setDirty(false) })
      }
    }, 1500)
    return () => clearTimeout(autoSaveTimerRef.current)
  }, [dirty, draft])

  const handleSelect = n => {
    if (dirty) onSave(draft, selectedId)
    setSelectedId(n.id); setDraft({ title: n.title, body: n.body || '' }); setDirty(false)
    if (isMobileNotes) setMobileView('editor')
  }

  const handleSave = async () => {
    if (!draft || !selectedId) return
    await onSave(draft, selectedId); setDirty(false)
  }

  const handleNew = async (groupId) => {
    const title = `Note — ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
    const gId = groupId !== undefined ? groupId : (activeGroupId === undefined ? null : activeGroupId)
    const newId = await onSave({ title, body: '', group_id: gId }, null)
    if (newId) { setSelectedId(newId); setDraft({ title, body: '' }); setDirty(false) }
    if (isMobileNotes) setMobileView('editor')
  }

  const handleBack = () => {
    if (dirty) handleSave()
    setMobileView('list')
  }

  const handleCopy = () => {
    if (!draft) return
    const div = document.createElement('div'); div.innerHTML = draft.body || ''
    const plain = div.textContent || ''
    navigator.clipboard.writeText(`${draft.title}\n\n${plain}`)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  // Swipe-to-delete handlers
  const onTouchStart = (id, e) => {
    setSwipeState(s => ({ ...s, [id]: { startX: e.touches[0].clientX, x: 0, swiped: false } }))
  }
  const onTouchMove = (id, e) => {
    const st = swipeState[id]
    if (!st) return
    const dx = e.touches[0].clientX - st.startX
    if (dx < -10) {
      setSwipeState(s => ({ ...s, [id]: { ...s[id], x: Math.max(dx, -80), swiped: dx < -60 } }))
    }
  }
  const onTouchEnd = (id) => {
    const st = swipeState[id]
    if (st?.swiped) return // leave revealed for tap-delete
    setSwipeState(s => ({ ...s, [id]: { x: 0, swiped: false } }))
  }
  const confirmDelete = async (id) => {
    clearTimeout(autoSaveTimerRef.current)
    await onDelete(id)
    if (selectedId === id) { setSelectedId(null); setDraft(null); setDirty(false) }
    setSwipeState(s => { const n = {...s}; delete n[id]; return n })
    if (isMobileNotes) setMobileView('list')
  }

  const stripHtml = html => { const d = document.createElement('div'); d.innerHTML = html||''; return d.textContent||'' }
  const visibleNotes = notes
    .filter(n => {
      if (activeGroupId !== undefined) {
        if (activeGroupId === null && n.group_id != null) return false
        if (activeGroupId !== null && n.group_id !== activeGroupId) return false
      }
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (n.title||'').toLowerCase().includes(q) || stripHtml(n.body).toLowerCase().includes(q)
    })
    .sort((a, b) => {
      const cmp = sortKey === 'alpha'
        ? (a.title||'').localeCompare(b.title||'')
        : new Date(a.created_at) - new Date(b.created_at)
      return sortDir === 'desc' ? -cmp : cmp
    })

  const activeGroupLabel = activeGroupId === undefined ? 'All Notes' : activeGroupId === null ? 'Ungrouped' : (groups.find(g => g.id === activeGroupId)?.name || 'Notes')

  const sidebar = (
    <div style={{ width: isMobileNotes ? '100%' : 220, flexShrink:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'8px 12px', borderBottom:'0.5px solid #f0f0f0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
          <span style={{ fontSize:12, fontWeight:500, color:'#555' }}>{activeGroupLabel}</span>
          <button onClick={() => handleNew()} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'6px 12px', cursor:'pointer' }}>+ New</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…"
          style={{ width:'100%', boxSizing:'border-box', fontSize:13, padding:'7px 10px', border:'0.5px solid #e0e0e0', borderRadius:6, outline:'none', marginBottom:6, color:'#333' }} />
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          {[{k:'date',l:'Date'},{k:'alpha',l:'A–Z'}].map(o => (
            <button key={o.k} onClick={() => { if (sortKey===o.k) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortKey(o.k); setSortDir('desc') } }}
              style={{ fontSize:11, padding:'5px 10px', border:'0.5px solid #e0e0e0', borderRadius:6, background:sortKey===o.k?'#111':'white', color:sortKey===o.k?'white':'#666', cursor:'pointer' }}>
              {o.l}{sortKey===o.k ? (sortDir==='asc'?' ↑':' ↓') : ''}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' }}>
        {/* Group navigation */}
        {onSaveGroup && (
          <div style={{ borderBottom:'0.5px solid #f0f0f0', paddingBottom:4, marginBottom:2 }}>
            {/* All Notes row */}
            <div onClick={() => setActiveGroupId(undefined)}
              style={{ padding:'6px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background: activeGroupId === undefined ? '#ede9fe' : 'transparent' }}>
              <span style={{ fontSize:12, color: activeGroupId === undefined ? '#7c3aed' : '#555', fontWeight: activeGroupId === undefined ? 600 : 400 }}>All Notes</span>
              <span style={{ fontSize:11, color:'#bbb' }}>{notes.length}</span>
            </div>
            {/* Ungrouped row */}
            <div onClick={() => setActiveGroupId(null)}
              style={{ padding:'6px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background: activeGroupId === null ? '#ede9fe' : 'transparent' }}>
              <span style={{ fontSize:12, color: activeGroupId === null ? '#7c3aed' : '#555', fontWeight: activeGroupId === null ? 600 : 400 }}>Ungrouped</span>
              <span style={{ fontSize:11, color:'#bbb' }}>{notes.filter(n => !n.group_id).length}</span>
            </div>
            {/* Each group */}
            {groups.map(g => (
              <div key={g.id}>
                {renamingGroupId === g.id ? (
                  <div style={{ padding:'4px 8px' }}>
                    <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { onRenameGroup(g.id, renameText.trim() || g.name); setRenamingGroupId(null) }
                        if (e.key === 'Escape') setRenamingGroupId(null)
                      }}
                      onBlur={() => { onRenameGroup(g.id, renameText.trim() || g.name); setRenamingGroupId(null) }}
                      style={{ width:'100%', boxSizing:'border-box', fontSize:12, padding:'4px 8px', border:'0.5px solid #c4b5fd', borderRadius:6, outline:'none' }}
                    />
                  </div>
                ) : (
                  <div onClick={() => setActiveGroupId(g.id)}
                    style={{ padding:'6px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background: activeGroupId === g.id ? '#ede9fe' : 'transparent' }}
                    onMouseEnter={e => { if (activeGroupId !== g.id) e.currentTarget.style.background = '#fafafa' }}
                    onMouseLeave={e => { if (activeGroupId !== g.id) e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ fontSize:12, color: activeGroupId === g.id ? '#7c3aed' : '#555', fontWeight: activeGroupId === g.id ? 600 : 400, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {g.name}
                    </span>
                    <div style={{ display:'flex', gap:1, alignItems:'center', flexShrink:0 }}>
                      <span style={{ fontSize:11, color:'#bbb', marginRight:3 }}>{notes.filter(n => n.group_id === g.id).length}</span>
                      <button onClick={e => { e.stopPropagation(); setRenamingGroupId(g.id); setRenameText(g.name) }}
                        style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 4px', lineHeight:1 }} title="Rename">✎</button>
                      <button onClick={e => { e.stopPropagation(); setDeletingGroupId(g.id) }}
                        style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 4px', lineHeight:1 }} title="Delete group">✕</button>
                    </div>
                  </div>
                )}
                {/* Inline delete confirmation */}
                {deletingGroupId === g.id && (() => {
                  const cnt = notes.filter(n => n.group_id === g.id).length
                  return (
                    <div style={{ margin:'0 8px 4px', padding:'8px 10px', background:'#fff5f5', border:'0.5px solid #fecaca', borderRadius:8, fontSize:11 }}>
                      <div style={{ color:'#991b1b', fontWeight:500, marginBottom:6 }}>
                        Delete "{g.name}"{cnt > 0 ? ` (${cnt} note${cnt > 1 ? 's' : ''})` : ''}?
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={() => { onDeleteGroup(g.id, true); setDeletingGroupId(null); if (activeGroupId === g.id) setActiveGroupId(undefined) }}
                          style={{ fontSize:11, padding:'4px 8px', background:'#991b1b', color:'white', border:'none', borderRadius:6, cursor:'pointer' }}>Delete notes</button>
                        <button onClick={() => { onDeleteGroup(g.id, false); setDeletingGroupId(null); if (activeGroupId === g.id) setActiveGroupId(undefined) }}
                          style={{ fontSize:11, padding:'4px 8px', background:'#7c3aed', color:'white', border:'none', borderRadius:6, cursor:'pointer' }}>Keep notes</button>
                        <button onClick={() => setDeletingGroupId(null)}
                          style={{ fontSize:11, padding:'4px 8px', background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, cursor:'pointer', color:'#888' }}>Cancel</button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            ))}
            {/* Add new group */}
            {addingGroup ? (
              <div style={{ padding:'4px 8px' }}>
                <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { if (newGroupName.trim()) onSaveGroup(newGroupName.trim()); setAddingGroup(false); setNewGroupName('') }
                    if (e.key === 'Escape') { setAddingGroup(false); setNewGroupName('') }
                  }}
                  onBlur={() => { if (newGroupName.trim()) onSaveGroup(newGroupName.trim()); setAddingGroup(false); setNewGroupName('') }}
                  placeholder="Group name…"
                  style={{ width:'100%', boxSizing:'border-box', fontSize:12, padding:'4px 8px', border:'0.5px solid #c4b5fd', borderRadius:6, outline:'none' }}
                />
              </div>
            ) : (
              <button onClick={() => setAddingGroup(true)}
                style={{ width:'100%', textAlign:'left', padding:'5px 12px', background:'none', border:'none', cursor:'pointer', fontSize:11, color:'#a78bfa' }}>
                + New Group
              </button>
            )}
          </div>
        )}
        {/* Note list */}
        {visibleNotes.length === 0 && <div style={{ padding:'24px 12px', fontSize:12, color:'#bbb', textAlign:'center' }}>{search ? 'No matches.' : 'No notes yet.'}<br/>{!search && 'Tap + New to start.'}</div>}
        {visibleNotes.map(n => {
          const sw = swipeState[n.id] || {}
          return (
            <div key={n.id} style={{ position:'relative', overflow:'hidden', borderBottom:'0.5px solid #f5f5f5' }}>
              {/* Swipe-to-delete red background */}
              <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:'#E24B4A', display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={() => confirmDelete(n.id)}>
                <span style={{ color:'white', fontSize:12, fontWeight:500 }}>Delete</span>
              </div>
              <div
                onTouchStart={e => onTouchStart(n.id, e)}
                onTouchMove={e => onTouchMove(n.id, e)}
                onTouchEnd={() => onTouchEnd(n.id)}
                onClick={() => { if (sw.swiped) { setSwipeState(s => ({...s, [n.id]: {x:0,swiped:false}})); return } handleSelect(n) }}
                style={{ position:'relative', padding:'14px 12px', cursor:'pointer', background:selectedId===n.id?'#f5f5f3':'white', transform:`translateX(${sw.x||0}px)`, transition: sw.startX ? 'none' : 'transform 0.2s ease', minHeight:60, boxSizing:'border-box' }}
                onMouseEnter={e => { if (selectedId!==n.id && !isMobileNotes) e.currentTarget.style.background='#fafafa' }}
                onMouseLeave={e => { if (selectedId!==n.id && !isMobileNotes) e.currentTarget.style.background='white' }}>
                <div style={{ fontSize:13, fontWeight:selectedId===n.id?500:400, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title||'Untitled'}</div>
                <div style={{ fontSize:11, color:'#bbb', marginTop:3 }}>{new Date(n.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const editorPane = (
    <div style={{ flex:1, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, display:'flex', flexDirection:'column', overflow:'hidden', ...(isMobileNotes && editorHeight ? { height: editorHeight } : {}) }}>
      {!draft ? (
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>
          <div style={{ fontSize:36 }}>📝</div>
          <div style={{ fontSize:13, color:'#bbb' }}>Select a note or create a new one</div>
          <button onClick={handleNew} style={{ fontSize:13, background:'#111', color:'white', border:'none', borderRadius:8, padding:'10px 20px', cursor:'pointer' }}>+ New Note</button>
        </div>
      ) : (
        <>
          <div style={{ padding:'10px 14px', borderBottom:'0.5px solid #f0f0f0', display:'flex', flexDirection:'column', gap:4, position:'sticky', top:0, background:'white', zIndex:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {isMobileNotes && (
                <button onClick={handleBack} style={{ fontSize:18, background:'none', border:'none', cursor:'pointer', color:'#555', padding:'0 4px', lineHeight:1, flexShrink:0 }}>‹</button>
              )}
              <input value={draft.title} onChange={e => { setDraft(p => ({...p, title:e.target.value})); setDirty(true) }}
                style={{ flex:1, fontSize:16, fontWeight:600, border:'none', outline:'none', color:'#111', background:'transparent' }}
                placeholder="Note title..." />
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {!isMobileNotes && (
                  <button onClick={() => setFocused(f => !f)}
                    title={focused ? 'Exit focus mode' : 'Focus mode'}
                    style={{ fontSize:13, background:'#f5f5f3', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'6px 8px', cursor:'pointer', color:'#555', lineHeight:1 }}>
                    {focused ? '⤡' : '⤢'}
                  </button>
                )}
                {!isMobileNotes && (
                  <button onClick={toggleFullscreen}
                    title="Full screen"
                    style={{ fontSize:13, background:'#f5f5f3', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'6px 8px', cursor:'pointer', color:'#555', lineHeight:1 }}>
                    ⛶
                  </button>
                )}
                {groups.length > 0 && (
                  <select title="Move to group"
                    value={(draft.group_id !== undefined ? draft.group_id : notes.find(n => n.id === selectedId)?.group_id) || ''}
                    onChange={e => { const gid = e.target.value || null; setDraft(p => ({ ...p, group_id: gid })); onSave({ ...draft, group_id: gid }, selectedId); setDirty(false) }}
                    style={{ fontSize:11, background:'#f5f5f3', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'6px 8px', cursor:'pointer', color:'#555', outline:'none', maxWidth:130 }}>
                    <option value="">Ungrouped</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                <button onClick={handleCopy} style={{ fontSize:11, background:'#f5f5f3', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'6px 10px', cursor:'pointer', color: copied?'#3a7d44':'#555' }}>
                  {copied ? '✓' : '📋'}
                </button>
                {dirty && <button onClick={handleSave} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Save</button>}
                {selectedId && <ConfirmDeleteButton onConfirm={() => confirmDelete(selectedId)} style={{ fontSize:11, background:'none', color:'#A32D2D', border:'0.5px solid #F09595', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>Delete</ConfirmDeleteButton>}
              </div>
            </div>
            {(() => {
              const noteRecord = notes.find(n => n.id === selectedId)
              const fmtDT = iso => iso ? new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}) : '—'
              return noteRecord ? (
                <div style={{ display:'flex', gap:14, fontSize:10, color:'#bbb' }}>
                  <span>Created {fmtDT(noteRecord.created_at)}</span>
                  {noteRecord.updated_at && noteRecord.updated_at !== noteRecord.created_at && <span>· Edited {fmtDT(noteRecord.updated_at)}</span>}
                </div>
              ) : null
            })()}
          </div>
          <RichTextEditor key={selectedId} initialValue={draft.body} isMobile={isMobileNotes}
            onChange={html => { setDraft(p => ({...p, body:html})); setDirty(true) }}
            members={members} />
        </>
      )}
    </div>
  )

  // Mobile: single-panel navigation
  if (isMobileNotes) {
    return mobileView === 'list' ? sidebar : (
      <div style={{ display:'flex', flexDirection:'column', height: editorHeight || '100dvh' }}>
        {editorPane}
      </div>
    )
  }

  const layout = (
    <div style={{ display:'flex', gap:16, height: focused ? 'calc(100vh - 72px)' : 'calc(100vh - 220px)', minHeight:400 }}>
      {sidebar}
      {editorPane}
    </div>
  )

  if (focused) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:200, background:'white', padding:'16px 24px', display:'flex', flexDirection:'column', boxSizing:'border-box' }}>
        {layout}
      </div>
    )
  }

  return layout
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
          {editing ? <textarea value={val} onChange={e => setVal(e.target.value)} autoFocus style={{ width:'100%', fontSize:12, height:56, resize:'none', fontFamily:'inherit', padding:'5px 7px', border:'0.5px solid #e0e0e0', borderRadius:6 }} />
            : <div style={{ fontSize:12, color:'#444', lineHeight:1.5 }}>{note.text}</div>}
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          {editing ? <>
            <button onClick={() => { onSave(note.id, val.trim()); setEditing(false) }} disabled={!val.trim()} style={{ fontSize:11, background: val.trim() ? '#111' : '#ccc', color:'white', border:'none', borderRadius:6, padding:'2px 8px', cursor: val.trim() ? 'pointer' : 'not-allowed' }}>Save</button>
            <button onClick={() => { setVal(note.text); setEditing(false) }} style={{ fontSize:11, background:'none', border:'0.5px solid #ccc', borderRadius:6, padding:'2px 8px', cursor:'pointer', color:'#666' }}>Cancel</button>
          </> : <button onClick={() => setEditing(true)} style={{ fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'2px 7px', cursor:'pointer', color:'#888' }}>Edit</button>}
          <button onClick={() => onDelete(note.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:12 }} onMouseEnter={e => e.currentTarget.style.color='#E24B4A'} onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ─── Task Form ────────────────────────────────────────────────────────────────
const DUE_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DUE_MONTHS_LONG = MONTH_NAMES
function formatDue(d) { const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0'), yy=String(d.getFullYear()).slice(-2); return `${mm}/${dd}/${yy}` }

function DatePicker({ value, onChange, initialMonth, minDate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const parseView = () => {
    const d = value ? new Date(value) : initialMonth ? new Date(initialMonth) : new Date()
    return isNaN(d) ? new Date() : d
  }
  const [view, setView] = useState(() => { const d = parseView(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  const yr = view.getFullYear(), mo = view.getMonth()
  const firstDow = new Date(yr, mo, 1).getDay()
  const days = new Date(yr, mo + 1, 0).getDate()
  const todayStr = formatDue(new Date())
  const selectDay = d => {
    const str = formatDue(new Date(yr, mo, d))
    if (minDate) {
      const isoStr = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      if (isoStr < minDate) return
    }
    onChange(str); setOpen(false)
  }
  return (
    <div ref={ref} style={{ position:'relative', width:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', border:'0.5px solid #e0e0e0', borderRadius:8, overflow:'hidden' }}>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Pick a date..."
          style={{ flex:1, fontSize:13, padding:'5px 8px', border:'none', outline:'none', background:'transparent', fontFamily:'inherit' }} />
        <button onClick={() => { setView(parseView()); setOpen(o => !o) }}
          style={{ background:'none', border:'none', borderLeft:'0.5px solid #f0f0f0', padding:'5px 8px', cursor:'pointer', color:'#bbb', fontSize:13, lineHeight:1 }}
          onMouseEnter={e => e.currentTarget.style.color='#555'} onMouseLeave={e => e.currentTarget.style.color='#bbb'}>
          📅
        </button>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:200, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:12, boxShadow:'0 6px 24px rgba(0,0,0,0.12)', width:240 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <button onClick={() => setView(new Date(yr, mo-1, 1))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#888', padding:'0 6px', lineHeight:1 }}>‹</button>
            <span style={{ fontSize:12, fontWeight:500, color:'#333' }}>{DUE_MONTHS_LONG[mo]} {yr}</span>
            <button onClick={() => setView(new Date(yr, mo+1, 1))} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#888', padding:'0 6px', lineHeight:1 }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} style={{ fontSize:10, color:'#bbb', textAlign:'center' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {Array.from({length:firstDow}).map((_,i) => <div key={'x'+i} />)}
            {Array.from({length:days}).map((_,i) => {
              const d = i+1, str = formatDue(new Date(yr,mo,d))
              const sel = str === value, isToday = str === todayStr
              const disabled = !!minDate && (`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` < minDate)
              return <button key={d} onClick={() => selectDay(d)}
                style={{ fontSize:12, border:'none', borderRadius:6, padding:'5px 2px', cursor:disabled?'default':'pointer', textAlign:'center', background:sel?'#111':isToday?'#f0f0f0':'transparent', color:sel?'white':disabled?'#ddd':isToday?'#111':'#444', fontFamily:'inherit' }}>
                {d}
              </button>
            })}
          </div>
          {value && <button onClick={() => { onChange(''); setOpen(false) }} style={{ marginTop:8, width:'100%', fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'4px 0', cursor:'pointer', color:'#aaa', fontFamily:'inherit' }}>Clear</button>}
        </div>
      )}
    </div>
  )
}

function DatePickerISO({ value, onChange, initialMonth, minDate }) {
  const toDisplay = iso => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return iso
    return `${m}/${d}/${y.slice(-2)}`
  }
  const toISO = v => {
    if (!v) return ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
    const p = v.split('/')
    if (p.length === 3) {
      const [mm, dd, yy] = p
      const currentCentury = Math.floor(new Date().getFullYear() / 100) * 100
      const year = yy.length === 2 ? String(currentCentury + parseInt(yy)) : yy
      return `${year}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`
    }
    return ''
  }
  return <DatePicker value={toDisplay(value)} onChange={v => onChange(toISO(v))} initialMonth={initialMonth} minDate={minDate} />
}

function AttachmentSection({ attachments, entityPath, onAdd, onRemove }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)
  const handleFile = async e => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const path = `${entityPath}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error } = await supabase.storage.from('taskr-attachments').upload(path, file)
    if (error) { console.error('[TASKr] upload error', error); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('taskr-attachments').getPublicUrl(path)
    onAdd({ id: 'att' + Date.now(), name: file.name, size: file.size, type: file.type, path, url: publicUrl, ts: Date.now() })
    setUploading(false)
    e.target.value = ''
  }
  const handleRemove = async att => {
    await supabase.storage.from('taskr-attachments').remove([att.path])
    onRemove(att.id)
  }
  return (
    <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginTop:4 }}>
      <label style={FIELD_LABEL}>Attachments</label>
      {attachments.map(att => (
        <div key={att.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 8px', background:'#fafafa', borderRadius:6, border:'0.5px solid #f0f0f0' }}>
          <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{att.name}</span>
          {att.size && <span style={{ fontSize:10, color:'#bbb', flexShrink:0 }}>{(att.size/1024).toFixed(0)}KB</span>}
          <a href={att.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize:10, color:'#378ADD', flexShrink:0, textDecoration:'none' }}>Open</a>
          <button onClick={() => handleRemove(att)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:12, padding:0, flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.color='#E24B4A'} onMouseLeave={e=>e.currentTarget.style.color='#ddd'}>✕</button>
        </div>
      ))}
      <input ref={fileRef} type="file" onChange={handleFile} style={{ display:'none' }} />
      <button onClick={() => fileRef.current.click()} disabled={uploading} style={{ fontSize:12, background:'none', border:'0.5px dashed #ccc', borderRadius:6, padding:'6px 14px', cursor:uploading?'default':'pointer', color:'#888', width:'100%', fontFamily:'inherit' }}>
        {uploading ? 'Uploading...' : '+ Add attachment'}
      </button>
    </div>
  )
}

// ─── Subtask Row ──────────────────────────────────────────────────────────────
function SubtaskRow({ st, onChange, onDelete }) {
  const faded = st.done || st.na
  const upd = (field, val) => onChange({ ...st, [field]: val })
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, padding:'5px 8px', background:'#fafafa', borderRadius:6, border:`0.5px solid ${st.na?'#ddd':'#f0f0f0'}` }}>
      <input type="checkbox" checked={!!st.done} disabled={!!st.na}
        onChange={e => upd('done', e.target.checked)}
        style={{ width:13, height:13, cursor:st.na?'default':'pointer', flexShrink:0 }} />
      <input value={st.title} onChange={e => upd('title', e.target.value)}
        style={{ flex:1, fontSize:12, border:'none', outline:'none', background:'transparent', fontFamily:'inherit',
          color:faded?'#aaa':'#444', textDecoration:faded?'line-through':'none', opacity:st.na?0.6:1 }} />
      <button onClick={() => upd('na', !st.na)}
        style={{ background:'none', border:'none', cursor:'pointer', color:st.na?'#888':'#ccc', fontSize:10, padding:'0 1px', fontWeight:500, lineHeight:1, flexShrink:0 }}>N/A</button>
      <button onClick={onDelete}
        style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:12, lineHeight:1, flexShrink:0 }}
        onMouseEnter={e=>e.currentTarget.style.color='#E24B4A'} onMouseLeave={e=>e.currentTarget.style.color='#ddd'}>✕</button>
    </div>
  )
}

function TaskForm({ task, isEdit, onSave, onDelete, onClose, domains, zIndex = 50, members = MEMBERS, defaultOwner }) {
  const defaultOwners = defaultOwner ? [defaultOwner] : ['Levi']
  const EMPTY = { title:'', status:'active', domain:'', owners:defaultOwners, due:'', priority:'', color:'', notes:[], today:false, substatus:'not_started', subtasks:[], project_id:null, escalation_id:null, attachments:[] }
  const tempId = useRef(crypto.randomUUID())
  const [f, setF] = useState({ ...EMPTY, ...task, owners:Array.isArray(task?.owners)?task.owners:defaultOwners, notes:Array.isArray(task?.notes)?task.notes:[], subtasks:Array.isArray(task?.subtasks)?task.subtasks:[], attachments:Array.isArray(task?.attachments)?task.attachments:[] })
  const [newNote, setNewNote] = useState('')
  const [newSub, setNewSub] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]:v }))
  const toggleOwner = m => { const cur = f.owners||[]; if (cur.includes(m)) { set('owners', cur.filter(o => o!==m)) } else set('owners', [...cur, m]) }
  const addNote = () => { const text = newNote.trim(); if (!text) return; set('notes', [...f.notes, { id:'n'+Date.now(), text, ts:Date.now() }]); setNewNote('') }
  const removeNote = id => set('notes', f.notes.filter(n => n.id!==id))
  const editNote = (id, text) => { if (!text) removeNote(id); else set('notes', f.notes.map(n => n.id===id?{...n,text}:n)) }
  const addSub = () => { const text = newSub.trim(); if (!text) return; set('subtasks', [...f.subtasks, { id:'st'+Date.now(), title:text, done:false }]); setNewSub('') }

  const coreFields = (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        <div><label style={FIELD_LABEL}>Status</label>
          <select value={f.substatus||'not_started'} onChange={e => set('substatus', e.target.value)} style={FIELD_SELECT}>
            {SUBSTATUS.filter(s => s.key && s.key !== 'canceled').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select></div>
        <div><label style={FIELD_LABEL}>Priority</label>
          <select value={f.priority} onChange={e => set('priority', e.target.value)} style={FIELD_SELECT}>
            <option value="">Normal</option><option value="high">High</option>
          </select></div>
        <div><label style={FIELD_LABEL}>Due date</label>
          <DatePicker value={f.due} onChange={v => set('due', v)} /></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, alignItems:'end' }}>
        <div><label style={FIELD_LABEL}>Domain</label>
          <select value={f.domain} onChange={e => set('domain', e.target.value)} style={FIELD_SELECT}>
            <option value="">— none —</option>
            {(domains||[]).map(d => <option key={d} value={d}>{d}</option>)}
          </select></div>
        <div><label style={FIELD_LABEL}>Flag color</label>
          <div style={{ display:'flex', gap:6, alignItems:'center', height:32 }}>
            {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width:fc.key?20:14, height:fc.key?20:14, borderRadius:'50%', background:fc.hex, border:f.color===fc.key?'2.5px solid #111':'2px solid transparent', cursor:'pointer', padding:0 }} />)}
          </div></div>
      </div>
    </>
  )

  const detailsSection = (
    <>
      <div style={{ marginBottom:12 }}>
        <label style={FIELD_LABEL}>Assigned to</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {members.map(m => { const sel = (f.owners||[]).includes(m); const c = MEMBER_COLORS[m]||{}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:sel?`1.5px solid ${c.tc}`:'0.5px solid #e5e5e5', background:sel?c.bg:'white', color:sel?c.tc:'#888', fontWeight:sel?500:400 }}>{m}</button> })}
        </div>
      </div>
      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#444', marginBottom:14, cursor:'pointer' }}>
        <input type="checkbox" checked={!!f.today} onChange={e => set('today', e.target.checked)} style={{ width:14, height:14 }} />Include in Today
      </label>
      <AttachmentSection
        attachments={f.attachments}
        entityPath={isEdit && task?.id ? `tasks/${task.id}` : `tasks/tmp-${tempId.current}`}
        onAdd={att => setF(p => ({ ...p, attachments: [...p.attachments, att] }))}
        onRemove={id => setF(p => ({ ...p, attachments: p.attachments.filter(a => a.id !== id) }))}
      />
    </>
  )

  const expandBtn = (
    <button onClick={() => setShowDetails(v => !v)}
      style={{ fontSize:12, color:'#7c3aed', background:'#ede9fe', border:'0.5px solid #c4b5fd', borderRadius:8, padding:'6px 12px', cursor:'pointer', marginBottom:14, display:'block', fontWeight:500 }}>
      {showDetails ? '▴ Hide details' : '▾ Add details'}
    </button>
  )

  return (
    <div style={{ ...MODAL_OVERLAY, zIndex }}>
      <div style={{ ...MODAL_CARD, maxWidth:480 }}>
        <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Task title..."
          style={{ width:'100%', fontSize:18, fontWeight:700, border:'none', outline:'none', marginBottom: isEdit ? 6 : 14, color:'#111', background:'transparent', padding:0 }} />
        {isEdit && <TimestampMeta created={task?.created_at} updated={task?.updated_at} />}

        {!isEdit ? (
          /* ── New task: title + optional details ── */
          <>
            {expandBtn}
            {showDetails && (
              <>
                {coreFields}
                {detailsSection}
                <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4 }}>
                  <label style={FIELD_LABEL}>Subtasks</label>
                  {f.subtasks.map(st => (
                    <SubtaskRow key={st.id} st={st}
                      onChange={updated => setF(p => ({ ...p, subtasks:p.subtasks.map(s => s.id===st.id?updated:s) }))}
                      onDelete={() => setF(p => ({ ...p, subtasks:p.subtasks.filter(s => s.id!==st.id) }))} />
                  ))}
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <input type="text" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key==='Enter') addSub() }} placeholder="Add a subtask..." style={{ flex:1, fontSize:12, padding:'6px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
                    <button onClick={addSub} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
                  </div>
                </div>
                <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4, marginTop:4 }}>
                  <label style={FIELD_LABEL}>Notes</label>
                  {f.notes.map(n => <NoteItem key={n.id} note={n} onDelete={removeNote} onSave={editNote} />)}
                  <div style={{ display:'flex', gap:8, marginTop:4 }}>
                    <textarea value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&(e.metaKey||e.ctrlKey)) addNote() }} placeholder="Add a note... (⌘+Enter to save)" style={{ flex:1, fontSize:12, height:56, resize:'none', fontFamily:'inherit', padding:'7px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
                    <button onClick={addNote} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          /* ── Edit task: key fields visible, rest collapsible ── */
          <>
            {coreFields}
            <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4 }}>
              <label style={FIELD_LABEL}>Subtasks</label>
              {f.subtasks.map(st => (
                <SubtaskRow key={st.id} st={st}
                  onChange={updated => setF(p => ({ ...p, subtasks:p.subtasks.map(s => s.id===st.id?updated:s) }))}
                  onDelete={() => setF(p => ({ ...p, subtasks:p.subtasks.filter(s => s.id!==st.id) }))} />
              ))}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <input type="text" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => { if (e.key==='Enter') addSub() }} placeholder="Add a subtask..." style={{ flex:1, fontSize:12, padding:'6px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
                <button onClick={addSub} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
              </div>
            </div>
            <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:12, marginTop:4 }}>
              <label style={FIELD_LABEL}>Notes</label>
              {f.notes.map(n => <NoteItem key={n.id} note={n} onDelete={removeNote} onSave={editNote} />)}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <textarea value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => { if (e.key==='Enter'&&(e.metaKey||e.ctrlKey)) addNote() }} placeholder="Add a note... (⌘+Enter to save)" style={{ flex:1, fontSize:12, height:56, resize:'none', fontFamily:'inherit', padding:'7px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
                <button onClick={addNote} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
              </div>
            </div>
            <button onClick={() => setShowDetails(v => !v)}
              style={{ fontSize:12, color:'#7c3aed', background:'#ede9fe', border:'0.5px solid #c4b5fd', borderRadius:8, padding:'6px 12px', cursor:'pointer', marginBottom:14, display:'block', fontWeight:500 }}>
              {showDetails ? '▴ Hide details' : '▾ More details'}
            </button>
            {showDetails && detailsSection}
          </>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, borderTop:'0.5px solid #f0f0f0', paddingTop:14 }}>
          <div>{isEdit && <ConfirmDeleteButton onConfirm={() => onDelete(task.id)} style={{ fontSize:13, color:'#A32D2D', background:'none', border:'0.5px solid #F09595', borderRadius:8, padding:'7px 14px', cursor:'pointer' }}>Delete</ConfirmDeleteButton>}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ fontSize:13, background:'none', border:'0.5px solid #ccc', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'#444' }}>Cancel</button>
            <button onClick={() => { if (f.title.trim()) onSave(f) }} disabled={!f.title.trim()} style={{ ...BTN_PRIMARY, padding:'7px 18px', cursor:f.title.trim()?'pointer':'not-allowed', opacity:f.title.trim()?1:0.4 }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Event Form ──────────────────────────────────────────────────────
const CAL_EMPTY = { title:'', emoji:'', type:'event', calendar_id:'', start_date:today(), end_date:'', start_time:'09:00', end_time:'10:00', all_day:false, recurrence_type:'', recurrence_data:{}, recurrence_start:'', recurrence_end:'', owners:['Levi'], color:'', description:'' }

const EMOJI_PICKS = ['📅','📆','🗓','⏰','🔔','📌','📍','🎯','🏆','🎉','🎤','💡','💼','📊','📝','✅','🚀','🌟','🤝','👥','☕','🍽','✈','🚗','🏋','⚽','🎶','🎬','🏖','🌿','💰','🔒','🩺','📚','🛠','🧑‍💻','🧠','❤','🔥','⚡']

function CalendarEventForm({ event, isEdit, onSave, onDelete, onClose, members = MEMBERS, calendars = [] }) {
  const [f, setF] = useState({ ...CAL_EMPTY, ...event, recurrence_data: event?.recurrence_data || {} })
  const [emojiOpen, setEmojiOpen] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]:v }))
  const setRd = (k, v) => setF(p => ({ ...p, recurrence_data:{ ...p.recurrence_data, [k]:v } }))
  const toggleOwner = m => { const cur = f.owners||[]; if (cur.includes(m)) { set('owners', cur.filter(o => o!==m)) } else set('owners', [...cur, m]) }
  const toggleDay = d => {
    const days = f.recurrence_data.days||[]
    setRd('days', days.includes(d) ? days.filter(x => x!==d) : [...days, d])
  }
  const weekdays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const rd = f.recurrence_data || {}

  return (
    <div style={{ ...MODAL_OVERLAY, zIndex:50 }}>
      <div style={{ ...MODAL_CARD, maxWidth:500 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <div style={{ position:'relative', flexShrink:0 }}>
            <button onClick={() => setEmojiOpen(o => !o)}
              style={{ width:44, height:38, fontSize:22, border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box' }}>
              {f.emoji || <span style={{ fontSize:14, color:'#ccc' }}>+</span>}
            </button>
            {emojiOpen && (
              <div style={{ position:'absolute', top:44, left:0, zIndex:100, background:'white', border:'0.5px solid #e0e0e0', borderRadius:10, padding:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', width:220 }}>
                <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                  {f.emoji && (
                    <button onClick={() => { set('emoji', ''); setEmojiOpen(false) }}
                      style={{ width:32, height:32, borderRadius:6, border:'0.5px solid #f09595', background:'#fcebeb', cursor:'pointer', fontSize:11, color:'#791f1f' }}>✕</button>
                  )}
                  {EMOJI_PICKS.map(em => (
                    <button key={em} onClick={() => { set('emoji', em); setEmojiOpen(false) }}
                      style={{ width:32, height:32, borderRadius:6, border: f.emoji===em ? '1.5px solid #7c3aed' : '0.5px solid transparent', background: f.emoji===em ? '#ede9fe' : 'none', cursor:'pointer', fontSize:20, lineHeight:1, padding:0 }}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Event title..."
            style={{ flex:1, fontSize:16, fontWeight:600, border:'none', outline:'none', color:'#111', background:'transparent', padding:0 }} />
        </div>

        {/* Calendar */}
        {calendars.filter(c => c.type !== 'holidays').length > 0 && (
          <div style={{ marginBottom:12 }}>
            <label style={FIELD_LABEL}>Calendar</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {calendars.filter(c => c.type !== 'holidays').map(c => (
                <button key={c.id} onClick={() => set('calendar_id', c.id)}
                  style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:f.calendar_id===c.id?`1.5px solid ${c.color}`:'0.5px solid #e5e5e5', background:f.calendar_id===c.id?c.color+'18':'white', color:f.calendar_id===c.id?c.color:'#888', fontWeight:f.calendar_id===c.id?500:400 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }} />{c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Type */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          {[{ key:'event', label:'Event' }, { key:'travel', label:'✈ Travel block' }, { key:'audit', label:'🔍 Audit' }, { key:'vacation', label:'🌴 Vacation' }].map(t => (
            <button key={t.key} onClick={() => set('type', t.key)}
              style={{ fontSize:12, padding:'5px 14px', borderRadius:8, cursor:'pointer', border:f.type===t.key?'1.5px solid #111':'0.5px solid #e5e5e5', background:f.type===t.key?'#111':'white', color:f.type===t.key?'white':'#888', fontWeight:f.type===t.key?500:400 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Dates */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={FIELD_LABEL}>Start date</label>
            <DatePickerISO value={f.start_date} onChange={v => { set('start_date', v); if (f.end_date && f.end_date < v) set('end_date', '') }} /></div>
          <div><label style={FIELD_LABEL}>{['travel','audit','vacation'].includes(f.type)?'End date':'End date (optional)'}</label>
            <DatePickerISO value={f.end_date} onChange={v => set('end_date', v)} initialMonth={f.start_date||undefined} minDate={f.start_date||undefined} /></div>
        </div>

        {/* Times + all day */}
        {!['travel','audit','vacation'].includes(f.type) && (
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#444', marginBottom:8, cursor:'pointer' }}>
              <input type="checkbox" checked={!!f.all_day} onChange={e => set('all_day', e.target.checked)} style={{ width:14, height:14 }} />All day
            </label>
            {!f.all_day && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={FIELD_LABEL}>Start time</label>
                  <input type="time" value={f.start_time} onChange={e => set('start_time', e.target.value)} style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} /></div>
                <div><label style={FIELD_LABEL}>End time</label>
                  <input type="time" value={f.end_time} onChange={e => set('end_time', e.target.value)} style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} /></div>
              </div>
            )}
          </div>
        )}

        {/* Recurrence */}
        <div style={{ marginBottom:14 }}>
          <label style={FIELD_LABEL}>Repeats</label>
          <select value={f.recurrence_type} onChange={e => { set('recurrence_type', e.target.value); setF(p => ({ ...p, recurrence_data:{} })) }} style={{ width:'100%', fontSize:13, marginBottom:8, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', fontFamily:'inherit', boxSizing:'border-box' }}>
            {RECURRENCE_TYPES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>

          {(f.recurrence_type === 'weekly_day' || f.recurrence_type === 'biweekly') && (
            <div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
                {weekdays.map(d => {
                  const sel = (rd.days||[]).includes(d)
                  return <button key={d} onClick={() => toggleDay(d)} style={{ fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:sel?'1.5px solid #111':'0.5px solid #e5e5e5', background:sel?'#111':'white', color:sel?'white':'#888' }}>{d}</button>
                })}
              </div>
              {f.recurrence_type === 'biweekly' && (
                <div><label style={FIELD_LABEL}>Starting from (anchor week)</label>
                  <DatePickerISO value={f.recurrence_start||f.start_date} onChange={v => set('recurrence_start', v)} /></div>
              )}
            </div>
          )}

          {f.recurrence_type === 'monthly_date' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={FIELD_LABEL}>Day of month</label>
                <input type="number" min={1} max={31} value={rd.date||1} onChange={e => setRd('date', parseInt(e.target.value)||1)} style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} /></div>
              <div><label style={FIELD_LABEL}>If weekend</label>
                <select value={rd.business_day_adjustment||''} onChange={e => setRd('business_day_adjustment', e.target.value||null)} style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', fontFamily:'inherit', boxSizing:'border-box' }}>
                  <option value="">No adjustment</option>
                  <option value="forward">Move to Monday</option>
                  <option value="backward">Move to Friday</option>
                  <option value="nearest">Nearest weekday</option>
                </select></div>
            </div>
          )}

          {f.recurrence_type === 'monthly_dow' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div><label style={FIELD_LABEL}>Which week</label>
                <select value={rd.week||1} onChange={e => setRd('week', parseInt(e.target.value))} style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', fontFamily:'inherit', boxSizing:'border-box' }}>
                  <option value={1}>1st</option><option value={2}>2nd</option><option value={3}>3rd</option><option value={4}>4th</option><option value={-1}>Last</option>
                </select></div>
              <div><label style={FIELD_LABEL}>Day of week</label>
                <select value={rd.dow||'Mon'} onChange={e => setRd('dow', e.target.value)} style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', fontFamily:'inherit', boxSizing:'border-box' }}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <option key={d} value={d}>{d}</option>)}
                </select></div>
            </div>
          )}

          {f.recurrence_type === 'monthly_biz_day' && (
            <div style={{ maxWidth:160 }}>
              <label style={FIELD_LABEL}>Business day of month</label>
              <input type="number" min={1} max={23} value={rd.biz_day||1} onChange={e => setRd('biz_day', Math.min(23, Math.max(1, parseInt(e.target.value)||1)))}
                style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
          )}

          {f.recurrence_type && (
            <div style={{ marginTop:8 }}>
              <label style={FIELD_LABEL}>Recurrence ends (optional)</label>
              <DatePickerISO value={f.recurrence_end||''} onChange={v => set('recurrence_end', v)} />
            </div>
          )}
        </div>

        {/* Owners */}
        <div style={{ marginBottom:12 }}>
          <label style={FIELD_LABEL}>Attendees</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {members.map(m => { const sel = (f.owners||[]).includes(m); const c = MEMBER_COLORS[m]||{}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:sel?`1.5px solid ${c.tc}`:'0.5px solid #e5e5e5', background:sel?c.bg:'white', color:sel?c.tc:'#888', fontWeight:sel?500:400 }}>{m}</button> })}
          </div>
        </div>

        {/* Color + description */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div><label style={FIELD_LABEL}>Color</label>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width:fc.key?20:14, height:fc.key?20:14, borderRadius:'50%', background:fc.hex, border:f.color===fc.key?'2.5px solid #111':'2px solid transparent', cursor:'pointer', padding:0 }} />)}
            </div></div>
          <div><label style={FIELD_LABEL}>Location</label>
            <input type="text" value={f.location||''} onChange={e => set('location', e.target.value)} placeholder="optional" style={{ width:'100%', fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 8px', outline:'none', fontFamily:'inherit', boxSizing:'border-box' }} /></div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={FIELD_LABEL}>Notes</label>
          <textarea value={f.description||''} onChange={e => set('description', e.target.value)} placeholder="Add notes..." rows={3} style={{ width:'100%', fontSize:12, resize:'vertical', fontFamily:'inherit', padding:'7px 9px', border:'0.5px solid #e0e0e0', borderRadius:6 }} />
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>{isEdit && <ConfirmDeleteButton onConfirm={() => onDelete(event.id)} style={{ fontSize:13, color:'#A32D2D', background:'none', border:'0.5px solid #F09595', borderRadius:8, padding:'7px 14px', cursor:'pointer' }}>Delete</ConfirmDeleteButton>}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} style={{ fontSize:13, background:'none', border:'0.5px solid #ccc', borderRadius:8, padding:'7px 14px', cursor:'pointer', color:'#444' }}>Cancel</button>
            <button onClick={() => { if (f.title.trim()) onSave(f) }} disabled={!f.title.trim()} style={{ ...BTN_PRIMARY, padding:'7px 18px', cursor:f.title.trim()?'pointer':'not-allowed', opacity:f.title.trim()?1:0.4 }}>Save</button>
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

  const allDayEvs = allExpanded.filter(ev => ev.all_day || ['travel','audit','vacation'].includes(ev.type) || (ev.end_date && ev.end_date !== ev.start_date))
  const timedEvs = allExpanded.filter(ev => !ev.all_day && !['travel','audit','vacation'].includes(ev.type) && ev.start_time && !(ev.end_date && ev.end_date !== ev.start_date))

  const evsByDay = weekDates.map(d => {
    const ds = toISODate(d)
    return timedEvs.filter(ev => ev.start_date === ds)
  })

  const evTop = t => { const [h,m] = t.split(':').map(Number); return ((h - CAL_START_HOUR) * 60 + m) * (CAL_HOUR_H / 60) }
  const evH = (s, e) => e ? Math.max((timeToMin(e) - timeToMin(s)) * (CAL_HOUR_H / 60), 22) : CAL_HOUR_H

  return (
    <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden', background:'white' }}>
      <div style={{ overflowY:'auto', maxHeight:620 }}>

        {/* Sticky day headers */}
        <div style={{ display:'flex', position:'sticky', top:0, zIndex:3, background:'white', borderBottom:'0.5px solid #d8d8d8' }}>
          <div style={{ width:50, flexShrink:0, borderRight:'0.5px solid #d8d8d8' }} />
          {weekDates.map((d, i) => {
            const ds = toISODate(d), isToday = ds === todayStr
            const dayHoliday = allExpanded.find(ev => ev.type === 'holiday' && ev.start_date === ds)
            return (
              <div key={i} onClick={() => onDayClick(d)} style={{ flex:1, textAlign:'center', padding:'10px 0 8px', borderLeft:'0.5px solid #d8d8d8', cursor:'pointer', background:d.getDay()===0||d.getDay()===6?'#f5f4f0':'white' }}>
                <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.04em' }}>{DOW_SHORT[d.getDay()]}</div>
                <div style={{ width:30, height:30, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:400, marginTop:2, background:isToday?'#111':'transparent', color:isToday?'white':'#111' }}>
                  {d.getDate()}
                </div>
                {dayHoliday && <div style={{ fontSize:9, color:'#15803d', fontWeight:600, marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', padding:'0 4px' }}>★ {dayHoliday.title}</div>}
              </div>
            )
          })}
        </div>

        {/* All-day row */}
        {allDayEvs.filter(ev => ev.type !== 'holiday').length > 0 && (
          <div style={{ display:'flex', borderBottom:'0.5px solid #d8d8d8', minHeight:32 }}>
            <div style={{ width:50, flexShrink:0, fontSize:9, color:'#ccc', padding:'8px 4px 0 6px', borderRight:'0.5px solid #d8d8d8' }}>all-day</div>
            <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, padding:'4px 2px' }}>
              {allDayEvs.filter(ev => ev.type !== 'holiday').map((ev, i) => {
                const evS = fromISODate(ev.start_date)
                const evE = ev.end_date ? fromISODate(ev.end_date) : evS
                const dispS = evS < rangeStart ? rangeStart : evS
                const dispE = evE > rangeEnd ? rangeEnd : evE
                const sc = Math.max(0, weekDates.findIndex(d => toISODate(d) === toISODate(dispS))) + 1
                const ec = Math.min(7, weekDates.findIndex(d => toISODate(d) === toISODate(dispE))) + 2
                const bg = evTypeBg(ev)
                const bdr = evTypeBdr(ev)
                return (
                  <div key={i} onClick={() => onEventClick(ev)} style={{ gridColumn:`${sc}/${ec}`, fontSize:10, padding:'3px 6px', borderRadius:6, cursor:'pointer', background:bg, border:`0.5px solid ${bdr}`, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#333' }}>
                    {evTypeIcon(ev)}{ev.emoji ? ev.emoji+' ' : ''}{ev.title}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Time grid */}
        <div style={{ display:'flex', height:CAL_TOTAL_H, position:'relative' }}>
          {/* Hour labels */}
          <div style={{ width:50, flexShrink:0, position:'relative', borderRight:'0.5px solid #d8d8d8' }}>
            {HOURS.map(h => (
              <div key={h} style={{ position:'absolute', top:(h-CAL_START_HOUR)*CAL_HOUR_H, width:'100%', fontSize:10, color:'#ccc', textAlign:'right', paddingRight:8, paddingTop:2 }}>
                {h===12?'12pm':h>12?`${h-12}pm`:`${h}am`}
              </div>
            ))}
          </div>
          {/* Day columns */}
          <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(7,1fr)', position:'relative' }}>
            {/* Hour lines */}
            {HOURS.map(h => (
              <div key={h} style={{ position:'absolute', left:0, right:0, top:(h-CAL_START_HOUR)*CAL_HOUR_H, borderTop:`0.5px solid ${h===12?'#b0b0b0':'#d8d8d8'}`, pointerEvents:'none' }} />
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
              const ds = toISODate(d), isToday = ds === todayStr, isWknd = d.getDay()===0||d.getDay()===6
              return (
                <div key={di} onClick={() => onDayClick(d)} style={{ position:'relative', borderLeft:di>0?'0.5px solid #d8d8d8':'none', background:isToday?'#fefffe':isWknd?'#f5f4f0':'transparent', cursor:'pointer', minHeight:CAL_TOTAL_H }}>
                  {evsByDay[di].map((ev, ei) => {
                    const top = evTop(ev.start_time)
                    const height = evH(ev.start_time, ev.end_time)
                    const bg = flagBg(ev.color) || '#E6F1FB'
                    const bdr = flagBorder(ev.color) || '#85B7EB'
                    return (
                      <div key={`${ev.id}-${ei}`} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                        style={{ position:'absolute', top, height, left:2, right:2, borderRadius:6, cursor:'pointer', background:bg, border:`0.5px solid ${bdr}`, padding:'2px 4px', overflow:'hidden', zIndex:1 }}>
                        <div style={{ fontSize:10, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#333' }}>{ev.emoji ? ev.emoji+' ' : ''}{ev.title}</div>
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
function CalendarMonthView({ events, year, month, onDayClick, onShowDay, onEventClick }) {
  const dates = getMonthDates(year, month)
  const todayStr = today()
  const rangeStart = dates[0], rangeEnd = dates[41]

  const { multiByDay, singleByDay, maxLanePerWeek } = useMemo(() => {
    const expanded = getEventsForRange(events, rangeStart, rangeEnd)
    const multiDay = expanded.filter(ev => ev.end_date && fromISODate(ev.end_date) > fromISODate(ev.start_date))
    const singleDay = expanded.filter(ev => !ev.end_date || fromISODate(ev.end_date) <= fromISODate(ev.start_date))

    const dateIdx = {}
    dates.forEach((d, i) => { dateIdx[toISODate(d)] = i })

    const laneMap = {}
    const maxLanePerWeek = new Array(6).fill(-1)
    for (let wi = 0; wi < 6; wi++) {
      const wS = dates[wi * 7], wE = dates[wi * 7 + 6]
      const weekEvs = multiDay
        .filter(ev => fromISODate(ev.end_date) >= wS && fromISODate(ev.start_date) <= wE)
        .sort((a, b) => {
          const aS = fromISODate(a.start_date), bS = fromISODate(b.start_date)
          const aClip = aS < wS ? wS : aS, bClip = bS < wS ? wS : bS
          if (aClip < bClip) return -1
          if (aClip > bClip) return 1
          return (fromISODate(b.end_date) - fromISODate(b.start_date)) - (fromISODate(a.end_date) - fromISODate(a.start_date))
        })
      const laneEnds = []
      weekEvs.forEach(ev => {
        const evS = fromISODate(ev.start_date), evE = fromISODate(ev.end_date)
        const clipS = evS < wS ? wS : evS
        let lane = 0
        while (lane < laneEnds.length && laneEnds[lane] >= clipS) lane++
        if (!laneMap[ev.id]) laneMap[ev.id] = {}
        laneMap[ev.id][wi] = lane
        laneEnds[lane] = evE > wE ? wE : evE
        if (lane > maxLanePerWeek[wi]) maxLanePerWeek[wi] = lane
      })
    }

    const multiByDay = {}
    multiDay.forEach(ev => {
      const evS = fromISODate(ev.start_date), evE = fromISODate(ev.end_date)
      let cur = new Date(evS)
      while (cur <= evE) {
        const ds = toISODate(cur)
        if (dateIdx[ds] !== undefined) {
          const lane = laneMap[ev.id]?.[Math.floor(dateIdx[ds] / 7)] ?? 0
          if (!multiByDay[ds]) multiByDay[ds] = []
          multiByDay[ds].push({ ...ev, _lane: lane, _spanStart: ev.start_date, _spanEnd: toISODate(evE), _spanDay: ds })
        }
        cur.setDate(cur.getDate() + 1)
      }
    })

    const singleByDay = {}
    singleDay.forEach(ev => {
      if (!singleByDay[ev.start_date]) singleByDay[ev.start_date] = []
      singleByDay[ev.start_date].push(ev)
    })
    Object.values(singleByDay).forEach(arr => arr.sort((a, b) => {
      if (!a.start_time && b.start_time) return -1
      if (a.start_time && !b.start_time) return 1
      return (a.start_time||'').localeCompare(b.start_time||'')
    }))

    return { multiByDay, singleByDay, maxLanePerWeek }
  }, [events, year, month])

  return (
    <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden', background:'white' }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'0.5px solid #e5e5e5' }}>
        {DOW_SHORT.map((d,di) => <div key={d} style={{ textAlign:'center', fontSize:10, color:'#aaa', padding:'8px 0', textTransform:'uppercase', background:di===0||di===6?'#f5f4f0':'white' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
        {dates.map((d, i) => {
          const ds = toISODate(d), isToday = ds === todayStr, inMonth = d.getMonth() === month
          const wi = Math.floor(i / 7)
          const laneCount = maxLanePerWeek[wi] + 1
          const dayMulti = multiByDay[ds] || []
          const byLane = {}
          dayMulti.forEach(ev => { byLane[ev._lane] = ev })
          const allSingles = singleByDay[ds] || []
          const dayHolidays = allSingles.filter(ev => ev.type === 'holiday')
          const singles = allSingles.filter(ev => ev.type !== 'holiday')
          const singlesSlots = Math.max(0, 3 - laneCount)
          const overflow = Math.max(0, singles.length - singlesSlots)
          return (
            <div key={i} onClick={() => onDayClick(d)}
              style={{ minHeight:80, padding:'6px 4px 4px', borderTop:i>=7?'0.5px solid #d8d8d8':undefined, borderLeft:i%7!==0?'0.5px solid #d8d8d8':undefined, cursor:'pointer', background:d.getDay()===0||d.getDay()===6?'#f5f4f0':'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background=d.getDay()===0||d.getDay()===6?'#eceae5':'#f5f5f3'}
              onMouseLeave={e => e.currentTarget.style.background=d.getDay()===0||d.getDay()===6?'#f5f4f0':'transparent'}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: dayHolidays.length ? 2 : 3 }}>
                <div onClick={e => { e.stopPropagation(); onShowDay(d) }}
                  style={{ width:22, height:22, borderRadius:'50%', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, background:isToday?'#111':'transparent', color:isToday?'white':inMonth?'#111':'#ccc', fontWeight:isToday?500:400, cursor:'pointer' }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background='#e8e8e8' }}
                  onMouseLeave={e => { if (!isToday) e.currentTarget.style.background='transparent' }}>
                  {d.getDate()}
                </div>
              </div>
              {dayHolidays.map((ev, hi) => (
                <div key={`h-${hi}`} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                  style={{ fontSize:10, fontWeight:600, color:'#15803d', padding:'1px 4px', marginBottom:2, borderRadius:3, background:'#dcfce7', border:'0.5px solid #86efac', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', width:'100%', boxSizing:'border-box' }}>
                  ★ {ev.title}
                </div>
              ))}
              {Array.from({ length: laneCount }, (_, li) => {
                const ev = byLane[li]
                if (!ev) return <div key={`sp-${li}`} style={{ height:20, marginBottom:2 }} />
                const bg = evTypeBg(ev)
                const bdr = evTypeBdr(ev)
                const isStart = ev._spanDay === ev._spanStart
                const isEnd = ev._spanDay === ev._spanEnd
                const isSun = d.getDay() === 0
                const showLabel = isStart || isSun
                const typeIcon = evTypeIcon(ev)
                return (
                  <div key={`ln-${li}`} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    style={{
                      fontSize:10, marginBottom:2, cursor:'pointer', overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#333',
                      background:bg, border:`0.5px solid ${bdr}`,
                      borderLeft: !isStart && !isSun ? 'none' : undefined,
                      borderRight: !isEnd ? 'none' : undefined,
                      borderRadius: (isStart||isSun) && !isEnd ? '3px 0 0 3px' : !isStart&&!isSun && isEnd ? '0 3px 3px 0' : isStart&&isEnd ? 3 : 0,
                      padding: '1px 5px',
                      marginLeft: !isStart && !isSun ? -4 : 0,
                      marginRight: !isEnd ? -4 : 0,
                    }}>
                    {showLabel ? typeIcon+(ev.emoji?ev.emoji+' ':'')+( ev.start_time&&!ev.all_day?`${fmtTime(ev.start_time)} `:'')+ev.title : ' '}
                  </div>
                )
              })}
              {singles.slice(0, singlesSlots).map((ev, ei) => {
                const sBg = evTypeBg(ev)
                const sBdr = evTypeBdr(ev)
                const sIcon = evTypeIcon(ev)
                return (
                  <div key={`s-${ei}`} onClick={e => { e.stopPropagation(); onEventClick(ev) }}
                    style={{ fontSize:10, padding:'1px 5px', borderRadius:3, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', background:sBg, border:`0.5px solid ${sBdr}`, color:'#333', cursor:'pointer' }}>
                    {sIcon}{ev.emoji ? ev.emoji+' ' : ''}{ev.start_time?`${fmtTime(ev.start_time)} `:''}{ev.title}
                  </div>
                )
              })}
              {overflow > 0 && <div onClick={e => { e.stopPropagation(); onShowDay(d) }} style={{ fontSize:9, color:'#888', paddingLeft:4, cursor:'pointer' }} onMouseEnter={e => e.currentTarget.style.color='#111'} onMouseLeave={e => e.currentTarget.style.color='#888'}>+{overflow} more</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── Calendar Tab ─────────────────────────────────────────────────────────────
function CalendarYearView({ events, year, onDayClick, onShowDay, onEventClick }) {
  const todayStr = today()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const expanded = getEventsForRange(events, yearStart, yearEnd)

  const evsByDay = {}
  expanded.forEach(ev => {
    const evStart = fromISODate(ev.start_date)
    const evEnd = ev.end_date ? fromISODate(ev.end_date) : evStart
    let cur = new Date(evStart)
    while (cur <= evEnd) {
      const ds = toISODate(cur)
      if (!evsByDay[ds]) evsByDay[ds] = []
      if (!evsByDay[ds].some(e => e.id === ev.id)) evsByDay[ds].push(ev)
      if (evStart.getTime() === evEnd.getTime()) break
      cur.setDate(cur.getDate() + 1)
    }
  })

  return (
    <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden', background:'white' }}>
      <div style={{ overflowX:'auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'30px repeat(12, 1fr)', minWidth:560 }}>
          {/* Corner */}
          <div style={{ position:'sticky', top:0, left:0, zIndex:3, background:'white', borderBottom:'0.5px solid #e5e5e5', borderRight:'0.5px solid #f0f0f0' }} />
          {/* Month headers */}
          {MONTH_NAMES.map((mn, m) => (
            <div key={m} style={{ position:'sticky', top:0, zIndex:2, background:'white', textAlign:'center', fontSize:10, fontWeight:500, color:'#888', padding:'7px 0 5px', borderBottom:'0.5px solid #d8d8d8', borderLeft:'0.5px solid #d8d8d8', textTransform:'uppercase', letterSpacing:'0.04em' }}>
              {mn.slice(0, 3)}
            </div>
          ))}
          {/* Day rows */}
          {Array.from({ length: 31 }, (_, i) => i + 1).flatMap(day => [
            <div key={`lbl-${day}`} style={{ position:'sticky', left:0, zIndex:1, background:'white', borderRight:'0.5px solid #d8d8d8', borderTop:'0.5px solid #d8d8d8', height:22, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5, fontSize:10, color:'#bbb', fontVariantNumeric:'tabular-nums' }}>
              {day}
            </div>,
            ...Array.from({ length: 12 }, (_, m) => {
              const maxDay = new Date(year, m + 1, 0).getDate()
              const ds = `${year}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
              const isToday = ds === todayStr
              const dow = new Date(year, m, day).getDay()
              const isWknd = dow===0||dow===6
              if (day > maxDay) return (
                <div key={`${m}-${day}`} style={{ background:isWknd?'#eeede9':'#f5f5f3', borderTop:'0.5px solid #d8d8d8', borderLeft:'0.5px solid #d8d8d8', height:22 }} />
              )
              const cellEvs = evsByDay[ds] || []
              const cellNormalBg = isToday?'#ede9fe':isWknd?'#f5f4f0':'transparent'
              return (
                <div key={`${m}-${day}`} onClick={() => onDayClick(fromISODate(ds))}
                  style={{ minHeight:22, borderTop:'0.5px solid #d8d8d8', borderLeft:'0.5px solid #d8d8d8', background:cellNormalBg, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'stretch', justifyContent:'center', gap:1, padding:'1px 2px', overflow:'hidden' }}
                  onMouseEnter={e => { if (!isToday) e.currentTarget.style.background=isWknd?'#eceae5':'#f0f0ee' }}
                  onMouseLeave={e => { e.currentTarget.style.background=cellNormalBg }}>
                  {cellEvs.slice(0, 2).map((ev, i) => {
                    const bg = evTypeBg(ev)
                    const tc = evTypeTc(ev)
                    return (
                      <div key={i} onClick={e => { e.stopPropagation(); onEventClick(ev) }} title={ev.title}
                        style={{ fontSize:7, lineHeight:'8px', padding:'0 3px', height:8, borderRadius:2, background:bg, color:tc, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer', flexShrink:0, fontWeight:500 }}>
                        {evTypeIcon(ev)}{ev.emoji ? ev.emoji+' ' : ''}{ev.title}
                      </div>
                    )
                  })}
                  {cellEvs.length > 2 && <div onClick={e => { e.stopPropagation(); onShowDay(fromISODate(ds)) }} style={{ fontSize:6, color:'#aaa', lineHeight:'7px', paddingLeft:2, flexShrink:0, cursor:'pointer' }}>+{cellEvs.length-2}</div>}
                </div>
              )
            })
          ])}
        </div>
      </div>
    </div>
  )
}

function CalendarListView({ events, onEventClick }) {
  const todayISO = toISODate(new Date())
  const horizonEnd = new Date(); horizonEnd.setFullYear(horizonEnd.getFullYear() + 2)
  const expanded = getEventsForRange(events, fromISODate(todayISO), horizonEnd)
  const sorted = expanded
    .filter(ev => (ev.end_date || ev.start_date) >= todayISO)
    .sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time||'').localeCompare(b.start_time||''))

  const groups = {}
  sorted.forEach(ev => {
    const key = ev.start_date.slice(0, 7) // YYYY-MM
    if (!groups[key]) groups[key] = []
    groups[key].push(ev)
  })

  if (sorted.length === 0) {
    return <div style={{ textAlign:'center', padding:'60px 0', color:'#bbb', fontSize:13 }}>No upcoming events</div>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {Object.entries(groups).map(([key, evs]) => {
        const [y, m] = key.split('-')
        return (
          <div key={key}>
            <div style={{ fontSize:11, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8, paddingBottom:4, borderBottom:'0.5px solid #f0f0f0' }}>
              {MONTH_NAMES[parseInt(m)-1]} {y}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
              {evs.map((ev, i) => {
                const isTravel = ev.type === 'travel'
                const isAudit = ev.type === 'audit'
                const isVacation = ev.type === 'vacation'
                const colorHex = ev.color ? FLAG_COLORS.find(c => c.key === ev.color)?.hex : isTravel ? '#FAC775' : isAudit ? '#A78BFA' : isVacation ? '#6EE7B7' : '#e0e0e0'
                const dow = DOW_SHORT[fromISODate(ev.start_date).getDay()]
                const day = parseInt(ev.start_date.split('-')[2])
                const timeLabel = ev.all_day || isTravel
                  ? (ev.end_date && ev.end_date !== ev.start_date ? `${MONTH_NAMES[parseInt(ev.end_date.split('-')[1])-1].slice(0,3)} ${parseInt(ev.end_date.split('-')[2])}` : 'All day')
                  : ev.start_time ? `${fmtTime(ev.start_time)}${ev.end_time ? ' – ' + fmtTime(ev.end_time) : ''}` : ''
                return (
                  <div key={ev.id || `${ev.start_date}-${i}`} onClick={() => onEventClick(ev)}
                    style={{ display:'flex', alignItems:'stretch', gap:10, padding:'9px 10px', background:'white', border:'0.5px solid #ebebeb', borderRadius:8, cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background='white'}>
                    <div style={{ minWidth:32, textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:17, fontWeight:700, color:'#111', lineHeight:1.1 }}>{day}</div>
                      <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase' }}>{dow}</div>
                    </div>
                    <div style={{ width:3, borderRadius:2, background:colorHex, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:6 }}>
                        {isTravel && <span style={{ fontSize:10 }}>✈</span>}
                        {isAudit && <span style={{ fontSize:10 }}>🔍</span>}
                        {isVacation && <span style={{ fontSize:10 }}>🌴</span>}
                        {ev.emoji && <span>{ev.emoji}</span>}
                        {ev.title}
                      </div>
                      {timeLabel && <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{timeLabel}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayScheduleModal({ date, events, onClose, onEventClick, onAddEvent }) {
  const dayEvs = getEventsForRange(events, date, date)
    .sort((a, b) => {
      const aAllDay = a.all_day || ['travel','audit','vacation'].includes(a.type)
      const bAllDay = b.all_day || ['travel','audit','vacation'].includes(b.type)
      if (aAllDay !== bAllDay) return aAllDay ? -1 : 1
      return (a.start_time||'').localeCompare(b.start_time||'')
    })
  const label = date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.28)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:'max(30px, env(safe-area-inset-top))', paddingLeft:'env(safe-area-inset-left)', paddingRight:'env(safe-area-inset-right)', zIndex:55 }}>
      <div style={{ background:'white', borderRadius:12, border:'0.5px solid #e5e5e5', padding:'1.25rem', width:'100%', maxWidth:480, maxHeight:'88dvh', overflowY:'auto', overscrollBehavior:'contain', WebkitOverflowScrolling:'touch' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:15, fontWeight:500, color:'#111' }}>{label}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:18, padding:0, lineHeight:1 }}>×</button>
        </div>

        <button onClick={() => onAddEvent(date)} style={{ width:'100%', marginBottom:12, padding:'8px 0', fontSize:12, color:'#888', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>
          + Add event
        </button>

        {dayEvs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'30px 0', color:'#ccc', fontSize:13 }}>No events</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {dayEvs.map((ev, i) => {
              const isTravel = ev.type === 'travel', isAudit = ev.type === 'audit', isVacation = ev.type === 'vacation'
              const colorHex = ev.color ? FLAG_COLORS.find(c => c.key === ev.color)?.hex : isTravel ? '#FAC775' : isAudit ? '#A78BFA' : isVacation ? '#6EE7B7' : '#e0e0e0'
              const timeLabel = ev.all_day || isTravel || isAudit || isVacation
                ? (ev.end_date && ev.end_date !== ev.start_date ? `Through ${MONTH_NAMES[parseInt(ev.end_date.split('-')[1])-1].slice(0,3)} ${parseInt(ev.end_date.split('-')[2])}` : 'All day')
                : ev.start_time ? `${fmtTime(ev.start_time)}${ev.end_time ? ' – ' + fmtTime(ev.end_time) : ''}` : ''
              return (
                <div key={ev.id || i} onClick={() => onEventClick(ev)}
                  style={{ display:'flex', alignItems:'stretch', gap:10, padding:'9px 10px', background:'#fafafa', border:'0.5px solid #ebebeb', borderRadius:8, cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f2f2f0'}
                  onMouseLeave={e => e.currentTarget.style.background='#fafafa'}>
                  <div style={{ width:3, borderRadius:2, background:colorHex, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#111', display:'flex', alignItems:'center', gap:6 }}>
                      {isTravel && <span style={{ fontSize:10 }}>✈</span>}
                      {isAudit && <span style={{ fontSize:10 }}>🔍</span>}
                      {isVacation && <span style={{ fontSize:10 }}>🌴</span>}
                      {ev.emoji && <span>{ev.emoji}</span>}
                      {ev.title}
                    </div>
                    {timeLabel && <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{timeLabel}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarTab({ events, onSave, onDelete, members = MEMBERS, calendars = [], onToggleCalendar }) {
  const [calView, setCalView] = useState('month')
  const [travelFilter, setTravelFilter] = useState(false)
  const [calDate, setCalDate] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [eventForm, setEventForm] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  const [daySchedule, setDaySchedule] = useState(null) // Date | null

  const visibleCalIds = new Set(calendars.filter(c => c.visible).map(c => c.id))
  const defaultCalId = calendars.find(c => c.type === 'default')?.id
  const allHidden = calendars.length > 0 && visibleCalIds.size === 0
  // Events with no calendar_id belong to the default calendar; treat as visible when default is visible
  const filteredEvents = calendars.length === 0 ? events : events.filter(ev =>
    ev.calendar_id ? visibleCalIds.has(ev.calendar_id) : (defaultCalId ? visibleCalIds.has(defaultCalId) : true)
  )

  const weekStart = startOfWeek(calDate)
  const year = calDate.getFullYear(), month = calDate.getMonth()

  const nav = dir => {
    setCalDate(d => {
      const nd = new Date(d)
      if (calView === 'week') nd.setDate(nd.getDate() + dir * 7)
      else if (calView === 'year') nd.setFullYear(nd.getFullYear() + dir)
      else nd.setMonth(nd.getMonth() + dir)
      return nd
    })
  }

  const goToday = () => {
    const n = new Date()
    if (calView === 'week') setCalDate(startOfWeek(n))
    else if (calView === 'year') setCalDate(new Date(n.getFullYear(), 0, 1))
    else setCalDate(new Date(n.getFullYear(), n.getMonth(), 1))
  }

  const headerLabel = calView === 'week'
    ? (() => { const wd = getWeekDates(calDate); return `${wd[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${wd[6].toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` })()
    : calView === 'year' ? String(year)
    : calView === 'list' ? 'Upcoming'
    : `${MONTH_NAMES[month]} ${year}`

  const handleDayClick = d => { setEventForm({ ...CAL_EMPTY, start_date: toISODate(d) }); setIsEdit(false) }

  const handleShowDay = d => setDaySchedule(d)

  const handleEventClick = ev => { setEventForm({ ...ev }); setIsEdit(true) }

  const handleSave = async data => {
    const payload = {
      title: data.title, type: data.type||'event',
      start_date: data.start_date, end_date: data.end_date||null,
      start_time: data.all_day||['travel','audit','vacation'].includes(data.type)?null:(data.start_time||null),
      end_time: data.all_day||['travel','audit','vacation'].includes(data.type)?null:(data.end_time||null),
      all_day: !!data.all_day || ['travel','audit','vacation'].includes(data.type),
      recurrence_type: data.recurrence_type||null,
      recurrence_data: data.recurrence_type?data.recurrence_data:{},
      recurrence_start: data.recurrence_type?(data.recurrence_start||data.start_date):null,
      recurrence_end: data.recurrence_end||null,
      owners: data.owners||['Levi'], color: data.color||'',
      description: data.description||'', location: data.location||'',
      emoji: data.emoji||'',
      calendar_id: data.calendar_id||null,
    }
    let err
    if (isEdit && eventForm?.id) {
      const r = await supabase.from('calendar_events').update(payload).eq('id', eventForm.id)
      err = r.error
    } else {
      const r = await supabase.from('calendar_events').insert(payload)
      err = r.error
    }
    if (err) { alert(`Save failed: ${err.message}`); return }
    setEventForm(null); setIsEdit(false); onSave()
  }

  const handleDelete = async id => {
    await supabase.from('calendar_events').delete().eq('id', id)
    setEventForm(null); setIsEdit(false); onSave()
  }

  return (
    <div>
      {/* Calendar toggles */}
      {calendars.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:12 }}>
          <span style={{ fontSize:11, color:'#aaa', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginRight:2 }}>Calendars</span>
          {calendars.map(cal => (
            <button key={cal.id} onClick={() => onToggleCalendar && onToggleCalendar(cal.id, !cal.visible)}
              style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer', border:`0.5px solid ${cal.visible ? cal.color : '#e0e0e0'}`, background: cal.visible ? cal.color+'18' : '#f7f7f5', color: cal.visible ? cal.color : '#bbb', fontWeight: cal.visible ? 500 : 400, transition:'all 0.1s' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background: cal.visible ? cal.color : '#ccc', flexShrink:0 }} />{cal.name}
            </button>
          ))}
        </div>
      )}
      {/* Nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={() => nav(-1)} style={{ background:'none', border:'0.5px solid #e5e5e5', borderRadius:8, width:28, height:28, cursor:'pointer', fontSize:14, color:'#555' }}>‹</button>
          <button onClick={goToday} style={{ fontSize:12, background:'none', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'4px 10px', cursor:'pointer', color:'#555' }}>Today</button>
          <button onClick={() => nav(1)} style={{ background:'none', border:'0.5px solid #e5e5e5', borderRadius:8, width:28, height:28, cursor:'pointer', fontSize:14, color:'#555' }}>›</button>
          <span style={{ fontSize:15, fontWeight:500, color:'#111', marginLeft:4 }}>{headerLabel}</span>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <div style={{ display:'flex', background:'#efefed', borderRadius:8, padding:2, gap:1 }}>
            {['week','month','year','list'].map(v => (
              <button key={v} onClick={() => setCalView(v)} style={{ fontSize:12, padding:'5px 12px', border:'none', background:calView===v?'white':'transparent', color:calView===v?'#111':'#888', fontWeight:calView===v?500:400, cursor:'pointer', borderRadius:6, boxShadow:calView===v?'0 1px 2px rgba(0,0,0,0.08)':'none' }}>
                {v.charAt(0).toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>
          {calView === 'year' && (
            <button onClick={() => setTravelFilter(v => !v)}
              style={{ fontSize:12, background:travelFilter?'#FAEEDA':'white', border:travelFilter?'0.5px solid #FAC775':'0.5px solid #e0e0e0', borderRadius:6, padding:'5px 12px', cursor:'pointer', color:travelFilter?'#633806':'#888', fontWeight:travelFilter?500:400 }}>
              ✈ Travel only
            </button>
          )}
          <button onClick={() => { setEventForm({ ...CAL_EMPTY }); setIsEdit(false) }} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>+ Event</button>
        </div>
      </div>

      {allHidden
        ? <div style={{ textAlign:'center', padding:'48px 0', color:'#aaa', fontSize:13 }}>All calendars are hidden — toggle one above to show events.</div>
        : calView === 'week'
        ? <CalendarWeekView events={filteredEvents} weekStart={weekStart} onDayClick={handleDayClick} onEventClick={handleEventClick} />
        : calView === 'month'
        ? <CalendarMonthView events={filteredEvents} year={year} month={month} onDayClick={handleDayClick} onShowDay={handleShowDay} onEventClick={handleEventClick} />
        : calView === 'list'
        ? <CalendarListView events={filteredEvents} onEventClick={handleEventClick} />
        : <CalendarYearView events={travelFilter ? filteredEvents.filter(e => e.type === 'travel') : filteredEvents} year={year} onDayClick={handleDayClick} onShowDay={handleShowDay} onEventClick={handleEventClick} />}

      {eventForm !== null && (
        <CalendarEventForm event={eventForm} isEdit={isEdit} onSave={handleSave} onDelete={handleDelete} onClose={() => { setEventForm(null); setIsEdit(false) }} members={members} calendars={calendars.filter(c => c.type !== 'holidays')} />
      )}
      {daySchedule !== null && (
        <DayScheduleModal
          date={daySchedule}
          events={events}
          onClose={() => setDaySchedule(null)}
          onEventClick={ev => { setDaySchedule(null); handleEventClick(ev) }}
          onAddEvent={d => { setDaySchedule(null); handleDayClick(d) }}
        />
      )}
    </div>
  )
}

// ─── Team Board Tab ───────────────────────────────────────────────────────────
function TeamBoardTab({ tasks, onEdit, onDragStart, onDragEnd, draggingId, onDrop, onDragOver, onDragLeave, overCol, toggleSubtask, onComplete, entityMap = {} }) {
  const [member, setMember] = useState('all')
  const filtered = member === 'all' ? tasks : tasks.filter(t => (t.owners||['Levi']).includes(member))
  const visible = filtered.filter(t => t.substatus !== 'canceled')
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
              style={{ fontSize:12, padding:'5px 14px', borderRadius:8, cursor:'pointer', border:active?(m.key==='all'||!c.tc?'1.5px solid #111':`1.5px solid ${c.tc}`):'0.5px solid #e5e5e5', background:active?(m.key==='all'?'#111':c.bg||'#f0f0f0'):'white', color:active?(m.key==='all'?'white':c.tc||'#333'):'#888', fontWeight:active?500:400 }}>
              {m.label}
            </button>
          )
        })}
        {[
          { key:'emea', label:'Open — EMEA', open:true },
          { key:'apac', label:'Open — APAC', open:true },
        ].map(m => (
          <button key={m.key} style={{ fontSize:12, padding:'5px 14px', borderRadius:8, border:'0.5px dashed #ddd', background:'white', color:'#bbb', cursor:'default' }}>{m.label}</button>
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
          const ct = visible.filter(t => (t.substatus||(t.status==='done'?'complete':'not_started')) === col.key)
          const colKey = `team-${col.key}-${member}`
          return (
            <div key={col.key} onDragOver={e => { e.preventDefault(); onDragOver(col.key) }} onDragLeave={onDragLeave} onDrop={e => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), col.key) }}
              style={{ flex:'1 1 180px', minWidth:180, background:overCol===col.key?'#EEF4FF':'#f7f7f5', border:overCol===col.key?'1.5px dashed #378ADD':'1.5px solid transparent', borderRadius:12, padding:12, minHeight:180 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{col.lbl}</span>
                <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
              </div>
              {ct.map(t => <TaskCard key={t.id} task={t} onEdit={onEdit} onDragStart={onDragStart} onDragEnd={onDragEnd} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} onComplete={onComplete} entityMap={entityMap} />)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Auth hook ───────────────────────────────────────────────────────────────
function useCurrentUserName(session) {
  const [name, setName] = useState(null)
  useEffect(() => {
    if (!session?.user?.email) { setName(null); return }
    supabase.from('team_members').select('name').eq('email', session.user.email).single()
      .then(({ data }) => { if (data?.name) setName(data.name) })
  }, [session?.user?.email])
  return name
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [mode, setMode] = useState('login') // 'login' | 'forgot' | 'sent'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  const handleForgot = async e => {
    e.preventDefault(); setError(''); setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (err) { setError(err.message); setLoading(false); return }
    setMode('sent'); setLoading(false)
  }

  const inputStyle = { width:'100%', boxSizing:'border-box', fontSize:14, padding:'10px 12px', border:'0.5px solid #d1d5db', borderRadius:8, outline:'none', fontFamily:'inherit', color:'#111' }
  const btnStyle = { width:'100%', fontSize:14, fontWeight:600, padding:'10px 0', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white' }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4ff', padding:16 }}>
      <div style={{ width:'100%', maxWidth:380, background:'white', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(124,58,237,0.10)' }}>
        <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, background:'linear-gradient(135deg,#4f46e5,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>💪🏻 TASKr</h1>
        {mode === 'sent' ? (
          <>
            <p style={{ fontSize:14, color:'#555', marginTop:8 }}>Check your email — a password reset link is on its way to <strong>{email}</strong>.</p>
            <button onClick={() => setMode('login')} style={{ ...btnStyle, marginTop:16 }}>Back to sign in</button>
          </>
        ) : mode === 'forgot' ? (
          <>
            <p style={{ fontSize:13, color:'#777', margin:'6px 0 20px' }}>Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              {error && <div style={{ fontSize:12, color:'#dc2626' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>{loading ? 'Sending…' : 'Send reset link'}</button>
              <button type="button" onClick={() => { setMode('login'); setError('') }} style={{ fontSize:13, background:'none', border:'none', color:'#7c3aed', cursor:'pointer', textDecoration:'underline', fontFamily:'inherit' }}>Back to sign in</button>
            </form>
          </>
        ) : (
          <>
            <p style={{ fontSize:13, color:'#777', margin:'6px 0 20px' }}>Sign in to your workspace.</p>
            <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
              {error && <div style={{ fontSize:12, color:'#dc2626' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>{loading ? 'Signing in…' : 'Sign in'}</button>
              <button type="button" onClick={() => { setMode('forgot'); setError('') }} style={{ fontSize:12, background:'none', border:'none', color:'#a78bfa', cursor:'pointer', fontFamily:'inherit' }}>Forgot password?</button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Set New Password Screen ──────────────────────────────────────────────────
function SetNewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(onDone, 1500)
  }

  const inputStyle = { width:'100%', boxSizing:'border-box', fontSize:14, padding:'10px 12px', border:'0.5px solid #d1d5db', borderRadius:8, outline:'none', fontFamily:'inherit', color:'#111' }
  const btnStyle = { width:'100%', fontSize:14, fontWeight:600, padding:'10px 0', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white' }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4ff', padding:16 }}>
      <div style={{ width:'100%', maxWidth:380, background:'white', borderRadius:16, padding:32, boxShadow:'0 4px 24px rgba(124,58,237,0.10)' }}>
        <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:700, background:'linear-gradient(135deg,#4f46e5,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>💪🏻 TASKr</h1>
        <p style={{ fontSize:13, color:'#777', margin:'6px 0 20px' }}>Set a new password for your account.</p>
        {done ? (
          <p style={{ fontSize:14, color:'#3a7d44', fontWeight:500 }}>Password updated! Signing you in…</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <input type="password" placeholder="New password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            {error && <div style={{ fontSize:12, color:'#dc2626' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}>{loading ? 'Saving…' : 'Set new password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Change Password Modal ────────────────────────────────────────────────────
function ChangePassword({ onClose }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault(); setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(onClose, 1500)
  }

  const inputStyle = { width:'100%', boxSizing:'border-box', fontSize:14, padding:'10px 12px', border:'0.5px solid #d1d5db', borderRadius:8, outline:'none', fontFamily:'inherit', color:'#111' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ width:'100%', maxWidth:360, background:'white', borderRadius:14, padding:24, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:600, color:'#111' }}>Change Password</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#aaa', lineHeight:1 }}>✕</button>
        </div>
        {done ? (
          <p style={{ fontSize:14, color:'#3a7d44', fontWeight:500 }}>Password updated successfully.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <input type="password" placeholder="New password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inputStyle} />
            {error && <div style={{ fontSize:12, color:'#dc2626' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ fontSize:13, fontWeight:600, padding:'9px 0', border:'none', borderRadius:8, cursor:'pointer', fontFamily:'inherit', background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'white', marginTop:4, opacity: loading ? 0.7 : 1 }}>{loading ? 'Saving…' : 'Update password'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [session, setSession] = useState(null)
  const [authEvent, setAuthEvent] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s); setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setAuthEvent(event); setSession(s); setAuthReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const currentUserName = useCurrentUserName(session)

  // ── Data ──────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([])
  const [domains, setDomains] = useState([])
  const [domainRows, setDomainRows] = useState([]) // full domain records (incl. color/text_color) for the Linear page
  const [projects, setProjects] = useState([])
  const [escalations, setEscalations] = useState([])
  const [notes, setNotes] = useState([])
  const [noteGroups, setNoteGroups] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [calEvents, setCalEvents] = useState([])
  const [calendarList, setCalendarList] = useState([])
  const [qualTemplates, setQualTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => { const saved = localStorage.getItem('taskr-tab'); return (saved && saved !== 'tasks') ? saved : 'linear' })
  const switchTab = t => { setTab(t); localStorage.setItem('taskr-tab', t) }
  const [activeEscalation, setActiveEscalation] = useState(null)
  const [activePopup, setActivePopup] = useState(null) // { entity, type: 'project' | 'escalation' }
  const [form, setForm] = useState(null)
  const [isEdit, setIsEdit] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [todayDropTarget, setTodayDropTarget] = useState(null)
  const [minimized, setMinimized] = useState(() => {
    try { return JSON.parse(localStorage.getItem('taskr-minimized-cols') || '{}') } catch { return {} }
  })
  const [sectionsOpen, setSectionsOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('taskr-sections-open') || '{}') } catch { return {} }
  })
  const toggleSection = key => setSectionsOpen(prev => {
    const next = { ...prev, [key]: prev[key] === false ? true : false }
    localStorage.setItem('taskr-sections-open', JSON.stringify(next))
    return next
  })
  const isSectionOpen = key => sectionsOpen[key] !== false
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  const [mobileCol, setMobileCol] = useState('not_started')
  const [viewMode, setViewMode] = useState('domain') // 'kanban' | 'domain' | 'owner' | 'priority'
  const [filterOwner, setFilterOwner] = useState('all')
  const [ownerFilterOpen, setOwnerFilterOpen] = useState(false)
  const [showCompleted, setShowCompleted] = useState(true)
  const [taskSearch, setTaskSearch] = useState('')
  const [listView, setListView] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const trashRef = useRef(null)
  const [teamData, setTeamData] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { col, taskId, position }

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const loadData = useCallback(async (silent = false) => {
    if (!session) return
    if (!silent) setLoading(true)
    const [{ data: tasksData }, { data: domainsData }, { data: projectsData }, { data: calData }, { data: escalationsData }, { data: notesData }, { data: followUpsData }, { data: teamMembersData }, { data: qualTemplatesData }, { data: noteGroupsData }, { data: calendarsData }] = await Promise.all([
      supabase.from('tasks').select('*').order('sort_order', { ascending: true }),
      supabase.from('domains').select('*').order('sort_order', { ascending: true }),
      supabase.from('projects').select('*').order('sort_order', { ascending: true }),
      supabase.from('calendar_events').select('*').order('created_at', { ascending: true }),
      supabase.from('escalations').select('*').order('sort_order', { ascending: true }),
      supabase.from('notes').select('*').order('updated_at', { ascending: false }),
      supabase.from('follow_ups').select('*').order('created_at', { ascending: true }),
      supabase.from('team_members').select('*').order('sort_order', { ascending: true }),
      supabase.from('qual_templates').select('*').order('created_at', { ascending: true }),
      supabase.from('note_groups').select('*').order('sort_order', { ascending: true }),
      supabase.from('calendars').select('*').order('sort_order', { ascending: true }),
    ])
    if (tasksData) setTasks(tasksData.map(t => ({ ...t, owners: t.owners||['Levi'], notes: t.notes||[], subtasks: t.subtasks||[] })))
    if (domainsData) { setDomains(domainsData.map(d => d.name)); setDomainRows(domainsData) }
    setProjects((projectsData || []).map(p => ({ ...p, notes: p.notes||[], attachments: p.attachments||[], owners: p.owners||[] })))
    if (calData) setCalEvents(calData)
    setEscalations((escalationsData || []).map(e => ({ ...e, notes: e.notes||[], attachments: e.attachments||[], owners: e.owners||[] })))
    if (calendarsData) setCalendarList(calendarsData)
    setNotes(notesData || [])
    setFollowUps(followUpsData || [])
    if (teamMembersData && teamMembersData.length > 0) setTeamData(teamMembersData)
    setQualTemplates(qualTemplatesData || [])
    setNoteGroups(noteGroupsData || [])
    setLoading(false)
  }, [session])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const ch = supabase.channel('app-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, () => loadData())
      .on('postgres_changes', { event:'*', schema:'public', table:'calendar_events' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const initCalendars = useCallback(async () => {
    const { data: existing, error } = await supabase.from('calendars').select('id,type')
    if (error) return
    const hasDefault = existing?.some(c => c.type === 'default')
    const hasHolidays = existing?.some(c => c.type === 'holidays')
    const inserts = []
    if (!hasDefault) inserts.push({ name: 'My Events', color: '#4f46e5', visible: true, type: 'default', sort_order: 0 })
    if (!hasHolidays) inserts.push({ name: 'US Holidays', color: '#16a34a', visible: true, type: 'holidays', sort_order: 1 })
    let holidayCalId = existing?.find(c => c.type === 'holidays')?.id
    if (inserts.length > 0) {
      const { data: created } = await supabase.from('calendars').insert(inserts).select()
      const newHolidayCal = created?.find(c => c.type === 'holidays')
      if (newHolidayCal) holidayCalId = newHolidayCal.id
      await loadData(true)
    }
    if (holidayCalId) {
      const thisYear = new Date().getFullYear()
      const { data: existingHols } = await supabase.from('calendar_events')
        .select('start_date').eq('calendar_id', holidayCalId)
        .gte('start_date', `${thisYear}-01-01`).lte('start_date', `${thisYear + 1}-12-31`)
      const existingDates = new Set((existingHols || []).map(h => h.start_date))
      const toAdd = [
        ...generateUSHolidays(thisYear, holidayCalId),
        ...generateUSHolidays(thisYear + 1, holidayCalId),
      ].filter(h => !existingDates.has(h.start_date))
      if (toAdd.length > 0) {
        await supabase.from('calendar_events').insert(toAdd)
        await loadData(true)
      }
    }
  }, [loadData])

  useEffect(() => { if (session) initCalendars() }, [session, initCalendars])

  const toggleCalendar = async (id, visible) => {
    setCalendarList(prev => prev.map(c => c.id === id ? { ...c, visible } : c))
    await supabase.from('calendars').update({ visible }).eq('id', id)
  }

  const buildTaskPayload = data => {
    const payload = {
      title: data.title, status: 'active', domain: data.domain||'',
      owners: data.owners||(currentUserName ? [currentUserName] : ['Levi']), due: data.due||'', priority: data.priority||'',
      color: data.color||'', substatus: data.substatus||'not_started',
      notes: data.notes||[], today: !!data.today, subtasks: data.subtasks||[], attachments: data.attachments||[],
      updated_at: new Date().toISOString(),
    }
    if (data.project_id !== undefined) payload.project_id = data.project_id || null
    if (data.escalation_id !== undefined) payload.escalation_id = data.escalation_id || null
    return payload
  }

  const saveTask = async data => {
    const payload = buildTaskPayload(data)
    let error
    if (isEdit && form?.id) {
      ({ error } = await supabase.from('tasks').update(payload).eq('id', form.id))
    } else {
      const maxOrder = tasks.length ? Math.max(...tasks.map(t => t.sort_order||0)) : 0;
      ({ error } = await supabase.from('tasks').insert({ ...payload, sort_order: maxOrder+1 }))
    }
    if (error) { console.error('[TASKr] saveTask error', error); return }
    setForm(null)
    await loadData()
  }

  const saveTaskSilent = async (data, editId = null) => {
    const payload = buildTaskPayload(data)
    if (editId) {
      await supabase.from('tasks').update(payload).eq('id', editId)
    } else {
      const maxOrder = tasks.length ? Math.max(...tasks.map(t => t.sort_order||0)) : 0
      await supabase.from('tasks').insert({ ...payload, sort_order: maxOrder+1 })
    }
    await loadData(true)
  }

  const deleteTask = async id => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) { console.error('[TASKr] deleteTask error', error); return }
    setForm(null); await loadData()
  }

  const deleteTaskSilent = async id => {
    await supabase.from('tasks').delete().eq('id', id)
    await loadData(true)
  }

  const addProject = async (title, type = 'project', templateId = null) => {
    const tpl = type === 'bundle' && templateId ? qualTemplates.find(t => t.id === templateId) : null
    const { data: proj, error } = await supabase.from('projects').insert({ title, type, template_name: tpl?.name || null }).select().single()
    if (error || !proj) { console.error('[TASKr] addProject error', error); return }
    if (tpl?.tasks?.length) {
        const inserts = tpl.tasks.map((t, i) => ({
          title: t.title, status: 'active', substatus: 'not_started',
          project_id: proj.id, notes: [], attachments: [], owners: ['Levi'],
          subtasks: (t.subtasks || []).map((s, j) => ({ id:`st${i}${j}`, title:s, done:false })),
          sort_order: i + 1, updated_at: new Date().toISOString()
        }))
        await supabase.from('tasks').insert(inserts)
      }
    await loadData(true)
  }

  const saveProject = async (data, id) => {
    const payload = { title:data.title, status:data.status||'active', domain:data.domain||'', owners:data.owners||['Levi'], due:data.due||'', priority:data.priority||'', color:data.color||'', substatus:data.substatus||'', notes:data.notes||[], attachments:data.attachments||[] }
    let { error } = await supabase.from('projects').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) await supabase.from('projects').update(payload).eq('id', id) // fallback if updated_at column not yet added
    await supabase.from('tasks').update({ color: data.color||'' }).eq('project_id', id)
    await loadData(true)
  }

  const deleteProject = async id => {
    await supabase.from('projects').delete().eq('id', id)
    if (activeProject === id) setActiveProject(null)
    await loadData()
  }

  const addEscalation = async title => {
    await supabase.from('escalations').insert({ title })
    await loadData(true)
  }

  const addDomain = async name => {
    const title = name.trim()
    if (!title || domains.includes(title)) return
    const maxOrder = domainRows.length ? Math.max(...domainRows.map(d => d.sort_order||0)) : 0
    await supabase.from('domains').insert({ name: title, sort_order: maxOrder+1 })
    await loadData(true)
  }

  // patch: { color?, text_color? } — either may be null to reset to default
  const updateDomainMeta = async (name, patch) => {
    const row = domainRows.find(d => d.name === name)
    if (!row) return
    await supabase.from('domains').update(patch).eq('id', row.id)
    await loadData(true)
  }

  const saveEscalation = async (data, id) => {
    const payload = { title:data.title, status:data.status||'active', domain:data.domain||'', owners:data.owners||['Levi'], due:data.due||'', priority:data.priority||'', color:data.color||'', substatus:data.substatus||'', notes:data.notes||[], attachments:data.attachments||[] }
    let { error } = await supabase.from('escalations').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) await supabase.from('escalations').update(payload).eq('id', id) // fallback if updated_at column not yet added
    await supabase.from('tasks').update({ color: data.color||'' }).eq('escalation_id', id)
    await loadData(true)
  }

  const deleteEscalation = async id => {
    await supabase.from('escalations').delete().eq('id', id)
    if (activeEscalation === id) setActiveEscalation(null)
    await loadData(true)
  }

  const saveNote = async (data, id) => {
    const body = data.body || ''
    const payload = { title: data.title, body, updated_at: new Date().toISOString() }
    if ('group_id' in data) payload.group_id = data.group_id ?? null
    let newId = null
    if (id) {
      const { error } = await supabase.from('notes').update(payload).eq('id', id)
      if (error) { console.error('[TASKr] saveNote error', error); return null }
    } else {
      const { data: ins, error } = await supabase.from('notes').insert(payload).select('id').single()
      if (error) { console.error('[TASKr] saveNote error', error); return null }
      newId = ins?.id
    }
    await loadData(true)
    return newId
  }

  const deleteNote = async id => {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) { console.error('[TASKr] deleteNote error', error); return }
    await loadData(true)
  }

  const saveNoteGroup = async name => {
    const maxOrder = noteGroups.length ? Math.max(...noteGroups.map(g => g.sort_order||0)) : 0
    const { data: grp, error } = await supabase.from('note_groups').insert({ name, sort_order: maxOrder+1 }).select().single()
    if (error) { console.error('[TASKr] saveNoteGroup error', error); return null }
    await loadData(true)
    return grp?.id
  }

  const renameNoteGroup = async (id, name) => {
    await supabase.from('note_groups').update({ name }).eq('id', id)
    await loadData(true)
  }

  const deleteNoteGroup = async (id, deleteNotes) => {
    if (deleteNotes) {
      await supabase.from('notes').delete().eq('group_id', id)
    } else {
      await supabase.from('notes').update({ group_id: null }).eq('group_id', id)
    }
    await supabase.from('note_groups').delete().eq('id', id)
    await loadData(true)
  }

  const addFollowUp = async (text, person) => {
    const { error } = await supabase.from('follow_ups').insert({ text, person, done: false })
    if (error) { console.error('[TASKr] addFollowUp error', error); return }
    await loadData(true)
  }
  const toggleFollowUp = async (id, done) => {
    const { error } = await supabase.from('follow_ups').update({ done }).eq('id', id)
    if (error) { console.error('[TASKr] toggleFollowUp error', error); return }
    await loadData(true)
  }
  const deleteFollowUp = async id => {
    const { error } = await supabase.from('follow_ups').delete().eq('id', id)
    if (error) { console.error('[TASKr] deleteFollowUp error', error); return }
    await loadData(true)
  }
  const updateFollowUp = async (id, text) => {
    const { error } = await supabase.from('follow_ups').update({ text }).eq('id', id)
    if (error) { console.error('[TASKr] updateFollowUp error', error); return }
    await loadData(true)
  }

  const restoreTask = async (task) => {
    const subtasks = (task.subtasks||[]).map(s => ({ ...s, done: false }))
    await supabase.from('tasks').update({ substatus: 'not_started', subtasks, updated_at: new Date().toISOString() }).eq('id', task.id)
    await loadData()
  }

  const moveTask = async (id, newSubstatus) => {
    await supabase.from('tasks').update({ substatus: newSubstatus, updated_at: new Date().toISOString() }).eq('id', id)
    await loadData()
  }

  const quickComplete = async (id, complete) => {
    const prior = tasks.find(t => t.id === id)
    const substatus = complete ? 'complete' : (prior?.substatus && prior.substatus !== 'complete' ? prior.substatus : 'not_started')
    const updated_at = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === id ? { ...t, substatus, updated_at } : t)) // optimistic — no full reload
    await supabase.from('tasks').update({ substatus, updated_at }).eq('id', id)
  }

  // Apply a field patch to many tasks at once (used by the Linear page drag-to-section)
  const updateTasksFields = async (ids, patch) => {
    if (!ids?.length || !patch) return
    const updated_at = new Date().toISOString()
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...patch, updated_at } : t)) // optimistic
    await Promise.all(ids.map(id => supabase.from('tasks').update({ ...patch, updated_at }).eq('id', id)))
  }


  const toggleToday = async (id, todayVal) => {
    const updated_at = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === id ? { ...t, today: todayVal, updated_at } : t)) // optimistic — no full reload
    await supabase.from('tasks').update({ today: todayVal, updated_at }).eq('id', id)
  }

  const toggleSubtask = async (taskId, subtaskId, done) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const subtasks = (task.subtasks||[]).map(s => s.id===subtaskId?{...s,done}:s)
    const updated_at = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks, updated_at } : t)) // optimistic — no full reload
    await supabase.from('tasks').update({ subtasks, updated_at }).eq('id', taskId)
  }

  const reorderTask = async (dragId, targetId, position, col) => {
    const colTasks = tasks.filter(t => (t.substatus||(t.status==='done'?'complete':'not_started')) === col && t.substatus !== 'canceled').sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
    const dragIdx = colTasks.findIndex(t => t.id === dragId)
    const targetIdx = colTasks.findIndex(t => t.id === targetId)
    if (dragIdx === -1) return
    const moved = colTasks.splice(dragIdx < 0 ? colTasks.length : dragIdx, dragIdx >= 0 ? 1 : 0)
    const insertAt = position === 'before' ? targetIdx : targetIdx + 1
    const adjustedInsert = dragIdx < targetIdx ? insertAt - 1 : insertAt
    colTasks.splice(Math.max(0, adjustedInsert), 0, ...moved)
    const newOrders = Object.fromEntries(colTasks.map((t, i) => [t.id, i+1]))
    setTasks(prev => prev.map(t => newOrders[t.id] !== undefined ? { ...t, sort_order: newOrders[t.id], substatus: col } : t))
    await Promise.all(colTasks.map((t, i) => supabase.from('tasks').update({ sort_order: i+1, substatus: col, updated_at: new Date().toISOString() }).eq('id', t.id)))
  }

  const reorderTodayTask = async (dragId, targetId, position) => {
    const list = tasks.filter(t => t.today && t.substatus !== 'complete').sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
    const dragIdx = list.findIndex(t => t.id === dragId)
    const targetIdx = list.findIndex(t => t.id === targetId)
    if (dragIdx === -1) return
    const moved = list.splice(dragIdx, 1)
    const insertAt = position === 'before' ? targetIdx : targetIdx + 1
    const adjustedInsert = dragIdx < targetIdx ? insertAt - 1 : insertAt
    list.splice(Math.max(0, adjustedInsert), 0, ...moved)
    const newOrders = Object.fromEntries(list.map((t, i) => [t.id, i+1]))
    setTasks(prev => prev.map(t => newOrders[t.id] !== undefined ? { ...t, sort_order: newOrders[t.id] } : t))
    await Promise.all(list.map((t, i) => supabase.from('tasks').update({ sort_order: i+1, updated_at: new Date().toISOString() }).eq('id', t.id)))
  }

  const reorderProject = async (dragId, targetId, position) => {
    const list = [...projects].sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
    const dragIdx = list.findIndex(p => p.id === dragId)
    const targetIdx = list.findIndex(p => p.id === targetId)
    if (dragIdx === -1) return
    const moved = list.splice(dragIdx, 1)
    const insertAt = position === 'before' ? targetIdx : targetIdx + 1
    const adjustedInsert = dragIdx < targetIdx ? insertAt - 1 : insertAt
    list.splice(Math.max(0, adjustedInsert), 0, ...moved)
    setProjects(list.map((p, i) => ({ ...p, sort_order: i+1 })))
    await Promise.all(list.map((p, i) => supabase.from('projects').update({ sort_order: i+1 }).eq('id', p.id)))
  }

  const reorderEscalation = async (dragId, targetId, position) => {
    const list = [...escalations].sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
    const dragIdx = list.findIndex(e => e.id === dragId)
    const targetIdx = list.findIndex(e => e.id === targetId)
    if (dragIdx === -1) return
    const moved = list.splice(dragIdx, 1)
    const insertAt = position === 'before' ? targetIdx : targetIdx + 1
    const adjustedInsert = dragIdx < targetIdx ? insertAt - 1 : insertAt
    list.splice(Math.max(0, adjustedInsert), 0, ...moved)
    setEscalations(list.map((e, i) => ({ ...e, sort_order: i+1 })))
    await Promise.all(list.map((e, i) => supabase.from('escalations').update({ sort_order: i+1 }).eq('id', e.id)))
  }

  const drop = async (id, col) => {
    if (!id) return
    if (col === 'today') {
      if (todayDropTarget?.taskId) {
        await reorderTodayTask(id, todayDropTarget.taskId, todayDropTarget.position)
      } else {
        await toggleToday(id, true)
      }
      setTodayDropTarget(null)
    } else {
      if (dropTarget && dropTarget.taskId) {
        await reorderTask(id, dropTarget.taskId, dropTarget.position, col)
      } else {
        await moveTask(id, col)
      }
    }
    setDraggingId(null); setOverCol(null); setDropTarget(null)
  }

  const removeFromToday = async id => { await toggleToday(id, false) }
  const toggleMin = key => setMinimized(m => {
    const next = { ...m, [key]: !m[key] }
    localStorage.setItem('taskr-minimized-cols', JSON.stringify(next))
    return next
  })

  const handleSelectProject = id => {
    setActiveProject(prev => prev === id ? null : id)
    setActiveEscalation(null)
  }
  const handleSelectEscalation = id => {
    setActiveEscalation(prev => prev === id ? null : id)
    setActiveProject(null)
  }
  const openAddTask = (extra = {}) => {
    setForm({ title:'', status:'active', domain:'', owners:['Levi'], due:'', priority:'', color:'', notes:[], today:false, substatus:'not_started', subtasks:[], attachments:[], project_id:null, escalation_id:null, ...extra })
    setIsEdit(false)
  }

  const memberNames = teamData.length ? teamData.filter(m => m.can_assign_tasks !== false).map(m => m.name) : MEMBERS
  const followUpPeople = teamData.length ? teamData.filter(m => m.can_follow_up !== false).map(m => m.name) : DEFAULT_FOLLOW_UP_PEOPLE

  // Search: title-first cascade. Show title matches if any; else subtask matches; else notes matches.
  const searchMatchIds = (() => {
    const q = taskSearch.trim().toLowerCase()
    if (!q) return null
    const titleHits = tasks.filter(t => t.title?.toLowerCase().includes(q))
    if (titleHits.length) return new Set(titleHits.map(t => t.id))
    const subtaskHits = tasks.filter(t => (t.subtasks||[]).some(s => s.title?.toLowerCase().includes(q)))
    if (subtaskHits.length) return new Set(subtaskHits.map(t => t.id))
    const noteHits = tasks.filter(t => (t.notes||[]).some(n => n.text?.toLowerCase().includes(q)))
    return new Set(noteHits.map(t => t.id))
  })()

  const filteredTasks = (activeProject
    ? tasks.filter(t => t.project_id === activeProject)
    : activeEscalation
      ? tasks.filter(t => t.escalation_id === activeEscalation)
      : tasks
  ).filter(t => filterOwner === 'all' || (t.owners||['Levi']).includes(filterOwner))
   .filter(t => t.substatus !== 'canceled')
   .filter(t => showCompleted || (t.substatus || (t.status === 'done' ? 'complete' : 'not_started')) !== 'complete')
   .filter(t => !searchMatchIds || searchMatchIds.has(t.id))

  const taskSubstatus = t => t.substatus || (t.status === 'done' ? 'complete' : 'not_started')
  const getColTasks = colKey => filteredTasks.filter(t => taskSubstatus(t) === colKey).sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
  const entityMap = Object.fromEntries([
    ...projects.map(p => [p.id, { name: p.title, type: 'project', color: p.color, notes: p.notes }]),
    ...escalations.map(e => [e.id, { name: e.title, type: 'escalation', color: e.color, notes: e.notes }]),
  ])

  const searchQ = taskSearch.trim().toLowerCase()
  const ownerEscalations = filterOwner === 'all' ? escalations : escalations.filter(e => (e.owners||[]).includes(filterOwner))
  const ownerProjects    = filterOwner === 'all' ? projects    : projects.filter(p => (p.owners||[]).includes(filterOwner))
  const visibleEscalations = ownerEscalations.filter(e =>
    !searchQ || e.title?.toLowerCase().includes(searchQ) || filteredTasks.some(t => t.escalation_id === e.id)
  )
  const visibleProjects = ownerProjects.filter(p =>
    !searchQ || p.title?.toLowerCase().includes(searchQ) || filteredTasks.some(t => t.project_id === p.id)
  )

  if (!authReady) return (
    <div style={{ fontFamily:'system-ui,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#888', fontSize:14 }}>
      Loading TASKr...
    </div>
  )
  if (authEvent === 'PASSWORD_RECOVERY') return <SetNewPasswordScreen onDone={() => setAuthEvent(null)} />
  if (!session) return <LoginScreen />

  if (loading) return (
    <div style={{ fontFamily:'system-ui,sans-serif', display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#888', fontSize:14 }}>
      Loading TASKr...
    </div>
  )

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', padding:isMobile?'0.75rem':'1.25rem 1.5rem', maxWidth:1400, margin:'0 auto' }}>
      {showChangePassword && <ChangePassword onClose={() => setShowChangePassword(false)} />}
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:isMobile?'0.9rem':'1.25rem', paddingBottom:isMobile?'0.75rem':'1rem', borderBottom:'0.5px solid #e5e5e5' }}>
        <h1 style={{ fontSize:isMobile?18:22, fontWeight:700, margin:0, letterSpacing:'-0.5px', whiteSpace:'nowrap', background:'linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a855f7 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>💪🏻 TASKr</h1>
        <div style={{ display:'flex', alignItems:'center', gap:isMobile?6:10, minWidth:0 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:isMobile?1:4 }}>
            <span style={{ fontSize:isMobile?11:12, color:'#7c3aed', whiteSpace:'nowrap' }}>{new Date().toLocaleDateString('en-US', isMobile ? { weekday:'short', month:'short', day:'numeric' } : { weekday:'long', month:'short', day:'numeric', year:'numeric' })}</span>
            <span style={{ fontSize:10, color:'#c4b5fd', whiteSpace:'nowrap' }}>Live · Supabase</span>
          </div>
          {/* Profile menu */}
          <div style={{ position:'relative' }}>
            <button onClick={() => setShowProfileMenu(m => !m)}
              style={{ fontSize:12, padding:'6px 12px', border:'0.5px solid #c4b5fd', borderRadius:10, background:'#ede9fe', color:'#7c3aed', cursor:'pointer', fontFamily:'inherit', fontWeight:500, maxWidth:isMobile?110:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {currentUserName || session.user.email.split('@')[0]} ▾
            </button>
            {showProfileMenu && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, minWidth:160, overflow:'hidden' }}>
                <button onClick={() => { setShowChangePassword(true); setShowProfileMenu(false) }}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', color:'#333', fontFamily:'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f5f5f3'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  Change Password
                </button>
                <button onClick={() => supabase.auth.signOut()}
                  style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', color:'#A32D2D', fontFamily:'inherit', borderTop:'0.5px solid #f0f0f0' }}
                  onMouseEnter={e => e.currentTarget.style.background='#fff5f5'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Menu + World Clock — unified gradient strip */}
      <div style={{ display:'flex', flexDirection:isMobile?'column':'row', alignItems:'stretch', background:'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a855f7 100%)', borderRadius:14, marginBottom:'1.25rem', overflow:'hidden' }}>
        <div style={{ display:'flex', gap:2, padding:5, flexShrink:0, ...(isMobile ? { width:'100%' } : {}) }}>
          {[
            { key:'briefing', label:'Briefing', Icon:Newspaper },
            { key:'linear', label:'Tasks', Icon:LayoutList },
            { key:'followups', label:'Follow Ups', Icon:RefreshCw },
            { key:'notes', label:'Notes', Icon:NotebookPen },
            { key:'calendar', label:'Calendar', Icon:CalendarDays },
            { key:'settings', label:'Settings', Icon:Settings },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => switchTab(key)}
              style={{ display:'flex', flexDirection:isMobile?'column':'row', alignItems:'center', justifyContent:'center', gap:isMobile?3:6, fontSize:isMobile?10:13, padding:isMobile?'8px 2px':'7px 14px', cursor:'pointer', background:tab===key?'rgba(255,255,255,0.18)':'transparent', border:'none', borderRadius:10, color:tab===key?'#fff':'rgba(255,255,255,0.6)', fontWeight:tab===key?600:400, whiteSpace:'nowrap', flexShrink:0, flex:isMobile?1:'none', minWidth:0, transition:'background 0.15s, color 0.15s' }}>
              <Icon size={isMobile?18:15} strokeWidth={tab===key?2.2:1.8} />
              {isMobile ? label.split(' ')[0] : label}
            </button>
          ))}
        </div>
        <div style={{ ...(isMobile ? { height:'1px', margin:'0 8px' } : { width:'1px', margin:'8px 0' }), background:'rgba(255,255,255,0.2)', flexShrink:0 }} />
        <WorldClock style={{ flex:1, minWidth:0, background:'rgba(0,0,0,0.12)' }} />
      </div>

      {/* ── Briefing ── */}
      {tab === 'briefing' && <BriefingTab />}

      {/* ── Linear task mockup ── */}
      {tab === 'linear' && (
        <TaskLinearMockup tasks={tasks} entityMap={entityMap} domains={domains}
          domainMeta={Object.fromEntries(domainRows.map(d => [d.name, { color: d.color, text_color: d.text_color }]))}
          memberNames={memberNames} isMobile={isMobile}
          escalations={visibleEscalations}
          onEdit={t => { setForm({...t}); setIsEdit(true) }} onComplete={quickComplete} onUpdateTasks={updateTasksFields}
          onRestoreTask={restoreTask} onDeleteTask={deleteTaskSilent}
          onAddTask={prefill => { setForm({ status:'active', substatus:'not_started', ...prefill }); setIsEdit(false) }}
          onOpenEscalation={e => setActivePopup({ entity:e, type:'escalation' })}
          onOpenProject={id => { const p = projects.find(x => x.id === id); if (p) setActivePopup({ entity:p, type:'project' }) }}
          onAddEscalation={addEscalation} onOpenClassic={() => switchTab('tasks')}
          onAddDomain={addDomain} onUpdateDomainMeta={updateDomainMeta} />
      )}

      {/* ── Task Board (classic — legacy view, kept behind a button on the Tasks page) ── */}
      {tab === 'tasks' && (
        <>
          {/* View controls */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:isMobile?'flex-start':'flex-end', marginBottom:12, gap:6, flexWrap:'wrap' }}>
            <button onClick={() => switchTab('linear')} title="Back to the Tasks page"
              style={{ fontSize:11, padding:'4px 10px', borderRadius:10, cursor:'pointer', border:'0.5px solid #c4b5fd', background:'white', color:'#7c3aed', height:28, marginRight:'auto' }}>
              ← Back to Tasks
            </button>
            {/* View mode pills */}
            <div style={{ display:'flex', gap:1, background:'#ede9fe', borderRadius:10, padding:3, maxWidth:'100%', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              {[{ k:'kanban', l:'Kanban' }, { k:'domain', l:'Domain' }, { k:'owner', l:'Owner' }, { k:'priority', l:'Priority' }].map(v => (
                <button key={v.k} onClick={() => setViewMode(v.k)}
                  style={{ fontSize:11, padding:'4px 10px', border:'none', background:viewMode===v.k?'linear-gradient(135deg,#4f46e5,#7c3aed)':'transparent', color:viewMode===v.k?'white':'#7c3aed', fontWeight:viewMode===v.k?600:400, cursor:'pointer', borderRadius:8, transition:'background 0.15s, color 0.15s', whiteSpace:'nowrap' }}>
                  {v.l}
                </button>
              ))}
            </div>
            {/* Owner filter */}
            <div style={{ position:'relative' }}>
              <button onClick={() => setOwnerFilterOpen(o => !o)} title="Filter by owner"
                style={{ fontSize:11, background: filterOwner!=='all' ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'white', border: filterOwner!=='all' ? 'none' : '0.5px solid #c4b5fd', borderRadius:10, padding:'4px 10px', cursor:'pointer', height:28, color: filterOwner!=='all' ? 'white' : '#7c3aed', transition:'background 0.15s, color 0.15s', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
                <span>{filterOwner === 'all' ? '👥 All' : filterOwner}</span>
                <span style={{ fontSize:9, opacity:0.7 }}>▾</span>
              </button>
              {ownerFilterOpen && (
                <>
                  <div onClick={() => setOwnerFilterOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
                  <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, minWidth:150, maxHeight:280, overflowY:'auto', padding:4 }}>
                    {[{ v:'all', l:'👥 All' }, ...memberNames.map(n => ({ v:n, l:n }))].map(opt => (
                      <button key={opt.v} onClick={() => { setFilterOwner(opt.v); setOwnerFilterOpen(false) }}
                        style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', padding:'7px 10px', background: filterOwner===opt.v ? '#ede9fe' : 'none', border:'none', borderRadius:7, cursor:'pointer', fontSize:12, color: filterOwner===opt.v ? '#7c3aed' : '#444', fontWeight: filterOwner===opt.v ? 600 : 400, fontFamily:'inherit' }}
                        onMouseEnter={e => { if (filterOwner!==opt.v) e.currentTarget.style.background='#f5f5f3' }}
                        onMouseLeave={e => { if (filterOwner!==opt.v) e.currentTarget.style.background='none' }}>
                        {opt.v !== 'all' && <OwnerPip name={opt.v} />}
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* List toggle */}
            <button onClick={() => setListView(v => !v)} title={listView ? 'Board view' : 'List view'}
              style={{ fontSize:11, background:listView?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', border:listView?'none':'0.5px solid #c4b5fd', borderRadius:10, padding:'4px 10px', cursor:'pointer', height:28, color:listView?'white':'#7c3aed', transition:'background 0.15s, color 0.15s' }}>
              ☰ List
            </button>
            {/* Done toggle */}
            <button onClick={() => setShowCompleted(v => !v)} title={showCompleted ? 'Hide completed' : 'Show completed'}
              style={{ fontSize:11, background:showCompleted?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', border:showCompleted?'none':'0.5px solid #c4b5fd', borderRadius:10, padding:'4px 10px', cursor:'pointer', height:28, color:showCompleted?'white':'#7c3aed', transition:'background 0.15s, color 0.15s' }}>
              ✓ Done
            </button>
            {/* Trash */}
            <button onClick={() => { setShowTrash(v => { const next=!v; if(next) setTimeout(()=>trashRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50); return next; }) }} title="Trash"
              style={{ position:'relative', background:showTrash?'linear-gradient(135deg,#4f46e5,#7c3aed)':'white', border:showTrash?'none':'0.5px solid #c4b5fd', borderRadius:10, padding:'4px 10px', cursor:'pointer', height:28, display:'flex', alignItems:'center', color:showTrash?'white':'#7c3aed' }}>
              <span style={{ fontSize:10 }}>🗑️</span>
              {tasks.filter(t=>t.substatus==='canceled').length > 0 && (
                <span style={{ position:'absolute', top:-4, right:-4, background:'#ef4444', color:'white', borderRadius:'50%', fontSize:9, width:14, height:14, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, lineHeight:1 }}>
                  {tasks.filter(t=>t.substatus==='canceled').length}
                </span>
              )}
            </button>
            {/* Search — far right */}
            <div style={{ position:'relative', display:'flex', alignItems:'center', ...(isMobile ? { flex:'1 1 100%' } : {}) }}>
              <span style={{ position:'absolute', left:8, fontSize:12, color:'#a78bfa', pointerEvents:'none' }}>🔍</span>
              <input type="text" value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                placeholder="Search tasks…"
                style={{ fontSize:11, padding:'4px 8px 4px 26px', border:'0.5px solid #c4b5fd', borderRadius:10, background:'white', height:28, outline:'none', width:isMobile?'100%':160, color:'#333', boxSizing:'border-box' }} />
              {taskSearch && (
                <button onClick={() => setTaskSearch('')} style={{ position:'absolute', right:6, fontSize:12, color:'#a78bfa', background:'none', border:'none', cursor:'pointer', padding:0, lineHeight:1 }}>✕</button>
              )}
            </div>
          </div>

          {!showTrash && (<>
          {!listView && <>
          {/* Today + Escalations row */}
          <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:12, alignItems:'stretch', marginBottom:16 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <TodayStrip tasks={filteredTasks} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null); setTodayDropTarget(null) }} draggingId={draggingId} onDrop={drop} onDragOver={setOverCol} onDragLeave={() => setOverCol(null)} isOver={overCol==='today'} onRemove={removeFromToday} onAdd={() => { setForm({ today:true, status:'active', substatus:'not_started' }); setIsEdit(false) }} onComplete={quickComplete} entityMap={entityMap} isOpen={isSectionOpen('today')} onToggle={() => toggleSection('today')} onTaskDragOver={(taskId, pos) => setTodayDropTarget({ taskId, position: pos })} todayDropTarget={todayDropTarget} />
            </div>
            <div style={{ flex: isMobile ? '1 1 auto' : '0 0 432px', minWidth:0, background:'#ede9fe', border:'0.5px solid #c4b5fd', borderRadius:12, padding:12, alignSelf: isMobile ? 'stretch' : (isSectionOpen('escalations') ? 'stretch' : 'flex-start') }}>
              <EscalationsSection escalations={visibleEscalations} tasks={tasks} onAdd={addEscalation} onOpen={e => setActivePopup({ entity:e, type:'escalation' })} onReorder={reorderEscalation} isOpen={isSectionOpen('escalations')} onToggle={() => toggleSection('escalations')} />
            </div>
          </div>

          {/* Projects section */}
          <div style={{ marginBottom:16, background:'#f7f7f5', borderRadius:12, padding:12 }}>
            <button onClick={() => toggleSection('projects')} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'none', border:'none', cursor:'pointer', padding: isSectionOpen('projects') ? '0 0 8px 0' : 0, color:'#888' }}>
              <span style={{ fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em' }}>Projects & Bundles</span>
              <span style={{ fontSize:11 }}>{isSectionOpen('projects') ? '▴' : '▾'}</span>
            </button>
            {isSectionOpen('projects') && <ProjectsSection projects={visibleProjects} tasks={tasks} onAdd={addProject} onOpen={p => setActivePopup({ entity:p, type:'project' })} templates={qualTemplates} noBorder onReorder={reorderProject} />}
          </div>

          {/* ── Tasks kanban ── */}
          <button onClick={() => toggleSection('kanban')} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'none', border:'none', cursor:'pointer', padding:'0 0 10px 0', color:'#888' }}>
            <span style={{ fontSize:11, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.06em' }}>Tasks</span>
            <span style={{ fontSize:11 }}>{isSectionOpen('kanban') ? '▴' : '▾'}</span>
          </button>

          {isSectionOpen('kanban') && viewMode === 'domain' && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', overflowX:'auto' }}>
              {[...domains.map(d => ({ key:d, lbl:d })), { key:'', lbl:'No domain' }].map(domCol => {
                const ct = filteredTasks.filter(t => (t.domain||'') === domCol.key)
                if (ct.length === 0 && domCol.key !== '') return null
                return (
                  <div key={domCol.key} style={{ flex:'0 0 220px', background:'#f7f7f5', borderRadius:12, padding:12, minHeight:180 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:500, color:domCol.key?'#0C447C':'#aaa', textTransform:'uppercase', letterSpacing:'0.06em' }}>{domCol.lbl}</span>
                      <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                    </div>
                    <button onClick={() => { setForm({ domain: domCol.key, status:'active' }); setIsEdit(false) }} style={{ width:'100%', marginBottom:8, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>
                      + Add task
                    </button>
                    {ct.map(t => (
                      <div key={t.id} style={{ marginBottom:8 }}>
                        <TaskCard task={t} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} onComplete={quickComplete} entityMap={entityMap} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {isSectionOpen('kanban') && viewMode === 'owner' && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', overflowX:'auto' }}>
              {[...memberNames.map(m => ({ key:m, lbl:m })), { key:'', lbl:'Unassigned' }].map(ownerCol => {
                const ct = filteredTasks.filter(t => {
                  const owners = t.owners || []
                  return ownerCol.key ? owners.includes(ownerCol.key) : owners.length === 0
                })
                if (ct.length === 0 && ownerCol.key !== '') return null
                return (
                  <div key={ownerCol.key || '__unassigned'} style={{ flex:'0 0 220px', background:'#f7f7f5', borderRadius:12, padding:12, minHeight:180 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:500, color:ownerCol.key?'#085041':'#aaa', textTransform:'uppercase', letterSpacing:'0.06em' }}>{ownerCol.lbl}</span>
                      <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                    </div>
                    <button onClick={() => { setForm({ owners: ownerCol.key ? [ownerCol.key] : [], status:'active' }); setIsEdit(false) }} style={{ width:'100%', marginBottom:8, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>
                      + Add task
                    </button>
                    {ct.map(t => (
                      <div key={t.id} style={{ marginBottom:8 }}>
                        <TaskCard task={t} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} onComplete={quickComplete} entityMap={entityMap} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {isSectionOpen('kanban') && viewMode === 'priority' && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', overflowX:'auto' }}>
              {[{ key:'high', lbl:'High' }, { key:'', lbl:'Normal' }].map(priCol => {
                const ct = filteredTasks.filter(t => (t.priority||'') === priCol.key)
                return (
                  <div key={priCol.key || '__normal'} style={{ flex:'0 0 220px', background:'#f7f7f5', borderRadius:12, padding:12, minHeight:180 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:500, color:priCol.key?'#791F1F':'#aaa', textTransform:'uppercase', letterSpacing:'0.06em' }}>{priCol.lbl}</span>
                      <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                    </div>
                    <button onClick={() => { setForm({ priority: priCol.key, status:'active' }); setIsEdit(false) }} style={{ width:'100%', marginBottom:8, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>
                      + Add task
                    </button>
                    {ct.map(t => (
                      <div key={t.id} style={{ marginBottom:8 }}>
                        <TaskCard task={t} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} onComplete={quickComplete} entityMap={entityMap} />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
          </>}

          {/* ── List / Table view ── */}
          {listView && (() => {
            const COL_GRID = isMobile ? '20px 1fr auto auto' : '24px 1fr 110px 90px 80px 80px'
            const TableHeader = () => (
              <div style={{ display:'grid', gridTemplateColumns:COL_GRID, gap:isMobile?6:0, background:'#f7f7f5', borderBottom:'0.5px solid #e5e5e5', padding:'6px 12px', alignItems:'center' }}>
                {(isMobile ? ['', 'Task', 'Status', 'Due'] : ['', 'Task', 'Status', 'Domain', 'Due', 'Owner']).map((h, i) => (
                  <span key={i} style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</span>
                ))}
              </div>
            )
            const TaskRow = ({ t, last }) => {
              const ss = subStyle(taskSubstatus(t))
              const owners = t.owners || []
              return (
                <div onClick={() => { setForm({...t}); setIsEdit(true) }}
                  style={{ display:'grid', gridTemplateColumns:COL_GRID, gap:isMobile?6:0, padding:'8px 12px', alignItems:'center', borderBottom: last ? 'none' : '0.5px solid #f0f0f0', cursor:'pointer', background:'white' }}
                  onMouseEnter={e => e.currentTarget.style.background='#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background='white'}>
                  <div onClick={e => { e.stopPropagation(); quickComplete(t.id, taskSubstatus(t) !== 'complete') }} style={{ width:14, height:14, borderRadius:'50%', border:`1.5px solid ${ss.border||'#ccc'}`, background: taskSubstatus(t)==='complete'?(ss.bg||'#eee'):'white', cursor:'pointer', flexShrink:0 }} />
                  <span style={{ fontSize:13, color:taskSubstatus(t)==='complete'?'#aaa':'#111', textDecoration:taskSubstatus(t)==='complete'?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>
                    {t.today && <span style={{ fontSize:9, color:'#E24B4A', marginRight:5, fontWeight:600 }}>TODAY</span>}
                    {t.title}
                  </span>
                  <span style={{ fontSize:10, background:ss.bg, color:ss.tc, border:`0.5px solid ${ss.border}`, borderRadius:20, padding:'2px 7px', whiteSpace:'nowrap', width:'fit-content' }}>{ss.label||'—'}</span>
                  {!isMobile && <span style={{ fontSize:10, color:t.domain?'#0C447C':'#ccc', background:t.domain?'#E6F1FB':'transparent', border:t.domain?'0.5px solid #85B7EB':'none', borderRadius:20, padding:t.domain?'2px 7px':'0', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.domain||'—'}</span>}
                  <span style={{ fontSize:11, color:t.due?(t.due<today()?'#c0392b':'#888'):'#ccc', whiteSpace:'nowrap' }}>{t.due||'—'}</span>
                  {!isMobile && <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                    {owners.length ? owners.map(o => <OwnerPip key={o} name={o} />) : <span style={{ fontSize:11, color:'#ccc' }}>—</span>}
                  </div>}
                </div>
              )
            }
            const GroupHeader = ({ label, type, count }) => (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'#fafafa', borderBottom:'0.5px solid #e5e5e5' }}>
                <span style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', color: type==='escalation'?'#791F1F':type==='project'?'#0C447C':type==='col'?'#555':'#888' }}>{label}</span>
                <span style={{ fontSize:10, color:'#bbb', background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px' }}>{count}</span>
              </div>
            )
            const ListGroup = ({ label, type, tasks: groupTasks }) => {
              if (groupTasks.length === 0) return null
              return (
                <div style={{ border:'0.5px solid #e5e5e5', borderRadius:10, overflow:'hidden' }}>
                  <TableHeader />
                  <GroupHeader label={label} type={type} count={groupTasks.length} />
                  {groupTasks.map((t, i) => <TaskRow key={t.id} t={t} last={i===groupTasks.length-1} />)}
                </div>
              )
            }

            let groups = []
            if (viewMode === 'domain') {
              const domainKeys = [...new Set(filteredTasks.map(t => t.domain||''))]
                .sort((a, b) => a ? (b ? a.localeCompare(b) : -1) : 1)
              groups = domainKeys.map(d => ({
                key: d, label: d||'No domain', type: 'none',
                tasks: filteredTasks.filter(t => (t.domain||'') === d)
              }))
            } else if (viewMode === 'owner') {
              const allOwners = [...memberNames, '']
              groups = allOwners.map(o => ({
                key: o||'__unassigned', label: o||'Unassigned', type: 'none',
                tasks: filteredTasks.filter(t => o ? (t.owners||[]).includes(o) : (t.owners||[]).length === 0)
              }))
            } else if (viewMode === 'priority') {
              groups = [
                { key:'high', label:'High', type:'none', tasks: filteredTasks.filter(t => (t.priority||'') === 'high') },
                { key:'normal', label:'Normal', type:'none', tasks: filteredTasks.filter(t => (t.priority||'') !== 'high') },
              ]
            } else {
              // order / dynamic — group by escalation, project, then ungrouped
              const escGroups = visibleEscalations
                .map(e => ({ key: e.id, label: e.title, type: 'escalation', tasks: filteredTasks.filter(t => t.escalation_id === e.id) }))
                .filter(g => g.tasks.length > 0)
              const projGroups = visibleProjects
                .map(p => ({ key: p.id, label: p.title, type: 'project', tasks: filteredTasks.filter(t => t.project_id === p.id) }))
                .filter(g => g.tasks.length > 0)
              const ungrouped = filteredTasks.filter(t => !t.escalation_id && !t.project_id)
              groups = [...escGroups, ...projGroups, ...(ungrouped.length ? [{ key:'ungrouped', label:'No project', type:'none', tasks: ungrouped }] : [])]
            }

            return (
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:16 }}>
                {groups.map(g => <ListGroup key={g.key} label={g.label} type={g.type} tasks={g.tasks} />)}
                {groups.length === 0 && (
                  <div style={{ padding:'32px 12px', fontSize:13, color:'#ccc', textAlign:'center' }}>No tasks</div>
                )}
              </div>
            )
          })()}

          {/* ── Standard / Dynamic column view ── */}
          {isSectionOpen('kanban') && !listView && viewMode === 'kanban' && (
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
                    <button onClick={() => { setForm({ substatus:col.key, status:'active' }); setIsEdit(false) }} style={{ width:'100%', marginBottom:8, padding:'10px 0', fontSize:13, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}>+ Add task</button>
                    {ct.map(t => <TaskCard key={t.id} task={t} onEdit={t => { setForm({...t}); setIsEdit(true) }} onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===t.id} onToggleSubtask={toggleSubtask} onComplete={quickComplete} entityMap={entityMap} dropIndicator={dropTarget?.col===col.key&&dropTarget?.taskId===t.id?dropTarget.position:null} onDragOver={viewMode==='kanban'?(taskId,position)=>setDropTarget({col:col.key,taskId,position}):null} />)}
                  </div>
                })}
              </div>
            ) : (
              <div style={{ display:'flex', gap:10, alignItems:'flex-start', overflowX:'auto', paddingBottom:8 }}>
                {/* Active columns — fill available space, cards wrap into grid */}
                {COLS.filter(c => !minimized[c.key]).map(col => {
                  const ct = getColTasks(col.key)
                  return (
                    <div key={col.key}
                      onDragOver={e => { e.preventDefault(); setOverCol(col.key) }}
                      onDragLeave={() => { setOverCol(null); setDropTarget(null) }}
                      onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), col.key) }}
                      style={{ flex:'1 1 220px', minWidth:220, background:overCol===col.key?'#EEF4FF':col.key==='hopper'?'#FFFBE6':'#f7f7f5', border:overCol===col.key?'1.5px dashed #378ADD':col.key==='hopper'?'1.5px solid #C9960A':'1.5px solid transparent', borderRadius:12, padding:12, minHeight:220 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                        <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{col.lbl}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                          <button onClick={() => toggleMin(col.key)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:16, padding:'0 2px', lineHeight:1 }} onMouseEnter={e => e.currentTarget.style.color='#888'} onMouseLeave={e => e.currentTarget.style.color='#ccc'}>−</button>
                        </div>
                      </div>
                      <button onClick={() => { setForm({ substatus:col.key, status:'active' }); setIsEdit(false) }}
                        style={{ width:'100%', marginBottom:8, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background='white'; e.currentTarget.style.color='#444' }}
                        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.color='#aaa' }}>
                        + Add task
                      </button>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:4, alignItems:'start' }}>
                        {ct.map(t => (
                          <TaskCard key={t.id} task={t}
                            onEdit={t => { setForm({...t}); setIsEdit(true) }}
                            onDragStart={id => setDraggingId(id)}
                            onDragEnd={() => { setDraggingId(null); setOverCol(null); setDropTarget(null) }}
                            dragging={draggingId===t.id}
                            onToggleSubtask={toggleSubtask}
                            onComplete={quickComplete}
                            dropIndicator={dropTarget?.col===col.key&&dropTarget?.taskId===t.id?dropTarget.position:null}
                            onDragOver={viewMode==='kanban' ? (taskId, position) => setDropTarget({ col:col.key, taskId, position }) : null}
                            entityMap={entityMap}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
                {/* Minimized columns — vertical strips stacked side-by-side on the right */}
                {COLS.filter(c => minimized[c.key]).length > 0 && (
                  <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:4 }}>
                    {COLS.filter(c => minimized[c.key]).map(col => {
                      const ct = getColTasks(col.key)
                      return (
                        <div key={col.key} onClick={() => toggleMin(col.key)}
                          style={{ width:28, minHeight:90, background:col.key==='hopper'?'#FFFBE6':'#f7f7f5', border:col.key==='hopper'?'1.5px solid #C9960A':'1.5px solid transparent', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 0', cursor:'pointer', userSelect:'none' }}
                          onMouseEnter={e => e.currentTarget.style.background=col.key==='hopper'?'#FFF3B0':'#eeede9'}
                          onMouseLeave={e => e.currentTarget.style.background=col.key==='hopper'?'#FFFBE6':'#f7f7f5'}>
                          <span style={{ fontSize:10, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 4px', color:'#aaa' }}>{ct.length}</span>
                          <span style={{ fontSize:10, color:'#bbb', fontWeight:500, writingMode:'vertical-rl', transform:'rotate(180deg)', letterSpacing:'0.06em', textTransform:'uppercase' }}>{col.lbl}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          )}

          </>)}

          {/* ── Trash section ── */}
          {showTrash && (
            <div ref={trashRef} style={{ marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>🗑️ Trash</span>
                <span style={{ fontSize:11, color:'#bbb' }}>Canceled tasks — click Restore to recover.</span>
              </div>
              {tasks.filter(t=>t.substatus==='canceled').length === 0 && <div style={{ fontSize:13, color:'#ccc', textAlign:'center', padding:'2rem 0' }}>Trash bin is empty</div>}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:10 }}>
                {tasks.filter(t=>t.substatus==='canceled').map(t => (
                  <div key={t.id} style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'10px 12px', opacity:0.75 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'#888', textDecoration:'line-through', marginBottom:6 }}>{t.title}</div>
                    {t.domain && <div style={{ fontSize:11, color:'#aaa', marginBottom:8 }}>{t.domain}</div>}
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button onClick={() => restoreTask(t)} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>Restore</button>
                      <ConfirmDeleteButton onConfirm={() => deleteTask(t.id)} style={{ fontSize:11, background:'none', color:'#A32D2D', border:'0.5px solid #F09595', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>Delete</ConfirmDeleteButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Calendar ── */}
      {tab === 'calendar' && (
        <CalendarTab events={calEvents} onSave={() => loadData(true)} onDelete={() => loadData(true)} members={memberNames} calendars={calendarList} onToggleCalendar={toggleCalendar} />
      )}

      {/* ── Notes ── */}
      {tab === 'notes' && (
        <NotesSection notes={notes} onSaveNote={saveNote} onDeleteNote={deleteNote} noteGroups={noteGroups} onSaveGroup={saveNoteGroup} onRenameGroup={renameNoteGroup} onDeleteGroup={deleteNoteGroup} members={memberNames} />
      )}

      {/* ── Follow Ups ── */}
      {tab === 'followups' && (
        <FollowUpsTab followUps={followUps} onAdd={addFollowUp} onToggle={toggleFollowUp} onDelete={deleteFollowUp} onUpdate={updateFollowUp} people={followUpPeople} tasks={tasks}
          onCreateTask={item => { setForm({ title:item.text, status:'active', owners:[item.person], substatus:'not_started' }); setIsEdit(false) }} />
      )}

      {/* ── Settings ── */}
      {tab === 'settings' && (
        <SettingsPage
          domains={domains}
          teamData={teamData}
          calendarList={calendarList}
          onUpdate={loadData}
          isMobile={isMobile}
        />
      )}

      {/* Task form modal */}
      {form !== null && (
        <TaskForm task={form} isEdit={isEdit} onSave={saveTask} onDelete={deleteTask} onClose={() => setForm(null)} domains={domains} projects={projects} escalations={escalations} members={memberNames} defaultOwner={currentUserName} />
      )}

      {/* Project / Escalation detail popup */}
      {activePopup && (
        <DetailPopup
          entity={activePopup.entity}
          entityType={activePopup.type}
          tasks={tasks}
          domains={domains}
          onClose={() => setActivePopup(null)}
          onDelete={activePopup.type === 'project' ? deleteProject : deleteEscalation}
          onSaveEntity={activePopup.type === 'project' ? saveProject : saveEscalation}
          onSaveTask={saveTaskSilent}
          onDeleteTask={deleteTaskSilent}
          members={memberNames}
        />
      )}
    </div>
  )
}

// ─── Qualification Template Settings ─────────────────────────────────────────
function QualTemplateSettings({ onUpdate }) {
  const [templates, setTemplates] = useState([])
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState(null) // { name, tasks: [{title, subtasks:[string]}] }
  const [newTaskTitle, setNewTaskTitle] = useState('')

  useEffect(() => {
    supabase.from('qual_templates').select('*').order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setTemplates(data) })
  }, [])

  const startNew = () => { setDraft({ name:'', tasks:[] }); setEditId('new') }
  const startEdit = t => { setDraft(JSON.parse(JSON.stringify(t))); setEditId(t.id) }
  const cancel = () => { setDraft(null); setEditId(null); setNewTaskTitle('') }

  const saveDraft = async () => {
    if (!draft.name.trim()) return
    const payload = { name: draft.name.trim(), tasks: draft.tasks }
    if (editId === 'new') {
      await supabase.from('qual_templates').insert(payload)
    } else {
      await supabase.from('qual_templates').update(payload).eq('id', editId)
    }
    const { data } = await supabase.from('qual_templates').select('*').order('created_at', { ascending: true })
    if (data) setTemplates(data)
    onUpdate?.()
    cancel()
  }

  const deleteTemplate = async id => {
    await supabase.from('qual_templates').delete().eq('id', id)
    setTemplates(ts => ts.filter(t => t.id !== id))
    onUpdate?.()
  }

  const addTask = () => {
    const title = newTaskTitle.trim(); if (!title) return
    setDraft(d => ({ ...d, tasks: [...d.tasks, { title, subtasks:[] }] }))
    setNewTaskTitle('')
  }
  const removeTask = i => setDraft(d => ({ ...d, tasks: d.tasks.filter((_,idx) => idx !== i) }))
  const updateTaskTitle = (i, v) => setDraft(d => ({ ...d, tasks: d.tasks.map((t,idx) => idx===i?{...t,title:v}:t) }))
  const addSubtask = (i, v) => { const s = v.trim(); if (!s) return; setDraft(d => ({ ...d, tasks: d.tasks.map((t,idx) => idx===i?{...t,subtasks:[...t.subtasks,s]}:t) })) }
  const removeSubtask = (ti, si) => setDraft(d => ({ ...d, tasks: d.tasks.map((t,idx) => idx===ti?{...t,subtasks:t.subtasks.filter((_,j)=>j!==si)}:t) }))

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:500, color:'#111', marginBottom:2 }}>Bundle Templates</div>
          <div style={{ fontSize:12, color:'#aaa' }}>Pre-populate tasks when creating a bundle.</div>
        </div>
        {editId === null && <button onClick={startNew} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer' }}>+ New template</button>}
      </div>

      {editId !== null && draft && (
        <div style={{ background:'#fafafa', border:'0.5px solid #e5e5e5', borderRadius:10, padding:14, marginBottom:16 }}>
          <input value={draft.name} onChange={e => setDraft(d => ({...d, name:e.target.value}))}
            placeholder="Template name..."
            style={{ width:'100%', boxSizing:'border-box', fontSize:14, fontWeight:500, border:'none', borderBottom:'1.5px solid #111', outline:'none', background:'transparent', padding:'4px 0', marginBottom:14, fontFamily:'inherit' }} />

          <div style={{ fontSize:11, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Tasks</div>
          {draft.tasks.map((task, ti) => (
            <div key={ti} style={{ marginBottom:10, background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'8px 10px' }}>
              <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4 }}>
                <input value={task.title} onChange={e => updateTaskTitle(ti, e.target.value)}
                  style={{ flex:1, fontSize:13, border:'none', outline:'none', background:'transparent', fontFamily:'inherit', fontWeight:500 }} />
                <button onClick={() => removeTask(ti)} style={{ background:'none', border:'none', color:'#ddd', cursor:'pointer', fontSize:13 }} onMouseEnter={e => e.currentTarget.style.color='#E24B4A'} onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
              </div>
              <div style={{ paddingLeft:10 }}>
                {task.subtasks.map((s, si) => (
                  <div key={si} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <input value={s} onChange={e => setDraft(d => ({ ...d, tasks: d.tasks.map((t,idx) => idx===ti?{...t,subtasks:t.subtasks.map((sub,j)=>j===si?e.target.value:sub)}:t) }))}
                      style={{ flex:1, fontSize:11, border:'none', borderBottom:'0.5px solid #e5e5e5', outline:'none', background:'transparent', fontFamily:'inherit', color:'#555', padding:'1px 0' }} />
                    <button onClick={() => removeSubtask(ti, si)} style={{ background:'none', border:'none', color:'#ddd', cursor:'pointer', fontSize:11 }} onMouseEnter={e => e.currentTarget.style.color='#E24B4A'} onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
                  </div>
                ))}
                <SubtaskAdder onAdd={s => addSubtask(ti, s)} />
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') addTask() }}
              placeholder="Add a task..."
              style={{ flex:1, fontSize:12, padding:'6px 9px', border:'0.5px solid #ddd', borderRadius:6, fontFamily:'inherit', outline:'none' }} />
            <button onClick={addTask} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={saveDraft} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'6px 16px', cursor:'pointer' }}>Save template</button>
            <button onClick={cancel} style={{ fontSize:12, background:'none', border:'0.5px solid #ccc', borderRadius:8, padding:'6px 14px', cursor:'pointer', color:'#444' }}>Cancel</button>
          </div>
        </div>
      )}

      {templates.length === 0 && editId === null && (
        <div style={{ fontSize:12, color:'#ccc', padding:'12px 0' }}>No templates yet.</div>
      )}
      {templates.map(t => (
        <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, marginBottom:6 }}>
          <div>
            <div style={{ fontSize:13, fontWeight:500, color:'#111' }}>{t.name}</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{t.tasks?.length || 0} tasks</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={() => startEdit(t)} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'#444' }}>Edit</button>
            <ConfirmDeleteButton onConfirm={() => deleteTemplate(t.id)} style={{ fontSize:11, background:'none', border:'0.5px solid #F09595', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'#A32D2D' }}>Delete</ConfirmDeleteButton>
          </div>
        </div>
      ))}
    </div>
  )
}

function SubtaskAdder({ onAdd }) {
  const [val, setVal] = useState('')
  return (
    <div style={{ display:'flex', gap:4, marginTop:4 }}>
      <input value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key==='Enter') { onAdd(val); setVal('') } }}
        placeholder="Add subtask..."
        style={{ flex:1, fontSize:11, padding:'3px 7px', border:'0.5px solid #e5e5e5', borderRadius:6, fontFamily:'inherit', outline:'none' }} />
      <button onClick={() => { onAdd(val); setVal('') }} style={{ fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'2px 8px', cursor:'pointer', color:'#888' }}>+</button>
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
                <button onClick={() => saveEdit(d.id)} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Save</button>
                <button onClick={() => setEditIdx(null)} style={{ fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Cancel</button>
              </> : <>
                <button onClick={() => moveUp(i)} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'2px 6px', cursor:'pointer', color:'#aaa' }}>↑</button>
                <button onClick={() => moveDown(i)} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'2px 6px', cursor:'pointer', color:'#aaa' }}>↓</button>
                <button onClick={() => { setEditIdx(d.id); setEditVal(d.name) }} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'2px 6px', cursor:'pointer', color:'#888' }}>Edit</button>
                <button onClick={() => removeDomain(d.id)} style={{ fontSize:11, background:'none', border:'0.5px solid #f0c0c0', borderRadius:6, padding:'2px 6px', cursor:'pointer', color:'#A32D2D' }}>✕</button>
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

// ─── Team Settings ────────────────────────────────────────────────────────────
const MEMBER_COLOR_OPTIONS = [
  { bg:'#F1EFE8', tc:'#5F5E5A' },
  { bg:'#E1F5EE', tc:'#085041' },
  { bg:'#E6F1FB', tc:'#0C447C' },
  { bg:'#EEEDFE', tc:'#3C3489' },
  { bg:'#FCEBEB', tc:'#791F1F' },
  { bg:'#FFF3E0', tc:'#7C4A00' },
  { bg:'#F3F4F6', tc:'#374151' },
]

function TeamSettings({ teamData, onUpdate }) {
  const [editId, setEditId] = useState(null)
  const [editVals, setEditVals] = useState({})
  const [adding, setAdding] = useState(false)
  const [newVals, setNewVals] = useState({ name:'', full_name:'', role:'', location:'', can_assign_tasks:true, can_follow_up:true })

  const startEdit = m => { setEditId(m.id); setEditVals({ name:m.name, full_name:m.full_name||'', role:m.role||'', location:m.location||'', can_assign_tasks: m.can_assign_tasks !== false, can_follow_up: m.can_follow_up !== false }) }

  const saveEdit = async id => {
    if (!editVals.name.trim()) return
    await supabase.from('team_members').update({ name:editVals.name.trim(), full_name:editVals.full_name.trim(), role:editVals.role.trim(), location:editVals.location.trim(), can_assign_tasks: editVals.can_assign_tasks, can_follow_up: editVals.can_follow_up }).eq('id', id)
    setEditId(null); onUpdate()
  }

  const addMember = async () => {
    if (!newVals.name.trim()) return
    const maxOrder = teamData.length ? Math.max(...teamData.map(m => m.sort_order||0)) : 0
    await supabase.from('team_members').insert({ name:newVals.name.trim(), full_name:newVals.full_name.trim(), role:newVals.role.trim(), location:newVals.location.trim(), can_assign_tasks: newVals.can_assign_tasks, can_follow_up: newVals.can_follow_up, sort_order:maxOrder+1 })
    setNewVals({ name:'', full_name:'', role:'', location:'', can_assign_tasks:true, can_follow_up:true }); setAdding(false); onUpdate()
  }

  const removeMember = async id => { await supabase.from('team_members').delete().eq('id', id); onUpdate() }

  const toggleCanAssign = async (m) => {
    const newVal = m.can_assign_tasks !== false ? false : true
    await supabase.from('team_members').update({ can_assign_tasks: newVal }).eq('id', m.id)
    onUpdate()
  }

  const toggleCanFollowUp = async (m) => {
    const newVal = m.can_follow_up !== false ? false : true
    await supabase.from('team_members').update({ can_follow_up: newVal }).eq('id', m.id)
    onUpdate()
  }

  const inp = (val, setter, ph) => (
    <input value={val} onChange={e => setter(e.target.value)} placeholder={ph}
      style={{ flex:1, fontSize:12, padding:'4px 7px', border:'0.5px solid #e0e0e0', borderRadius:6, outline:'none', minWidth:0 }} />
  )

  return (
    <div>
      <div style={{ fontSize:12, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Team</div>
      {teamData.length === 0 && (
        <div style={{ fontSize:12, color:'#bbb', padding:'12px 0', marginBottom:12 }}>
          No team members loaded. Run the SQL below to set up the team table, then reload.
        </div>
      )}
      <div style={{ maxWidth:620 }}>
        {teamData.map((m, i) => {
          const c = MEMBER_COLORS[m.name] || MEMBER_COLOR_OPTIONS[i % MEMBER_COLOR_OPTIONS.length]
          const canAssign = m.can_assign_tasks !== false
          const canFollowUp = m.can_follow_up !== false
          return (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'10px 12px', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:c.bg, color:c.tc, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, flexShrink:0 }}>{m.name[0]}</div>
              {editId === m.id ? (
                <div style={{ flex:1, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  {inp(editVals.name, v => setEditVals(p=>({...p,name:v})), 'Display name *')}
                  {inp(editVals.full_name, v => setEditVals(p=>({...p,full_name:v})), 'Full name')}
                  {inp(editVals.role, v => setEditVals(p=>({...p,role:v})), 'Role')}
                  {inp(editVals.location, v => setEditVals(p=>({...p,location:v})), 'Location')}
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    <input type="checkbox" checked={!!editVals.can_assign_tasks} onChange={e => setEditVals(p=>({...p,can_assign_tasks:e.target.checked}))} style={{ width:12, height:12 }} />
                    Tasks
                  </label>
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    <input type="checkbox" checked={!!editVals.can_follow_up} onChange={e => setEditVals(p=>({...p,can_follow_up:e.target.checked}))} style={{ width:12, height:12 }} />
                    Follow-ups
                  </label>
                </div>
              ) : (
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'#111' }}>{m.name}{m.full_name && m.full_name !== m.name ? <span style={{ fontWeight:400, color:'#555' }}> · {m.full_name}</span> : ''}</div>
                  {(m.role || m.location) && <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{[m.role, m.location].filter(Boolean).join(' · ')}</div>}
                </div>
              )}
              {editId !== m.id && (
                <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                  <button onClick={() => toggleCanAssign(m)} title="Toggle task assignment"
                    style={{ fontSize:10, padding:'2px 7px', borderRadius:10, border:'none', cursor:'pointer', background: canAssign ? '#dcfce7' : '#f0f0f0', color: canAssign ? '#15803d' : '#888', fontWeight:500, lineHeight:1.4 }}>
                    {canAssign ? 'Tasks ✓' : 'Tasks —'}
                  </button>
                  <button onClick={() => toggleCanFollowUp(m)} title="Toggle follow-ups"
                    style={{ fontSize:10, padding:'2px 7px', borderRadius:10, border:'none', cursor:'pointer', background: canFollowUp ? '#dbeafe' : '#f0f0f0', color: canFollowUp ? '#1d4ed8' : '#888', fontWeight:500, lineHeight:1.4 }}>
                    {canFollowUp ? 'Follow-up ✓' : 'Follow-up —'}
                  </button>
                </div>
              )}
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                {editId === m.id ? <>
                  <button onClick={() => saveEdit(m.id)} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Save</button>
                  <button onClick={() => setEditId(null)} style={{ fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Cancel</button>
                </> : <>
                  <button onClick={() => startEdit(m)} style={{ fontSize:11, background:'none', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'2px 7px', cursor:'pointer', color:'#888' }}>Edit</button>
                  <button onClick={() => removeMember(m.id)} style={{ fontSize:11, background:'none', border:'0.5px solid #f0c0c0', borderRadius:6, padding:'2px 6px', cursor:'pointer', color:'#A32D2D' }}>✕</button>
                </>}
              </div>
            </div>
          )
        })}
        {adding ? (
          <div style={{ padding:'10px 12px', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, marginBottom:8 }}>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8, alignItems:'center' }}>
              {inp(newVals.name, v => setNewVals(p=>({...p,name:v})), 'Display name *')}
              {inp(newVals.full_name, v => setNewVals(p=>({...p,full_name:v})), 'Full name')}
              {inp(newVals.role, v => setNewVals(p=>({...p,role:v})), 'Role')}
              {inp(newVals.location, v => setNewVals(p=>({...p,location:v})), 'Location')}
              <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                <input type="checkbox" checked={!!newVals.can_assign_tasks} onChange={e => setNewVals(p=>({...p,can_assign_tasks:e.target.checked}))} style={{ width:12, height:12 }} />
                Tasks
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                <input type="checkbox" checked={!!newVals.can_follow_up} onChange={e => setNewVals(p=>({...p,can_follow_up:e.target.checked}))} style={{ width:12, height:12 }} />
                Follow-ups
              </label>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={addMember} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:6, padding:'5px 14px', cursor:'pointer' }}>Add</button>
              <button onClick={() => { setAdding(false); setNewVals({ name:'', full_name:'', role:'', location:'', can_assign_tasks:true, can_follow_up:true }) }} style={{ fontSize:12, background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'5px 14px', cursor:'pointer', color:'#888' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ fontSize:12, background:'none', border:'0.5px dashed #ccc', borderRadius:8, padding:'7px 16px', cursor:'pointer', color:'#888', marginTop:4 }}>+ Add team member</button>
        )}
      </div>
    </div>
  )
}

// ─── Calendar Settings ────────────────────────────────────────────────────────
const CAL_COLORS = ['#4f46e5','#7c3aed','#db2777','#dc2626','#ea580c','#ca8a04','#16a34a','#0891b2','#0284c7','#475569']

function CalendarSettings({ calendars, onUpdate }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#4f46e5')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())
  const [holidayEvents, setHolidayEvents] = useState([])
  const [editingHoliday, setEditingHoliday] = useState(null)
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [newHolidayName, setNewHolidayName] = useState('')
  const [newHolidayDate, setNewHolidayDate] = useState('')

  const holidayCal = calendars.find(c => c.type === 'holidays')

  useEffect(() => {
    if (!holidayCal) return
    supabase.from('calendar_events')
      .select('*')
      .eq('calendar_id', holidayCal.id)
      .gte('start_date', `${holidayYear}-01-01`)
      .lte('start_date', `${holidayYear}-12-31`)
      .order('start_date')
      .then(({ data }) => setHolidayEvents(data || []))
  }, [holidayCal?.id, holidayYear])

  const saveCalendar = async () => {
    const name = newName.trim()
    if (!name) return
    await supabase.from('calendars').insert({ name, color: newColor, visible: true, type: 'user', sort_order: calendars.length })
    setAdding(false); setNewName(''); setNewColor('#4f46e5'); onUpdate()
  }

  const updateCalendar = async (id) => {
    await supabase.from('calendars').update({ name: editName.trim(), color: editColor }).eq('id', id)
    setEditId(null); onUpdate()
  }

  const deleteCalendar = async (id) => {
    await supabase.from('calendars').delete().eq('id', id)
    onUpdate()
  }

  const toggleVisible = async (cal) => {
    await supabase.from('calendars').update({ visible: !cal.visible }).eq('id', cal.id)
    onUpdate()
  }

  const saveHoliday = async (ev) => {
    const { id, ...fields } = ev
    if (id) {
      await supabase.from('calendar_events').update({ title: fields.title, start_date: fields.start_date }).eq('id', id)
    } else {
      await supabase.from('calendar_events').insert({ ...fields, type: 'holiday', all_day: true, calendar_id: holidayCal.id, owners: [], color: '', emoji: '' })
    }
    setEditingHoliday(null); setAddingHoliday(false); setNewHolidayName(''); setNewHolidayDate('')
    const { data } = await supabase.from('calendar_events').select('*').eq('calendar_id', holidayCal.id).gte('start_date', `${holidayYear}-01-01`).lte('start_date', `${holidayYear}-12-31`).order('start_date')
    setHolidayEvents(data || [])
  }

  const deleteHoliday = async (id) => {
    await supabase.from('calendar_events').delete().eq('id', id)
    setHolidayEvents(prev => prev.filter(h => h.id !== id))
  }

  const seedHolidayYear = async (year) => {
    if (!holidayCal) return
    const existing = holidayEvents.map(h => h.start_date)
    const toAdd = generateUSHolidays(year, holidayCal.id).filter(h => !existing.includes(h.start_date))
    if (toAdd.length === 0) return
    await supabase.from('calendar_events').insert(toAdd)
    const { data } = await supabase.from('calendar_events').select('*').eq('calendar_id', holidayCal.id).gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`).order('start_date')
    setHolidayEvents(data || [])
  }

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:12 }}>Calendars</div>

      {/* Calendar list */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
        {calendars.map(cal => (
          <div key={cal.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8 }}>
            <span style={{ width:12, height:12, borderRadius:'50%', background:cal.color, flexShrink:0 }} />
            {editId === cal.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if(e.key==='Enter') updateCalendar(cal.id); if(e.key==='Escape') setEditId(null) }}
                  style={{ flex:1, fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', outline:'none', fontFamily:'inherit' }} />
                <div style={{ display:'flex', gap:3 }}>
                  {CAL_COLORS.map(c => <button key={c} onClick={() => setEditColor(c)} style={{ width:16, height:16, borderRadius:'50%', background:c, border:editColor===c?'2px solid #111':'1.5px solid transparent', cursor:'pointer', padding:0 }} />)}
                </div>
                <button onClick={() => updateCalendar(cal.id)} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Save</button>
                <button onClick={() => setEditId(null)} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex:1, fontSize:13, color:'#111' }}>{cal.name}</span>
                {cal.type === 'default' && <span style={{ fontSize:10, color:'#aaa', background:'#f0f0f0', borderRadius:10, padding:'1px 6px' }}>default</span>}
                {cal.type === 'holidays' && <span style={{ fontSize:10, color:'#aaa', background:'#f0f0f0', borderRadius:10, padding:'1px 6px' }}>system</span>}
                <button onClick={() => toggleVisible(cal)} style={{ fontSize:11, color: cal.visible ? '#4f46e5' : '#bbb', background:'none', border:`0.5px solid ${cal.visible?'#c4b5fd':'#e0e0e0'}`, borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>{cal.visible ? 'Visible' : 'Hidden'}</button>
                {cal.type === 'user' && (
                  <>
                    <button onClick={() => { setEditId(cal.id); setEditName(cal.name); setEditColor(cal.color) }} style={{ fontSize:11, color:'#888', background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Edit</button>
                    <ConfirmDeleteButton onConfirm={() => deleteCalendar(cal.id)} style={{ fontSize:11, color:'#A32D2D', background:'none', border:'0.5px solid #F09595', borderRadius:6, padding:'3px 8px', cursor:'pointer' }} />
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add calendar */}
      {adding ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, marginBottom:16 }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if(e.key==='Enter') saveCalendar(); if(e.key==='Escape') setAdding(false) }}
            placeholder="Calendar name..." style={{ flex:1, fontSize:13, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'4px 8px', outline:'none', fontFamily:'inherit' }} />
          <div style={{ display:'flex', gap:3 }}>
            {CAL_COLORS.map(c => <button key={c} onClick={() => setNewColor(c)} style={{ width:16, height:16, borderRadius:'50%', background:c, border:newColor===c?'2px solid #111':'1.5px solid transparent', cursor:'pointer', padding:0 }} />)}
          </div>
          <button onClick={saveCalendar} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer' }}>Add</button>
          <button onClick={() => setAdding(false)} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'4px 10px', cursor:'pointer', color:'#888' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ fontSize:12, background:'none', border:'0.5px dashed #ccc', borderRadius:8, padding:'6px 14px', cursor:'pointer', color:'#888', marginBottom:24 }}>+ Add calendar</button>
      )}

      {/* US Holidays editor */}
      {holidayCal && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#111' }}>US Holidays</span>
            <button onClick={() => setHolidayYear(y => y - 1)} style={{ background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, width:24, height:24, cursor:'pointer', fontSize:13, color:'#555' }}>‹</button>
            <span style={{ fontSize:13, color:'#555', minWidth:36, textAlign:'center' }}>{holidayYear}</span>
            <button onClick={() => setHolidayYear(y => y + 1)} style={{ background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, width:24, height:24, cursor:'pointer', fontSize:13, color:'#555' }}>›</button>
            <button onClick={() => seedHolidayYear(holidayYear)} style={{ fontSize:11, background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Seed missing</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
            {holidayEvents.map(h => (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'#f7f7f5', borderRadius:8 }}>
                {editingHoliday?.id === h.id ? (
                  <>
                    <input value={editingHoliday.title} onChange={e => setEditingHoliday(p => ({...p, title: e.target.value}))}
                      style={{ flex:1, fontSize:12, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', outline:'none', fontFamily:'inherit' }} />
                    <input type="date" value={editingHoliday.start_date} onChange={e => setEditingHoliday(p => ({...p, start_date: e.target.value}))}
                      style={{ fontSize:12, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', outline:'none', fontFamily:'inherit' }} />
                    <button onClick={() => saveHoliday(editingHoliday)} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Save</button>
                    <button onClick={() => setEditingHoliday(null)} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize:12, color:'#333', flex:1 }}>{h.title}</span>
                    <span style={{ fontSize:11, color:'#aaa' }}>{h.start_date}</span>
                    <button onClick={() => setEditingHoliday({ id: h.id, title: h.title, start_date: h.start_date })} style={{ fontSize:11, color:'#888', background:'none', border:'0.5px solid #e0e0e0', borderRadius:6, padding:'2px 6px', cursor:'pointer' }}>Edit</button>
                    <ConfirmDeleteButton onConfirm={() => deleteHoliday(h.id)} style={{ fontSize:11, color:'#A32D2D', background:'none', border:'0.5px solid #F09595', borderRadius:6, padding:'2px 6px', cursor:'pointer' }} />
                  </>
                )}
              </div>
            ))}
            {holidayEvents.length === 0 && <div style={{ fontSize:12, color:'#ccc', padding:'4px 0' }}>No holidays for {holidayYear} — click "Seed missing" to generate.</div>}
          </div>
          {addingHoliday ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', background:'#f7f7f5', borderRadius:8 }}>
              <input autoFocus value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="Holiday name"
                style={{ flex:1, fontSize:12, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', outline:'none', fontFamily:'inherit' }} />
              <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                style={{ fontSize:12, border:'0.5px solid #e0e0e0', borderRadius:6, padding:'3px 8px', outline:'none', fontFamily:'inherit' }} />
              <button onClick={() => { if(newHolidayName.trim()&&newHolidayDate) saveHoliday({ title: newHolidayName.trim(), start_date: newHolidayDate }) }} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Add</button>
              <button onClick={() => { setAddingHoliday(false); setNewHolidayName(''); setNewHolidayDate('') }} style={{ fontSize:11, background:'none', border:'0.5px solid #ddd', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'#888' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingHoliday(true)} style={{ fontSize:12, background:'none', border:'0.5px dashed #ccc', borderRadius:8, padding:'5px 12px', cursor:'pointer', color:'#888' }}>+ Add holiday</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage({ domains, teamData, calendarList, onUpdate, isMobile = false }) {
  const [section, setSection] = useState('team')

  const NAV = [
    { key: 'team',      label: 'Team',      icon: '👥' },
    { key: 'domains',   label: 'Domains',   icon: '🏷' },
    { key: 'calendars', label: 'Calendars', icon: '📅' },
    { key: 'templates', label: 'Templates', icon: '📋' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:isMobile?'column':'row', gap:0, minHeight:isMobile?0:500, background:'white', border:'0.5px solid #e5e5e5', borderRadius:12, overflow:'hidden' }}>
      {/* Nav — left rail on desktop, top tab row on mobile */}
      <div style={{ ...(isMobile
        ? { display:'flex', gap:2, padding:8, borderBottom:'0.5px solid #e5e5e5', overflowX:'auto', WebkitOverflowScrolling:'touch' }
        : { width:180, borderRight:'0.5px solid #e5e5e5', padding:'16px 0' }), flexShrink:0, background:'#fafafa' }}>
        {!isMobile && <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.08em', padding:'0 16px', marginBottom:8 }}>Settings</div>}
        {NAV.map(item => (
          <button key={item.key} onClick={() => setSection(item.key)}
            style={ isMobile
              ? { flexShrink:0, padding:'7px 12px', borderRadius:8, background: section===item.key ? '#ede9fe' : 'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, color: section===item.key ? '#7c3aed' : '#555', fontWeight: section===item.key ? 600 : 400, fontSize:13, whiteSpace:'nowrap', fontFamily:'inherit' }
              : { width:'100%', textAlign:'left', padding:'9px 16px', background: section===item.key ? '#ede9fe' : 'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:8, color: section===item.key ? '#7c3aed' : '#555', fontWeight: section===item.key ? 600 : 400, fontSize:13, borderLeft: section===item.key ? '3px solid #7c3aed' : '3px solid transparent', boxSizing:'border-box', fontFamily:'inherit' } }
            onMouseEnter={e => { if (section!==item.key && !isMobile) e.currentTarget.style.background='#f0f0f0' }}
            onMouseLeave={e => { if (section!==item.key && !isMobile) e.currentTarget.style.background='none' }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {/* Right panel */}
      <div style={{ flex:1, padding:isMobile?14:24, overflowY:'auto' }}>
        {section === 'team'      && <TeamSettings teamData={teamData} onUpdate={onUpdate} />}
        {section === 'domains'   && <DomainSettings domains={domains} onUpdate={onUpdate} />}
        {section === 'calendars' && <CalendarSettings calendars={calendarList} onUpdate={onUpdate} />}
        {section === 'templates' && <QualTemplateSettings onUpdate={onUpdate} />}
      </div>
    </div>
  )
}

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { supabase } from './supabase'
import DOMPurify from 'dompurify'
import { Newspaper, RefreshCw, NotebookPen, CalendarDays, Settings, LayoutList, StickyNote, Factory, Undo2, Redo2, Link2, Quote, Minus, AlignLeft, AlignCenter, AlignRight, Flag } from 'lucide-react'
import { useEditor, EditorContent, Node as TiptapNode, Extension as TiptapExtension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import TiptapImage from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import { Placeholder } from '@tiptap/extensions'

// ─── Constants ────────────────────────────────────────────────────────────────
const MEMBERS = ['Levi', 'Margarita', 'Illya', 'Matthew']
const COLS = [
  { key: 'hopper',      lbl: 'Hopper' },
  { key: 'not_started', lbl: 'Not started' },
  { key: 'in_progress', lbl: 'In progress' },
  { key: 'at_risk',     lbl: 'At risk' },
  { key: 'on_hold',     lbl: 'On hold' },
  { key: 'waiting',     lbl: 'Waiting' },
  { key: 'complete',    lbl: 'Complete' },
]
const SUBSTATUS = [
  { key: '', label: '—' },
  { key: 'hopper', label: 'Hopper', bg: '#FFFBE6', tc: '#7A5C00', border: '#C9960A' },
  { key: 'not_started', label: 'Not started', bg: '#F1EFE8', tc: '#5F5E5A', border: '#B4B2A9' },
  { key: 'in_progress', label: 'In progress', bg: '#E6F1FB', tc: '#0C447C', border: '#85B7EB' },
  { key: 'at_risk', label: 'At risk', bg: '#FCEBEB', tc: '#791F1F', border: '#F09595' },
  { key: 'on_hold', label: 'On hold', bg: '#FAEEDA', tc: '#633806', border: '#FAC775' },
  { key: 'waiting', label: 'Waiting', bg: '#FFF4E0', tc: '#8A5A00', border: '#F0A500' },
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
  { name: 'Cohasset', tz: 'America/Chicago' },
  { name: 'Greenwood/Tampa', tz: 'America/New_York' },
  { name: 'Bornem/Colmar/Basel', tz: 'Europe/Paris' },
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

// Supplier Qualification tracker — manufacturing sites + kanban statuses (keys reuse SUBSTATUS)
const QUAL_SITES = ['Bornem', 'Cohasset', 'Colmar', 'Greenwood', 'Puebla', 'Sagamihara', 'Suzhou', 'Rewari', 'Tampa']
const QUAL_COLS = [
  { key: 'not_started', lbl: 'Not started' },
  { key: 'in_progress', lbl: 'In progress' },
  { key: 'on_hold',     lbl: 'On hold' },
  { key: 'complete',    lbl: 'Complete' },
]

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

// Additional country/region holiday sets — same handling as the US set.
// type: 'fixed' | 'nth' | 'last' | 'easter' (offset days from Easter Sunday) | 'lookup' (per-year MM-DD, for lunisolar dates)
const EU_HOLIDAY_DEFS = [
  { name: "New Year's Day",      type:'fixed',  month:1,  day:1 },
  { name: "Good Friday",         type:'easter', offset:-2 },
  { name: "Easter Monday",       type:'easter', offset:1 },
  { name: "Labour Day",          type:'fixed',  month:5,  day:1 },
  { name: "Ascension Day",       type:'easter', offset:39 },
  { name: "Whit Monday",         type:'easter', offset:50 },
  { name: "Assumption of Mary",  type:'fixed',  month:8,  day:15 },
  { name: "All Saints' Day",     type:'fixed',  month:11, day:1 },
  { name: "Christmas Day",       type:'fixed',  month:12, day:25 },
  { name: "St. Stephen's Day",   type:'fixed',  month:12, day:26 },
]
const CN_HOLIDAY_DEFS = [
  { name: "New Year's Day",         type:'fixed',  month:1, day:1 },
  { name: "Chinese New Year",       type:'lookup', dates:{ 2026:'02-17', 2027:'02-06' } },
  { name: "Qingming Festival",      type:'lookup', dates:{ 2026:'04-05', 2027:'04-05' } },
  { name: "Labour Day",             type:'fixed',  month:5, day:1 },
  { name: "Dragon Boat Festival",   type:'lookup', dates:{ 2026:'06-19', 2027:'06-09' } },
  { name: "Mid-Autumn Festival",    type:'lookup', dates:{ 2026:'09-25', 2027:'09-15' } },
  { name: "National Day",           type:'fixed',  month:10, day:1 },
]
const JP_HOLIDAY_DEFS = [
  { name: "New Year's Day",            type:'fixed',  month:1,  day:1 },
  { name: "Coming of Age Day",         type:'nth',    month:1,  dow:1, n:2 },
  { name: "National Foundation Day",   type:'fixed',  month:2,  day:11 },
  { name: "Emperor's Birthday",        type:'fixed',  month:2,  day:23 },
  { name: "Vernal Equinox Day",        type:'lookup', dates:{ 2026:'03-20', 2027:'03-21' } },
  { name: "Shōwa Day",                 type:'fixed',  month:4,  day:29 },
  { name: "Constitution Memorial Day", type:'fixed',  month:5,  day:3 },
  { name: "Greenery Day",              type:'fixed',  month:5,  day:4 },
  { name: "Children's Day",            type:'fixed',  month:5,  day:5 },
  { name: "Marine Day",                type:'nth',    month:7,  dow:1, n:3 },
  { name: "Mountain Day",              type:'fixed',  month:8,  day:11 },
  { name: "Respect for the Aged Day",  type:'nth',    month:9,  dow:1, n:3 },
  { name: "Autumnal Equinox Day",      type:'lookup', dates:{ 2026:'09-23', 2027:'09-23' } },
  { name: "Sports Day",                type:'nth',    month:10, dow:1, n:2 },
  { name: "Culture Day",               type:'fixed',  month:11, day:3 },
  { name: "Labour Thanksgiving Day",   type:'fixed',  month:11, day:23 },
]
const IN_HOLIDAY_DEFS = [
  { name: "Republic Day",     type:'fixed',  month:1,  day:26 },
  { name: "Holi",             type:'lookup', dates:{ 2026:'03-04', 2027:'03-22' } },
  { name: "Good Friday",      type:'easter', offset:-2 },
  { name: "Independence Day", type:'fixed',  month:8,  day:15 },
  { name: "Gandhi Jayanti",   type:'fixed',  month:10, day:2 },
  { name: "Diwali",           type:'lookup', dates:{ 2026:'11-08', 2027:'10-29' } },
  { name: "Christmas Day",    type:'fixed',  month:12, day:25 },
]
const MX_HOLIDAY_DEFS = [
  { name: "New Year's Day",            type:'fixed', month:1,  day:1 },
  { name: "Constitution Day",          type:'nth',   month:2,  dow:1, n:1 },
  { name: "Benito Juárez's Birthday",  type:'nth',   month:3,  dow:1, n:3 },
  { name: "Labour Day",                type:'fixed', month:5,  day:1 },
  { name: "Independence Day",          type:'fixed', month:9,  day:16 },
  { name: "Revolution Day",            type:'nth',   month:11, dow:1, n:3 },
  { name: "Christmas Day",             type:'fixed', month:12, day:25 },
]
// Registry of holiday calendars, keyed by calendar type. US keeps type 'holidays' for back-compat.
const HOLIDAY_CALS = [
  { type:'holidays',    name:'US Holidays',     color:'#16a34a', defs:US_HOLIDAY_DEFS },
  { type:'holidays_mx', name:'Mexico Holidays', color:'#0d9488', defs:MX_HOLIDAY_DEFS },
  { type:'holidays_eu', name:'EU Holidays',     color:'#2563eb', defs:EU_HOLIDAY_DEFS },
  { type:'holidays_cn', name:'China Holidays',  color:'#dc2626', defs:CN_HOLIDAY_DEFS },
  { type:'holidays_jp', name:'Japan Holidays',  color:'#7c3aed', defs:JP_HOLIDAY_DEFS },
  { type:'holidays_in', name:'India Holidays',  color:'#ea580c', defs:IN_HOLIDAY_DEFS },
]
const isHolidayCalType = t => !!t && t.startsWith('holidays')
const defsForCalType = t => (HOLIDAY_CALS.find(h => h.type === t)?.defs) || US_HOLIDAY_DEFS

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
// Standard modal close (X) button. Rendered as the FIRST child inside a scrollable modal card: the
// zero-height sticky wrapper pins it to the top-right of the card's visible scroll position (not just
// its static top), so it never scrolls out of reach on long forms. No DOM restructuring required —
// just drop this in right after the card's opening <div>.
function ModalCloseButton({ onClick }) {
  return (
    <div style={{ position:'sticky', top:0, zIndex:20, height:0, display:'flex', justifyContent:'flex-end', pointerEvents:'none' }}>
      <button onClick={onClick} title="Close" aria-label="Close"
        style={{ pointerEvents:'auto', marginTop:10, marginRight:10, width:26, height:26, borderRadius:'50%', background:'#111', color:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, lineHeight:1, padding:0, flexShrink:0, fontFamily:'inherit', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }}
        onMouseEnter={e => e.currentTarget.style.background = '#333'}
        onMouseLeave={e => e.currentTarget.style.background = '#111'}>
        ✕
      </button>
    </div>
  )
}
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
// Easter Sunday (Gregorian) via the Meeus/Jones/Butcher algorithm — drives EU/India movable feasts
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}
function generateHolidays(defs, year, calendarId) {
  return defs.map(h => {
    let d
    if (h.type === 'fixed') d = new Date(year, h.month - 1, h.day)
    else if (h.type === 'nth') d = getNthWeekday(year, h.month - 1, h.dow, h.n)
    else if (h.type === 'last') d = getNthWeekday(year, h.month - 1, h.dow, 0)
    else if (h.type === 'easter') { d = easterSunday(year); d.setDate(d.getDate() + (h.offset || 0)) }
    else if (h.type === 'lookup') { const s = h.dates?.[year]; if (!s) return null; const [mm, dd] = s.split('-').map(Number); d = new Date(year, mm - 1, dd) }
    if (!d) return null
    return { title: h.name, type: 'holiday', all_day: true, start_date: toISODate(d), end_date: null, calendar_id: calendarId, owners: [], color: '', emoji: '' }
  }).filter(Boolean)
}
// Back-compat wrapper for the US set
function generateUSHolidays(year, calendarId) { return generateHolidays(US_HOLIDAY_DEFS, year, calendarId) }
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
          <div key={c.name} style={{ flex:'1 0 72px', padding:'9px 12px', borderLeft:i===0?'none':'0.5px solid rgba(255,255,255,0.15)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center' }}>
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
  const s = { domain:{ background:'#E6F1FB', color:'#0C447C' }, owner:{ background:'#E1F5EE', color:'#085041' }, due:{ background:'#FAEEDA', color:'#633806' }, high:{ background:'#FCEBEB', color:'#791F1F' }, done:{ background:'#EAF3DE', color:'#27500A' }, waiting:{ background:'#FFF4E0', color:'#8A5A00' } }[type] || {}
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
            {!compact && (showOwners || task.due || hasSubtasks || hasNotes || attachCount > 0 || (task.status === 'waiting' && task.waiting_on)) && (
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:6, flexWrap:'wrap' }}>
                {showOwners && owners.map(o => <OwnerPip key={o} name={o} />)}
                {task.status === 'waiting' && task.waiting_on && <Badge type="waiting">waiting on: {task.waiting_on}</Badge>}
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
          <ModalCloseButton onClick={onClose} />

          {/* Title */}
          <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)}
            placeholder={isProject ? 'Project title...' : 'Escalation title...'}
            style={{ width:'100%', boxSizing:'border-box', fontSize:18, fontWeight:700, border:'none', outline:'none', marginBottom: 6, color:isProject?'#111':RED, background:'transparent', padding:'0 34px 0 0' }} />
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
          domains={domains} zIndex={60} lockedDomain={isProject ? (entity.domain || null) : null}
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

// ─── TipTap building blocks (engine under the notes editor) ───────────────────
// Font-size steps shared by the toolbar dropdown and the legacy <font> upgrade
const FONT_STEPS = { 1: '0.72em', 2: '0.86em', 3: '1em', 4: '1.3em', 5: '1.7em' }

// Inline @mention chip — parses the spans older notes already contain
const MentionChip = TiptapNode.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  atom: true,
  addAttributes() { return { name: { default: '' } } },
  parseHTML() { return [{ tag: 'span[data-mention]', getAttrs: el => ({ name: el.getAttribute('data-mention') || (el.textContent || '').replace(/^@/, '') }) }] },
  renderHTML({ node }) { return ['span', { 'data-mention': node.attrs.name, style: 'background:#ede9fe;color:#7c3aed;border-radius:4px;padding:1px 6px;font-weight:500;white-space:nowrap' }, `@${node.attrs.name}`] },
})

// Image that keeps a persistable width (percent); pasted images stay base64
const NoteImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => (el.style && el.style.width) || el.getAttribute('width') || null,
        renderHTML: attrs => attrs.width ? { style: `width:${attrs.width}` } : {},
      },
    }
  },
}).configure({ allowBase64: true })

// Table cell that keeps its fill color
const FillTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: el => (el.style && el.style.backgroundColor) || null,
        renderHTML: attrs => attrs.backgroundColor ? { style: `background-color:${attrs.backgroundColor}` } : {},
      },
    }
  },
})

// Tab indents inside lists (Shift-Tab outdents). In tables the Table extension owns Tab; outside
// any list we return false so Tab isn't trapped (default focus behaviour) and never injects spaces.
const TabKeymap = TiptapExtension.create({
  name: 'tabKeymap',
  addKeyboardShortcuts() {
    const inList = () => this.editor.isActive('taskItem') || this.editor.isActive('listItem')
    return {
      Tab: () => {
        if (this.editor.isActive('table') || !inList()) return false
        this.editor.commands.sinkListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem')
        return true // consume within a list even when it can't sink (first item) so no spaces get inserted
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('table') || !inList()) return false
        this.editor.commands.liftListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem')
        return true
      },
    }
  },
})

// Canonical note ordering: manual sort_order first (dense, global), then newest-first as a stable tiebreak
const manualNoteCmp = (a, b) => ((a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)) || (new Date(b.created_at) - new Date(a.created_at))

// Upgrade execCommand-era note HTML so it round-trips through the TipTap schema:
// <font size> → sized spans, hand-rolled checkbox divs → real task lists.
function upgradeLegacyNoteHtml(html) {
  if (!html) return ''
  const root = document.createElement('div')
  root.innerHTML = html
  root.querySelectorAll('font[size]').forEach(f => {
    const span = document.createElement('span')
    span.style.fontSize = FONT_STEPS[f.getAttribute('size')] || '1em'
    while (f.firstChild) span.appendChild(f.firstChild)
    f.replaceWith(span)
  })
  const isCheckRow = el => !!(el && el.nodeType === 1 && el.tagName === 'DIV' && el.querySelector(':scope > input[type="checkbox"]'))
  const absorbed = new Set() // rows already folded into a list (root is detached, so isConnected can't be used)
  ;[...root.querySelectorAll('div')].filter(isCheckRow).forEach(row => {
    if (absorbed.has(row)) return
    const ul = document.createElement('ul')
    ul.setAttribute('data-type', 'taskList')
    row.before(ul)
    let cur = row
    while (isCheckRow(cur)) {
      absorbed.add(cur)
      const next = cur.nextElementSibling
      const li = document.createElement('li')
      li.setAttribute('data-type', 'taskItem')
      li.setAttribute('data-checked', cur.querySelector('input[type="checkbox"]').hasAttribute('checked') ? 'true' : 'false')
      const p = document.createElement('p')
      p.textContent = (cur.querySelector('span')?.textContent || cur.textContent || '').trim()
      li.appendChild(p)
      ul.appendChild(li)
      cur.remove()
      cur = next
    }
  })
  return root.innerHTML
}

const NOTE_EDITOR_CSS = `
.note-editor .ProseMirror,.note-editor [contenteditable="true"]{outline:none;padding:12px 16px;min-height:200px}
.note-editor p{margin:0 0 2px}
.note-editor h1{font-size:1.5em;margin:10px 0 4px}
.note-editor h2{font-size:1.3em;margin:8px 0 3px}
.note-editor h3{font-size:1.15em;margin:6px 0 2px}
.note-editor ul,.note-editor ol{padding-left:20px;margin:2px 0}
.note-editor ul[data-type="taskList"]{list-style:none;padding-left:2px}
.note-editor ul[data-type="taskList"] li{display:flex;gap:8px;align-items:flex-start;margin:2px 0}
.note-editor ul[data-type="taskList"] li>label{flex-shrink:0;display:flex;align-items:center;height:1.55em}
.note-editor ul[data-type="taskList"] li>label input{width:14px;height:14px;cursor:pointer;margin:0}
.note-editor ul[data-type="taskList"] li>div{flex:1;min-width:0}
.note-editor ul[data-type="taskList"] li[data-checked="true"]>div{color:#aaa;text-decoration:line-through}
.note-editor blockquote{border-left:3px solid #ddd6fe;margin:6px 0;padding:2px 12px;color:#555}
.note-editor pre{background:#f5f5f3;border-radius:8px;padding:10px 12px;font-size:0.9em;overflow-x:auto}
.note-editor hr{border:none;border-top:1px solid #e5e5e5;margin:10px 0}
.note-editor a{color:#4f46e5;text-decoration:underline;cursor:pointer}
.note-editor table{border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed}
.note-editor td,.note-editor th{border:1px solid #d1d5db;padding:3px 8px;min-width:40px;vertical-align:top;position:relative;line-height:1.6}
.note-editor .selectedCell:after{content:'';position:absolute;inset:0;background:rgba(124,58,237,0.08);pointer-events:none}
.note-editor .column-resize-handle{position:absolute;right:-2px;top:0;bottom:-2px;width:4px;background:#c4b5fd;pointer-events:none}
.note-editor .resize-cursor{cursor:col-resize}
.note-editor img{max-width:100%;border-radius:6px;display:block;margin:4px 0}
.note-editor img.ProseMirror-selectednode{outline:2px solid #7c3aed;outline-offset:2px}
.note-editor p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:#ccc;float:left;height:0;pointer-events:none}
`

function RichTextEditor({ initialValue, onChange, isMobile = false, members = [] }) {
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [tableHover, setTableHover] = useState([0, 0])
  const editorRef = useRef(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TextStyle, Color, FontSize,
      Highlight.configure({ multicolor: true }),
      Subscript, Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, FillTableCell,
      TaskList, TaskItem.configure({ nested: true }),
      NoteImage, MentionChip, TabKeymap,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: DOMPurify.sanitize(upgradeLegacyNoteHtml(initialValue || '')),
    shouldRerenderOnTransaction: true, // toolbar active states track the caret
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    editorProps: {
      // Pasted images: compress via canvas → base64 (no storage round-trip), same as the old editor
      handlePaste: (view, event) => {
        const item = Array.from(event.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
        if (!item) return false
        const file = item.getAsFile()
        if (!file) return false
        event.preventDefault()
        const reader = new FileReader()
        reader.onload = ev => {
          const imgEl = new window.Image()
          imgEl.onload = () => {
            const maxW = 1200
            const scale = Math.min(1, maxW / imgEl.naturalWidth)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(imgEl.naturalWidth * scale)
            canvas.height = Math.round(imgEl.naturalHeight * scale)
            canvas.getContext('2d').drawImage(imgEl, 0, 0, canvas.width, canvas.height)
            editorRef.current?.chain().focus().setImage({ src: canvas.toDataURL('image/jpeg', 0.82) }).run()
          }
          imgEl.src = ev.target.result
        }
        reader.readAsDataURL(file)
        return true
      },
    },
  })
  editorRef.current = editor

  if (!editor) return null
  const chain = () => editor.chain().focus()
  const active = (...a) => editor.isActive(...a)

  // ── Toolbar chrome (ghost buttons, purple hover — the app's language) ──
  const sep = { width: '1px', height: 16, background: '#ece9f5', margin: '0 5px', flexShrink: 0 }
  const ghost = { fontSize: 12.5, height: 26, minWidth: 26, padding: '0 7px', border: 'none', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', color: '#555', lineHeight: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  const tbtn = (label, action, opts = {}) => {
    const on = !!opts.active
    return (
      <button key={opts.key} onMouseDown={e => { e.preventDefault(); action() }} title={opts.title} disabled={opts.disabled}
        style={{ ...ghost, ...(on ? { background: '#ede9fe', color: '#7c3aed' } : {}), opacity: opts.disabled ? 0.35 : 1, ...opts.style }}
        onMouseEnter={e => { if (!on && !opts.disabled) e.currentTarget.style.background = '#f0edff' }}
        onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
        {label}
      </button>
    )
  }
  const rowStyle = { display: 'flex', gap: 2, padding: '5px 8px', background: 'white', flexWrap: 'wrap', alignItems: 'center' }

  // Numeric font size (px) — reads current size at the caret; legacy em values map back through the base size
  const SIZE_LADDER = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 48]
  const baseSize = isMobile ? 16 : 15
  const curSizePx = (() => {
    const fs = editor.getAttributes('textStyle').fontSize
    if (!fs) return baseSize
    if (String(fs).endsWith('px')) return Math.round(parseFloat(fs))
    if (String(fs).endsWith('em')) return Math.round(parseFloat(fs) * baseSize)
    return baseSize
  })()
  const applySize = px => {
    const v = Math.round(px)
    if (!v || isNaN(v)) return
    const clamped = Math.max(6, Math.min(96, v))
    clamped === baseSize ? chain().unsetFontSize().run() : chain().setFontSize(clamped + 'px').run()
  }
  const stepSize = dir => {
    const next = dir > 0 ? SIZE_LADDER.find(s => s > curSizePx) : [...SIZE_LADDER].reverse().find(s => s < curSizePx)
    if (next) applySize(next)
  }
  const editLink = () => {
    const prev = editor.getAttributes('link').href || ''
    const url = window.prompt('Link URL (empty to remove)', prev)
    if (url === null) return
    if (!url.trim()) { chain().extendMarkRange('link').unsetLink().run(); return }
    chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/i.test(url) ? url : `https://${url}` }).run()
  }
  const insertMention = name => chain().insertContent([{ type: 'mention', attrs: { name } }, { type: 'text', text: ' ' }]).run()

  const COLORS = [
    '#111111', '#c0392b', '#0C447C', '#27500A', '#7d3c98', '#d35400',
    '#f1948a', '#85c1e9', '#a9dfbf', '#d7bde2', '#fad7a0', '#a2d9ce', '#f9e79f', '#aab7b8',
  ]
  const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bae6fd', '#fecdd3', '#fed7aa', '#e9d5ff']
  const CELL_FILLS = ['', '#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#ffedd5', '#f3f4f6', '#1e293b']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      <style>{NOTE_EDITOR_CSS}</style>
      {/* Toolbar — sticky so it stays above the keyboard on mobile */}
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'white', border: '0.5px solid #e5e5e5', borderBottom: 'none' }}>
        {/* Row 1: history · blocks · marks · lists · inserts · size · align */}
        <div style={{ ...rowStyle, borderBottom: '0.5px solid #f2eff9' }}>
          {tbtn(<Undo2 size={14} />, () => chain().undo().run(), { title: 'Undo', disabled: !editor.can().undo() })}
          {tbtn(<Redo2 size={14} />, () => chain().redo().run(), { title: 'Redo', disabled: !editor.can().redo() })}
          <div style={sep} />
          {tbtn('B', () => chain().toggleBold().run(), { active: active('bold'), style: { fontWeight: 700 } })}
          {tbtn('I', () => chain().toggleItalic().run(), { active: active('italic'), style: { fontStyle: 'italic' } })}
          {tbtn('U', () => chain().toggleUnderline().run(), { active: active('underline'), style: { textDecoration: 'underline' } })}
          {tbtn('S', () => chain().toggleStrike().run(), { active: active('strike'), style: { textDecoration: 'line-through' } })}
          {tbtn(<span>x<sup>2</sup></span>, () => chain().toggleSuperscript().run(), { active: active('superscript'), title: 'Superscript' })}
          {tbtn(<span>x<sub>2</sub></span>, () => chain().toggleSubscript().run(), { active: active('subscript'), title: 'Subscript' })}
          <div style={sep} />
          {tbtn('• List', () => chain().toggleBulletList().run(), { active: active('bulletList') })}
          {tbtn('1. List', () => chain().toggleOrderedList().run(), { active: active('orderedList') })}
          {tbtn('☑ Check', () => chain().toggleTaskList().run(), { active: active('taskList'), title: 'Checklist' })}
          {tbtn('→', () => { chain().sinkListItem(active('taskItem') ? 'taskItem' : 'listItem').run() }, { title: 'Indent' })}
          {tbtn('←', () => { chain().liftListItem(active('taskItem') ? 'taskItem' : 'listItem').run() }, { title: 'Outdent' })}
          <div style={sep} />
          {tbtn(<Link2 size={14} />, editLink, { active: active('link'), title: 'Add / edit link' })}
          {tbtn(<Quote size={13} />, () => chain().toggleBlockquote().run(), { active: active('blockquote'), title: 'Quote' })}
          {tbtn(<Minus size={14} />, () => chain().setHorizontalRule().run(), { title: 'Divider' })}
          <div style={{ position: 'relative' }}>
            <button onMouseDown={e => { e.preventDefault(); setShowTablePicker(v => !v) }}
              style={{ ...ghost, padding: '0 8px', background: showTablePicker ? '#ede9fe' : 'transparent', color: showTablePicker ? '#7c3aed' : '#555' }}
              onMouseEnter={e => { if (!showTablePicker) e.currentTarget.style.background = '#f0edff' }} onMouseLeave={e => { if (!showTablePicker) e.currentTarget.style.background = 'transparent' }}>
              ⊞ Table
            </button>
            {showTablePicker && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, background: 'white', border: '0.5px solid #e5e5e5', borderRadius: 8, padding: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20 }}
                onMouseLeave={() => setTableHover([0, 0])}>
                <div style={{ fontSize: 10, color: '#888', marginBottom: 5, textAlign: 'center', minWidth: 120 }}>
                  {tableHover[0] > 0 ? `${tableHover[0]} × ${tableHover[1]} table` : 'Hover to select'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 18px)', gap: 2 }}>
                  {Array.from({ length: 36 }).map((_, i) => {
                    const r = Math.floor(i / 6) + 1, c = (i % 6) + 1
                    const on = r <= tableHover[0] && c <= tableHover[1]
                    return (
                      <div key={i}
                        style={{ width: 16, height: 16, background: on ? '#ddd6fe' : '#f0f0f0', border: `1px solid ${on ? '#c4b5fd' : '#e0e0e0'}`, borderRadius: 2, cursor: 'pointer' }}
                        onMouseEnter={() => setTableHover([r, c])}
                        onClick={() => { if (tableHover[0] > 0) { chain().insertTable({ rows: tableHover[0], cols: tableHover[1], withHeaderRow: false }).run(); setShowTablePicker(false) } }} />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div style={sep} />
          <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid #e5e2ee', borderRadius: 7, background: '#faf9ff', height: 26, overflow: 'hidden', flexShrink: 0 }} title="Font size (px)">
            <button onMouseDown={e => { e.preventDefault(); stepSize(-1) }}
              style={{ ...ghost, height: '100%', minWidth: 22, borderRadius: 0, fontSize: 14 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0edff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>−</button>
            <input key={curSizePx} type="text" inputMode="numeric" defaultValue={curSizePx}
              onMouseDown={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applySize(parseInt(e.target.value, 10)) } }}
              onBlur={e => { const v = parseInt(e.target.value, 10); if (v && v !== curSizePx) applySize(v) }}
              style={{ width: 26, textAlign: 'center', fontSize: 11.5, border: 'none', outline: 'none', background: 'transparent', color: '#555', fontFamily: 'inherit', padding: 0 }} />
            <button onMouseDown={e => { e.preventDefault(); stepSize(1) }}
              style={{ ...ghost, height: '100%', minWidth: 22, borderRadius: 0, fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f0edff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>+</button>
          </div>
          {!isMobile && <>
            <div style={sep} />
            {tbtn(<AlignLeft size={14} />, () => chain().setTextAlign('left').run(), { active: active({ textAlign: 'left' }), title: 'Align left' })}
            {tbtn(<AlignCenter size={14} />, () => chain().setTextAlign('center').run(), { active: active({ textAlign: 'center' }), title: 'Center' })}
            {tbtn(<AlignRight size={14} />, () => chain().setTextAlign('right').run(), { active: active({ textAlign: 'right' }), title: 'Align right' })}
          </>}
          <div style={sep} />
          {tbtn('✕ fmt', () => chain().unsetAllMarks().clearNodes().run(), { title: 'Clear formatting', style: { color: '#aaa', fontSize: 11 } })}
          {members.length > 0 && <MentionPicker members={members} onInsert={insertMention} />}
        </div>
        {/* Row 2: colors — scrollable on mobile */}
        <div style={{ ...rowStyle, gap: 5, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' }}>
          <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Text</span>
          <div style={sep} />
          {COLORS.map(c => (
            <button key={c} onMouseDown={e => { e.preventDefault(); chain().setColor(c).run() }}
              style={{ width: isMobile ? 20 : 14, height: isMobile ? 20 : 14, borderRadius: '50%', background: c, border: '1.5px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'} />
          ))}
          <button onMouseDown={e => { e.preventDefault(); chain().unsetColor().run() }}
            style={{ fontSize: 10, padding: '2px 6px', border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#bbb', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0edff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Default color">✕</button>
          <div style={{ ...sep, margin: '0 5px' }} />
          <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Highlight</span>
          <div style={sep} />
          {HIGHLIGHTS.map(c => (
            <button key={c} onMouseDown={e => { e.preventDefault(); chain().toggleHighlight({ color: c }).run() }}
              style={{ width: isMobile ? 22 : 16, height: isMobile ? 20 : 14, borderRadius: 3, background: c, border: '1.5px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#555'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'} />
          ))}
          <button onMouseDown={e => { e.preventDefault(); chain().unsetHighlight().run() }}
            style={{ fontSize: 10, padding: isMobile ? '4px 8px' : '2px 6px', border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: '#bbb', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = '#f0edff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            title="Remove highlight">✕</button>
        </div>
        {/* Row 3: contextual table controls */}
        {!isMobile && active('table') && (
          <div style={{ ...rowStyle, gap: 4, background: '#faf5ff', borderTop: '0.5px solid #f2eff9' }}>
            <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 500, marginRight: 2, flexShrink: 0 }}>Table</span>
            <div style={{ ...sep, background: '#ddd6fe' }} />
            {tbtn('← Col', () => chain().addColumnBefore().run(), { title: 'Insert column left', style: { fontSize: 11, color: '#7c3aed' } })}
            {tbtn('Col →', () => chain().addColumnAfter().run(), { title: 'Insert column right', style: { fontSize: 11, color: '#7c3aed' } })}
            {tbtn('✕ Col', () => chain().deleteColumn().run(), { title: 'Delete column', style: { fontSize: 11, color: '#7c3aed' } })}
            <div style={{ ...sep, background: '#ddd6fe' }} />
            {tbtn('↑ Row', () => chain().addRowBefore().run(), { title: 'Insert row above', style: { fontSize: 11, color: '#7c3aed' } })}
            {tbtn('Row ↓', () => chain().addRowAfter().run(), { title: 'Insert row below', style: { fontSize: 11, color: '#7c3aed' } })}
            {tbtn('✕ Row', () => chain().deleteRow().run(), { title: 'Delete row', style: { fontSize: 11, color: '#7c3aed' } })}
            <div style={{ ...sep, background: '#ddd6fe' }} />
            {tbtn('⊞→', () => chain().mergeCells().run(), { title: 'Merge cells', style: { color: '#7c3aed' } })}
            {tbtn('⊟', () => chain().splitCell().run(), { title: 'Split cell', style: { color: '#7c3aed' } })}
            {tbtn('✕ Table', () => chain().deleteTable().run(), { title: 'Delete table', style: { fontSize: 11, color: '#c0392b' } })}
            <div style={{ ...sep, background: '#ddd6fe' }} />
            <span style={{ fontSize: 10, color: '#7c3aed', flexShrink: 0 }}>Cell fill</span>
            {CELL_FILLS.map((c, i) => (
              <button key={i} onMouseDown={e => { e.preventDefault(); chain().setCellAttribute('backgroundColor', c || null).run() }}
                title={c || 'Clear fill'}
                style={{ width: 15, height: 15, borderRadius: 3, background: c || 'white', border: c ? '1.5px solid transparent' : '1.5px solid #d1d5db', cursor: 'pointer', padding: 0, flexShrink: 0, position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={e => e.currentTarget.style.borderColor = c ? 'transparent' : '#d1d5db'}>
                {!c && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#bbb', lineHeight: 1 }}>✕</span>}
              </button>
            ))}
          </div>
        )}
        {/* Row 3b: contextual image controls */}
        {active('image') && (
          <div style={{ ...rowStyle, gap: 4, background: '#faf5ff', borderTop: '0.5px solid #f2eff9' }}>
            <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 500, marginRight: 2, flexShrink: 0 }}>Image</span>
            <div style={{ ...sep, background: '#ddd6fe' }} />
            {['25%', '50%', '75%', '100%'].map(w => tbtn(w, () => chain().updateAttributes('image', { width: w }).run(), { key: w, title: `Width ${w}`, style: { fontSize: 11, color: '#7c3aed' }, active: editor.getAttributes('image').width === w }))}
            {tbtn('Auto', () => chain().updateAttributes('image', { width: null }).run(), { title: 'Natural width', style: { fontSize: 11, color: '#7c3aed' } })}
            <div style={{ ...sep, background: '#ddd6fe' }} />
            {tbtn('✕ Remove', () => chain().deleteSelection().run(), { title: 'Remove image', style: { fontSize: 11, color: '#c0392b' } })}
          </div>
        )}
      </div>
      {/* Editing surface */}
      <EditorContent editor={editor} className="note-editor"
        style={{ flex: 1, border: '0.5px solid #e5e5e5', borderTop: 'none', overflowY: 'auto', WebkitOverflowScrolling: 'touch', fontSize: isMobile ? 16 : 15, lineHeight: 1.55, color: '#333', minHeight: 200, cursor: 'text' }}
        onClick={e => { if (e.target === e.currentTarget || e.target.classList?.contains('note-editor')) editor.chain().focus('end').run() }} />
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

      const [{ data: tasks }, { data: calRaw }, { data: qualsRaw }, { data: qualTasksRaw }] = await Promise.all([
        supabase.from('tasks').select('*').in('status', ['active', 'waiting']),
        supabase.from('calendar_events').select('*'),
        supabase.from('qualifications').select('*'),
        supabase.from('tasks').select('*').not('qualification_id', 'is', null), // unfiltered by status — computeSchedule needs every track task
      ])

      // Qualification-linked track tasks are represented richly in the Qualifications section below;
      // keep the flat task list to standalone tasks so the same stage isn't reported twice.
      const standaloneTasks = (tasks || []).filter(t => !t.qualification_id)
      const activeTasks = standaloneTasks.filter(t => t.status === 'active')
      const waitingTasks = standaloneTasks.filter(t => t.status === 'waiting')

      // Build task meta lookup for Action required coloring (fuzzy title match against generated bullets)
      const meta = {}
      ;(standaloneTasks || []).forEach(t => { meta[t.title.toLowerCase()] = { color: t.color, substatus: t.substatus } })
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

      // Days since last update — the raw figure the model needs to actually judge staleness (used by Suggestions)
      const daysSince = iso => iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null
      const buildTaskLines = list => list.map(t => {
        const parts = [`- [${t.title}]`]
        if ((t.owners||[]).length) parts.push(`owners: ${t.owners.join(', ')}`)
        if (t.substatus) parts.push(`substatus: ${t.substatus}`)
        if (t.color) parts.push(`flag: ${t.color}`)
        if (t.due) parts.push(`due: ${t.due}`)
        const openSubs = (Array.isArray(t.subtasks) ? t.subtasks : []).filter(s => !s.done).length
        if (openSubs) parts.push(`open subtasks: ${openSubs}`)
        const days = daysSince(t.updated_at)
        if (days !== null) parts.push(`updated ${days}d ago`)
        return parts.join(' | ')
      }).join('\n') || 'None.'
      const taskLines = buildTaskLines(activeTasks)

      // Waiting tasks: the actionable signal here is how LONG they've waited, not their content —
      // waiting_since (falls back to updated_at for rows predating that column) drives the day count.
      const waitingLines = waitingTasks.map(t => {
        const parts = [`- [${t.title}]`]
        if (t.waiting_on) parts.push(`waiting on: ${t.waiting_on}`)
        const waitDays = daysSince(t.waiting_since) ?? daysSince(t.updated_at)
        if (waitDays !== null) parts.push(`waiting ${waitDays} day${waitDays === 1 ? '' : 's'}`)
        if ((t.owners||[]).length) parts.push(`owners: ${t.owners.join(', ')}`)
        if (t.due) parts.push(`due: ${t.due}`)
        return parts.join(' | ')
      }).join('\n') || 'None.'

      // Supplier qualifications — one live-scheduled summary line per qualification
      const qualLines = (qualsRaw || []).map(q => {
        const linked = (qualTasksRaw || []).filter(t => t.qualification_id === q.id)
        const { schedule, projectedEnd } = computeSchedule({ start_date: q.start_date }, linked, todayISO)
        const stages = linked.flatMap(t => Array.isArray(t.subtasks) ? t.subtasks : [])
        const nonNA = stages.filter(s => !s.na)
        const doneCount = nonNA.filter(s => s.done).length
        const inFlight = nonNA.filter(s => !s.done && schedule[s.id] && schedule[s.id].plannedStart <= todayISO)
        const overdue = nonNA.filter(s => !s.done && schedule[s.id]?.overdue)
        // The terminal critical-path stage is always the latest-ending one by construction — that's tautological,
        // not informative. What actually drives the timeline is whichever critical-path stage contributes the
        // most business days to the chain's length.
        const driver = nonNA.filter(s => schedule[s.id]?.critical).reduce((best, s) => {
          const dur = Number(s.duration) || 0
          if (!best || dur > (Number(best.duration) || 0)) return s
          return best
        }, null)
        const dueDate = parseDueDate(q.due)
        const pastDue = dueDate && projectedEnd && fromISODate(projectedEnd) > dueDate

        const parts = [`- ${q.name}${q.site ? ` (${q.site})` : ''}`]
        parts.push(`status: ${q.status || 'not_started'}`)
        parts.push(`projected: ${projectedEnd || 'n/a'}${pastDue ? ` [PAST DUE — due ${q.due}]` : ''}`)
        parts.push(`progress: ${doneCount}/${nonNA.length} stages`)
        parts.push(`overdue stages: ${overdue.length}`)
        parts.push(`in flight: ${inFlight.length ? inFlight.map(s => s.title).join(', ') : 'none'}`)
        parts.push(`critical path driver: ${driver ? `${driver.title} (${driver.duration ?? 0}bd)` : 'n/a'}`)
        return parts.join(' | ')
      }).join('\n')

      const horizonLines = horizonEvents.length
        ? horizonEvents.map(ev => `- ${ev.start_date} ${ev.title}${ev.type==='travel'?' (travel)':''}`).join('\n') : ''

      const systemPrompt = `You are a personal assistant to a Global Quality Systems Director at a pharmaceutical and nutraceutical contract manufacturing company. You generate concise, professional daily briefings based on live task and calendar data. Your tone is direct, warm, and occasionally witty. No em dashes. Short paragraphs. Bullets for multiple items. Never use the words "KPI" or "KQI" — always say "KQM" (Key Quality Metrics).`

      const userPrompt = `Generate a daily briefing for today, ${dateStr}.

Today's calendar events:
${calLines}

Active tasks (with days since last update):
${taskLines}

Waiting tasks (blocked on someone or something outside Levi's control — each line gives who/what it's waiting
on and how many days it's been waiting; briefing-worthiness is entirely about that day count, not the content.
A wait of a couple of days is completely normal and not worth mentioning. A wait stretching toward a week or
more, especially with no owner chasing it, is worth a nudge):
${waitingLines}${qualLines ? `\n\nSupplier qualifications:\n${qualLines}` : ''}${horizonLines ? `\n\nUpcoming (next 14 days):\n${horizonLines}` : ''}

Format the briefing exactly in this order with these section headers:

## Good morning, Levi.
3 to 5 sentences summarizing the day's tone, key priorities, and anything worth flagging. Be specific — reference actual tasks and events by name. If travel is coming up within 3 days, mention it.

## Quote of the day
One motivational or leadership quote relevant to quality, leadership, or the nature of the day's work. Format as: "Quote text." — Author Name

## Did you know?
One genuinely interesting fact on any topic. Keep it to 2-3 sentences. Make it something worth remembering.

## Action required
Tasks flagged red, substatus at_risk, or with open subtasks; qualification stages that are overdue; any qualification whose projected completion has slipped past its due date; and any waiting task whose wait has stretched to an unreasonable length (use judgment — roughly a week or more with no sign of movement, longer if it's waiting on something that's normally slow). For each item lead with the task, stage, or qualification name in bold, then one sentence on why it needs attention and what the next action is — for a stale wait, that action is usually "follow up with X." If nothing qualifies, omit this section entirely.

## Qualifications
Only include this section if supplier qualification data was provided above. Summarize each qualification's status and projected completion, and call out anything overdue or slipping past its due date — reference the critical path driver by name when a qualification's timeline is being driven by a specific stage. If no qualification data was provided, omit this section entirely.

## Suggestions
3 to 5 opinionated, specific bullets on what Levi should focus on, follow up on, or decide today. Go beyond the active task list — use the "days since last update" figures to call out active tasks that have gone genuinely stale (not just old), use the "waiting N days" figures to flag waits worth a check-in even if they don't rise to Action required, flag a qualification stage or critical path driver worth checking on, note if a team member may need a check-in, or call out a strategic initiative that's stalling. Be direct and useful, not generic.

## On your calendar
Bullet list of today's events with times and duration. If none, write "No meetings scheduled — good day to focus."

## On the horizon
Anything with a due date in the next 14 days, upcoming travel, or recurring deadlines (KQM Data Entry, KQM Report). Format as a simple dated list.

Important rules:
- You MUST include every section above using the exact ## headers shown. Never omit Quote of the day or Did you know — they are always required. Qualifications and Action required are the only sections you may omit, and only when their conditions say to.
- Use actual task, stage, and qualification titles, not generic descriptions.
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
function FollowUpsTab({ followUps, onAdd, onToggle, onDelete, onUpdate, onCreateTask, onOpenTask, onReorderFollowUps, onReorderTasks, people = DEFAULT_FOLLOW_UP_PEOPLE, tasks = [], entityMap = {}, isMobile = false }) {
  const [activePerson, setActivePerson] = useState(null)
  const [showDone, setShowDone] = useState(false)
  const [addingFor, setAddingFor] = useState(null)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const dragRef = useRef(null)            // { id, listKey, kind:'task'|'item' }
  const [dropTarget, setDropTarget] = useState(null) // { listKey, overId, pos }

  const startEdit = item => { setEditingId(item.id); setEditText(item.text) }
  const commitEdit = id => {
    const trimmed = editText.trim()
    if (trimmed) onUpdate(id, trimmed)
    else onDelete(id)
    setEditingId(null); setEditText('')
  }

  const extraPeople = [...new Set(followUps.map(f => f.person))].filter(p => p && !people.includes(p))
  // 'Levi' is the current user — you don't follow up with yourself
  const allPeople = [...people, ...extraPeople].filter(p => p !== 'Levi')

  const pendingFor = p => followUps.filter(f => f.person === p && !f.done).length
  const itemsFor = p => followUps.filter(f => f.person === p && (showDone || !f.done))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (new Date(a.created_at) - new Date(b.created_at)))
  const tss = t => t.status === 'waiting' ? 'waiting' : (t.substatus || (t.status === 'done' ? 'complete' : 'not_started'))
  const tasksFor = p => tasks.filter(t => (t.owners||[]).includes(p) && tss(t) !== 'complete' && tss(t) !== 'canceled')
  const visiblePeople = activePerson ? [activePerson] : allPeople

  const handleAdd = person => {
    if (!newText.trim()) return
    onAdd(newText.trim(), person)
    setNewText(''); setAddingFor(null)
  }

  // ── Drag-and-drop reordering within a single column/list ──
  // Tasks: reuse the sub-list's own sort_order values, reassigned to the new sequence (only these tasks move relative to each other)
  const reorderTasks = (list, draggedId, overId, pos) => {
    if (!onReorderTasks) return
    const orders = list.map(t => t.sort_order || 0).slice().sort((a, b) => a - b)
    const ids = list.map(x => x.id).filter(id => id !== draggedId)
    let idx = overId ? ids.indexOf(overId) : ids.length; if (idx < 0) idx = ids.length; if (pos === 'after') idx++
    ids.splice(idx, 0, draggedId)
    onReorderTasks(ids.map((id, k) => ({ id, sort_order: orders[k] })))
  }
  // Follow-up items: index-based order within the person's list
  const reorderItems = (list, draggedId, overId, pos) => {
    if (!onReorderFollowUps) return
    const ids = list.map(x => x.id).filter(id => id !== draggedId)
    let idx = overId ? ids.indexOf(overId) : ids.length; if (idx < 0) idx = ids.length; if (pos === 'after') idx++
    ids.splice(idx, 0, draggedId)
    onReorderFollowUps(ids.map((id, k) => ({ id, sort_order: k })))
  }
  const rowDrag = (id, listKey, kind, list) => ({
    draggable: true,
    onDragStart: e => { e.stopPropagation(); dragRef.current = { id, listKey, kind }; e.dataTransfer.effectAllowed = 'move' },
    onDragEnd: () => { dragRef.current = null; setDropTarget(null) },
    onDragOver: e => { const d = dragRef.current; if (d && d.kind === kind && d.listKey === listKey && d.id !== id) { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setDropTarget({ listKey, overId: id, pos: e.clientY < r.top + r.height / 2 ? 'before' : 'after' }) } },
    onDrop: e => { const d = dragRef.current; if (d && d.kind === kind && d.listKey === listKey) { e.preventDefault(); (kind === 'task' ? reorderTasks : reorderItems)(list, d.id, id, dropTarget?.pos || 'before') } dragRef.current = null; setDropTarget(null) },
  })
  const dropInd = <div style={{ height:2, borderRadius:1, background:'#7c3aed', margin:'0 0 3px' }} />
  const mark = (listKey, id) => ({ before: dropTarget?.listKey === listKey && dropTarget?.overId === id && dropTarget?.pos === 'before', after: dropTarget?.listKey === listKey && dropTarget?.overId === id && dropTarget?.pos === 'after' })
  // Touch devices can't drag (HTML5 DnD is mouse-only), so mobile gets up/down arrows instead
  const arrowMove = (list, i, dir, kind) => { const j = i + dir; if (j < 0 || j >= list.length) return; (kind === 'task' ? reorderTasks : reorderItems)(list, list[i].id, list[j].id, dir < 0 ? 'before' : 'after') }
  const mArrows = (list, i, kind) => (isMobile && list.length > 1) ? (
    <div style={{ display:'flex', flexDirection:'column', flexShrink:0 }}>
      <button onClick={e => { e.stopPropagation(); arrowMove(list, i, -1, kind) }} disabled={i === 0} title="Move up"
        style={{ background:'none', border:'none', cursor:i===0?'default':'pointer', color:i===0?'#e8e8e8':'#bbb', fontSize:11, lineHeight:1, padding:'0 5px' }}>▲</button>
      <button onClick={e => { e.stopPropagation(); arrowMove(list, i, 1, kind) }} disabled={i === list.length-1} title="Move down"
        style={{ background:'none', border:'none', cursor:i===list.length-1?'default':'pointer', color:i===list.length-1?'#e8e8e8':'#bbb', fontSize:11, lineHeight:1, padding:'0 5px' }}>▼</button>
    </div>
  ) : null

  const taskRow = (t, list, listKey) => {
    const ss = subStyle(tss(t))
    const m = mark(listKey, t.id)
    return (
      <div key={t.id}>
        {m.before && dropInd}
        <div {...rowDrag(t.id, listKey, 'task', list)}
          onDoubleClick={() => onOpenTask && onOpenTask(t)} title={onOpenTask ? 'Drag to reorder · double-click to open' : 'Drag to reorder'}
          style={{ display:'flex', alignItems:'center', gap:7, padding:'5px 8px', background:'white', borderRadius:6, border:'0.5px solid #ebebeb', marginBottom:3, cursor:'grab' }}>
          <div style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, background:ss.bg, border:`1px solid ${ss.border}` }} />
          <span style={{ flex:1, fontSize:12, color:'#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
          <span style={{ fontSize:10, color:ss.tc, background:ss.bg, border:`0.5px solid ${ss.border}`, borderRadius:10, padding:'1px 6px', whiteSpace:'nowrap', flexShrink:0 }}>{ss.label}</span>
          {mArrows(list, list.findIndex(x => x.id === t.id), 'task')}
        </div>
        {m.after && dropInd}
      </div>
    )
  }
  // Group a person's tasks: loose tasks stay flat; tasks tied to a project/bundle/escalation/qualification cluster inside a titled container (as on the task page)
  const renderAssigned = (pt, person) => {
    const standalone = []
    const byLink = {}
    pt.forEach(t => {
      const lid = t.project_id || t.escalation_id || t.qualification_id
      if (lid && entityMap[lid]) (byLink[lid] = byLink[lid] || []).push(t)
      else standalone.push(t)
    })
    const linkIds = Object.keys(byLink).sort((a, b) => (entityMap[a]?.name || '').localeCompare(entityMap[b]?.name || ''))
    return (
      <>
        {standalone.map(t => taskRow(t, standalone, `${person}:std`))}
        {linkIds.map(lid => {
          const ent = entityMap[lid]
          const cbg = flagBg(ent?.color) || '#f4f2ec'
          const cbd = flagBorder(ent?.color) || '#d8d4c8'
          return (
            <div key={lid} style={{ border:`1px solid ${cbd}`, borderRadius:8, padding:'6px 6px 3px', marginBottom:4, background:cbg }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 3px 5px' }}>
                <span style={{ flex:'1 1 auto', minWidth:0, fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ent?.name || 'Linked'}</span>
                <span style={{ fontSize:9, color:'#888', background:'white', border:`0.5px solid ${cbd}`, borderRadius:8, padding:'0 6px', flexShrink:0 }}>{byLink[lid].length}</span>
              </div>
              {byLink[lid].map(t => taskRow(t, byLink[lid], `${person}:link:${lid}`))}
            </div>
          )
        })}
      </>
    )
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
          const pt = tasksFor(person)
          if (!activePerson && items.length === 0 && pt.length === 0) return null
          const mc = MEMBER_COLORS[person]
          const colHeading = txt => <div style={{ fontSize:10, fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:7 }}>{txt}</div>
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

              <div style={{ display:'flex', gap:14, flexWrap:'wrap', alignItems:'flex-start' }}>
                {/* Column 1 — assigned tasks (double-click to open) */}
                <div style={{ flex:'1 1 240px', minWidth:0 }}>
                  {colHeading(`Assigned tasks${pt.length ? ` · ${pt.length}` : ''}`)}
                  {pt.length === 0
                    ? <div style={{ fontSize:12, color:'#bbb', padding:'2px 0' }}>No assigned tasks</div>
                    : renderAssigned(pt, person)}
                </div>

                {/* Column 2 — follow-up items */}
                <div style={{ flex:'1 1 240px', minWidth:0 }}>
                  {colHeading('Follow-up items')}
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
                    <div style={{ fontSize:12, color:'#bbb', padding:'2px 0' }}>No pending follow-ups — click + Add to create one</div>
                  )}
                  {items.map((item, idx) => {
                    const m = mark(`${person}:items`, item.id)
                    const dh = editingId === item.id ? {} : rowDrag(item.id, `${person}:items`, 'item', items)
                    return (
                    <div key={item.id}>
                      {m.before && dropInd}
                      <div {...dh}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 8px', background:item.done?'transparent':'white', borderRadius:6, border:item.done?'none':'0.5px solid #ebebeb', marginBottom:4, cursor: editingId===item.id ? 'default' : 'grab' }}
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
                      {editingId !== item.id && mArrows(items, idx, 'item')}
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
                      {m.after && dropInd}
                    </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
        {visiblePeople.every(p => itemsFor(p).length === 0 && tasksFor(p).length === 0) && !activePerson && (
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

// Curated palettes for domain section customization — soft tints for the card, readable darks for the header
const DOMAIN_SHADES = [
  '#fee2e2', '#ffe4e6', '#fce7f3', '#fae8ff', '#f3e8ff', '#ede9fe', '#e0e7ff', '#dbeafe',
  '#e0f2fe', '#cffafe', '#ccfbf1', '#d1fae5', '#dcfce7', '#ecfccb', '#fef9c3', '#fef3c7',
  '#ffedd5', '#fee2d5', '#f5f5f4', '#f4f2ec', '#ede9e3', '#e7e5e4', '#e5e7eb', '#dbe4ee',
]
const DOMAIN_TEXT_COLORS = [
  '#991b1b', '#be123c', '#be185d', '#a21caf', '#7e22ce', '#6d28d9', '#4338ca', '#1d4ed8',
  '#0369a1', '#0e7490', '#0f766e', '#047857', '#15803d', '#4d7c0f', '#a16207', '#b45309',
  '#c2410c', '#7f1d1d', '#111111', '#374151', '#57534e', '#6b7280', '#0c4a6e', '#3f6212',
]

function DomainColorPopover({ name, meta, onUpdate, onClose }) {
  const grid = (label, current, options, key) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</span>
        <button onClick={() => onUpdate({ [key]: null })} title={`Reset ${label.toLowerCase()} to default`}
          style={{ fontSize:10, padding:'1px 8px', borderRadius:8, border:'0.5px solid #e0e0e0', background: current ? 'white' : '#ede9fe', color: current ? '#888' : '#7c3aed', cursor:'pointer', fontWeight: current ? 400 : 600 }}>
          Default
        </button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8, 20px)', gap:4 }}>
        {options.map(c => (
          <button key={c} onClick={() => onUpdate({ [key]: c })} title={c}
            style={{ width:20, height:20, borderRadius:5, background:c, border: current === c ? '2px solid #7c3aed' : '1px solid rgba(0,0,0,0.08)', cursor:'pointer', padding:0, boxSizing:'border-box' }} />
        ))}
      </div>
    </div>
  )
  return (
    <>
      <div onClick={e => { e.stopPropagation(); onClose() }} style={{ position:'fixed', inset:0, zIndex:150 }} />
      <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
        style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, padding:10, width:206 }}>
        <div style={{ fontSize:10, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:8, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
        {grid('Section shade', meta.color, DOMAIN_SHADES, 'color')}
        {grid('Header text', meta.text_color, DOMAIN_TEXT_COLORS, 'text_color')}
      </div>
    </>
  )
}

function Row({ t, hideLinked, listTasks, listId, v, gridReorder }) {
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
  // In a multi-column grid (e.g. Today), tasks sit side-by-side, so before/after must be judged left↔right, not top↕bottom
  return (
    <div data-tid={t.id} style={{ marginBottom:4 }}>
      {rowDrop && rowDrop.overId === t.id && rowDrop.pos === 'before' && dropInd('before')}
      <div draggable onClick={() => v.onEdit(t)}
        onDragStart={e => { e.stopPropagation(); v.dragTaskRef.current = t.id; e.dataTransfer.setData('text/task', t.id); if (listId) e.dataTransfer.setData('text/fromlist', listId); e.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => { v.dragTaskRef.current = null; v.setRowDrop(null); v.clearOutlines() }}
        onDragOver={e => { const d = v.dragTaskRef.current; if (d && d !== t.id && siblingIds.includes(d)) { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); const before = gridReorder ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2; v.setRowDrop({ overId: t.id, pos: before ? 'before' : 'after' }) } }}
        onDrop={e => { const d = v.dragTaskRef.current; if (d && siblingIds.includes(d) && listId) { e.preventDefault(); e.stopPropagation(); v.reorderTo(siblings, d, t.id, rowDrop?.pos || 'before', listId) } v.dragTaskRef.current = null; v.setRowDrop(null) }}
        style={{ display:'flex', alignItems:'center', gap:9, padding:'6px 10px', background:'white', borderRadius:8, border:'0.5px solid #ebebeb', borderLeft: fb ? `3px solid ${fb}` : '0.5px solid #ebebeb', cursor:'pointer' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = fb || '#d8d8d8'; if (fb) e.currentTarget.style.borderLeftColor = fb }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#ebebeb'; if (fb) e.currentTarget.style.borderLeftColor = fb }}>
        <div onClick={e => { e.stopPropagation(); v.onComplete(t.id, !done) }} title="Toggle complete"
          style={{ width:15, height:15, borderRadius:'50%', border:`1.5px solid ${ss.border||'#ccc'}`, background: done ? (ss.bg||'#eee') : 'white', flexShrink:0, boxSizing:'border-box', cursor:'pointer' }} />
        <span style={{ flex:1, minWidth:0, fontSize:12, color: done?'#aaa':'#222', textDecoration: done?'line-through':'none', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.35 }}>
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
          {t.status === 'waiting' && t.waiting_on && <Badge type="waiting">waiting on: {t.waiting_on}</Badge>}
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
      <div style={{ background:'white', borderRadius:8, border:'0.5px solid #ebebeb', borderLeft: fb ? `3px solid ${fb}` : '0.5px solid #ebebeb', marginBottom:4, padding:'8px 10px' }}>
      <div draggable onDragStart={ev => { v.dragEntRef.current = e.id; ev.dataTransfer.setData('text/ent', e.id); ev.dataTransfer.effectAllowed = 'move' }}
        onDragEnd={() => { v.dragEntRef.current = null; v.setEntDrop(null) }}
        onDoubleClick={() => v.onOpenEscalation && v.onOpenEscalation(e)} title="Drag to reorder · double-click to open"
        style={{ display:'flex', alignItems:'center', gap:10, cursor:'grab' }}>
        <span style={{ flex:1, minWidth:0, fontSize:12, fontWeight:500, color:'#222', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.3 }}>{e.title}</span>
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

function TaskLinearMockup({ tasks, entityMap = {}, domains = [], domainMeta = {}, memberNames = [], escalations = [], isMobile = false, prefs = {}, savePref = () => {}, onEdit, onComplete, onOpenEscalation, onOpenProject, onOpenQualification, onUpdateTasks, onRestoreTask, onDeleteTask, onAddTask, onAddEscalation, onAddDomain, onUpdateDomainMeta, onOpenClassic }) {
  const [groupBy, setGroupByState] = useState(() => prefs.group ?? localStorage.getItem('taskr-linear-group') ?? 'domain')
  const setGroupBy = k => { setGroupByState(k); savePref('group', k); try { localStorage.setItem('taskr-linear-group', k) } catch {} }
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
  const [hiddenDomains, setHiddenDomains] = useState(() => { try { return new Set(prefs.hiddenDomains ?? JSON.parse(localStorage.getItem('taskr-linear-hidden-domains') || 'null') ?? []) } catch { return new Set(prefs.hiddenDomains || []) } })
  const hideDomain = key => setHiddenDomains(prev => { const n = new Set(prev); n.add(key); savePref('hiddenDomains', [...n]); try { localStorage.setItem('taskr-linear-hidden-domains', JSON.stringify([...n])) } catch {} return n })
  const unhideDomain = key => setHiddenDomains(prev => { const n = new Set(prev); n.delete(key); savePref('hiddenDomains', [...n]); try { localStorage.setItem('taskr-linear-hidden-domains', JSON.stringify([...n])) } catch {} return n })
  const [colorEditKey, setColorEditKey] = useState(null)
  const [hiddenOwners, setHiddenOwners] = useState(() => { try { return new Set(prefs.hiddenOwners ?? JSON.parse(localStorage.getItem('taskr-linear-hidden-owners') || 'null') ?? []) } catch { return new Set(prefs.hiddenOwners || []) } })
  const persistHidden = n => { savePref('hiddenOwners', [...n]); try { localStorage.setItem('taskr-linear-hidden-owners', JSON.stringify([...n])) } catch {} }
  const toggleOwnerVis = name => setHiddenOwners(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); persistHidden(n); return n })
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false)
  const [sortCol, setSortCol] = useState('title')
  const [sortDir, setSortDir] = useState('asc')
  const [colFilters, setColFilters] = useState({ status:'', domain:'', owner:'' })
  const [colsByGroup, setColsByGroup] = useState(() => { try { return prefs.cols ?? JSON.parse(localStorage.getItem('taskr-linear-cols') || 'null') ?? {} } catch { return prefs.cols || {} } })
  const [numCols, setNumColsState] = useState(() => { if (prefs.numcols >= 1 && prefs.numcols <= 8) return prefs.numcols; const n = parseInt(localStorage.getItem('taskr-linear-numcols'), 10); return n >= 1 && n <= 8 ? n : LINEAR_NCOL })
  const setNumCols = n => { const clamped = Math.max(1, Math.min(8, n)); setNumColsState(clamped); savePref('numcols', clamped); try { localStorage.setItem('taskr-linear-numcols', String(clamped)) } catch {} }
  const [orders, setOrders] = useState(() => { try { return prefs.order ?? JSON.parse(localStorage.getItem('taskr-linear-order') || 'null') ?? {} } catch { return prefs.order || {} } })
  const [minimized, setMinimized] = useState(() => { try { return new Set(prefs.min ?? JSON.parse(localStorage.getItem('taskr-linear-min') || 'null') ?? []) } catch { return new Set(prefs.min || []) } })
  const [openNotes, setOpenNotes] = useState(() => new Set())
  const toggleNotes = id => setOpenNotes(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const persistMin = n => { savePref('min', [...n]); try { localStorage.setItem('taskr-linear-min', JSON.stringify([...n])) } catch {} }
  const isMin = id => minimized.has(id)
  const toggleMin = id => setMinimized(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); persistMin(n); return n })
  const [drag, setDrag] = useState(null)          // { key, x, y, offsetX, offsetY, w }
  const [dropTarget, setDropTarget] = useState(null) // { col, index }
  const [rowDrop, setRowDrop] = useState(null)    // { overId, pos } — within-list reorder indicator (tasks + project/bundle clusters share this)
  const [entDrop, setEntDrop] = useState(null)    // { overId, pos } — escalation reorder indicator
  const containerRef = useRef(null)
  const dragRef = useRef(null)
  const dropRef = useRef(null)
  const dragTaskRef = useRef(null)                // id of the block being dragged — a task id, or `proj:<pid>` for a cluster (for reorder detection)
  const dragEntRef = useRef(null)                 // id of escalation being dragged (for reorder)

  const tss = t => t.status === 'waiting' ? 'waiting' : (t.substatus || (t.status === 'done' ? 'complete' : 'not_started'))
  const ownerMatch = t => { if (hiddenOwners.size === 0) return true; const o = t.owners || []; return o.some(n => !hiddenOwners.has(n)) }
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
    savePref('order', next)
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
  const blockOrderId = sectionKey => `blocks:${groupBy}:${sectionKey}`
  // A task clusters under its project/bundle OR its qualification (whichever it's linked to)
  const linkOf = t => t.project_id ? { id: t.project_id, kind: 'project' } : t.qualification_id ? { id: t.qualification_id, kind: 'qualification' } : null
  const clusterBlockId = (kind, lid) => (kind === 'project' ? 'proj:' : 'qual:') + lid
  // Loose tasks and project/qualification clusters live in ONE reorderable list per section, so either can be dragged above the other.
  // Each block is { id, type:'task'|'cluster', ... }; a task block's id is the task id, a cluster block's id is `proj:<id>` or `qual:<id>`.
  const buildBlocks = (list, sectionKey) => {
    const stdOrdered = orderList(mainListId(sectionKey), list.filter(t => !linkOf(t)))
    const byLink = {}
    list.forEach(t => { const l = linkOf(t); if (l) { (byLink[l.id] = byLink[l.id] || { kind: l.kind, ts: [] }).ts.push(t) } })
    const rawClusters = Object.entries(byLink).sort((a, b) => (entityMap[a[0]]?.name || '').localeCompare(entityMap[b[0]]?.name || ''))
    const clusterOrdered = orderList(`clustord:${groupBy}:${sectionKey}`, rawClusters.map(([lid, o]) => ({ id: clusterBlockId(o.kind, lid), lid, kind: o.kind, ts: o.ts })))
    const defaultBlocks = [
      ...stdOrdered.map(t => ({ id: t.id, type: 'task', task: t })),
      ...clusterOrdered.map(c => ({ id: c.id, type: 'cluster', lid: c.lid, kind: c.kind, ts: c.ts })),
    ]
    return orderList(blockOrderId(sectionKey), defaultBlocks)
  }
  const handleSectionDrop = (e, g) => {
    e.preventDefault()
    e.currentTarget.style.outline = 'none'
    const taskId = e.dataTransfer.getData('text/task')
    const taskIds = e.dataTransfer.getData('text/tasks')
    const clusterId = e.dataTransfer.getData('text/cluster') // pid of a dragged cluster
    if (taskId) {
      if (groupBy === 'project') {
        const listForReorder = orderList(mainListId(g.key), g.tasks || [])
        if (listForReorder.some(t => t.id === taskId)) reorderTo(listForReorder, taskId, null, 'after', mainListId(g.key))
        else applyMove([taskId], g.key)
      } else if ((g.tasks || []).some(t => t.id === taskId && !t.project_id)) {
        // a loose task already in this section, dropped in empty space → send it to the end of the unified block list
        reorderTo(buildBlocks(g.tasks || [], g.key), taskId, null, 'after', blockOrderId(g.key))
      } else if (groupBy === 'owner') {
        moveTaskToOwner(taskId, g.key, e.dataTransfer.getData('text/fromlist'))
      } else {
        applyMove([taskId], g.key)
      }
    } else if (clusterId && (g.tasks || []).some(t => t.project_id === clusterId || t.qualification_id === clusterId)) {
      // a cluster dropped in this section's empty space → send it to the end of the unified block list
      const kind = (g.tasks || []).some(t => t.project_id === clusterId) ? 'project' : 'qualification'
      reorderTo(buildBlocks(g.tasks || [], g.key), clusterBlockId(kind, clusterId), null, 'after', blockOrderId(g.key))
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
  // Domains that exist but aren't currently on the board (dismissed while empty) — offered as quick "add back" options
  const hiddenDomainOpts = groupBy === 'domain' ? domains.filter(d => !keys.includes(d)).sort((a, b) => a.localeCompare(b)) : []

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

  const persist = next => { setColsByGroup(next); savePref('cols', next); try { localStorage.setItem('taskr-linear-cols', JSON.stringify(next)) } catch {} }
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

  // Within a category, cluster tasks that belong to a project/bundle/qualification into a titled container
  const renderTasks = (list, sectionKey) => {
    // In project grouping the section already IS the project, so render flat — except the "No project" bucket, which still clusters qualifications
    if (groupBy === 'project' && sectionKey !== '__none') {
      const ordered = orderList(mainListId(sectionKey), list)
      return ordered.map(t => <Row key={t.id} t={t} listTasks={ordered} listId={mainListId(sectionKey)} v={v} />)
    }
    const blockKey = blockOrderId(sectionKey)
    const blocks = buildBlocks(list, sectionKey)
    const blockIds = blocks.map(b => b.id)
    const cInd = pos => <div style={{ height:3, borderRadius:2, background:'linear-gradient(90deg,#7c3aed,#a855f7)', margin: pos === 'before' ? '0 0 4px' : '4px 0 0' }} />
    return (
      <>
        {blocks.map(b => {
          if (b.type === 'task') return <Row key={b.id} t={b.task} listTasks={blocks} listId={blockKey} v={v} />
          const lid = b.lid, kind = b.kind, blockId = b.id
          const clusterListId = `${groupBy}:${sectionKey}:${blockId}`
          const ts = orderList(clusterListId, b.ts)
          const ent = entityMap[lid]
          const cbg = flagBg(ent?.color) || '#f4f2ec'
          const cbd = flagBorder(ent?.color) || '#d8d4c8'
          const pnotes = Array.isArray(ent?.notes) ? ent.notes : []
          const id = clusterListId // section-specific collapse id
          const open = !isMin(id)
          return (
            <div key={blockId}
              onDragOver={e => { const d = dragTaskRef.current; if (d && d !== blockId && blockIds.includes(d)) { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setRowDrop({ overId: blockId, pos: e.clientY < r.top + r.height / 2 ? 'before' : 'after' }) } }}
              onDrop={e => { const d = dragTaskRef.current; if (d && d !== blockId && blockIds.includes(d)) { e.preventDefault(); e.stopPropagation(); reorderTo(blocks, d, blockId, rowDrop?.pos || 'before', blockKey) } dragTaskRef.current = null; setRowDrop(null) }}>
              {rowDrop && rowDrop.overId === blockId && rowDrop.pos === 'before' && cInd('before')}
              <div style={{ border:`1px solid ${cbd}`, borderRadius:8, padding: open ? '7px 7px 3px' : '7px', marginBottom:4, background:cbg }}>
                <div draggable onDragStart={e => { e.stopPropagation(); dragTaskRef.current = blockId; e.dataTransfer.setData('text/tasks', ts.map(x => x.id).join(',')); e.dataTransfer.setData('text/cluster', lid); e.dataTransfer.effectAllowed = 'move' }}
                  onDragEnd={() => { dragTaskRef.current = null; setRowDrop(null); clearOutlines() }}
                  onDoubleClick={() => kind === 'project' ? (onOpenProject && onOpenProject(lid)) : (onOpenQualification && onOpenQualification(lid))} title="Drag to reorder · double-click to open"
                  style={{ display:'flex', alignItems:'center', gap:6, padding: open ? '0 3px 6px' : '0 3px', cursor:'grab' }}>
                  <span style={{ flex:'1 1 auto', minWidth:0, fontSize:9, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', color:'#555', display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{ent?.name || (kind === 'project' ? 'Project' : 'Qualification')}</span>
                  <span style={{ fontSize:9, color:'#888', background:'white', border:`0.5px solid ${cbd}`, borderRadius:8, padding:'0 6px', flexShrink:0 }}>{ts.length}</span>
                  {pnotes.length > 0 && <span style={{ fontSize:9, color:'#999', display:'inline-flex', alignItems:'center', gap:2 }}><StickyNote size={10} strokeWidth={2} /> {pnotes.length}</span>}
                  {linHeaderRight(onAddTask && linAddIconBtn(() => onAddTask(kind === 'project' ? { project_id: lid, ...addPrefill(sectionKey) } : { qualification_id: lid, domain: 'Supplier Qualification', ...addPrefill(sectionKey) })), chevronBtn(open, () => toggleMin(id)))}
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
              {rowDrop && rowDrop.overId === blockId && rowDrop.pos === 'after' && cInd('after')}
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
        {/* Member filter — multi-select show/hide (same pattern as the Holidays dropdown) */}
        <div style={{ position:'relative' }}>
          {(() => { const narrowed = hiddenOwners.size > 0; const visibleCount = memberNames.filter(m => !hiddenOwners.has(m)).length; return (
            <button onClick={() => setOwnerMenuOpen(o => !o)} title="Show/hide members"
              style={{ fontSize:11, background: narrowed ? 'linear-gradient(135deg,#4f46e5,#7c3aed)' : 'white', border: narrowed ? 'none' : '0.5px solid #c4b5fd', borderRadius:10, padding:'4px 10px', cursor:'pointer', height:26, color: narrowed ? 'white' : '#7c3aed', display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
              <span>👥 Members{narrowed ? ` · ${visibleCount}` : ''}</span><span style={{ fontSize:9, opacity:0.7 }}>▾</span>
            </button>
          )})()}
          {ownerMenuOpen && (
            <>
              <div onClick={() => setOwnerMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, minWidth:170, maxHeight:300, overflowY:'auto', padding:6 }}>
                <div style={{ display:'flex', gap:4, marginBottom:6, paddingBottom:6, borderBottom:'0.5px solid #f0f0f0' }}>
                  <button onClick={() => { const n = new Set(); setHiddenOwners(n); persistHidden(n) }}
                    style={{ flex:1, fontSize:11, padding:'4px 0', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', color:'#555' }}>All</button>
                  <button onClick={() => { const n = new Set(memberNames); setHiddenOwners(n); persistHidden(n) }}
                    style={{ flex:1, fontSize:11, padding:'4px 0', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', color:'#555' }}>None</button>
                </div>
                {memberNames.map(name => { const vis = !hiddenOwners.has(name); return (
                  <button key={name} onClick={() => toggleOwnerVis(name)}
                    style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', padding:'6px 8px', background:'none', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}
                    onMouseEnter={e => e.currentTarget.style.background='#f5f5f3'}
                    onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <OwnerPip name={name} />
                    <span style={{ flex:1, color: vis ? '#333' : '#aaa' }}>{name}</span>
                    {vis && <span style={{ fontSize:11, color:'#7c3aed' }}>✓</span>}
                  </button>
                )})}
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
                  {td.map(t => <Row key={t.id} t={t} listTasks={td} listId="today" v={v} gridReorder={!isMobile} />)}
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
            <div style={{ maxWidth:320, marginBottom:12 }}>
              {hiddenDomainOpts.length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>Add back to board</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {hiddenDomainOpts.map(d => (
                      <button key={d} onClick={() => unhideDomain(d)} title="Show this domain on the board again"
                        style={{ fontSize:12, padding:'3px 10px', borderRadius:14, border:'0.5px solid #c4b5fd', background:'#ede9fe', color:'#7c3aed', cursor:'pointer', fontFamily:'inherit' }}>
                        + {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {hiddenDomainOpts.length > 0 && <div style={{ fontSize:10, color:'#aaa', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>New domain</div>}
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
function NotesSection({ notes, onSaveNote, onDeleteNote, noteGroups, onSaveGroup, onRenameGroup, onDeleteGroup, onMoveNote, onReorderNotes, onReorderGroups, onDuplicateNote, members = [] }) {
  return <NotesTab notes={notes} onSave={onSaveNote} onDelete={onDeleteNote} groups={noteGroups} onSaveGroup={onSaveGroup} onRenameGroup={onRenameGroup} onDeleteGroup={onDeleteGroup} onMoveNote={onMoveNote} onReorderNotes={onReorderNotes} onReorderGroups={onReorderGroups} onDuplicate={onDuplicateNote} members={members} />
}

// ─── Notes Tab ───────────────────────────────────────────────────────────────
function NotesTab({ notes, onSave, onDelete, groups = [], onSaveGroup, onRenameGroup, onDeleteGroup, onMoveNote, onReorderNotes, onReorderGroups, onDuplicate, members = [] }) {
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
  const [addingSubFor, setAddingSubFor] = useState(null) // parent group id we're adding a subgroup to
  const [newSubName, setNewSubName] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState(() => { try { return new Set(JSON.parse(localStorage.getItem('taskr-notes-collapsed')||'[]')) } catch { return new Set() } })
  const toggleCollapse = id => setCollapsedGroups(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); try { localStorage.setItem('taskr-notes-collapsed', JSON.stringify([...n])) } catch {} return n })
  const [dragOverTarget, setDragOverTarget] = useState(null) // group id | 'ungrouped' | null
  const dragNoteRef = useRef(null)
  const dragGroupRef = useRef(null)               // group/subgroup being dragged (sibling reorder)
  const [reorderTarget, setReorderTarget] = useState(null) // { kind:'note'|'group', id, pos }
  const isMobileNotes = window.innerWidth < 640
  // Resizable note-list sidebar (desktop) — width persists per device
  const [sidebarW, setSidebarW] = useState(() => { const v = parseInt(localStorage.getItem('taskr-notes-sidebar-w'), 10); return v >= 160 && v <= 520 ? v : 220 })
  const startSidebarDrag = e => {
    e.preventDefault()
    const startX = e.clientX, startW = sidebarW
    const clamp = w => Math.max(160, Math.min(520, w))
    const onMove = mv => setSidebarW(clamp(startW + mv.clientX - startX))
    const onUp = mv => {
      document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''; document.body.style.cursor = ''
      const w = clamp(startW + mv.clientX - startX)
      try { localStorage.setItem('taskr-notes-sidebar-w', String(w)) } catch {}
    }
    document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize'
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Group tree helpers (one level of nesting: groups → subgroups)
  const topGroups = groups.filter(g => !g.parent_id)
  const subsOf = pid => groups.filter(g => g.parent_id === pid)
  const subtreeIds = gid => new Set([gid, ...subsOf(gid).map(s => s.id)])
  const countFor = gid => { const ids = subtreeIds(gid); return notes.filter(n => ids.has(n.group_id)).length }
  const dropHandlers = targetId => ({
    onDragOver: e => { if (dragNoteRef.current != null) { e.preventDefault(); setDragOverTarget(targetId ?? 'ungrouped') } },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTarget(t => t === (targetId ?? 'ungrouped') ? null : t) },
    onDrop: e => { e.preventDefault(); const nid = dragNoteRef.current || e.dataTransfer.getData('text/note'); if (nid && onMoveNote) onMoveNote(nid, targetId ?? null); dragNoteRef.current = null; setDragOverTarget(null) },
  })
  // ── Drag-to-rearrange: notes within the list, groups/subgroups among siblings ──
  const reorderInd = <div style={{ height:2, borderRadius:1, background:'#7c3aed', margin:'0 8px' }} />
  // Reorder against the FULL note order (not just the filtered view) so per-group drags don't collide
  // with other groups' sort_order — the dense global renumber keeps every view consistent.
  const reorderNoteRelative = (draggedId, targetId, pos) => {
    if (!onReorderNotes || draggedId === targetId) return
    const ids = [...notes].sort(manualNoteCmp).map(n => n.id).filter(id => id !== draggedId)
    let idx = ids.indexOf(targetId); if (idx < 0) return; if (pos === 'after') idx++
    ids.splice(idx, 0, draggedId)
    onReorderNotes(ids.map((id, i) => ({ id, sort_order: i })))
    if (sortKey !== 'manual') { setSortKey('manual'); setSortDir('asc') } // dragging implies a custom order
  }
  // Mobile fallback: nudge a note one slot within the currently visible list
  const moveNoteBy = (nid, dir) => {
    const vis = visibleNotes.map(n => n.id); const i = vis.indexOf(nid); const j = i + dir
    if (i < 0 || j < 0 || j >= vis.length) return
    reorderNoteRelative(nid, vis[j], dir > 0 ? 'after' : 'before')
  }
  // Touch devices can't use HTML5 drag, so rows get ↑/↓ nudge buttons instead
  const mArrow = (label, onClick, disabled) => (
    <button onClick={e => { e.stopPropagation(); onClick() }} disabled={disabled}
      style={{ fontSize:12, lineHeight:1, background:'none', border:'none', cursor: disabled ? 'default' : 'pointer', color: disabled ? '#e0e0e0' : '#999', padding:'4px 5px' }}>{label}</button>
  )
  const noteReorderHandlers = nid => ({
    onDragOver: e => { const d = dragNoteRef.current; if (d && d !== nid) { e.preventDefault(); e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setReorderTarget({ kind:'note', id:nid, pos: e.clientY < r.top + r.height/2 ? 'before' : 'after' }) } },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) setReorderTarget(t => (t?.kind==='note' && t?.id===nid) ? null : t) },
    onDrop: e => { const d = dragNoteRef.current; if (d && d !== nid) { e.preventDefault(); e.stopPropagation(); reorderNoteRelative(d, nid, reorderTarget?.pos || 'before') } dragNoteRef.current = null; setReorderTarget(null); setDragOverTarget(null) },
  })
  const reorderSiblingGroups = (draggedId, targetId, pos) => {
    if (!onReorderGroups) return
    const dragged = groups.find(g => g.id === draggedId), target = groups.find(g => g.id === targetId)
    if (!dragged || !target || (dragged.parent_id || null) !== (target.parent_id || null)) return
    const sibs = (dragged.parent_id ? subsOf(dragged.parent_id) : topGroups).map(g => g.id).filter(id => id !== draggedId)
    let idx = sibs.indexOf(targetId); if (idx < 0) return; if (pos === 'after') idx++
    sibs.splice(idx, 0, draggedId)
    onReorderGroups(sibs.map((id, i) => ({ id, sort_order: i })))
  }
  // Mobile fallback: nudge a group/subgroup one slot among its siblings
  const moveGroupBy = (g, dir) => {
    const sibs = (g.parent_id ? subsOf(g.parent_id) : topGroups).map(x => x.id)
    const i = sibs.indexOf(g.id); const j = i + dir
    if (i < 0 || j < 0 || j >= sibs.length) return
    reorderSiblingGroups(g.id, sibs[j], dir > 0 ? 'after' : 'before')
  }
  // Group rows accept BOTH: a dragged note (move into group) and a dragged sibling group (reorder)
  const groupRowHandlers = g => ({
    draggable: true,
    onDragStart: e => { e.stopPropagation(); dragGroupRef.current = g.id; e.dataTransfer.effectAllowed = 'move' },
    onDragEnd: () => { dragGroupRef.current = null; setReorderTarget(null); setDragOverTarget(null) },
    onDragOver: e => {
      const gd = dragGroupRef.current
      if (gd && gd !== g.id) {
        const dragged = groups.find(x => x.id === gd)
        if (dragged && (dragged.parent_id || null) === (g.parent_id || null)) {
          e.preventDefault(); const r = e.currentTarget.getBoundingClientRect()
          setReorderTarget({ kind:'group', id:g.id, pos: e.clientY < r.top + r.height/2 ? 'before' : 'after' })
        }
        return
      }
      if (dragNoteRef.current != null) { e.preventDefault(); setDragOverTarget(g.id) }
    },
    onDragLeave: e => { if (!e.currentTarget.contains(e.relatedTarget)) { setDragOverTarget(t => t === g.id ? null : t); setReorderTarget(t => (t?.kind==='group' && t?.id===g.id) ? null : t) } },
    onDrop: e => {
      e.preventDefault()
      const gd = dragGroupRef.current
      if (gd && gd !== g.id) reorderSiblingGroups(gd, g.id, reorderTarget?.pos || 'before')
      else { const nid = dragNoteRef.current || e.dataTransfer.getData('text/note'); if (nid && onMoveNote) onMoveNote(nid, g.id) }
      dragGroupRef.current = null; dragNoteRef.current = null; setReorderTarget(null); setDragOverTarget(null)
    },
  })
  const groupMark = gid => ({ before: reorderTarget?.kind==='group' && reorderTarget?.id===gid && reorderTarget?.pos==='before', after: reorderTarget?.kind==='group' && reorderTarget?.id===gid && reorderTarget?.pos==='after' })
  const noteMark = nid => ({ before: reorderTarget?.kind==='note' && reorderTarget?.id===nid && reorderTarget?.pos==='before', after: reorderTarget?.kind==='note' && reorderTarget?.id===nid && reorderTarget?.pos==='after' })
  const renderRenameInput = (g, indent) => (
    <div style={{ padding: indent ? '4px 8px 4px 28px' : '4px 8px' }}>
      <input autoFocus value={renameText} onChange={e => setRenameText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { onRenameGroup(g.id, renameText.trim() || g.name); setRenamingGroupId(null) } if (e.key === 'Escape') setRenamingGroupId(null) }}
        onBlur={() => { onRenameGroup(g.id, renameText.trim() || g.name); setRenamingGroupId(null) }}
        style={{ width:'100%', boxSizing:'border-box', fontSize:12, padding:'4px 8px', border:'0.5px solid #c4b5fd', borderRadius:6, outline:'none' }} />
    </div>
  )
  const renderDelConfirm = g => {
    const cnt = countFor(g.id), hasSubs = subsOf(g.id).length > 0
    return (
      <div style={{ margin:'0 8px 4px', padding:'8px 10px', background:'#fff5f5', border:'0.5px solid #fecaca', borderRadius:8, fontSize:11 }}>
        <div style={{ color:'#991b1b', fontWeight:500, marginBottom:6 }}>Delete "{g.name}"{hasSubs ? ' and its subgroups' : ''}{cnt > 0 ? ` (${cnt} note${cnt > 1 ? 's' : ''})` : ''}?</div>
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
  }
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
  // A selected top-level group shows its own notes plus those in its subgroups; a subgroup shows just its own.
  const activeMatch = (activeGroupId !== undefined && activeGroupId !== null) ? subtreeIds(activeGroupId) : null
  const visibleNotes = notes
    .filter(n => {
      if (activeGroupId === null && n.group_id != null) return false
      if (activeMatch && !activeMatch.has(n.group_id)) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (n.title||'').toLowerCase().includes(q) || stripHtml(n.body).toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortKey === 'manual') return ((a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)) || (new Date(b.created_at) - new Date(a.created_at))
      const cmp = sortKey === 'alpha'
        ? (a.title||'').localeCompare(b.title||'')
        : new Date(a.created_at) - new Date(b.created_at)
      return sortDir === 'desc' ? -cmp : cmp
    })

  const activeGroupLabel = activeGroupId === undefined ? 'All Notes' : activeGroupId === null ? 'Ungrouped' : (groups.find(g => g.id === activeGroupId)?.name || 'Notes')

  const sidebar = (
    <div style={{ width: isMobileNotes ? '100%' : sidebarW, flexShrink:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'8px 12px', borderBottom:'0.5px solid #f0f0f0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7 }}>
          <span style={{ fontSize:12, fontWeight:500, color:'#555' }}>{activeGroupLabel}</span>
          <button onClick={() => handleNew()} style={{ fontSize:11, background:'#111', color:'white', border:'none', borderRadius:6, padding:'6px 12px', cursor:'pointer' }}>+ New</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes…"
          style={{ width:'100%', boxSizing:'border-box', fontSize:13, padding:'7px 10px', border:'0.5px solid #e0e0e0', borderRadius:6, outline:'none', marginBottom:6, color:'#333' }} />
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          {[{k:'date',l:'Date'},{k:'alpha',l:'A–Z'},{k:'manual',l:'Manual'}].map(o => (
            <button key={o.k} onClick={() => { if (o.k==='manual') { setSortKey('manual'); setSortDir('asc') } else if (sortKey===o.k) setSortDir(d => d==='asc'?'desc':'asc'); else { setSortKey(o.k); setSortDir('desc') } }}
              title={o.k==='manual' ? 'Custom order — drag notes to rearrange' : undefined}
              style={{ fontSize:11, padding:'5px 10px', border:'0.5px solid #e0e0e0', borderRadius:6, background:sortKey===o.k?'#111':'white', color:sortKey===o.k?'white':'#666', cursor:'pointer' }}>
              {o.l}{sortKey===o.k && o.k!=='manual' ? (sortDir==='asc'?' ↑':' ↓') : ''}
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
            {/* Ungrouped row (drop target) */}
            {(() => { const over = dragOverTarget === 'ungrouped'; return (
              <div onClick={() => setActiveGroupId(null)} {...dropHandlers(null)}
                style={{ padding:'6px 12px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', background: over ? '#ddd6fe' : activeGroupId === null ? '#ede9fe' : 'transparent', outline: over ? '1.5px dashed #7c3aed' : 'none', outlineOffset:-2 }}>
                <span style={{ fontSize:12, color: activeGroupId === null ? '#7c3aed' : '#555', fontWeight: activeGroupId === null ? 600 : 400 }}>Ungrouped</span>
                <span style={{ fontSize:11, color:'#bbb' }}>{notes.filter(n => !n.group_id).length}</span>
              </div>
            )})()}
            {/* Top-level groups → subgroups */}
            {topGroups.map((g, gIdx) => {
              const subs = subsOf(g.id)
              const collapsed = collapsedGroups.has(g.id)
              const over = dragOverTarget === g.id
              const active = activeGroupId === g.id
              const gm = groupMark(g.id)
              return (
                <div key={g.id}>
                  {gm.before && reorderInd}
                  {renamingGroupId === g.id ? renderRenameInput(g, false) : (
                    <div onClick={() => setActiveGroupId(g.id)} {...groupRowHandlers(g)}
                      style={{ padding:'6px 8px 6px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:2, background: over ? '#ddd6fe' : active ? '#ede9fe' : 'transparent', outline: over ? '1.5px dashed #7c3aed' : 'none', outlineOffset:-2 }}
                      onMouseEnter={e => { if (!active && !over) e.currentTarget.style.background = '#fafafa' }}
                      onMouseLeave={e => { if (!active && !over) e.currentTarget.style.background = 'transparent' }}>
                      {subs.length > 0
                        ? <button onClick={e => { e.stopPropagation(); toggleCollapse(g.id) }} title={collapsed ? 'Expand' : 'Collapse'} style={{ background:'none', border:'none', cursor:'pointer', color:'#bbb', fontSize:10, width:14, padding:0, flexShrink:0, lineHeight:1 }}>{collapsed ? '▸' : '▾'}</button>
                        : <span style={{ width:14, flexShrink:0 }} />}
                      <span style={{ fontSize:12, color: active ? '#7c3aed' : '#555', fontWeight: active ? 600 : 400, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.name}</span>
                      <div style={{ display:'flex', gap:1, alignItems:'center', flexShrink:0 }}>
                        {isMobileNotes && onReorderGroups && <>{mArrow('↑', () => moveGroupBy(g, -1), gIdx === 0)}{mArrow('↓', () => moveGroupBy(g, 1), gIdx === topGroups.length - 1)}</>}
                        <span style={{ fontSize:11, color:'#bbb', marginRight:2 }}>{countFor(g.id)}</span>
                        <button onClick={e => { e.stopPropagation(); setAddingSubFor(g.id); setNewSubName(''); setCollapsedGroups(prev => { const n = new Set(prev); n.delete(g.id); try { localStorage.setItem('taskr-notes-collapsed', JSON.stringify([...n])) } catch {} return n }) }}
                          style={{ fontSize:13, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 3px', lineHeight:1 }} title="Add subgroup">+</button>
                        <button onClick={e => { e.stopPropagation(); setRenamingGroupId(g.id); setRenameText(g.name) }}
                          style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 4px', lineHeight:1 }} title="Rename">✎</button>
                        <button onClick={e => { e.stopPropagation(); setDeletingGroupId(g.id) }}
                          style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 4px', lineHeight:1 }} title="Delete group">✕</button>
                      </div>
                    </div>
                  )}
                  {gm.after && reorderInd}
                  {deletingGroupId === g.id && renderDelConfirm(g)}
                  {/* Subgroups */}
                  {!collapsed && subs.map((sg, sgIdx) => {
                    const sOver = dragOverTarget === sg.id
                    const sActive = activeGroupId === sg.id
                    const sgm = groupMark(sg.id)
                    return (
                      <div key={sg.id}>
                        {sgm.before && reorderInd}
                        {renamingGroupId === sg.id ? renderRenameInput(sg, true) : (
                          <div onClick={() => setActiveGroupId(sg.id)} {...groupRowHandlers(sg)}
                            style={{ padding:'5px 8px 5px 28px', cursor:'pointer', display:'flex', alignItems:'center', gap:2, background: sOver ? '#ddd6fe' : sActive ? '#ede9fe' : 'transparent', outline: sOver ? '1.5px dashed #7c3aed' : 'none', outlineOffset:-2 }}
                            onMouseEnter={e => { if (!sActive && !sOver) e.currentTarget.style.background = '#fafafa' }}
                            onMouseLeave={e => { if (!sActive && !sOver) e.currentTarget.style.background = 'transparent' }}>
                            <span style={{ color:'#ccc', fontSize:10, flexShrink:0 }}>↳</span>
                            <span style={{ fontSize:12, color: sActive ? '#7c3aed' : '#666', fontWeight: sActive ? 600 : 400, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sg.name}</span>
                            <div style={{ display:'flex', gap:1, alignItems:'center', flexShrink:0 }}>
                              {isMobileNotes && onReorderGroups && <>{mArrow('↑', () => moveGroupBy(sg, -1), sgIdx === 0)}{mArrow('↓', () => moveGroupBy(sg, 1), sgIdx === subs.length - 1)}</>}
                              <span style={{ fontSize:11, color:'#bbb', marginRight:2 }}>{countFor(sg.id)}</span>
                              <button onClick={e => { e.stopPropagation(); setRenamingGroupId(sg.id); setRenameText(sg.name) }}
                                style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 4px', lineHeight:1 }} title="Rename">✎</button>
                              <button onClick={e => { e.stopPropagation(); setDeletingGroupId(sg.id) }}
                                style={{ fontSize:11, background:'none', border:'none', cursor:'pointer', color:'#bbb', padding:'2px 4px', lineHeight:1 }} title="Delete subgroup">✕</button>
                            </div>
                          </div>
                        )}
                        {sgm.after && reorderInd}
                        {deletingGroupId === sg.id && renderDelConfirm(sg)}
                      </div>
                    )
                  })}
                  {/* Add subgroup input */}
                  {addingSubFor === g.id && (
                    <div style={{ padding:'4px 8px 4px 28px' }}>
                      <input autoFocus value={newSubName} onChange={e => setNewSubName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { if (newSubName.trim()) onSaveGroup(newSubName.trim(), g.id); setAddingSubFor(null); setNewSubName('') } if (e.key === 'Escape') { setAddingSubFor(null); setNewSubName('') } }}
                        onBlur={() => { if (newSubName.trim()) onSaveGroup(newSubName.trim(), g.id); setAddingSubFor(null); setNewSubName('') }}
                        placeholder="Subgroup name…"
                        style={{ width:'100%', boxSizing:'border-box', fontSize:12, padding:'4px 8px', border:'0.5px solid #c4b5fd', borderRadius:6, outline:'none' }} />
                    </div>
                  )}
                </div>
              )
            })}
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
        {visibleNotes.map((n, nIdx) => {
          const sw = swipeState[n.id] || {}
          const nm = noteMark(n.id)
          return (
            <div key={n.id} style={{ position:'relative', overflow:'hidden', borderBottom:'0.5px solid #f5f5f5' }} {...noteReorderHandlers(n.id)}>
              {nm.before && reorderInd}
              {/* Swipe-to-delete red background */}
              <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:'#E24B4A', display:'flex', alignItems:'center', justifyContent:'center' }}
                onClick={() => confirmDelete(n.id)}>
                <span style={{ color:'white', fontSize:12, fontWeight:500 }}>Delete</span>
              </div>
              <div
                draggable={!isMobileNotes}
                onDragStart={e => { dragNoteRef.current = n.id; e.dataTransfer.setData('text/note', n.id); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { dragNoteRef.current = null; setDragOverTarget(null); setReorderTarget(null) }}
                onTouchStart={e => onTouchStart(n.id, e)}
                onTouchMove={e => onTouchMove(n.id, e)}
                onTouchEnd={() => onTouchEnd(n.id)}
                onClick={() => { if (sw.swiped) { setSwipeState(s => ({...s, [n.id]: {x:0,swiped:false}})); return } handleSelect(n) }}
                style={{ position:'relative', padding:'11px 12px', cursor:'pointer', background:selectedId===n.id?'#f5f5f3':'white', transform:`translateX(${sw.x||0}px)`, transition: sw.startX ? 'none' : 'transform 0.2s ease', minHeight:40, display:'flex', alignItems:'center', boxSizing:'border-box' }}
                onMouseEnter={e => { if (selectedId!==n.id && !isMobileNotes) e.currentTarget.style.background='#fafafa' }}
                onMouseLeave={e => { if (selectedId!==n.id && !isMobileNotes) e.currentTarget.style.background='white' }}>
                <div style={{ flex:1, minWidth:0, fontSize:13, fontWeight:selectedId===n.id?500:400, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title||'Untitled'}</div>
                {isMobileNotes && onReorderNotes && (
                  <div style={{ display:'inline-flex', flexShrink:0, marginLeft:4 }}>
                    {mArrow('↑', () => moveNoteBy(n.id, -1), nIdx === 0)}
                    {mArrow('↓', () => moveNoteBy(n.id, 1), nIdx === visibleNotes.length - 1)}
                  </div>
                )}
              </div>
              {nm.after && reorderInd}
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
                {/* Mobile can't drag notes onto groups, so it gets a move-to-group selector */}
                {isMobileNotes && groups.length > 0 && onMoveNote && (
                  <select title="Move to group" value={notes.find(n => n.id === selectedId)?.group_id || ''}
                    onChange={e => onMoveNote(selectedId, e.target.value || null)}
                    style={{ fontSize:11, background:'#f5f5f3', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'6px 8px', cursor:'pointer', color:'#555', outline:'none', maxWidth:120 }}>
                    <option value="">Ungrouped</option>
                    {topGroups.flatMap(g => [
                      <option key={g.id} value={g.id}>{g.name}</option>,
                      ...subsOf(g.id).map(sg => <option key={sg.id} value={sg.id}>↳ {sg.name}</option>)
                    ])}
                  </select>
                )}
                {selectedId && onDuplicate && (
                  <button onClick={async () => {
                      if (dirty) { await onSave(draft, selectedId); setDirty(false) }
                      const nid = await onDuplicate(selectedId)
                      if (nid) { setSelectedId(nid); setDraft({ title: `${draft.title || 'Untitled'} (copy)`, body: draft.body || '' }); setDirty(false); if (isMobileNotes) setMobileView('editor') }
                    }}
                    title="Duplicate note"
                    style={{ fontSize:11, background:'#f5f5f3', border:'0.5px solid #e5e5e5', borderRadius:6, padding:'6px 10px', cursor:'pointer', color:'#555' }}>
                    ⧉
                  </button>
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
              const g = noteRecord?.group_id ? groups.find(x => x.id === noteRecord.group_id) : null
              const crumb = g ? (g.parent_id ? `${groups.find(x => x.id === g.parent_id)?.name || '—'} › ${g.name}` : g.name) : 'Ungrouped'
              return noteRecord ? (
                <div style={{ display:'flex', gap:12, fontSize:10, color:'#bbb', alignItems:'center', flexWrap:'wrap' }}>
                  <span>Created {fmtDT(noteRecord.created_at)}</span>
                  {noteRecord.updated_at && noteRecord.updated_at !== noteRecord.created_at && <span>· Edited {fmtDT(noteRecord.updated_at)}</span>}
                  <span title="Drag the note onto a group in the sidebar to move it" style={{ fontSize:10, color:'#7c3aed', background:'#ede9fe', border:'0.5px solid #ddd6fe', borderRadius:20, padding:'1px 9px', display:'inline-flex', alignItems:'center', gap:4 }}>{crumb}</span>
                </div>
              ) : null
            })()}
          </div>
          {selectedId && (() => {
            const atts = (() => { const n = notes.find(x => x.id === selectedId); return Array.isArray(n?.attachments) ? n.attachments : [] })()
            return (
              <div style={{ flexShrink:0, padding:'8px 14px', background:'#faf9fb', borderBottom:'0.5px solid #eee', maxHeight:150, overflowY:'auto' }}>
                <AttachmentSection compact attachments={atts} entityPath={`notes/${selectedId}`}
                  onAdd={att => onSave({ ...draftRef.current, attachments: [...atts, att] }, selectedId)}
                  onRemove={id => onSave({ ...draftRef.current, attachments: atts.filter(a => a.id !== id) }, selectedId)} />
              </div>
            )
          })()}
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
    <div style={{ display:'flex', height: focused ? 'calc(100vh - 72px)' : 'calc(100vh - 220px)', minHeight:400 }}>
      {sidebar}
      <div onPointerDown={startSidebarDrag} title="Drag to resize the note list"
        style={{ width:16, flexShrink:0, cursor:'col-resize', display:'flex', alignItems:'stretch', justifyContent:'center' }}
        onMouseEnter={e => { e.currentTarget.firstChild.style.background = '#c4b5fd' }}
        onMouseLeave={e => { e.currentTarget.firstChild.style.background = 'transparent' }}>
        <div style={{ width:2.5, borderRadius:2, background:'transparent', margin:'8px 0', transition:'background 0.12s' }} />
      </div>
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

// taskr-attachments is a PRIVATE bucket — files are reached only via short-lived signed URLs
const ATTACHMENT_URL_TTL = 300 // seconds
async function openAttachment(att) {
  if (!att?.path) { alert('Attachment is missing its storage path.'); return }
  const { data, error } = await supabase.storage.from('taskr-attachments').createSignedUrl(att.path, ATTACHMENT_URL_TTL)
  if (error || !data?.signedUrl) { alert(`Could not open attachment: ${error?.message || 'unknown error'}`); return }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
}

function AttachmentSection({ attachments, entityPath, onAdd, onRemove, compact = false }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)
  const handleFile = async e => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const path = `${entityPath}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('taskr-attachments').upload(path, file)
      if (error) { console.error('[TASKr] upload error', error); alert(`Upload failed: ${error.message}`); return }
      // Store only the storage path; URLs are signed on demand (private bucket)
      onAdd({ id: 'att' + Date.now(), name: file.name, size: file.size, type: file.type, path, ts: Date.now() })
    } catch (err) {
      console.error('[TASKr] upload error', err)
      alert(`Upload failed: ${err.message || err}`)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  const handleRemove = async att => {
    await supabase.storage.from('taskr-attachments').remove([att.path])
    onRemove(att.id)
  }
  return (
    <div style={compact ? {} : { borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginTop:4 }}>
      <label style={FIELD_LABEL}>Attachments</label>
      {attachments.map(att => (
        <div key={att.id} onDoubleClick={() => openAttachment(att)} title="Double-click to open in a new tab"
          style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, padding:'6px 8px', background:'#fafafa', borderRadius:6, border:'0.5px solid #f0f0f0', cursor:'pointer' }}>
          <span style={{ fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{att.name}</span>
          {att.size && <span style={{ fontSize:10, color:'#bbb', flexShrink:0 }}>{(att.size/1024).toFixed(0)}KB</span>}
          <button onClick={e => { e.stopPropagation(); openAttachment(att) }} style={{ fontSize:10, color:'#378ADD', flexShrink:0, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>Open</button>
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

function TaskForm({ task, isEdit, onSave, onDelete, onClose, domains, zIndex = 50, members = MEMBERS, defaultOwner, lockedDomain = null }) {
  const defaultOwners = defaultOwner ? [defaultOwner] : ['Levi']
  const EMPTY = { title:'', status:'active', domain:'', owners:defaultOwners, due:'', priority:'', color:'', notes:[], today:false, substatus:'not_started', subtasks:[], project_id:null, escalation_id:null, qualification_id:null, attachments:[], waiting_on:'' }
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
      <div style={{ display:'grid', gridTemplateColumns: f.status === 'waiting' ? '1fr 1fr' : '1fr', gap:8, marginBottom:10 }}>
        <div style={f.status === 'waiting' ? undefined : { maxWidth:200 }}><label style={FIELD_LABEL}>Task status</label>
          <select value={f.status || 'active'} onChange={e => set('status', e.target.value)} style={FIELD_SELECT}>
            <option value="active">Active</option>
            <option value="waiting">Waiting</option>
            <option value="someday">Someday</option>
            <option value="done">Done</option>
          </select></div>
        {f.status === 'waiting' && (
          <div><label style={FIELD_LABEL}>Waiting on</label>
            <input value={f.waiting_on || ''} onChange={e => set('waiting_on', e.target.value)} placeholder="Who or what is this blocked on?" style={FIELD_INPUT} /></div>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
        <div><label style={FIELD_LABEL}>Status</label>
          <select value={f.substatus||'not_started'} onChange={e => set('substatus', e.target.value)} style={FIELD_SELECT}>
            {SUBSTATUS.filter(s => s.key && s.key !== 'canceled' && s.key !== 'waiting').map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
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
          {lockedDomain ? (
            <div title="Set by the project/bundle — edit it on the project" style={{ ...FIELD_SELECT, boxSizing:'border-box', cursor:'not-allowed', background:'#f4f2ec', color:'#666', display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lockedDomain}</span>
              <span style={{ fontSize:9, color:'#aaa', flexShrink:0 }}>🔒 project</span>
            </div>
          ) : (
            <select value={f.domain} onChange={e => set('domain', e.target.value)} style={FIELD_SELECT}>
              <option value="">— none —</option>
              {(domains||[]).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}</div>
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
        <ModalCloseButton onClick={onClose} />
        <input autoFocus type="text" value={f.title} onChange={e => set('title', e.target.value)} placeholder="Task title..."
          style={{ width:'100%', boxSizing:'border-box', fontSize:18, fontWeight:700, border:'none', outline:'none', marginBottom: isEdit ? 6 : 14, color:'#111', background:'transparent', padding:'0 34px 0 0' }} />
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
        <ModalCloseButton onClick={onClose} />
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14, paddingRight:30 }}>
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
        {calendars.filter(c => !isHolidayCalType(c.type)).length > 0 && (
          <div style={{ marginBottom:12 }}>
            <label style={FIELD_LABEL}>Calendar</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {calendars.filter(c => !isHolidayCalType(c.type)).map(c => (
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
        <ModalCloseButton onClick={onClose} />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingRight:30 }}>
          <span style={{ fontSize:15, fontWeight:500, color:'#111' }}>{label}</span>
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
  const [holidayMenuOpen, setHolidayMenuOpen] = useState(false)

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
      {/* Calendar toggles — non-holiday calendars as pills; holiday calendars collapsed into one dropdown */}
      {calendars.length > 0 && (() => {
        const otherCals = calendars.filter(c => !isHolidayCalType(c.type))
        const holidayList = calendars.filter(c => isHolidayCalType(c.type))
        const visHoliday = holidayList.filter(c => c.visible).length
        return (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            <span style={{ fontSize:11, color:'#aaa', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.05em', marginRight:2 }}>Calendars</span>
            {otherCals.map(cal => (
              <button key={cal.id} onClick={() => onToggleCalendar && onToggleCalendar(cal.id, !cal.visible)}
                style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer', border:`0.5px solid ${cal.visible ? cal.color : '#e0e0e0'}`, background: cal.visible ? cal.color+'18' : '#f7f7f5', color: cal.visible ? cal.color : '#bbb', fontWeight: cal.visible ? 500 : 400, transition:'all 0.1s' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: cal.visible ? cal.color : '#ccc', flexShrink:0 }} />{cal.name}
              </button>
            ))}
            {holidayList.length > 0 && (
              <div style={{ position:'relative' }}>
                <button onClick={() => setHolidayMenuOpen(o => !o)}
                  style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer', border:`0.5px solid ${visHoliday ? '#c4b5fd' : '#e0e0e0'}`, background: visHoliday ? '#ede9fe' : '#f7f7f5', color: visHoliday ? '#7c3aed' : '#999', fontWeight: visHoliday ? 500 : 400 }}>
                  🗓 Holidays{visHoliday ? ` · ${visHoliday}` : ''}<span style={{ fontSize:9, opacity:0.7 }}>▾</span>
                </button>
                {holidayMenuOpen && (
                  <>
                    <div onClick={() => setHolidayMenuOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
                    <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, boxShadow:'0 4px 16px rgba(0,0,0,0.10)', zIndex:200, minWidth:190, padding:6 }}>
                      <div style={{ display:'flex', gap:4, marginBottom:6, paddingBottom:6, borderBottom:'0.5px solid #f0f0f0' }}>
                        <button onClick={() => holidayList.forEach(c => { if (!c.visible) onToggleCalendar(c.id, true) })}
                          style={{ flex:1, fontSize:11, padding:'4px 0', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', color:'#555' }}>All</button>
                        <button onClick={() => holidayList.forEach(c => { if (c.visible) onToggleCalendar(c.id, false) })}
                          style={{ flex:1, fontSize:11, padding:'4px 0', border:'0.5px solid #e0e0e0', borderRadius:6, background:'white', cursor:'pointer', color:'#555' }}>None</button>
                      </div>
                      {holidayList.map(cal => (
                        <button key={cal.id} onClick={() => onToggleCalendar(cal.id, !cal.visible)}
                          style={{ display:'flex', alignItems:'center', gap:8, width:'100%', textAlign:'left', padding:'6px 8px', background:'none', border:'none', borderRadius:6, cursor:'pointer', fontSize:12 }}
                          onMouseEnter={e => e.currentTarget.style.background='#f5f5f3'}
                          onMouseLeave={e => e.currentTarget.style.background='none'}>
                          <span style={{ width:10, height:10, borderRadius:'50%', background: cal.visible ? cal.color : 'white', border:`1.5px solid ${cal.color}`, flexShrink:0 }} />
                          <span style={{ flex:1, color: cal.visible ? '#333' : '#999' }}>{cal.name}</span>
                          {cal.visible && <span style={{ fontSize:11, color:cal.color }}>✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })()}
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
        <CalendarEventForm event={eventForm} isEdit={isEdit} onSave={handleSave} onDelete={handleDelete} onClose={() => { setEventForm(null); setIsEdit(false) }} members={members} calendars={calendars.filter(c => !isHolidayCalType(c.type))} />
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
        <ModalCloseButton onClick={onClose} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, paddingRight:30 }}>
          <span style={{ fontSize:15, fontWeight:600, color:'#111' }}>Change Password</span>
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

// ─── Qualification scheduling engine ──────────────────────────────────────────
// Pure. Returns { [subtaskId]: { plannedStart, plannedEnd, actualEnd } } — all ISO dates, business-day based.
// Returns { schedule: {id -> {plannedStart, plannedEnd, actualEnd, slack, latestEnd, critical, warning}}, critical: Set<id>, projectedEnd: ISO|null }
function computeSchedule(qualification, trackTasks, todayISO) {
  const bizForward = d => { const x = new Date(d); while (!isWeekday(x)) x.setDate(x.getDate() + 1); return x } // next business day (incl. same)
  const addBiz = (d, n) => { const x = new Date(d); if (n <= 0) return x; let c = 0; while (c < n) { x.setDate(x.getDate() + 1); if (isWeekday(x)) c++ } return x }
  const subBiz = (d, n) => { const x = new Date(d); if (n <= 0) return x; let c = 0; while (c < n) { x.setDate(x.getDate() - 1); if (isWeekday(x)) c++ } return x }
  const bizBetween = (a, b) => { // signed business days from a to b
    if (toISODate(b) < toISODate(a)) return -bizBetween(b, a)
    let c = 0; const x = new Date(a); while (toISODate(x) < toISODate(b)) { x.setDate(x.getDate() + 1); if (isWeekday(x)) c++ } return c
  }
  const anchor = bizForward(fromISODate(qualification?.start_date || todayISO))
  const todayD = fromISODate(todayISO)
  const todayFwd = bizForward(todayD)

  const subs = []
  for (const t of (trackTasks || [])) for (const s of (Array.isArray(t.subtasks) ? t.subtasks : [])) subs.push(s)
  const byId = Object.fromEntries(subs.map(s => [s.id, s]))

  // Topological order (DFS post-order); cycle edges are simply skipped so we never loop
  const order = [], state = {}
  const visit = id => {
    if (state[id] === 2 || state[id] === 1) return
    state[id] = 1
    for (const dep of (byId[id]?.depends_on || [])) if (byId[dep]) visit(dep)
    state[id] = 2
    order.push(id)
  }
  for (const s of subs) visit(s.id)

  // ── Forward pass ── eff[id] = end propagated to dependents; startD/endD = displayed bar
  const eff = {}, startD = {}, endD = {}, meta = {}
  for (const id of order) {
    const s = byId[id]; if (!s) continue
    const preds = (s.depends_on || []).filter(d => eff[d])
    const predMax = preds.length ? new Date(Math.max(...preds.map(d => eff[d].getTime()))) : null
    // A pinned start overrides the computed start; the stage no longer reflows from its predecessors
    const pinned = !!s.pinned_start
    let start = pinned ? bizForward(fromISODate(s.pinned_start)) : bizForward(predMax || anchor)
    let end, actualEnd = null, effEnd, warning = null, overdue = false
    // pinned start before a predecessor's effective end = explicit soft-dependency overlap
    if (pinned && predMax && toISODate(start) < toISODate(predMax)) warning = 'pinned-overlap'
    if (s.na) {
      // N/A: collapses to zero duration and passes its predecessors' end straight through
      end = new Date(start); effEnd = new Date(start)
    } else if (s.done) {
      end = addBiz(start, Number(s.duration) || 0)
      if (s.completed_date) {
        actualEnd = fromISODate(s.completed_date)
        // BUG 2: a completion before a predecessor's end is honored for display but clamped for propagation
        if (predMax && toISODate(actualEnd) < toISODate(predMax)) { warning = 'completed-early'; effEnd = new Date(predMax) }
        else effEnd = new Date(actualEnd)
      } else effEnd = new Date(end)
    } else {
      // BUG 1: open stage forecasts remaining work; never collapses to today. Pinned starts are respected as-is.
      if (s.expected_end) {                                                 // authoritative manual override
        end = bizForward(fromISODate(s.expected_end))
        if (!pinned && toISODate(start) < todayISO) start = new Date(todayFwd)
        if (toISODate(end) < toISODate(start)) start = new Date(end)
        effEnd = new Date(end)
        if (toISODate(fromISODate(s.expected_end)) < todayISO) overdue = true // manual override itself has already passed
      } else {
        const dur = Number(s.duration) || 0
        const pct = Math.max(0, Math.min(100, Number(s.percent) || 0))
        const remaining = dur <= 0 ? 0 : Math.max(1, Math.ceil(dur * (1 - pct / 100)))
        const normalEnd = addBiz(start, dur)
        if (toISODate(start) < todayISO || toISODate(normalEnd) < todayISO) { // overdue / late start → forecast remaining from today
          if (!pinned) start = new Date(todayFwd)                           // non-pinned snaps start to today; pinned keeps its date
          end = addBiz(new Date(todayFwd), remaining)
          overdue = true                                                    // the stretch path fired
        } else end = normalEnd                                              // future stage on schedule → full duration
        effEnd = new Date(end)
      }
    }
    startD[id] = start; endD[id] = end; eff[id] = effEnd; meta[id] = { actualEnd, warning, overdue }
  }

  // ── Projected completion = latest effective end ──
  let projTime = -Infinity
  for (const id of order) if (eff[id] && eff[id].getTime() > projTime) projTime = eff[id].getTime()
  const projectedEnd = projTime === -Infinity ? null : toISODate(new Date(projTime))

  // ── Critical path: from the latest-ending stage(s), walk back through the driving predecessor ──
  const critical = new Set()
  const walk = id => {
    if (critical.has(id)) return
    critical.add(id)
    const preds = (byId[id]?.depends_on || []).filter(d => eff[d])
    let best = null, bestT = -Infinity
    for (const d of preds) { const t = eff[d].getTime(); if (t > bestT) { bestT = t; best = d } }
    if (best) walk(best)
  }
  if (projTime > -Infinity) for (const id of order) if (eff[id] && eff[id].getTime() === projTime) walk(id)

  // ── Slack (backward pass): latest allowable end per stage before it pushes projectedEnd ──
  const succ = {}
  for (const s of subs) for (const d of (s.depends_on || []).filter(x => byId[x])) (succ[d] ||= []).push(s.id)
  const lae = {}
  for (const id of [...order].reverse()) {
    const outs = succ[id] || []
    if (!outs.length) lae[id] = projTime
    else lae[id] = Math.min(...outs.map(o => subBiz(new Date(lae[o]), Math.max(0, bizBetween(startD[o], eff[o]))).getTime()))
  }

  const schedule = {}
  for (const id of order) {
    if (!eff[id]) continue
    const isCrit = critical.has(id)
    const latestEnd = new Date(lae[id] ?? eff[id].getTime())
    schedule[id] = {
      plannedStart: toISODate(startD[id]), plannedEnd: toISODate(endD[id]),
      actualEnd: meta[id].actualEnd ? toISODate(meta[id].actualEnd) : null,
      slack: isCrit ? 0 : Math.max(0, bizBetween(eff[id], latestEnd)),
      latestEnd: toISODate(latestEnd), critical: isCrit, warning: meta[id].warning, overdue: meta[id].overdue,
    }
  }
  return { schedule, critical, projectedEnd }
}

// Parse a due date (MM/DD/YY from DatePicker, or ISO) to a Date for comparison; null if empty/invalid
function parseDueDate(s) {
  if (!s) return null
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) { const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return new Date(yy, Number(m[1]) - 1, Number(m[2])) }
  const d = new Date(s); return isNaN(d) ? null : d
}

// One editable subtask row (done · duration · N/A · dependencies · completed date)
function QualSubtaskRow({ st, allSubs, sched, onUpdate }) {
  const [depOpen, setDepOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const deps = Array.isArray(st.depends_on) ? st.depends_on : []
  const faded = !!st.na
  const open = !st.done && !st.na               // stage still in progress (percent/expected_end apply)
  const pct = Math.max(0, Math.min(100, Number(st.percent) || 0))
  const fmtD = iso => iso ? fromISODate(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '—'
  const others = allSubs.filter(o => o.id !== st.id)
  const inputS = { fontSize:11, padding:'2px 4px', border:'0.5px solid #e0e0e0', borderRadius:4, outline:'none', fontFamily:'inherit' }
  return (
    <div onClick={e => e.stopPropagation()} style={{ border:`0.5px solid ${sched?.critical ? '#ddd6fe' : '#eee'}`, borderLeft: sched?.critical ? '2px solid #7c3aed' : '0.5px solid #eee', borderRadius:6, padding:'6px 8px', marginBottom:4, background: faded ? '#f7f7f5' : 'white' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, opacity: faded ? 0.65 : 1 }}>
        <input type="checkbox" checked={!!st.done} disabled={faded}
          onChange={e => onUpdate(e.target.checked ? { done:true, completed_date: st.completed_date || today() } : { done:false, completed_date:null })}
          style={{ width:13, height:13, cursor: faded ? 'default' : 'pointer', flexShrink:0 }} />
        <span style={{ flex:1, fontSize:12, color:(st.done||faded)?'#999':'#333', textDecoration:(st.done||faded)?'line-through':'none' }}>
          {st.title}
          {faded && <span style={{ fontSize:9, marginLeft:5, color:'#aaa', fontWeight:600 }}>N/A</span>}
          {sched?.warning && <span title={sched.warning === 'pinned-overlap' ? 'Starts before its predecessor finishes (pinned start)' : 'Completed before its predecessor finished'} style={{ fontSize:10, marginLeft:5, color:'#d97706', cursor:'help' }}>⚠</span>}
          {st.pinned_start && <button onClick={() => onUpdate({ pinned_start: null })} title={`Pinned start ${st.pinned_start} — click to unpin (return to computed scheduling)`} style={{ fontSize:9, marginLeft:5, color:'#7c3aed', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0 }}>📌</button>}
          {open && pct > 0 && <span style={{ fontSize:9, marginLeft:5, color:'#7c3aed', fontWeight:600 }}>{pct}%</span>}
        </span>
        {open && sched && (sched.critical
          ? <span style={{ fontSize:8, color:'#7c3aed', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em', flexShrink:0 }} title="On the critical path — no slack">critical</span>
          : sched.slack > 0 && <span style={{ fontSize:9, color:'#aaa', flexShrink:0 }} title={`${sched.slack} business days of slack before this delays the qualification`}>+{sched.slack}d</span>)}
        {sched && <span style={{ fontSize:9, color:'#aaa', flexShrink:0, whiteSpace:'nowrap' }} title="Planned start → end (business days)">
          {sched.actualEnd ? `✓ ${fmtD(sched.actualEnd)}` : `${fmtD(sched.plannedStart)} → ${fmtD(sched.plannedEnd)}`}
        </span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap', paddingLeft:19 }}>
        <label style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#888' }}>
          Dur
          <input type="number" min={0} value={faded ? 0 : (st.duration ?? 0)} disabled={faded}
            onChange={e => onUpdate({ duration: Math.max(0, parseInt(e.target.value) || 0) })}
            style={{ ...inputS, width:40 }} />
          bd
        </label>
        <button onClick={() => onUpdate(st.na ? { na:false } : { na:true, done:false, completed_date:null, percent:0, expected_end:null })}
          style={{ fontSize:10, padding:'2px 8px', borderRadius:10, border:'none', cursor:'pointer', background: st.na ? '#ede9fe' : '#f0f0f0', color: st.na ? '#7c3aed' : '#888', fontWeight:500 }}>
          {st.na ? 'N/A ✓' : 'N/A'}
        </button>
        {open && (
          <button onClick={() => setShowMore(m => !m)} title="Progress · expected-end · pinned start"
            style={{ fontSize:10, padding:'2px 8px', borderRadius:10, border:'0.5px solid #e0e0e0', cursor:'pointer', background: showMore ? '#f5f3ff' : 'white', color: (pct>0||st.expected_end||st.pinned_start) ? '#7c3aed' : '#888' }}>
            ⋯{(pct>0||st.expected_end||st.pinned_start) ? ' •' : ''}
          </button>
        )}
        <div style={{ position:'relative' }}>
          <button onClick={() => setDepOpen(o => !o)}
            style={{ fontSize:10, padding:'2px 8px', borderRadius:10, border:'0.5px solid #e0e0e0', cursor:'pointer', background:'white', color: deps.length ? '#7c3aed' : '#888' }}>
            ⇄ Deps{deps.length ? ` · ${deps.length}` : ''} <span style={{ fontSize:8, opacity:0.7 }}>▾</span>
          </button>
          {depOpen && (
            <>
              <div onClick={() => setDepOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
              <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:200, minWidth:230, maxHeight:240, overflowY:'auto', padding:6 }}>
                {others.length === 0 && deps.length === 0 && <div style={{ fontSize:11, color:'#bbb', padding:6 }}>No other subtasks</div>}
                {others.map(o => { const on = deps.includes(o.id); return (
                  <button key={o.id} onClick={() => onUpdate({ depends_on: on ? deps.filter(d => d !== o.id) : [...deps, o.id] })}
                    style={{ display:'flex', alignItems:'center', gap:6, width:'100%', textAlign:'left', padding:'5px 7px', background:'none', border:'none', borderRadius:6, cursor:'pointer', fontSize:11 }}
                    onMouseEnter={e => e.currentTarget.style.background='#f5f5f3'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <span style={{ width:11, flexShrink:0, color:'#7c3aed', fontSize:10 }}>{on ? '✓' : ''}</span>
                    <span style={{ fontSize:8, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.03em', flexShrink:0, minWidth:52 }}>{o.trackShort}</span>
                    <span style={{ flex:1, color:'#333' }}>{o.title}</span>
                  </button>
                )})}
                {deps.filter(d => !others.some(o => o.id === d)).map(d => (
                  <button key={d} onClick={() => onUpdate({ depends_on: deps.filter(x => x !== d) })} title="Removed subtask — click to clear this stale dependency"
                    style={{ display:'flex', alignItems:'center', gap:6, width:'100%', textAlign:'left', padding:'5px 7px', background:'none', border:'none', borderRadius:6, cursor:'pointer', fontSize:11 }}
                    onMouseEnter={e => e.currentTarget.style.background='#fff5f5'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                    <span style={{ width:11, flexShrink:0, color:'#c0392b', fontSize:10 }}>✓</span>
                    <span style={{ flex:1, color:'#c0392b' }}>{d} <span style={{ color:'#bbb' }}>(removed)</span></span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {st.done && !faded && (
          <label style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#888' }}>
            Done
            <input type="date" value={st.completed_date || today()} onChange={e => onUpdate({ completed_date: e.target.value || null })}
              style={{ ...inputS, fontSize:10 }} />
          </label>
        )}
      </div>
      {open && showMore && (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:6, flexWrap:'wrap', paddingLeft:19, paddingTop:6, borderTop:'0.5px dashed #eee' }}>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }} title="How far through this stage the work is">
            Progress
            <input type="number" min={0} max={100} value={st.percent ?? 0}
              onChange={e => onUpdate({ percent: Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) })}
              style={{ ...inputS, width:44 }} />%
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }} title="Manual override for when this stage is actually expected to finish — takes precedence over the computed forecast">
            Expected end <span style={{ fontSize:8, color:'#bbb', fontStyle:'italic' }}>(override)</span>
            <input type="date" value={st.expected_end || ''} onChange={e => onUpdate({ expected_end: e.target.value || null })}
              style={{ ...inputS, fontSize:10, borderColor: st.expected_end ? '#c4b5fd' : '#e0e0e0' }} />
            {st.expected_end && <button onClick={() => onUpdate({ expected_end: null })} title="Clear override" style={{ fontSize:11, color:'#bbb', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>}
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }} title="Pin an explicit start date. A pinned stage no longer reflows from its predecessors until you unpin it.">
            📌 Pinned start
            <input type="date" value={st.pinned_start || ''} onChange={e => onUpdate({ pinned_start: e.target.value || null })}
              style={{ ...inputS, fontSize:10, borderColor: st.pinned_start ? '#c4b5fd' : '#e0e0e0' }} />
            {st.pinned_start && <button onClick={() => onUpdate({ pinned_start: null })} title="Unpin — return to computed scheduling" style={{ fontSize:11, color:'#bbb', background:'none', border:'none', cursor:'pointer', padding:0 }}>✕</button>}
          </label>
        </div>
      )}
    </div>
  )
}

// ─── Qualification Card ───────────────────────────────────────────────────────
function QualificationCard({ qual, tasks, onOpen, onDragStart, onDragEnd, dragging }) {
  const linked = tasks.filter(t => t.qualification_id === qual.id)
  const stagesTotal = linked.length
  const stagesDone = linked.filter(t => (t.substatus || 'not_started') === 'complete').length
  const pct = stagesTotal ? Math.round((stagesDone / stagesTotal) * 100) : 0
  const bg = flagBg(qual.color), border = flagBorder(qual.color)
  const owners = qual.owners || []
  const showOwners = !(owners.length === 1 && owners[0] === 'Levi')
  const { projectedEnd } = stagesTotal ? computeSchedule({ start_date: qual.start_date }, linked, today()) : { projectedEnd: null }
  const dueDate = parseDueDate(qual.due), projSlipped = dueDate && projectedEnd && fromISODate(projectedEnd) > dueDate
  const projLabel = projectedEnd ? fromISODate(projectedEnd).toLocaleDateString('en-US', { month:'short', year:'numeric' }) : null
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData('text/plain', String(qual.id)); onDragStart && onDragStart(qual.id) }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(qual)}
      style={{ background:bg||'white', border:`0.5px solid ${border||'#e5e5e5'}`, borderRadius:8, padding:'10px 12px', cursor:'grab', boxSizing:'border-box', userSelect:'none', opacity:dragging?0.4:1, marginBottom:8 }}
      onMouseEnter={e => { if(!border) e.currentTarget.style.borderColor='#bbb' }}
      onMouseLeave={e => { if(!border) e.currentTarget.style.borderColor='#e5e5e5' }}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:4 }}>
        {qual.site && <span style={{ fontSize:10, fontWeight:500, background:'#EAF3DE', color:'#27500A', padding:'2px 7px', borderRadius:20, border:'0.5px solid #97C459', whiteSpace:'nowrap' }}>{qual.site}</span>}
        {qual.priority === 'high' && <span style={{ fontSize:9, fontWeight:500, background:'#FCEBEB', color:'#791F1F', padding:'2px 6px', borderRadius:20, whiteSpace:'nowrap', border:'0.5px solid #F09595' }}>High</span>}
      </div>
      <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:2, lineHeight:1.3 }}>{qual.name}</div>
      {(qual.supplier || qual.material) && (
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>{qual.supplier}{qual.supplier && qual.material ? ' · ' : ''}{qual.material}</div>
      )}
      {stagesTotal > 0 && (
        <div style={{ marginBottom:6 }}>
          <div style={{ height:5, background:'#eee', borderRadius:3, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'linear-gradient(90deg,#4f46e5,#7c3aed)' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6, marginTop:3 }}>
            <span style={{ fontSize:10, color:'#aaa' }}>{stagesDone}/{stagesTotal} stage{stagesTotal!==1?'s':''} complete</span>
            {projLabel && <span title={projSlipped ? 'Projected completion is past the due date' : 'Projected completion'} style={{ fontSize:10, fontWeight:500, color: projSlipped ? '#B23B3B' : '#7c6f9c', whiteSpace:'nowrap' }}>Projected: {projLabel}{projSlipped ? ' ⚠' : ''}</span>}
          </div>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
        {showOwners && owners.map(o => <OwnerPip key={o} name={o} />)}
        {qual.due && <Badge type="due">{qual.due}</Badge>}
      </div>
    </div>
  )
}

// ─── Read-first inline-edit primitives (click text → input, blur/Enter commits) ──
// All three bind live (value/onChange) rather than deferring to a commit-on-blur draft — a draft would risk
// losing an in-progress edit if the user clicks Save before the field blurs. "editing" only toggles the view.
function InlineText({ value, onChange, placeholder = '—', display, editingDefault = false, inputStyle, textStyle }) {
  const [editing, setEditing] = useState(editingDefault)
  if (editing) {
    return <input autoFocus value={value || ''} onChange={e => onChange(e.target.value)}
      onBlur={() => setEditing(false)} onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(false) }}
      placeholder={placeholder} style={inputStyle} />
  }
  return (
    <span onClick={() => setEditing(true)} title="Click to edit" style={{ cursor: 'pointer', ...textStyle }}>
      {display !== undefined ? display : (value || <span style={{ color: '#ccc' }}>{placeholder}</span>)}
    </span>
  )
}

function InlineSelect({ value, options, onChange, display, placeholder = '—', textStyle }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return <select autoFocus value={value} onChange={e => { onChange(e.target.value); setEditing(false) }}
      onBlur={() => setEditing(false)} style={FIELD_SELECT}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  }
  const label = options.find(o => o.value === value)?.label
  return (
    <span onClick={() => setEditing(true)} title="Click to edit" style={{ cursor: 'pointer', ...textStyle }}>
      {display !== undefined ? display : (label || <span style={{ color: '#ccc' }}>{placeholder}</span>)}
    </span>
  )
}

function InlineDate({ value, onChange, iso = false, placeholder = '—', textStyle }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef()
  useEffect(() => {
    if (!editing) return
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setEditing(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [editing])
  const closeIfComplete = v => { onChange(v); if (v === '' || (iso ? /^\d{4}-\d{2}-\d{2}$/.test(v) : /^\d{2}\/\d{2}\/\d{2}$/.test(v))) setEditing(false) }
  if (editing) {
    return <div ref={ref} style={{ minWidth: 170 }}>
      {iso ? <DatePickerISO value={value} onChange={closeIfComplete} /> : <DatePicker value={value} onChange={closeIfComplete} />}
    </div>
  }
  const display = value ? (iso ? fromISODate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : value) : null
  return (
    <span onClick={() => setEditing(true)} title="Click to edit" style={{ cursor: 'pointer', ...textStyle }}>
      {display || <span style={{ color: '#ccc' }}>{placeholder}</span>}
    </span>
  )
}

function CollapsibleSection({ title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '0.5px solid #f0f0f0', marginTop: 14, paddingTop: 10 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#bbb' }}>{summary}</span>
          <span style={{ fontSize: 10, color: '#bbb', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
        </span>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  )
}

// ─── Qualification Form / Detail ──────────────────────────────────────────────
function QualificationForm({ qual, isEdit, templates, domains, members, tasks, onSave, onDelete, onClose, onSaveTask, onDeleteTask, onUpdateSubtask }) {
  const [f, setF] = useState({
    name: qual.name || '', supplier: qual.supplier || '', material: qual.material || '', site: qual.site || '',
    status: qual.status || 'not_started', priority: qual.priority || '', color: qual.color || '',
    owners: Array.isArray(qual.owners) ? qual.owners : ['Levi'], due: qual.due || '', start_date: qual.start_date || '',
    template_id: qual.template_id || '',
    notes: Array.isArray(qual.notes) ? qual.notes : [],
    attachments: Array.isArray(qual.attachments) ? qual.attachments : [],
  })
  const [newNote, setNewNote] = useState('')
  const [openStages, setOpenStages] = useState(() => new Set()) // subtask ids whose QualSubtaskRow editor is expanded
  const [taskForm, setTaskForm] = useState(null)
  const [isEditTask, setIsEditTask] = useState(false)
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))
  const toggleOwner = m => { const cur = f.owners||[]; set('owners', cur.includes(m) ? cur.filter(o=>o!==m) : [...cur, m]) }
  const addNote = () => { const text = newNote.trim(); if (!text) return; set('notes', [...f.notes, { id:'n'+Date.now(), text, ts:Date.now() }]); setNewNote('') }
  const removeNote = id => setF(p => ({ ...p, notes: p.notes.filter(n => n.id !== id) }))
  const toggleOpenStage = id => setOpenStages(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const linkedTasks = isEdit ? tasks.filter(t => t.qualification_id === qual.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)) : []
  const taskDomains = [...new Set([...(domains||[]), 'Supplier Qualification'])]
  // Live schedule + cross-track subtask list for the dependency picker (recomputed as durations/deps/start change)
  const { schedule: sched, projectedEnd } = computeSchedule({ start_date: f.start_date }, linkedTasks, today())
  const todayISO = today()
  const dueDate = parseDueDate(f.due), projSlipped = dueDate && projectedEnd && fromISODate(projectedEnd) > dueDate
  const allSubs = linkedTasks.flatMap(t => (Array.isArray(t.subtasks) ? t.subtasks : []).map(s => ({ id: s.id, title: s.title, taskId: t.id, trackShort: (t.title || '').split(' ')[0] })))
  const openAddStage = () => { setTaskForm({ title:'', status:'active', substatus:'not_started', domain:'Supplier Qualification', owners:f.owners, qualification_id:qual.id, notes:[], subtasks:[], attachments:[], project_id:null, escalation_id:null }); setIsEditTask(false) }
  const openEditStage = t => { setTaskForm({...t}); setIsEditTask(true) }

  // ── Status-strip metrics (all derived live from the schedule, excluding N/A stages from every count) ──
  const allStageObjs = linkedTasks.flatMap(t => Array.isArray(t.subtasks) ? t.subtasks : [])
  const nonNAStages = allStageObjs.filter(s => !s.na)
  const doneCount = nonNAStages.filter(s => s.done).length
  const totalCount = nonNAStages.length
  const inFlightStages = nonNAStages.filter(s => !s.done && sched[s.id] && sched[s.id].plannedStart <= todayISO)
  const overdueStages = nonNAStages.filter(s => !s.done && sched[s.id]?.overdue)
  const criticalCount = nonNAStages.filter(s => sched[s.id]?.critical).length
  const inFlightLabel = inFlightStages.length === 0 ? '—' : inFlightStages.length === 1 ? inFlightStages[0].title : `${inFlightStages.length} stages`
  const inFlightTitle = inFlightStages.map(s => s.title).join(', ') || undefined

  const fmtSpanD = iso => iso ? fromISODate(iso).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : ''
  const metricCard = (label, value, opts = {}) => (
    <div title={opts.title} style={{ padding:'8px 10px', borderRadius:8, minWidth:0, boxSizing:'border-box',
      background: opts.tone === 'danger' ? '#FCEBEB' : opts.tone === 'warn' ? '#FEF3E2' : '#faf9f7',
      border: `0.5px solid ${opts.tone === 'danger' ? '#F09595' : opts.tone === 'warn' ? '#F5C177' : '#eee'}` }}>
      <div style={{ fontSize:9, fontWeight:600, color:'#a99fc0', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color: opts.tone === 'danger' ? '#791F1F' : opts.tone === 'warn' ? '#78350f' : '#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</div>
    </div>
  )

  // ── Header: name + a single muted "{site} · {status} · started {date}" line ──
  const statusLabel = QUAL_COLS.find(c => c.key === f.status)?.lbl || f.status
  const subtitleParts = [
    f.site || null,
    statusLabel,
    f.start_date ? `started ${fromISODate(f.start_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}` : null,
    f.supplier || null, f.material || null,
  ].filter(Boolean)
  const subtitle = subtitleParts.join(' · ')

  const notesCount = f.notes.length, attCount = f.attachments.length
  const metaSummary = [notesCount ? `${notesCount} note${notesCount!==1?'s':''}` : 'no notes', isEdit ? `${attCount} file${attCount!==1?'s':''}` : null].filter(Boolean).join(' · ')

  const stageStatusDot = (st, sc) => {
    if (st.na) return <span style={{ width:8, height:8, borderRadius:'50%', border:'1.5px dashed #ccc', flexShrink:0, boxSizing:'border-box' }} />
    if (st.done) return <span style={{ width:8, height:8, borderRadius:'50%', background:'#2f9e44', flexShrink:0 }} />
    if (sc && sc.plannedStart <= todayISO) return <span style={{ width:8, height:8, borderRadius:'50%', background:'white', border:'2px solid #4f46e5', flexShrink:0, boxSizing:'border-box' }} />
    return <span style={{ width:8, height:8, borderRadius:'50%', border:'1.5px solid #ccc', background:'white', flexShrink:0, boxSizing:'border-box' }} />
  }

  return (
    <>
      <style>{`@media (max-width: 480px) { .qform-status-strip { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
      <div style={{ ...MODAL_OVERLAY, zIndex:50 }}>
        <div style={{ ...MODAL_CARD, maxWidth:640 }}>
          <ModalCloseButton onClick={onClose} />

          {/* 1. Header — compact, read-first */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, paddingRight:30 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <InlineText value={f.name} onChange={v => set('name', v)} editingDefault={!isEdit} placeholder="Qualification name..."
                inputStyle={{ width:'100%', fontSize:18, fontWeight:700, border:'none', outline:'none', color:'#111', background:'transparent', padding:0, fontFamily:'inherit' }}
                textStyle={{ display:'block', fontSize:18, fontWeight:700, color:'#111', lineHeight:1.3 }} />
              {subtitle && <div title={subtitle} style={{ fontSize:11, color:'#999', marginTop:3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{subtitle}</div>}
            </div>
            {isEdit && (f.owners||[]).length > 0 && (
              <div style={{ display:'flex', gap:4, flexShrink:0, paddingTop:2 }}>
                {f.owners.map(o => <OwnerPip key={o} name={o} />)}
              </div>
            )}
          </div>
          <TimestampMeta created={qual.created_at} updated={qual.updated_at} />

          {/* 2. Status strip */}
          {isEdit && totalCount > 0 && (
            <div className="qform-status-strip" style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:14 }}>
              {metricCard('Projected', projectedEnd ? fromISODate(projectedEnd).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—',
                projSlipped ? { tone:'danger', title:`Past the due date (${f.due})` } : { title:'Based on the current schedule' })}
              {metricCard('Progress', `${doneCount} / ${totalCount}`)}
              {metricCard('In flight', inFlightLabel, { title: inFlightTitle })}
              {metricCard('Overdue', overdueStages.length, overdueStages.length > 0 ? { tone:'warn', title: overdueStages.map(s=>s.title).join(', ') } : {})}
            </div>
          )}

          {/* 3. Stages — expanded by default, the visual focus */}
          {isEdit && (
            <div style={{ marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em' }}>Stages · {linkedTasks.length}</span>
                {criticalCount > 0 && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#6d28d9', fontWeight:500 }}>
                    <Flag size={11} /> {criticalCount} on the critical path
                  </span>
                )}
              </div>
              {linkedTasks.length === 0 && <div style={{ fontSize:12, color:'#ccc', padding:'4px 0 10px' }}>No stages yet</div>}
              {linkedTasks.length > 0 && (
                <div style={{ border:'0.5px solid #eee', borderRadius:8, overflow:'hidden' }}>
                  {linkedTasks.map((t, ti) => {
                    const subs = Array.isArray(t.subtasks) ? t.subtasks : []
                    const trackDoneN = subs.filter(s => s.done).length
                    const trackTotalN = subs.filter(s => !s.na).length
                    const ss = subStyle(t.substatus || 'not_started')
                    const span = subs.reduce((acc, s) => {
                      const sc = sched[s.id]; if (!sc) return acc
                      return {
                        start: !acc.start || sc.plannedStart < acc.start ? sc.plannedStart : acc.start,
                        end: !acc.end || sc.plannedEnd > acc.end ? sc.plannedEnd : acc.end,
                      }
                    }, { start:null, end:null })
                    return (
                      <div key={t.id} style={{ borderTop: ti > 0 ? '0.5px solid #eee' : 'none' }}>
                        {/* Track header row */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'#faf9f7', borderBottom: subs.length ? '0.5px solid #f0f0f0' : 'none' }}>
                          <span style={{ width:7, height:7, borderRadius:'50%', background:ss.bg||'#e5e5e5', border:`1px solid ${ss.border||'#ccc'}`, flexShrink:0 }} />
                          <span style={{ flex:1, minWidth:60, fontSize:12, fontWeight:600, color:'#555', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
                          {subs.length > 0 && <span style={{ fontSize:10, color:'#aaa', flexShrink:0 }}>{trackDoneN}/{trackTotalN}</span>}
                          {span.start && <span style={{ fontSize:10, color:'#bbb', flexShrink:0, whiteSpace:'nowrap' }}>{fmtSpanD(span.start)} → {fmtSpanD(span.end)}</span>}
                          <button onClick={() => openEditStage(t)} title="Edit track" style={{ fontSize:12, color:'#ccc', flexShrink:0, background:'none', border:'none', cursor:'pointer', padding:0 }}>›</button>
                        </div>
                        {/* Stage rows */}
                        {subs.map(st => {
                          const sc = sched[st.id]
                          const open = openStages.has(st.id)
                          const isCrit = !st.na && sc?.critical
                          const isOverdue = !st.na && !st.done && sc?.overdue
                          return (
                            <div key={st.id}>
                              <div onClick={() => toggleOpenStage(st.id)}
                                style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px 7px 12px', cursor:'pointer', flexWrap:'wrap',
                                  borderLeft: isCrit ? '2.5px solid #6d28d9' : '2.5px solid transparent',
                                  background: open ? '#faf9ff' : isOverdue ? '#FFFBF0' : 'transparent',
                                  borderBottom:'0.5px solid #f5f5f5', opacity: st.na ? 0.6 : 1, boxSizing:'border-box' }}>
                                {stageStatusDot(st, sc)}
                                {isCrit && <Flag size={10} color="#6d28d9" style={{ flexShrink:0 }} />}
                                <span style={{ flex:1, minWidth:90, fontSize:12, color: (st.done||st.na) ? '#999' : '#333', textDecoration: (st.done||st.na) ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {st.title}
                                </span>
                                <span style={{ fontSize:10, color: isOverdue ? '#b45309' : '#aaa', flexShrink:0, whiteSpace:'nowrap' }}>
                                  {st.na ? 'N/A' : st.done ? `✓ ${fmtSpanD(sc?.actualEnd || st.completed_date)}` : `${st.duration ?? 0}bd · ${sc?.slack > 0 ? '+' + sc.slack + 'd slack' : 'no slack'}`}
                                </span>
                                {sc?.warning && <span title={sc.warning === 'pinned-overlap' ? 'Starts before its predecessor finishes (pinned start)' : 'Completed before its predecessor finished'} style={{ fontSize:10, color:'#d97706', cursor:'help', flexShrink:0 }}>⚠</span>}
                                <span style={{ fontSize:9, color:'#ccc', flexShrink:0 }}>{open ? '▾' : '▸'}</span>
                              </div>
                              {open && (
                                <div style={{ padding:'6px 10px 8px 12px', background:'#fbfbfd', borderBottom:'0.5px solid #f5f5f5' }}>
                                  <QualSubtaskRow st={st} allSubs={allSubs} sched={sc} onUpdate={patch => onUpdateSubtask(t.id, st.id, patch)} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}
              <button onClick={openAddStage} style={{ width:'100%', marginTop:8, padding:'7px 0', fontSize:12, color:'#aaa', border:'0.5px dashed #ccc', borderRadius:8, background:'none', cursor:'pointer', fontFamily:'inherit' }}>+ New stage</button>
            </div>
          )}

          {/* 4. Metadata — collapsed disclosure (open by default only while creating, since there's nothing yet to "read") */}
          <CollapsibleSection title="Details, notes, attachments" summary={metaSummary} defaultOpen={!isEdit}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div><label style={FIELD_LABEL}>Supplier</label>
                <InlineText value={f.supplier} onChange={v => set('supplier', v)} placeholder="Supplier name"
                  inputStyle={FIELD_INPUT} textStyle={{ display:'block', fontSize:13, color: f.supplier ? '#333' : '#ccc', padding:'7px 0' }} /></div>
              <div><label style={FIELD_LABEL}>Material</label>
                <InlineText value={f.material} onChange={v => set('material', v)} placeholder="Material / component"
                  inputStyle={FIELD_INPUT} textStyle={{ display:'block', fontSize:13, color: f.material ? '#333' : '#ccc', padding:'7px 0' }} /></div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
              <div><label style={FIELD_LABEL}>Status</label>
                <InlineSelect value={f.status} onChange={v => set('status', v)} options={QUAL_COLS.map(c => ({ value:c.key, label:c.lbl }))}
                  textStyle={{ display:'block', fontSize:13, color:'#333', padding:'7px 0' }} /></div>
              <div><label style={FIELD_LABEL}>Priority</label>
                <InlineSelect value={f.priority} onChange={v => set('priority', v)} options={[{ value:'', label:'Normal' }, { value:'high', label:'High' }]}
                  textStyle={{ display:'block', fontSize:13, color:'#333', padding:'7px 0' }} /></div>
              <div><label style={FIELD_LABEL}>Due date</label>
                <InlineDate value={f.due} onChange={v => set('due', v)} placeholder="Not set"
                  textStyle={{ display:'block', fontSize:13, color: f.due ? '#333' : '#ccc', padding:'7px 0' }} /></div>
            </div>

            <div style={{ marginBottom:10, maxWidth:200 }}>
              <label style={FIELD_LABEL}>Start date · schedule anchor</label>
              <InlineDate value={f.start_date} onChange={v => set('start_date', v)} iso placeholder="Not set"
                textStyle={{ display:'block', fontSize:13, color: f.start_date ? '#333' : '#ccc', padding:'7px 0' }} />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10, alignItems:'start' }}>
              <div><label style={FIELD_LABEL}>Site</label>
                <InlineSelect value={f.site} onChange={v => set('site', v)} options={[{ value:'', label:'— none —' }, ...QUAL_SITES.map(s => ({ value:s, label:s }))]}
                  textStyle={{ display:'block', fontSize:13, color: f.site ? '#333' : '#ccc', padding:'7px 0' }} /></div>
              <div><label style={FIELD_LABEL}>Flag color</label>
                <div style={{ display:'flex', gap:5, alignItems:'center', height:32, flexWrap:'wrap' }}>
                  {FLAG_COLORS.map(fc => <button key={fc.key} title={fc.label} onClick={() => set('color', fc.key)} style={{ width:fc.key?18:13, height:fc.key?18:13, borderRadius:'50%', background:fc.hex, border:f.color===fc.key?'2.5px solid #111':'2px solid transparent', cursor:'pointer', padding:0 }} />)}
                </div></div>
            </div>

            {!isEdit && (
              <div style={{ marginBottom:10 }}>
                <label style={FIELD_LABEL}>Template</label>
                <select value={f.template_id} onChange={e => set('template_id', e.target.value)} style={FIELD_SELECT}>
                  <option value="">No template (empty)</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.tasks?.length||0} stages</option>)}
                </select>
                {templates.length === 0 && <div style={{ fontSize:11, color:'#bbb', marginTop:4 }}>No templates yet — add them in Settings › Qual Templates.</div>}
              </div>
            )}

            <div style={{ marginBottom:10 }}>
              <label style={FIELD_LABEL}>Assigned to</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {members.map(m => { const sel=(f.owners||[]).includes(m); const c=MEMBER_COLORS[m]||{}; return <button key={m} onClick={() => toggleOwner(m)} style={{ fontSize:12, padding:'4px 10px', borderRadius:8, cursor:'pointer', border:sel?`1.5px solid ${c.tc}`:'0.5px solid #e5e5e5', background:sel?c.bg:'white', color:sel?c.tc:'#888', fontWeight:sel?500:400 }}>{m}</button> })}
              </div>
            </div>

            <div style={{ borderTop:'0.5px solid #f0f0f0', paddingTop:12, marginBottom:4 }}>
              <label style={FIELD_LABEL}>Notes</label>
              {f.notes.map(n => (
                <div key={n.id} style={{ fontSize:11, color:'#555', marginBottom:6, lineHeight:1.5, display:'flex', gap:8, alignItems:'flex-start' }}>
                  <span style={{ color:'#bbb', fontSize:10, marginTop:1, flexShrink:0 }}>{fmtTs(n.ts)}</span>
                  <span style={{ flex:1 }}>{n.text}</span>
                  <button onClick={() => removeNote(n.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:11, padding:0, flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.color='#E24B4A'} onMouseLeave={e=>e.currentTarget.style.color='#ddd'}>✕</button>
                </div>
              ))}
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <input value={newNote} onChange={e=>setNewNote(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addNote()}} placeholder="Add a note..." style={{ flex:1, fontSize:12, padding:'6px 9px', border:'0.5px solid #ddd', borderRadius:6 }} />
                <button onClick={addNote} style={{ ...BTN_PRIMARY, fontSize:12, borderRadius:6, padding:'0 14px' }}>Add</button>
              </div>
            </div>

            {isEdit && (
              <AttachmentSection
                attachments={f.attachments}
                entityPath={`qualifications/${qual.id}`}
                onAdd={att => setF(p => ({ ...p, attachments: [...p.attachments, att] }))}
                onRemove={id => setF(p => ({ ...p, attachments: p.attachments.filter(a => a.id !== id) }))}
              />
            )}
          </CollapsibleSection>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, borderTop:'0.5px solid #f0f0f0', paddingTop:12 }}>
            <div>{isEdit && <ConfirmDeleteButton onConfirm={() => { onDelete(qual.id); onClose() }} style={{ fontSize:12, color:'#E24B4A', background:'none', border:'0.5px solid #fcc', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit' }}>Delete qualification</ConfirmDeleteButton>}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onClose} style={{ fontSize:12, background:'none', color:'#888', border:'0.5px solid #e5e5e5', borderRadius:8, padding:'5px 12px', cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
              <button onClick={() => { if (f.name.trim()) { onSave(f, isEdit ? qual.id : null); onClose() } }} disabled={!f.name.trim()} style={{ ...BTN_PRIMARY, fontSize:12, padding:'6px 16px', opacity:f.name.trim()?1:0.4, cursor:f.name.trim()?'pointer':'not-allowed' }}>Save</button>
            </div>
          </div>
        </div>
      </div>
      {taskForm && (
        <TaskForm task={taskForm} isEdit={isEditTask} members={members} domains={taskDomains} zIndex={60}
          onSave={async data => { await onSaveTask(data, isEditTask ? taskForm.id : null); setTaskForm(null) }}
          onDelete={async id => { await onDeleteTask(id); setTaskForm(null) }}
          onClose={() => setTaskForm(null)} />
      )}
    </>
  )
}

// ─── Qualifications Tab ───────────────────────────────────────────────────────
// ─── Qualification Gantt ──────────────────────────────────────────────────────
function QualificationGantt({ qual, tasks, onUpdateSubtask, onUpdateQual, isMobile }) {
  const [selected, setSelected] = useState(null) // { taskId, subId }
  const [, setDragTick] = useState(0)             // forces re-render during a bar drag
  const dragRef = useRef(null)                    // live drag state (mutable, avoids stale closures)
  const suppressClickRef = useRef(0)              // timestamp: ignore the click that follows a committed drag
  const bodyRef = useRef(null)                    // timeline body, for pixel→date mapping
  const bump = () => setDragTick(t => t + 1)
  // Escape cancels an in-flight drag
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && dragRef.current) { dragRef.current = null; suppressClickRef.current = Date.now(); setDragTick(t => t + 1) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const linkedTasks = tasks.filter(t => t.qualification_id === qual.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  const todayISO = today()
  const { schedule: sched, critical, projectedEnd } = computeSchedule({ start_date: qual.start_date }, linkedTasks, todayISO)
  const dueDate = parseDueDate(qual.due), projSlipped = dueDate && projectedEnd && fromISODate(projectedEnd) > dueDate
  const allSubs = linkedTasks.flatMap(t => (Array.isArray(t.subtasks) ? t.subtasks : []).map(s => ({ id: s.id, title: s.title, taskId: t.id, trackShort: (t.title || '').split(' ')[0] })))

  const TRACK_COLORS = ['#4f46e5', '#0891b2', '#db2777']
  const DONE_C = '#2f9e44', OVERDUE_C = '#f59e0b'
  const DAY_W = 5, ROW_H = 30, TH_H = 28, BAR_H = 15, HEADER_H = 34, LEFT_W = isMobile ? 128 : 210, MIN_BAR = 4
  const fmtGD = iso => iso ? fromISODate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  // Flat row list: track header + its subtasks, in track order
  const rows = []
  linkedTasks.forEach((t, ti) => {
    const color = TRACK_COLORS[ti % TRACK_COLORS.length]
    rows.push({ type: 'track', title: t.title, color })
    ;(Array.isArray(t.subtasks) ? t.subtasks : []).forEach(st => rows.push({ type: 'sub', st, taskId: t.id, color, sched: sched[st.id] }))
  })
  if (rows.length === 0) return <div style={{ padding:'40px 0', textAlign:'center', color:'#bbb', fontSize:13 }}>No stages to chart — add stages to this qualification first.</div>

  const tops = []; let acc = 0
  rows.forEach(r => { tops.push(acc); acc += (r.type === 'track' ? TH_H : ROW_H) })
  const bodyH = acc

  // Time range → whole months
  const allISO = [qual.start_date || todayISO, todayISO]
  rows.forEach(r => { if (r.type === 'sub' && r.sched) { allISO.push(r.sched.plannedStart, r.sched.plannedEnd); if (r.sched.actualEnd) allISO.push(r.sched.actualEnd) } })
  const valid = allISO.filter(Boolean).sort()
  const rangeStartD = (d => new Date(d.getFullYear(), d.getMonth(), 1))(fromISODate(valid[0]))
  const rangeEndD = (d => new Date(d.getFullYear(), d.getMonth() + 1, 0))(fromISODate(valid[valid.length - 1]))
  const daysBetween = (a, b) => Math.round((b - a) / 86400000)
  const timelineW = (daysBetween(rangeStartD, rangeEndD) + 1) * DAY_W
  const xOf = iso => daysBetween(rangeStartD, fromISODate(iso)) * DAY_W

  const months = []
  for (let m = new Date(rangeStartD); m <= rangeEndD; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    const first = new Date(m.getFullYear(), m.getMonth(), 1), last = new Date(m.getFullYear(), m.getMonth() + 1, 0)
    const cl = last > rangeEndD ? rangeEndD : last
    months.push({ label: `${MONTH_NAMES[m.getMonth()].slice(0, 3)} '${String(m.getFullYear()).slice(-2)}`, x: daysBetween(rangeStartD, first) * DAY_W, w: (daysBetween(first, cl) + 1) * DAY_W })
  }
  const weekLines = []
  for (const d = new Date(rangeStartD); d <= rangeEndD; d.setDate(d.getDate() + 1)) if (d.getDay() === 1) weekLines.push(daysBetween(rangeStartD, new Date(d)) * DAY_W)
  const todayX = xOf(todayISO)

  // Bar geometry per subtask (for bars + dependency connectors)
  const subBiz = (d, n) => { const x = new Date(d); let c = 0; while (c < n) { x.setDate(x.getDate() - 1); if (isWeekday(x)) c++ } return x }
  const geo = {}
  rows.forEach((r, i) => {
    if (r.type !== 'sub' || !r.sched) return
    const s = r.sched, na = !!r.st.na, done = r.st.done && s.actualEnd
    let startISO, endISO
    if (na) { startISO = s.plannedStart; endISO = s.plannedStart }
    else if (done) { endISO = s.actualEnd; startISO = toISODate(subBiz(fromISODate(s.actualEnd), Number(r.st.duration) || 0)) } // green bar of its duration, ending at completion
    else { startISO = s.plannedStart; endISO = s.plannedEnd }
    let l = xOf(startISO), rr = xOf(endISO)
    if (rr < l) { const t = l; l = rr; rr = t }
    const w = na ? 0 : Math.max(MIN_BAR, rr - l)
    const overdue = !done && !na && s.plannedEnd <= todayISO
    const crit = !!s.critical
    // slack float bar: from the bar's end out to the latest allowable end (only for non-critical, non-done stages with float)
    const slackX = (!done && !na && s.slack > 0 && s.latestEnd) ? Math.max(l + w, xOf(s.latestEnd)) : null
    geo[r.st.id] = { l, r: l + w, w, na, done, overdue, crit, slackX, color: done ? DONE_C : (overdue ? OVERDUE_C : r.color), y: tops[i] + ROW_H / 2 }
  })
  // Orthogonal (right-angle) connectors: out from the predecessor end, down/up a vertical channel, into the successor start.
  const depLines = []
  const STUB = 8, chanUse = {}
  rows.forEach(r => {
    if (r.type !== 'sub') return
    const g = geo[r.st.id]; if (!g) return
    ;(r.st.depends_on || []).forEach(pid => {
      const pg = geo[pid]; if (!pg) return
      const x1 = pg.r, y1 = pg.y, x2 = g.l, y2 = g.y
      let chX = x2 >= x1 ? x1 + Math.max(STUB, Math.min((x2 - x1) * 0.5, 40)) : x1 + STUB
      const bucket = Math.round(chX / 8); const used = chanUse[bucket] || 0; chanUse[bucket] = used + 1
      chX += used * 4                                                       // fan out overlapping vertical channels
      const onCrit = critical.has(pid) && critical.has(r.st.id)            // both endpoints on the driving chain
      depLines.push({ d: `M ${x1} ${y1} H ${chX} V ${y2} H ${x2}`, crit: onCrit })
    })
  })

  // ── Drag-to-adjust: right edge → duration, left edge → pinned start ──
  const addBizG = (d, n) => { const x = new Date(d); if (n <= 0) return x; let c = 0; while (c < n) { x.setDate(x.getDate() + 1); if (isWeekday(x)) c++ } return x }
  const bizForwardG = d => { const x = new Date(d); while (!isWeekday(x)) x.setDate(x.getDate() + 1); return x }
  const bizBetweenG = (a, b) => { if (toISODate(b) < toISODate(a)) return -bizBetweenG(b, a); let c = 0; const x = new Date(a); while (toISODate(x) < toISODate(b)) { x.setDate(x.getDate() + 1); if (isWeekday(x)) c++ } return c }
  const dateOfX = px => { const days = Math.max(0, Math.round(px / DAY_W)); const d = new Date(rangeStartD); d.setDate(d.getDate() + days); return toISODate(d) }
  const EDGE = 8
  const edgeAt = (e, el) => { const rect = el.getBoundingClientRect(); const off = e.clientX - rect.left; const z = Math.min(EDGE, rect.width * 0.4); return off <= z ? 'left' : off >= rect.width - z ? 'right' : 'body' }
  const onBarPointerDown = (e, r) => {
    const edge = edgeAt(e, e.currentTarget)
    if (edge === 'body') return                                            // body → let onClick open the editor
    e.stopPropagation()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const dur = Math.max(1, Number(r.st.duration) || 1)
    dragRef.current = { subId: r.st.id, taskId: r.taskId, edge, startISO: r.sched.plannedStart, duration: dur,
      curDur: dur, curISO: r.st.pinned_start || r.sched.plannedStart, moved: false, x: e.clientX, y: e.clientY }
    bump()
  }
  const onBarPointerMove = (e, r) => {
    const d = dragRef.current
    if (!d || d.subId !== r.st.id) {                                       // not dragging: show resize cursor near edges
      if (e.pointerType === 'mouse') { const z = edgeAt(e, e.currentTarget); e.currentTarget.style.cursor = z === 'body' ? 'pointer' : 'ew-resize' }
      return
    }
    e.preventDefault(); d.moved = true; d.x = e.clientX; d.y = e.clientY
    const dropISO = dateOfX(e.clientX - (bodyRef.current?.getBoundingClientRect().left || 0))
    if (d.edge === 'right') d.curDur = Math.max(1, bizBetweenG(fromISODate(d.startISO), fromISODate(dropISO)))
    else d.curISO = toISODate(bizForwardG(fromISODate(dropISO)))
    bump()
  }
  const onBarPointerUp = (e, r) => {
    const d = dragRef.current
    if (d && d.subId === r.st.id) {
      if (d.moved) {
        suppressClickRef.current = Date.now()                              // the click that follows a drag must not open the editor
        if (d.edge === 'right' && d.curDur !== d.duration) onUpdateSubtask(d.taskId, d.subId, { duration: d.curDur })
        else if (d.edge === 'left' && d.curISO !== d.startISO) onUpdateSubtask(d.taskId, d.subId, { pinned_start: d.curISO })
      }
      dragRef.current = null; bump()
    }
  }
  const onBarClick = (r) => { if (Date.now() - suppressClickRef.current < 350) return; setSelected({ taskId: r.taskId, subId: r.st.id }) }
  const drag = dragRef.current

  const selSub = selected ? (linkedTasks.find(t => t.id === selected.taskId)?.subtasks || []).find(s => s.id === selected.subId) : null
  const legend = (c, l) => <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }}><span style={{ width:11, height:8, borderRadius:2, background:c, flexShrink:0 }} />{l}</span>

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:10, fontWeight:600, color:'#a99fc0', textTransform:'uppercase', letterSpacing:'0.06em' }}>Start</span>
          <div style={{ width:150 }}><DatePickerISO value={qual.start_date || ''} onChange={v => onUpdateQual(qual.id, { start_date: v || null })} /></div>
        </div>
        {projectedEnd && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:11, padding:'3px 10px', borderRadius:20,
            background: projSlipped ? '#FCEBEB' : '#EAF3DE', color: projSlipped ? '#791F1F' : '#27500A', border:`0.5px solid ${projSlipped ? '#F09595' : '#97C459'}` }}
            title={projSlipped ? `Projected completion is past the due date (${qual.due})` : 'Projected completion based on the current schedule'}>
            <span style={{ fontWeight:600 }}>Projected</span>{fmtGD(projectedEnd)} '{String(fromISODate(projectedEnd).getFullYear()).slice(-2)}{projSlipped ? ' · past due' : ''}
          </div>
        )}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
          {legend(TRACK_COLORS[0], 'On track')}{legend(DONE_C, 'Done')}{legend(OVERDUE_C, 'Overdue')}
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }}><span style={{ width:12, height:3, background:'#6d28d9', borderRadius:2 }} />Critical path</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }}><span style={{ width:12, height:3, borderRadius:2, background:'repeating-linear-gradient(90deg,#4f46e566 0 3px,transparent 3px 6px)' }} />Slack</span>
          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, color:'#888' }}><span style={{ width:2, height:11, background:'#E24B4A' }} />Today</span>
        </div>
      </div>

      {selSub && (
        <div style={{ border:'1px solid #c4b5fd', borderRadius:8, padding:'8px 10px', marginBottom:10, background:'#faf9ff' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
            <span style={{ fontSize:11, color:'#7c3aed', fontWeight:600 }}>{(linkedTasks.find(t => t.id === selected.taskId)?.title || '').split(' ')[0]} · {selSub.title}</span>
            <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:14, lineHeight:1, padding:0 }}>✕</button>
          </div>
          <QualSubtaskRow st={selSub} allSubs={allSubs} sched={sched[selSub.id]} onUpdate={patch => onUpdateSubtask(selected.taskId, selected.subId, patch)} />
        </div>
      )}

      <div style={{ overflowX:'auto', border:'0.5px solid #e5e5e5', borderRadius:10, WebkitOverflowScrolling:'touch' }}>
        <div style={{ display:'flex', minWidth: LEFT_W + timelineW }}>
          {/* Left label column (sticky) */}
          <div style={{ position:'sticky', left:0, zIndex:4, width:LEFT_W, flexShrink:0, background:'white', borderRight:'0.5px solid #e5e5e5' }}>
            <div style={{ height:HEADER_H, borderBottom:'0.5px solid #e5e5e5' }} />
            {rows.map((r, i) => r.type === 'track' ? (
              <div key={i} style={{ height:TH_H, display:'flex', alignItems:'center', gap:6, padding:'0 10px', background:'#faf9f7', borderBottom:'0.5px solid #f0f0f0', boxSizing:'border-box' }}>
                <span style={{ width:8, height:8, borderRadius:2, background:r.color, flexShrink:0 }} />
                <span style={{ fontSize:10, fontWeight:600, color:'#555', textTransform:'uppercase', letterSpacing:'0.04em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</span>
              </div>
            ) : (
              <div key={i} onClick={() => setSelected({ taskId:r.taskId, subId:r.st.id })}
                style={{ height:ROW_H, display:'flex', flexDirection:'column', justifyContent:'center', padding:'0 8px 0 20px', borderBottom:'0.5px solid #f7f7f5', cursor:'pointer', boxSizing:'border-box', opacity: r.st.na ? 0.5 : 1, background: selected?.subId === r.st.id ? '#f5f3ff' : 'white' }}
                onMouseEnter={e => { if (selected?.subId !== r.st.id) e.currentTarget.style.background = '#fafafa' }}
                onMouseLeave={e => { if (selected?.subId !== r.st.id) e.currentTarget.style.background = 'white' }}>
                <span style={{ fontSize:11, color:'#333', textDecoration: r.st.na ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.st.title}</span>
              </div>
            ))}
          </div>
          {/* Timeline */}
          <div style={{ width:timelineW, flexShrink:0 }}>
            <div style={{ height:HEADER_H, position:'relative', borderBottom:'0.5px solid #e5e5e5' }}>
              {months.map((mo, mi) => (
                <div key={mi} style={{ position:'absolute', left:mo.x, top:0, width:mo.w, height:'100%', borderLeft:'0.5px solid #e5e5e5', boxSizing:'border-box', display:'flex', alignItems:'center', paddingLeft:6 }}>
                  <span style={{ fontSize:10, color:'#888', fontWeight:500, whiteSpace:'nowrap' }}>{mo.label}</span>
                </div>
              ))}
            </div>
            <div ref={bodyRef} style={{ position:'relative', height:bodyH }}>
              {weekLines.map((x, wi) => <div key={'w'+wi} style={{ position:'absolute', left:x, top:0, width:1, height:bodyH, background:'#f5f5f5' }} />)}
              {months.map((mo, mi) => <div key={'m'+mi} style={{ position:'absolute', left:mo.x, top:0, width:1, height:bodyH, background:'#ececec' }} />)}
              {rows.map((r, i) => r.type === 'track' ? <div key={'tb'+i} style={{ position:'absolute', left:0, top:tops[i], width:timelineW, height:TH_H, background:'#faf9f7', borderBottom:'0.5px solid #f0f0f0' }} /> : null)}
              {todayX >= 0 && todayX <= timelineW && <div style={{ position:'absolute', left:todayX, top:0, width:1.5, height:bodyH, background:'#E24B4A', zIndex:2 }} />}
              {/* Projected completion marker */}
              {projectedEnd && (() => { const px = xOf(projectedEnd); if (px < 0 || px > timelineW) return null
                return <div title={`Projected completion ${fmtGD(projectedEnd)}${projSlipped ? ' · past due' : ''}`} style={{ position:'absolute', left:px, top:0, width:2, height:bodyH, background: projSlipped ? '#E24B4A' : '#7c3aed', opacity:0.75, zIndex:2 }} /> })()}
              <svg width={timelineW} height={bodyH} style={{ position:'absolute', left:0, top:0, pointerEvents:'none', zIndex:1 }}>
                <defs>
                  <marker id="qg-arrow-n" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L6,3 L0,6 z" fill="#b7a6e8" /></marker>
                  <marker id="qg-arrow-c" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L7,3.5 L0,7 z" fill="#6d28d9" /></marker>
                </defs>
                {depLines.filter(d => !d.crit).map((d, di) => <path key={'n'+di} d={d.d} stroke="#c9bced" strokeWidth="1" fill="none" opacity="0.55" markerEnd="url(#qg-arrow-n)" />)}
                {depLines.filter(d => d.crit).map((d, di) => <path key={'c'+di} d={d.d} stroke="#6d28d9" strokeWidth="2" fill="none" opacity="0.9" markerEnd="url(#qg-arrow-c)" />)}
              </svg>
              {rows.map((r, i) => {
                if (r.type !== 'sub') return null
                let g = geo[r.st.id]; if (!g) return null
                if (g.na) return <div key={'na'+i} title="N/A" style={{ position:'absolute', left:g.l - 3, top:tops[i] + ROW_H/2 - 1, width:6, height:2, background:'#ccc', zIndex:3 }} />
                const y = tops[i] + (ROW_H - BAR_H)/2
                const pinned = !!r.st.pinned_start
                // Live drag preview: recompute this bar's geometry from the in-flight edge
                const dg = drag && drag.subId === r.st.id && drag.moved ? drag : null
                if (dg) {
                  if (dg.edge === 'right') { const endISO = toISODate(addBizG(fromISODate(dg.startISO), dg.curDur)); const l = xOf(dg.startISO), rr = xOf(endISO); g = { ...g, l, r: rr, w: Math.max(MIN_BAR, rr - l) } }
                  else { const endISO = toISODate(addBizG(fromISODate(dg.curISO), dg.duration)); const l = xOf(dg.curISO), rr = xOf(endISO); g = { ...g, l, r: rr, w: Math.max(MIN_BAR, rr - l) } }
                }
                return <Fragment key={'b'+i}>
                  {g.slackX != null && g.slackX > g.r && !dg && <div title={`${r.sched.slack} business days of slack`} style={{ position:'absolute', left:g.r, top:tops[i] + ROW_H/2 - 1.5, width:g.slackX - g.r, height:3, background:`repeating-linear-gradient(90deg, ${r.color}66 0 3px, transparent 3px 6px)`, borderRadius:2, zIndex:2 }} />}
                  <div onPointerDown={e => onBarPointerDown(e, r)} onPointerMove={e => onBarPointerMove(e, r)} onPointerUp={e => onBarPointerUp(e, r)} onClick={() => onBarClick(r)}
                    title={`${r.st.title}  ·  ${r.sched ? (r.sched.actualEnd ? 'done '+fmtGD(r.sched.actualEnd) : fmtGD(r.sched.plannedStart)+' → '+fmtGD(r.sched.plannedEnd)) : ''}${pinned ? '  · 📌 pinned start' : ''}${g.crit ? '  · critical path' : (r.sched?.slack ? '  · +'+r.sched.slack+'d slack' : '')}  ·  drag edges to adjust`}
                    style={{ position:'absolute', left:g.l, top:y, width:g.w, height:BAR_H, background:g.color, borderRadius:4, cursor:'pointer', zIndex: dg ? 5 : 3, touchAction:'pan-y', boxShadow: dg ? '0 2px 6px rgba(0,0,0,0.25)' : (g.crit ? '0 1px 3px rgba(109,40,217,0.4)' : '0 1px 2px rgba(0,0,0,0.12)'), border: g.crit ? '1.5px solid #4c1d95' : 'none', borderLeft: pinned ? '3px solid #4c1d95' : (g.crit ? '1.5px solid #4c1d95' : 'none'), boxSizing:'border-box', opacity: dg ? 0.85 : 1, outline: selected?.subId === r.st.id ? '2px solid #7c3aed' : 'none', outlineOffset:1 }} />
                  {pinned && <button onClick={e => { e.stopPropagation(); onUpdateSubtask(r.taskId, r.st.id, { pinned_start: null }) }}
                    title={`Pinned start ${r.st.pinned_start} — click to unpin`}
                    style={{ position:'absolute', left:g.l - 6, top:tops[i] + ROW_H/2 - BAR_H/2 - 8, fontSize:10, lineHeight:1, background:'none', border:'none', cursor:'pointer', padding:0, zIndex:6 }}>📌</button>}
                </Fragment>
              })}
              {/* Live drag tooltip */}
              {drag && drag.moved && (
                <div style={{ position:'fixed', left:drag.x + 14, top:drag.y + 14, zIndex:400, background:'#111', color:'white', fontSize:11, padding:'4px 8px', borderRadius:6, pointerEvents:'none', whiteSpace:'nowrap', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
                  {drag.edge === 'right'
                    ? `${drag.curDur} bd · ends ${fmtGD(toISODate(addBizG(fromISODate(drag.startISO), drag.curDur)))}`
                    : `📌 ${fmtGD(drag.curISO)} → ${fmtGD(toISODate(addBizG(fromISODate(drag.curISO), drag.duration)))} · ${drag.duration} bd`}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QualificationsTab({ qualifications, tasks, templates, domains, members, isMobile, onAdd, onSave, onDelete, onMove, onSaveTask, onDeleteTask, onUpdateSubtask, onUpdateQual }) {
  const [form, setForm] = useState(null) // { qual, isEdit } | null
  const [draggingId, setDraggingId] = useState(null)
  const [overCol, setOverCol] = useState(null)
  const [search, setSearch] = useState('')
  const [view, setView] = useState('kanban') // 'kanban' | 'gantt'
  const [ganttQualId, setGanttQualId] = useState(null)
  const ganttQual = qualifications.find(ql => ql.id === ganttQualId) || qualifications[0]

  const q = search.trim().toLowerCase()
  const match = ql => !q || [ql.name, ql.supplier, ql.material, ql.site].some(v => (v||'').toLowerCase().includes(q))
  const visible = qualifications.filter(match)

  const openNew = () => setForm({ qual: { owners:['Levi'], status:'not_started' }, isEdit:false })
  const openEdit = ql => setForm({ qual: ql, isEdit:true })
  const drop = (id, status) => { if (id) onMove(id, status); setDraggingId(null); setOverCol(null) }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:1, background:'#ede9fe', borderRadius:10, padding:3 }}>
          {[{ k:'kanban', l:'Kanban' }, { k:'gantt', l:'Gantt' }].map(v => (
            <button key={v.k} onClick={() => setView(v.k)}
              style={{ fontSize:11, padding:'4px 14px', border:'none', background:view===v.k?'linear-gradient(135deg,#4f46e5,#7c3aed)':'transparent', color:view===v.k?'white':'#7c3aed', fontWeight:view===v.k?600:400, cursor:'pointer', borderRadius:8, whiteSpace:'nowrap' }}>{v.l}</button>
          ))}
        </div>
        {view === 'gantt' && qualifications.length > 0 && (
          <select value={ganttQual?.id || ''} onChange={e => setGanttQualId(e.target.value)}
            style={{ fontSize:12, padding:'5px 9px', border:'0.5px solid #c4b5fd', borderRadius:10, background:'white', height:28, outline:'none', color:'#333', cursor:'pointer', maxWidth:isMobile?'55%':280 }}>
            {qualifications.map(ql => <option key={ql.id} value={ql.id}>{ql.name}</option>)}
          </select>
        )}
        {view === 'kanban' && (
          <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
            <span style={{ position:'absolute', left:8, fontSize:12, color:'#a78bfa', pointerEvents:'none' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search qualifications…"
              style={{ fontSize:11, padding:'4px 8px 4px 26px', border:'0.5px solid #c4b5fd', borderRadius:10, background:'white', height:28, outline:'none', width:isMobile?140:200, color:'#333', boxSizing:'border-box' }} />
          </div>
        )}
        <button onClick={openNew} style={{ fontSize:12, background:'#111', color:'white', border:'none', borderRadius:8, padding:'6px 14px', cursor:'pointer', marginLeft:'auto' }}>+ New Qualification</button>
      </div>

      {qualifications.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:'#bbb', fontSize:13 }}>No qualifications yet — click <strong>+ New Qualification</strong> to start tracking a supplier.</div>
      ) : view === 'gantt' ? (
        <QualificationGantt qual={ganttQual} tasks={tasks} onUpdateSubtask={onUpdateSubtask} onUpdateQual={onUpdateQual} isMobile={isMobile} />
      ) : (
        <div style={{ display:'flex', gap:10, alignItems:'flex-start', overflowX:'auto', paddingBottom:8 }}>
          {QUAL_COLS.map(col => {
            const ct = visible.filter(ql => (ql.status||'not_started') === col.key).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))
            return (
              <div key={col.key}
                onDragOver={e => { e.preventDefault(); setOverCol(col.key) }}
                onDragLeave={() => setOverCol(null)}
                onDrop={e => { e.preventDefault(); drop(e.dataTransfer.getData('text/plain'), col.key) }}
                style={{ flex:'1 1 200px', minWidth:200, background:overCol===col.key?'#EEF4FF':'#f7f7f5', border:overCol===col.key?'1.5px dashed #378ADD':'1.5px solid transparent', borderRadius:12, padding:12, minHeight:200 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'0.06em' }}>{col.lbl}</span>
                  <span style={{ background:'white', border:'0.5px solid #e5e5e5', borderRadius:10, padding:'1px 7px', fontSize:11, color:'#888' }}>{ct.length}</span>
                </div>
                {ct.map(ql => (
                  <QualificationCard key={ql.id} qual={ql} tasks={tasks} onOpen={openEdit}
                    onDragStart={id => setDraggingId(id)} onDragEnd={() => { setDraggingId(null); setOverCol(null) }} dragging={draggingId===ql.id} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {form && (
        <QualificationForm qual={form.qual} isEdit={form.isEdit} templates={templates} domains={domains} members={members} tasks={tasks}
          onSave={(data, id) => id ? onSave(data, id) : onAdd(data)}
          onDelete={onDelete} onClose={() => setForm(null)}
          onSaveTask={onSaveTask} onDeleteTask={onDeleteTask} onUpdateSubtask={onUpdateSubtask} />
      )}
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
  const [qualifications, setQualifications] = useState([])
  const [qualificationTemplates, setQualificationTemplates] = useState([])
  const [userPrefs, setUserPrefs] = useState({}) // per-user UI prefs (e.g. Tasks-page layout), synced across devices
  const prefsDirtyRef = useRef(false) // true once the user has changed a pref this session (gates the write-back effect)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => { const saved = localStorage.getItem('taskr-tab'); return (saved && saved !== 'tasks') ? saved : 'linear' })
  const switchTab = t => { setTab(t); localStorage.setItem('taskr-tab', t) }
  const [activeEscalation, setActiveEscalation] = useState(null)
  const [activePopup, setActivePopup] = useState(null) // { entity, type: 'project' | 'escalation' }
  const [activeQualification, setActiveQualification] = useState(null) // qualification opened from the task board
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
    const [{ data: tasksData }, { data: domainsData }, { data: projectsData }, { data: calData }, { data: escalationsData }, { data: notesData }, { data: followUpsData }, { data: teamMembersData }, { data: qualTemplatesData }, { data: noteGroupsData }, { data: calendarsData }, { data: qualificationsData }, { data: qualificationTemplatesData }] = await Promise.all([
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
      supabase.from('qualifications').select('*').order('sort_order', { ascending: true }),
      supabase.from('qualification_templates').select('*').order('sort_order', { ascending: true }),
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
    setQualifications((qualificationsData || []).map(q => ({ ...q, owners: q.owners||[], notes: q.notes||[], attachments: q.attachments||[] })))
    setQualificationTemplates(qualificationTemplatesData || []) // empty until the qualification_templates table exists
    setNoteGroups(noteGroupsData || [])
    // Load per-user prefs once on the full (non-silent) load, so silent refreshes never clobber in-flight layout edits
    if (!silent) {
      const { data: prefRow } = await supabase.from('user_prefs').select('prefs').eq('user_id', session.user.id).maybeSingle()
      prefsDirtyRef.current = false // freshly loaded from DB — don't let the write-back effect echo it straight back
      setUserPrefs(prefRow?.prefs || {})
    }
    setLoading(false)
  }, [session])

  useEffect(() => { loadData() }, [loadData])

  // Merge a preference change into the user's prefs blob (pure state update); the effect below persists it
  const savePref = useCallback((section, key, value) => {
    prefsDirtyRef.current = true
    setUserPrefs(prev => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: value } }))
  }, [])
  // Debounced write-back — only fires for user-initiated changes, never for prefs just loaded from the DB
  useEffect(() => {
    if (!prefsDirtyRef.current || !session) return
    const t = setTimeout(() => {
      supabase.from('user_prefs').upsert({ user_id: session.user.id, prefs: userPrefs, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.error('[TASKr] savePref error', error) })
    }, 600)
    return () => clearTimeout(t)
  }, [userPrefs, session])

  useEffect(() => {
    const ch = supabase.channel('app-changes')
      .on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, () => loadData())
      .on('postgres_changes', { event:'*', schema:'public', table:'calendar_events' }, () => loadData())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [loadData])

  const calInitRef = useRef(false)
  const initCalendars = useCallback(async () => {
    if (calInitRef.current) return // guard against the init effect firing twice (e.g. StrictMode) → duplicate calendars
    calInitRef.current = true
    const { data: existing, error } = await supabase.from('calendars').select('id,type')
    if (error) { calInitRef.current = false; return }
    const inserts = []
    if (!existing?.some(c => c.type === 'default')) inserts.push({ name: 'My Events', color: '#4f46e5', visible: true, type: 'default', sort_order: 0 })
    HOLIDAY_CALS.forEach((h, i) => {
      if (!existing?.some(c => c.type === h.type)) inserts.push({ name: h.name, color: h.color, visible: true, type: h.type, sort_order: i + 1 })
    })
    let all = existing || []
    if (inserts.length > 0) {
      const { data: created } = await supabase.from('calendars').insert(inserts).select()
      all = [...all, ...(created || [])]
      await loadData(true)
    }
    const thisYear = new Date().getFullYear()
    let seeded = false
    for (const h of HOLIDAY_CALS) {
      const cal = all.find(c => c.type === h.type)
      if (!cal) continue
      const { data: existingHols } = await supabase.from('calendar_events')
        .select('start_date').eq('calendar_id', cal.id)
        .gte('start_date', `${thisYear}-01-01`).lte('start_date', `${thisYear + 1}-12-31`)
      const existingDates = new Set((existingHols || []).map(x => x.start_date))
      const toAdd = [
        ...generateHolidays(h.defs, thisYear, cal.id),
        ...generateHolidays(h.defs, thisYear + 1, cal.id),
      ].filter(e => !existingDates.has(e.start_date))
      if (toAdd.length > 0) { await supabase.from('calendar_events').insert(toAdd); seeded = true }
    }
    if (seeded) await loadData(true)
  }, [loadData])

  useEffect(() => { if (session) initCalendars() }, [session, initCalendars])

  const toggleCalendar = async (id, visible) => {
    setCalendarList(prev => prev.map(c => c.id === id ? { ...c, visible } : c))
    await supabase.from('calendars').update({ visible }).eq('id', id)
  }

  // `prior` (the pre-edit task row, when editing) lets us tell a fresh transition into 'waiting' apart from
  // staying waiting — so waiting_since stamps once and doesn't reset every time an unrelated field is edited.
  const buildTaskPayload = (data, prior = null) => {
    const status = data.status || 'active'
    const payload = {
      title: data.title, status, domain: data.domain||'',
      owners: data.owners||(currentUserName ? [currentUserName] : ['Levi']), due: data.due||'', priority: data.priority||'',
      color: data.color||'', substatus: data.substatus||'not_started',
      notes: data.notes||[], today: !!data.today, subtasks: data.subtasks||[], attachments: data.attachments||[],
      waiting_on: status === 'waiting' ? (data.waiting_on || '') : '',
      updated_at: new Date().toISOString(),
    }
    const wasWaiting = prior?.status === 'waiting'
    payload.waiting_since = status === 'waiting' ? (wasWaiting ? (prior.waiting_since || new Date().toISOString()) : new Date().toISOString()) : null
    if (data.project_id !== undefined) payload.project_id = data.project_id || null
    if (data.escalation_id !== undefined) payload.escalation_id = data.escalation_id || null
    if (data.qualification_id !== undefined) payload.qualification_id = data.qualification_id || null
    // A task under a project/bundle that has a domain inherits it (domain is locked on the task)
    if (payload.project_id) { const proj = projects.find(p => p.id === payload.project_id); if (proj?.domain) payload.domain = proj.domain }
    return payload
  }

  const saveTask = async data => {
    const prior = isEdit && form?.id ? tasks.find(t => t.id === form.id) : null
    const payload = buildTaskPayload(data, prior)
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
    const prior = editId ? tasks.find(t => t.id === editId) : null
    const payload = buildTaskPayload(data, prior)
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
          subtasks: (t.subtasks || []).map((s, j) => ({ id: (s && typeof s === 'object' && s.id) || `st${i}${j}`, title: (s && typeof s === 'object') ? (s.title || '') : s, done:false })),
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
    // Propagate color to tasks, and — when the project has a domain — force all its tasks to that domain
    const taskPatch = { color: data.color||'' }
    if (data.domain) taskPatch.domain = data.domain
    await supabase.from('tasks').update(taskPatch).eq('project_id', id)
    await loadData(true)
  }

  const deleteProject = async id => {
    await supabase.from('projects').delete().eq('id', id)
    if (activeProject === id) setActiveProject(null)
    await loadData()
  }

  // ── Supplier Qualifications ──────────────────────────────────────────────
  const addQualification = async data => {
    const tpl = data.template_id ? qualificationTemplates.find(t => t.id === data.template_id) : null
    const maxOrder = qualifications.length ? Math.max(...qualifications.map(q => q.sort_order||0)) : 0
    const owners = data.owners?.length ? data.owners : ['Levi']
    const payload = {
      name: data.name, supplier: data.supplier||'', material: data.material||'', site: data.site||'',
      status: data.status||'not_started', priority: data.priority||'', color: data.color||'',
      owners, due: data.due||'', notes: [], attachments: [],
      template_id: data.template_id||null, start_date: data.start_date||null, sort_order: maxOrder+1,
    }
    const { data: qual, error } = await supabase.from('qualifications').insert(payload).select().single()
    if (error || !qual) { console.error('[TASKr] addQualification error', error); alert(`Could not save qualification: ${error?.message || 'unknown error'}`); return }
    if (tpl?.tasks?.length) {
      const inserts = tpl.tasks.map((t, i) => ({
        title: t.title, status: 'active', substatus: 'not_started', domain: 'Supplier Qualification',
        qualification_id: qual.id, notes: [], attachments: [], owners,
        subtasks: (t.subtasks || []).map((s, j) => { const o = (s && typeof s === 'object'); return {
          id: (o && s.id) || `st${i}${j}`, title: o ? (s.title || '') : s,
          duration: o ? (s.duration ?? 1) : 1, depends_on: (o && Array.isArray(s.depends_on)) ? s.depends_on : [],
          done: false, na: false, completed_date: null, percent: 0, expected_end: null, pinned_start: null,
        } }),
        color: data.color||'', sort_order: i + 1, updated_at: new Date().toISOString(),
      }))
      const { error: taskErr } = await supabase.from('tasks').insert(inserts)
      if (taskErr) { console.error('[TASKr] addQualification stage error', taskErr); alert(`Qualification saved, but its stages failed: ${taskErr.message}`) }
    }
    await loadData(true)
  }

  const saveQualification = async (data, id) => {
    const payload = { name:data.name, supplier:data.supplier||'', material:data.material||'', site:data.site||'', status:data.status||'not_started', priority:data.priority||'', color:data.color||'', owners:data.owners||['Levi'], due:data.due||'', start_date:data.start_date||null, notes:data.notes||[], attachments:data.attachments||[] }
    const { error } = await supabase.from('qualifications').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('[TASKr] saveQualification error', error); alert(`Could not save qualification: ${error.message}`); return }
    await supabase.from('tasks').update({ color: data.color||'' }).eq('qualification_id', id)
    await loadData(true)
  }

  const deleteQualification = async id => {
    // Track tasks are owned by the qualification — remove them first so the delete never trips an FK constraint
    await supabase.from('tasks').delete().eq('qualification_id', id)
    await supabase.from('qualifications').delete().eq('id', id)
    await loadData(true)
  }

  const moveQualification = async (id, status) => {
    const updated_at = new Date().toISOString()
    setQualifications(prev => prev.map(q => q.id === id ? { ...q, status, updated_at } : q)) // optimistic
    await supabase.from('qualifications').update({ status, updated_at }).eq('id', id)
  }
  // Partial qualification update (e.g. the Gantt's start-date anchor) — optimistic so the chart reflows live
  const updateQualificationFields = async (id, patch) => {
    const updated_at = new Date().toISOString()
    setQualifications(prev => prev.map(q => q.id === id ? { ...q, ...patch, updated_at } : q))
    await supabase.from('qualifications').update({ ...patch, updated_at }).eq('id', id)
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
    if ('attachments' in data) payload.attachments = Array.isArray(data.attachments) ? data.attachments : []
    let newId = null
    if (id) {
      let { error } = await supabase.from('notes').update(payload).eq('id', id)
      if (error && 'attachments' in payload) { const { attachments, ...rest } = payload; error = (await supabase.from('notes').update(rest).eq('id', id)).error } // fallback if attachments column not yet added
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

  const saveNoteGroup = async (name, parentId = null) => {
    const maxOrder = noteGroups.length ? Math.max(...noteGroups.map(g => g.sort_order||0)) : 0
    const payload = { name, sort_order: maxOrder+1 }
    if (parentId) payload.parent_id = parentId // omitted for top-level groups so it works pre-migration
    const { data: grp, error } = await supabase.from('note_groups').insert(payload).select().single()
    if (error) { console.error('[TASKr] saveNoteGroup error', error); alert(`Could not create ${parentId ? 'subgroup' : 'group'}: ${error.message}`); return null }
    await loadData(true)
    return grp?.id
  }

  const renameNoteGroup = async (id, name) => {
    await supabase.from('note_groups').update({ name }).eq('id', id)
    await loadData(true)
  }

  const deleteNoteGroup = async (id, deleteNotes) => {
    // Include the group and any of its subgroups so nothing is orphaned
    const allIds = [id, ...noteGroups.filter(g => g.parent_id === id).map(g => g.id)]
    if (deleteNotes) {
      await supabase.from('notes').delete().in('group_id', allIds)
    } else {
      await supabase.from('notes').update({ group_id: null }).in('group_id', allIds)
    }
    await supabase.from('note_groups').delete().in('id', allIds)
    await loadData(true)
  }

  // Reassign a note's group (used by drag-and-drop on the Notes page). groupId may be null (Ungrouped).
  const moveNote = async (id, groupId) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, group_id: groupId ?? null } : n)) // optimistic
    const { error } = await supabase.from('notes').update({ group_id: groupId ?? null }).eq('id', id)
    if (error) { console.error('[TASKr] moveNote error', error); loadData(true) }
  }

  // Duplicate a note — attachments get real storage copies so the two notes never share files
  const duplicateNote = async id => {
    const src = notes.find(n => n.id === id)
    if (!src) return null
    const payload = { title: `${src.title || 'Untitled'} (copy)`, body: src.body || '', group_id: src.group_id ?? null, sort_order: src.sort_order ?? 0, updated_at: new Date().toISOString() }
    const { data: ins, error } = await supabase.from('notes').insert(payload).select('id').single()
    if (error) { console.error('[TASKr] duplicateNote error', error); alert(`Could not duplicate note: ${error.message}`); return null }
    const newId = ins.id
    const atts = Array.isArray(src.attachments) ? src.attachments : []
    if (atts.length) {
      const copied = []
      for (const a of atts) {
        try {
          const fname = (a.path || '').split('/').pop() || a.name
          const newPath = `notes/${newId}/${fname}`
          const { error: cpErr } = await supabase.storage.from('taskr-attachments').copy(a.path, newPath)
          if (cpErr) throw cpErr
          // private bucket: keep the storage path only; URLs are signed on demand. Strip any legacy public url.
          const { url: _legacyUrl, ...rest } = a
          copied.push({ ...rest, id: 'att' + Date.now() + Math.random().toString(36).slice(2, 6), path: newPath, ts: Date.now() })
        } catch (e) { console.error('[TASKr] duplicate attachment copy failed', e) }
      }
      if (copied.length) await supabase.from('notes').update({ attachments: copied }).eq('id', newId)
    }
    // Place the copy right after its source in the manual order (dense global renumber, only write what moved)
    const orderedIds = [...notes].sort(manualNoteCmp).map(n => n.id)
    const si = orderedIds.indexOf(id)
    orderedIds.splice(si + 1, 0, newId)
    await Promise.all(orderedIds
      .map((nid, i) => ({ id: nid, sort_order: i }))
      .filter(u => u.id === newId || (notes.find(n => n.id === u.id)?.sort_order ?? null) !== u.sort_order)
      .map(u => supabase.from('notes').update({ sort_order: u.sort_order }).eq('id', u.id)))
    await loadData(true)
    return newId
  }

  // Manual note ordering (drag-to-rearrange on the Notes page) — updates carry the full dense order; only write rows that moved
  const reorderNotes = async updates => {
    const changed = updates.filter(u => (notes.find(n => n.id === u.id)?.sort_order ?? null) !== u.sort_order)
    if (!changed.length) return
    setNotes(prev => prev.map(n => { const u = updates.find(x => x.id === n.id); return u ? { ...n, sort_order: u.sort_order } : n })) // optimistic
    const results = await Promise.all(changed.map(u => supabase.from('notes').update({ sort_order: u.sort_order }).eq('id', u.id)))
    const err = results.find(r => r.error)
    if (err) { console.error('[TASKr] reorderNotes error', err.error); loadData(true) } // revert optimistic state on failure
  }
  // Reorder note groups / subgroups among their siblings
  const reorderNoteGroups = async updates => {
    setNoteGroups(prev => prev.map(g => { const u = updates.find(x => x.id === g.id); return u ? { ...g, sort_order: u.sort_order } : g })
      .sort((a, b) => (a.sort_order||0) - (b.sort_order||0))) // optimistic
    const results = await Promise.all(updates.map(u => supabase.from('note_groups').update({ sort_order: u.sort_order }).eq('id', u.id)))
    const err = results.find(r => r.error)
    if (err) { console.error('[TASKr] reorderNoteGroups error', err.error); loadData(true) } // revert optimistic state on failure
  }

  const addFollowUp = async (text, person) => {
    const maxOrder = followUps.length ? Math.max(...followUps.map(f => f.sort_order||0)) : 0
    let { error } = await supabase.from('follow_ups').insert({ text, person, done: false, sort_order: maxOrder+1 })
    if (error) { const r = await supabase.from('follow_ups').insert({ text, person, done: false }); error = r.error } // fallback pre-migration
    if (error) { console.error('[TASKr] addFollowUp error', error); return }
    await loadData(true)
  }
  // Persist a reordered set of follow-up items (per-person ordering; sort_order is index-based)
  const reorderFollowUps = async updates => {
    setFollowUps(prev => prev.map(f => { const u = updates.find(x => x.id === f.id); return u ? { ...f, sort_order: u.sort_order } : f })) // optimistic
    await Promise.all(updates.map(u => supabase.from('follow_ups').update({ sort_order: u.sort_order }).eq('id', u.id)))
  }
  // Persist reordered task sort_orders (used by follow-up assigned-task up/down)
  const reorderTaskOrders = async updates => {
    setTasks(prev => prev.map(t => { const u = updates.find(x => x.id === t.id); return u ? { ...t, sort_order: u.sort_order } : t })) // optimistic
    await Promise.all(updates.map(u => supabase.from('tasks').update({ sort_order: u.sort_order }).eq('id', u.id)))
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
    // Domain is locked for tasks under a domained project/bundle — keep the project's domain on a domain patch
    const effPatch = t => {
      if ('domain' in patch && t?.project_id) { const d = projects.find(p => p.id === t.project_id)?.domain; if (d) return { ...patch, domain: d } }
      return patch
    }
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...effPatch(t), updated_at } : t)) // optimistic
    await Promise.all(ids.map(id => { const t = tasks.find(x => x.id === id); return supabase.from('tasks').update({ ...effPatch(t), updated_at }).eq('id', id) }))
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

  // Patch a single subtask's fields (duration, na, depends_on, done, completed_date) in the task's subtasks jsonb
  const updateSubtask = async (taskId, subtaskId, patch) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const subtasks = (task.subtasks||[]).map(s => s.id===subtaskId ? { ...s, ...patch } : s)
    const updated_at = new Date().toISOString()
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, subtasks, updated_at } : t)) // optimistic
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
    ...qualifications.map(q => [q.id, { name: q.name, type: 'qualification', color: q.color, notes: q.notes }]),
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
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:isMobile?'0.9rem':'1.25rem', paddingBottom:isMobile?'0.75rem':'1rem' }}>
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
      <div style={{ display:'flex', flexDirection:'column', alignItems:'stretch', background:'linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #a855f7 100%)', borderRadius:14, marginBottom:'1.25rem', overflow:'hidden' }}>
        <WorldClock style={{ width:'100%', background:'rgba(0,0,0,0.12)' }} />
        <div style={{ height:'1px', margin:'0 8px', background:'rgba(255,255,255,0.2)', flexShrink:0 }} />
        <div style={{ display:'flex', gap:2, padding:5, width:'100%' }}>
          {[
            { key:'briefing', label:'Briefing', Icon:Newspaper },
            { key:'linear', label:'Tasks', Icon:LayoutList },
            { key:'followups', label:'Follow Ups', Icon:RefreshCw },
            { key:'notes', label:'Notes', Icon:NotebookPen },
            { key:'calendar', label:'Calendar', Icon:CalendarDays },
            { key:'qualifications', label:'Qualifications', Icon:Factory },
            { key:'settings', label:'Settings', Icon:Settings },
          ].map(({ key, label, Icon }) => (
            <button key={key} onClick={() => switchTab(key)}
              style={{ display:'flex', flexDirection:isMobile?'column':'row', alignItems:'center', justifyContent:'center', gap:isMobile?3:6, fontSize:isMobile?10:13, padding:isMobile?'8px 2px':'7px 14px', cursor:'pointer', background:tab===key?'rgba(255,255,255,0.18)':'transparent', border:'none', borderRadius:10, color:tab===key?'#fff':'rgba(255,255,255,0.6)', fontWeight:tab===key?600:400, whiteSpace:'nowrap', flexShrink:0, flex:isMobile?1:'none', minWidth:0, transition:'background 0.15s, color 0.15s' }}>
              <Icon size={isMobile?18:15} strokeWidth={tab===key?2.2:1.8} />
              {isMobile ? label.split(' ')[0] : label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Briefing ── */}
      {tab === 'briefing' && <BriefingTab />}

      {/* ── Linear task mockup ── */}
      {tab === 'linear' && (
        <TaskLinearMockup tasks={tasks} entityMap={entityMap} domains={domains}
          domainMeta={Object.fromEntries(domainRows.map(d => [d.name, { color: d.color, text_color: d.text_color }]))}
          memberNames={memberNames} isMobile={isMobile}
          prefs={userPrefs.linear || {}} savePref={(key, value) => savePref('linear', key, value)}
          escalations={visibleEscalations}
          onEdit={t => { setForm({...t}); setIsEdit(true) }} onComplete={quickComplete} onUpdateTasks={updateTasksFields}
          onRestoreTask={restoreTask} onDeleteTask={deleteTaskSilent}
          onAddTask={prefill => { setForm({ status:'active', substatus:'not_started', ...prefill }); setIsEdit(false) }}
          onOpenEscalation={e => setActivePopup({ entity:e, type:'escalation' })}
          onOpenProject={id => { const p = projects.find(x => x.id === id); if (p) setActivePopup({ entity:p, type:'project' }) }}
          onOpenQualification={id => { const q = qualifications.find(x => x.id === id); if (q) setActiveQualification(q) }}
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

      {/* ── Qualifications ── */}
      {tab === 'qualifications' && (
        <QualificationsTab
          qualifications={qualifications}
          tasks={tasks}
          templates={qualificationTemplates}
          domains={domains}
          members={memberNames}
          isMobile={isMobile}
          onAdd={addQualification}
          onSave={saveQualification}
          onDelete={deleteQualification}
          onMove={moveQualification}
          onSaveTask={saveTaskSilent}
          onDeleteTask={deleteTaskSilent}
          onUpdateSubtask={updateSubtask}
          onUpdateQual={updateQualificationFields}
        />
      )}

      {/* ── Notes ── */}
      {tab === 'notes' && (
        <NotesSection notes={notes} onSaveNote={saveNote} onDeleteNote={deleteNote} noteGroups={noteGroups} onSaveGroup={saveNoteGroup} onRenameGroup={renameNoteGroup} onDeleteGroup={deleteNoteGroup} onMoveNote={moveNote} onReorderNotes={reorderNotes} onReorderGroups={reorderNoteGroups} onDuplicateNote={duplicateNote} members={memberNames} />
      )}

      {/* ── Follow Ups ── */}
      {tab === 'followups' && (
        <FollowUpsTab followUps={followUps} onAdd={addFollowUp} onToggle={toggleFollowUp} onDelete={deleteFollowUp} onUpdate={updateFollowUp} people={followUpPeople} tasks={tasks} entityMap={entityMap} isMobile={isMobile}
          onReorderFollowUps={reorderFollowUps} onReorderTasks={reorderTaskOrders}
          onOpenTask={t => { setForm({...t}); setIsEdit(true) }}
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
        <TaskForm task={form} isEdit={isEdit} onSave={saveTask} onDelete={deleteTask} onClose={() => setForm(null)} domains={domains} projects={projects} escalations={escalations} members={memberNames} defaultOwner={currentUserName}
          lockedDomain={(projects.find(p => p.id === form?.project_id)?.domain) || null} />
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

      {/* Qualification detail — opened by double-clicking a qualification container on the task board */}
      {activeQualification && (
        <QualificationForm
          qual={activeQualification}
          isEdit
          templates={qualificationTemplates}
          domains={domains}
          members={memberNames}
          tasks={tasks}
          onSave={(data, id) => saveQualification(data, id)}
          onDelete={deleteQualification}
          onClose={() => setActiveQualification(null)}
          onSaveTask={saveTaskSilent}
          onDeleteTask={deleteTaskSilent}
          onUpdateSubtask={updateSubtask}
        />
      )}
    </div>
  )
}

// ─── Qualification Template Settings ─────────────────────────────────────────
// Multi-select dependency picker (subtask ids) — shows each option as TRACK · title
function DepPicker({ deps, options, onChange }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ fontSize:10, padding:'2px 8px', borderRadius:10, border:'0.5px solid #e0e0e0', cursor:'pointer', background:'white', color: deps.length ? '#7c3aed' : '#888' }}>
        ⇄ Deps{deps.length ? ` · ${deps.length}` : ''} <span style={{ fontSize:8, opacity:0.7 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position:'fixed', inset:0, zIndex:150 }} />
          <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:'white', border:'0.5px solid #e5e5e5', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:200, minWidth:230, maxHeight:240, overflowY:'auto', padding:6 }}>
            {options.length === 0 && deps.length === 0 && <div style={{ fontSize:11, color:'#bbb', padding:6 }}>No other subtasks</div>}
            {options.map(o => { const on = deps.includes(o.id); return (
              <button key={o.id} onClick={() => onChange(on ? deps.filter(d => d !== o.id) : [...deps, o.id])}
                style={{ display:'flex', alignItems:'center', gap:6, width:'100%', textAlign:'left', padding:'5px 7px', background:'none', border:'none', borderRadius:6, cursor:'pointer', fontSize:11 }}
                onMouseEnter={e => e.currentTarget.style.background='#f5f5f3'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                <span style={{ width:11, flexShrink:0, color:'#7c3aed', fontSize:10 }}>{on ? '✓' : ''}</span>
                <span style={{ fontSize:8, color:'#aaa', textTransform:'uppercase', flexShrink:0, minWidth:52 }}>{o.trackShort}</span>
                <span style={{ flex:1, color:'#333' }}>{o.title}</span>
              </button>
            )})}
            {deps.filter(d => !options.some(o => o.id === d)).map(d => (
              <button key={d} onClick={() => onChange(deps.filter(x => x !== d))} title="Removed subtask — click to clear this stale dependency"
                style={{ display:'flex', alignItems:'center', gap:6, width:'100%', textAlign:'left', padding:'5px 7px', background:'none', border:'none', borderRadius:6, cursor:'pointer', fontSize:11 }}
                onMouseEnter={e => e.currentTarget.style.background='#fff5f5'} onMouseLeave={e => e.currentTarget.style.background='none'}>
                <span style={{ width:11, flexShrink:0, color:'#c0392b', fontSize:10 }}>✓</span>
                <span style={{ flex:1, color:'#c0392b' }}>{d} <span style={{ color:'#bbb' }}>(removed)</span></span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function QualTemplateSettings({ onUpdate, table = 'qual_templates', title = 'Bundle Templates', subtitle = 'Pre-populate tasks when creating a bundle.', scheduled = false }) {
  const [templates, setTemplates] = useState([])
  const [editId, setEditId] = useState(null)
  const [draft, setDraft] = useState(null) // { name, tasks: [{title, subtasks:[string | {id,title,duration,depends_on}]}] }
  const [newTaskTitle, setNewTaskTitle] = useState('')

  useEffect(() => {
    supabase.from(table).select('*').order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setTemplates(data) })
  }, [table])

  // Scheduled templates store richer subtask objects (stable positional ids st<track><index>). Strings are upgraded on load.
  const normSub = (s, ti, si) => (typeof s === 'string' || !s)
    ? { id:`st${ti}${si}`, title: s || '', duration: 1, depends_on: [] }
    : { id: s.id || `st${ti}${si}`, title: s.title || '', duration: s.duration ?? 1, depends_on: Array.isArray(s.depends_on) ? s.depends_on : [] }
  const normTasks = tasks => (tasks || []).map((t, ti) => ({ ...t, subtasks: (t.subtasks || []).map((s, si) => scheduled ? normSub(s, ti, si) : s) }))
  const nextSubId = (ti, subs) => { let n = subs.length; const used = new Set(subs.map(s => s.id)); while (used.has(`st${ti}${n}`)) n++; return `st${ti}${n}` }
  const updateSub = (ti, si, patch) => setDraft(d => ({ ...d, tasks: d.tasks.map((t, idx) => idx===ti ? { ...t, subtasks: t.subtasks.map((su, j) => j===si ? { ...su, ...patch } : su) } : t) }))

  const startNew = () => { setDraft({ name:'', tasks:[] }); setEditId('new') }
  const startEdit = t => { const c = JSON.parse(JSON.stringify(t)); setDraft({ ...c, tasks: normTasks(c.tasks) }); setEditId(t.id) }
  const cancel = () => { setDraft(null); setEditId(null); setNewTaskTitle('') }

  const saveDraft = async () => {
    if (!draft.name.trim()) return
    const payload = { name: draft.name.trim(), tasks: draft.tasks }
    if (editId === 'new') {
      await supabase.from(table).insert(payload)
    } else {
      await supabase.from(table).update(payload).eq('id', editId)
    }
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: true })
    if (data) setTemplates(data)
    onUpdate?.()
    cancel()
  }

  const deleteTemplate = async id => {
    await supabase.from(table).delete().eq('id', id)
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
  const addSubtask = (i, v) => { const s = v.trim(); if (!s) return; setDraft(d => ({ ...d, tasks: d.tasks.map((t,idx) => idx===i ? { ...t, subtasks:[...t.subtasks, scheduled ? { id: nextSubId(i, t.subtasks), title: s, duration: 1, depends_on: [] } : s] } : t) })) }
  const removeSubtask = (ti, si) => setDraft(d => {
    const removedId = scheduled ? d.tasks[ti]?.subtasks?.[si]?.id : null
    return { ...d, tasks: d.tasks.map((t, idx) => {
      let subs = idx === ti ? t.subtasks.filter((_, j) => j !== si) : t.subtasks
      if (removedId) subs = subs.map(s => (s && typeof s === 'object' && Array.isArray(s.depends_on) && s.depends_on.includes(removedId)) ? { ...s, depends_on: s.depends_on.filter(x => x !== removedId) } : s)
      return { ...t, subtasks: subs }
    }) }
  })

  // Every subtask across the template (for the dependency picker)
  const allTemplateSubs = (scheduled && draft) ? draft.tasks.flatMap(t => (t.subtasks || []).map(su => ({ id: su.id, title: su.title, trackShort: (t.title || '').split(' ')[0] }))) : []

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ fontSize:14, fontWeight:500, color:'#111', marginBottom:2 }}>{title}</div>
          <div style={{ fontSize:12, color:'#aaa' }}>{subtitle}</div>
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
                {task.subtasks.map((s, si) => scheduled ? (
                  <div key={si} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                    <input value={s.title} onChange={e => updateSub(ti, si, { title: e.target.value })}
                      style={{ flex:1, minWidth:0, fontSize:11, border:'none', borderBottom:'0.5px solid #e5e5e5', outline:'none', background:'transparent', fontFamily:'inherit', color:'#555', padding:'1px 0' }} />
                    <label style={{ display:'flex', alignItems:'center', gap:2, fontSize:9, color:'#999', flexShrink:0 }}>
                      <input type="number" min={0} value={s.duration ?? 1} onChange={e => updateSub(ti, si, { duration: Math.max(0, parseInt(e.target.value) || 0) })}
                        style={{ width:34, fontSize:10, padding:'1px 3px', border:'0.5px solid #e0e0e0', borderRadius:4, outline:'none' }} />bd
                    </label>
                    <DepPicker deps={s.depends_on || []} options={allTemplateSubs.filter(o => o.id !== s.id)} onChange={dep => updateSub(ti, si, { depends_on: dep })} />
                    <button onClick={() => removeSubtask(ti, si)} style={{ background:'none', border:'none', color:'#ddd', cursor:'pointer', fontSize:11, flexShrink:0 }} onMouseEnter={e => e.currentTarget.style.color='#E24B4A'} onMouseLeave={e => e.currentTarget.style.color='#ddd'}>✕</button>
                  </div>
                ) : (
                  <div key={si} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <input value={typeof s === 'string' ? s : (s?.title || '')} onChange={e => setDraft(d => ({ ...d, tasks: d.tasks.map((t,idx) => idx===ti?{...t,subtasks:t.subtasks.map((sub,j)=>j===si?e.target.value:sub)}:t) }))}
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
  const [holidayCalId, setHolidayCalId] = useState(null)

  const holidayCals = calendars.filter(c => isHolidayCalType(c.type))
  const holidayCal = holidayCals.find(c => c.id === holidayCalId) || holidayCals[0]

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
    const toAdd = generateHolidays(defsForCalType(holidayCal.type), year, holidayCal.id).filter(h => !existing.includes(h.start_date))
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
                {isHolidayCalType(cal.type) && <span style={{ fontSize:10, color:'#aaa', background:'#f0f0f0', borderRadius:10, padding:'1px 6px' }}>system</span>}
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

      {/* Holidays editor (per country/region) */}
      {holidayCal && (
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:8 }}>Holidays</div>
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:10 }}>
            {holidayCals.map(c => {
              const sel = holidayCal?.id === c.id
              return (
                <button key={c.id} onClick={() => setHolidayCalId(c.id)}
                  style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 10px', borderRadius:20, cursor:'pointer', border:`0.5px solid ${sel ? c.color : '#e0e0e0'}`, background: sel ? c.color+'18' : 'white', color: sel ? c.color : '#888', fontWeight: sel ? 600 : 400 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:c.color, flexShrink:0 }} />{c.name}
                </button>
              )
            })}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
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
    { key: 'qualtemplates', label: 'Qual Templates', icon: '🏭' },
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
        {section === 'qualtemplates' && <QualTemplateSettings onUpdate={onUpdate} table="qualification_templates" title="Qualification Templates" subtitle="Stages, durations and dependencies auto-created when you qualify a supplier." scheduled />}
      </div>
    </div>
  )
}

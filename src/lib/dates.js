// ─── Calendar date helpers ──────────────────────────────────────────────────
// Pure, dependency-free. Shared by the qualification scheduler, the audit clock
// engine, and every date field in the app — a single source of truth for how
// ISO date strings and local Date objects convert back and forth.
export const toISODate = d => { const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
export const fromISODate = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d) }
export const today = () => toISODate(new Date())
export function isWeekday(d) { const w = d.getDay(); return w !== 0 && w !== 6 }

// Calendar-day (not business-day) arithmetic — used by the audit clock engine,
// which deliberately runs on calendar days while the qualification scheduler
// runs on business days.
export const addCalDays = (iso, n) => { const d = fromISODate(iso); d.setDate(d.getDate() + n); return toISODate(d) }
export const calDaysBetween = (fromISO, toISO) => Math.round((fromISODate(toISO) - fromISODate(fromISO)) / 86400000)

// ─── Display formatting / parsing ──────────────────────────────────────────
export const fmtTs = ts => { const d = new Date(ts); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }
export const fmtDateTime = iso => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) }
// MM/DD/YY, the DatePicker display format
export function formatDue(d) { const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0'), yy=String(d.getFullYear()).slice(-2); return `${mm}/${dd}/${yy}` }
// Parse a due date (MM/DD/YY from DatePicker, or ISO) to a Date for comparison; null if empty/invalid
export function parseDueDate(s) {
  if (!s) return null
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) { const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return new Date(yy, Number(m[1]) - 1, Number(m[2])) }
  const d = new Date(s); return isNaN(d) ? null : d
}

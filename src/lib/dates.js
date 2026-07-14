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

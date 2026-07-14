import { toISODate, fromISODate, isWeekday } from './dates.js'

// ─── Qualification scheduling engine ──────────────────────────────────────────
// Pure. Returns { [subtaskId]: { plannedStart, plannedEnd, actualEnd } } — all ISO dates, business-day based.
// Returns { schedule: {id -> {plannedStart, plannedEnd, actualEnd, slack, latestEnd, critical, warning}}, critical: Set<id>, projectedEnd: ISO|null }
export function computeSchedule(qualification, trackTasks, todayISO) {
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

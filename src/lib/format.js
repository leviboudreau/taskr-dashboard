// ─── Shared formatters / small pure helpers ────────────────────────────────
// Pure, dependency-free, no date logic (see dates.js for that).

// Effective substatus for a task: 'waiting' status wins outright, otherwise the stored substatus,
// falling back to 'complete'/'not_started' from the plain status. Was defined identically in two
// components (FollowUpsTab, TaskLinearMockup) — consolidated here.
export const tss = t => t.status === 'waiting' ? 'waiting' : (t.substatus || (t.status === 'done' ? 'complete' : 'not_started'))

export const capFirst = s => s ? s[0].toUpperCase() + s.slice(1) : s

export const flagBg = c => ({ red: '#FCEBEB', orange: '#FFF0E8', yellow: '#FEFCE8', green: '#EAF3DE', blue: '#E6F1FB', violet: '#EEEDFE' }[c] || null)
export const flagBorder = c => ({ red: '#E24B4A', orange: '#F97316', yellow: '#EAB308', green: '#639922', blue: '#378ADD', violet: '#7F77DD' }[c] || null)

// Canonical note ordering: manual sort_order first (dense, global), then newest-first as a stable tiebreak
export const manualNoteCmp = (a, b) => ((a.sort_order ?? 1e9) - (b.sort_order ?? 1e9)) || (new Date(b.created_at) - new Date(a.created_at))

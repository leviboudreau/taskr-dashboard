// ─── Design tokens ──────────────────────────────────────────────────────────
// The single source of truth for color/radius/spacing. Before this existed, FIELD_LABEL/FIELD_INPUT/
// BTN_PRIMARY etc. were the only shared style constants and they only covered fonts and buttons — every
// new feature invented its own near-identical gray or amber because there was nothing else to reach for
// (that's how the app ended up with e.g. four different "Cancel button" grays and three different "warn"
// ambers before this got consolidated). Extend this file, not a one-off hex, next time a feature needs
// a color/radius/spacing value that isn't already here.

export const COLORS = {
  accent: '#7c3aed',
  accentGradient: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
  // The TASKr wordmark's own gradient — a 3-stop variant of accentGradient that lingers in violet before
  // ending in pink. Deliberately distinct from accentGradient (used by buttons/active pills); kept in one
  // place because it had drifted into two slightly different versions (2-stop pre-login vs. 3-stop in-app).
  logoGradient: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a855f7 100%)',
  accentSoft: '#ede9fe',
  accentBorder: '#c4b5fd',
  accentBorderSoft: '#ddd6fe',

  border: '#e5e5e5',       // static containers/cards
  fieldBorder: '#e0e0e0',  // interactive inputs — one step lighter, deliberately distinct from `border`

  text: '#333',
  textMuted: '#888',
  textFaint: '#bbb',
  label: '#a99fc0',

  panelBg: '#f7f7f5',

  // Semantic tones — these are exactly SUBSTATUS's at_risk/waiting/complete triplets. Kept in sync
  // deliberately: SUBSTATUS is the full status-color table, these are the three that generalize.
  danger:  { bg: '#FCEBEB', text: '#791F1F', border: '#F09595' },
  warn:    { bg: '#FFF4E0', text: '#8A5A00', border: '#F0A500' },
  success: { bg: '#EAF3DE', text: '#27500A', border: '#97C459' },

  deleteText: '#A32D2D',
  deleteBorder: '#F09595',
}

// `ctrl` (10) sits between md/lg and covers buttons/pills/inputs specifically — it was already the most
// common radius in the app (more common than md or lg) without being in this table; adding it rather than
// migrating ~70 call sites to a value that doesn't match their actual visual weight.
export const RADIUS = { sm: 6, md: 8, ctrl: 10, lg: 12, xl: 16, pill: 20 }
export const SPACE = { xs: 4, sm: 8, md: 10, lg: 12, xl: 16 }

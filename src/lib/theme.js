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

export const RADIUS = { sm: 6, md: 8, lg: 12, xl: 16, pill: 20 }
export const SPACE = { xs: 4, sm: 8, md: 10, lg: 12, xl: 16 }

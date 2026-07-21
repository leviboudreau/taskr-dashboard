import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import DOMPurify from 'dompurify'
import { Undo2, Redo2, Link2, Quote, Minus, AlignLeft, AlignCenter, AlignRight, AlignVerticalSpaceBetween } from 'lucide-react'
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
import { upgradeLegacyNoteHtml } from '../lib/noteHtml.js'

// This file exists as its own module (rather than living inline in App.jsx like most components)
// specifically so it can be React.lazy-loaded — Tiptap + its extensions are ~615KB, and previously
// loaded on every page view even for users who never opened Notes.

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

// Line spacing is a personal reading/writing preference, not part of a note's content — kept in
// localStorage (like taskr-tab, taskr-minimized-cols) rather than the synced user_prefs table, and
// applied to every note uniformly rather than stored per-note.
const LINE_SPACING_KEY = 'taskr-note-line-spacing'
const LINE_SPACING_OPTIONS = [
  { key: 'tight', label: 'Tight', value: 1.25 },
  { key: 'normal', label: 'Normal', value: 1.4 },
  { key: 'relaxed', label: 'Relaxed', value: 1.6 },
  { key: 'loose', label: 'Loose', value: 1.85 },
]
const DEFAULT_LINE_SPACING = LINE_SPACING_OPTIONS.find(o => o.key === 'normal').value

function LineSpacingPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    if (!open) return
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  const current = LINE_SPACING_OPTIONS.find(o => o.key === value) || LINE_SPACING_OPTIONS[1]
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onMouseDown={e => { e.preventDefault(); setOpen(o => !o) }} title={`Line spacing: ${current.label}`}
        style={{ height: 26, minWidth: 26, padding: '0 7px', border: 'none', borderRadius: 7, background: open ? '#ede9fe' : 'transparent', color: open ? '#7c3aed' : '#555', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#f0edff' }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent' }}>
        <AlignVerticalSpaceBetween size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 300, background: 'white', border: '0.5px solid #e0e0e0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 110, padding: 4 }}>
          {LINE_SPACING_OPTIONS.map(opt => (
            <button key={opt.key} onMouseDown={e => { e.preventDefault(); onChange(opt.key) }}
              style={{ width: '100%', textAlign: 'left', padding: '6px 10px', background: opt.key === value ? '#ede9fe' : 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: opt.key === value ? '#7c3aed' : '#333', borderRadius: 6, fontFamily: 'inherit' }}
              onMouseEnter={e => { if (opt.key !== value) e.currentTarget.style.background = '#f7f7f5' }}
              onMouseLeave={e => { if (opt.key !== value) e.currentTarget.style.background = 'none' }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TipTap building blocks (engine under the notes editor) ───────────────────

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

// Table cell/header that keep their fill color. Both need this — a <th> (e.g. a table's header row,
// like the Audit Notes template's gold header) loses its background on parse if only TableCell is
// extended, since TipTap's base TableHeader node doesn't declare a backgroundColor attribute either.
const bgColorAttr = {
  backgroundColor: {
    default: null,
    parseHTML: el => (el.style && el.style.backgroundColor) || null,
    renderHTML: attrs => attrs.backgroundColor ? { style: `background-color:${attrs.backgroundColor}` } : {},
  },
}
const FillTableCell = TableCell.extend({ addAttributes() { return { ...this.parent?.(), ...bgColorAttr } } })
const FillTableHeader = TableHeader.extend({ addAttributes() { return { ...this.parent?.(), ...bgColorAttr } } })

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

// Exported so NoteCanvas can inject the same rules for its static box previews — those need to render
// correctly even when no RichTextEditor (and thus no copy of this <style> tag) is currently mounted.
export const NOTE_EDITOR_CSS = `
.note-editor .ProseMirror,.note-editor [contenteditable="true"]{outline:none;padding:12px 16px;min-height:200px}
/* compact: canvas boxes — no reserved empty space, the box grows to fit whatever's actually typed */
.note-editor.note-editor--compact .ProseMirror,.note-editor.note-editor--compact [contenteditable="true"]{padding:0;min-height:20px}
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
.note-editor pre{background:#f7f7f5;border-radius:8px;padding:10px 12px;font-size:0.9em;overflow-x:auto}
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

// toolbarPortalTarget: an optional DOM node to render the toolbar into instead of its normal spot above
// the content — lets a caller (NoteCanvas) dock every box's formatting toolbar in one shared location,
// the same way the standard single-document note editor's toolbar sits at the top of its panel, rather
// than a separate cramped copy inside each small box.
// compact: used inside a NoteCanvas box — no border/scroll of its own (the box wrapper supplies both)
// and no reserved minimum height, so the box can grow to fit exactly what's typed, not a fixed frame.
function RichTextEditor({ initialValue, onChange, isMobile = false, members = [], autoFocus = false, toolbarPortalTarget = null, compact = false }) {
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [tableHover, setTableHover] = useState([0, 0])
  const editorRef = useRef(null)
  const [lineSpacingKey, setLineSpacingKey] = useState(() => {
    try { return localStorage.getItem(LINE_SPACING_KEY) || 'normal' } catch { return 'normal' }
  })
  const lineHeight = LINE_SPACING_OPTIONS.find(o => o.key === lineSpacingKey)?.value || DEFAULT_LINE_SPACING
  const setLineSpacing = key => {
    setLineSpacingKey(key)
    try { localStorage.setItem(LINE_SPACING_KEY, key) } catch {}
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: false } }),
      TextStyle, Color, FontSize,
      Highlight.configure({ multicolor: true }),
      Subscript, Superscript,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow, FillTableHeader, FillTableCell,
      TaskList, TaskItem.configure({ nested: true }),
      NoteImage, MentionChip, TabKeymap,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    // ADD_ATTR: colwidth isn't a standard HTML attribute, so DOMPurify's default allowlist strips it —
    // column widths would resize fine in-session but silently reset to equal-width on the next reload.
    content: DOMPurify.sanitize(upgradeLegacyNoteHtml(initialValue || ''), { ADD_ATTR: ['colwidth'] }),
    autofocus: autoFocus ? 'end' : false,
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

  // Toolbar — sticky so it stays above the keyboard on mobile (a no-op when portaled: sticky only
  // matters if its actual container scrolls, and the portal target here doesn't). Bare (no border/
  // background) when portaled — the destination already supplies that chrome.
  const toolbar = (
      <div style={{ position: 'sticky', top: 0, zIndex: 5, ...(toolbarPortalTarget ? { background: 'transparent' } : { background: 'white', border: '0.5px solid #e5e5e5', borderBottom: 'none' }) }}>
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
          <LineSpacingPicker value={lineSpacingKey} onChange={setLineSpacing} />
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
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: compact ? 'initial' : 1, minHeight: 0, position: 'relative' }}>
      <style>{NOTE_EDITOR_CSS}</style>
      {toolbarPortalTarget ? createPortal(toolbar, toolbarPortalTarget) : toolbar}
      {/* Editing surface */}
      <EditorContent editor={editor} className={`note-editor${compact ? ' note-editor--compact' : ''}`}
        style={compact
          ? { fontSize: 13, lineHeight, color: '#333', cursor: 'text' }
          : { flex: 1, border: '0.5px solid #e5e5e5', borderTop: toolbarPortalTarget ? '0.5px solid #e5e5e5' : 'none', overflowY: 'auto', WebkitOverflowScrolling: 'touch', fontSize: isMobile ? 16 : 15, lineHeight, color: '#333', minHeight: 200, cursor: 'text' }}
        onClick={e => { if (e.target === e.currentTarget || e.target.classList?.contains('note-editor')) editor.chain().focus('end').run() }} />
    </div>
  )
}

export default RichTextEditor

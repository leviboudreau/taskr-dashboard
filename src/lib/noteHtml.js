const FONT_STEPS = { 1: '0.72em', 2: '0.86em', 3: '1em', 4: '1.3em', 5: '1.7em' }

// Upgrade execCommand-era note HTML so it round-trips through the TipTap schema:
// <font size> → sized spans, hand-rolled checkbox divs → real task lists.
export function upgradeLegacyNoteHtml(html) {
  if (!html) return ''
  // <template> content is an inert DocumentFragment with no browsing context: parsing untrusted
  // HTML into it (unlike a live/detached <div>) never fires <img onerror>/onload or runs scripts.
  const root = document.createElement('template')
  root.innerHTML = html
  root.content.querySelectorAll('font[size]').forEach(f => {
    const span = document.createElement('span')
    span.style.fontSize = FONT_STEPS[f.getAttribute('size')] || '1em'
    while (f.firstChild) span.appendChild(f.firstChild)
    f.replaceWith(span)
  })
  const isCheckRow = el => !!(el && el.nodeType === 1 && el.tagName === 'DIV' && el.querySelector(':scope > input[type="checkbox"]'))
  const absorbed = new Set() // rows already folded into a list (root is detached, so isConnected can't be used)
  ;[...root.content.querySelectorAll('div')].filter(isCheckRow).forEach(row => {
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

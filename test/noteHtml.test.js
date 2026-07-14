import { test, describe, before } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// upgradeLegacyNoteHtml relies on a global `document` (as it does in the browser via Vite), so jsdom's
// window/document must exist before the module is evaluated — hence the dynamic import inside before().
let upgradeLegacyNoteHtml, dom

before(async () => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' })
  global.window = dom.window
  global.document = dom.window.document
  ;({ upgradeLegacyNoteHtml } = await import('../src/lib/noteHtml.js'))
})

describe('upgradeLegacyNoteHtml — XSS hardening', () => {
  test('an <img onerror> payload never fires while the HTML is being upgraded', async () => {
    let fired = false
    dom.window.__mark = () => { fired = true }
    upgradeLegacyNoteHtml('<img src="x" onerror="window.__mark()">')
    await new Promise(r => setTimeout(r, 50)) // let jsdom settle in case anything async was queued
    assert.equal(fired, false)
  })
})

describe('upgradeLegacyNoteHtml — behavior preserved', () => {
  test('upgrades <font size> to a sized span', () => {
    const out = upgradeLegacyNoteHtml('<font size="4">big text</font>')
    assert.ok(out.includes('font-size: 1.3em') || out.includes('font-size:1.3em'), out)
    assert.ok(!out.includes('<font'), 'no leftover <font> tag')
  })
  test('upgrades hand-rolled checkbox rows into a real task list', () => {
    const html = '<div><input type="checkbox" checked><span>Task A</span></div><div><input type="checkbox"><span>Task B</span></div>'
    const out = upgradeLegacyNoteHtml(html)
    assert.ok(out.includes('data-type="taskList"'))
    assert.ok(out.includes('data-checked="true"') && out.includes('data-checked="false"'))
    assert.ok(out.includes('Task A') && out.includes('Task B'))
  })
  test('empty/falsy input returns an empty string', () => {
    assert.equal(upgradeLegacyNoteHtml(''), '')
    assert.equal(upgradeLegacyNoteHtml(null), '')
  })
})

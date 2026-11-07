'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { paginate, bindWheelPaging } = require('../src/details')
test('long detail lists are paged without losing or repeating records', () => {
  const rows = Array.from({ length: 125 }, (_, id) => ({ id }))
  const pages = Array.from({ length: 13 }, (_, page) => paginate(rows, page))
  assert.deepEqual(pages.map(p => p.items.length), [...Array(12).fill(10), 5])
  assert.deepEqual([pages[0], pages[12]].map(p => [p.start, p.end]), [[1, 10], [121, 125]])
  assert.deepEqual(pages.flatMap(p => p.items), rows)
  assert.equal(paginate(rows, 99).page, 12)
  assert.equal(paginate(rows, -1).page, 0)
})

test('short lists are split into pages when a small window has fewer visible rows', () => {
  const rows = Array.from({ length: 8 }, (_, id) => id)
  assert.deepEqual([0, 1, 2].map(page => paginate(rows, page, 3).items), [[0, 1, 2], [3, 4, 5], [6, 7]])
})

function wheelFixture(pages = 4) {
  const state = { page: 0, pages }, listeners = new Map(), changes = []
  const body = { scrollTop: 0, clientHeight: 300, scrollHeight: 300,
    addEventListener(type, fn, options) { assert.equal(options.passive, false); listeners.set(type, fn) },
    removeEventListener(type) { listeners.delete(type) }
  }
  const close = bindWheelPaging(body, () => state, page => { state.page = page; changes.push(page) })
  return { state, body, changes, close, listeners, wheel(deltaY, timeStamp, extra = {}) {
    const event = { deltaY, deltaX: 0, deltaMode: 0, timeStamp, prevented: false, preventDefault() { this.prevented = true }, ...extra }
    listeners.get('wheel')?.(event)
    return event
  } }
}

test('wheel turns pages in both directions with a cooldown and stops at the first and last pages', () => {
  const f = wheelFixture(3)
  f.wheel(-100, 0)
  assert.equal(f.state.page, 0)
  f.wheel(100, 10)
  f.wheel(100, 100)
  assert.equal(f.state.page, 1)
  f.wheel(100, 400)
  f.wheel(100, 800)
  assert.equal(f.state.page, 2)
  f.wheel(-100, 1200)
  assert.deepEqual(f.changes, [1, 2, 1])
  f.close()
  assert.equal(f.listeners.size, 0)
})

test('trackpad deltas accumulate while horizontal scrolling and zoom gestures remain untouched', () => {
  const f = wheelFixture()
  assert.equal(f.wheel(100, 0, { ctrlKey: true }).prevented, false)
  assert.equal(f.wheel(20, 1, { deltaX: 100 }).prevented, false)
  f.wheel(20, 20)
  f.wheel(20, 40)
  assert.equal(f.state.page, 0)
  f.wheel(20, 60)
  assert.equal(f.state.page, 1)
  f.wheel(2, 400, { deltaMode: 1 })
  f.wheel(2, 450, { deltaMode: 1 })
  assert.equal(f.state.page, 2)
})

test('oversized rows scroll before turning pages and single-page lists retain ordinary scrolling', () => {
  const f = wheelFixture()
  f.body.scrollHeight = 600
  assert.equal(f.wheel(100, 0).prevented, false)
  assert.equal(f.state.page, 0)
  f.body.scrollTop = 300
  assert.equal(f.wheel(100, 100).prevented, true)
  assert.equal(f.state.page, 1)
  const single = wheelFixture(1)
  assert.equal(single.wheel(100, 0).prevented, false)
})
test('empty detail lists have one empty page and stable bounds', () => {
  assert.deepEqual(paginate([], 20), { items: [], page: 0, pages: 1, count: 0, start: 0, end: 0 })
})

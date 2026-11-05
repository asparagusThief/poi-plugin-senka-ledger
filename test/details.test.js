'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { paginate } = require('../src/details')
test('long detail lists are paged without losing or repeating records', () => {
  const rows = Array.from({ length: 125 }, (_, id) => ({ id }))
  const pages = [0, 1, 2].map(page => paginate(rows, page))
  assert.deepEqual(pages.map(p => p.items.length), [50, 50, 25])
  assert.deepEqual(pages.map(p => [p.start, p.end]), [[1, 50], [51, 100], [101, 125]])
  assert.deepEqual(pages.flatMap(p => p.items), rows)
  assert.equal(paginate(rows, 99).page, 2)
  assert.equal(paginate(rows, -1).page, 0)
})
test('empty detail lists have one empty page and stable bounds', () => {
  assert.deepEqual(paginate([], 20), { items: [], page: 0, pages: 1, count: 0, start: 0, end: 0 })
})

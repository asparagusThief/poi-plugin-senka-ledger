'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { Journal } = require('../src/storage')
const { summarize } = require('../src/model')
const first = { v: 1, type: 'experience', at: Date.parse('2026-11-04T20:00:00+09:00'), exp: 100000, gain: null, label: '母港' }
const next = { ...first, at: Date.parse('2026-11-05T20:00:00+09:00'), exp: 110000, gain: 1000 }
function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-ledger-'))
  return directory
}
function cleanup(directory) {
  if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-ledger-')) throw new Error('Unexpected test directory')
  fs.rmSync(directory, { recursive: true, force: true })
}
test('durable restart preserves baseline, unknown ranges and account separation', t => {
  const directory = fixture()
  const journal = new Journal(directory)
  journal.append('123', first)
  journal.close()
  const restarted = new Journal(directory)
  t.after(() => { restarted.close(); cleanup(directory) })
  restarted.append('123', next)
  restarted.append('456', { ...first, exp: 500000 })
  const report = summarize(restarted.load('123').state, '2026-11')
  assert.equal(report.total, 0.7)
  assert.equal(report.unknownWithinMonth, 6.3)
  assert.equal(summarize(restarted.load('456').state, '2026-11').total, 0)
  assert.deepEqual(restarted.list(), ['123', '456'])
})
test('torn or corrupt journals are preserved byte-for-byte and become read-only', t => {
  const directory = fixture()
  const file = path.join(directory, '123.jsonl')
  const contents = JSON.stringify(first) + '\n{"v":1'
  fs.writeFileSync(file, contents)
  const journal = new Journal(directory)
  t.after(() => { journal.close(); cleanup(directory) })
  assert.equal(journal.load('123').state.baseline.exp, 100000)
  assert.match(journal.load('123').error, /第 2 行/)
  assert.throws(() => journal.append('123', next), /暂停写入/)
  assert.equal(fs.readFileSync(file, 'utf8'), contents)
})
test('active writer lock and invalid account paths are rejected', t => {
  const journal = new Journal(fixture())
  t.after(() => { journal.close(); cleanup(journal.directory) })
  assert.throws(() => new Journal(journal.directory), /另一个 poi/)
  assert.throws(() => journal.load('../other'), /Invalid account/)
})
test('ranking snapshots survive restart alongside older experience records', t => {
  const directory = fixture()
  const journal = new Journal(directory)
  journal.append('123', first)
  journal.append('123', { v: 1, type: 'ranking', at: next.at, period: next.at - 3600000, entries: [{ rank: 250, score: 3200, self: true }] })
  journal.close()
  const restarted = new Journal(directory)
  t.after(() => { restarted.close(); cleanup(directory) })
  assert.equal(restarted.load('123').state.baseline.exp, first.exp)
  assert.equal(restarted.load('123').state.rankingHistory[0].entries[0].score, 3200)
  assert.equal(summarize(restarted.load('123').state, '2026-11').total, 0)
})

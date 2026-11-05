'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const os = require('os')
const { createRequire } = require('module')
const { Journal } = require('../src/storage')
const { summarize } = require('../src/model')
const filename = path.resolve(__dirname, '..', 'index.js')
function boot(directory) {
  const listeners = new Map()
  const win = {
    addEventListener(name, fn) { const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set) },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn) }
  }
  const localRequire = createRequire(filename)
  const context = { exports: {}, window: win, require: name => name === 'react' ? {} : name === 'views/env' ? { APPDATA_PATH: directory, isMain: true } : localRequire(name) }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
  return { plugin: context.exports, listeners, send(detail) { for (const fn of listeners.get('game.response') || []) fn({ detail }) } }
}
test('records before opening panel, unloads cleanly and resumes after restart', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-lifecycle-'))
  t.after(() => {
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-lifecycle-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const a = boot(directory)
  a.plugin.pluginDidLoad()
  a.plugin.pluginDidLoad()
  assert.equal(a.listeners.get('game.response').size, 1)
  const time = Date.parse('2026-11-04T23:00:00+09:00')
  a.send({ path: '/kcsapi/api_port/port', time, body: { api_basic: { api_member_id: 123, api_experience: 100000 } } })
  a.plugin.pluginWillUnload()
  assert.equal(a.listeners.get('game.response').size, 0)
  const b = boot(directory)
  b.plugin.pluginDidLoad()
  b.send({ path: '/kcsapi/api_port/port', time: time + 7200000, body: { api_basic: { api_member_id: 123, api_experience: 110000 } } })
  b.send({ path: '/kcsapi/api_req_sortie/battleresult', time: time + 7300000, body: { api_member_exp: 111000, api_get_exp: 1000 } })
  b.plugin.pluginWillUnload()
  const journal = new Journal(path.join(directory, 'senka-ledger'))
  const report = summarize(journal.load('123').state, '2026-11')
  journal.close()
  assert.equal(report.total, 0.7)
  assert.equal(report.unknownWithinMonth, 7)
  assert.equal(report.days[4].slots[1], 0.7)
})

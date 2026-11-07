'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const os = require('os')
const { EventEmitter } = require('events')
const { createRequire } = require('module')
const { Journal } = require('../src/storage')
const { summarize } = require('../src/model')
const filename = path.resolve(__dirname, '..', 'index.js')
function boot(directory, config) {
  const listeners = new Map()
  let service = null
  const win = {
    addEventListener(name, fn) { const set = listeners.get(name) || new Set(); set.add(fn); listeners.set(name, set) },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn) }
  }
  const localRequire = createRequire(filename)
  const context = { exports: {}, window: win, require(name) {
    if (name === 'react') return {}
    if (name === 'views/env') return { APPDATA_PATH: directory, isMain: true, config }
    if (name === './src/panel') return { createPanel: (_, value) => { service = value; return function Panel() {} } }
    return localRequire(name)
  } }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
  return { plugin: context.exports, service, listeners,
    send(detail) { for (const fn of listeners.get('game.response') || []) fn({ detail }) },
    dispatch(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event) }
  }
}

test('cancelled beforeunload keeps recording, history and ranking data available', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-lifecycle-'))
  const app = boot(directory)
  t.after(() => {
    app.plugin.pluginWillUnload()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-lifecycle-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  app.plugin.pluginDidLoad()
  const time = Date.parse('2026-11-06T15:00:00+09:00')
  app.send({ path: '/kcsapi/api_port/port', time, body: { api_basic: { api_member_id: 123, api_experience: 100000 } } })
  app.send({ path: '/kcsapi/api_req_sortie/battleresult', time: time + 1000, body: { api_member_exp: 101000, api_get_exp: 1000 } })
  const journal = app.service.entry('123')
  journal.state.rankingHistory.push({ v: 1, type: 'ranking', at: time, period: time, entries: [{ rank: 250, score: 3200, self: true }] })
  const updates = []
  const unsubscribe = app.service.subscribe(state => updates.push(state))
  t.after(unsubscribe)
  app.dispatch('beforeunload', { defaultPrevented: true, returnValue: false })
  assert.equal(app.listeners.get('game.response').size, 1)
  assert.ok(fs.existsSync(path.join(directory, 'senka-ledger', '.writer-lock')))
  assert.equal(app.service.entry('123'), journal)
  assert.equal(journal.state.rankingHistory[0].entries[0].score, 3200)
  app.send({ path: '/kcsapi/api_req_mission/result', time: time + 2000, body: { api_member_exp: 101050, api_get_exp: 50 } })
  assert.ok(Math.abs(summarize(journal.state, '2026-11').total - 0.735) < 1e-12)
  assert.equal(updates.at(-1).account, '123')
})

test('actual window unload releases the writer, updates status and retains the journal for restart', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-lifecycle-'))
  const app = boot(directory)
  t.after(() => {
    app.plugin.pluginWillUnload()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-lifecycle-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  app.plugin.pluginDidLoad()
  const time = Date.parse('2026-11-06T15:00:00+09:00')
  app.send({ path: '/kcsapi/api_port/port', time, body: { api_basic: { api_member_id: 123, api_experience: 100000 } } })
  app.send({ path: '/kcsapi/api_req_sortie/battleresult', time: time + 1000, body: { api_member_exp: 101000, api_get_exp: 1000 } })
  const changes = []
  const unsubscribe = app.service.subscribe(state => changes.push(state))
  t.after(unsubscribe)
  app.dispatch('unload')
  assert.equal(app.listeners.get('game.response').size, 0)
  assert.equal(app.listeners.get('unload').size, 0)
  assert.equal(fs.existsSync(path.join(directory, 'senka-ledger', '.writer-lock')), false)
  assert.equal(changes.at(-1).account, null)
  const restarted = new Journal(path.join(directory, 'senka-ledger'))
  try { assert.equal(summarize(restarted.load('123').state, '2026-11').total, 0.7) } finally { restarted.close() }
})
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

test('panel time zone and Admiral names persist through unload and reload and follow account changes', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-lifecycle-'))
  const prefix = 'plugin.poi-plugin-senka-ledger', values = new Map()
  const writes = []
  const config = { get: key => values.get(key), set(key, value) {
    values.set(key, value); writes.push([key, value])
  } }
  const app = boot(directory, config)
  t.after(() => {
    app.plugin.pluginWillUnload()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-lifecycle-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  app.plugin.pluginDidLoad()
  const snapshots = [], unsubscribe = app.service.subscribe(value => snapshots.push(value))
  t.after(unsubscribe)
  app.service.setZone('Asia/Shanghai')
  assert.equal(snapshots.at(-1).zone, 'Asia/Shanghai')
  const time = Date.parse('2026-11-07T10:00:00+09:00')
  const port = (id, name, at) => ({ path: '/kcsapi/api_port/port', time: at, body: { api_basic: { api_member_id: id, api_nickname: name, api_experience: 100000 } } })
  app.send(port(123, '雪風提督', time))
  app.send(port(123, '雪風提督', time + 1000))
  assert.equal(snapshots.at(-1).accountNames['123'], '雪風提督')
  assert.equal(writes.filter(([key]) => key === `${prefix}.accountNames`).length, 1)
  app.send(port(456, '別の提督', time + 2000))
  assert.equal(snapshots.at(-1).accountNames['123'], '雪風提督')
  assert.equal(snapshots.at(-1).accountNames['456'], '別の提督')
  assert.ok(!fs.readFileSync(path.join(directory, 'senka-ledger', '123.jsonl'), 'utf8').includes('雪風提督'))
  app.plugin.pluginWillUnload()
  app.plugin.pluginDidLoad()
  assert.equal(app.service.snapshot().zone, 'Asia/Shanghai')
  assert.equal(app.service.snapshot().accountNames['123'], '雪風提督')
})
test('JSON import notifies panels, selects the backup account and keeps live recording available', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-lifecycle-'))
  const app = boot(directory)
  t.after(() => {
    app.plugin.pluginWillUnload()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-lifecycle-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  app.plugin.pluginDidLoad()
  const time = Date.parse('2026-11-07T10:00:00+09:00')
  app.send({ path: '/kcsapi/api_port/port', time, body: { api_basic: { api_member_id: 123, api_experience: 100000 } } })
  const updates = [], unsubscribe = app.service.subscribe(value => updates.push(value))
  t.after(unsubscribe)
  const records = [{ v: 1, type: 'experience', at: time, exp: 200000, gain: null, label: '母港' }]
  const contents = JSON.stringify({ format: 'poi-senka-ledger', version: 1, account: '18176312', journal: JSON.stringify(records[0]) + '\n' })
  const result = await app.service.import({ size: contents.length, text: async () => contents })
  assert.equal(result.account, '18176312')
  assert.ok(updates.at(-1).accounts.includes('18176312'))
  assert.equal(updates.at(-1).account, '123')
  assert.equal(app.service.entry('18176312').state.baseline.exp, 200000)
  app.send({ path: '/kcsapi/api_req_sortie/battleresult', time: time + 1000, body: { api_member_exp: 101000, api_get_exp: 1000 } })
  assert.equal(summarize(app.service.entry('123').state, '2026-11').normal, 0.7)
})

test('poi integration registers original icon, follows language changes and migrates old window preferences', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-lifecycle-'))
  const listeners = new Map()
  const i18n = new EventEmitter()
  i18n.language = 'zh-CN'
  const bundles = new Map()
  i18n.addResourceBundle = (language, namespace, data) => bundles.set(language + ':' + namespace, data)
  const values = new Map([['poi.plugin.windowmode.senka-ledger', true], ['plugin.senka-ledger', { bounds: { width: 600, height: 500 } }]])
  const config = { get: key => values.get(key), set: (key, value) => values.set(key, value) }
  let icon = null
  let panelService = null
  const namespace = 'poi-plugin-senka-ledger'
  const pluginRows = [{ packageName: namespace, description: 'Initial' }, { packageName: 'poi-plugin-other', description: 'Other' }]
  const localRequire = createRequire(filename)
  const context = { exports: {}, window: {
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name)
  }, require(name) {
    if (name === 'react') return {}
    if (name === '@fortawesome/fontawesome-svg-core') return { library: { add: definition => { icon = definition } } }
    if (name === 'views/env') return { APPDATA_PATH: directory, isMain: true, config }
    if (name === 'views/env-parts/i18next') return { default: i18n }
    if (name === 'views/create-store') return { getStore: () => ({ plugins: pluginRows }), dispatch: action => {
      const target = pluginRows.find(plugin => plugin.packageName === action.payload.packageName)
      for (const option of action.payload.option) target[option.path] = option.status
    } }
    if (name === 'views/redux/actions/plugins') return { createPluginChangeStatusAction: payload => ({ payload }) }
    if (name === './src/panel') return { createPanel: (_, service) => { panelService = service; return function Panel() {} } }
    return localRequire(name)
  } }
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), context, { filename })
  assert.equal(icon.iconName, 'senka-ledger')
  assert.equal(bundles.get('zh-CN:poi-plugin-senka-ledger')['Senka Ledger'], '战果手账')
  const changes = []
  const unsubscribe = panelService.subscribe(state => changes.push(state))
  assert.equal(changes.at(-1).language, 'zh-CN')
  assert.equal(values.get('poi.plugin.windowmode.poi-plugin-senka-ledger'), true)
  assert.deepEqual(values.get('plugin.poi-plugin-senka-ledger'), { bounds: { width: 600, height: 500 } })
  i18n.language = 'en-US'; i18n.emit('languageChanged', 'en-US')
  assert.equal(changes.at(-1).language, 'en-US')
  const manifest = require('../package.json')
  assert.equal(pluginRows[0].description, manifest.description)
  i18n.language = 'ja-JP'; i18n.emit('languageChanged', 'ja-JP')
  assert.equal(pluginRows[0].description, bundles.get('ja-JP:' + namespace)[manifest.description])
  assert.equal(pluginRows[1].description, 'Other')
  unsubscribe(); context.exports.pluginWillUnload()
  assert.equal(i18n.listenerCount('languageChanged'), 0)
  assert.equal(listeners.size, 0)
  t.after(() => {
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-lifecycle-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
})

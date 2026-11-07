'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { Preferences, accountLabel } = require('../src/preferences')

function configStore(initial = {}) {
  const writes = []
  return { data: initial, writes,
    get(key) { return key.split('.').reduce((value, part) => value?.[part], initial) },
    set(key, value) {
      writes.push([key, value])
      const keys = key.split('.'), last = keys.pop()
      let node = initial
      for (let i = 0; i < keys.length; i++) node = node[keys[i]] ||= /^\d+$/.test(keys[i + 1] ?? last) ? [] : {}
      node[last] = value
    }
  }
}
test('time zone and own Admiral names persist across preference instances without changing window settings', () => {
  const bounds = { width: 600, height: 500 }
  const config = configStore({ plugin: { 'poi-plugin-senka-ledger': { bounds } } })
  const first = new Preferences(config)
  assert.equal(first.zone, 'Asia/Tokyo')
  first.setZone('Asia/Shanghai')
  first.rememberName('123', '雪風提督')
  const restarted = new Preferences(config)
  assert.deepEqual(restarted.snapshot(), { zone: 'Asia/Shanghai', accountNames: { 123: '雪風提督' } })
  assert.equal(config.data.plugin['poi-plugin-senka-ledger'].bounds, bounds)
  assert.equal(config.writes.length, 2)
  restarted.setZone('Asia/Shanghai')
  restarted.rememberName('123', '雪風提督')
  assert.equal(config.writes.length, 2)
  restarted.rememberName('123', '新しい提督名')
  assert.equal(new Preferences(config).accountNames['123'], '新しい提督名')
})

test('account labels distinguish identical names and retain an ID fallback for unread accounts', () => {
  assert.equal(accountLabel('123', { 123: '提督' }), '提督')
  assert.equal(accountLabel('456', { 123: '提督' }), '456')
  assert.equal(accountLabel('123', { 123: '提督', 456: '提督' }), '提督 (123)')
})

test('eight-digit account IDs are stored in a compact object rather than a sparse array', () => {
  const config = configStore()
  const prefs = new Preferences(config)
  prefs.rememberName('18176312', 'Sample Admiral')
  prefs.rememberName('99999999', 'Second Admiral')
  const saved = config.get('plugin.poi-plugin-senka-ledger.accountNames')
  assert.equal(Array.isArray(saved), false)
  assert.deepEqual(Object.keys(saved), ['18176312', '99999999'])
  assert.ok(JSON.stringify(config.data).length < 500)
  assert.deepEqual(new Preferences(config).accountNames, saved)
  assert.ok(config.writes.every(([key]) => !/\.\d+$/.test(key)))
})

test('invalid saved preferences are ignored and failed writes do not claim a setting was saved', () => {
  const prefs = new Preferences(configStore({ plugin: { 'poi-plugin-senka-ledger': {
    timezone: 'invalid', accountNames: { bad: 'Other', 123: '', 456: '提督', 789: 123 }
  } } }))
  assert.deepEqual(prefs.snapshot(), { zone: 'Asia/Tokyo', accountNames: { 456: '提督' } })
  assert.equal(prefs.rememberName('../123', 'Other'), false)
  assert.equal(prefs.rememberName('123', ' '), false)
  assert.throws(() => prefs.setZone('UTC'), /Invalid timezone/)
  const failed = new Preferences({ get() {}, set() { throw Error('write failed') } })
  assert.throws(() => failed.setZone('Asia/Shanghai'), /write failed/)
  assert.equal(failed.zone, 'Asia/Tokyo')
})

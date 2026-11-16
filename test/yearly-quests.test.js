'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { decode, createAdapter } = require('../src/adapter')
const { createLedger, apply } = require('../src/ledger')
const { summarize } = require('../src/model')
const { Journal } = require('../src/storage')
const { bonusText, translator } = require('../src/i18n')
const at = time => Date.parse(time + '+09:00')
function claim(time, id = 948) {
  const adapter = createAdapter()
  adapter.account = '123'
  return decode(adapter, { path: '/kcsapi/api_req_quest/clearitemget', time: at(time), body: {}, postBody: { api_quest_id: String(id) } }).records[0]
}

test('By10 successful reward response records 600 quest senka with its source ID', () => {
  const input = claim('2026-11-16T20:00:00')
  assert.equal(input.type, 'bonus')
  assert.equal(input.kind, 'quest')
  assert.equal(input.questId, 948)
  assert.equal(input.mapId, null)
  assert.equal(input.amount, 600)
  assert.match(input.label, /By10/)
  assert.equal(input.key, 'quest:yearly:2026:6:948')
  const state = createLedger()
  apply(state, input)
  const report = summarize(state, '2026-11')
  assert.equal(report.quest, 600)
  assert.equal(report.total, 600)
  assert.equal(report.normal, 0)
  assert.equal(report.unknownTotal, 0)
  assert.equal(report.days[15].events.length, 0)
  assert.equal(bonusText(state.events[0], translator('ja-JP')), '任務 #948')
})

test('By10 deduplicates across quarterly resets and New Year within its June annual cycle', () => {
  const dates = ['2026-06-01T05:00:00', '2026-09-01T05:00:00', '2026-11-16T20:00:00', '2026-12-01T05:00:00', '2027-01-01T05:00:00', '2027-03-01T05:00:00', '2027-06-01T04:59:59']
  const records = dates.map(time => claim(time))
  assert.equal(new Set(records.map(record => record.key)).size, 1)
  const state = createLedger()
  for (const record of records) apply(state, record)
  assert.equal(state.events.length, 1)
  assert.equal(state.events[0].amount, 600)
  assert.notEqual(claim('2027-06-01T05:00:00').key, records[0].key)
  assert.equal(claim('2027-06-01T05:00:00').key, 'quest:yearly:2027:6:948')
})

test('By10 resets at 05:00 JST on June 1 independently of the display time zone', () => {
  const before = claim('2027-06-01T04:59:59')
  const after = claim('2027-06-01T05:00:00')
  assert.equal(before.key, 'quest:yearly:2026:6:948')
  assert.equal(after.key, 'quest:yearly:2027:6:948')
  const state = createLedger()
  apply(state, claim('2026-11-16T00:30:00'))
  assert.equal(summarize(state, '2026-11', 'Asia/Tokyo').days[15].quest, 600)
  assert.equal(summarize(state, '2026-11', 'Asia/Shanghai').days[14].quest, 600)
})

test('By9 and By10 retain separate annual reward keys and their own reward amounts', () => {
  const state = createLedger()
  for (const id of [947, 948]) {
    const record = claim('2026-11-16T20:00:00', id)
    apply(state, record)
    apply(state, claim('2027-03-01T05:00:00', id))
    assert.equal(record.amount, id === 947 ? 480 : 600)
  }
  assert.equal(state.events.length, 2)
  assert.equal(summarize(state, '2026-11').quest, 1080)
  assert.equal(summarize(state, '2027-03').quest, 0)
})

test('existing quarterly quest keys remain compatible with prior journal versions', () => {
  const quarterly = claim('2026-11-16T20:00:00', 854)
  assert.equal(quarterly.key, 'quest:2026:2:854')
  assert.equal(claim('2026-12-01T04:59:59', 854).key, quarterly.key)
  assert.equal(claim('2026-12-01T05:00:00', 854).key, 'quest:2026:3:854')
  const state = createLedger()
  apply(state, quarterly)
  apply(state, JSON.parse(JSON.stringify(quarterly)))
  assert.equal(summarize(state, '2026-11').quest, 350)
})

test('quest listings, requests with another path and unsupported quests do not award By10 senka', () => {
  const adapter = createAdapter()
  adapter.account = '123'
  for (const api of ['/kcsapi/api_get_member/questlist', '/kcsapi/api_req_quest/start', '/kcsapi/api_req_quest/clearitemget-request']) {
    assert.deepEqual(decode(adapter, { path: api, time: at('2026-11-16T20:00:00'), postBody: { api_quest_id: '948' }, body: { api_list: [{ api_no: 948, api_state: 3 }] } }).records, [])
  }
  assert.equal(claim('2026-11-16T20:00:00', 99999), undefined)
})

test('annual reward survives journal restart, stays deduplicated and remains account-specific', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-yearly-'))
  const journal = new Journal(directory)
  journal.append('123', claim('2026-11-16T20:00:00'))
  journal.close()
  const restarted = new Journal(directory)
  t.after(() => {
    restarted.close()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-yearly-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  restarted.append('123', claim('2027-03-01T05:00:00'))
  restarted.append('456', claim('2026-11-16T20:00:00'))
  assert.equal(summarize(restarted.load('123').state, '2026-11').quest, 600)
  assert.equal(summarize(restarted.load('123').state, '2027-03').quest, 0)
  assert.equal(restarted.load('123').state.events[0].questId, 948)
  assert.equal(summarize(restarted.load('456').state, '2026-11').quest, 600)
})

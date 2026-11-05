'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { createAdapter, decode } = require('../src/adapter')
const { createLedger, apply } = require('../src/ledger')
const { summarize } = require('../src/model')
const { translator, battleText } = require('../src/i18n')
const at = text => Date.parse(text + '+09:00')
function fixture() {
  const adapter = createAdapter(), state = createLedger()
  const receive = detail => {
    const result = decode(adapter, detail)
    if (result) for (const record of result.records) apply(state, record)
    return result
  }
  receive({ path: '/kcsapi/api_port/port', time: at('2026-11-05T08:00:00'), body: { api_basic: { api_member_id: 123, api_experience: 100000 } } })
  receive({ path: '/kcsapi/api_req_map/start', time: at('2026-11-05T08:01:00'), body: { api_maparea_id: 7, api_mapinfo_no: 1, api_no: 4 } })
  return { adapter, state, receive }
}
test('practice EXP becomes local normal senka with a practice label and no stale sortie map', () => {
  const { state, receive } = fixture()
  receive({ path: '/kcsapi/api_req_practice/battle_result', time: at('2026-11-05T09:00:00'), body: { api_member_exp: 100200, api_get_exp: 200, api_win_rank: 'S' } })
  const report = summarize(state, '2026-11')
  assert.ok(Math.abs(report.normal - 0.14) < 1e-12)
  assert.ok(Math.abs(report.days[4].slots[9] - 0.14) < 1e-12)
  assert.equal(report.unknown.length, 0)
  const event = report.days[4].events[0]
  assert.equal(event.activity, 'practice')
  assert.equal(event.mapId, null)
  assert.equal(event.node, null)
  assert.equal(battleText(event, translator('en-US')), 'Practice · S')
  assert.equal(battleText(event, translator('zh-CN')), '演习 · S')
})
test('practice rewards do not absorb unrecorded EXP gaps or duplicate repeated responses', () => {
  const { state, receive } = fixture()
  const result = { path: '/kcsapi/api_req_practice/battle_result', time: at('2026-11-05T09:00:00'), body: { api_member_exp: 110200, api_get_exp: 200, api_win_rank: 'S' } }
  receive(result)
  receive({ ...result, time: result.time + 1000 })
  receive({ path: '/kcsapi/api_port/port', time: result.time + 2000, body: { api_basic: { api_member_id: 123, api_experience: 110200 } } })
  const report = summarize(state, '2026-11')
  assert.ok(Math.abs(report.normal - 0.14) < 1e-12)
  assert.equal(report.unknownWithinMonth, 7)
  assert.equal(report.days[4].events.length, 1)
})
test('missing practice reward data remains unlocated instead of assigning an entire gap to the current hour', () => {
  const { state, receive } = fixture()
  receive({ path: '/kcsapi/api_req_practice/battle_result', time: at('2026-11-05T09:00:00'), body: { api_member_exp: 110000, api_win_rank: 'S' } })
  assert.equal(summarize(state, '2026-11').normal, 0)
  assert.equal(summarize(state, '2026-11').unknownWithinMonth, 7)
})

'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { createAdapter, decode } = require('../src/adapter')
const { createLedger, apply, RATE } = require('../src/ledger')
const { Journal } = require('../src/storage')
const { summarize } = require('../src/model')
const { translator, battleText } = require('../src/i18n')
const { toCSV } = require('../src/export')
const at = text => Date.parse(text + '+09:00')
const result = (time, total, gain, clear = 1) => ({ path: '/kcsapi/api_req_mission/result', time: at(time),
  body: { api_member_exp: total, api_get_exp: gain, api_clear_result: clear, api_get_ship_exp: [999, 999, 999] } })
function fixture(exp = 100000) {
  const adapter = createAdapter(), state = createLedger()
  const receive = detail => {
    const decoded = decode(adapter, detail)
    if (decoded) for (const record of decoded.records) apply(state, record)
    return decoded
  }
  receive({ path: '/kcsapi/api_port/port', time: at('2026-11-05T08:00:00'), body: { api_basic: { api_member_id: 123, api_experience: exp } } })
  receive({ path: '/kcsapi/api_req_map/start', time: at('2026-11-05T08:01:00'), body: { api_maparea_id: 7, api_mapinfo_no: 1, api_no: 4 } })
  return { state, receive }
}

test('expedition success, great success and failure use the awarded Admiral EXP without ship EXP or multipliers', () => {
  for (const [clear, gain] of [[1, 50], [2, 100], [0, 15], [0, 0]]) {
    const { state, receive } = fixture()
    receive(result('2026-11-05T09:00:00', 100000 + gain, gain, clear))
    const report = summarize(state, '2026-11')
    assert.equal(report.normal, gain * RATE)
    assert.equal(report.days[4].slots[9], gain * RATE)
    assert.equal(report.unknown.length, 0)
    assert.equal(report.days[4].events.length, gain ? 1 : 0)
    if (gain) {
      const event = report.days[4].events[0]
      assert.equal(event.activity, 'expedition')
      assert.equal(event.mapId, null)
      assert.equal(event.node, null)
      assert.equal(event.rank, null)
      for (const [language, label] of Object.entries({ 'en-US': 'Expedition', 'zh-CN': '远征', 'zh-TW': '遠征', 'ja-JP': '遠征', 'ko-KR': '원정' })) {
        assert.equal(battleText(event, translator(language)), label)
      }
    }
  }
})

test('consecutive expedition rewards and duplicate results stay local and are not counted twice at port', () => {
  const { state, receive } = fixture()
  receive(result('2026-11-05T09:00:00', 100050, '50'))
  receive(result('2026-11-05T09:00:01', 100050, 50))
  receive(result('2026-11-05T09:00:02', 100130, 80, 2))
  receive({ path: '/kcsapi/api_port/port', time: at('2026-11-05T09:00:03'), body: { api_basic: { api_member_id: 123, api_experience: 100130 } } })
  const report = summarize(state, '2026-11')
  assert.ok(Math.abs(report.normal - 130 * RATE) < 1e-12)
  assert.equal(report.days[4].events.length, 2)
  assert.equal(report.unknown.length, 0)
  const csv = toCSV(state, '2026-11', 'Asia/Tokyo', 'en-US')
  assert.equal((csv.match(/Expedition/g) || []).length, 2)
  assert.ok(!csv.includes('7-1'))
})

test('an expedition only claims its explicit reward while an earlier offline gap remains unlocated across midnight', () => {
  const { state, receive } = fixture()
  receive(result('2026-11-06T00:00:00', 114050, 50))
  const report = summarize(state, '2026-11')
  assert.equal(report.days[4].normal, 0)
  assert.equal(report.days[5].slots[0], 50 * RATE)
  assert.equal(report.unknown.length, 1)
  assert.equal(report.unknown[0].amount, 14000 * RATE)
  assert.equal(report.unknown[0].from, at('2026-11-05T08:00:00'))
  assert.equal(report.unknown[0].to, at('2026-11-06T00:00:00'))
})

test('the first expedition result records only its explicit reward rather than lifetime EXP', () => {
  const { state, receive } = fixture(null)
  receive(result('2026-11-05T09:00:00', 90000080, 80))
  assert.equal(summarize(state, '2026-11').normal, 80 * RATE)
  assert.equal(summarize(state, '2026-11').unknown.length, 0)
})

test('missing, malformed or inconsistent expedition rewards never promote unrelated EXP into a local hour', () => {
  for (const gain of [undefined, null, '', ' ', true, -1, [50], 1000]) {
    const { state, receive } = fixture()
    receive(result('2026-11-05T09:00:00', 100050, gain))
    assert.equal(summarize(state, '2026-11').normal, 0)
    assert.equal(summarize(state, '2026-11').unknownTotal, 50 * RATE)
  }
  const { state, receive } = fixture()
  receive(result('2026-11-05T09:00:00', undefined, 50))
  assert.equal(state.baseline.exp, 100000)
  receive({ path: '/kcsapi/api_port/port', time: at('2026-11-05T09:01:00'), body: { api_basic: { api_member_id: 123, api_experience: 100050 } } })
  assert.equal(summarize(state, '2026-11').normal, 0)
  assert.equal(summarize(state, '2026-11').unknownTotal, 50 * RATE)
})

test('expedition records survive restart and an unchanged repeated reward remains deduplicated', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-ledger-expedition-'))
  let journal = new Journal(directory)
  t.after(() => {
    journal.close()
    assert.equal(path.dirname(directory), fs.realpathSync(os.tmpdir()))
    assert.ok(path.basename(directory).startsWith('senka-ledger-expedition-'))
    fs.rmSync(directory, { recursive: true, force: true })
  })
  const adapter = createAdapter()
  for (const detail of [
    { path: '/kcsapi/api_port/port', time: at('2026-11-05T08:00:00'), body: { api_basic: { api_member_id: 123, api_experience: 100000 } } },
    result('2026-11-05T09:00:00', 100050, 50)
  ]) {
    const decoded = decode(adapter, detail)
    for (const record of decoded.records) journal.append(decoded.account, record)
  }
  journal.close()
  journal = new Journal(directory)
  const repeated = decode(adapter, result('2026-11-05T09:00:01', 100050, 50))
  journal.append(repeated.account, repeated.records[0])
  const report = summarize(journal.load('123').state, '2026-11')
  assert.equal(report.normal, 50 * RATE)
  assert.equal(report.unknown.length, 0)
  assert.equal(report.days[4].events[0].activity, 'expedition')
})

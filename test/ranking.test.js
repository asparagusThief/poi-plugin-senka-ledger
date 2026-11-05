'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const { ROW_FACTORS, period, createRankingReader, readRanking, snapshot, RANKING_PATH } = require('../src/ranking')
const { createLedger, apply } = require('../src/ledger')
const { summarize, months } = require('../src/model')
const { createAdapter, decode } = require('../src/adapter')
const at = s => Date.parse(s + '+09:00')
function page(start, count = 10, own = 7) {
  return { api_list: Array.from({ length: count }, (_, i) => {
    const rank = start + i
    return { api_mxltvkpyuklh: rank, api_wuhnhojjxmke: (7000 - rank * 7 + 91) * 43 * ROW_FACTORS[rank % 13], api_mtjmdcwtvhdr: rank === own ? 'Admiral' : 'Other ' + rank }
  }) }
}
test('decodes ranking pages, finds own score and retains anchor observations with original read times', () => {
  const reader = createRankingReader()
  const first = at('2026-11-05T16:00:00')
  const one = readRanking(reader, page(1), first, 'Admiral', '123')
  assert.deepEqual(one.entries.map(e => [e.rank, e.score, e.self]), [[1, 6993, false], [5, 6965, false], [7, 6951, true]])
  const two = readRanking(reader, page(491), first + 60000, 'Admiral', '123')
  const state = createLedger()
  apply(state, one); apply(state, two)
  const report = snapshot(state.rankingHistory, '2026-11')
  assert.equal(report.rows.find(e => e.rank === 500).score, 3500)
  assert.equal(report.rows.find(e => e.rank === 1).at, first)
  assert.equal(report.rows.find(e => e.self).rank, 7)
  assert.equal(summarize(state, '2026-11').total, 0)
  assert.equal(summarize(state, '2026-11').unknown.length, 0)
  assert.deepEqual(months(state, 'Asia/Tokyo'), ['2026-11'])
})
test('incomplete or changed encoding is not published as a guessed score', () => {
  assert.equal(readRanking(createRankingReader(), page(1, 1), at('2026-11-05T16:00:00'), '', '123'), null)
  const malformed = page(1)
  malformed.api_list[0].api_wuhnhojjxmke++
  assert.equal(readRanking(createRankingReader(), malformed, at('2026-11-05T16:00:00'), '', '123'), null)
})
test('same-name users are not mistaken for self; a matching account ID takes precedence', () => {
  const input = page(1)
  input.api_list[7].api_mtjmdcwtvhdr = 'Admiral'
  const ambiguous = readRanking(createRankingReader(), input, at('2026-11-05T16:00:00'), 'Admiral', '123')
  assert.ok(ambiguous.entries.every(e => !e.self))
  input.api_list[6].api_member_id = '123'
  const identified = readRanking(createRankingReader(), input, at('2026-11-05T16:00:00'), 'Admiral', '123')
  assert.equal(identified.entries.find(e => e.self).rank, 7)
})
test('ranking periods cross months at 03:00 JST and reset the decoder between updates', () => {
  assert.equal(period(at('2026-12-01T02:59:59')), at('2026-11-30T15:00:00'))
  assert.equal(period(at('2026-12-01T03:00:00')), at('2026-12-01T03:00:00'))
  assert.equal(period(at('2026-12-01T14:59:59')), at('2026-12-01T03:00:00'))
  const reader = createRankingReader()
  const old = readRanking(reader, page(1), at('2026-12-01T02:59:00'), 'Admiral', '123')
  assert.equal(snapshot([old], '2026-11').rows.length, 3)
  assert.equal(snapshot([old], '2026-12').rows.length, 0)
  assert.equal(readRanking(reader, page(500, 1), at('2026-12-01T03:01:00'), 'Admiral', '123'), null)
  assert.equal(reader.rows.size, 1)
})
test('ranking adapter records minimal values and isolates account changes', () => {
  const adapter = createAdapter()
  const time = at('2026-11-05T16:00:00')
  decode(adapter, { path: '/kcsapi/api_port/port', time, body: { api_basic: { api_member_id: 123, api_nickname: 'Admiral', api_experience: 100000 } } })
  const result = decode(adapter, { path: RANKING_PATH, time, body: page(1), postBody: { api_token: 'DO-NOT-SAVE' } })
  assert.equal(result.records[0].type, 'ranking')
  assert.ok(!JSON.stringify(result.records).includes('Admiral'))
  assert.ok(!JSON.stringify(result.records).includes('DO-NOT-SAVE'))
  decode(adapter, { path: '/kcsapi/api_port/port', time, body: { api_basic: { api_member_id: 456, api_nickname: 'Next', api_experience: 200000 } } })
  assert.equal(adapter.ranking.rows.size, 0)
  assert.equal(adapter.nickname, 'Next')
})

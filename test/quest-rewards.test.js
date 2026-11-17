'use strict'
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { questReward } = require('../src/quest-rewards')
const { createAdapter, decode } = require('../src/adapter')
const { QUESTS, createLedger, apply } = require('../src/ledger')
const { Journal } = require('../src/storage')
const { summarize } = require('../src/model')
const { parseBackup } = require('../src/backup')
const { bonusText, translator } = require('../src/i18n')
const at = Date.parse('2026-11-17T20:00:00+09:00')
const reward = amount => ({ api_type: 18, api_count: amount, api_item: null })
const body = (...entries) => ({ api_bounus: entries })
function claim(id, response, time = at, adapter = null) {
  adapter ||= createAdapter()
  adapter.account ||= '123'
  return decode(adapter, { path: '/kcsapi/api_req_quest/clearitemget', time, body: response, postBody: { api_quest_id: id, api_token: 'NEVER_STORE_THIS' } }).records
}

test('captured quest reward items expose point values directly in api_count', () => {
  // Sanitized public clearitemget samples, not synthesized reward item IDs:
  // https://kcrdb.hitomaru.dev/quests?state=0,1&sort=api_no&extend=clearItems
  for (const [id, amount] of [[284, 80], [329, 12], [843, 60], [845, 330], [854, 350], [872, 400], [882, 260], [888, 200], [893, 300], [903, 390], [947, 480], [948, 600], [949, 800], [955, 500]]) {
    assert.equal(questReward(body(reward(amount))), amount, 'quest ' + id)
  }
  assert.equal(questReward(body({ api_type: 18, api_count: '12345' })), 12345)
})

test('fallback records real quests outside the built-in table and keeps their task source', () => {
  for (const [id, amount] of [[329, 12], [843, 60], [882, 260], [949, 800], [955, 500]]) {
    assert.equal(Object.hasOwn(QUESTS, id), false)
    const records = claim(String(id), body(reward(amount)))
    assert.equal(records.length, 1)
    const record = records[0]
    assert.equal(record.amount, amount)
    assert.equal(record.kind, 'quest')
    assert.equal(record.questId, id)
    assert.equal(record.mapId, null)
    assert.equal(record.key, `quest:response:${id}:${at}`)
    assert.equal(JSON.stringify(record).includes('NEVER_STORE_THIS'), false)
    const state = createLedger()
    apply(state, record)
    assert.equal(summarize(state, '2026-11').quest, amount)
    assert.equal(bonusText(state.events[0], translator('ja-JP')), '任務 #' + id)
  }
})

test('known tasks keep their original amounts, labels and periodic keys even when response rewards differ', () => {
  for (const id of Object.keys(QUESTS)) {
    const original = claim(id, {})[0]
    assert.deepEqual(claim(id, body(reward(9999))), [original])
    assert.deepEqual(claim(id, { api_bounus: 'malformed' }), [original])
  }
  assert.equal(claim(854, body(reward(1)))[0].key, 'quest:2026:2:854')
  assert.equal(claim(948, body(reward(1)))[0].key, 'quest:yearly:2026:6:948')
})

test('counts only ranking-point items, sums multiple entries and ignores non-point rewards', () => {
  const response = body(null, { api_type: 1, api_count: 10000, api_item: { api_id: 901 } }, reward(350), { api_type: 12, api_count: 3, api_item: { api_id: 18 } }, { api_type: '18', api_count: '50', api_item: null })
  assert.equal(questReward(response), 400)
  assert.equal(claim(99001, response)[0].amount, 400)
  // A future point amount needs no reward-ID mapping.
  assert.equal(questReward(body(reward(12345))), 12345)
  assert.equal(questReward(body({ api_type: 18, api_count: 80, api_item: { api_id: 901 } })), 80)
})

test('missing point data, unknown reward types and invalid quest IDs do not produce phantom rewards', () => {
  for (const response of [undefined, null, {}, { api_bonus: [reward(350)] }, { api_bounus: null }, { api_bounus: [] }, body({ api_type: 13, api_count: 350, api_item: { api_id: 901 } }), body({ api_type: 99, api_count: 350 }), { api_result: 0, ...body(reward(350)) }]) {
    assert.equal(questReward(response), null)
    assert.deepEqual(claim(99001, response), [])
  }
  for (const id of [null, undefined, '', 'invalid', 0, -1, 1.5]) assert.deepEqual(claim(id, body(reward(350))), [])
  const adapter = createAdapter()
  assert.equal(decode(adapter, { path: '/kcsapi/api_req_quest/clearitemget', time: at, body: body(reward(350)), postBody: { api_quest_id: 99001 } }), null)
})

test('malformed ranking-point entries and overflow reject the entire receipt instead of a partial total', () => {
  for (const invalid of [undefined, null, false, true, '', ' ', '350oops', '1e3', '0x10', -1, 0, 1.5, NaN, Infinity, [], {}, Number.MAX_SAFE_INTEGER + 1]) {
    const response = body(reward(350), reward(invalid))
    assert.equal(questReward(response), null, String(invalid))
    assert.deepEqual(claim(99001, response), [])
  }
  for (const malformed of [7, [], 'bad', {}, { api_type: null, api_count: 600 }, { api_type: 18 }]) assert.equal(questReward(body(reward(350), malformed)), null)
  assert.equal(questReward(body(reward(Number.MAX_SAFE_INTEGER), reward(1))), null)
})

test('only clearitemget responses trigger fallback; quest list and selection fields do not grant rewards', () => {
  const adapter = createAdapter()
  adapter.account = '123'
  for (const api of ['/kcsapi/api_get_member/questlist', '/kcsapi/api_req_quest/start', '/kcsapi/api_req_quest/stop']) {
    assert.deepEqual(decode(adapter, { path: api, time: at, postBody: { api_quest_id: '99001' }, body: body(reward(350)) }).records, [])
  }
  assert.deepEqual(claim(99001, { api_select_rewards: [[{ api_kind: 18, api_count: 350 }]] }), [])
})

test('repeated copies of one response deduplicate while later successful claims remain recordable', () => {
  const state = createLedger()
  const first = claim(99001, body(reward(350)))[0]
  apply(state, first)
  apply(state, claim(99001, body(reward(350)))[0])
  // The task's period is unknown: do not incorrectly allow only one claim per quarter.
  apply(state, claim(99001, body(reward(350)), at + 86400000)[0])
  assert.equal(state.events.length, 2)
  assert.equal(summarize(state, '2026-11').quest, 700)
  assert.equal(summarize(state, '2026-11').normal, 0)
  assert.equal(summarize(state, '2026-11').unknownTotal, 0)
})

test('journal restart, JSON import and subsequent local responses retain exactly one copy of a receipt', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'senka-rewards-'))
  const journal = new Journal(directory)
  const first = claim(99001, body(reward(350)))[0]
  journal.append('123', first)
  journal.close()
  const restarted = new Journal(directory)
  t.after(() => {
    restarted.close()
    if (path.dirname(directory) !== fs.realpathSync(os.tmpdir()) || !path.basename(directory).startsWith('senka-rewards-')) throw Error('Unexpected test directory')
    fs.rmSync(directory, { recursive: true, force: true })
  })
  restarted.append('123', first)
  const backup = JSON.stringify({ format: 'poi-senka-ledger', version: 1, account: '123', journal: fs.readFileSync(restarted.load('123').file, 'utf8') })
  assert.equal((await parseBackup(backup)).records[0].key, first.key)
  assert.equal((await restarted.importBackup(backup)).added, 0)
  restarted.append('123', claim(99001, body(reward(350)), at + 86400000)[0])
  restarted.append('456', first)
  assert.equal(summarize(restarted.load('123').state, '2026-11').quest, 700)
  assert.equal(summarize(restarted.load('456').state, '2026-11').quest, 350)
})

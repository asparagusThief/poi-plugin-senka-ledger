'use strict'

const { EO, QUESTS } = require('./ledger')
const { parts } = require('./time')
const number = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}
const BATTLES = new Set(['/kcsapi/api_req_sortie/battleresult', '/kcsapi/api_req_combined_battle/battleresult'])
function createAdapter() {
  return { account: null, mapId: null, node: null }
}
// Read only documented, relevant fields. Tokens and complete API bodies never enter the journal.
function decode(adapter, detail) {
  const { path, body = {}, postBody = {}, time: at } = detail || {}
  if (!Number.isSafeInteger(at) || at < 0) return null
  const basic = path === '/kcsapi/api_port/port' || path === '/kcsapi/api_get_member/require_info' ? body.api_basic :
    path === '/kcsapi/api_get_member/basic' ? body : null
  if (basic && /^\d+$/.test(String(basic.api_member_id))) {
    const account = String(basic.api_member_id)
    if (adapter.account !== account) { adapter.mapId = null; adapter.node = null }
    adapter.account = account
  }
  if (path === '/kcsapi/api_start2/getData') {
    adapter.account = null
    adapter.mapId = null
    adapter.node = null
  }
  if (!adapter.account) return null
  const records = []
  const push = data => records.push({ v: 1, at, ...data })
  let exp = null
  if (basic) exp = number(basic.api_experience)
  else if (path === '/kcsapi/api_get_member/record') exp = number(body.api_experience?.[0])
  else if (BATTLES.has(path) || ['/kcsapi/api_req_practice/battle_result', '/kcsapi/api_req_mission/result'].includes(path)) exp = number(body.api_member_exp)
  if (path === '/kcsapi/api_req_map/start' || path === '/kcsapi/api_req_map/next') {
    const area = number(body.api_maparea_id) ?? number(postBody.api_maparea_id)
    const map = number(body.api_mapinfo_no) ?? number(postBody.api_mapinfo_no)
    if (path.endsWith('/start')) adapter.mapId = area !== null && map !== null ? area * 10 + map : null
    else if (area !== null && map !== null) adapter.mapId = area * 10 + map
    adapter.node = number(body.api_no)
  }
  const mapLabel = adapter.mapId === null ? '海域未知' : `${Math.floor(adapter.mapId / 10)}-${adapter.mapId % 10}`
  if (exp !== null) push({ type: 'experience', exp,
    gain: BATTLES.has(path) ? number(body.api_get_exp) : null,
    label: BATTLES.has(path) ? `${mapLabel}${adapter.node === null ? '' : ` 节点 ${adapter.node}`} · ${body.api_win_rank || '?'} 胜败` : '总经验观测' })
  const eoAmount = number(body.api_get_exmap_rate) || number(body.api_get_eo_rate)
  if (eoAmount && (BATTLES.has(path) || path === '/kcsapi/api_req_map/next' || path === '/kcsapi/api_req_map/start')) {
    const id = adapter.mapId !== null && Object.hasOwn(EO, adapter.mapId) ? adapter.mapId : null
    push({ type: 'bonus', kind: 'eo', amount: eoAmount, mapId: id, questId: null,
      key: id === null ? `eo-response:${at}:${eoAmount}` : `eo:${parts(at).month}:${id}`,
      label: `${mapLabel} · EO 奖励` })
  }
  // Only a successful response is accepted. A request alone does not prove a reward was claimed.
  if (path === '/kcsapi/api_req_quest/clearitemget') {
    const id = number(postBody.api_quest_id)
    if (Object.hasOwn(QUESTS, id)) {
      const [amount, label] = QUESTS[id]
      const date = new Date(at + 9 * 3600000 - 5 * 3600000)
      const quarter = Math.floor((date.getUTCMonth() + 10) / 3)
      const cycleYear = date.getUTCMonth() < 2 ? date.getUTCFullYear() - 1 : date.getUTCFullYear()
      push({ type: 'bonus', kind: 'quest', amount, questId: id, mapId: null,
        key: `quest:${cycleYear}:${quarter % 4}:${id}`, label: `${label} · 任务 ${id}` })
    }
  }
  return { account: adapter.account, records }
}
module.exports = { number, createAdapter, decode }

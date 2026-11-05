'use strict'

const { parts, monthStart } = require('./time')
const RATE = 7 / 10000
const EO = { 15: 75, 16: 75, 25: 100, 35: 150, 45: 180, 55: 200, 56: 225, 65: 250, 75: 170 }
const QUESTS = {
  854: [350, 'Z作战前段'], 888: [200, '三川舰队'], 893: [300, '泊地周边'],
  872: [400, 'Z作战后段'], 284: [80, '海上警备'], 845: [330, '西方海域'], 903: [390, '六水战']
}
const integer = n => Number.isSafeInteger(n) && n >= 0
function validInput(input) {
  if (!input || input.v !== 1 || !Number.isSafeInteger(input.at) || input.at < 0) return false
  switch (input.type) {
    case 'experience': return integer(input.exp) && (input.gain === null || integer(input.gain)) && typeof input.label === 'string'
    case 'bonus': return ['eo', 'quest'].includes(input.kind) && integer(input.amount) && input.amount > 0 && typeof input.key === 'string' && typeof input.label === 'string' &&
      (input.mapId === null || integer(input.mapId)) && (input.questId === null || integer(input.questId))
    case 'maps': return Array.isArray(input.cleared) && input.cleared.every(n => integer(n) && Object.hasOwn(EO, n))
    case 'ranking': return integer(input.period) && input.period <= input.at && Array.isArray(input.entries) && input.entries.length <= 8 && input.entries.every(e => integer(e.rank) && e.rank > 0 && integer(e.score) && typeof e.self === 'boolean')
    default: return false
  }
}
function createLedger() {
  return { events: [], rankingHistory: [], baseline: null, eoMonths: {}, unlocatedEO: {}, ambiguousEO: {}, bonusKeys: new Set(), sequence: 0 }
}
function add(state, event) {
  state.events.push({ id: ++state.sequence, ...event })
}
function unknown(state, input, amount, kind, from, label) {
  add(state, { source: 'unknown', kind, amount, at: input.at, from, to: input.at, label })
}
function apply(state, input) {
  if (!validInput(input)) throw new Error('Invalid ledger record')
  const { at } = input
  if (input.type === 'ranking') {
    state.rankingHistory.push(input)
  } else if (input.type === 'experience') {
    const old = state.baseline
    // Ignore stale observations: they must never move the cumulative baseline backwards.
    if (old && at < old.at) return
    const localGain = input.gain
    if (!old) {
      if (localGain !== null && localGain <= input.exp && localGain > 0) {
        add(state, { source: 'local', kind: 'normal', amount: localGain * RATE, exp: localGain, at, label: input.label, activity: input.activity, mapId: input.mapId, node: input.node, rank: input.rank })
      }
      add(state, { source: 'baseline', kind: 'baseline', amount: 0, at, label: '首次观测：此前普通战果未收录' })
    } else {
      const delta = input.exp - old.exp
      if (delta < 0) {
        add(state, { source: 'warning', kind: 'warning', amount: 0, at, label: '总经验回退：已忽略异常观测并保留原基准' })
        return
      } else if (localGain !== null && localGain > delta) {
        // Duplicate/overlapping results or inconsistent API values are not safe to attribute.
        if (delta > 0) unknown(state, input, delta * RATE, 'normal', old.at, '经验与本场奖励不一致，无法定位')
      } else {
        const known = localGain || 0
        if (delta > known) unknown(state, input, (delta - known) * RATE, 'normal', old.at, '未在本地记录的经验增量（可能来自其他客户端）')
        if (known > 0) add(state, { source: 'local', kind: 'normal', amount: known * RATE, exp: known, at, label: input.label, activity: input.activity, mapId: input.mapId, node: input.node, rank: input.rank })
      }
    }
    state.baseline = { exp: input.exp, at }
  } else if (input.type === 'bonus') {
    if (state.bonusKeys.has(input.key)) return
    state.bonusKeys.add(input.key)
    const month = parts(at).month
    if (input.kind === 'eo' && input.mapId !== null) {
      const seen = state.eoMonths[month] ||= {}
      // A map snapshot may have arrived before this response. Upgrade the existing
      // inferred event instead of counting the same EO reward twice.
      const prior = seen[input.mapId]
      if (prior) {
        const event = state.events.find(e => e.id === prior)
        if (event && event.source === 'unknown' && event.amount === input.amount) {
          Object.assign(event, { source: 'local', at, label: input.label })
          delete event.from
          delete event.to
        }
        return
      }
      add(state, { source: 'local', kind: 'eo', amount: input.amount, at, label: input.label })
      seen[input.mapId] = state.sequence
    } else {
      if (input.kind === 'eo') {
        (state.ambiguousEO[month] ||= new Set()).add(input.amount)
        for (const event of state.events) {
          if (event.kind === 'eo' && event.source === 'unknown' && event.amount === input.amount && parts(event.at).month === month) {
            event.label = `EO ${input.amount} 战果奖励，同额海域无法区分，完成时间未记录`
          }
        }
        const prior = state.events.find(e => e.kind === 'eo' && e.source === 'unknown' && e.amount === input.amount && parts(e.at).month === month)
        if (prior) {
          Object.assign(prior, { source: 'local', at, label: input.label })
          delete prior.from
          delete prior.to
          return
        }
      }
      add(state, { source: 'local', kind: input.kind, amount: input.amount, at, label: input.label })
      if (input.kind === 'eo') (state.unlocatedEO[month] ||= []).push({ amount: input.amount, id: state.sequence })
    }
  } else if (input.type === 'maps') {
    const month = parts(at).month
    const seen = state.eoMonths[month] ||= {}
    for (const id of input.cleared) {
      if (seen[id]) continue
      // Starting the plugin in an ongoing sortie can leave the map identity
      // unknown. Consume that direct reward before inferring any extra EO.
      const credits = state.unlocatedEO[month] ||= []
      const matching = credits.findIndex(credit => credit.amount === EO[id])
      if (matching >= 0) {
        seen[id] = credits.splice(matching, 1)[0].id
        continue
      }
      const label = state.ambiguousEO[month]?.has(EO[id]) ? `EO ${EO[id]} 战果奖励，同额海域无法区分，完成时间未记录` : `EO ${Math.floor(id / 10)}-${id % 10} 已完成，完成时间未记录`
      unknown(state, input, EO[id], 'eo', monthStart(at), label)
      seen[id] = state.sequence
    }
  }
}
module.exports = { RATE, EO, QUESTS, validInput, createLedger, apply }
